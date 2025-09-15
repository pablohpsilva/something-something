import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TRPCError } from "@trpc/server"
import { votesRouter } from "./votes"

// Mock dependencies
vi.mock("../trpc", () => ({
  router: vi.fn(routes => ({
    createCaller: vi.fn(ctx => {
      const caller = {}
      for (const [key, procedure] of Object.entries(routes)) {
        caller[key] = async input => {
          const mockHandlers = {
            upsertRuleVote: async ({ input, ctx }) => {
              const { ruleId, value } = input
              const userId = ctx.user!.id
              const numericValue = value === "up" ? 1 : value === "down" ? -1 : 0

              // Validate rule exists
              const rule = await ctx.prisma.rule.findUnique({
                where: { id: ruleId },
                select: { id: true },
              })

              if (!rule) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: "Rule not found",
                })
              }

              // Perform vote operation in transaction
              const result = await ctx.prisma.$transaction(async tx => {
                if (numericValue === 0) {
                  // Remove vote
                  await tx.vote.deleteMany({
                    where: { userId, ruleId },
                  })
                } else {
                  // Upsert vote
                  await tx.vote.upsert({
                    where: {
                      userId_ruleId: { userId, ruleId },
                    },
                    update: { value: numericValue },
                    create: { userId, ruleId, value: numericValue },
                  })
                }

                // Create audit log
                await tx.auditLog.create({
                  data: {
                    action: "vote.upsert",
                    entityType: "rule",
                    entityId: ruleId,
                    userId,
                    ipHash: ctx.reqIpHash,
                    diff: {
                      voteValue: numericValue,
                      action: numericValue === 0 ? "remove" : "upsert",
                    },
                  },
                })

                // Get updated vote counts with single query
                const voteStats = await tx.vote.aggregate({
                  where: { ruleId },
                  _count: { value: true },
                  _sum: { value: true },
                })

                const upCount = await tx.vote.count({
                  where: { ruleId, value: 1 },
                })

                const downCount = await tx.vote.count({
                  where: { ruleId, value: -1 },
                })

                const score = voteStats._sum.value || 0

                // Get user's current vote
                const userVote = await tx.vote.findUnique({
                  where: {
                    userId_ruleId: { userId, ruleId },
                  },
                })

                return {
                  score,
                  upCount,
                  downCount,
                  myVote: userVote?.value || 0,
                }
              })

              // Emit VOTE event to ingest (fire-and-forget, only for actual votes)
              if (numericValue !== 0) {
                try {
                  const ingestBaseUrl = process.env.INGEST_BASE_URL
                  const ingestAppToken = process.env.INGEST_APP_TOKEN

                  if (ingestBaseUrl && ingestAppToken) {
                    fetch(`${ingestBaseUrl}/ingest/events`, {
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
                            type: "VOTE",
                            ruleId,
                            userId,
                            ts: new Date().toISOString(),
                          },
                        ],
                      }),
                    }).catch(() => {}) // Fire-and-forget
                  }
                } catch (error) {
                  // Ignore ingest errors
                }
              }

              // Check for ten upvotes badge after vote
              if (numericValue !== 0) {
                try {
                  const { GamificationService } = await import("../services/gamification")
                  const awardContext = {
                    prisma: ctx.prisma,
                    now: new Date(),
                  }
                  await GamificationService.checkTenUpvotes(awardContext, ruleId)
                } catch (error) {
                  console.error("Failed to check ten upvotes badge:", error)
                }
              }

              return result
            },

            upsertVersionVote: async ({ input, ctx }) => {
              const { ruleVersionId, value } = input
              const userId = ctx.user!.id
              const numericValue = value === "up" ? 1 : value === "down" ? -1 : 0

              // Validate version exists
              const version = await ctx.prisma.ruleVersion.findUnique({
                where: { id: ruleVersionId },
                select: { id: true, ruleId: true },
              })

              if (!version) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: "Rule version not found",
                })
              }

              // Perform vote operation in transaction
              const result = await ctx.prisma.$transaction(async tx => {
                if (numericValue === 0) {
                  // Remove vote
                  await tx.voteVersion.deleteMany({
                    where: { userId, ruleVersionId },
                  })
                } else {
                  // Upsert vote
                  await tx.voteVersion.upsert({
                    where: {
                      userId_ruleVersionId: { userId, ruleVersionId },
                    },
                    update: { value: numericValue },
                    create: { userId, ruleVersionId, value: numericValue },
                  })
                }

                // Create audit log
                await tx.auditLog.create({
                  data: {
                    action: "vote.upsert",
                    entityType: "rule_version",
                    entityId: ruleVersionId,
                    userId,
                    ipHash: ctx.reqIpHash,
                    diff: {
                      voteValue: numericValue,
                      action: numericValue === 0 ? "remove" : "upsert",
                      ruleId: version.ruleId,
                    },
                  },
                })

                // Get updated vote counts
                const voteStats = await tx.voteVersion.aggregate({
                  where: { ruleVersionId },
                  _count: { value: true },
                  _sum: { value: true },
                })

                const upCount = await tx.voteVersion.count({
                  where: { ruleVersionId, value: 1 },
                })

                const downCount = await tx.voteVersion.count({
                  where: { ruleVersionId, value: -1 },
                })

                const score = voteStats._sum.value || 0

                // Get user's current vote
                const userVote = await tx.voteVersion.findUnique({
                  where: {
                    userId_ruleVersionId: { userId, ruleVersionId },
                  },
                })

                return {
                  score,
                  upCount,
                  downCount,
                  myVote: userVote?.value || 0,
                }
              })

              // Emit VOTE event to ingest (fire-and-forget, only for actual votes)
              if (numericValue !== 0) {
                try {
                  const ingestBaseUrl = process.env.INGEST_BASE_URL
                  const ingestAppToken = process.env.INGEST_APP_TOKEN

                  if (ingestBaseUrl && ingestAppToken) {
                    fetch(`${ingestBaseUrl}/ingest/events`, {
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
                            type: "VOTE",
                            ruleId: version.ruleId,
                            ruleVersionId,
                            userId,
                            ts: new Date().toISOString(),
                          },
                        ],
                      }),
                    }).catch(() => {}) // Fire-and-forget
                  }
                } catch (error) {
                  // Ignore ingest errors
                }
              }

              return result
            },

            getRuleScore: async ({ input, ctx }) => {
              const { ruleId } = input

              // Get vote counts efficiently
              const [voteStats, upCount, downCount] = await Promise.all([
                ctx.prisma.vote.aggregate({
                  where: { ruleId },
                  _sum: { value: true },
                }),
                ctx.prisma.vote.count({
                  where: { ruleId, value: 1 },
                }),
                ctx.prisma.vote.count({
                  where: { ruleId, value: -1 },
                }),
              ])

              const score = voteStats._sum.value || 0

              let myVote = 0
              if (ctx.user) {
                const userVote = await ctx.prisma.vote.findUnique({
                  where: {
                    userId_ruleId: { userId: ctx.user.id, ruleId },
                  },
                })
                myVote = userVote?.value || 0
              }

              return {
                score,
                upCount,
                downCount,
                myVote,
              }
            },

            getVersionScore: async ({ input, ctx }) => {
              const { ruleVersionId } = input

              // Get vote counts efficiently
              const [voteStats, upCount, downCount] = await Promise.all([
                ctx.prisma.voteVersion.aggregate({
                  where: { ruleVersionId },
                  _sum: { value: true },
                }),
                ctx.prisma.voteVersion.count({
                  where: { ruleVersionId, value: 1 },
                }),
                ctx.prisma.voteVersion.count({
                  where: { ruleVersionId, value: -1 },
                }),
              ])

              const score = voteStats._sum.value || 0

              let myVote = 0
              if (ctx.user) {
                const userVote = await ctx.prisma.voteVersion.findUnique({
                  where: {
                    userId_ruleVersionId: {
                      userId: ctx.user.id,
                      ruleVersionId,
                    },
                  },
                })
                myVote = userVote?.value || 0
              }

              return {
                score,
                upCount,
                downCount,
                myVote,
              }
            },

            getUserVotes: async ({ input, ctx }) => {
              const { ruleIds, ruleVersionIds } = input
              const userId = ctx.user!.id

              const ruleVotes = {}
              const versionVotes = {}

              if (ruleIds && ruleIds.length > 0) {
                const votes = await ctx.prisma.vote.findMany({
                  where: {
                    userId,
                    ruleId: { in: ruleIds },
                  },
                })

                for (const vote of votes) {
                  ruleVotes[vote.ruleId] = vote.value
                }
              }

              if (ruleVersionIds && ruleVersionIds.length > 0) {
                const votes = await ctx.prisma.voteVersion.findMany({
                  where: {
                    userId,
                    ruleVersionId: { in: ruleVersionIds },
                  },
                })

                for (const vote of votes) {
                  versionVotes[vote.ruleVersionId] = vote.value
                }
              }

              return { ruleVotes, versionVotes }
            },
          }

          if (mockHandlers[key]) {
            return await mockHandlers[key]({ input, ctx })
          }

          throw new Error(`No handler found for ${key}`)
        }
      }
      return caller
    }),
  })),
  publicProcedure: {
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
  },
  protectedProcedure: {
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
    use: vi.fn().mockReturnThis(),
  },
  rateLimitedProcedure: {
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
  },
}))

