import { router } from "../trpc";
import { rulesRouter } from "./rules";
import { versionsRouter } from "./versions";
import { tagsRouter } from "./tags";
import { commentsRouter } from "./comments";
import { votesRouter } from "./votes";
import { searchRouter } from "./search";
import { socialRouter as socialRouterFull } from "./social";
import { badgesRouter } from "./badges";
import { leaderboardRouter } from "./leaderboard";
import { donationsRouter } from "./donations";
import { adminRouter } from "./admin";
import { claimsRouter } from "./claims";
import { GamificationService } from "../services/gamification";

// Import placeholder routers for remaining functionality
import { z } from "zod";
import {
  publicProcedure,
  protectedProcedure,
  rateLimitedProcedure,
  modProcedure,
  adminProcedure,
  eventRateLimitedProcedure,
  audit,
} from "../trpc";

// Metrics router with ingest service integration
const metricsRouter = router({
  recordEvent: eventRateLimitedProcedure
    .input(
      z.object({
        type: z.enum(["VIEW", "COPY", "SAVE", "FORK", "VOTE", "COMMENT"]),
        ruleId: z.string().optional(),
        ruleVersionId: z.string().optional(),
        idempotencyKey: z.string().optional(),
      })
    )
    .output(z.object({ success: z.boolean(), error: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const { type, ruleId, ruleVersionId } = input;

      // For tRPC calls, we'll send directly to ingest service
      const ingestBaseUrl = process.env.INGEST_BASE_URL;
      const ingestAppToken = process.env.INGEST_APP_TOKEN;

      if (!ingestBaseUrl || !ingestAppToken) {
        // Fallback: store directly in database
        await ctx.prisma.event.create({
          data: {
            type,
            userId: ctx.user?.id || null,
            ruleId: ruleId || null,
            ruleVersionId: ruleVersionId || null,
            ipHash: ctx.reqIpHash || "unknown",
            uaHash: ctx.reqUAHeader || "unknown",
          },
        });
        return { success: true };
      }

      try {
        const response = await fetch(`${ingestBaseUrl}/ingest/events`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-app-token": ingestAppToken,
            "x-forwarded-for": ctx.reqIpHeader || "0.0.0.0",
            "user-agent": ctx.reqUAHeader || "",
          },
          body: JSON.stringify({
            events: [
              {
                type,
                ruleId,
                ruleVersionId,
                userId: ctx.user?.id || null,
                ts: new Date().toISOString(),
              },
            ],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          console.error(
            `Ingest service error: ${response.status} - ${errorText}`
          );

          // For non-VIEW events, surface the error
          if (type !== "VIEW") {
            return {
              success: false,
              error: `Ingest service error: ${response.status}`,
            };
          }
        }

        return { success: true };
      } catch (error) {
        console.error("Failed to send event to ingest service:", error);

        // For non-VIEW events, surface the error
        if (type !== "VIEW") {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }

        return { success: true }; // VIEW events are fire-and-forget
      }
    }),

  getOpenMetrics: publicProcedure
    .input(
      z.object({
        ruleId: z.string(),
      })
    )
    .output(
      z.object({
        views7: z.number(),
        copies7: z.number(),
        saves7: z.number(),
        forks7: z.number(),
        votes7: z.number(),
        views30: z.number(),
        copies30: z.number(),
        saves30: z.number(),
        forks30: z.number(),
        votes30: z.number(),
        score: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { ruleId } = input;

      // Use the database helper to get open metrics
      const { getRuleOpenMetrics } = await import("@repo/db");

      try {
        const metrics = await getRuleOpenMetrics(ruleId);
        return metrics;
      } catch (error) {
        console.error("Failed to get open metrics:", error);

        // Fallback to zero metrics
        return {
          views7: 0,
          copies7: 0,
          saves7: 0,
          forks7: 0,
          votes7: 0,
          views30: 0,
          copies30: 0,
          saves30: 0,
          forks30: 0,
          votes30: 0,
          score: 0,
        };
      }
    }),
});

// Simple social router
const socialRouter = router({
  followAuthor: rateLimitedProcedure
    .input(
      z.object({
        authorUserId: z.string(),
        idempotencyKey: z.string().optional(),
      })
    )
    .use(audit("social.follow"))
    .output(z.object({ following: z.boolean(), followersCount: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const { authorUserId } = input;

      if (authorUserId === ctx.user.id) {
        throw new Error("Cannot follow yourself");
      }

      const result = await ctx.prisma.$transaction(async (tx) => {
        const existing = await tx.follow.findUnique({
          where: {
            followerUserId_authorUserId: {
              followerUserId: ctx.user.id,
              authorUserId: authorUserId,
            },
          },
        });

        if (existing) {
          await tx.follow.delete({
            where: {
              followerUserId_authorUserId: {
                followerUserId: ctx.user.id,
                authorUserId: authorUserId,
              },
            },
          });
        } else {
          await tx.follow.create({
            data: {
              followerUserId: ctx.user.id,
              authorUserId: authorUserId,
            },
          });
        }

        const followersCount = await tx.follow.count({
          where: { authorUserId: authorUserId },
        });

        return { following: !existing, followersCount };
      });

      return result;
    }),

  favoriteRule: rateLimitedProcedure
    .input(
      z.object({
        ruleId: z.string(),
        idempotencyKey: z.string().optional(),
      })
    )
    .use(audit("social.favorite"))
    .output(z.object({ favorited: z.boolean(), favoritesCount: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const { ruleId } = input;

      const result = await ctx.prisma.$transaction(async (tx) => {
        const existing = await tx.favorite.findUnique({
          where: {
            userId_ruleId: {
              userId: ctx.user.id,
              ruleId,
            },
          },
        });

        if (existing) {
          await tx.favorite.delete({
            where: {
              userId_ruleId: {
                userId: ctx.user.id,
                ruleId,
              },
            },
          });
        } else {
          await tx.favorite.create({
            data: {
              userId: ctx.user.id,
              ruleId,
            },
          });

          // Record event
          await tx.event.create({
            data: {
              type: "SAVE",
              userId: ctx.user.id,
              ruleId,
              ipHash: ctx.reqIpHash,
              uaHash: ctx.uaHash,
            },
          });
        }

        const favoritesCount = await tx.favorite.count({
          where: { ruleId },
        });

        return { favorited: !existing, favoritesCount };
      });

      return result;
    }),

  listNotifications: protectedProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        unreadOnly: z.boolean().default(false),
      })
    )
    .output(
      z.object({
        items: z.array(
          z.object({
            id: z.string(),
            type: z.string(),
            payload: z.record(z.unknown()),
            readAt: z.date().nullable(),
            createdAt: z.date(),
          })
        ),
        nextCursor: z.string().optional(),
        hasMore: z.boolean(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { cursor, limit, unreadOnly } = input;

      const where: any = {
        userId: ctx.user.id,
        ...(unreadOnly && { readAt: null }),
      };

      if (cursor) {
        where.id = { lt: cursor };
      }

      const notifications = await ctx.prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit + 1,
      });

      const hasMore = notifications.length > limit;
      const items = hasMore ? notifications.slice(0, -1) : notifications;
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

      return {
        items: items.map(item => ({
          ...item,
          type: item.type as string,
          payload: (item.payload as Record<string, unknown>) || {},
        })),
        nextCursor,
        hasMore,
      };
    }),
});

// Claims router is now imported from ./claims

// Donations router is now imported from ./donations

// Leaderboard router is now imported from ./leaderboard

// Main app router
export const appRouter = router({
  rules: rulesRouter,
  versions: versionsRouter,
  tags: tagsRouter,
  comments: commentsRouter,
  votes: votesRouter,
  search: searchRouter,
  metrics: metricsRouter,
  social: socialRouterFull,
  badges: badgesRouter,
  claims: claimsRouter,
  donations: donationsRouter,
  leaderboard: leaderboardRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
