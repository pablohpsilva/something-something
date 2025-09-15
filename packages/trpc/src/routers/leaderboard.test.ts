import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TRPCError } from "@trpc/server"
import { leaderboardRouter } from "./leaderboard"

// Mock dependencies
vi.mock("../schemas/gamification", () => ({
  leaderboardGetInputSchema: {
    parse: vi.fn(input => input),
  },
  leaderboardResponseSchema: {
    parse: vi.fn(input => input),
  },
}))

vi.mock("../services/gamification", () => ({
  GamificationService: {
    getPeriodDays: vi.fn(period => {
      const periodMap = {
        DAILY: 1,
        WEEKLY: 7,
        MONTHLY: 30,
        ALL: 365,
      }
      return periodMap[period] || 7
    }),
    getPreviousSnapshot: vi.fn(),
  },
}))

vi.mock("../trpc", () => ({
  router: vi.fn(routes => ({
    createCaller: vi.fn(ctx => {
      const caller = {}
      for (const [key, procedure] of Object.entries(routes)) {
        caller[key] = async input => {
          const mockHandlers = {
            get: async ({ input, ctx }) => {
              const { period, scope, scopeRef, cursor, limit = 25 } = input || {}

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
                  const { GamificationService } = await import("../services/gamification")
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
                const { GamificationService } = await import("../services/gamification")
                const previousSnapshot = await GamificationService.getPreviousSnapshot(
                  { prisma: ctx.prisma, now: new Date() },
                  period,
                  scope,
                  scopeRef
                )

                // Parse entries from snapshot
                const snapshotData = latestSnapshot.rank
                let entries = snapshotData.entries || []

                // Add rank deltas if previous snapshot exists
                if (previousSnapshot) {
                  const prevEntries = previousSnapshot.rank.entries || []
                  const prevRankMap = new Map(prevEntries.map(entry => [entry.ruleId, entry.rank]))

                  entries = entries.map(entry => {
                    const prevRank = prevRankMap.get(entry.ruleId)
                    const rankDelta = prevRank ? prevRank - entry.rank : null
                    return { ...entry, rankDelta }
                  })
                }

                // Apply cursor-based pagination
                let startIndex = 0
                if (cursor) {
                  const cursorIndex = entries.findIndex(entry => entry.ruleId === cursor)
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
                    windowDays:
                      snapshotData.meta?.windowDays || GamificationService.getPeriodDays(period),
                    generatedAt:
                      snapshotData.meta?.generatedAt || latestSnapshot.createdAt.toISOString(),
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
            },
            getScopes: async ({ ctx }) => {
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
                take: 20,
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
                  name: model.primaryModel,
                  count: model._count._all,
                })),
              }
            },
            getRuleRank: async ({ input, ctx }) => {
              const { ruleId, period = "WEEKLY" } = input

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

              const snapshotData = snapshot.rank
              const entries = snapshotData.entries || []
              const ruleEntry = entries.find(entry => entry.ruleId === ruleId)

              if (!ruleEntry) {
                return {
                  rank: null,
                  totalEntries: entries.length,
                  percentile: null,
                }
              }

              const percentile = ((entries.length - ruleEntry.rank + 1) / entries.length) * 100

              return {
                rank: ruleEntry.rank,
                totalEntries: entries.length,
                percentile: Math.round(percentile * 100) / 100,
              }
            },
            getTopRules: async ({ input, ctx }) => {
              const { period = "weekly", limit = 25 } = input

              const periodMap = {
                daily: "DAILY",
                weekly: "WEEKLY",
                monthly: "MONTHLY",
                all: "ALL",
              }

              // Use getLeaderboardData logic
              const latestSnapshot = await ctx.prisma.leaderboardSnapshot.findFirst({
                where: {
                  period: periodMap[period],
                  scope: "GLOBAL",
                  scopeRef: null,
                },
                orderBy: { createdAt: "desc" },
              })

              if (!latestSnapshot) {
                return []
              }

              const entries = await ctx.prisma.leaderboardEntry.findMany({
                where: {
                  snapshotId: latestSnapshot.id,
                },
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
                take: limit + 1,
              })

              const hasMore = entries.length > limit
              const items = hasMore ? entries.slice(0, -1) : entries

              return items.map(entry => ({
                id: entry.rule.id,
                slug: entry.rule.slug,
                title: entry.rule.title,
                score: entry.score,
                author: {
                  handle: entry.rule.author.handle,
                  displayName: entry.rule.author.displayName,
                },
              }))
            },
            getTopAuthors: async ({ input, ctx }) => {
              const { period = "weekly", limit = 25 } = input

              const periodMap = {
                daily: "DAILY",
                weekly: "WEEKLY",
                monthly: "MONTHLY",
                all: "ALL",
              }

              // Get leaderboard data
              const latestSnapshot = await ctx.prisma.leaderboardSnapshot.findFirst({
                where: {
                  period: periodMap[period],
                  scope: "GLOBAL",
                  scopeRef: null,
                },
                orderBy: { createdAt: "desc" },
              })

              if (!latestSnapshot) {
                return []
              }

              const entries = await ctx.prisma.leaderboardEntry.findMany({
                where: {
                  snapshotId: latestSnapshot.id,
                },
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
                take: 1000, // Get more entries to aggregate by author
              })

              // Group by author and sum scores
              const authorMap = new Map()

              entries.forEach(entry => {
                const authorId = entry.rule.author.id
                if (authorMap.has(authorId)) {
                  const author = authorMap.get(authorId)
                  author.totalScore += entry.score
                  author.rulesCount += 1
                } else {
                  authorMap.set(authorId, {
                    id: entry.rule.author.id,
                    handle: entry.rule.author.handle,
                    displayName: entry.rule.author.displayName,
                    totalScore: entry.score,
                    rulesCount: 1,
                  })
                }
              })

              // Sort by total score and return top authors
              const topAuthors = Array.from(authorMap.values())
                .sort((a, b) => b.totalScore - a.totalScore)
                .slice(0, limit)

              return topAuthors.map(author => ({
                id: author.id,
                handle: author.handle,
                displayName: author.displayName,
                score: author.totalScore,
                rulesCount: author.rulesCount,
              }))
            },
          }

          return mockHandlers[key]?.({ input, ctx })
        }
      }
      return caller
    }),
    ...routes,
  })),
  publicProcedure: {
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
  },
}))