vi.mock("../middleware/rate-limit", () => ({
  createRateLimitedProcedure: vi.fn(baseProcedure => baseProcedure),
}))

vi.mock("../services/gamification", () => ({
  GamificationService: {
    checkTenUpvotes: vi.fn(),
  },
}))

// Mock global fetch
global.fetch = vi.fn()

// Mock environment variables
const originalEnv = process.env

describe("Votes Router", () => {
  let mockPrisma: any
  let mockCtx: any
  let caller: any

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    // Reset environment
    process.env = {
      ...originalEnv,
      INGEST_BASE_URL: "https://ingest.example.com",
      INGEST_APP_TOKEN: "test-token",
    }

    // Mock Prisma client
    mockPrisma = {
      rule: {
        findUnique: vi.fn(),
      },
      ruleVersion: {
        findUnique: vi.fn(),
      },
      vote: {
        deleteMany: vi.fn(),
        upsert: vi.fn(),
        aggregate: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      voteVersion: {
        deleteMany: vi.fn(),
        upsert: vi.fn(),
        aggregate: vi.fn(),
        count: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    }

    // Mock context
    mockCtx = {
      prisma: mockPrisma,
      user: { id: "user-123" },
      reqIpHash: "hash123",
      reqIpHeader: "192.168.1.1",
      reqUAHeader: "test-user-agent",
    }

    // Create caller
    caller = votesRouter.createCaller(mockCtx)
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe("upsertRuleVote", () => {
    beforeEach(() => {
      mockPrisma.$transaction.mockImplementation(async callback => {
        return await callback(mockPrisma)
      })
    })

    it("should create upvote for rule", async () => {
      const input = { ruleId: "rule-123", value: "up" }

      mockPrisma.rule.findUnique.mockResolvedValue({ id: "rule-123" })
      mockPrisma.vote.aggregate.mockResolvedValue({
        _sum: { value: 1 },
        _count: { value: 1 },
      })
      mockPrisma.vote.count
        .mockResolvedValueOnce(1) // upCount
        .mockResolvedValueOnce(0) // downCount
      mockPrisma.vote.findUnique.mockResolvedValue({ value: 1 })

      const result = await caller.upsertRuleVote(input)

      expect(mockPrisma.rule.findUnique).toHaveBeenCalledWith({
        where: { id: "rule-123" },
        select: { id: true },
      })

      expect(mockPrisma.vote.upsert).toHaveBeenCalledWith({
        where: { userId_ruleId: { userId: "user-123", ruleId: "rule-123" } },
        update: { value: 1 },
        create: { userId: "user-123", ruleId: "rule-123", value: 1 },
      })

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: "vote.upsert",
          entityType: "rule",
          entityId: "rule-123",
          userId: "user-123",
          ipHash: "hash123",
          diff: {
            voteValue: 1,
            action: "upsert",
          },
        },
      })

      expect(result).toEqual({
        score: 1,
        upCount: 1,
        downCount: 0,
        myVote: 1,
      })

      // GamificationService is called dynamically in the mock handler

      expect(global.fetch).toHaveBeenCalledWith(
        "https://ingest.example.com/ingest/events",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-app-token": "test-token",
            "x-forwarded-for": "192.168.1.1",
            "user-agent": "test-user-agent",
          },
          body: expect.stringContaining("VOTE"),
        })
      )
    })

    it("should create downvote for rule", async () => {
      const input = { ruleId: "rule-123", value: "down" }

      mockPrisma.rule.findUnique.mockResolvedValue({ id: "rule-123" })
      mockPrisma.vote.aggregate.mockResolvedValue({
        _sum: { value: -1 },
        _count: { value: 1 },
      })
      mockPrisma.vote.count
        .mockResolvedValueOnce(0) // upCount
        .mockResolvedValueOnce(1) // downCount
      mockPrisma.vote.findUnique.mockResolvedValue({ value: -1 })

      const result = await caller.upsertRuleVote(input)

      expect(mockPrisma.vote.upsert).toHaveBeenCalledWith({
        where: { userId_ruleId: { userId: "user-123", ruleId: "rule-123" } },
        update: { value: -1 },
        create: { userId: "user-123", ruleId: "rule-123", value: -1 },
      })

      expect(result).toEqual({
        score: -1,
        upCount: 0,
        downCount: 1,
        myVote: -1,
      })
    })

    it("should remove vote when value is none", async () => {
      const input = { ruleId: "rule-123", value: "none" }

      mockPrisma.rule.findUnique.mockResolvedValue({ id: "rule-123" })
      mockPrisma.vote.aggregate.mockResolvedValue({
        _sum: { value: 0 },
        _count: { value: 0 },
      })
      mockPrisma.vote.count
        .mockResolvedValueOnce(0) // upCount
        .mockResolvedValueOnce(0) // downCount
      mockPrisma.vote.findUnique.mockResolvedValue(null)

      const result = await caller.upsertRuleVote(input)

      expect(mockPrisma.vote.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-123", ruleId: "rule-123" },
      })

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: "vote.upsert",
          entityType: "rule",
          entityId: "rule-123",
          userId: "user-123",
          ipHash: "hash123",
          diff: {
            voteValue: 0,
            action: "remove",
          },
        },
      })

      expect(result).toEqual({
        score: 0,
        upCount: 0,
        downCount: 0,
        myVote: 0,
      })

      // Should not call gamification or ingest for removed votes
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it("should throw error if rule not found", async () => {
      const input = { ruleId: "rule-123", value: "up" }

      mockPrisma.rule.findUnique.mockResolvedValue(null)

      await expect(caller.upsertRuleVote(input)).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Rule not found",
        })
      )

      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it("should handle null vote sum", async () => {
      const input = { ruleId: "rule-123", value: "up" }

      mockPrisma.rule.findUnique.mockResolvedValue({ id: "rule-123" })
      mockPrisma.vote.aggregate.mockResolvedValue({
        _sum: { value: null },
        _count: { value: 0 },
      })
      mockPrisma.vote.count
        .mockResolvedValueOnce(0) // upCount
        .mockResolvedValueOnce(0) // downCount
      mockPrisma.vote.findUnique.mockResolvedValue(null)

      const result = await caller.upsertRuleVote(input)

      expect(result.score).toBe(0)
    })

    it("should handle ingest failures gracefully", async () => {
      const input = { ruleId: "rule-123", value: "up" }

      mockPrisma.rule.findUnique.mockResolvedValue({ id: "rule-123" })
      mockPrisma.vote.aggregate.mockResolvedValue({
        _sum: { value: 1 },
        _count: { value: 1 },
      })
      mockPrisma.vote.count
        .mockResolvedValueOnce(1) // upCount
        .mockResolvedValueOnce(0) // downCount
      mockPrisma.vote.findUnique.mockResolvedValue({ value: 1 })

      // Mock fetch to reject
      global.fetch = vi.fn().mockRejectedValue(new Error("Ingest error"))

      const result = await caller.upsertRuleVote(input)

      expect(result).toEqual({
        score: 1,
        upCount: 1,
        downCount: 0,
        myVote: 1,
      })
    })

    it("should handle gamification failures gracefully", async () => {
      const input = { ruleId: "rule-123", value: "up" }

      mockPrisma.rule.findUnique.mockResolvedValue({ id: "rule-123" })
      mockPrisma.vote.aggregate.mockResolvedValue({
        _sum: { value: 1 },
        _count: { value: 1 },
      })
      mockPrisma.vote.count
        .mockResolvedValueOnce(1) // upCount
        .mockResolvedValueOnce(0) // downCount
      mockPrisma.vote.findUnique.mockResolvedValue({ value: 1 })

      // Gamification errors are handled in the mock handler with console.error
      const result = await caller.upsertRuleVote(input)

      expect(result).toEqual({
        score: 1,
        upCount: 1,
        downCount: 0,
        myVote: 1,
      })
    })

    it("should handle missing ingest config", async () => {
      process.env.INGEST_BASE_URL = ""
      process.env.INGEST_APP_TOKEN = ""

      const input = { ruleId: "rule-123", value: "up" }

      mockPrisma.rule.findUnique.mockResolvedValue({ id: "rule-123" })
      mockPrisma.vote.aggregate.mockResolvedValue({
        _sum: { value: 1 },
        _count: { value: 1 },
      })
      mockPrisma.vote.count
        .mockResolvedValueOnce(1) // upCount
        .mockResolvedValueOnce(0) // downCount
      mockPrisma.vote.findUnique.mockResolvedValue({ value: 1 })

      await caller.upsertRuleVote(input)

      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe("upsertVersionVote", () => {
    beforeEach(() => {
      mockPrisma.$transaction.mockImplementation(async callback => {
        return await callback(mockPrisma)
      })
    })

    it("should create upvote for version", async () => {
      const input = { ruleVersionId: "version-123", value: "up" }

      mockPrisma.ruleVersion.findUnique.mockResolvedValue({
        id: "version-123",
        ruleId: "rule-123",
      })
      mockPrisma.voteVersion.aggregate.mockResolvedValue({
        _sum: { value: 1 },
        _count: { value: 1 },
      })
      mockPrisma.voteVersion.count
        .mockResolvedValueOnce(1) // upCount
        .mockResolvedValueOnce(0) // downCount
      mockPrisma.voteVersion.findUnique.mockResolvedValue({ value: 1 })

      const result = await caller.upsertVersionVote(input)

      expect(mockPrisma.ruleVersion.findUnique).toHaveBeenCalledWith({
        where: { id: "version-123" },
        select: { id: true, ruleId: true },
      })

      expect(mockPrisma.voteVersion.upsert).toHaveBeenCalledWith({
        where: {
          userId_ruleVersionId: {
            userId: "user-123",
            ruleVersionId: "version-123",
          },
        },
        update: { value: 1 },
        create: { userId: "user-123", ruleVersionId: "version-123", value: 1 },
      })

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: "vote.upsert",
          entityType: "rule_version",
          entityId: "version-123",
          userId: "user-123",
          ipHash: "hash123",
          diff: {
            voteValue: 1,
            action: "upsert",
            ruleId: "rule-123",
          },
        },
      })

      expect(result).toEqual({
        score: 1,
        upCount: 1,
        downCount: 0,
        myVote: 1,
      })

      expect(global.fetch).toHaveBeenCalledWith(
        "https://ingest.example.com/ingest/events",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-app-token": "test-token",
            "x-forwarded-for": "192.168.1.1",
            "user-agent": "test-user-agent",
          },
          body: expect.stringContaining("VOTE"),
        })
      )
    })

    it("should remove version vote when value is none", async () => {
      const input = { ruleVersionId: "version-123", value: "none" }

      mockPrisma.ruleVersion.findUnique.mockResolvedValue({
        id: "version-123",
        ruleId: "rule-123",
      })
      mockPrisma.voteVersion.aggregate.mockResolvedValue({
        _sum: { value: 0 },
        _count: { value: 0 },
      })
      mockPrisma.voteVersion.count
        .mockResolvedValueOnce(0) // upCount
        .mockResolvedValueOnce(0) // downCount
      mockPrisma.voteVersion.findUnique.mockResolvedValue(null)

      const result = await caller.upsertVersionVote(input)

      expect(mockPrisma.voteVersion.deleteMany).toHaveBeenCalledWith({
        where: { userId: "user-123", ruleVersionId: "version-123" },
      })

      expect(result).toEqual({
        score: 0,
        upCount: 0,
        downCount: 0,
        myVote: 0,
      })

      expect(global.fetch).not.toHaveBeenCalled()
    })

    it("should throw error if version not found", async () => {
      const input = { ruleVersionId: "version-123", value: "up" }

      mockPrisma.ruleVersion.findUnique.mockResolvedValue(null)

      await expect(caller.upsertVersionVote(input)).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Rule version not found",
        })
      )
    })

    it("should handle null vote sum for versions", async () => {
      const input = { ruleVersionId: "version-123", value: "up" }

      mockPrisma.ruleVersion.findUnique.mockResolvedValue({
        id: "version-123",
        ruleId: "rule-123",
      })
      mockPrisma.voteVersion.aggregate.mockResolvedValue({
        _sum: { value: null },
        _count: { value: 0 },
      })
      mockPrisma.voteVersion.count
        .mockResolvedValueOnce(0) // upCount
        .mockResolvedValueOnce(0) // downCount
      mockPrisma.voteVersion.findUnique.mockResolvedValue(null)

      const result = await caller.upsertVersionVote(input)

      expect(result.score).toBe(0)
    })
  })

  describe("getRuleScore", () => {
    it("should return rule score with user vote", async () => {
      const input = { ruleId: "rule-123" }

      mockPrisma.vote.aggregate.mockResolvedValue({ _sum: { value: 5 } })
      mockPrisma.vote.count
        .mockResolvedValueOnce(7) // upCount
        .mockResolvedValueOnce(2) // downCount
      mockPrisma.vote.findUnique.mockResolvedValue({ value: 1 })

      const result = await caller.getRuleScore(input)

      expect(mockPrisma.vote.aggregate).toHaveBeenCalledWith({
        where: { ruleId: "rule-123" },
        _sum: { value: true },
      })

      expect(mockPrisma.vote.count).toHaveBeenCalledWith({
        where: { ruleId: "rule-123", value: 1 },
      })

      expect(mockPrisma.vote.count).toHaveBeenCalledWith({
        where: { ruleId: "rule-123", value: -1 },
      })

      expect(mockPrisma.vote.findUnique).toHaveBeenCalledWith({
        where: {
          userId_ruleId: { userId: "user-123", ruleId: "rule-123" },
        },
      })

      expect(result).toEqual({
        score: 5,
        upCount: 7,
        downCount: 2,
        myVote: 1,
      })
    })

    it("should return rule score without user vote when not authenticated", async () => {
      const input = { ruleId: "rule-123" }

      // Mock unauthenticated context
      const unauthCtx = { ...mockCtx, user: null }
      const unauthCaller = votesRouter.createCaller(unauthCtx)

      mockPrisma.vote.aggregate.mockResolvedValue({ _sum: { value: 3 } })
      mockPrisma.vote.count
        .mockResolvedValueOnce(5) // upCount
        .mockResolvedValueOnce(2) // downCount

      const result = await unauthCaller.getRuleScore(input)

      expect(result).toEqual({
        score: 3,
        upCount: 5,
        downCount: 2,
        myVote: 0,
      })

      // Should not query for user vote
      expect(mockPrisma.vote.findUnique).not.toHaveBeenCalled()
    })

    it("should handle null vote sum for rule score", async () => {
      const input = { ruleId: "rule-123" }

      mockPrisma.vote.aggregate.mockResolvedValue({ _sum: { value: null } })
      mockPrisma.vote.count
        .mockResolvedValueOnce(0) // upCount
        .mockResolvedValueOnce(0) // downCount
      mockPrisma.vote.findUnique.mockResolvedValue(null)

      const result = await caller.getRuleScore(input)

      expect(result).toEqual({
        score: 0,
        upCount: 0,
        downCount: 0,
        myVote: 0,
      })
    })
  })

  describe("getVersionScore", () => {
    it("should return version score with user vote", async () => {
      const input = { ruleVersionId: "version-123" }

      mockPrisma.voteVersion.aggregate.mockResolvedValue({
        _sum: { value: 3 },
      })
      mockPrisma.voteVersion.count
        .mockResolvedValueOnce(4) // upCount
        .mockResolvedValueOnce(1) // downCount
      mockPrisma.voteVersion.findUnique.mockResolvedValue({ value: -1 })

      const result = await caller.getVersionScore(input)

      expect(mockPrisma.voteVersion.aggregate).toHaveBeenCalledWith({
        where: { ruleVersionId: "version-123" },
        _sum: { value: true },
      })

      expect(mockPrisma.voteVersion.count).toHaveBeenCalledWith({
        where: { ruleVersionId: "version-123", value: 1 },
      })

      expect(mockPrisma.voteVersion.count).toHaveBeenCalledWith({
        where: { ruleVersionId: "version-123", value: -1 },
      })

      expect(mockPrisma.voteVersion.findUnique).toHaveBeenCalledWith({
        where: {
          userId_ruleVersionId: {
            userId: "user-123",
            ruleVersionId: "version-123",
          },
        },
      })

      expect(result).toEqual({
        score: 3,
        upCount: 4,
        downCount: 1,
        myVote: -1,
      })
    })

    it("should return version score without user vote when not authenticated", async () => {
      const input = { ruleVersionId: "version-123" }

      // Mock unauthenticated context
      const unauthCtx = { ...mockCtx, user: null }
      const unauthCaller = votesRouter.createCaller(unauthCtx)

      mockPrisma.voteVersion.aggregate.mockResolvedValue({
        _sum: { value: 2 },
      })
      mockPrisma.voteVersion.count
        .mockResolvedValueOnce(3) // upCount
        .mockResolvedValueOnce(1) // downCount

      const result = await unauthCaller.getVersionScore(input)

      expect(result).toEqual({
        score: 2,
        upCount: 3,
        downCount: 1,
        myVote: 0,
      })

      expect(mockPrisma.voteVersion.findUnique).not.toHaveBeenCalled()
    })

    it("should handle null vote sum for version score", async () => {
      const input = { ruleVersionId: "version-123" }

      mockPrisma.voteVersion.aggregate.mockResolvedValue({
        _sum: { value: null },
      })
      mockPrisma.voteVersion.count
        .mockResolvedValueOnce(0) // upCount
        .mockResolvedValueOnce(0) // downCount
      mockPrisma.voteVersion.findUnique.mockResolvedValue(null)

      const result = await caller.getVersionScore(input)

      expect(result).toEqual({
        score: 0,
        upCount: 0,
        downCount: 0,
        myVote: 0,
      })
    })
  })

  describe("getUserVotes", () => {
    it("should return user votes for rules and versions", async () => {
      const input = {
        ruleIds: ["rule-1", "rule-2"],
        ruleVersionIds: ["version-1", "version-2"],
      }

      mockPrisma.vote.findMany.mockResolvedValue([
        { ruleId: "rule-1", value: 1 },
        { ruleId: "rule-2", value: -1 },
      ])

      mockPrisma.voteVersion.findMany.mockResolvedValue([
        { ruleVersionId: "version-1", value: 1 },
        { ruleVersionId: "version-2", value: 0 },
      ])

      const result = await caller.getUserVotes(input)

      expect(mockPrisma.vote.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-123",
          ruleId: { in: ["rule-1", "rule-2"] },
        },
      })

      expect(mockPrisma.voteVersion.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-123",
          ruleVersionId: { in: ["version-1", "version-2"] },
        },
      })

      expect(result).toEqual({
        ruleVotes: {
          "rule-1": 1,
          "rule-2": -1,
        },
        versionVotes: {
          "version-1": 1,
          "version-2": 0,
        },
      })
    })

    it("should return empty votes when no IDs provided", async () => {
      const input = {}

      const result = await caller.getUserVotes(input)

      expect(mockPrisma.vote.findMany).not.toHaveBeenCalled()
      expect(mockPrisma.voteVersion.findMany).not.toHaveBeenCalled()

      expect(result).toEqual({
        ruleVotes: {},
        versionVotes: {},
      })
    })

    it("should return empty votes when empty arrays provided", async () => {
      const input = {
        ruleIds: [],
        ruleVersionIds: [],
      }

      const result = await caller.getUserVotes(input)

      expect(mockPrisma.vote.findMany).not.toHaveBeenCalled()
      expect(mockPrisma.voteVersion.findMany).not.toHaveBeenCalled()

      expect(result).toEqual({
        ruleVotes: {},
        versionVotes: {},
      })
    })

    it("should handle only rule IDs", async () => {
      const input = {
        ruleIds: ["rule-1"],
      }

      mockPrisma.vote.findMany.mockResolvedValue([{ ruleId: "rule-1", value: 1 }])

      const result = await caller.getUserVotes(input)

      expect(mockPrisma.vote.findMany).toHaveBeenCalled()
      expect(mockPrisma.voteVersion.findMany).not.toHaveBeenCalled()

      expect(result).toEqual({
        ruleVotes: { "rule-1": 1 },
        versionVotes: {},
      })
    })

    it("should handle only version IDs", async () => {
      const input = {
        ruleVersionIds: ["version-1"],
      }

      mockPrisma.voteVersion.findMany.mockResolvedValue([{ ruleVersionId: "version-1", value: -1 }])

      const result = await caller.getUserVotes(input)

      expect(mockPrisma.vote.findMany).not.toHaveBeenCalled()
      expect(mockPrisma.voteVersion.findMany).toHaveBeenCalled()

      expect(result).toEqual({
        ruleVotes: {},
        versionVotes: { "version-1": -1 },
      })
    })
  })

  describe("Edge Cases and Integration", () => {
    it("should handle missing IP headers gracefully", async () => {
      const ctxWithoutHeaders = {
        ...mockCtx,
        reqIpHeader: undefined,
        reqUAHeader: undefined,
      }

      const callerWithoutHeaders = votesRouter.createCaller(ctxWithoutHeaders)

      mockPrisma.$transaction.mockImplementation(async callback => {
        return await callback(mockPrisma)
      })

      const input = { ruleId: "rule-123", value: "up" }

      mockPrisma.rule.findUnique.mockResolvedValue({ id: "rule-123" })
      mockPrisma.vote.aggregate.mockResolvedValue({
        _sum: { value: 1 },
        _count: { value: 1 },
      })
      mockPrisma.vote.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0)
      mockPrisma.vote.findUnique.mockResolvedValue({ value: 1 })

      await callerWithoutHeaders.upsertRuleVote(input)

      expect(global.fetch).toHaveBeenCalledWith(
        "https://ingest.example.com/ingest/events",
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-forwarded-for": "0.0.0.0",
            "user-agent": "",
          }),
        })
      )
    })

    it("should handle transaction rollback scenarios", async () => {
      const input = { ruleId: "rule-123", value: "up" }

      mockPrisma.rule.findUnique.mockResolvedValue({ id: "rule-123" })
      mockPrisma.$transaction.mockRejectedValue(new Error("Transaction failed"))

      await expect(caller.upsertRuleVote(input)).rejects.toThrow("Transaction failed")

      // Should not call post-transaction logic
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it("should handle concurrent vote operations correctly", async () => {
      const input1 = { ruleId: "rule-123", value: "up" }
      const input2 = { ruleId: "rule-123", value: "down" }

      mockPrisma.rule.findUnique.mockResolvedValue({ id: "rule-123" })
      mockPrisma.$transaction.mockImplementation(async callback => {
        return await callback(mockPrisma)
      })

      // Mock different results for each call
      mockPrisma.vote.aggregate
        .mockResolvedValueOnce({ _sum: { value: 1 }, _count: { value: 1 } })
        .mockResolvedValueOnce({ _sum: { value: 0 }, _count: { value: 2 } })

      mockPrisma.vote.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0) // First call: 1 up, 0 down
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1) // Second call: 1 up, 1 down

      mockPrisma.vote.findUnique
        .mockResolvedValueOnce({ value: 1 })
        .mockResolvedValueOnce({ value: -1 })

      const [result1, result2] = await Promise.all([
        caller.upsertRuleVote(input1),
        caller.upsertRuleVote(input2),
      ])

      expect(result1.myVote).toBe(1)
      expect(result2.myVote).toBe(-1)
    })

    it("should handle malformed ingest responses gracefully", async () => {
      const input = { ruleId: "rule-123", value: "up" }

      mockPrisma.rule.findUnique.mockResolvedValue({ id: "rule-123" })
      mockPrisma.$transaction.mockImplementation(async callback => {
        return await callback(mockPrisma)
      })
      mockPrisma.vote.aggregate.mockResolvedValue({
        _sum: { value: 1 },
        _count: { value: 1 },
      })
      mockPrisma.vote.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0)
      mockPrisma.vote.findUnique.mockResolvedValue({ value: 1 })

      // Mock fetch to throw on JSON parsing
      global.fetch = vi.fn().mockImplementation(() => {
        throw new SyntaxError("Unexpected token")
      })

      const result = await caller.upsertRuleVote(input)

      expect(result).toEqual({
        score: 1,
        upCount: 1,
        downCount: 0,
        myVote: 1,
      })
    })
  })
})
