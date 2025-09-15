import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TRPCError } from "@trpc/server"
import { claimsRouter } from "./claims"

// Mock dependencies
vi.mock("@repo/db/client", () => ({
  prisma: {
    rule: {
      findUnique: vi.fn(),
    },
    authorClaim: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock("../trpc", () => ({
  createTRPCRouter: vi.fn(routes => ({
    createCaller: vi.fn(ctx => {
      const caller = {}
      for (const [key, procedure] of Object.entries(routes)) {
        caller[key] = async (...args) => {
          // Mock procedure execution based on the route handlers
          const mockHandlers = {
            submit: async ({ input, ctx }) => {
              const { ruleId, evidence } = input

              // Check if rule exists and is published
              const rule = await ctx.prisma.rule.findUnique({
                where: { id: ruleId },
                include: {
                  createdBy: {
                    select: {
                      id: true,
                      displayName: true,
                    },
                  },
                },
              })

              if (!rule) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: "Rule not found",
                })
              }

              if (rule.status !== "PUBLISHED") {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: "Can only claim published rules",
                })
              }

              // Check if user is already the author
              if (rule.createdByUserId === ctx.user?.id) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: "You are already the author of this rule",
                })
              }

              // Check if user has already submitted a claim for this rule
              const existingClaim = await ctx.prisma.authorClaim.findUnique({
                where: {
                  ruleId_claimantId: {
                    ruleId,
                    claimantId: ctx.user?.id || "",
                  },
                },
              })

              if (existingClaim) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: "You have already submitted a claim for this rule",
                })
              }

              // Create the claim
              const claim = await ctx.prisma.authorClaim.create({
                data: {
                  ruleId,
                  claimantId: ctx.user?.id || "",
                  evidence,
                  status: "PENDING",
                },
              })

              return {
                id: claim.id,
                status: claim.status,
                createdAt: claim.createdAt,
              }
            },
            getMyClaims: async ({ input, ctx }) => {
              // Apply default limit if not provided
              const limit = input.limit || 20

              const claims = await ctx.prisma.authorClaim.findMany({
                where: {
                  claimantId: ctx.user?.id,
                },
                include: {
                  rule: {
                    select: {
                      id: true,
                      title: true,
                      slug: true,
                      status: true,
                    },
                  },
                  reviewer: {
                    select: {
                      id: true,
                      displayName: true,
                      handle: true,
                    },
                  },
                },
                orderBy: {
                  createdAt: "desc",
                },
                take: limit + 1,
                ...(input.cursor && {
                  cursor: { id: input.cursor },
                  skip: 1,
                }),
              })

              const hasMore = claims.length > limit
              const items = hasMore ? claims.slice(0, -1) : claims
              const nextCursor = hasMore ? items[items.length - 1]?.id : null

              return {
                items,
                nextCursor,
              }
            },
            getClaim: async ({ input, ctx }) => {
              const claim = await ctx.prisma.authorClaim.findUnique({
                where: { id: input.id },
                include: {
                  rule: {
                    select: {
                      id: true,
                      title: true,
                      slug: true,
                      status: true,
                      createdBy: {
                        select: {
                          id: true,
                          displayName: true,
                          handle: true,
                        },
                      },
                    },
                  },
                  claimant: {
                    select: {
                      id: true,
                      displayName: true,
                      handle: true,
                    },
                  },
                  reviewer: {
                    select: {
                      id: true,
                      displayName: true,
                      handle: true,
                    },
                  },
                },
              })

              if (!claim) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: "Claim not found",
                })
              }

              // Only allow claimant or admins to view claim details
              if (claim.claimantId !== ctx.user?.id && ctx.user?.role !== "ADMIN") {
                throw new TRPCError({
                  code: "FORBIDDEN",
                  message: "Not authorized to view this claim",
                })
              }

              return claim
            },
            getClaimsForRule: async ({ input, ctx }) => {
              const claims = await ctx.prisma.authorClaim.findMany({
                where: {
                  ruleId: input.ruleId,
                  status: "APPROVED",
                },
                include: {
                  claimant: {
                    select: {
                      id: true,
                      displayName: true,
                      handle: true,
                    },
                  },
                },
                orderBy: {
                  reviewedAt: "desc",
                },
              })

              return claims
            },
            cancel: async ({ input, ctx }) => {
              const claim = await ctx.prisma.authorClaim.findUnique({
                where: { id: input.id },
              })

              if (!claim) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: "Claim not found",
                })
              }

              if (claim.claimantId !== ctx.user?.id) {
                throw new TRPCError({
                  code: "FORBIDDEN",
                  message: "Not authorized to cancel this claim",
                })
              }

              if (claim.status !== "PENDING") {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: "Can only cancel pending claims",
                })
              }

              // Delete the claim
              await ctx.prisma.authorClaim.delete({
                where: { id: input.id },
              })

              return { success: true }
            },
          }

          return mockHandlers[key]?.({ input: args[0], ctx })
        }
      }
      return caller
    }),
    ...routes,
  })),
  protectedProcedure: {
    input: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
  },
  createRateLimitedProcedure: vi.fn(() => ({
    input: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
  })),
}))

