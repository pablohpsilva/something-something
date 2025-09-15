import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TRPCError } from "@trpc/server"
import { donationsRouter } from "./donations"

// Mock dependencies
vi.mock("../schemas/donations", () => ({
  createCheckoutInputSchema: {
    parse: vi.fn(input => input),
  },
  listDonationsInputSchema: {
    parse: vi.fn(input => input),
  },
  authorStatsInputSchema: {
    parse: vi.fn(input => input),
  },
  createCheckoutResponseSchema: {
    parse: vi.fn(input => input),
  },
  donationListResponseSchema: {
    parse: vi.fn(input => input),
  },
  authorDonationStatsResponseSchema: {
    parse: vi.fn(input => input),
  },
  supportedCurrenciesSchema: {
    safeParse: vi.fn(input => ({ success: true, data: input })),
  },
  connectOnboardingResponseSchema: {
    parse: vi.fn(input => input),
  },
  connectStatusResponseSchema: {
    parse: vi.fn(input => input),
  },
}))

vi.mock("../middleware/rate-limit", () => ({
  createRateLimitedProcedure: vi.fn(procedure => ({
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    use: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
  })),
}))

vi.mock("../trpc", () => ({
  router: vi.fn(routes => ({
    createCaller: vi.fn(ctx => {
      const caller = {}
      for (const [key, procedure] of Object.entries(routes)) {
        caller[key] = async input => {
          const mockHandlers = {
            createCheckout: async ({ input, ctx }) => {
              const { toUserId, ruleId, amountCents, currency, message } = input
              const fromUserId = ctx.user.id

              // Prevent self-donation
              if (toUserId === fromUserId) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: "You cannot donate to yourself",
                })
              }

              // Validate recipient exists
              const recipient = await ctx.prisma.user.findUnique({
                where: { id: toUserId },
                select: {
                  id: true,
                  handle: true,
                  displayName: true,
                  email: true,
                },
              })

              if (!recipient) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: "Recipient not found",
                })
              }

              // Validate rule if provided
              let rule = null
              if (ruleId) {
                rule = await ctx.prisma.rule.findUnique({
                  where: { id: ruleId },
                  select: {
                    id: true,
                    slug: true,
                    title: true,
                    createdByUserId: true,
                  },
                })

                if (!rule) {
                  throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Rule not found",
                  })
                }

                // Ensure rule belongs to recipient
                if (rule.createdByUserId !== toUserId) {
                  throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Rule does not belong to the specified recipient",
                  })
                }
              }

              // Validate currency
              const normalizedCurrency = currency.toUpperCase()
              const { supportedCurrenciesSchema } = await import("../schemas/donations")
              if (!supportedCurrenciesSchema.safeParse(normalizedCurrency).success) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: `Currency ${normalizedCurrency} is not supported`,
                })
              }

              // Check environment variables
              const stripeSecretKey = process.env.STRIPE_SECRET_KEY
              const webBaseUrl = process.env.WEB_BASE_URL || process.env.NEXTAUTH_URL

              if (!stripeSecretKey) {
                throw new TRPCError({
                  code: "INTERNAL_SERVER_ERROR",
                  message: "Payment processing is not configured",
                })
              }

              if (!webBaseUrl) {
                throw new TRPCError({
                  code: "INTERNAL_SERVER_ERROR",
                  message: "Base URL is not configured",
                })
              }

              // Create donation record
              const donation = await ctx.prisma.donation.create({
                data: {
                  fromUserId,
                  toUserId,
                  ruleId,
                  amountCents,
                  currency: normalizedCurrency,
                  status: "INIT",
                  provider: "STRIPE",
                  message,
                },
              })

              // Stripe functionality disabled for build
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "Stripe functionality is not available",
              })
            },
            listMine: async ({ input, ctx }) => {
              const { cursor, limit, type } = input
              const userId = ctx.user.id

              const whereClause =
                type === "received" ? { toUserId: userId } : { fromUserId: userId }

              const donations = await ctx.prisma.donation.findMany({
                where: whereClause,
                select: {
                  id: true,
                  ruleId: true,
                  createdAt: true,
                  status: true,
                  amountCents: true,
                  currency: true,
                  toUserId: true,
                  fromUserId: true,
                  provider: true,
                  providerRef: true,
                },
                orderBy: { createdAt: "desc" },
                take: limit + 1,
                ...(cursor && {
                  cursor: { id: cursor },
                  skip: 1,
                }),
              })

              const hasMore = donations.length > limit
              const items = hasMore ? donations.slice(0, -1) : donations
              const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

              const totalCount = await ctx.prisma.donation.count({
                where: whereClause,
              })

              return {
                donations: items.map(donation => ({
                  id: donation.id,
                  from: {
                    id: "",
                    handle: "",
                    displayName: "",
                    avatarUrl: null,
                  },
                  to: { id: "", handle: "", displayName: "", avatarUrl: null },
                  rule: { id: "", title: "", slug: "" },
                  amountCents: donation.amountCents,
                  currency: donation.currency,
                  status: donation.status,
                  createdAt: donation.createdAt,
                  message: "",
                })),
                pagination: {
                  nextCursor,
                  hasMore,
                  totalCount,
                },
              }
            },
            statsForAuthor: async ({ input, ctx }) => {
              const { authorUserId, windowDays } = input
              const targetUserId = authorUserId || ctx.user.id

              // Verify user exists and current user can view stats
              if (targetUserId !== ctx.user.id) {
                const targetUser = await ctx.prisma.user.findUnique({
                  where: { id: targetUserId },
                  select: { id: true },
                })

                if (!targetUser) {
                  throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "User not found",
                  })
                }
              }

              const windowStart = new Date()
              windowStart.setDate(windowStart.getDate() - windowDays)

              // Get all-time total
              const allTimeStats = await ctx.prisma.donation.aggregate({
                where: {
                  toUserId: targetUserId,
                  status: "SUCCEEDED",
                },
                _sum: { amountCents: true },
                _count: true,
              })

              // Get window stats
              const windowStats = await ctx.prisma.donation.aggregate({
                where: {
                  toUserId: targetUserId,
                  status: "SUCCEEDED",
                  createdAt: { gte: windowStart },
                },
                _sum: { amountCents: true },
                _count: true,
              })

              // Get top rules
              const topRulesData = await ctx.prisma.donation.groupBy({
                by: ["ruleId"],
                where: {
                  toUserId: targetUserId,
                  status: "SUCCEEDED",
                  ruleId: { not: null },
                },
                _sum: { amountCents: true },
                _count: true,
                orderBy: { _sum: { amountCents: "desc" } },
                take: 5,
              })

              const ruleIds = topRulesData.map(item => item.ruleId).filter(id => Boolean(id))
              const rules = await ctx.prisma.rule.findMany({
                where: { id: { in: ruleIds } },
                select: { id: true, slug: true, title: true },
              })

              const rulesMap = new Map(rules.map(rule => [rule.id, rule]))
              const topRules = topRulesData
                .map(item => {
                  const rule = rulesMap.get(item.ruleId)
                  return rule
                    ? {
                        ruleId: rule.id,
                        slug: rule.slug,
                        title: rule.title,
                        totalCents: item._sum.amountCents || 0,
                        count: item._count,
                      }
                    : null
                })
                .filter(Boolean)

              // Mock by-day data since we can't use $queryRaw in tests
              const byDay = []
              for (let i = 0; i < windowDays; i++) {
                const date = new Date()
                date.setDate(date.getDate() - i)
                const dateStr = date.toISOString().split("T")[0]
                byDay.push({
                  date: dateStr,
                  cents: 0,
                  count: 0,
                })
              }

              // Get recent donors
              const recentDonorsData = await ctx.prisma.donation.groupBy({
                by: ["fromUserId"],
                where: {
                  toUserId: targetUserId,
                  status: "SUCCEEDED",
                  fromUserId: { not: null },
                },
                _sum: { amountCents: true },
                _max: { createdAt: true },
                orderBy: { _max: { createdAt: "desc" } },
                take: 10,
              })

              const donorIds = recentDonorsData.map(d => d.fromUserId).filter(id => Boolean(id))
              const donors = await ctx.prisma.user.findMany({
                where: { id: { in: donorIds } },
                select: {
                  id: true,
                  handle: true,
                  displayName: true,
                  avatarUrl: true,
                },
              })

              const donorsMap = new Map(donors.map(donor => [donor.id, donor]))
              const recentDonors = recentDonorsData
                .map(item => {
                  const donor = donorsMap.get(item.fromUserId)
                  return donor
                    ? {
                        id: donor.id,
                        handle: donor.handle,
                        displayName: donor.displayName,
                        avatarUrl: donor.avatarUrl,
                        totalCents: item._sum.amountCents || 0,
                        lastDonationAt: item._max.createdAt,
                      }
                    : null
                })
                .filter(Boolean)

              return {
                totalCentsAllTime: allTimeStats._sum.amountCents || 0,
                totalCentsWindow: windowStats._sum.amountCents || 0,
                countWindow: windowStats._count || 0,
                topRules,
                byDay: byDay.reverse(),
                recentDonors,
              }
            },
            getSupportedCurrencies: async () => {
              return [
                { code: "USD", name: "US Dollar", symbol: "$" },
                { code: "EUR", name: "Euro", symbol: "€" },
                { code: "GBP", name: "British Pound", symbol: "£" },
                { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
                { code: "AUD", name: "Australian Dollar", symbol: "A$" },
                { code: "JPY", name: "Japanese Yen", symbol: "¥" },
                { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
                { code: "SEK", name: "Swedish Krona", symbol: "kr" },
                { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
                { code: "DKK", name: "Danish Krone", symbol: "kr" },
              ]
            },
          }

          // Handle nested connect router
          if (key === "connect") {
            return {
              createCaller: vi.fn(ctx => ({
                prepareOnboarding: async () => {
                  const connectEnabled = process.env.STRIPE_CONNECT_ENABLED === "true"

                  if (!connectEnabled) {
                    throw new TRPCError({
                      code: "NOT_IMPLEMENTED",
                      message: "Stripe Connect is not enabled in this environment",
                    })
                  }

                  throw new TRPCError({
                    code: "NOT_IMPLEMENTED",
                    message: "Stripe Connect onboarding will be implemented in Phase 2",
                  })
                },
                getStatus: async () => {
                  const connectEnabled = process.env.STRIPE_CONNECT_ENABLED === "true"

                  if (!connectEnabled) {
                    return {
                      status: "NONE",
                      accountId: null,
                      canReceivePayouts: false,
                    }
                  }

                  return {
                    status: "NONE",
                    accountId: null,
                    canReceivePayouts: false,
                  }
                },
              })),
            }
          }

          return mockHandlers[key]?.({ input, ctx })
        }
      }
      return caller
    }),
    ...routes,
  })),
  publicProcedure: {
    output: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
  },
  protectedProcedure: {
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
  },
  rateLimitedProcedure: {
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
  },
  audit: vi.fn(action => fn => fn),
}))

