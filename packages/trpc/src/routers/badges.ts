import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  router,
  publicProcedure,
  protectedProcedure,
  rateLimitedProcedure,
  rateLimit,
} from "../trpc";
import {
  badgesListInputSchema,
  badgesAllInputSchema,
  badgesRecheckInputSchema,
  userBadgesResponseSchema,
  badgeCatalogResponseSchema,
  badgesRecheckResponseSchema,
} from "../schemas/gamification";
import { GamificationService } from "../services/gamification";

// Rate limited procedure for badge recheck (5 per minute)
const badgeRecheckRateLimitedProcedure = protectedProcedure.use(
  rateLimit("badgeRecheck", 5, 60 * 1000)
);

export const badgesRouter = router({
  /**
   * List current user's badges
   */
  listMine: protectedProcedure
    .output(userBadgesResponseSchema)
    .query(async ({ ctx }) => {
      const userId = ctx.user!.id;

      const userBadges = await ctx.prisma.userBadge.findMany({
        where: { userId },
        include: {
          badge: {
            select: {
              slug: true,
              name: true,
              description: true,
              criteria: true,
            },
          },
        },
        orderBy: { awardedAt: "desc" },
      });

      return {
        badges: userBadges.map((ub) => ({
          slug: ub.badge.slug,
          name: ub.badge.name,
          description: ub.badge.description,
          criteria: (ub.badge.criteria as Record<string, unknown>) || {},
          awardedAt: ub.awardedAt,
        })),
        totalCount: userBadges.length,
      };
    }),

  /**
   * List badges for a specific user (public)
   */
  listForUser: publicProcedure
    .input(badgesListInputSchema)
    .output(userBadgesResponseSchema)
    .query(async ({ input, ctx }) => {
      const { userId } = input;

      if (!userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User ID is required",
        });
      }

      // Verify user exists
      const user = await ctx.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const userBadges = await ctx.prisma.userBadge.findMany({
        where: { userId },
        include: {
          badge: {
            select: {
              slug: true,
              name: true,
              description: true,
              criteria: true,
            },
          },
        },
        orderBy: { awardedAt: "desc" },
      });

      return {
        badges: userBadges.map((ub) => ({
          slug: ub.badge.slug,
          name: ub.badge.name,
          description: ub.badge.description,
          criteria: (ub.badge.criteria as Record<string, unknown>) || {},
          awardedAt: ub.awardedAt,
        })),
        totalCount: userBadges.length,
      };
    }),

  /**
   * Get badge catalog (all available badges)
   */
  catalog: publicProcedure
    .input(badgesAllInputSchema)
    .output(badgeCatalogResponseSchema)
    .query(async ({ ctx }) => {
      const badges = await ctx.prisma.badge.findMany({
        select: {
          slug: true,
          name: true,
          description: true,
          criteria: true,
        },
        orderBy: { name: "asc" },
      });

      return {
        badges: badges.map((badge) => ({
          ...badge,
          criteria: (badge.criteria as Record<string, unknown>) || {},
        })),
      };
    }),

  /**
   * Recheck badges for current user (rate limited)
   */
  recheckMine: badgeRecheckRateLimitedProcedure
    .input(badgesRecheckInputSchema)
    .output(badgesRecheckResponseSchema)
    .mutation(async ({ ctx }) => {
      const userId = ctx.user!.id;

      try {
        const awardContext = {
          prisma: ctx.prisma,
          now: new Date(),
        };

        const awarded = await GamificationService.recheckUserBadges(
          awardContext,
          userId
        );

        return {
          awarded,
          message:
            awarded > 0
              ? `Congratulations! You earned ${awarded} new badge${
                  awarded === 1 ? "" : "s"
                }!`
              : "No new badges earned. Keep contributing!",
        };
      } catch (error) {
        console.error("Failed to recheck badges:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to recheck badges",
        });
      }
    }),

  /**
   * Get badge statistics (admin/debug)
   */
  stats: publicProcedure
    .output(
      z.object({
        totalBadges: z.number(),
        totalAwarded: z.number(),
        awardsByBadge: z.array(
          z.object({
            slug: z.string(),
            name: z.string(),
            count: z.number(),
          })
        ),
      })
    )
    .query(async ({ ctx }) => {
      const [totalBadges, totalAwarded, badgeStats] = await Promise.all([
        ctx.prisma.badge.count(),
        ctx.prisma.userBadge.count(),
        ctx.prisma.badge.findMany({
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            criteria: true,
          },
          orderBy: { name: "asc" },
        }),
      ]);

      return {
        totalBadges,
        totalAwarded,
        awardsByBadge: badgeStats.map((badge) => ({
          slug: badge.slug,
          name: badge.name,
          count: 0, // Count would need to be fetched separately
        })),
      };
    }),

  /**
   * Check if user has specific badge
   */
  hasBadge: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        badgeSlug: z.string(),
      })
    )
    .output(
      z.object({
        hasBadge: z.boolean(),
        awardedAt: z.date().nullable(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { userId, badgeSlug } = input;

      const badge = await ctx.prisma.badge.findUnique({
        where: { slug: badgeSlug },
      });

      if (!badge) {
        return { hasBadge: false, awardedAt: null };
      }

      const userBadge = await ctx.prisma.userBadge.findUnique({
        where: {
          userId_badgeId: {
            userId,
            badgeId: badge.id,
          },
        },
      });

      return {
        hasBadge: !!userBadge,
        awardedAt: userBadge?.awardedAt || null,
      };
    }),
});
