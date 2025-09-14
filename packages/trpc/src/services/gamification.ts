/**
 * Gamification service for badges and leaderboards
 * Handles badge awarding, leaderboard computation, and ranking logic
 */

import { prisma } from "@repo/db";
import type { PrismaClient } from "@repo/db";

export type AwardContext = {
  prisma: PrismaClient;
  now: Date;
};

/**
 * Static badge catalog - seeded to database on startup
 */
export const BadgeCatalog = [
  {
    slug: "first-contribution",
    name: "First Contribution",
    description: "Published your first rule",
    criteria: { type: "event", name: "rule.published" },
  },
  {
    slug: "ten-upvotes",
    name: "10 Upvotes",
    description: "A rule reached net +10 votes",
    criteria: { type: "threshold", metric: "rule.votes.net", value: 10 },
  },
  {
    slug: "hundred-copies",
    name: "100 Copies",
    description: "A rule was copied 100+ times",
    criteria: { type: "threshold", metric: "rule.copies.sum", value: 100 },
  },
  {
    slug: "verified-author",
    name: "Verified Author",
    description: "Ownership claim approved",
    criteria: { type: "event", name: "claim.approved" },
  },
  {
    slug: "top-10-week",
    name: "Top 10 (Week)",
    description: "A rule ranked top 10 this week",
    criteria: { type: "snapshot", period: "WEEKLY", rankAtMost: 10 },
  },
  {
    slug: "streak-7",
    name: "7-Day Streak",
    description: "Active 7 days in a row",
    criteria: { type: "streak", days: 7 },
  },
] as const;

/**
 * Leaderboard entry for ranking computation
 */
export interface LeaderboardEntry {
  rank: number;
  ruleId: string;
  ruleSlug: string;
  title: string;
  author: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
  };
  score: number;
  copies: number;
  views: number;
  saves?: number;
  forks?: number;
  votes?: number;
  rankDelta?: number | null;
}

/**
 * Leaderboard computation parameters
 */
export interface LeaderboardParams {
  period: "DAILY" | "WEEKLY" | "MONTHLY" | "ALL";
  scope: "GLOBAL" | "TAG" | "MODEL";
  scopeRef?: string;
  windowDays?: number;
  limit?: number;
}

/**
 * Gamification service with badge awarding and leaderboard logic
 */