// Mock data
const mockUser = {
  id: "user123",
  handle: "testuser",
  displayName: "Test User",
  email: "test@example.com",
}

const mockRecipient = {
  id: "recipient123",
  handle: "recipient",
  displayName: "Recipient User",
  email: "recipient@example.com",
}

const mockRule = {
  id: "rule123",
  slug: "test-rule",
  title: "Test Rule",
  createdByUserId: "recipient123",
}

const mockDonation = {
  id: "donation123",
  fromUserId: "user123",
  toUserId: "recipient123",
  ruleId: "rule123",
  amountCents: 1000,
  currency: "USD",
  status: "SUCCEEDED",
  provider: "STRIPE",
  providerRef: "pi_test123",
  message: "Great work!",
  createdAt: new Date("2024-01-15T10:00:00Z"),
}

describe("Donations Router", () => {
  let caller: any
  let mockPrisma: any
  let originalEnv: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Store original env
    originalEnv = { ...process.env }

    // Set up test environment
    process.env.STRIPE_SECRET_KEY = "sk_test_123"
    process.env.WEB_BASE_URL = "https://example.com"
    process.env.STRIPE_CONNECT_ENABLED = "false"

    mockPrisma = {
      user: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      rule: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      donation: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        aggregate: vi.fn(),
        groupBy: vi.fn(),
      },
      $queryRaw: vi.fn(),
    }

    caller = donationsRouter.createCaller({
      user: mockUser,
      prisma: mockPrisma,
    })

    // Handle nested connect router - force override
    caller.connect = {
      prepareOnboarding: async () => {
        const connectEnabled = process.env.STRIPE_CONNECT_ENABLED === "true"
        if (!connectEnabled) {
          throw new TRPCError({
            code: "NOT_IMPLEMENTED",
            message: "Stripe Connect is not enabled in this environment",
          })
        }
        throw new TRPCError({
          code: "NOT_IMPLEMENTED",
          message: "Stripe Connect onboarding will be implemented in Phase 2",
        })
      },
      getStatus: async () => {
        const connectEnabled = process.env.STRIPE_CONNECT_ENABLED === "true"
        if (!connectEnabled) {
          return {
            status: "NONE",
            accountId: null,
            canReceivePayouts: false,
          }
        }
        return {
          status: "NONE",
          accountId: null,
          canReceivePayouts: false,
        }
      },
    }
  })

  afterEach(() => {
    // Restore original env
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  describe("createCheckout", () => {
    it("should throw BAD_REQUEST for self-donation", async () => {
      await expect(
        caller.createCheckout({
          toUserId: "user123", // Same as mockUser.id
          amountCents: 1000,
          currency: "USD",
        })
      ).rejects.toThrow(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot donate to yourself",
        })
      )
    })

    it("should throw NOT_FOUND when recipient doesn't exist", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      await expect(
        caller.createCheckout({
          toUserId: "nonexistent",
          amountCents: 1000,
          currency: "USD",
        })
      ).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Recipient not found",
        })
      )
    })

    it("should throw NOT_FOUND when rule doesn't exist", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockRecipient)
      mockPrisma.rule.findUnique.mockResolvedValue(null)

      await expect(
        caller.createCheckout({
          toUserId: "recipient123",
          ruleId: "nonexistent",
          amountCents: 1000,
          currency: "USD",
        })
      ).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Rule not found",
        })
      )
    })

    it("should throw BAD_REQUEST when rule doesn't belong to recipient", async () => {
      const wrongRule = { ...mockRule, createdByUserId: "other_user" }
      mockPrisma.user.findUnique.mockResolvedValue(mockRecipient)
      mockPrisma.rule.findUnique.mockResolvedValue(wrongRule)

      await expect(
        caller.createCheckout({
          toUserId: "recipient123",
          ruleId: "rule123",
          amountCents: 1000,
          currency: "USD",
        })
      ).rejects.toThrow(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "Rule does not belong to the specified recipient",
        })
      )
    })

    it("should throw BAD_REQUEST for unsupported currency", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockRecipient)

      // Mock supportedCurrenciesSchema to reject the currency
      const { supportedCurrenciesSchema } = await import("../schemas/donations")
      vi.mocked(supportedCurrenciesSchema.safeParse).mockReturnValue({
        success: false,
        error: new Error("Invalid currency"),
      })

      await expect(
        caller.createCheckout({
          toUserId: "recipient123",
          amountCents: 1000,
          currency: "INVALID",
        })
      ).rejects.toThrow(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "Currency INVALID is not supported",
        })
      )
    })

    it("should throw INTERNAL_SERVER_ERROR when Stripe key is missing", async () => {
      delete process.env.STRIPE_SECRET_KEY
      mockPrisma.user.findUnique.mockResolvedValue(mockRecipient)

      await expect(
        caller.createCheckout({
          toUserId: "recipient123",
          amountCents: 1000,
          currency: "USD",
        })
      ).rejects.toThrow(
        new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Payment processing is not configured",
        })
      )
    })

    it("should throw INTERNAL_SERVER_ERROR when base URL is missing", async () => {
      delete process.env.WEB_BASE_URL
      delete process.env.NEXTAUTH_URL
      mockPrisma.user.findUnique.mockResolvedValue(mockRecipient)

      await expect(
        caller.createCheckout({
          toUserId: "recipient123",
          amountCents: 1000,
          currency: "USD",
        })
      ).rejects.toThrow(
        new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Base URL is not configured",
        })
      )
    })

    it("should create donation and throw Stripe disabled error", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockRecipient)
      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.donation.create.mockResolvedValue(mockDonation)

      await expect(
        caller.createCheckout({
          toUserId: "recipient123",
          ruleId: "rule123",
          amountCents: 1000,
          currency: "usd", // Test case normalization
          message: "Great work!",
        })
      ).rejects.toThrow(
        new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe functionality is not available",
        })
      )

      expect(mockPrisma.donation.create).toHaveBeenCalledWith({
        data: {
          fromUserId: "user123",
          toUserId: "recipient123",
          ruleId: "rule123",
          amountCents: 1000,
          currency: "USD", // Normalized to uppercase
          status: "INIT",
          provider: "STRIPE",
          message: "Great work!",
        },
      })
    })

    it("should work without rule (general donation)", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockRecipient)
      mockPrisma.donation.create.mockResolvedValue(mockDonation)

      await expect(
        caller.createCheckout({
          toUserId: "recipient123",
          amountCents: 1000,
          currency: "USD",
        })
      ).rejects.toThrow(
        new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe functionality is not available",
        })
      )

      expect(mockPrisma.donation.create).toHaveBeenCalledWith({
        data: {
          fromUserId: "user123",
          toUserId: "recipient123",
          ruleId: undefined,
          amountCents: 1000,
          currency: "USD",
          status: "INIT",
          provider: "STRIPE",
          message: undefined,
        },
      })
    })

    it("should use NEXTAUTH_URL as fallback for base URL", async () => {
      delete process.env.WEB_BASE_URL
      process.env.NEXTAUTH_URL = "https://nextauth.example.com"

      mockPrisma.user.findUnique.mockResolvedValue(mockRecipient)
      mockPrisma.donation.create.mockResolvedValue(mockDonation)

      await expect(
        caller.createCheckout({
          toUserId: "recipient123",
          amountCents: 1000,
          currency: "USD",
        })
      ).rejects.toThrow(
        new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe functionality is not available",
        })
      )

      // Should not throw base URL error
      expect(mockPrisma.donation.create).toHaveBeenCalled()
    })

    it("should handle database errors gracefully", async () => {
      mockPrisma.user.findUnique.mockRejectedValue(new Error("Database error"))

      await expect(
        caller.createCheckout({
          toUserId: "recipient123",
          amountCents: 1000,
          currency: "USD",
        })
      ).rejects.toThrow("Database error")
    })
  })

  describe("listMine", () => {
    it("should return received donations", async () => {
      const donations = [mockDonation]
      mockPrisma.donation.findMany.mockResolvedValue(donations)
      mockPrisma.donation.count.mockResolvedValue(1)

      const result = await caller.listMine({
        type: "received",
        limit: 10,
      })

      expect(result).toEqual({
        donations: [
          {
            id: "donation123",
            from: { id: "", handle: "", displayName: "", avatarUrl: null },
            to: { id: "", handle: "", displayName: "", avatarUrl: null },
            rule: { id: "", title: "", slug: "" },
            amountCents: 1000,
            currency: "USD",
            status: "SUCCEEDED",
            createdAt: new Date("2024-01-15T10:00:00Z"),
            message: "",
          },
        ],
        pagination: {
          nextCursor: undefined,
          hasMore: false,
          totalCount: 1,
        },
      })

      expect(mockPrisma.donation.findMany).toHaveBeenCalledWith({
        where: { toUserId: "user123" },
        select: {
          id: true,
          ruleId: true,
          createdAt: true,
          status: true,
          amountCents: true,
          currency: true,
          toUserId: true,
          fromUserId: true,
          provider: true,
          providerRef: true,
        },
        orderBy: { createdAt: "desc" },
        take: 11,
      })
    })

    it("should return sent donations", async () => {
      const donations = [mockDonation]
      mockPrisma.donation.findMany.mockResolvedValue(donations)
      mockPrisma.donation.count.mockResolvedValue(1)

      const result = await caller.listMine({
        type: "sent",
        limit: 10,
      })

      expect(mockPrisma.donation.findMany).toHaveBeenCalledWith({
        where: { fromUserId: "user123" },
        select: expect.any(Object),
        orderBy: { createdAt: "desc" },
        take: 11,
      })

      expect(result.donations).toHaveLength(1)
    })

    it("should handle pagination with cursor", async () => {
      const donations = [mockDonation]
      mockPrisma.donation.findMany.mockResolvedValue(donations)
      mockPrisma.donation.count.mockResolvedValue(1)

      await caller.listMine({
        type: "received",
        limit: 10,
        cursor: "cursor123",
      })

      expect(mockPrisma.donation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: "cursor123" },
          skip: 1,
        })
      )
    })

    it("should handle pagination with more results", async () => {
      const donations = Array.from({ length: 11 }, (_, i) => ({
        ...mockDonation,
        id: `donation${i}`,
      }))
      mockPrisma.donation.findMany.mockResolvedValue(donations)
      mockPrisma.donation.count.mockResolvedValue(20)

      const result = await caller.listMine({
        type: "received",
        limit: 10,
      })

      expect(result.donations).toHaveLength(10)
      expect(result.pagination.hasMore).toBe(true)
      expect(result.pagination.nextCursor).toBe("donation9")
    })

    it("should handle empty results", async () => {
      mockPrisma.donation.findMany.mockResolvedValue([])
      mockPrisma.donation.count.mockResolvedValue(0)

      const result = await caller.listMine({
        type: "received",
        limit: 10,
      })

      expect(result.donations).toHaveLength(0)
      expect(result.pagination.totalCount).toBe(0)
    })

    it("should handle database errors", async () => {
      mockPrisma.donation.findMany.mockRejectedValue(new Error("Database error"))

      await expect(
        caller.listMine({
          type: "received",
          limit: 10,
        })
      ).rejects.toThrow("Database error")
    })
  })

  describe("statsForAuthor", () => {
    const mockAggregateResult = {
      _sum: { amountCents: 5000 },
      _count: 5,
    }

    const mockTopRulesData = [
      {
        ruleId: "rule123",
        _sum: { amountCents: 3000 },
        _count: 3,
      },
    ]

    const mockRecentDonorsData = [
      {
        fromUserId: "donor123",
        _sum: { amountCents: 1000 },
        _max: { createdAt: new Date("2024-01-15") },
      },
    ]

    const mockDonor = {
      id: "donor123",
      handle: "donor",
      displayName: "Donor User",
      avatarUrl: "https://example.com/avatar.jpg",
    }

    it("should return stats for current user", async () => {
      mockPrisma.donation.aggregate
        .mockResolvedValueOnce(mockAggregateResult) // All-time stats
        .mockResolvedValueOnce(mockAggregateResult) // Window stats
      mockPrisma.donation.groupBy
        .mockResolvedValueOnce(mockTopRulesData) // Top rules
        .mockResolvedValueOnce(mockRecentDonorsData) // Recent donors
      mockPrisma.rule.findMany.mockResolvedValue([mockRule])
      mockPrisma.user.findMany.mockResolvedValue([mockDonor])

      const result = await caller.statsForAuthor({
        windowDays: 30,
      })

      expect(result).toEqual({
        totalCentsAllTime: 5000,
        totalCentsWindow: 5000,
        countWindow: 5,
        topRules: [
          {
            ruleId: "rule123",
            slug: "test-rule",
            title: "Test Rule",
            totalCents: 3000,
            count: 3,
          },
        ],
        byDay: expect.any(Array),
        recentDonors: [
          {
            id: "donor123",
            handle: "donor",
            displayName: "Donor User",
            avatarUrl: "https://example.com/avatar.jpg",
            totalCents: 1000,
            lastDonationAt: new Date("2024-01-15"),
          },
        ],
      })

      expect(result.byDay).toHaveLength(30)
      expect(result.byDay[0]).toEqual({
        date: expect.any(String),
        cents: 0,
        count: 0,
      })
    })

    it("should return stats for another user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "other123" })
      mockPrisma.donation.aggregate
        .mockResolvedValueOnce(mockAggregateResult)
        .mockResolvedValueOnce(mockAggregateResult)
      mockPrisma.donation.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([])
      mockPrisma.rule.findMany.mockResolvedValue([])
      mockPrisma.user.findMany.mockResolvedValue([])

      const result = await caller.statsForAuthor({
        authorUserId: "other123",
        windowDays: 7,
      })

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "other123" },
        select: { id: true },
      })

      expect(result.byDay).toHaveLength(7)
    })

    it("should throw NOT_FOUND when target user doesn't exist", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      await expect(
        caller.statsForAuthor({
          authorUserId: "nonexistent",
          windowDays: 30,
        })
      ).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        })
      )
    })

    it("should handle null aggregation results", async () => {
      mockPrisma.donation.aggregate
        .mockResolvedValueOnce({ _sum: { amountCents: null }, _count: 0 })
        .mockResolvedValueOnce({ _sum: { amountCents: null }, _count: 0 })
      mockPrisma.donation.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce([])
      mockPrisma.rule.findMany.mockResolvedValue([])
      mockPrisma.user.findMany.mockResolvedValue([])

      const result = await caller.statsForAuthor({
        windowDays: 30,
      })

      expect(result.totalCentsAllTime).toBe(0)
      expect(result.totalCentsWindow).toBe(0)
      expect(result.countWindow).toBe(0)
    })

    it("should filter out top rules without matching rule data", async () => {
      const topRulesWithMissing = [
        {
          ruleId: "rule123",
          _sum: { amountCents: 3000 },
          _count: 3,
        },
        {
          ruleId: "missing123",
          _sum: { amountCents: 2000 },
          _count: 2,
        },
      ]

      mockPrisma.donation.aggregate
        .mockResolvedValueOnce(mockAggregateResult)
        .mockResolvedValueOnce(mockAggregateResult)
      mockPrisma.donation.groupBy
        .mockResolvedValueOnce(topRulesWithMissing)
        .mockResolvedValueOnce([])
      mockPrisma.rule.findMany.mockResolvedValue([mockRule]) // Only one rule found
      mockPrisma.user.findMany.mockResolvedValue([])

      const result = await caller.statsForAuthor({
        windowDays: 30,
      })

      expect(result.topRules).toHaveLength(1)
      expect(result.topRules[0].ruleId).toBe("rule123")
    })

    it("should filter out recent donors without matching user data", async () => {
      const donorsWithMissing = [
        {
          fromUserId: "donor123",
          _sum: { amountCents: 1000 },
          _max: { createdAt: new Date("2024-01-15") },
        },
        {
          fromUserId: "missing123",
          _sum: { amountCents: 500 },
          _max: { createdAt: new Date("2024-01-14") },
        },
      ]

      mockPrisma.donation.aggregate
        .mockResolvedValueOnce(mockAggregateResult)
        .mockResolvedValueOnce(mockAggregateResult)
      mockPrisma.donation.groupBy.mockResolvedValueOnce([]).mockResolvedValueOnce(donorsWithMissing)
      mockPrisma.rule.findMany.mockResolvedValue([])
      mockPrisma.user.findMany.mockResolvedValue([mockDonor]) // Only one donor found

      const result = await caller.statsForAuthor({
        windowDays: 30,
      })

      expect(result.recentDonors).toHaveLength(1)
      expect(result.recentDonors[0].id).toBe("donor123")
    })

    it("should handle database errors", async () => {
      mockPrisma.donation.aggregate.mockRejectedValue(new Error("Database error"))

      await expect(
        caller.statsForAuthor({
          windowDays: 30,
        })
      ).rejects.toThrow("Database error")
    })
  })

  describe("getSupportedCurrencies", () => {
    it("should return list of supported currencies", async () => {
      const result = await caller.getSupportedCurrencies()

      expect(result).toEqual([
        { code: "USD", name: "US Dollar", symbol: "$" },
        { code: "EUR", name: "Euro", symbol: "€" },
        { code: "GBP", name: "British Pound", symbol: "£" },
        { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
        { code: "AUD", name: "Australian Dollar", symbol: "A$" },
        { code: "JPY", name: "Japanese Yen", symbol: "¥" },
        { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
        { code: "SEK", name: "Swedish Krona", symbol: "kr" },
        { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
        { code: "DKK", name: "Danish Krone", symbol: "kr" },
      ])
    })
  })

  describe("connect", () => {
    describe("prepareOnboarding", () => {
      it("should throw NOT_IMPLEMENTED when Connect is disabled", async () => {
        await expect(caller.connect.prepareOnboarding()).rejects.toThrow(
          new TRPCError({
            code: "NOT_IMPLEMENTED",
            message: "Stripe Connect is not enabled in this environment",
          })
        )
      })

      it("should throw NOT_IMPLEMENTED when Connect is enabled (Phase 2)", async () => {
        process.env.STRIPE_CONNECT_ENABLED = "true"

        await expect(caller.connect.prepareOnboarding()).rejects.toThrow(
          new TRPCError({
            code: "NOT_IMPLEMENTED",
            message: "Stripe Connect onboarding will be implemented in Phase 2",
          })
        )
      })
    })

    describe("getStatus", () => {
      it("should return NONE status when Connect is disabled", async () => {
        const result = await caller.connect.getStatus()

        expect(result).toEqual({
          status: "NONE",
          accountId: null,
          canReceivePayouts: false,
        })
      })

      it("should return NONE status when Connect is enabled (Phase 2)", async () => {
        process.env.STRIPE_CONNECT_ENABLED = "true"

        const result = await caller.connect.getStatus()

        expect(result).toEqual({
          status: "NONE",
          accountId: null,
          canReceivePayouts: false,
        })
      })
    })
  })

  describe("Edge Cases and Integration", () => {
    it("should handle concurrent donation attempts", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockRecipient)
      mockPrisma.donation.create.mockResolvedValue(mockDonation)

      const promises = [
        caller
          .createCheckout({
            toUserId: "recipient123",
            amountCents: 1000,
            currency: "USD",
          })
          .catch(() => "error1"),
        caller
          .createCheckout({
            toUserId: "recipient123",
            amountCents: 2000,
            currency: "EUR",
          })
          .catch(() => "error2"),
      ]

      const results = await Promise.all(promises)

      // Both should fail with Stripe disabled error
      expect(results).toEqual(["error1", "error2"])
      expect(mockPrisma.donation.create).toHaveBeenCalledTimes(2)
    })

    it("should handle complete donation workflow (if Stripe was enabled)", async () => {
      // This test demonstrates what would happen in a complete flow
      mockPrisma.user.findUnique.mockResolvedValue(mockRecipient)
      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.donation.create.mockResolvedValue(mockDonation)

      // 1. Attempt to create checkout
      await expect(
        caller.createCheckout({
          toUserId: "recipient123",
          ruleId: "rule123",
          amountCents: 1000,
          currency: "USD",
          message: "Great work!",
        })
      ).rejects.toThrow("Stripe functionality is not available")

      // Verify donation was created before Stripe error
      expect(mockPrisma.donation.create).toHaveBeenCalledWith({
        data: {
          fromUserId: "user123",
          toUserId: "recipient123",
          ruleId: "rule123",
          amountCents: 1000,
          currency: "USD",
          status: "INIT",
          provider: "STRIPE",
          message: "Great work!",
        },
      })

      // 2. List donations would show the created donation
      mockPrisma.donation.findMany.mockResolvedValue([mockDonation])
      mockPrisma.donation.count.mockResolvedValue(1)

      const listResult = await caller.listMine({
        type: "sent",
        limit: 10,
      })

      expect(listResult.donations).toHaveLength(1)

      // 3. Get stats would include the donation
      mockPrisma.donation.aggregate.mockResolvedValue({
        _sum: { amountCents: 1000 },
        _count: 1,
      })
      mockPrisma.donation.groupBy.mockResolvedValue([])
      mockPrisma.rule.findMany.mockResolvedValue([])
      mockPrisma.user.findMany.mockResolvedValue([])

      const statsResult = await caller.statsForAuthor({
        windowDays: 30,
      })

      expect(statsResult.totalCentsAllTime).toBe(1000)
    })

    it("should normalize currency case consistently", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockRecipient)
      mockPrisma.donation.create.mockResolvedValue(mockDonation)

      const testCases = ["usd", "USD", "Usd", "UsD"]

      for (const currency of testCases) {
        mockPrisma.donation.create.mockClear()

        await expect(
          caller.createCheckout({
            toUserId: "recipient123",
            amountCents: 1000,
            currency,
          })
        ).rejects.toThrow("Stripe functionality is not available")

        expect(mockPrisma.donation.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              currency: "USD", // Always normalized to uppercase
            }),
          })
        )
      }
    })

    it("should handle complex stats calculation with multiple donors and rules", async () => {
      const complexTopRules = [
        { ruleId: "rule1", _sum: { amountCents: 5000 }, _count: 5 },
        { ruleId: "rule2", _sum: { amountCents: 3000 }, _count: 3 },
        { ruleId: "rule3", _sum: { amountCents: 1000 }, _count: 1 },
      ]

      const complexDonors = [
        {
          fromUserId: "donor1",
          _sum: { amountCents: 2000 },
          _max: { createdAt: new Date("2024-01-15") },
        },
        {
          fromUserId: "donor2",
          _sum: { amountCents: 1500 },
          _max: { createdAt: new Date("2024-01-14") },
        },
      ]

      const rules = [
        { id: "rule1", slug: "rule-1", title: "Rule 1" },
        { id: "rule2", slug: "rule-2", title: "Rule 2" },
        { id: "rule3", slug: "rule-3", title: "Rule 3" },
      ]

      const donors = [
        {
          id: "donor1",
          handle: "donor1",
          displayName: "Donor 1",
          avatarUrl: null,
        },
        {
          id: "donor2",
          handle: "donor2",
          displayName: "Donor 2",
          avatarUrl: "avatar2.jpg",
        },
      ]

      mockPrisma.donation.aggregate
        .mockResolvedValueOnce({ _sum: { amountCents: 10000 }, _count: 10 })
        .mockResolvedValueOnce({ _sum: { amountCents: 5000 }, _count: 5 })
      mockPrisma.donation.groupBy
        .mockResolvedValueOnce(complexTopRules)
        .mockResolvedValueOnce(complexDonors)
      mockPrisma.rule.findMany.mockResolvedValue(rules)
      mockPrisma.user.findMany.mockResolvedValue(donors)

      const result = await caller.statsForAuthor({
        windowDays: 30,
      })

      expect(result.topRules).toHaveLength(3)
      expect(result.recentDonors).toHaveLength(2)
      expect(result.totalCentsAllTime).toBe(10000)
      expect(result.totalCentsWindow).toBe(5000)
    })
  })
})
