import { z } from "zod";
import { cuidOrUuidSchema, cursorSchema, limitSchema } from "./base";

/**
 * Create checkout session input schema
 */
export const createCheckoutInputSchema = z.object({
  toUserId: cuidOrUuidSchema,
  ruleId: cuidOrUuidSchema.optional(),
  amountCents: z.number().int().min(100).max(20000), // $1.00 - $200.00
  currency: z.string().length(3).default("USD"),
  message: z.string().max(240).optional(), // Optional donor note
});

/**
 * List donations input schema
 */
export const listDonationsInputSchema = z.object({
  cursor: cursorSchema.optional(),
  limit: limitSchema.optional().default(20),
  type: z.enum(["received", "sent"]).default("received"),
});

/**
 * Author donation stats input schema
 */
export const authorStatsInputSchema = z.object({
  authorUserId: cuidOrUuidSchema.optional(), // defaults to current user if omitted
  windowDays: z.number().int().min(7).max(365).default(30),
});

/**
 * Donation status enum
 */
export const donationStatusSchema = z.enum(["INIT", "SUCCEEDED", "FAILED"]);

/**
 * Donation provider enum
 */
export const donationProviderSchema = z.enum(["STRIPE"]);

/**
 * Create checkout response schema
 */
export const createCheckoutResponseSchema = z.object({
  url: z.string().url(),
  donationId: z.string(),
});

/**
 * Donation list response schema
 */
export const donationListResponseSchema = z.object({
  donations: z.array(
    z.object({
      id: z.string(),
      from: z
        .object({
          id: z.string(),
          handle: z.string(),
          displayName: z.string(),
          avatarUrl: z.string().nullable(),
        })
        .nullable(),
      to: z.object({
        id: z.string(),
        handle: z.string(),
        displayName: z.string(),
        avatarUrl: z.string().nullable(),
      }),
      rule: z
        .object({
          id: z.string(),
          slug: z.string(),
          title: z.string(),
        })
        .nullable(),
      amountCents: z.number().int(),
      currency: z.string(),
      status: donationStatusSchema,
      createdAt: z.date(),
      message: z.string().nullable(),
    })
  ),
  pagination: z.object({
    nextCursor: z.string().optional(),
    hasMore: z.boolean(),
    totalCount: z.number().int(),
  }),
});

/**
 * Author donation stats response schema
 */
export const authorDonationStatsResponseSchema = z.object({
  totalCentsAllTime: z.number().int(),
  totalCentsWindow: z.number().int(),
  countWindow: z.number().int(),
  topRules: z.array(
    z.object({
      ruleId: z.string(),
      slug: z.string(),
      title: z.string(),
      totalCents: z.number().int(),
      count: z.number().int(),
    })
  ),
  byDay: z.array(
    z.object({
      date: z.string(), // YYYY-MM-DD format
      cents: z.number().int(),
      count: z.number().int(),
    })
  ),
  recentDonors: z.array(
    z.object({
      id: z.string(),
      handle: z.string(),
      displayName: z.string(),
      avatarUrl: z.string().nullable(),
      totalCents: z.number().int(),
      lastDonationAt: z.date(),
    })
  ),
});

/**
 * Supported currencies
 */
export const supportedCurrenciesSchema = z.enum([
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
]);

/**
 * Connect account status (Phase 2)
 */
export const connectAccountStatusSchema = z.enum([
  "NONE",
  "PENDING",
  "VERIFIED",
  "REJECTED",
]);

/**
 * Connect onboarding response (Phase 2)
 */
export const connectOnboardingResponseSchema = z.object({
  url: z.string().url(),
  accountId: z.string(),
});

/**
 * Connect status response (Phase 2)
 */
export const connectStatusResponseSchema = z.object({
  status: connectAccountStatusSchema,
  accountId: z.string().nullable(),
  canReceivePayouts: z.boolean(),
  requirements: z.array(z.string()).optional(),
});

// Type exports
export type CreateCheckoutInput = z.infer<typeof createCheckoutInputSchema>;
export type ListDonationsInput = z.infer<typeof listDonationsInputSchema>;
export type AuthorStatsInput = z.infer<typeof authorStatsInputSchema>;
export type DonationStatus = z.infer<typeof donationStatusSchema>;
export type DonationProvider = z.infer<typeof donationProviderSchema>;
export type CreateCheckoutResponse = z.infer<
  typeof createCheckoutResponseSchema
>;
export type DonationListResponse = z.infer<typeof donationListResponseSchema>;
export type AuthorDonationStatsResponse = z.infer<
  typeof authorDonationStatsResponseSchema
>;
export type SupportedCurrency = z.infer<typeof supportedCurrenciesSchema>;
export type ConnectAccountStatus = z.infer<typeof connectAccountStatusSchema>;
export type ConnectOnboardingResponse = z.infer<
  typeof connectOnboardingResponseSchema
>;
export type ConnectStatusResponse = z.infer<typeof connectStatusResponseSchema>;