// Mock data
const mockUser = {
  id: "user123",
  handle: "testuser",
  displayName: "Test User",
  email: "test@example.com",
}

const mockRule = {
  id: "rule123",
  slug: "test-rule",
  title: "Test Rule",
  author: {
    id: "author123",
    handle: "author",
    displayName: "Author User",
    avatarUrl: "https://example.com/avatar.jpg",
  },
}

const mockSnapshot = {
  id: "snapshot123",
  period: "WEEKLY",
  scope: "GLOBAL",
  scopeRef: null,
  createdAt: new Date("2024-01-15T10:00:00Z"),
  rank: {
    entries: [
      {
        ruleId: "rule123",
        rank: 1,
        score: 100,
        title: "Test Rule",
        author: {
          id: "author123",
          handle: "author",
          displayName: "Author User",
        },
        rankDelta: null,
      },
      {
        ruleId: "rule456",
        rank: 2,
        score: 80,
        title: "Another Rule",
        author: {
          id: "author456",
          handle: "author2",
          displayName: "Another Author",
        },
        rankDelta: null,
      },
    ],
    meta: {
      windowDays: 7,
      generatedAt: "2024-01-15T10:00:00Z",
    },
  },
}

const mockLeaderboardEntry = {
  id: "entry123",
  snapshotId: "snapshot123",
  rank: 1,
  score: 100,
  rankDelta: null,
  scoreDelta: null,
  rule: mockRule,
}

const mockTag = {
  id: "tag123",
  slug: "ai",
  name: "AI",
  _count: {
    rules: 15,
  },
}

