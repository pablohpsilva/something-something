import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, publicProcedure } from "../trpc"
import { leaderboardGetInputSchema, leaderboardResponseSchema } from "../schemas/gamification"
import { GamificationService } from "../services/gamification"

// Shared function to get leaderboard data
async function getLeaderboardData(
  ctx: any,
  period: string,
  scope: string,
  scopeRef?: string,
  cursor?: string,
  limit?: number
) {
  // Find the latest snapshot for this configuration
  const latestSnapshot = await ctx.prisma.leaderboardSnapshot.findFirst({
    where: {
      period,
      scope,
      scopeRef: scopeRef || null,
    },
    orderBy: { createdAt: "desc" },
  })

  if (!latestSnapshot) {
    return {
      entries: [],
      nextCursor: undefined,
      hasMore: false,
      snapshotId: null,
      lastUpdated: null,
    }
  }

  // Get entries for this snapshot
  const whereClause: any = {
    snapshotId: latestSnapshot.id,
  }

  if (cursor) {
    whereClause.id = { lt: cursor }
  }

  const entries = await ctx.prisma.leaderboardEntry.findMany({
    where: whereClause,
    include: {
      rule: {
        select: {
          id: true,
          slug: true,
          title: true,
          author: {
            select: {
              id: true,
              handle: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
    orderBy: [{ rank: "asc" }, { id: "desc" }],
    take: (limit || 25) + 1,
  })

  const hasMore = entries.length > (limit || 25)
  const items = hasMore ? entries.slice(0, -1) : entries
  const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

  return {
    entries: items.map((entry: any) => ({
      id: entry.id,
      rank: entry.rank,
      score: entry.score,
      ruleId: entry.rule.id,
      ruleSlug: entry.rule.slug,
      title: entry.rule.title,
      author: {
        id: entry.rule.author.id,
        handle: entry.rule.author.handle,
        displayName: entry.rule.author.displayName,
        avatarUrl: entry.rule.author.avatarUrl,
      },
      rankDelta: entry.rankDelta,
      scoreDelta: entry.scoreDelta,
    })),
    nextCursor,
    hasMore,
    snapshotId: latestSnapshot.id,
    lastUpdated: latestSnapshot.createdAt,
  }
}

export const leaderboardRouter = router({
  /**
   * Get leaderboard with snapshots and rank deltas
   */
  get: publicProcedure
    .input(leaderboardGetInputSchema)
    .output(leaderboardResponseSchema)
    .query(async ({ input, ctx }) => {
      const { period, scope, scopeRef, cursor, limit } = input

      try {
        // Find the latest snapshot for this configuration
        const latestSnapshot = await ctx.prisma.leaderboardSnapshot.findFirst({
          where: {
            period,
            scope,
            scopeRef: scopeRef || null,
          },
          orderBy: { createdAt: "desc" },
        })

        if (!latestSnapshot) {
          // No snapshot exists, return empty results
          return {
            entries: [],
            meta: {
              period,
              scope,
              scopeRef: scopeRef || null,
              windowDays: GamificationService.getPeriodDays(period),
              generatedAt: new Date().toISOString(),
              totalEntries: 0,
            },
            pagination: {
              hasMore: false,
            },
          }
        }

        // Get previous snapshot for rank deltas
        const previousSnapshot = await GamificationService.getPreviousSnapshot(
          { prisma: ctx.prisma, now: new Date() },
          period,
          scope,
          scopeRef
        )

        // Parse entries from snapshot
        const snapshotData = latestSnapshot.rank as any
        let entries = snapshotData.entries || []

        // Add rank deltas if previous snapshot exists
        if (previousSnapshot) {
          const prevEntries = (previousSnapshot.rank as any).entries || []
          const prevRankMap = new Map(prevEntries.map((entry: any) => [entry.ruleId, entry.rank]))

          entries = entries.map((entry: any) => {
            const prevRank = prevRankMap.get(entry.ruleId)
            const rankDelta = prevRank ? (prevRank as number) - (entry.rank as number) : null
            return { ...entry, rankDelta }
          })
        }

        // Apply cursor-based pagination
        let startIndex = 0
        if (cursor) {
          const cursorIndex = entries.findIndex((entry: any) => entry.ruleId === cursor)
          if (cursorIndex >= 0) {
            startIndex = cursorIndex + 1
          }
        }

        const paginatedEntries = entries.slice(startIndex, startIndex + limit)
        const hasMore = startIndex + limit < entries.length
        const nextCursor = hasMore
          ? paginatedEntries[paginatedEntries.length - 1]?.ruleId
          : undefined

        return {
          entries: paginatedEntries,
          meta: {
            period,
            scope,
            scopeRef: scopeRef || null,
            windowDays: snapshotData.meta?.windowDays || GamificationService.getPeriodDays(period),
            generatedAt: snapshotData.meta?.generatedAt || latestSnapshot.createdAt.toISOString(),
            totalEntries: entries.length,
          },
          pagination: {
            hasMore,
            nextCursor,
          },
        }
      } catch (error) {
        console.error("Failed to get leaderboard:", error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load leaderboard",
        })
      }
    }),

  /**
   * Get available scopes for leaderboards
   */
  getScopes: publicProcedure
    .output(
      z.object({
        tags: z.array(
          z.object({
            slug: z.string(),
            name: z.string(),
            count: z.number(),
          })
        ),
        models: z.array(
          z.object({
            name: z.string(),
            count: z.number(),
          })
        ),
      })
    )
    .query(async ({ ctx }) => {
      // Get popular tags with rule counts
      const tags = await ctx.prisma.tag.findMany({
        include: {
          _count: {
            select: {
              rules: {
                where: {
                  rule: {
                    status: "PUBLISHED",
                  },
                },
              },
            },
          },
        },
        orderBy: {
          rules: {
            _count: "desc",
          },
        },
        take: 20, // Top 20 tags
      })

      // Get popular models with rule counts
      const modelCounts = await ctx.prisma.rule.groupBy({
        by: ["primaryModel"],
        where: {
          status: "PUBLISHED",
          primaryModel: { not: null },
        },
        _count: {
          _all: true,
        },
      })

      // Sort by count and take top 20
      const sortedModelCounts = modelCounts
        .sort((a, b) => b._count._all - a._count._all)
        .slice(0, 20)

      return {
        tags: tags
          .filter(tag => tag._count.rules > 0)
          .map(tag => ({
            slug: tag.slug,
            name: tag.name,
            count: tag._count.rules,
          })),
        models: sortedModelCounts.map(model => ({
          name: model.primaryModel!,
          count: model._count._all,
        })),
      }
    }),

  /**
   * Get rule's current rank in leaderboards
   */
  getRuleRank: publicProcedure
    .input(
      z.object({
        ruleId: z.string(),
        period: z.enum(["DAILY", "WEEKLY", "MONTHLY", "ALL"]).default("WEEKLY"),
      })
    )
    .output(
      z.object({
        rank: z.number().nullable(),
        totalEntries: z.number(),
        percentile: z.number().nullable(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { ruleId, period } = input

      const snapshot = await ctx.prisma.leaderboardSnapshot.findFirst({
        where: {
          period,
          scope: "GLOBAL",
          scopeRef: null,
        },
        orderBy: { createdAt: "desc" },
      })

      if (!snapshot) {
        return { rank: null, totalEntries: 0, percentile: null }
      }

      const snapshotData = snapshot.rank as any
      const entries = snapshotData.entries || []
      const ruleEntry = entries.find((entry: any) => entry.ruleId === ruleId)

      if (!ruleEntry) {
        return { rank: null, totalEntries: entries.length, percentile: null }
      }

      const percentile = ((entries.length - ruleEntry.rank + 1) / entries.length) * 100

      return {
        rank: ruleEntry.rank,
        totalEntries: entries.length,
        percentile: Math.round(percentile * 100) / 100,
      }
    }),

  /**
   * Legacy endpoints for backward compatibility
   */
  getTopRules: publicProcedure
    .input(
      z.object({
        period: z.enum(["daily", "weekly", "monthly", "all"]).default("weekly"),
        limit: z.number().int().min(1).max(100).default(25),
      })
    )
    .output(
      z.array(
        z.object({
          id: z.string(),
          slug: z.string(),
          title: z.string(),
          score: z.number(),
          author: z.object({
            handle: z.string(),
            displayName: z.string(),
          }),
        })
      )
    )
    .query(async ({ input, ctx }) => {
      const periodMap = {
        daily: "DAILY" as const,
        weekly: "WEEKLY" as const,
        monthly: "MONTHLY" as const,
        all: "ALL" as const,
      }

      const result = await getLeaderboardData(
        ctx,
        periodMap[input.period],
        "GLOBAL",
        undefined,
        undefined,
        input.limit
      )

      return result.entries.map((entry: any) => ({
        id: entry.ruleId,
        slug: entry.ruleSlug,
        title: entry.title,
        score: entry.score,
        author: {
          handle: entry.author.handle,
          displayName: entry.author.displayName,
        },
      }))
    }),

  getTopAuthors: publicProcedure
    .input(
      z.object({
        period: z.enum(["daily", "weekly", "monthly", "all"]).default("weekly"),
        limit: z.number().int().min(1).max(100).default(25),
      })
    )
    .output(
      z.array(
        z.object({
          id: z.string(),
          handle: z.string(),
          displayName: z.string(),
          score: z.number(),
          rulesCount: z.number(),
        })
      )
    )
    .query(async ({ input, ctx }) => {
      // Aggregate author scores from rule leaderboard
      const periodMap = {
        daily: "DAILY" as const,
        weekly: "WEEKLY" as const,
        monthly: "MONTHLY" as const,
        all: "ALL" as const,
      }

      const result = await getLeaderboardData(
        ctx,
        periodMap[input.period],
        "GLOBAL",
        undefined,
        undefined,
        1000 // Get more entries to aggregate by author
      )

      // Group by author and sum scores
      const authorMap = new Map<
        string,
        {
          id: string
          handle: string
          displayName: string
          totalScore: number
          rulesCount: number
        }
      >()

      result.entries.forEach((entry: any) => {
        const authorId = entry.author.id
        if (authorMap.has(authorId)) {
          const author = authorMap.get(authorId)!
          author.totalScore += entry.score
          author.rulesCount += 1
        } else {
          authorMap.set(authorId, {
            id: entry.author.id,
            handle: entry.author.handle,
            displayName: entry.author.displayName,
            totalScore: entry.score,
            rulesCount: 1,
          })
        }
      })

      // Sort by total score and return top authors
      const topAuthors = Array.from(authorMap.values())
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, input.limit)

      return topAuthors.map(author => ({
        id: author.id,
        handle: author.handle,
        displayName: author.displayName,
        score: author.totalScore,
        rulesCount: author.rulesCount,
      }))
    }),
})
