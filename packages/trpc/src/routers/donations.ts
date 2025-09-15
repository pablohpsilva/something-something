import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, publicProcedure, protectedProcedure, rateLimitedProcedure, audit } from "../trpc"
import {
  createCheckoutInputSchema,
  listDonationsInputSchema,
  authorStatsInputSchema,
  createCheckoutResponseSchema,
  donationListResponseSchema,
  authorDonationStatsResponseSchema,
  supportedCurrenciesSchema,
  connectOnboardingResponseSchema,
  connectStatusResponseSchema,
} from "../schemas/donations"
import { createRateLimitedProcedure } from "../middleware/rate-limit"

// Enhanced rate limited procedures for donations
const donationRateLimitedProcedure = createRateLimitedProcedure(
  protectedProcedure,
  "donationsCreatePerUserPerMin",
  { requireAuth: true, burstProtection: true }
)

export const donationsRouter = router({
  /**
   * Create Stripe checkout session for donation
   */
  createCheckout: donationRateLimitedProcedure
    .input(createCheckoutInputSchema)
    .output(createCheckoutResponseSchema)
    .use(audit("donation.createCheckout"))
    .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
      const { toUserId, ruleId, amountCents, currency, message } = input
      const fromUserId = ctx.user!.id

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
        select: { id: true, handle: true, displayName: true, email: true },
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
          select: { id: true, slug: true, title: true, createdByUserId: true },
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
      if (!supportedCurrenciesSchema.safeParse(normalizedCurrency).success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Currency ${normalizedCurrency} is not supported`,
        })
      }

      // Check Stripe configuration
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

      try {
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

        // Create Stripe checkout session (disabled)
        // const session = await stripe.checkout.sessions.create({
        //   mode: "payment",
        //   payment_method_types: ["card"],
        //   line_items: [
        //     {
        //       price_data: {
        //         currency: normalizedCurrency.toLowerCase(),
        //         product_data: {
        //           name: rule
        //             ? `Tip for "${rule.title}"`
        //             : `Tip for @${recipient.handle}`,
        //           description: message || "Thank you for your contribution!",
        //         },
        //         unit_amount: amountCents,
        //       },
        //       quantity: 1,
        //     },
        //   ],
        //   success_url: `${webBaseUrl}/authors/${recipient.handle}?donation=success`,
        //   cancel_url: `${webBaseUrl}/authors/${recipient.handle}`,
        //   customer_email: ctx.user!.email || undefined,
        //   metadata: {
        //     donationId: donation.id,
        //     toUserId,
        //     fromUserId,
        //     ruleId: ruleId || "",
        //   },
        // });

        // Stripe functionality disabled - return placeholder
        return {
          url: "https://example.com/disabled",
          donationId: donation.id,
        }
      } catch (error) {
        console.error("Failed to create Stripe checkout session:", error)

        if (error instanceof TRPCError) {
          throw error
        }

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create payment session",
        })
      }
    }),

  /**
   * List donations (sent or received)
   */
  listMine: protectedProcedure
    .input(listDonationsInputSchema)
    .output(donationListResponseSchema)
    .query(async ({ input, ctx }) => {
      const { cursor, limit, type } = input
      const userId = ctx.user!.id

      const whereClause = type === "received" ? { toUserId: userId } : { fromUserId: userId }

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
          from: { id: "", handle: "", displayName: "", avatarUrl: null }, // Placeholder
          to: { id: "", handle: "", displayName: "", avatarUrl: null }, // Placeholder
          rule: { id: "", title: "", slug: "" }, // Placeholder
          amountCents: donation.amountCents,
          currency: donation.currency,
          status: donation.status as "INIT" | "SUCCEEDED" | "FAILED",
          createdAt: donation.createdAt,
          message: "", // Placeholder
        })),
        pagination: {
          nextCursor,
          hasMore,
          totalCount,
        },
      }
    }),

  /**
   * Get donation statistics for an author
   */
  statsForAuthor: protectedProcedure
    .input(authorStatsInputSchema)
    .output(authorDonationStatsResponseSchema)
    .query(async ({ input, ctx }) => {
      const { authorUserId, windowDays } = input
      const targetUserId = authorUserId || ctx.user!.id

      // Verify user exists and current user can view stats
      if (targetUserId !== ctx.user!.id) {
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

      const ruleIds = topRulesData
        .map(item => item.ruleId)
        .filter((id): id is string => Boolean(id))
      const rules = await ctx.prisma.rule.findMany({
        where: { id: { in: ruleIds } },
        select: { id: true, slug: true, title: true },
      })

      const rulesMap = new Map(rules.map(rule => [rule.id, rule]))
      const topRules = topRulesData
        .map(item => {
          const rule = rulesMap.get(item.ruleId!)
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

      // Get by-day data
      const byDayData = await ctx.prisma.$queryRaw<
        Array<{
          date: string
          cents: bigint
          count: bigint
        }>
      >`
        SELECT 
          DATE(createdAt) as date,
          COALESCE(SUM(amountCents), 0) as cents,
          COUNT(*) as count
        FROM Donation 
        WHERE toUserId = ${targetUserId}
          AND status = 'SUCCEEDED'
          AND createdAt >= ${windowStart}
        GROUP BY DATE(createdAt)
        ORDER BY date DESC
      `

      // Fill missing days with zeros
      const byDay = []
      for (let i = 0; i < windowDays; i++) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split("T")[0]

        const dayData = byDayData.find(d => d.date === dateStr)
        byDay.push({
          date: dateStr || "",
          cents: dayData ? Number(dayData.cents) : 0,
          count: dayData ? Number(dayData.count) : 0,
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

      const donorIds = recentDonorsData
        .map(d => d.fromUserId)
        .filter((id): id is string => Boolean(id))
      const donors = await ctx.prisma.user.findMany({
        where: { id: { in: donorIds } },
        select: { id: true, handle: true, displayName: true, avatarUrl: true },
      })

      const donorsMap = new Map(donors.map(donor => [donor.id, donor]))
      const recentDonors = recentDonorsData
        .map(item => {
          const donor = donorsMap.get(item.fromUserId!)
          return donor
            ? {
                id: donor.id,
                handle: donor.handle,
                displayName: donor.displayName,
                avatarUrl: donor.avatarUrl,
                totalCents: item._sum.amountCents || 0,
                lastDonationAt: item._max.createdAt!,
              }
            : null
        })
        .filter(Boolean)

      return {
        totalCentsAllTime: allTimeStats._sum.amountCents || 0,
        totalCentsWindow: windowStats._sum.amountCents || 0,
        countWindow: windowStats._count || 0,
        topRules: topRules as any,
        byDay: byDay.reverse(), // Show oldest to newest
        recentDonors: recentDonors as any,
      }
    }),

  /**
   * Get supported currencies
   */
  getSupportedCurrencies: publicProcedure
    .output(
      z.array(
        z.object({
          code: z.string(),
          name: z.string(),
          symbol: z.string(),
        })
      )
    )
    .query(async () => {
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
    }),

  // Phase 2: Stripe Connect endpoints (stubbed for now)
  connect: router({
    /**
     * Prepare Stripe Connect onboarding (Phase 2)
     */
    prepareOnboarding: protectedProcedure
      .output(connectOnboardingResponseSchema)
      .mutation(async ({ ctx }) => {
        const connectEnabled = process.env.STRIPE_CONNECT_ENABLED === "true"

        if (!connectEnabled) {
          throw new TRPCError({
            code: "NOT_IMPLEMENTED",
            message: "Stripe Connect is not enabled in this environment",
          })
        }

        // TODO: Implement Stripe Connect onboarding
        throw new TRPCError({
          code: "NOT_IMPLEMENTED",
          message: "Stripe Connect onboarding will be implemented in Phase 2",
        })
      }),

    /**
     * Get Connect account status (Phase 2)
     */
    getStatus: protectedProcedure.output(connectStatusResponseSchema).query(async ({ ctx }) => {
      const connectEnabled = process.env.STRIPE_CONNECT_ENABLED === "true"

      if (!connectEnabled) {
        return {
          status: "NONE" as const,
          accountId: null,
          canReceivePayouts: false,
        }
      }

      // TODO: Implement Stripe Connect status check
      return {
        status: "NONE" as const,
        accountId: null,
        canReceivePayouts: false,
      }
    }),
  }),
})
