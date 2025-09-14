/**
 * Database helpers for metrics aggregation and querying
 */

import { prisma } from "./client";
// import { RuleStatus } from "@prisma/client"; // Not available, using string literals
import {
  METRICS_WINDOW_RECENT_DAYS,
  METRICS_WINDOW_LONG_DAYS,
  getMetricsDateRange,
  capViewCount,
} from "@repo/utils";

export interface MetricsSummary {
  views: number;
  copies: number;
  saves: number;
  forks: number;
  votes: number;
  score: number;
}

export interface TrendingRule {
  id: string;
  slug: string;
  title: string;
  score: number;
  views: number;
  copies: number;
  saves: number;
  forks: number;
}

/**
 * Sum rule metrics from RuleMetricDaily for a given time window
 * @param ruleId Rule ID
 * @param days Number of days to look back
 * @returns Aggregated metrics
 */
export async function sumRuleMetrics(
  ruleId: string,
  days: number
): Promise<MetricsSummary> {
  const dateRange = getMetricsDateRange(days);
  const startDate = dateRange[dateRange.length - 1];
  const endDate = dateRange[0];

  const metrics = await prisma.ruleMetricDaily.findMany({
    where: {
      ruleId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      views: true,
      copies: true,
      saves: true,
      forks: true,
      votes: true,
      score: true,
    },
  });

  if (metrics.length === 0) {
    return {
      views: 0,
      copies: 0,
      saves: 0,
      forks: 0,
      votes: 0,
      score: 0,
    };
  }

  // Sum all metrics and use the latest score
  const summary = metrics.reduce(
    (acc, metric) => ({
      views: acc.views + metric.views,
      copies: acc.copies + metric.copies,
      saves: acc.saves + metric.saves,
      forks: acc.forks + metric.forks,
      votes: acc.votes + metric.votes,
      score: Math.max(acc.score, metric.score), // Use latest/highest score
    }),
    {
      views: 0,
      copies: 0,
      saves: 0,
      forks: 0,
      votes: 0,
      score: 0,
    }
  );

  return summary;
}

/**
 * Fallback: compute metrics from raw Event data when daily rollups are not available
 * @param ruleId Rule ID
 * @param hours Number of hours to look back
 * @returns Quick metrics summary
 */
export async function sumRuleEventsFallback(
  ruleId: string,
  hours: number
): Promise<MetricsSummary> {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - hours);

  const events = await prisma.event.findMany({
    where: {
      ruleId,
      createdAt: {
        gte: cutoffTime,
      },
    },
    select: {
      type: true,
      ipHash: true,
      userId: true,
      createdAt: true,
    },
  });

  // Group events by type and apply anti-gaming logic
  const eventsByType = events.reduce((acc, event) => {
    if (!acc[event.type]) {
      acc[event.type] = [];
    }
    acc[event.type]!.push(event);
    return acc;
  }, {} as Record<string, typeof events>);

  // Calculate unique views (one per IP per day)
  const viewEvents = eventsByType["VIEW"] || [];
  const uniqueViewsByIpDay = new Map<string, number>();

  viewEvents.forEach((event) => {
    const day = event.createdAt.toISOString().split("T")[0];
    const key = `${event.ipHash}:${day}`;
    uniqueViewsByIpDay.set(key, (uniqueViewsByIpDay.get(key) || 0) + 1);
  });

  // Apply view caps and sum
  const views = Array.from(uniqueViewsByIpDay.values())
    .map((count) => capViewCount(count))
    .reduce((sum, count) => sum + count, 0);

  return {
    views,
    copies: (eventsByType["COPY"] || []).length,
    saves: (eventsByType["SAVE"] || []).length,
    forks: (eventsByType["FORK"] || []).length,
    votes: (eventsByType["VOTE"] || []).length,
    score: 0, // No score calculation for fallback
  };
}

/**
 * Get open metrics for a rule (7-day and 30-day windows)
 * @param ruleId Rule ID
 * @returns Object with 7d and 30d metrics
 */
export async function getRuleOpenMetrics(ruleId: string): Promise<{
  views7: number;
  copies7: number;
  saves7: number;
  forks7: number;
  votes7: number;
  views30: number;
  copies30: number;
  saves30: number;
  forks30: number;
  votes30: number;
  score: number;
}> {
  // Try to get metrics from daily rollups first
  const [metrics7d, metrics30d] = await Promise.all([
    sumRuleMetrics(ruleId, METRICS_WINDOW_RECENT_DAYS),
    sumRuleMetrics(ruleId, METRICS_WINDOW_LONG_DAYS),
  ]);

  // If no daily metrics available, fall back to recent events
  if (
    metrics7d.views === 0 &&
    metrics7d.copies === 0 &&
    metrics7d.saves === 0
  ) {
    const fallback = await sumRuleEventsFallback(ruleId, 48); // Last 48 hours
    return {
      views7: fallback.views,
      copies7: fallback.copies,
      saves7: fallback.saves,
      forks7: fallback.forks,
      votes7: fallback.votes,
      views30: fallback.views,
      copies30: fallback.copies,
      saves30: fallback.saves,
      forks30: fallback.forks,
      votes30: fallback.votes,
      score: fallback.score,
    };
  }

  return {
    views7: metrics7d.views,
    copies7: metrics7d.copies,
    saves7: metrics7d.saves,
    forks7: metrics7d.forks,
    votes7: metrics7d.votes,
    views30: metrics30d.views,
    copies30: metrics30d.copies,
    saves30: metrics30d.saves,
    forks30: metrics30d.forks,
    votes30: metrics30d.votes,
    score: Math.max(metrics7d.score, metrics30d.score),
  };
}

