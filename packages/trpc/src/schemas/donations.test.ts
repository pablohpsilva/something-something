import { describe, it, expect } from "vitest"
import {
  createCheckoutInputSchema,
  listDonationsInputSchema,
  authorStatsInputSchema,
  donationProviderSchema,
  createCheckoutResponseSchema,
  donationListResponseSchema,
  authorDonationStatsResponseSchema,
  supportedCurrenciesSchema,
  connectAccountStatusSchema,
  connectOnboardingResponseSchema,
  connectStatusResponseSchema,
  type CreateCheckoutInput,
  type ListDonationsInput,
  type AuthorStatsInput,
  type DonationProvider,
  type CreateCheckoutResponse,
  type DonationListResponse,
  type AuthorDonationStatsResponse,
  type SupportedCurrency,
  type ConnectAccountStatus,
  type ConnectOnboardingResponse,
  type ConnectStatusResponse,
} from "./donations"

describe("Donations Schemas", () => {
  describe("createCheckoutInputSchema", () => {
    it("should accept valid checkout input", () => {
      const validInput = {
        toUserId: "user123",
        ruleId: "rule456",
        amountCents: 500, // $5.00
        currency: "USD",
        message: "Great rule, thanks!",
      }

      const result = createCheckoutInputSchema.parse(validInput)
      expect(result).toEqual(validInput)
    })

    it("should accept input without optional fields", () => {
      const minimalInput = {
        toUserId: "user123",
        amountCents: 1000, // $10.00
      }

      const result = createCheckoutInputSchema.parse(minimalInput)
      expect(result).toEqual({
        toUserId: "user123",
        amountCents: 1000,
        currency: "USD", // default value
      })
    })

    it("should accept minimum amount", () => {
      const input = {
        toUserId: "user123",
        amountCents: 100, // $1.00 minimum
      }

      expect(() => createCheckoutInputSchema.parse(input)).not.toThrow()
    })

    it("should accept maximum amount", () => {
      const input = {
        toUserId: "user123",
        amountCents: 20000, // $200.00 maximum
      }

      expect(() => createCheckoutInputSchema.parse(input)).not.toThrow()
    })

    it("should reject amount below minimum", () => {
      const invalidInput = {
        toUserId: "user123",
        amountCents: 99, // Below $1.00 minimum
      }

      expect(() => createCheckoutInputSchema.parse(invalidInput)).toThrow()
    })

    it("should reject amount above maximum", () => {
      const invalidInput = {
        toUserId: "user123",
        amountCents: 20001, // Above $200.00 maximum
      }

      expect(() => createCheckoutInputSchema.parse(invalidInput)).toThrow()
    })

    it("should reject non-integer amounts", () => {
      const invalidInput = {
        toUserId: "user123",
        amountCents: 500.5, // Non-integer
      }

      expect(() => createCheckoutInputSchema.parse(invalidInput)).toThrow()
    })

    it("should reject invalid currency length", () => {
      const invalidInput = {
        toUserId: "user123",
        amountCents: 500,
        currency: "US", // Too short
      }

      expect(() => createCheckoutInputSchema.parse(invalidInput)).toThrow()
    })

    it("should reject message too long", () => {
      const invalidInput = {
        toUserId: "user123",
        amountCents: 500,
        message: "a".repeat(241), // Over 240 character limit
      }

      expect(() => createCheckoutInputSchema.parse(invalidInput)).toThrow()
    })

    it("should accept maximum length message", () => {
      const input = {
        toUserId: "user123",
        amountCents: 500,
        message: "a".repeat(240), // Exactly 240 characters
      }

      expect(() => createCheckoutInputSchema.parse(input)).not.toThrow()
    })
  })

  describe("listDonationsInputSchema", () => {
    it("should accept valid list input", () => {
      const validInput = {
        cursor: "cursor123",
        limit: 50,
        type: "received" as const,
      }

      const result = listDonationsInputSchema.parse(validInput)
      expect(result).toEqual(validInput)
    })

    it("should use default values", () => {
      const emptyInput = {}

      const result = listDonationsInputSchema.parse(emptyInput)
      expect(result).toEqual({
        limit: 20,
        type: "received",
      })
    })

    it("should accept 'sent' type", () => {
      const input = {
        type: "sent" as const,
      }

      const result = listDonationsInputSchema.parse(input)
      expect(result.type).toBe("sent")
    })

    it("should accept 'received' type", () => {
      const input = {
        type: "received" as const,
      }

      const result = listDonationsInputSchema.parse(input)
      expect(result.type).toBe("received")
    })

    it("should reject invalid type", () => {
      const invalidInput = {
        type: "invalid",
      }

      expect(() => listDonationsInputSchema.parse(invalidInput)).toThrow()
    })

    it("should accept input without cursor", () => {
      const input = {
        limit: 10,
        type: "sent" as const,
      }

      expect(() => listDonationsInputSchema.parse(input)).not.toThrow()
    })
  })

  describe("authorStatsInputSchema", () => {
    it("should accept valid author stats input", () => {
      const validInput = {
        authorUserId: "user123",
        windowDays: 90,
      }

      const result = authorStatsInputSchema.parse(validInput)
      expect(result).toEqual(validInput)
    })

    it("should use default windowDays", () => {
      const input = {
        authorUserId: "user123",
      }

      const result = authorStatsInputSchema.parse(input)
      expect(result).toEqual({
        authorUserId: "user123",
        windowDays: 30,
      })
    })

    it("should accept input without authorUserId", () => {
      const input = {
        windowDays: 60,
      }

      const result = authorStatsInputSchema.parse(input)
      expect(result.windowDays).toBe(60)
    })

    it("should accept minimum windowDays", () => {
      const input = {
        windowDays: 7,
      }

      expect(() => authorStatsInputSchema.parse(input)).not.toThrow()
    })

    it("should accept maximum windowDays", () => {
      const input = {
        windowDays: 365,
      }

      expect(() => authorStatsInputSchema.parse(input)).not.toThrow()
    })

    it("should reject windowDays below minimum", () => {
      const invalidInput = {
        windowDays: 6,
      }

      expect(() => authorStatsInputSchema.parse(invalidInput)).toThrow()
    })

    it("should reject windowDays above maximum", () => {
      const invalidInput = {
        windowDays: 366,
      }

      expect(() => authorStatsInputSchema.parse(invalidInput)).toThrow()
    })

    it("should reject non-integer windowDays", () => {
      const invalidInput = {
        windowDays: 30.5,
      }

      expect(() => authorStatsInputSchema.parse(invalidInput)).toThrow()
    })
  })

  describe("donationProviderSchema", () => {
    it("should accept STRIPE provider", () => {
      const provider = "STRIPE"

      const result = donationProviderSchema.parse(provider)
      expect(result).toBe("STRIPE")
    })

    it("should reject invalid provider", () => {
      const invalidProvider = "PAYPAL"

      expect(() => donationProviderSchema.parse(invalidProvider)).toThrow()
    })
  })

  describe("createCheckoutResponseSchema", () => {
    it("should accept valid checkout response", () => {
      const validResponse = {
        url: "https://checkout.stripe.com/session123",
        donationId: "donation456",
      }

      const result = createCheckoutResponseSchema.parse(validResponse)
      expect(result).toEqual(validResponse)
    })

    it("should reject invalid URL", () => {
      const invalidResponse = {
        url: "not-a-url",
        donationId: "donation456",
      }

      expect(() => createCheckoutResponseSchema.parse(invalidResponse)).toThrow()
    })

    it("should require both fields", () => {
      const incompleteResponse = {
        url: "https://checkout.stripe.com/session123",
      }

      expect(() => createCheckoutResponseSchema.parse(incompleteResponse)).toThrow()
    })
  })

  describe("donationListResponseSchema", () => {
    it("should accept valid donation list response", () => {
      const validResponse = {
        donations: [
          {
            id: "donation123",
            from: {
              id: "user123",
              handle: "donor",
              displayName: "Generous Donor",
              avatarUrl: "https://example.com/avatar.jpg",
            },
            to: {
              id: "user456",
              handle: "author",
              displayName: "Rule Author",
              avatarUrl: null,
            },
            rule: {
              id: "rule789",
              slug: "awesome-rule",
              title: "Awesome Rule",
            },
            amountCents: 1000,
            currency: "USD",
            status: "SUCCEEDED" as const,
            createdAt: new Date("2024-01-15T10:00:00Z"),
            message: "Great work!",
          },
        ],
        pagination: {
          nextCursor: "cursor456",
          hasMore: true,
          totalCount: 100,
        },
      }

      const result = donationListResponseSchema.parse(validResponse)
      expect(result).toEqual(validResponse)
    })

    it("should accept empty donations array", () => {
      const response = {
        donations: [],
        pagination: {
          hasMore: false,
          totalCount: 0,
        },
      }

      const result = donationListResponseSchema.parse(response)
      expect(result.donations).toEqual([])
    })

    it("should accept null from field (anonymous donation)", () => {
      const response = {
        donations: [
          {
            id: "donation123",
            from: null,
            to: {
              id: "user456",
              handle: "author",
              displayName: "Rule Author",
              avatarUrl: null,
            },
            rule: null,
            amountCents: 500,
            currency: "USD",
            status: "SUCCEEDED" as const,
            createdAt: new Date("2024-01-15T10:00:00Z"),
            message: null,
          },
        ],
        pagination: {
          hasMore: false,
          totalCount: 1,
        },
      }

      expect(() => donationListResponseSchema.parse(response)).not.toThrow()
    })

    it("should accept null rule field", () => {
      const response = {
        donations: [
          {
            id: "donation123",
            from: {
              id: "user123",
              handle: "donor",
              displayName: "Donor",
              avatarUrl: null,
            },
            to: {
              id: "user456",
              handle: "author",
              displayName: "Author",
              avatarUrl: null,
            },
            rule: null, // General donation not tied to specific rule
            amountCents: 1500,
            currency: "EUR",
            status: "INIT" as const,
            createdAt: new Date("2024-01-15T10:00:00Z"),
            message: "Keep up the good work!",
          },
        ],
        pagination: {
          hasMore: false,
          totalCount: 1,
        },
      }

      expect(() => donationListResponseSchema.parse(response)).not.toThrow()
    })

    it("should accept all donation status values", () => {
      const statuses = ["INIT", "SUCCEEDED", "FAILED"] as const

      statuses.forEach(status => {
        const response = {
          donations: [
            {
              id: "donation123",
              from: null,
              to: {
                id: "user456",
                handle: "author",
                displayName: "Author",
                avatarUrl: null,
              },
              rule: null,
              amountCents: 1000,
              currency: "USD",
              status,
              createdAt: new Date("2024-01-15T10:00:00Z"),
              message: null,
            },
          ],
          pagination: {
            hasMore: false,
            totalCount: 1,
          },
        }
        expect(() => donationListResponseSchema.parse(response)).not.toThrow()
      })
    })

    it("should accept pagination without nextCursor", () => {
      const response = {
        donations: [],
        pagination: {
          hasMore: false,
          totalCount: 0,
        },
      }

      expect(() => donationListResponseSchema.parse(response)).not.toThrow()
    })
  })

  describe("authorDonationStatsResponseSchema", () => {
    it("should accept valid author donation stats", () => {
      const validStats = {
        totalCentsAllTime: 50000,
        totalCentsWindow: 10000,
        countWindow: 25,
        topRules: [
          {
            ruleId: "rule123",
            slug: "popular-rule",
            title: "Popular Rule",
            totalCents: 5000,
            count: 10,
          },
        ],
        byDay: [
          {
            date: "2024-01-15",
            cents: 1000,
            count: 2,
          },
          {
            date: "2024-01-14",
            cents: 500,
            count: 1,
          },
        ],
        recentDonors: [
          {
            id: "user123",
            handle: "generous-donor",
            displayName: "Generous Donor",
            avatarUrl: "https://example.com/donor.jpg",
            totalCents: 2000,
            lastDonationAt: new Date("2024-01-15T10:00:00Z"),
          },
        ],
      }

      const result = authorDonationStatsResponseSchema.parse(validStats)
      expect(result).toEqual(validStats)
    })

    it("should accept empty arrays", () => {
      const statsWithEmptyArrays = {
        totalCentsAllTime: 0,
        totalCentsWindow: 0,
        countWindow: 0,
        topRules: [],
        byDay: [],
        recentDonors: [],
      }

      const result = authorDonationStatsResponseSchema.parse(statsWithEmptyArrays)
      expect(result).toEqual(statsWithEmptyArrays)
    })

    it("should accept null avatarUrl in recentDonors", () => {
      const stats = {
        totalCentsAllTime: 1000,
        totalCentsWindow: 1000,
        countWindow: 1,
        topRules: [],
        byDay: [],
        recentDonors: [
          {
            id: "user123",
            handle: "donor",
            displayName: "Donor",
            avatarUrl: null,
            totalCents: 1000,
            lastDonationAt: new Date("2024-01-15T10:00:00Z"),
          },
        ],
      }

      expect(() => authorDonationStatsResponseSchema.parse(stats)).not.toThrow()
    })

    it("should accept negative values", () => {
      const statsWithNegatives = {
        totalCentsAllTime: -1000, // Refunds could cause negative totals
        totalCentsWindow: -500,
        countWindow: 0,
        topRules: [
          {
            ruleId: "rule123",
            slug: "rule-with-refunds",
            title: "Rule With Refunds",
            totalCents: -200,
            count: -1,
          },
        ],
        byDay: [
          {
            date: "2024-01-15",
            cents: -100,
            count: -1,
          },
        ],
        recentDonors: [
          {
            id: "user123",
            handle: "donor",
            displayName: "Donor",
            avatarUrl: null,
            totalCents: -100,
            lastDonationAt: new Date("2024-01-15T10:00:00Z"),
          },
        ],
      }

      expect(() => authorDonationStatsResponseSchema.parse(statsWithNegatives)).not.toThrow()
    })

    it("should validate date format in byDay", () => {
      const stats = {
        totalCentsAllTime: 1000,
        totalCentsWindow: 1000,
        countWindow: 1,
        topRules: [],
        byDay: [
          {
            date: "2024-01-15", // YYYY-MM-DD format
            cents: 1000,
            count: 1,
          },
        ],
        recentDonors: [],
      }

      expect(() => authorDonationStatsResponseSchema.parse(stats)).not.toThrow()
    })
  })

  describe("supportedCurrenciesSchema", () => {
    it("should accept all supported currencies", () => {
      const currencies = [
        "USD",
        "EUR",
        "GBP",
        "CAD",
        "AUD",
        "JPY",
        "CHF",
        "SEK",
        "NOK",
        "DKK",
      ] as const

      currencies.forEach(currency => {
        const result = supportedCurrenciesSchema.parse(currency)
        expect(result).toBe(currency)
      })
    })

    it("should reject unsupported currency", () => {
      const unsupportedCurrency = "BTC"

      expect(() => supportedCurrenciesSchema.parse(unsupportedCurrency)).toThrow()
    })
  })

  describe("connectAccountStatusSchema", () => {
    it("should accept all connect account statuses", () => {
      const statuses = ["NONE", "PENDING", "VERIFIED", "REJECTED"] as const

      statuses.forEach(status => {
        const result = connectAccountStatusSchema.parse(status)
        expect(result).toBe(status)
      })
    })

    it("should reject invalid status", () => {
      const invalidStatus = "UNKNOWN"

      expect(() => connectAccountStatusSchema.parse(invalidStatus)).toThrow()
    })
  })

  describe("connectOnboardingResponseSchema", () => {
    it("should accept valid onboarding response", () => {
      const validResponse = {
        url: "https://connect.stripe.com/onboarding/123",
        accountId: "acct_123456789",
      }

      const result = connectOnboardingResponseSchema.parse(validResponse)
      expect(result).toEqual(validResponse)
    })

    it("should reject invalid URL", () => {
      const invalidResponse = {
        url: "not-a-url",
        accountId: "acct_123456789",
      }

      expect(() => connectOnboardingResponseSchema.parse(invalidResponse)).toThrow()
    })

    it("should require both fields", () => {
      const incompleteResponse = {
        url: "https://connect.stripe.com/onboarding/123",
      }

      expect(() => connectOnboardingResponseSchema.parse(incompleteResponse)).toThrow()
    })
  })

  describe("connectStatusResponseSchema", () => {
    it("should accept valid status response", () => {
      const validResponse = {
        status: "VERIFIED" as const,
        accountId: "acct_123456789",
        canReceivePayouts: true,
        requirements: ["tax_id", "bank_account"],
      }

      const result = connectStatusResponseSchema.parse(validResponse)
      expect(result).toEqual(validResponse)
    })

    it("should accept null accountId", () => {
      const response = {
        status: "NONE" as const,
        accountId: null,
        canReceivePayouts: false,
      }

      const result = connectStatusResponseSchema.parse(response)
      expect(result.accountId).toBeNull()
    })

    it("should accept response without requirements", () => {
      const response = {
        status: "VERIFIED" as const,
        accountId: "acct_123456789",
        canReceivePayouts: true,
      }

      expect(() => connectStatusResponseSchema.parse(response)).not.toThrow()
    })

    it("should accept empty requirements array", () => {
      const response = {
        status: "VERIFIED" as const,
        accountId: "acct_123456789",
        canReceivePayouts: true,
        requirements: [],
      }

      expect(() => connectStatusResponseSchema.parse(response)).not.toThrow()
    })

    it("should accept all status values", () => {
      const statuses = ["NONE", "PENDING", "VERIFIED", "REJECTED"] as const

      statuses.forEach(status => {
        const response = {
          status,
          accountId: status === "NONE" ? null : "acct_123456789",
          canReceivePayouts: status === "VERIFIED",
        }
        expect(() => connectStatusResponseSchema.parse(response)).not.toThrow()
      })
    })
  })

  describe("Type Exports", () => {
    it("should export all input types", () => {
      // Test that types are properly exported by creating variables of each type
      const createCheckoutInput: CreateCheckoutInput = {
        toUserId: "user123",
        amountCents: 1000,
      }

      const listDonationsInput: ListDonationsInput = {
        type: "received",
      }

      const authorStatsInput: AuthorStatsInput = {
        windowDays: 30,
      }

      const donationProvider: DonationProvider = "STRIPE"

      expect(createCheckoutInput).toBeDefined()
      expect(listDonationsInput).toBeDefined()
      expect(authorStatsInput).toBeDefined()
      expect(donationProvider).toBeDefined()
    })

    it("should export all response types", () => {
      // Test that types are properly exported by creating variables of each type
      const createCheckoutResponse: CreateCheckoutResponse = {
        url: "https://checkout.stripe.com/session123",
        donationId: "donation456",
      }

      const donationListResponse: DonationListResponse = {
        donations: [],
        pagination: {
          hasMore: false,
          totalCount: 0,
        },
      }

      const authorDonationStatsResponse: AuthorDonationStatsResponse = {
        totalCentsAllTime: 0,
        totalCentsWindow: 0,
        countWindow: 0,
        topRules: [],
        byDay: [],
        recentDonors: [],
      }

      const supportedCurrency: SupportedCurrency = "USD"
      const connectAccountStatus: ConnectAccountStatus = "NONE"

      const connectOnboardingResponse: ConnectOnboardingResponse = {
        url: "https://connect.stripe.com/onboarding/123",
        accountId: "acct_123456789",
      }

      const connectStatusResponse: ConnectStatusResponse = {
        status: "NONE",
        accountId: null,
        canReceivePayouts: false,
      }

      expect(createCheckoutResponse).toBeDefined()
      expect(donationListResponse).toBeDefined()
      expect(authorDonationStatsResponse).toBeDefined()
      expect(supportedCurrency).toBeDefined()
      expect(connectAccountStatus).toBeDefined()
      expect(connectOnboardingResponse).toBeDefined()
      expect(connectStatusResponse).toBeDefined()
    })
  })

  describe("Edge Cases and Integration", () => {
    it("should handle large donation amounts", () => {
      const largeAmountInput = {
        toUserId: "user123",
        amountCents: 19999, // Just under the maximum
      }

      expect(() => createCheckoutInputSchema.parse(largeAmountInput)).not.toThrow()
    })

    it("should handle complex donation list with mixed data", () => {
      const complexResponse = {
        donations: [
          // Anonymous donation
          {
            id: "donation1",
            from: null,
            to: {
              id: "user1",
              handle: "author1",
              displayName: "Author One",
              avatarUrl: null,
            },
            rule: null,
            amountCents: 500,
            currency: "EUR",
            status: "SUCCEEDED" as const,
            createdAt: new Date("2024-01-15T10:00:00Z"),
            message: null,
          },
          // Regular donation with rule
          {
            id: "donation2",
            from: {
              id: "user2",
              handle: "donor2",
              displayName: "Donor Two",
              avatarUrl: "https://example.com/donor2.jpg",
            },
            to: {
              id: "user3",
              handle: "author3",
              displayName: "Author Three",
              avatarUrl: "https://example.com/author3.jpg",
            },
            rule: {
              id: "rule1",
              slug: "awesome-rule",
              title: "Awesome Rule",
            },
            amountCents: 2000,
            currency: "USD",
            status: "INIT" as const,
            createdAt: new Date("2024-01-14T15:30:00Z"),
            message: "Great work on this rule!",
          },
        ],
        pagination: {
          nextCursor: "cursor789",
          hasMore: true,
          totalCount: 150,
        },
      }

      expect(() => donationListResponseSchema.parse(complexResponse)).not.toThrow()
    })

    it("should handle boundary values for author stats", () => {
      const boundaryStats = {
        authorUserId: "user123",
        windowDays: 7, // Minimum allowed
      }

      expect(() => authorStatsInputSchema.parse(boundaryStats)).not.toThrow()

      const maxBoundaryStats = {
        authorUserId: "user123",
        windowDays: 365, // Maximum allowed
      }

      expect(() => authorStatsInputSchema.parse(maxBoundaryStats)).not.toThrow()
    })

    it("should handle comprehensive author donation stats", () => {
      const comprehensiveStats = {
        totalCentsAllTime: 1000000, // $10,000
        totalCentsWindow: 50000, // $500
        countWindow: 125,
        topRules: [
          {
            ruleId: "rule1",
            slug: "top-rule",
            title: "Top Earning Rule",
            totalCents: 25000,
            count: 50,
          },
          {
            ruleId: "rule2",
            slug: "second-rule",
            title: "Second Best Rule",
            totalCents: 15000,
            count: 30,
          },
        ],
        byDay: Array.from({ length: 30 }, (_, i) => ({
          date: `2024-01-${String(i + 1).padStart(2, "0")}`,
          cents: Math.floor(Math.random() * 2000),
          count: Math.floor(Math.random() * 5),
        })),
        recentDonors: [
          {
            id: "donor1",
            handle: "top-donor",
            displayName: "Top Donor",
            avatarUrl: "https://example.com/top-donor.jpg",
            totalCents: 5000,
            lastDonationAt: new Date("2024-01-15T10:00:00Z"),
          },
          {
            id: "donor2",
            handle: "regular-donor",
            displayName: "Regular Donor",
            avatarUrl: null,
            totalCents: 2000,
            lastDonationAt: new Date("2024-01-14T08:30:00Z"),
          },
        ],
      }

      expect(() => authorDonationStatsResponseSchema.parse(comprehensiveStats)).not.toThrow()
    })

    it("should handle all currency combinations", () => {
      const currencies = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "SEK", "NOK", "DKK"]

      currencies.forEach(currency => {
        const input = {
          toUserId: "user123",
          amountCents: 1000,
          currency,
        }
        expect(() => createCheckoutInputSchema.parse(input)).not.toThrow()
      })
    })
  })
})
