// Re-export everything from client
export * from "./client";
export * from "./generated";

// Re-export types
export type {
  User,
  UserRole,
  AuthorProfile,
  Rule,
  RuleVersion,
  RuleStatus,
  ContentType,
  Tag,
  RuleTag,
  ResourceLink,
  Comment,
  Vote,
  VoteVersion,
  Favorite,
  Follow,
  Watch,
  Notification,
  NotificationType,
  Event,
  EventType,
  RuleMetricDaily,
  AuthorMetricDaily,
  Badge,
  UserBadge,
  LeaderboardSnapshot,
  LeaderboardPeriod,
  LeaderboardScope,
  Claim,
  ClaimStatus,
  AuditLog,
  Donation,
  DonationStatus,
  PayoutAccount,
  PayoutStatus,
  Provider,
  Source,
  SourceType,
  CrawlItem,
  CrawlStatus,
  CrawlPolicy,
  RuleSearch,
} from "./generated";

import { prisma } from "./client";

/**
 * Execute a function within a database transaction
 */
export async function withTransaction<T>(
  fn: (tx: any) => Promise<T>
): Promise<T> {
  return prisma.$transaction(fn) as Promise<T>;
}

/**
 * Refresh the full-text search index for a specific rule
 */
export async function refreshRuleSearch(ruleId: string): Promise<void> {
  await prisma.$executeRaw`SELECT update_rule_tsv(${ruleId})`;
}

/**
 * Refresh the full-text search index for all rules
 */
export async function refreshAllRuleSearch(): Promise<void> {
  await prisma.$executeRaw`
    SELECT update_rule_tsv(id) FROM rules WHERE deletedAt IS NULL
  `;
}

/**
 * Search rules using full-text search with ranking
 */
export async function searchRules(
  query: string,
  options: {
    limit?: number;
    offset?: number;
    contentTypes?: string[];
    statuses?: string[];
  } = {}
) {
  const { limit = 20, offset = 0, contentTypes, statuses } = options;

  let whereClause = 'WHERE r."deletedAt" IS NULL';
  const params: any[] = [query];
  let paramIndex = 1;

  if (contentTypes && contentTypes.length > 0) {
    paramIndex++;
    whereClause += ` AND r."contentType" = ANY($${paramIndex})`;
    params.push(contentTypes);
  }

  if (statuses && statuses.length > 0) {
    paramIndex++;
    whereClause += ` AND r."status" = ANY($${paramIndex})`;
    params.push(statuses);
  }

  paramIndex++;
  const limitParam = paramIndex;
  params.push(limit);

  paramIndex++;
  const offsetParam = paramIndex;
  params.push(offset);

  const results = await prisma.$queryRaw<
    Array<{
      id: string;
      slug: string;
      title: string;
      summary: string | null;
      contentType: string;
      status: string;
      primaryModel: string | null;
      createdAt: Date;
      rank: number;
    }>
  >`
    SELECT 
      r.id,
      r.slug,
      r.title,
      r.summary,
      r."contentType",
      r.status,
      r."primaryModel",
      r."createdAt",
      ts_rank_cd(rs.tsv, plainto_tsquery('english', unaccent($1))) as rank
    FROM rules r
    INNER JOIN rule_search rs ON r.id = rs."ruleId"
    ${whereClause}
    AND rs.tsv @@ plainto_tsquery('english', unaccent($1))
    ORDER BY rank DESC, r."createdAt" DESC
    LIMIT $${limitParam} OFFSET $${offsetParam}
  `;

  return results;
}

/**
 * Get trending rules based on recent metrics
 */