/**
 * Get trending rules based on recent scores
 * @param opts Options for trending query
 * @returns Array of trending rules
 */
export async function getTrendingRulesDb(opts: {
  sinceDays?: number;
  limit?: number;
  tagSlug?: string;
  model?: string;
}): Promise<TrendingRule[]> {
  const { sinceDays = 7, limit = 20, tagSlug, model } = opts;
  const dateRange = getMetricsDateRange(sinceDays);
  const startDate = dateRange[dateRange.length - 1];

  // Get rules with their latest scores from RuleMetricDaily
  const trendingData = await prisma.ruleMetricDaily.findMany({
    where: {
      date: {
        gte: startDate,
      },
      rule: {
        status: "PUBLISHED",
        deletedAt: null,
        ...(tagSlug && {
          tags: {
            some: {
              tag: {
                slug: tagSlug,
              },
            },
          },
        }),
        ...(model && {
          primaryModel: {
            equals: model,
            mode: "insensitive",
          },
        }),
      },
    },
    include: {
      rule: {
        select: {
          id: true,
          slug: true,
          title: true,
        },
      },
    },
    orderBy: [{ score: "desc" }, { date: "desc" }],
  });

  // Group by rule and take the best score for each
  const ruleScores = new Map<
    string,
    {
      rule: { id: string; slug: string; title: string };
      score: number;
      views: number;
      copies: number;
      saves: number;
      forks: number;
    }
  >();

  trendingData.forEach((metric) => {
    const existing = ruleScores.get(metric.ruleId);
    if (!existing || metric.score > existing.score) {
      ruleScores.set(metric.ruleId, {
        rule: metric.rule,
        score: metric.score,
        views: metric.views,
        copies: metric.copies,
        saves: metric.saves,
        forks: metric.forks,
      });
    }
  });

  // Convert to array and sort by score
  const trending = Array.from(ruleScores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => ({
      id: item.rule.id,
      slug: item.rule.slug,
      title: item.rule.title,
      score: item.score,
      views: item.views,
      copies: item.copies,
      saves: item.saves,
      forks: item.forks,
    }));

  return trending;
}

/**
 * Get rules that need metrics computation (have events but no recent daily metrics)
 * @param days Number of days to check
 * @returns Array of rule IDs that need rollup
 */
export async function getRulesNeedingRollup(
  days: number = 1
): Promise<string[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  cutoffDate.setUTCHours(0, 0, 0, 0);

  // Find rules with recent events but no recent daily metrics
  const rulesWithEvents = await prisma.event.findMany({
    where: {
      createdAt: {
        gte: cutoffDate,
      },
      ruleId: {
        not: null,
      },
    },
    select: {
      ruleId: true,
    },
    distinct: ["ruleId"],
  });

  const ruleIds = rulesWithEvents
    .map((e) => e.ruleId)
    .filter((id): id is string => id !== null);

  if (ruleIds.length === 0) {
    return [];
  }

  // Check which ones don't have recent daily metrics
  const existingMetrics = await prisma.ruleMetricDaily.findMany({
    where: {
      ruleId: {
        in: ruleIds,
      },
      date: {
        gte: cutoffDate,
      },
    },
    select: {
      ruleId: true,
    },
    distinct: ["ruleId"],
  });

  const rulesWithMetrics = new Set(existingMetrics.map((m) => m.ruleId));

  return ruleIds.filter((id) => !rulesWithMetrics.has(id));
}

/**
 * Update rule's current score based on latest daily metrics
 * @param ruleId Rule ID
 * @returns Updated score
 */
export async function updateRuleCurrentScore(ruleId: string): Promise<number> {
  const latestMetric = await prisma.ruleMetricDaily.findFirst({
    where: {
      ruleId,
    },
    orderBy: {
      date: "desc",
    },
    select: {
      score: true,
    },
  });

  const score = latestMetric?.score || 0;

  // Note: score field doesn't exist in schema, skipping update
  // await prisma.rule.update({
  //   where: { id: ruleId },
  //   data: { score },
  // });

  return score;
}
