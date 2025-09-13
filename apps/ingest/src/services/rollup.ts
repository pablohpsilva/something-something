import { prisma } from "../prisma";
import { logger } from "../logger";
import { getEnv } from "../env";
import type { LeaderboardPeriod, LeaderboardScope } from "../schemas/rollup";

export interface RollupResult {
  rulesUpdated: number;
  authorsUpdated: number;
  snapshots: {
    daily: number;
    weekly: number;
    monthly: number;
    all?: number;
  };
  tookMs: number;
  dryRun: boolean;
}

export async function performRollup(
  targetDate?: Date,
  dryRun = false,
  daysBack?: number
): Promise<RollupResult> {
  const startTime = Date.now();
  const env = getEnv();
  
  // Default to today UTC if no date provided
  const date = targetDate || new Date();
  date.setHours(0, 0, 0, 0);
  
  const rollupDays = daysBack || env.ROLLUP_DAYS_BACK;
  
  logger.info("Starting rollup", {
    date: date.toISOString(),
    daysBack: rollupDays,
    dryRun,
  });
  
  const result: RollupResult = {
    rulesUpdated: 0,
    authorsUpdated: 0,
    snapshots: {
      daily: 0,
      weekly: 0,
      monthly: 0,
    },
    tookMs: 0,
    dryRun,
  };
  
  if (!dryRun) {
    // Perform actual rollup in transaction
    await prisma.$transaction(async (tx) => {
      // Update rule metrics
      result.rulesUpdated = await updateRuleMetrics(tx, date, rollupDays);
      
      // Update author metrics  
      result.authorsUpdated = await updateAuthorMetrics(tx, date, rollupDays);
      
      // Update leaderboard snapshots
      result.snapshots.daily = await updateLeaderboardSnapshot(tx, "DAILY", date);
      result.snapshots.weekly = await updateLeaderboardSnapshot(tx, "WEEKLY", date);
      result.snapshots.monthly = await updateLeaderboardSnapshot(tx, "MONTHLY", date);
      
      // Update ALL snapshot occasionally (e.g., once per week)
      if (date.getDay() === 0) { // Sunday
        result.snapshots.all = await updateLeaderboardSnapshot(tx, "ALL", date);
      }
    });
  } else {
    // Dry run - just count what would be updated
    result.rulesUpdated = await countRulesForUpdate(date, rollupDays);
    result.authorsUpdated = await countAuthorsForUpdate(date, rollupDays);
    result.snapshots.daily = 1;
    result.snapshots.weekly = 1;
    result.snapshots.monthly = 1;
  }
  
  result.tookMs = Date.now() - startTime;
  
  logger.info("Rollup completed", result);
  
  return result;
}

async function updateRuleMetrics(
  tx: any,
  targetDate: Date,
  daysBack: number
): Promise<number> {
  const startDate = new Date(targetDate);
  startDate.setDate(startDate.getDate() - daysBack);
  
  // Get all rules that have events in the time window
  const rulesWithEvents = await tx.event.groupBy({
    by: ["ruleId"],
    where: {
      ruleId: { not: null },
      createdAt: {
        gte: startDate,
        lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
      },
    },
  });
  
  let updatedCount = 0;
  
  for (const { ruleId } of rulesWithEvents) {
    if (!ruleId) continue;
    
    // Calculate metrics for this rule
    const metrics = await calculateRuleMetrics(tx, ruleId, targetDate, daysBack);
    
    // Upsert rule metric daily record
    await tx.ruleMetricDaily.upsert({
      where: {
        date_ruleId: {
          date: targetDate,
          ruleId,
        },
      },
      update: metrics,
      create: {
        date: targetDate,
        ruleId,
        ...metrics,
      },
    });
    
    // Update rule's overall score
    await tx.rule.update({
      where: { id: ruleId },
      data: { score: metrics.score },
    });
    
    updatedCount++;
  }
  
  return updatedCount;
}