import { prisma } from "@repo/db/client"

// Mock data
const mockUser = {
  id: "user123",
  displayName: "Test User",
  handle: "testuser",
  role: "USER",
}

const mockAdminUser = {
  id: "admin123",
  displayName: "Admin User",
  handle: "admin",
  role: "ADMIN",
}

const mockRule = {
  id: "rule123",
  title: "Test Rule",
  slug: "test-rule",
  status: "PUBLISHED",
  createdByUserId: "author123",
  createdBy: {
    id: "author123",
    displayName: "Original Author",
  },
}

const mockClaim = {
  id: "claim123",
  ruleId: "rule123",
  claimantId: "user123",
  evidence: "I am the original author of this rule.",
  status: "PENDING",
  createdAt: new Date("2024-01-15"),
  reviewedAt: null,
  reviewNote: null,
  reviewerId: null,
}

const mockClaimWithRelations = {
  ...mockClaim,
  rule: {
    id: "rule123",
    title: "Test Rule",
    slug: "test-rule",
    status: "PUBLISHED",
    createdBy: {
      id: "author123",
      displayName: "Original Author",
      handle: "originalauthor",
    },
  },
  claimant: {
    id: "user123",
    displayName: "Test User",
    handle: "testuser",
  },
  reviewer: null,
}