export const GamificationService = {
  /**
   * Seed badge catalog to database (idempotent)
   */
  async seedBadgeCatalog(ctx: AwardContext): Promise<number> {
    let seeded = 0;

    for (const badge of BadgeCatalog) {
      const existing = await ctx.prisma.badge.findUnique({
        where: { slug: badge.slug },
      });

      if (!existing) {
        await ctx.prisma.badge.create({
          data: {
            slug: badge.slug,
            name: badge.name,
            description: badge.description,
            criteria: badge.criteria,
          },
        });
        seeded++;
      }
    }

    return seeded;
  },

  /**
   * Award a badge to a user if eligible (idempotent)
   */
  async awardBadgeIfEligible(
    ctx: AwardContext,
    userId: string,
    slug: string,
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    try {
      const badge = await ctx.prisma.badge.findUnique({
        where: { slug },
      });

      if (!badge) {
        console.warn(`Badge not found: ${slug}`);
        return false;
      }

      // Check if already awarded
      const existing = await ctx.prisma.userBadge.findUnique({
        where: {
          userId_badgeId: {
            userId,
            badgeId: badge.id,
          },
        },
      });

      if (existing) {
        return false; // Already awarded
      }

      // Award the badge
      await ctx.prisma.userBadge.create({
        data: {
          userId,
          badgeId: badge.id,
          awardedAt: ctx.now,
        },
      });

      // Create audit log
      await ctx.prisma.auditLog.create({
        data: {
          action: "badge.award",
          targetType: "Badge",
          targetId: badge.id,
          actorId: userId,
          metadata: {
            badgeSlug: slug,
            userId,
            badgeMetadata: metadata || {},
          } as any,
        },
      });

      return true;
    } catch (error) {
      console.error(`Failed to award badge ${slug} to user ${userId}:`, error);
      return false;
    }
  },

  /**
   * Check and award first contribution badge
   */
  async checkFirstContribution(
    ctx: AwardContext,
    userId: string
  ): Promise<boolean> {
    // Check if user has any published rules
    const publishedCount = await ctx.prisma.rule.count({
      where: {
        createdByUserId: userId,
        status: "PUBLISHED",
      },
    });

    if (publishedCount === 1) {
      // This is their first published rule
      return await this.awardBadgeIfEligible(ctx, userId, "first-contribution");
    }

    return false;
  },

  /**
   * Check and award ten upvotes badge for a rule
   */
  async checkTenUpvotes(ctx: AwardContext, ruleId: string): Promise<boolean> {
    // Get rule with vote score
    const rule = await ctx.prisma.rule.findUnique({
      where: { id: ruleId },
      select: {
        createdByUserId: true,
        _count: {
          select: {
            votes: {
              where: { value: 1 }, // upvotes
            },
          },
        },
      },
    });

    if (!rule) return false;

    // Calculate net score (upvotes - downvotes)
    const upvotes = rule._count.votes;
    const downvotes = await ctx.prisma.vote.count({
      where: { ruleId, value: -1 },
    });

    const netScore = upvotes - downvotes;

    if (netScore >= 10) {
      return await this.awardBadgeIfEligible(
        ctx,
        rule.createdByUserId,
        "ten-upvotes",
        { ruleId, netScore }
      );
    }

    return false;
  },

  /**
   * Check and award hundred copies badge for a rule
   */
  async checkHundredCopies(
    ctx: AwardContext,
    ruleId: string
  ): Promise<boolean> {
    // Sum all-time copies from RuleMetricDaily
    const copySum = await ctx.prisma.ruleMetricDaily.aggregate({
      where: { ruleId },
      _sum: { copies: true },
    });

    const totalCopies = copySum._sum.copies || 0;

    if (totalCopies >= 100) {
      const rule = await ctx.prisma.rule.findUnique({
        where: { id: ruleId },
        select: { createdByUserId: true },
      });

      if (rule) {
        return await this.awardBadgeIfEligible(
          ctx,
          rule.createdByUserId,
          "hundred-copies",
          { ruleId, totalCopies }
        );
      }
    }

    return false;
  },

  /**
   * Award verified author badge
   */
  async awardVerifiedAuthor(
    ctx: AwardContext,
    userId: string
  ): Promise<boolean> {
    return await this.awardBadgeIfEligible(ctx, userId, "verified-author");
  },

  /**
   * Award top 10 weekly badges to rule authors
   */
  async awardTop10WeeklyBadges(
    ctx: AwardContext,
    topRuleIds: string[]
  ): Promise<number> {
    let awarded = 0;

    for (const ruleId of topRuleIds.slice(0, 10)) {
      const rule = await ctx.prisma.rule.findUnique({
        where: { id: ruleId },
        select: { createdByUserId: true },
      });

      if (rule) {
        const wasAwarded = await this.awardBadgeIfEligible(
          ctx,
          rule.createdByUserId,
          "top-10-week",
          { ruleId, rank: topRuleIds.indexOf(ruleId) + 1 }
        );
        if (wasAwarded) awarded++;
      }
    }

    return awarded;
  },

  /**
   * Compute leaderboard entries for given parameters
   */
  async computeLeaderboard(
    ctx: AwardContext,
    params: LeaderboardParams
  ): Promise<LeaderboardEntry[]> {
    const { period, scope, scopeRef, windowDays, limit = 100 } = params;

    // Calculate date range based on period
    let startDate: Date | undefined;
    if (period !== "ALL") {
      const days = windowDays || this.getPeriodDays(period);
      startDate = new Date(ctx.now);
      startDate.setDate(startDate.getDate() - days);
    }

    // Build where clause for scope
    let ruleWhere: any = {};
    if (scope === "TAG" && scopeRef) {
      ruleWhere.tags = {
        some: { slug: scopeRef },
      };
    } else if (scope === "MODEL" && scopeRef) {
      ruleWhere.primaryModel = scopeRef;
    }

    // Query rules with their metrics
    const rules = await ctx.prisma.rule.findMany({
      where: {
        status: "PUBLISHED",
        ...ruleWhere,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        metrics: {
          where: startDate ? { date: { gte: startDate } } : undefined,
        },
      },
    });

    // Aggregate metrics and compute scores
    const entries = rules
      .map((rule) => {
        const metrics = rule.metrics;

        // Sum metrics across the period
        const totalViews = metrics.reduce((sum, m) => sum + m.views, 0);
        const totalCopies = metrics.reduce((sum, m) => sum + m.copies, 0);
        const totalSaves = metrics.reduce((sum, m) => sum + m.saves, 0);
        const totalForks = metrics.reduce((sum, m) => sum + m.forks, 0);
        const totalVotes = metrics.reduce((sum, m) => sum + m.votes, 0);

        // Use latest score or compute weighted score
        const latestScore =
          metrics.length > 0 ? Math.max(...metrics.map((m) => m.score)) : 0;

        // Apply minimum thresholds
        if (totalViews < 10 && totalCopies < 1) {
          return null;
        }

        return {
          rank: 0, // Will be set after sorting
          ruleId: rule.id,
          ruleSlug: rule.slug,
          title: rule.title,
          author: rule.createdBy,
          score: latestScore,
          copies: totalCopies,
          views: totalViews,
          saves: totalSaves,
          forks: totalForks,
          votes: totalVotes,
        };
      })
      .filter((entry) => entry !== null);

    // Sort by score, then by tie-breakers
    entries.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.copies !== a.copies) return b.copies - a.copies;
      if (b.views !== a.views) return b.views - a.views;
      return 0; // Could add updatedAt tie-breaker
    });

    // Assign ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1;
    });

    return entries.slice(0, limit);
  },

  /**
   * Create leaderboard snapshot
   */
  async createLeaderboardSnapshot(
    ctx: AwardContext,
    params: LeaderboardParams,
    entries: LeaderboardEntry[]
  ): Promise<string> {
    const { period, scope, scopeRef } = params;

    // Check for existing snapshot today
    const today = new Date(ctx.now);
    today.setHours(0, 0, 0, 0);

    const existing = await ctx.prisma.leaderboardSnapshot.findFirst({
      where: {
        period,
        scope,
        scopeRef: scopeRef || null,
        createdAt: { gte: today },
      },
    });

    if (existing) {
      // Update existing snapshot
      await ctx.prisma.leaderboardSnapshot.update({
        where: { id: existing.id },
        data: {
          rank: {
            entries,
            meta: {
              period,
              scope,
              scopeRef: scopeRef || null,
              windowDays: this.getPeriodDays(period),
              generatedAt: ctx.now.toISOString(),
            },
          } as any,
        },
      });
      return existing.id;
    } else {
      // Create new snapshot
      const snapshot = await ctx.prisma.leaderboardSnapshot.create({
        data: {
          period,
          scope,
          scopeRef: scopeRef || null,
          rank: {
            entries,
            meta: {
              period,
              scope,
              scopeRef: scopeRef || null,
              windowDays: this.getPeriodDays(period),
              generatedAt: ctx.now.toISOString(),
            },
          } as any,
        },
      });
      return snapshot.id;
    }
  },

  /**
   * Get previous snapshot for rank delta calculation
   */
  async getPreviousSnapshot(
    ctx: AwardContext,
    period: string,
    scope: string,
    scopeRef?: string
  ): Promise<any> {
    const snapshots = await ctx.prisma.leaderboardSnapshot.findMany({
      where: {
        period: period as any,
        scope: scope as any,
        scopeRef: scopeRef || null,
      },
      orderBy: { createdAt: "desc" },
      take: 2,
    });

    return snapshots.length > 1 ? snapshots[1] : null;
  },

  /**
   * Get period duration in days
   */
  getPeriodDays(period: string): number {
    switch (period) {
      case "DAILY":
        return 1;
      case "WEEKLY":
        return 7;
      case "MONTHLY":
        return 30;
      default:
        return 365; // ALL
    }
  },

  /**
   * Recheck all badges for a user (rate-limited)
   */
  async recheckUserBadges(ctx: AwardContext, userId: string): Promise<number> {
    let awarded = 0;

    // Check first contribution
    if (await this.checkFirstContribution(ctx, userId)) {
      awarded++;
    }

    // Check user's rules for vote and copy thresholds
    const userRules = await ctx.prisma.rule.findMany({
      where: { createdByUserId: userId, status: "PUBLISHED" },
      select: { id: true },
    });

    for (const rule of userRules) {
      if (await this.checkTenUpvotes(ctx, rule.id)) {
        awarded++;
      }
      if (await this.checkHundredCopies(ctx, rule.id)) {
        awarded++;
      }
    }

    return awarded;
  },
};