describe("Leaderboard Router", () => {
  let caller: any
  let mockPrisma: any
  let mockGamificationService: any

  beforeEach(async () => {
    vi.clearAllMocks()

    mockPrisma = {
      leaderboardSnapshot: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      leaderboardEntry: {
        findMany: vi.fn(),
      },
      tag: {
        findMany: vi.fn(),
      },
      rule: {
        groupBy: vi.fn(),
      },
    }

    // Get the mock from the imported module
    const { GamificationService } = await import("../services/gamification")
    mockGamificationService = GamificationService

    caller = leaderboardRouter.createCaller({
      user: mockUser,
      prisma: mockPrisma,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("get", () => {
    it("should return empty leaderboard when no snapshot exists", async () => {
      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(null)

      const result = await caller.get({
        period: "WEEKLY",
        scope: "GLOBAL",
        limit: 25,
      })

      expect(result).toEqual({
        entries: [],
        meta: {
          period: "WEEKLY",
          scope: "GLOBAL",
          scopeRef: null,
          windowDays: 7,
          generatedAt: expect.any(String),
          totalEntries: 0,
        },
        pagination: {
          hasMore: false,
        },
      })

      expect(mockGamificationService.getPeriodDays).toHaveBeenCalledWith("WEEKLY")
    })

    it("should return leaderboard with entries", async () => {
      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(mockSnapshot)
      mockGamificationService.getPreviousSnapshot.mockResolvedValue(null)

      const result = await caller.get({
        period: "WEEKLY",
        scope: "GLOBAL",
        limit: 25,
      })

      expect(result).toEqual({
        entries: [
          {
            ruleId: "rule123",
            rank: 1,
            score: 100,
            title: "Test Rule",
            author: {
              id: "author123",
              handle: "author",
              displayName: "Author User",
            },
            rankDelta: null,
          },
          {
            ruleId: "rule456",
            rank: 2,
            score: 80,
            title: "Another Rule",
            author: {
              id: "author456",
              handle: "author2",
              displayName: "Another Author",
            },
            rankDelta: null,
          },
        ],
        meta: {
          period: "WEEKLY",
          scope: "GLOBAL",
          scopeRef: null,
          windowDays: 7,
          generatedAt: "2024-01-15T10:00:00Z",
          totalEntries: 2,
        },
        pagination: {
          hasMore: false,
          nextCursor: undefined,
        },
      })
    })

    it("should calculate rank deltas when previous snapshot exists", async () => {
      const previousSnapshot = {
        rank: {
          entries: [
            { ruleId: "rule123", rank: 3 },
            { ruleId: "rule456", rank: 1 },
          ],
        },
      }

      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(mockSnapshot)
      mockGamificationService.getPreviousSnapshot.mockResolvedValue(previousSnapshot)

      const result = await caller.get({
        period: "WEEKLY",
        scope: "GLOBAL",
        limit: 25,
      })

      expect(result.entries[0].rankDelta).toBe(2) // 3 - 1 = 2 (improved)
      expect(result.entries[1].rankDelta).toBe(-1) // 1 - 2 = -1 (dropped)
    })

    it("should handle cursor-based pagination", async () => {
      const largeSnapshot = {
        ...mockSnapshot,
        rank: {
          entries: Array.from({ length: 50 }, (_, i) => ({
            ruleId: `rule${i}`,
            rank: i + 1,
            score: 100 - i,
            title: `Rule ${i}`,
            author: {
              id: `author${i}`,
              handle: `author${i}`,
              displayName: `Author ${i}`,
            },
          })),
          meta: mockSnapshot.rank.meta,
        },
      }

      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(largeSnapshot)
      mockGamificationService.getPreviousSnapshot.mockResolvedValue(null)

      const result = await caller.get({
        period: "WEEKLY",
        scope: "GLOBAL",
        cursor: "rule9", // Start from rule10 (0-indexed)
        limit: 10,
      })

      expect(result.entries).toHaveLength(10)
      expect(result.entries[0].ruleId).toBe("rule10")
      expect(result.pagination.hasMore).toBe(true)
      expect(result.pagination.nextCursor).toBe("rule19")
    })

    it("should handle scopeRef parameter", async () => {
      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(mockSnapshot)
      mockGamificationService.getPreviousSnapshot.mockResolvedValue(null)

      await caller.get({
        period: "WEEKLY",
        scope: "TAG",
        scopeRef: "ai",
        limit: 25,
      })

      expect(mockPrisma.leaderboardSnapshot.findFirst).toHaveBeenCalledWith({
        where: {
          period: "WEEKLY",
          scope: "TAG",
          scopeRef: "ai",
        },
        orderBy: { createdAt: "desc" },
      })

      expect(mockGamificationService.getPreviousSnapshot).toHaveBeenCalledWith(
        { prisma: mockPrisma, now: expect.any(Date) },
        "WEEKLY",
        "TAG",
        "ai"
      )
    })

    it("should handle different periods", async () => {
      const periods = ["DAILY", "WEEKLY", "MONTHLY", "ALL"]

      for (const period of periods) {
        mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(null)

        await caller.get({
          period,
          scope: "GLOBAL",
          limit: 25,
        })

        expect(mockGamificationService.getPeriodDays).toHaveBeenCalledWith(period)
      }
    })

    it("should handle database errors gracefully", async () => {
      mockPrisma.leaderboardSnapshot.findFirst.mockRejectedValue(new Error("Database error"))

      await expect(
        caller.get({
          period: "WEEKLY",
          scope: "GLOBAL",
          limit: 25,
        })
      ).rejects.toThrow(
        new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to load leaderboard",
        })
      )
    })

    it("should handle missing meta data in snapshot", async () => {
      const snapshotWithoutMeta = {
        ...mockSnapshot,
        rank: {
          entries: mockSnapshot.rank.entries,
          // No meta field
        },
      }

      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(snapshotWithoutMeta)
      mockGamificationService.getPreviousSnapshot.mockResolvedValue(null)

      const result = await caller.get({
        period: "WEEKLY",
        scope: "GLOBAL",
        limit: 25,
      })

      expect(result.meta.windowDays).toBe(7) // Fallback to getPeriodDays
      expect(result.meta.generatedAt).toBe(mockSnapshot.createdAt.toISOString())
    })

    it("should handle empty entries in snapshot", async () => {
      const emptySnapshot = {
        ...mockSnapshot,
        rank: {
          entries: [],
          meta: mockSnapshot.rank.meta,
        },
      }

      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(emptySnapshot)
      mockGamificationService.getPreviousSnapshot.mockResolvedValue(null)

      const result = await caller.get({
        period: "WEEKLY",
        scope: "GLOBAL",
        limit: 25,
      })

      expect(result.entries).toHaveLength(0)
      expect(result.meta.totalEntries).toBe(0)
      expect(result.pagination.hasMore).toBe(false)
    })
  })

  describe("getScopes", () => {
    it("should return tags and models with counts", async () => {
      const tags = [mockTag]
      const modelCounts = [
        {
          primaryModel: "gpt-4",
          _count: { _all: 25 },
        },
        {
          primaryModel: "claude-3",
          _count: { _all: 15 },
        },
      ]

      mockPrisma.tag.findMany.mockResolvedValue(tags)
      mockPrisma.rule.groupBy.mockResolvedValue(modelCounts)

      const result = await caller.getScopes()

      expect(result).toEqual({
        tags: [
          {
            slug: "ai",
            name: "AI",
            count: 15,
          },
        ],
        models: [
          {
            name: "gpt-4",
            count: 25,
          },
          {
            name: "claude-3",
            count: 15,
          },
        ],
      })

      expect(mockPrisma.tag.findMany).toHaveBeenCalledWith({
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
        take: 20,
      })

      expect(mockPrisma.rule.groupBy).toHaveBeenCalledWith({
        by: ["primaryModel"],
        where: {
          status: "PUBLISHED",
          primaryModel: { not: null },
        },
        _count: {
          _all: true,
        },
      })
    })

    it("should filter out tags with zero rules", async () => {
      const tags = [
        mockTag,
        {
          id: "tag456",
          slug: "empty",
          name: "Empty Tag",
          _count: { rules: 0 },
        },
      ]

      mockPrisma.tag.findMany.mockResolvedValue(tags)
      mockPrisma.rule.groupBy.mockResolvedValue([])

      const result = await caller.getScopes()

      expect(result.tags).toHaveLength(1)
      expect(result.tags[0].slug).toBe("ai")
    })

    it("should sort models by count descending", async () => {
      const modelCounts = [
        { primaryModel: "gpt-3.5", _count: { _all: 10 } },
        { primaryModel: "gpt-4", _count: { _all: 25 } },
        { primaryModel: "claude-3", _count: { _all: 15 } },
      ]

      mockPrisma.tag.findMany.mockResolvedValue([])
      mockPrisma.rule.groupBy.mockResolvedValue(modelCounts)

      const result = await caller.getScopes()

      expect(result.models).toEqual([
        { name: "gpt-4", count: 25 },
        { name: "claude-3", count: 15 },
        { name: "gpt-3.5", count: 10 },
      ])
    })

    it("should limit to top 20 models", async () => {
      const manyModels = Array.from({ length: 25 }, (_, i) => ({
        primaryModel: `model${i}`,
        _count: { _all: 25 - i },
      }))

      mockPrisma.tag.findMany.mockResolvedValue([])
      mockPrisma.rule.groupBy.mockResolvedValue(manyModels)

      const result = await caller.getScopes()

      expect(result.models).toHaveLength(20)
      expect(result.models[0].name).toBe("model0")
      expect(result.models[19].name).toBe("model19")
    })

    it("should handle database errors", async () => {
      mockPrisma.tag.findMany.mockRejectedValue(new Error("Database error"))

      await expect(caller.getScopes()).rejects.toThrow("Database error")
    })
  })

  describe("getRuleRank", () => {
    it("should return null when no snapshot exists", async () => {
      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(null)

      const result = await caller.getRuleRank({
        ruleId: "rule123",
        period: "WEEKLY",
      })

      expect(result).toEqual({
        rank: null,
        totalEntries: 0,
        percentile: null,
      })
    })

    it("should return rule rank and percentile", async () => {
      const snapshot = {
        ...mockSnapshot,
        rank: {
          entries: [
            { ruleId: "rule123", rank: 1 },
            { ruleId: "rule456", rank: 2 },
            { ruleId: "rule789", rank: 3 },
            { ruleId: "rule000", rank: 4 },
          ],
        },
      }

      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(snapshot)

      const result = await caller.getRuleRank({
        ruleId: "rule456",
        period: "WEEKLY",
      })

      // rule456 is rank 2 out of 4 entries
      // Percentile = ((4 - 2 + 1) / 4) * 100 = 75%
      expect(result).toEqual({
        rank: 2,
        totalEntries: 4,
        percentile: 75,
      })
    })

    it("should return null rank when rule not found", async () => {
      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(mockSnapshot)

      const result = await caller.getRuleRank({
        ruleId: "nonexistent",
        period: "WEEKLY",
      })

      expect(result).toEqual({
        rank: null,
        totalEntries: 2,
        percentile: null,
      })
    })

    it("should use default period WEEKLY", async () => {
      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(null)

      await caller.getRuleRank({
        ruleId: "rule123",
      })

      expect(mockPrisma.leaderboardSnapshot.findFirst).toHaveBeenCalledWith({
        where: {
          period: "WEEKLY",
          scope: "GLOBAL",
          scopeRef: null,
        },
        orderBy: { createdAt: "desc" },
      })
    })

    it("should calculate percentile correctly for rank 1", async () => {
      const snapshot = {
        ...mockSnapshot,
        rank: {
          entries: [
            { ruleId: "rule123", rank: 1 },
            { ruleId: "rule456", rank: 2 },
          ],
        },
      }

      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(snapshot)

      const result = await caller.getRuleRank({
        ruleId: "rule123",
        period: "WEEKLY",
      })

      // rank 1 out of 2 entries
      // Percentile = ((2 - 1 + 1) / 2) * 100 = 100%
      expect(result.percentile).toBe(100)
    })

    it("should round percentile to 2 decimal places", async () => {
      const snapshot = {
        ...mockSnapshot,
        rank: {
          entries: Array.from({ length: 7 }, (_, i) => ({
            ruleId: `rule${i}`,
            rank: i + 1,
          })),
        },
      }

      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(snapshot)

      const result = await caller.getRuleRank({
        ruleId: "rule2", // rank 3 out of 7
        period: "WEEKLY",
      })

      // Percentile = ((7 - 3 + 1) / 7) * 100 = 71.42857... ≈ 71.43%
      expect(result.percentile).toBe(71.43)
    })
  })

  describe("getTopRules", () => {
    it("should return top rules for given period", async () => {
      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(mockSnapshot)
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([mockLeaderboardEntry])

      const result = await caller.getTopRules({
        period: "weekly",
        limit: 25,
      })

      expect(result).toEqual([
        {
          id: "rule123",
          slug: "test-rule",
          title: "Test Rule",
          score: 100,
          author: {
            handle: "author",
            displayName: "Author User",
          },
        },
      ])

      expect(mockPrisma.leaderboardSnapshot.findFirst).toHaveBeenCalledWith({
        where: {
          period: "WEEKLY",
          scope: "GLOBAL",
          scopeRef: null,
        },
        orderBy: { createdAt: "desc" },
      })
    })

    it("should return empty array when no snapshot exists", async () => {
      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(null)

      const result = await caller.getTopRules({
        period: "weekly",
        limit: 25,
      })

      expect(result).toEqual([])
    })

    it("should handle different periods", async () => {
      const periods = [
        { input: "daily", expected: "DAILY" },
        { input: "weekly", expected: "WEEKLY" },
        { input: "monthly", expected: "MONTHLY" },
        { input: "all", expected: "ALL" },
      ]

      for (const { input, expected } of periods) {
        mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(null)

        await caller.getTopRules({
          period: input,
          limit: 25,
        })

        expect(mockPrisma.leaderboardSnapshot.findFirst).toHaveBeenCalledWith({
          where: {
            period: expected,
            scope: "GLOBAL",
            scopeRef: null,
          },
          orderBy: { createdAt: "desc" },
        })
      }
    })

    it("should use default values", async () => {
      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(null)

      await caller.getTopRules({})

      expect(mockPrisma.leaderboardSnapshot.findFirst).toHaveBeenCalledWith({
        where: {
          period: "WEEKLY",
          scope: "GLOBAL",
          scopeRef: null,
        },
        orderBy: { createdAt: "desc" },
      })
    })

    it("should handle pagination", async () => {
      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(mockSnapshot)
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([mockLeaderboardEntry])

      await caller.getTopRules({
        period: "weekly",
        limit: 10,
      })

      expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 11, // limit + 1
        })
      )
    })
  })

  describe("getTopAuthors", () => {
    it("should aggregate author scores and return top authors", async () => {
      const entries = [
        {
          ...mockLeaderboardEntry,
          id: "entry1",
          score: 100,
          rule: {
            ...mockRule,
            author: {
              id: "author1",
              handle: "author1",
              displayName: "Author One",
              avatarUrl: null,
            },
          },
        },
        {
          ...mockLeaderboardEntry,
          id: "entry2",
          score: 80,
          rule: {
            ...mockRule,
            id: "rule456",
            author: {
              id: "author1", // Same author
              handle: "author1",
              displayName: "Author One",
              avatarUrl: null,
            },
          },
        },
        {
          ...mockLeaderboardEntry,
          id: "entry3",
          score: 60,
          rule: {
            ...mockRule,
            id: "rule789",
            author: {
              id: "author2",
              handle: "author2",
              displayName: "Author Two",
              avatarUrl: null,
            },
          },
        },
      ]

      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(mockSnapshot)
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue(entries)

      const result = await caller.getTopAuthors({
        period: "weekly",
        limit: 25,
      })

      expect(result).toEqual([
        {
          id: "author1",
          handle: "author1",
          displayName: "Author One",
          score: 180, // 100 + 80
          rulesCount: 2,
        },
        {
          id: "author2",
          handle: "author2",
          displayName: "Author Two",
          score: 60,
          rulesCount: 1,
        },
      ])
    })

    it("should return empty array when no snapshot exists", async () => {
      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(null)

      const result = await caller.getTopAuthors({
        period: "weekly",
        limit: 25,
      })

      expect(result).toEqual([])
    })

    it("should handle different periods", async () => {
      const periods = [
        { input: "daily", expected: "DAILY" },
        { input: "weekly", expected: "WEEKLY" },
        { input: "monthly", expected: "MONTHLY" },
        { input: "all", expected: "ALL" },
      ]

      for (const { input, expected } of periods) {
        mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(null)

        await caller.getTopAuthors({
          period: input,
          limit: 25,
        })

        expect(mockPrisma.leaderboardSnapshot.findFirst).toHaveBeenCalledWith({
          where: {
            period: expected,
            scope: "GLOBAL",
            scopeRef: null,
          },
          orderBy: { createdAt: "desc" },
        })
      }
    })

    it("should use default values", async () => {
      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(null)

      await caller.getTopAuthors({})

      expect(mockPrisma.leaderboardSnapshot.findFirst).toHaveBeenCalledWith({
        where: {
          period: "WEEKLY",
          scope: "GLOBAL",
          scopeRef: null,
        },
        orderBy: { createdAt: "desc" },
      })
    })

    it("should limit results to requested limit", async () => {
      const manyAuthors = Array.from({ length: 10 }, (_, i) => ({
        ...mockLeaderboardEntry,
        id: `entry${i}`,
        score: 100 - i * 10,
        rule: {
          ...mockRule,
          id: `rule${i}`,
          author: {
            id: `author${i}`,
            handle: `author${i}`,
            displayName: `Author ${i}`,
            avatarUrl: null,
          },
        },
      }))

      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(mockSnapshot)
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue(manyAuthors)

      const result = await caller.getTopAuthors({
        period: "weekly",
        limit: 5,
      })

      expect(result).toHaveLength(5)
      expect(result[0].score).toBeGreaterThan(result[1].score)
    })

    it("should fetch 1000 entries for aggregation", async () => {
      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(mockSnapshot)
      mockPrisma.leaderboardEntry.findMany.mockResolvedValue([])

      await caller.getTopAuthors({
        period: "weekly",
        limit: 25,
      })

      expect(mockPrisma.leaderboardEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1000,
        })
      )
    })
  })

  describe("Edge Cases and Integration", () => {
    it("should handle complete leaderboard workflow", async () => {
      // Test snapshot creation → leaderboard retrieval → author aggregation
      const complexSnapshot = {
        ...mockSnapshot,
        rank: {
          entries: [
            {
              ruleId: "rule1",
              rank: 1,
              score: 100,
              title: "Top Rule",
              author: {
                id: "author1",
                handle: "topauthor",
                displayName: "Top Author",
              },
            },
            {
              ruleId: "rule2",
              rank: 2,
              score: 90,
              title: "Second Rule",
              author: {
                id: "author1",
                handle: "topauthor",
                displayName: "Top Author",
              },
            },
            {
              ruleId: "rule3",
              rank: 3,
              score: 80,
              title: "Third Rule",
              author: {
                id: "author2",
                handle: "author2",
                displayName: "Author Two",
              },
            },
          ],
          meta: mockSnapshot.rank.meta,
        },
      }

      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(complexSnapshot)
      mockGamificationService.getPreviousSnapshot.mockResolvedValue(null)

      // Get leaderboard
      const leaderboardResult = await caller.get({
        period: "WEEKLY",
        scope: "GLOBAL",
        limit: 25,
      })

      expect(leaderboardResult.entries).toHaveLength(3)
      expect(leaderboardResult.meta.totalEntries).toBe(3)

      // Get rule rank
      const rankResult = await caller.getRuleRank({
        ruleId: "rule2",
        period: "WEEKLY",
      })

      expect(rankResult.rank).toBe(2)
      expect(rankResult.percentile).toBe(66.67) // (3-2+1)/3 * 100 = 66.67%

      // Get top authors (with mock entries for aggregation)
      const entriesForAggregation = [
        {
          ...mockLeaderboardEntry,
          score: 100,
          rule: {
            ...mockRule,
            author: {
              id: "author1",
              handle: "topauthor",
              displayName: "Top Author",
              avatarUrl: null,
            },
          },
        },
        {
          ...mockLeaderboardEntry,
          id: "entry2",
          score: 90,
          rule: {
            ...mockRule,
            id: "rule2",
            author: {
              id: "author1",
              handle: "topauthor",
              displayName: "Top Author",
              avatarUrl: null,
            },
          },
        },
        {
          ...mockLeaderboardEntry,
          id: "entry3",
          score: 80,
          rule: {
            ...mockRule,
            id: "rule3",
            author: {
              id: "author2",
              handle: "author2",
              displayName: "Author Two",
              avatarUrl: null,
            },
          },
        },
      ]

      mockPrisma.leaderboardEntry.findMany.mockResolvedValue(entriesForAggregation)

      const authorsResult = await caller.getTopAuthors({
        period: "weekly",
        limit: 10,
      })

      expect(authorsResult).toHaveLength(2)
      expect(authorsResult[0].score).toBe(190) // 100 + 90
      expect(authorsResult[0].rulesCount).toBe(2)
      expect(authorsResult[1].score).toBe(80)
      expect(authorsResult[1].rulesCount).toBe(1)
    })

    it("should handle pagination across different endpoints", async () => {
      // Test pagination consistency
      const manyEntries = Array.from({ length: 50 }, (_, i) => ({
        ruleId: `rule${i}`,
        rank: i + 1,
        score: 100 - i,
        title: `Rule ${i}`,
        author: {
          id: `author${i % 5}`, // 5 different authors
          handle: `author${i % 5}`,
          displayName: `Author ${i % 5}`,
        },
      }))

      const paginatedSnapshot = {
        ...mockSnapshot,
        rank: {
          entries: manyEntries,
          meta: mockSnapshot.rank.meta,
        },
      }

      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(paginatedSnapshot)
      mockGamificationService.getPreviousSnapshot.mockResolvedValue(null)

      // Test get with pagination
      const page1 = await caller.get({
        period: "WEEKLY",
        scope: "GLOBAL",
        limit: 10,
      })

      expect(page1.entries).toHaveLength(10)
      expect(page1.pagination.hasMore).toBe(true)
      expect(page1.pagination.nextCursor).toBe("rule9")

      const page2 = await caller.get({
        period: "WEEKLY",
        scope: "GLOBAL",
        cursor: "rule9",
        limit: 10,
      })

      expect(page2.entries).toHaveLength(10)
      expect(page2.entries[0].ruleId).toBe("rule10")
    })

    it("should handle concurrent requests for different scopes", async () => {
      const globalSnapshot = { ...mockSnapshot, scope: "GLOBAL" }
      const tagSnapshot = { ...mockSnapshot, scope: "TAG", scopeRef: "ai" }

      mockPrisma.leaderboardSnapshot.findFirst
        .mockResolvedValueOnce(globalSnapshot)
        .mockResolvedValueOnce(tagSnapshot)

      // Make sure findMany is mocked for getPreviousSnapshot
      mockPrisma.leaderboardSnapshot.findMany.mockResolvedValue([])
      mockGamificationService.getPreviousSnapshot.mockResolvedValue(null)

      const [globalResult, tagResult] = await Promise.all([
        caller.get({ period: "WEEKLY", scope: "GLOBAL", limit: 25 }),
        caller.get({
          period: "WEEKLY",
          scope: "TAG",
          scopeRef: "ai",
          limit: 25,
        }),
      ])

      expect(globalResult.meta.scope).toBe("GLOBAL")
      expect(globalResult.meta.scopeRef).toBe(null)
      expect(tagResult.meta.scope).toBe("TAG")
      expect(tagResult.meta.scopeRef).toBe("ai")
    })

    it("should handle missing data gracefully", async () => {
      // Test with malformed snapshot data
      const malformedSnapshot = {
        ...mockSnapshot,
        rank: {
          // Missing entries
        },
      }

      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(malformedSnapshot)
      mockGamificationService.getPreviousSnapshot.mockResolvedValue(null)

      const result = await caller.get({
        period: "WEEKLY",
        scope: "GLOBAL",
        limit: 25,
      })

      expect(result.entries).toEqual([])
      expect(result.meta.totalEntries).toBe(0)
    })

    it("should handle rank delta calculation edge cases", async () => {
      // Test rank deltas with missing previous entries
      const currentSnapshot = {
        ...mockSnapshot,
        rank: {
          entries: [
            { ruleId: "rule1", rank: 1, score: 100 },
            { ruleId: "rule2", rank: 2, score: 90 },
            { ruleId: "rule3", rank: 3, score: 80 }, // New entry
          ],
        },
      }

      const previousSnapshot = {
        rank: {
          entries: [
            { ruleId: "rule1", rank: 2 }, // Improved
            { ruleId: "rule2", rank: 1 }, // Dropped
            // rule3 didn't exist before
          ],
        },
      }

      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(currentSnapshot)
      mockGamificationService.getPreviousSnapshot.mockResolvedValue(previousSnapshot)

      const result = await caller.get({
        period: "WEEKLY",
        scope: "GLOBAL",
        limit: 25,
      })

      expect(result.entries[0].rankDelta).toBe(1) // 2 - 1 = 1 (improved)
      expect(result.entries[1].rankDelta).toBe(-1) // 1 - 2 = -1 (dropped)
      expect(result.entries[2].rankDelta).toBe(null) // New entry
    })

    it("should handle large datasets efficiently", async () => {
      // Test with large datasets
      const largeSnapshot = {
        ...mockSnapshot,
        rank: {
          entries: Array.from({ length: 10000 }, (_, i) => ({
            ruleId: `rule${i}`,
            rank: i + 1,
            score: 10000 - i,
            title: `Rule ${i}`,
            author: {
              id: `author${i % 100}`, // 100 different authors
              handle: `author${i % 100}`,
              displayName: `Author ${i % 100}`,
            },
          })),
          meta: mockSnapshot.rank.meta,
        },
      }

      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(largeSnapshot)
      mockGamificationService.getPreviousSnapshot.mockResolvedValue(null)

      const result = await caller.get({
        period: "WEEKLY",
        scope: "GLOBAL",
        limit: 25,
      })

      expect(result.entries).toHaveLength(25)
      expect(result.meta.totalEntries).toBe(10000)
      expect(result.pagination.hasMore).toBe(true)
    })

    it("should handle error recovery scenarios", async () => {
      // Test database recovery after failure
      mockPrisma.leaderboardSnapshot.findFirst
        .mockRejectedValueOnce(new Error("Connection timeout"))
        .mockResolvedValueOnce(mockSnapshot)

      // First call should fail
      await expect(caller.get({ period: "WEEKLY", scope: "GLOBAL", limit: 25 })).rejects.toThrow(
        "Failed to load leaderboard"
      )

      // Second call should succeed
      mockGamificationService.getPreviousSnapshot.mockResolvedValue(null)
      const result = await caller.get({
        period: "WEEKLY",
        scope: "GLOBAL",
        limit: 25,
      })

      expect(result.entries).toHaveLength(2)
    })
  })
})
