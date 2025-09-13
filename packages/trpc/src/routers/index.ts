import { router } from "../trpc";
import { rulesRouter } from "./rules";
import { versionsRouter } from "./versions";
import { tagsRouter } from "./tags";
import { commentsRouter } from "./comments";
import { votesRouter } from "./votes";
import { searchRouter } from "./search";

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

// Simple metrics router
const metricsRouter = router({
  recordEvent: eventRateLimitedProcedure
    .input(
      z.object({
        type: z.enum(["VIEW", "COPY", "SAVE", "FORK"]),
        ruleId: z.string().optional(),
        ruleVersionId: z.string().optional(),
        idempotencyKey: z.string().optional(),
      })
    )
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const { type, ruleId, ruleVersionId } = input;

      await ctx.prisma.event.create({
        data: {
          type,
          userId: ctx.user?.id || null,
          ruleId: ruleId || null,
          ruleVersionId: ruleVersionId || null,
          ipHash: ctx.reqIpHash,
          uaHash: ctx.uaHash,
        },
      });

      return { success: true };
    }),

  getOpenMetrics: publicProcedure
    .input(
      z.object({
        ruleId: z.string(),
        period: z.enum(["day", "week", "month", "all"]).default("week"),
      })
    )
    .output(
      z.object({
        views: z.number(),
        copies: z.number(),
        saves: z.number(),
        forks: z.number(),
        score: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { ruleId, period } = input;

      let startDate: Date | undefined;
      if (period !== "all") {
        startDate = new Date();
        switch (period) {
          case "day":
            startDate.setDate(startDate.getDate() - 1);
            break;
          case "week":
            startDate.setDate(startDate.getDate() - 7);
            break;
          case "month":
            startDate.setDate(startDate.getDate() - 30);
            break;
        }
      }

      const metrics = await ctx.prisma.event.groupBy({
        by: ["type"],
        where: {
          ruleId,
          ...(startDate && { createdAt: { gte: startDate } }),
          type: { in: ["VIEW", "COPY", "SAVE", "FORK"] },
        },
        _count: true,
      });

      const rule = await ctx.prisma.rule.findUnique({
        where: { id: ruleId },
        select: { score: true },
      });

      return {
        views: metrics.find((m) => m.type === "VIEW")?._count || 0,
        copies: metrics.find((m) => m.type === "COPY")?._count || 0,
        saves: metrics.find((m) => m.type === "SAVE")?._count || 0,
        forks: metrics.find((m) => m.type === "FORK")?._count || 0,
        score: rule?.score || 0,
      };
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
            followerUserId_followingUserId: {
              followerUserId: ctx.user.id,
              followingUserId: authorUserId,
            },
          },
        });

        if (existing) {
          await tx.follow.delete({
            where: {
              followerUserId_followingUserId: {
                followerUserId: ctx.user.id,
                followingUserId: authorUserId,
              },
            },
          });
        } else {
          await tx.follow.create({
            data: {
              followerUserId: ctx.user.id,
              followingUserId: authorUserId,
            },
          });
        }

        const followersCount = await tx.follow.count({
          where: { followingUserId: authorUserId },
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
        items,
        nextCursor,
        hasMore,
      };
    }),
});

// Placeholder routers for remaining functionality
const claimsRouter = router({
  submit: rateLimitedProcedure
    .input(
      z.object({
        ruleId: z.string(),
        evidenceUrl: z.string().url().optional(),
        description: z.string().min(10).max(1000),
        idempotencyKey: z.string().optional(),
      })
    )
    .output(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { ruleId, evidenceUrl, description } = input;

      const claim = await ctx.prisma.claim.create({
        data: {
          ruleId,
          claimantUserId: ctx.user.id,
          evidenceUrl,
          status: "PENDING",
        },
      });

      return { id: claim.id };
    }),

  listForReview: modProcedure
    .input(
      z.object({
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
      })
    )
    .output(
      z.object({
        items: z.array(z.any()),
        nextCursor: z.string().optional(),
        hasMore: z.boolean(),
      })
    )
    .query(async ({ input, ctx }) => {
      // Placeholder implementation
      return { items: [], nextCursor: undefined, hasMore: false };
    }),
});

const donationsRouter = router({
  createCheckout: rateLimitedProcedure
    .input(
      z.object({
        toUserId: z.string(),
        ruleId: z.string().optional(),
        amountCents: z.number().int().positive(),
        currency: z.string().length(3),
        idempotencyKey: z.string().optional(),
      })
    )
    .output(z.object({ checkoutUrl: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Placeholder - would integrate with Stripe
      return { checkoutUrl: "https://checkout.stripe.com/placeholder" };
    }),
});

const leaderboardRouter = router({
  get: publicProcedure
    .input(
      z.object({
        period: z.enum(["DAILY", "WEEKLY", "MONTHLY", "ALL"]),
        scope: z.enum(["GLOBAL", "TAG", "MODEL"]),
        scopeRef: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .output(
      z.object({
        items: z.array(z.any()),
        nextCursor: z.string().optional(),
        hasMore: z.boolean(),
      })
    )
    .query(async ({ input, ctx }) => {
      // Placeholder implementation
      return { items: [], nextCursor: undefined, hasMore: false };
    }),
});

// Main app router
export const appRouter = router({
  rules: rulesRouter,
  versions: versionsRouter,
  tags: tagsRouter,
  comments: commentsRouter,
  votes: votesRouter,
  search: searchRouter,
  metrics: metricsRouter,
  social: socialRouter,
  claims: claimsRouter,
  donations: donationsRouter,
  leaderboard: leaderboardRouter,
});

export type AppRouter = typeof appRouter;