async function calculateRuleMetrics(
  tx: any,
  ruleId: string,
  targetDate: Date,
  daysBack: number
) {
  const env = getEnv();
  const lambda = env.TRENDING_DECAY_LAMBDA;
  
  // Calculate date range
  const endDate = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
  const startDate = new Date(targetDate);
  startDate.setDate(startDate.getDate() - daysBack);
  
  // Get events grouped by type and day
  const events = await tx.event.findMany({
    where: {
      ruleId,
      createdAt: { gte: startDate, lt: endDate },
    },
    select: {
      type: true,
      createdAt: true,
      ipHash: true,
      userId: true,
    },
  });
  
  // Group events by day and apply anti-gaming measures
  const dailyMetrics = new Map<string, {
    views: Set<string>;
    copies: number;
    saves: number;
    forks: number;
    votes: number;
  }>();
  
  for (const event of events) {
    const dayKey = event.createdAt.toISOString().split("T")[0];
    
    if (!dailyMetrics.has(dayKey)) {
      dailyMetrics.set(dayKey, {
        views: new Set(),
        copies: 0,
        saves: 0,
        forks: 0,
        votes: 0,
      });
    }
    
    const dayMetrics = dailyMetrics.get(dayKey)!;
    
    switch (event.type) {
      case "VIEW":
        // Dedupe views by IP hash (max 5 per IP per day)
        const viewKey = `${event.ipHash}:${event.userId || "anon"}`;
        if (dayMetrics.views.size < 5 || !dayMetrics.views.has(viewKey)) {
          dayMetrics.views.add(viewKey);
        }
        break;
      case "COPY":
        dayMetrics.copies++;
        break;
      case "SAVE":
        dayMetrics.saves++;
        break;
      case "FORK":
        dayMetrics.forks++;
        break;
      case "VOTE":
        dayMetrics.votes++;
        break;
    }
  }
  
  // Calculate totals with exponential decay
  let totalViews = 0;
  let totalCopies = 0;
  let totalSaves = 0;
  let totalForks = 0;
  let totalVotes = 0;
  
  for (const [dayKey, metrics] of dailyMetrics) {
    const dayDate = new Date(dayKey);
    const daysAgo = Math.floor((targetDate.getTime() - dayDate.getTime()) / (24 * 60 * 60 * 1000));
    const decayWeight = Math.exp(-lambda * daysAgo);
    
    totalViews += metrics.views.size * decayWeight;
    totalCopies += metrics.copies * decayWeight;
    totalSaves += metrics.saves * decayWeight;
    totalForks += metrics.forks * decayWeight;
    totalVotes += metrics.votes * decayWeight;
  }
  
  // Calculate trending score
  const score = Math.round(
    0.4 * totalViews +
    0.3 * totalCopies +
    0.2 * totalSaves +
    0.1 * totalVotes
  );
  
  return {
    views: Math.round(totalViews),
    copies: Math.round(totalCopies),
    saves: Math.round(totalSaves),
    forks: Math.round(totalForks),
    votes: Math.round(totalVotes),
    score,
  };
}

