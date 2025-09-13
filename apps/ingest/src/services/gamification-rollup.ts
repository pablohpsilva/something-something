import { prisma } from "../prisma";
import { logger } from "../logger";
import { GamificationService } from "@repo/trpc/services/gamification";
import type { RollupResult } from "./rollup";

/**
 * Perform gamification tasks after rollup
 */
export async function performGamificationTasks(
  targetDate: Date,
  result: RollupResult
): Promise<void> {
  try {
    logger.info("Starting gamification tasks");

    const awardContext = {
      prisma,
      now: targetDate,
    };

    // Seed badge catalog if needed
    await GamificationService.seedBadgeCatalog(awardContext);

    // Generate leaderboard snapshots with gamification service
    const snapshots = await generateLeaderboardSnapshots(
      awardContext,
      targetDate
    );

    // Award top 10 weekly badges
    if (snapshots.weekly && snapshots.weekly.length > 0) {
      const topRuleIds = snapshots.weekly
        .slice(0, 10)
        .map((entry: any) => entry.ruleId);
      result.badgesAwarded.top10Week =
        await GamificationService.awardTop10WeeklyBadges(
          awardContext,
          topRuleIds
        );
    }

    // Check hundred copies badges for updated rules
    const updatedRules = await getUpdatedRulesForBadgeCheck(targetDate);
    for (const ruleId of updatedRules) {
      const awarded = await GamificationService.checkHundredCopies(
        awardContext,
        ruleId
      );
      if (awarded) {
        result.badgesAwarded.hundredCopies++;
      }
    }

    // Check ten upvotes badges for rules with new votes
    const rulesWithNewVotes = await getRulesWithNewVotes(targetDate);
    for (const ruleId of rulesWithNewVotes) {
      const awarded = await GamificationService.checkTenUpvotes(
        awardContext,
        ruleId
      );
      if (awarded) {
        result.badgesAwarded.tenUpvotes++;
      }
    }

    logger.info("Gamification tasks completed", {
      badgesAwarded: result.badgesAwarded,
    });
  } catch (error) {
    logger.error("Failed to perform gamification tasks", { error });
    // Don't fail the entire rollup for gamification errors
  }
}

/**
 * Generate leaderboard snapshots using gamification service
 */
async function generateLeaderboardSnapshots(
  awardContext: { prisma: any; now: Date },
  targetDate: Date
): Promise<{
  daily?: any[];
  weekly?: any[];
  monthly?: any[];
}> {
  const snapshots: any = {};

  try {
    // Generate DAILY snapshot
    const dailyEntries = await GamificationService.computeLeaderboard(
      awardContext,
      {
        period: "DAILY",
        scope: "GLOBAL",
        limit: 100,
      }
    );

    if (dailyEntries.length > 0) {
      await GamificationService.createLeaderboardSnapshot(
        awardContext,
        { period: "DAILY", scope: "GLOBAL" },
        dailyEntries
      );
      snapshots.daily = dailyEntries;
    }

    // Generate WEEKLY snapshot
    const weeklyEntries = await GamificationService.computeLeaderboard(
      awardContext,
      {
        period: "WEEKLY",
        scope: "GLOBAL",
        limit: 100,
      }
    );

    if (weeklyEntries.length > 0) {
      await GamificationService.createLeaderboardSnapshot(
        awardContext,
        { period: "WEEKLY", scope: "GLOBAL" },
        weeklyEntries
      );
      snapshots.weekly = weeklyEntries;
    }

    // Generate MONTHLY snapshot
    const monthlyEntries = await GamificationService.computeLeaderboard(
      awardContext,
      {
        period: "MONTHLY",
        scope: "GLOBAL",
        limit: 100,
      }
    );

    if (monthlyEntries.length > 0) {
      await GamificationService.createLeaderboardSnapshot(
        awardContext,
        { period: "MONTHLY", scope: "GLOBAL" },
        monthlyEntries
      );
      snapshots.monthly = monthlyEntries;
    }

    // Generate popular TAG snapshots (optional)
    const popularTags = await prisma.tag.findMany({
      include: {
        _count: {
          select: { rules: { where: { status: "PUBLISHED" } } },
        },
      },
      orderBy: { rules: { _count: "desc" } },
      take: 5, // Top 5 tags
    });

    for (const tag of popularTags) {
      if (tag._count.rules > 10) {
        // Minimum threshold
        const tagEntries = await GamificationService.computeLeaderboard(
          awardContext,
          {
            period: "WEEKLY",
            scope: "TAG",
            scopeRef: tag.slug,
            limit: 50,
          }
        );

        if (tagEntries.length > 0) {
          await GamificationService.createLeaderboardSnapshot(
            awardContext,
            { period: "WEEKLY", scope: "TAG", scopeRef: tag.slug },
            tagEntries
          );
        }
      }
    }
  } catch (error) {
    logger.error("Failed to generate leaderboard snapshots", { error });
  }

  return snapshots;
}

/**
 * Get rules that were updated today for badge checking
 */
async function getUpdatedRulesForBadgeCheck(
  targetDate: Date
): Promise<string[]> {
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const updatedRules = await prisma.ruleMetricDaily.findMany({
    where: {
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    select: { ruleId: true },
    distinct: ["ruleId"],
  });

  return updatedRules.map((r) => r.ruleId);
}

/**
 * Get rules that received new votes today
 */
async function getRulesWithNewVotes(targetDate: Date): Promise<string[]> {
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const votedRules = await prisma.vote.findMany({
    where: {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    select: { ruleId: true },
    distinct: ["ruleId"],
  });

  return votedRules.map((v) => v.ruleId).filter(Boolean);
}
