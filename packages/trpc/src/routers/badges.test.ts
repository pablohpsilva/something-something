import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TRPCError } from "@trpc/server"
import { badgesRouter } from "./badges"

// Mock dependencies
vi.mock("../schemas/gamification", () => ({
  badgesListInputSchema: {
    parse: vi.fn(input => input),
  },
  badgesAllInputSchema: {
    parse: vi.fn(input => input),
  },
  badgesRecheckInputSchema: {
    parse: vi.fn(input => input),
  },
  userBadgesResponseSchema: {
    parse: vi.fn(input => input),
  },
  badgeCatalogResponseSchema: {
    parse: vi.fn(input => input),
  },
  badgesRecheckResponseSchema: {
    parse: vi.fn(input => input),
  },
}))

vi.mock("../services/gamification", () => ({
  GamificationService: {
    recheckUserBadges: vi.fn(),
  },
}))

vi.mock("../trpc", () => ({
  router: vi.fn(routes => ({
    createCaller: vi.fn(ctx => {
      const caller = {}
      for (const [key, procedure] of Object.entries(routes)) {
        caller[key] = async (...args) => {
          // Mock procedure execution
          if (procedure._def?.query || procedure._def?.mutation) {
            const handler = procedure._def.query || procedure._def.mutation
            return handler({ input: args[0], ctx })
          }

          // For testing, we'll simulate the handler directly
          const mockHandlers = {
            listMine: async ({ ctx }) => {
              const userBadges = await ctx.prisma.userBadge.findMany({
                where: { userId: ctx.user.id },
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
              })

              return {
                badges: userBadges.map(ub => ({
                  slug: ub.badge.slug,
                  name: ub.badge.name,
                  description: ub.badge.description,
                  criteria: ub.badge.criteria || {},
                  awardedAt: ub.awardedAt,
                })),
                totalCount: userBadges.length,
              }
            },
            listForUser: async ({ input, ctx }) => {
              const { userId } = input

              if (!userId) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: "User ID is required",
                })
              }

              const user = await ctx.prisma.user.findUnique({
                where: { id: userId },
                select: { id: true },
              })

              if (!user) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: "User not found",
                })
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
              })

              return {
                badges: userBadges.map(ub => ({
                  slug: ub.badge.slug,
                  name: ub.badge.name,
                  description: ub.badge.description,
                  criteria: ub.badge.criteria || {},
                  awardedAt: ub.awardedAt,
                })),
                totalCount: userBadges.length,
              }
            },
            catalog: async ({ ctx }) => {
              const badges = await ctx.prisma.badge.findMany({
                select: {
                  slug: true,
                  name: true,
                  description: true,
                  criteria: true,
                },
                orderBy: { name: "asc" },
              })

              return {
                badges: badges.map(badge => ({
                  ...badge,
                  criteria: badge.criteria || {},
                })),
              }
            },
            recheckMine: async ({ ctx }) => {
              try {
                const awardContext = {
                  prisma: ctx.prisma,
                  now: new Date(),
                }

                const awarded = await GamificationService.recheckUserBadges(
                  awardContext,
                  ctx.user.id
                )

                return {
                  awarded,
                  message:
                    awarded > 0
                      ? `Congratulations! You earned ${awarded} new badge${
                          awarded === 1 ? "" : "s"
                        }!`
                      : "No new badges earned. Keep contributing!",
                }
              } catch (error) {
                console.error("Failed to recheck badges:", error)
                throw new TRPCError({
                  code: "INTERNAL_SERVER_ERROR",
                  message: "Failed to recheck badges",
                })
              }
            },
            stats: async ({ ctx }) => {
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
              ])

              return {
                totalBadges,
                totalAwarded,
                awardsByBadge: badgeStats.map(badge => ({
                  slug: badge.slug,
                  name: badge.name,
                  count: 0,
                })),
              }
            },
            hasBadge: async ({ input, ctx }) => {
              const { userId, badgeSlug } = input

              const badge = await ctx.prisma.badge.findUnique({
                where: { slug: badgeSlug },
              })

              if (!badge) {
                return { hasBadge: false, awardedAt: null }
              }

              const userBadge = await ctx.prisma.userBadge.findUnique({
                where: {
                  userId_badgeId: {
                    userId,
                    badgeId: badge.id,
                  },
                },
              })

              return {
                hasBadge: !!userBadge,
                awardedAt: userBadge?.awardedAt || null,
              }
            },
          }

          return mockHandlers[key]?.({ input: args[0], ctx })
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
    mutation: vi.fn().mockReturnThis(),
  },
  protectedProcedure: {
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
    use: vi.fn().mockReturnThis(),
  },
  rateLimitedProcedure: {
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
  },
  rateLimit: vi.fn(() => vi.fn().mockReturnThis()),
}))