export async function getTrendingRules(
  sinceDays: number = 7,
  limit: number = 20
) {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - sinceDays);

  const results = await prisma.$queryRaw<
    Array<{
      id: string;
      slug: string;
      title: string;
      summary: string | null;
      contentType: string;
      status: string;
      primaryModel: string | null;
      createdAt: Date;
      totalScore: number;
      totalViews: number;
      totalCopies: number;
      totalVotes: number;
    }>
  >`
    SELECT 
      r.id,
      r.slug,
      r.title,
      r.summary,
      r."contentType",
      r.status,
      r."primaryModel",
      r."createdAt",
      COALESCE(SUM(rmd.score), 0) as "totalScore",
      COALESCE(SUM(rmd.views), 0) as "totalViews",
      COALESCE(SUM(rmd.copies), 0) as "totalCopies",
      COALESCE(SUM(rmd.votes), 0) as "totalVotes"
    FROM rules r
    LEFT JOIN rule_metrics_daily rmd ON r.id = rmd."ruleId" 
      AND rmd.date >= ${sinceDate}::date
    WHERE r."deletedAt" IS NULL 
      AND r.status = 'PUBLISHED'
    GROUP BY r.id, r.slug, r.title, r.summary, r."contentType", r.status, r."primaryModel", r."createdAt"
    ORDER BY "totalScore" DESC, "totalViews" DESC
    LIMIT ${limit}
  `;

  return results;
}

/**
 * Get user activity summary
 */
export async function getUserActivitySummary(userId: string) {
  const [rulesCreated, commentsCount, votesCount, favoritesCount] =
    await Promise.all([
      prisma.rule.count({
        where: { createdByUserId: userId, deletedAt: null },
      }),
      prisma.comment.count({
        where: { authorUserId: userId, deletedAt: null },
      }),
      prisma.vote.count({
        where: { userId },
      }),
      prisma.favorite.count({
        where: { userId },
      }),
    ]);

  return {
    rulesCreated,
    commentsCount,
    votesCount,
    favoritesCount,
  };
}

/**
 * Get rule statistics
 */
export async function getRuleStats(ruleId: string) {
  const [rule, votesCount, favoritesCount, commentsCount, recentViews] =
    await Promise.all([
      prisma.rule.findUnique({
        where: { id: ruleId },
        include: {
          versions: {
            select: { id: true, version: true, createdAt: true },
            orderBy: { createdAt: "desc" },
          },
        },
      }),
      prisma.vote.aggregate({
        where: { ruleId },
        _sum: { value: true },
        _count: true,
      }),
      prisma.favorite.count({
        where: { ruleId },
      }),
      prisma.comment.count({
        where: { ruleId, deletedAt: null },
      }),
      prisma.event.count({
        where: {
          ruleId,
          type: "VIEW",
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      }),
    ]);

  return {
    rule,
    totalVotes: votesCount._sum.value || 0,
    voteCount: votesCount._count,
    favoritesCount,
    commentsCount,
    recentViews,
    versionsCount: rule?.versions.length || 0,
  };
}

/**
 * Create or update daily metrics for a rule
 */
export async function updateRuleMetrics(
  ruleId: string,
  date: Date,
  metrics: {
    views?: number;
    copies?: number;
    saves?: number;
    forks?: number;
    votes?: number;
    score?: number;
  }
) {
  const dateOnly = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

  await prisma.ruleMetricDaily.upsert({
    where: {
      date_ruleId: {
        date: dateOnly,
        ruleId,
      },
    },
    update: {
      views: { increment: metrics.views || 0 },
      copies: { increment: metrics.copies || 0 },
      saves: { increment: metrics.saves || 0 },
      forks: { increment: metrics.forks || 0 },
      votes: { increment: metrics.votes || 0 },
      score: { increment: metrics.score || 0 },
    },
    create: {
      date: dateOnly,
      ruleId,
      views: metrics.views || 0,
      copies: metrics.copies || 0,
      saves: metrics.saves || 0,
      forks: metrics.forks || 0,
      votes: metrics.votes || 0,
      score: metrics.score || 0,
    },
  });
}

// Metrics helpers
export {
  sumRuleMetrics,
  sumRuleEventsFallback,
  getRuleOpenMetrics,
  getTrendingRulesDb,
  getRulesNeedingRollup,
  updateRuleCurrentScore,
} from "./metrics";

export type { MetricsSummary, TrendingRule } from "./metrics";

// Search helpers
export * from "./search";

// Auth helpers
export { auth } from "./auth";
export type { Session, User as AuthUser } from "./auth";