async function updateAuthorMetrics(
  tx: any,
  targetDate: Date,
  daysBack: number
): Promise<number> {
  const startDate = new Date(targetDate);
  startDate.setDate(startDate.getDate() - daysBack);
  
  // Get authors with activity
  const authorsWithActivity = await tx.rule.groupBy({
    by: ["createdByUserId"],
    where: {
      events: {
        some: {
          createdAt: {
            gte: startDate,
            lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      },
    },
  });
  
  let updatedCount = 0;
  
  for (const { createdByUserId } of authorsWithActivity) {
    if (!createdByUserId) continue;
    
    // Calculate author metrics
    const metrics = await calculateAuthorMetrics(tx, createdByUserId, targetDate, daysBack);
    
    // Upsert author metric daily record
    await tx.authorMetricDaily.upsert({
      where: {
        date_authorUserId: {
          date: targetDate,
          authorUserId: createdByUserId,
        },
      },
      update: metrics,
      create: {
        date: targetDate,
        authorUserId: createdByUserId,
        ...metrics,
      },
    });
    
    updatedCount++;
  }
  
  return updatedCount;
}

async function calculateAuthorMetrics(
  tx: any,
  authorUserId: string,
  targetDate: Date,
  daysBack: number
) {
  const endDate = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
  const startDate = new Date(targetDate);
  startDate.setDate(startDate.getDate() - daysBack);
  
  // Get aggregated metrics for author's rules
  const ruleMetrics = await tx.event.groupBy({
    by: ["type"],
    where: {
      rule: { createdByUserId: authorUserId },
      createdAt: { gte: startDate, lt: endDate },
    },
    _count: true,
  });
  
  // Get donation metrics
  const donations = await tx.donation.count({
    where: {
      toUserId: authorUserId,
      status: "SUCCEEDED",
      createdAt: { gte: startDate, lt: endDate },
    },
  });
  
  const donationsCents = await tx.donation.aggregate({
    where: {
      toUserId: authorUserId,
      status: "SUCCEEDED",
      createdAt: { gte: startDate, lt: endDate },
    },
    _sum: { amountCents: true },
  });
  
  const metricsByType = Object.fromEntries(
    ruleMetrics.map(m => [m.type, m._count])
  );
  
  return {
    views: metricsByType.VIEW || 0,
    copies: metricsByType.COPY || 0,
    saves: metricsByType.SAVE || 0,
    forks: metricsByType.FORK || 0,
    votes: metricsByType.VOTE || 0,
    score: (metricsByType.VIEW || 0) + (metricsByType.COPY || 0) * 2,
    donations,
    donationsCents: donationsCents._sum.amountCents || 0,
  };
}

async function updateLeaderboardSnapshot(
  tx: any,
  period: LeaderboardPeriod,
  targetDate: Date
): Promise<number> {
  // Calculate date range based on period
  let startDate: Date;
  
  switch (period) {
    case "DAILY":
      startDate = new Date(targetDate);
      break;
    case "WEEKLY":
      startDate = new Date(targetDate);
      startDate.setDate(startDate.getDate() - 7);
      break;
    case "MONTHLY":
      startDate = new Date(targetDate);
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case "ALL":
      startDate = new Date("2020-01-01"); // Far back date
      break;
  }
  
  // Get top rules for global leaderboard
  const topRules = await tx.ruleMetricDaily.groupBy({
    by: ["ruleId"],
    where: {
      date: { gte: startDate, lte: targetDate },
    },
    _sum: {
      score: true,
      views: true,
      copies: true,
    },
    orderBy: {
      _sum: { score: "desc" },
    },
    take: 100,
  });
  
  // Get rule details
  const ruleIds = topRules.map(r => r.ruleId);
  const rules = await tx.rule.findMany({
    where: { id: { in: ruleIds } },
    include: {
      createdBy: {
        select: {
          id: true,
          handle: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });
  
  const ruleMap = new Map(rules.map(r => [r.id, r]));
  
  // Build leaderboard data
  const leaderboardData = topRules
    .map((metric, index) => {
      const rule = ruleMap.get(metric.ruleId);
      if (!rule) return null;
      
      return {
        rank: index + 1,
        ruleId: rule.id,
        slug: rule.slug,
        title: rule.title,
        author: rule.createdBy,
        score: metric._sum.score || 0,
        views: metric._sum.views || 0,
        copies: metric._sum.copies || 0,
      };
    })
    .filter(Boolean);
  
  // Upsert leaderboard snapshot
  await tx.leaderboardSnapshot.upsert({
    where: {
      period_scope_scopeRef_date: {
        period,
        scope: "GLOBAL",
        scopeRef: "",
        date: targetDate,
      },
    },
    update: {
      data: leaderboardData,
    },
    create: {
      period,
      scope: "GLOBAL",
      scopeRef: "",
      date: targetDate,
      data: leaderboardData,
    },
  });
  
  return 1;
}

async function countRulesForUpdate(targetDate: Date, daysBack: number): Promise<number> {
  const startDate = new Date(targetDate);
  startDate.setDate(startDate.getDate() - daysBack);
  
  const count = await prisma.event.groupBy({
    by: ["ruleId"],
    where: {
      ruleId: { not: null },
      createdAt: {
        gte: startDate,
        lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
      },
    },
  });
  
  return count.length;
}

async function countAuthorsForUpdate(targetDate: Date, daysBack: number): Promise<number> {
  const startDate = new Date(targetDate);
  startDate.setDate(startDate.getDate() - daysBack);
  
  const count = await prisma.rule.groupBy({
    by: ["createdByUserId"],
    where: {
      events: {
        some: {
          createdAt: {
            gte: startDate,
            lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      },
    },
  });
  
  return count.length;
}