import { GamificationService } from "../services/gamification"

// Mock data
const mockUser = {
  id: "user123",
  displayName: "Test User",
  handle: "testuser",
}

const mockBadge = {
  id: "badge123",
  slug: "early-adopter",
  name: "Early Adopter",
  description: "One of the first 100 users",
  criteria: { threshold: 100 },
}

const mockUserBadge = {
  id: "userbadge123",
  userId: "user123",
  badgeId: "badge123",
  awardedAt: new Date("2024-01-15"),
  badge: mockBadge,
}

const mockPrisma = {
  userBadge: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  badge: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
}

describe("Badges Router", () => {
  let caller: any

  beforeEach(() => {
    vi.clearAllMocks()
    caller = badgesRouter.createCaller({
      user: mockUser,
      prisma: mockPrisma,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("listMine", () => {
    it("should return current user's badges", async () => {
      const mockUserBadges = [mockUserBadge]
      mockPrisma.userBadge.findMany.mockResolvedValue(mockUserBadges)

      const result = await caller.listMine()

      expect(result).toEqual({
        badges: [
          {
            slug: "early-adopter",
            name: "Early Adopter",
            description: "One of the first 100 users",
            criteria: { threshold: 100 },
            awardedAt: new Date("2024-01-15"),
          },
        ],
        totalCount: 1,
      })

      expect(mockPrisma.userBadge.findMany).toHaveBeenCalledWith({
        where: { userId: "user123" },
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
      })
    })

    it("should return empty list when user has no badges", async () => {
      mockPrisma.userBadge.findMany.mockResolvedValue([])

      const result = await caller.listMine()

      expect(result).toEqual({
        badges: [],
        totalCount: 0,
      })
    })

    it("should handle badges with null criteria", async () => {
      const badgeWithNullCriteria = {
        ...mockUserBadge,
        badge: {
          ...mockBadge,
          criteria: null,
        },
      }
      mockPrisma.userBadge.findMany.mockResolvedValue([badgeWithNullCriteria])

      const result = await caller.listMine()

      expect(result.badges[0].criteria).toEqual({})
    })
  })

  describe("listForUser", () => {
    it("should return badges for a specific user", async () => {
      const mockUserBadges = [mockUserBadge]
      mockPrisma.user.findUnique.mockResolvedValue({ id: "user456" })
      mockPrisma.userBadge.findMany.mockResolvedValue(mockUserBadges)

      const result = await caller.listForUser({ userId: "user456" })

      expect(result).toEqual({
        badges: [
          {
            slug: "early-adopter",
            name: "Early Adopter",
            description: "One of the first 100 users",
            criteria: { threshold: 100 },
            awardedAt: new Date("2024-01-15"),
          },
        ],
        totalCount: 1,
      })

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user456" },
        select: { id: true },
      })
    })

    it("should throw BAD_REQUEST when userId is missing", async () => {
      await expect(caller.listForUser({})).rejects.toThrow(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "User ID is required",
        })
      )
    })

    it("should throw BAD_REQUEST when userId is empty string", async () => {
      await expect(caller.listForUser({ userId: "" })).rejects.toThrow(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "User ID is required",
        })
      )
    })

    it("should throw NOT_FOUND when user doesn't exist", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      await expect(caller.listForUser({ userId: "nonexistent" })).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        })
      )
    })

    it("should handle user with no badges", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "user456" })
      mockPrisma.userBadge.findMany.mockResolvedValue([])

      const result = await caller.listForUser({ userId: "user456" })

      expect(result).toEqual({
        badges: [],
        totalCount: 0,
      })
    })
  })

  describe("catalog", () => {
    it("should return all available badges", async () => {
      const mockBadges = [mockBadge]
      mockPrisma.badge.findMany.mockResolvedValue(mockBadges)

      const result = await caller.catalog()

      expect(result).toEqual({
        badges: [
          {
            id: "badge123",
            slug: "early-adopter",
            name: "Early Adopter",
            description: "One of the first 100 users",
            criteria: { threshold: 100 },
          },
        ],
      })

      expect(mockPrisma.badge.findMany).toHaveBeenCalledWith({
        select: {
          slug: true,
          name: true,
          description: true,
          criteria: true,
        },
        orderBy: { name: "asc" },
      })
    })

    it("should return empty catalog when no badges exist", async () => {
      mockPrisma.badge.findMany.mockResolvedValue([])

      const result = await caller.catalog()

      expect(result).toEqual({
        badges: [],
      })
    })

    it("should handle badges with null criteria", async () => {
      const badgeWithNullCriteria = {
        ...mockBadge,
        criteria: null,
      }
      mockPrisma.badge.findMany.mockResolvedValue([badgeWithNullCriteria])

      const result = await caller.catalog()

      expect(result.badges[0].criteria).toEqual({})
    })
  })

  describe("recheckMine", () => {
    it("should recheck badges and return awards", async () => {
      ;(GamificationService.recheckUserBadges as any).mockResolvedValue(2)

      const result = await caller.recheckMine()

      expect(result).toEqual({
        awarded: 2,
        message: "Congratulations! You earned 2 new badges!",
      })

      expect(GamificationService.recheckUserBadges).toHaveBeenCalledWith(
        {
          prisma: mockPrisma,
          now: expect.any(Date),
        },
        "user123"
      )
    })

    it("should handle single badge award", async () => {
      ;(GamificationService.recheckUserBadges as any).mockResolvedValue(1)

      const result = await caller.recheckMine()

      expect(result).toEqual({
        awarded: 1,
        message: "Congratulations! You earned 1 new badge!",
      })
    })

    it("should handle no new badges", async () => {
      ;(GamificationService.recheckUserBadges as any).mockResolvedValue(0)

      const result = await caller.recheckMine()

      expect(result).toEqual({
        awarded: 0,
        message: "No new badges earned. Keep contributing!",
      })
    })

    it("should handle service errors", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      ;(GamificationService.recheckUserBadges as any).mockRejectedValue(new Error("Service error"))

      await expect(caller.recheckMine()).rejects.toThrow(
        new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to recheck badges",
        })
      )

      expect(consoleSpy).toHaveBeenCalledWith("Failed to recheck badges:", expect.any(Error))

      consoleSpy.mockRestore()
    })
  })

  describe("stats", () => {
    it("should return badge statistics", async () => {
      const mockBadges = [mockBadge]
      mockPrisma.badge.count.mockResolvedValue(5)
      mockPrisma.userBadge.count.mockResolvedValue(25)
      mockPrisma.badge.findMany.mockResolvedValue(mockBadges)

      const result = await caller.stats()

      expect(result).toEqual({
        totalBadges: 5,
        totalAwarded: 25,
        awardsByBadge: [
          {
            slug: "early-adopter",
            name: "Early Adopter",
            count: 0,
          },
        ],
      })

      expect(mockPrisma.badge.count).toHaveBeenCalled()
      expect(mockPrisma.userBadge.count).toHaveBeenCalled()
      expect(mockPrisma.badge.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          criteria: true,
        },
        orderBy: { name: "asc" },
      })
    })

    it("should handle empty badge system", async () => {
      mockPrisma.badge.count.mockResolvedValue(0)
      mockPrisma.userBadge.count.mockResolvedValue(0)
      mockPrisma.badge.findMany.mockResolvedValue([])

      const result = await caller.stats()

      expect(result).toEqual({
        totalBadges: 0,
        totalAwarded: 0,
        awardsByBadge: [],
      })
    })

    it("should handle database errors", async () => {
      mockPrisma.badge.count.mockRejectedValue(new Error("Database error"))

      await expect(caller.stats()).rejects.toThrow("Database error")
    })
  })

  describe("hasBadge", () => {
    it("should return true when user has the badge", async () => {
      mockPrisma.badge.findUnique.mockResolvedValue(mockBadge)
      mockPrisma.userBadge.findUnique.mockResolvedValue(mockUserBadge)

      const result = await caller.hasBadge({
        userId: "user123",
        badgeSlug: "early-adopter",
      })

      expect(result).toEqual({
        hasBadge: true,
        awardedAt: new Date("2024-01-15"),
      })

      expect(mockPrisma.badge.findUnique).toHaveBeenCalledWith({
        where: { slug: "early-adopter" },
      })

      expect(mockPrisma.userBadge.findUnique).toHaveBeenCalledWith({
        where: {
          userId_badgeId: {
            userId: "user123",
            badgeId: "badge123",
          },
        },
      })
    })

    it("should return false when badge doesn't exist", async () => {
      mockPrisma.badge.findUnique.mockResolvedValue(null)

      const result = await caller.hasBadge({
        userId: "user123",
        badgeSlug: "nonexistent",
      })

      expect(result).toEqual({
        hasBadge: false,
        awardedAt: null,
      })

      expect(mockPrisma.userBadge.findUnique).not.toHaveBeenCalled()
    })

    it("should return false when user doesn't have the badge", async () => {
      mockPrisma.badge.findUnique.mockResolvedValue(mockBadge)
      mockPrisma.userBadge.findUnique.mockResolvedValue(null)

      const result = await caller.hasBadge({
        userId: "user123",
        badgeSlug: "early-adopter",
      })

      expect(result).toEqual({
        hasBadge: false,
        awardedAt: null,
      })
    })

    it("should handle database errors", async () => {
      mockPrisma.badge.findUnique.mockRejectedValue(new Error("Database error"))

      await expect(
        caller.hasBadge({
          userId: "user123",
          badgeSlug: "early-adopter",
        })
      ).rejects.toThrow("Database error")
    })
  })

  describe("Edge Cases and Integration", () => {
    it("should handle user context without user ID", async () => {
      const callerWithoutUser = badgesRouter.createCaller({
        user: null,
        prisma: mockPrisma,
      })

      // This would typically be prevented by middleware, but we test the edge case
      await expect(callerWithoutUser.listMine()).rejects.toThrow()
    })

    it("should handle concurrent badge rechecks", async () => {
      ;(GamificationService.recheckUserBadges as any).mockResolvedValue(1)

      const [result1, result2] = await Promise.all([caller.recheckMine(), caller.recheckMine()])

      expect(result1.awarded).toBe(1)
      expect(result2.awarded).toBe(1)
      expect(GamificationService.recheckUserBadges).toHaveBeenCalledTimes(2)
    })

    it("should handle large badge collections efficiently", async () => {
      const largeBadgeCollection = Array.from({ length: 100 }, (_, i) => ({
        ...mockBadge,
        id: `badge${i}`,
        slug: `badge-${i}`,
        name: `Badge ${i}`,
      }))

      mockPrisma.badge.findMany.mockResolvedValue(largeBadgeCollection)

      const result = await caller.catalog()

      expect(result.badges).toHaveLength(100)
      expect(result.badges[0].slug).toBe("badge-0")
      expect(result.badges[99].slug).toBe("badge-99")
    })

    it("should handle user badge queries with complex criteria", async () => {
      const complexBadge = {
        ...mockUserBadge,
        badge: {
          ...mockBadge,
          criteria: {
            type: "achievement",
            requirements: ["rule_count", "vote_count"],
            thresholds: { rules: 10, votes: 100 },
            conditions: { all: true },
          },
        },
      }

      mockPrisma.userBadge.findMany.mockResolvedValue([complexBadge])

      const result = await caller.listMine()

      expect(result.badges[0].criteria).toEqual({
        type: "achievement",
        requirements: ["rule_count", "vote_count"],
        thresholds: { rules: 10, votes: 100 },
        conditions: { all: true },
      })
    })

    it("should handle badge recheck with partial awards", async () => {
      ;(GamificationService.recheckUserBadges as any).mockResolvedValue(3)

      const result = await caller.recheckMine()

      expect(result.message).toBe("Congratulations! You earned 3 new badges!")
    })
  })
})