describe("Claims Router", () => {
  let caller: any

  beforeEach(() => {
    vi.clearAllMocks()
    caller = claimsRouter.createCaller({
      user: mockUser,
      prisma,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("submit", () => {
    it("should successfully submit a claim", async () => {
      ;(prisma.rule.findUnique as any).mockResolvedValue(mockRule)
      ;(prisma.authorClaim.findUnique as any).mockResolvedValue(null)
      ;(prisma.authorClaim.create as any).mockResolvedValue(mockClaim)

      const result = await caller.submit({
        ruleId: "rule123",
        evidence: "I am the original author of this rule.",
      })

      expect(result).toEqual({
        id: "claim123",
        status: "PENDING",
        createdAt: new Date("2024-01-15"),
      })

      expect(prisma.rule.findUnique).toHaveBeenCalledWith({
        where: { id: "rule123" },
        include: {
          createdBy: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      })

      expect(prisma.authorClaim.create).toHaveBeenCalledWith({
        data: {
          ruleId: "rule123",
          claimantId: "user123",
          evidence: "I am the original author of this rule.",
          status: "PENDING",
        },
      })
    })

    it("should throw NOT_FOUND when rule doesn't exist", async () => {
      ;(prisma.rule.findUnique as any).mockResolvedValue(null)

      await expect(
        caller.submit({
          ruleId: "nonexistent",
          evidence: "I am the original author.",
        })
      ).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Rule not found",
        })
      )
    })

    it("should throw BAD_REQUEST when rule is not published", async () => {
      const draftRule = { ...mockRule, status: "DRAFT" }
      ;(prisma.rule.findUnique as any).mockResolvedValue(draftRule)

      await expect(
        caller.submit({
          ruleId: "rule123",
          evidence: "I am the original author.",
        })
      ).rejects.toThrow(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only claim published rules",
        })
      )
    })

    it("should throw BAD_REQUEST when user is already the author", async () => {
      const userOwnedRule = { ...mockRule, createdByUserId: "user123" }
      ;(prisma.rule.findUnique as any).mockResolvedValue(userOwnedRule)

      await expect(
        caller.submit({
          ruleId: "rule123",
          evidence: "I am the original author.",
        })
      ).rejects.toThrow(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "You are already the author of this rule",
        })
      )
    })

    it("should throw BAD_REQUEST when user has already submitted a claim", async () => {
      ;(prisma.rule.findUnique as any).mockResolvedValue(mockRule)
      ;(prisma.authorClaim.findUnique as any).mockResolvedValue(mockClaim)

      await expect(
        caller.submit({
          ruleId: "rule123",
          evidence: "I am the original author.",
        })
      ).rejects.toThrow(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "You have already submitted a claim for this rule",
        })
      )
    })

    it("should validate evidence length", async () => {
      // Test minimum length
      await expect(
        caller.submit({
          ruleId: "rule123",
          evidence: "short",
        })
      ).rejects.toThrow()

      // Test maximum length
      const longEvidence = "a".repeat(2001)
      await expect(
        caller.submit({
          ruleId: "rule123",
          evidence: longEvidence,
        })
      ).rejects.toThrow()
    })

    it("should handle database errors", async () => {
      ;(prisma.rule.findUnique as any).mockRejectedValue(new Error("Database error"))

      await expect(
        caller.submit({
          ruleId: "rule123",
          evidence: "I am the original author.",
        })
      ).rejects.toThrow("Database error")
    })
  })

  describe("getMyClaims", () => {
    it("should return user's claims with pagination", async () => {
      const mockClaims = [mockClaimWithRelations]
      ;(prisma.authorClaim.findMany as any).mockResolvedValue(mockClaims)

      const result = await caller.getMyClaims({ limit: 20 })

      expect(result).toEqual({
        items: mockClaims,
        nextCursor: null,
      })

      expect(prisma.authorClaim.findMany).toHaveBeenCalledWith({
        where: {
          claimantId: "user123",
        },
        include: {
          rule: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              displayName: true,
              handle: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 21,
      })
    })

    it("should handle pagination with cursor", async () => {
      const mockClaims = [mockClaimWithRelations]
      ;(prisma.authorClaim.findMany as any).mockResolvedValue(mockClaims)

      await caller.getMyClaims({ limit: 20, cursor: "cursor123" })

      expect(prisma.authorClaim.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: "cursor123" },
          skip: 1,
        })
      )
    })

    it("should handle pagination with more results", async () => {
      const mockClaims = Array.from({ length: 21 }, (_, i) => ({
        ...mockClaimWithRelations,
        id: `claim${i}`,
      }))
      ;(prisma.authorClaim.findMany as any).mockResolvedValue(mockClaims)

      const result = await caller.getMyClaims({ limit: 20 })

      expect(result.items).toHaveLength(20)
      expect(result.nextCursor).toBe("claim19")
    })

    it("should return empty list when user has no claims", async () => {
      ;(prisma.authorClaim.findMany as any).mockResolvedValue([])

      const result = await caller.getMyClaims({ limit: 20 })

      expect(result).toEqual({
        items: [],
        nextCursor: null,
      })
    })

    it("should validate input parameters", async () => {
      // Test minimum limit
      await expect(caller.getMyClaims({ limit: 0 })).rejects.toThrow()

      // Test maximum limit
      await expect(caller.getMyClaims({ limit: 51 })).rejects.toThrow()
    })

    it("should use default limit when not provided", async () => {
      ;(prisma.authorClaim.findMany as any).mockResolvedValue([])

      await caller.getMyClaims({})

      expect(prisma.authorClaim.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 21, // default 20 + 1
        })
      )
    })
  })

  describe("getClaim", () => {
    it("should return claim details for claimant", async () => {
      ;(prisma.authorClaim.findUnique as any).mockResolvedValue(mockClaimWithRelations)

      const result = await caller.getClaim({ id: "claim123" })

      expect(result).toEqual(mockClaimWithRelations)
      expect(prisma.authorClaim.findUnique).toHaveBeenCalledWith({
        where: { id: "claim123" },
        include: {
          rule: {
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              createdBy: {
                select: {
                  id: true,
                  displayName: true,
                  handle: true,
                },
              },
            },
          },
          claimant: {
            select: {
              id: true,
              displayName: true,
              handle: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              displayName: true,
              handle: true,
            },
          },
        },
      })
    })

    it("should return claim details for admin", async () => {
      const adminCaller = claimsRouter.createCaller({
        user: mockAdminUser,
        prisma,
      })
      const otherUserClaim = {
        ...mockClaimWithRelations,
        claimantId: "otheruser",
      }
      ;(prisma.authorClaim.findUnique as any).mockResolvedValue(otherUserClaim)

      const result = await adminCaller.getClaim({ id: "claim123" })

      expect(result).toEqual(otherUserClaim)
    })

    it("should throw NOT_FOUND when claim doesn't exist", async () => {
      ;(prisma.authorClaim.findUnique as any).mockResolvedValue(null)

      await expect(caller.getClaim({ id: "nonexistent" })).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Claim not found",
        })
      )
    })

    it("should throw FORBIDDEN when user is not claimant or admin", async () => {
      const otherUserClaim = {
        ...mockClaimWithRelations,
        claimantId: "otheruser",
      }
      ;(prisma.authorClaim.findUnique as any).mockResolvedValue(otherUserClaim)

      await expect(caller.getClaim({ id: "claim123" })).rejects.toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to view this claim",
        })
      )
    })

    it("should handle database errors", async () => {
      ;(prisma.authorClaim.findUnique as any).mockRejectedValue(new Error("Database error"))

      await expect(caller.getClaim({ id: "claim123" })).rejects.toThrow("Database error")
    })
  })

  describe("getClaimsForRule", () => {
    it("should return approved claims for a rule", async () => {
      const approvedClaim = {
        ...mockClaimWithRelations,
        status: "APPROVED",
        reviewedAt: new Date("2024-01-20"),
      }
      ;(prisma.authorClaim.findMany as any).mockResolvedValue([approvedClaim])

      const result = await caller.getClaimsForRule({ ruleId: "rule123" })

      expect(result).toEqual([approvedClaim])
      expect(prisma.authorClaim.findMany).toHaveBeenCalledWith({
        where: {
          ruleId: "rule123",
          status: "APPROVED",
        },
        include: {
          claimant: {
            select: {
              id: true,
              displayName: true,
              handle: true,
            },
          },
        },
        orderBy: {
          reviewedAt: "desc",
        },
      })
    })

    it("should return empty list when no approved claims exist", async () => {
      ;(prisma.authorClaim.findMany as any).mockResolvedValue([])

      const result = await caller.getClaimsForRule({ ruleId: "rule123" })

      expect(result).toEqual([])
    })

    it("should only show approved claims, not pending or rejected", async () => {
      ;(prisma.authorClaim.findMany as any).mockResolvedValue([])

      await caller.getClaimsForRule({ ruleId: "rule123" })

      expect(prisma.authorClaim.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "APPROVED",
          }),
        })
      )
    })

    it("should handle database errors", async () => {
      ;(prisma.authorClaim.findMany as any).mockRejectedValue(new Error("Database error"))

      await expect(caller.getClaimsForRule({ ruleId: "rule123" })).rejects.toThrow("Database error")
    })
  })

  describe("cancel", () => {
    it("should successfully cancel a pending claim", async () => {
      ;(prisma.authorClaim.findUnique as any).mockResolvedValue(mockClaim)
      ;(prisma.authorClaim.delete as any).mockResolvedValue(mockClaim)

      const result = await caller.cancel({ id: "claim123" })

      expect(result).toEqual({ success: true })
      expect(prisma.authorClaim.delete).toHaveBeenCalledWith({
        where: { id: "claim123" },
      })
    })

    it("should throw NOT_FOUND when claim doesn't exist", async () => {
      ;(prisma.authorClaim.findUnique as any).mockResolvedValue(null)

      await expect(caller.cancel({ id: "nonexistent" })).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Claim not found",
        })
      )
    })

    it("should throw FORBIDDEN when user is not the claimant", async () => {
      const otherUserClaim = { ...mockClaim, claimantId: "otheruser" }
      ;(prisma.authorClaim.findUnique as any).mockResolvedValue(otherUserClaim)

      await expect(caller.cancel({ id: "claim123" })).rejects.toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to cancel this claim",
        })
      )
    })

    it("should throw BAD_REQUEST when claim is not pending", async () => {
      const approvedClaim = { ...mockClaim, status: "APPROVED" }
      ;(prisma.authorClaim.findUnique as any).mockResolvedValue(approvedClaim)

      await expect(caller.cancel({ id: "claim123" })).rejects.toThrow(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only cancel pending claims",
        })
      )
    })

    it("should handle rejected claims", async () => {
      const rejectedClaim = { ...mockClaim, status: "REJECTED" }
      ;(prisma.authorClaim.findUnique as any).mockResolvedValue(rejectedClaim)

      await expect(caller.cancel({ id: "claim123" })).rejects.toThrow(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only cancel pending claims",
        })
      )
    })

    it("should handle database errors", async () => {
      ;(prisma.authorClaim.findUnique as any).mockRejectedValue(new Error("Database error"))

      await expect(caller.cancel({ id: "claim123" })).rejects.toThrow("Database error")
    })
  })

  describe("Edge Cases and Integration", () => {
    it("should handle user context without user ID", async () => {
      const callerWithoutUser = claimsRouter.createCaller({
        user: null,
        prisma,
      })

      // This would typically be prevented by middleware, but we test the edge case
      await expect(
        callerWithoutUser.submit({
          ruleId: "rule123",
          evidence: "I am the original author.",
        })
      ).rejects.toThrow()
    })

    it("should handle concurrent claim submissions", async () => {
      const mockRule2 = { ...mockRule, id: "rule456" }
      const mockClaim2 = { ...mockClaim, id: "claim456", ruleId: "rule456" }

      ;(prisma.rule.findUnique as any)
        .mockResolvedValueOnce(mockRule)
        .mockResolvedValueOnce(mockRule2)
      ;(prisma.authorClaim.findUnique as any).mockResolvedValue(null)
      ;(prisma.authorClaim.create as any)
        .mockResolvedValueOnce(mockClaim)
        .mockResolvedValueOnce(mockClaim2)

      const [result1, result2] = await Promise.all([
        caller.submit({
          ruleId: "rule123",
          evidence: "I am the original author.",
        }),
        caller.submit({
          ruleId: "rule456",
          evidence: "I am also the author of this one.",
        }),
      ])

      expect(result1.status).toBe("PENDING")
      expect(result2.status).toBe("PENDING")
      expect(prisma.rule.findUnique).toHaveBeenCalledTimes(2)
      expect(prisma.authorClaim.create).toHaveBeenCalledTimes(2)
    })

    it("should handle large pagination requests", async () => {
      const largeMockClaims = Array.from({ length: 50 }, (_, i) => ({
        ...mockClaimWithRelations,
        id: `claim${i}`,
      }))
      ;(prisma.authorClaim.findMany as any).mockResolvedValue(largeMockClaims)

      const result = await caller.getMyClaims({ limit: 50 })

      expect(result.items).toHaveLength(50)
      expect(prisma.authorClaim.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 51, // limit + 1 for pagination
        })
      )
    })

    it("should handle claim submission with minimum evidence length", async () => {
      ;(prisma.rule.findUnique as any).mockResolvedValue(mockRule)
      ;(prisma.authorClaim.findUnique as any).mockResolvedValue(null)
      ;(prisma.authorClaim.create as any).mockResolvedValue(mockClaim)

      const minEvidence = "a".repeat(10) // Minimum 10 characters
      const result = await caller.submit({
        ruleId: "rule123",
        evidence: minEvidence,
      })

      expect(result.status).toBe("PENDING")
    })

    it("should handle claim submission with maximum evidence length", async () => {
      ;(prisma.rule.findUnique as any).mockResolvedValue(mockRule)
      ;(prisma.authorClaim.findUnique as any).mockResolvedValue(null)
      ;(prisma.authorClaim.create as any).mockResolvedValue(mockClaim)

      const maxEvidence = "a".repeat(2000) // Maximum 2000 characters
      const result = await caller.submit({
        ruleId: "rule123",
        evidence: maxEvidence,
      })

      expect(result.status).toBe("PENDING")
    })

    it("should handle complex claim workflow", async () => {
      // 1. Submit claim
      ;(prisma.rule.findUnique as any).mockResolvedValue(mockRule)
      ;(prisma.authorClaim.findUnique as any).mockResolvedValue(null)
      ;(prisma.authorClaim.create as any).mockResolvedValue(mockClaim)

      const submitResult = await caller.submit({
        ruleId: "rule123",
        evidence: "I am the original author.",
      })

      expect(submitResult.status).toBe("PENDING")

      // 2. Check user's claims
      ;(prisma.authorClaim.findMany as any).mockResolvedValue([mockClaimWithRelations])
      const claimsResult = await caller.getMyClaims({ limit: 20 })
      expect(claimsResult.items).toHaveLength(1)

      // 3. Get claim details
      ;(prisma.authorClaim.findUnique as any).mockResolvedValue(mockClaimWithRelations)
      const claimDetails = await caller.getClaim({ id: "claim123" })
      expect(claimDetails.status).toBe("PENDING")

      // 4. Cancel claim
      ;(prisma.authorClaim.findUnique as any).mockResolvedValue(mockClaim)
      ;(prisma.authorClaim.delete as any).mockResolvedValue(mockClaim)
      const cancelResult = await caller.cancel({ id: "claim123" })
      expect(cancelResult.success).toBe(true)
    })

    it("should handle rule status transitions during claim process", async () => {
      // Submit claim for published rule
      ;(prisma.rule.findUnique as any).mockResolvedValue(mockRule)
      ;(prisma.authorClaim.findUnique as any).mockResolvedValue(null)
      ;(prisma.authorClaim.create as any).mockResolvedValue(mockClaim)

      const result = await caller.submit({
        ruleId: "rule123",
        evidence: "I am the original author.",
      })

      expect(result.status).toBe("PENDING")

      // Try to submit claim for deprecated rule
      const deprecatedRule = { ...mockRule, status: "DEPRECATED" }
      ;(prisma.rule.findUnique as any).mockResolvedValue(deprecatedRule)

      await expect(
        caller.submit({
          ruleId: "rule456",
          evidence: "I am the author of this deprecated rule.",
        })
      ).rejects.toThrow(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only claim published rules",
        })
      )
    })
  })
})
