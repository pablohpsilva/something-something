import { z } from "zod";
import {
  userIdSchema,
  ruleIdSchema,
  currencySchema,
  paginationSchema,
  idempotencyKeySchema,
} from "./base";

// Create checkout schema
export const createCheckoutSchema = z.object({
  toUserId: userIdSchema,
  ruleId: ruleIdSchema.optional(),
  amountCents: z.number().int().positive().max(100000000), // Max $1M
  currency: currencySchema,
  message: z.string().max(500).optional(),
  isAnonymous: z.boolean().default(false),
  idempotencyKey: idempotencyKeySchema,
});

export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;

// List my donations schema
export const listMyDonationsSchema = z.object({
  ...paginationSchema.shape,
  type: z.enum(["sent", "received", "all"]).default("all"),
  status: z.enum(["INIT", "SUCCEEDED", "FAILED"]).optional(),
  sort: z.enum(["new", "old", "amount"]).default("new"),
});

export type ListMyDonationsInput = z.infer<typeof listMyDonationsSchema>;

// Get donation by ID schema
export const getDonationByIdSchema = z.object({
  donationId: z.string(),
});

export type GetDonationByIdInput = z.infer<typeof getDonationByIdSchema>;

// Get donation stats schema
export const getDonationStatsSchema = z.object({
  userId: userIdSchema.optional(), // If not provided, uses current user
  period: z.enum(["day", "week", "month", "year", "all"]).default("month"),
});

export type GetDonationStatsInput = z.infer<typeof getDonationStatsSchema>;

// Get top donors schema
export const getTopDonorsSchema = z.object({
  ...paginationSchema.shape,
  period: z.enum(["day", "week", "month", "year", "all"]).default("month"),
  toUserId: userIdSchema.optional(),
});

export type GetTopDonorsInput = z.infer<typeof getTopDonorsSchema>;

// Get top recipients schema
export const getTopRecipientsSchema = z.object({
  ...paginationSchema.shape,
  period: z.enum(["day", "week", "month", "year", "all"]).default("month"),
});

export type GetTopRecipientsInput = z.infer<typeof getTopRecipientsSchema>;

// Process webhook schema (internal)
export const processWebhookSchema = z.object({
  provider: z.enum(["STRIPE"]),
  eventType: z.string(),
  payload: z.record(z.unknown()),
  signature: z.string(),
});

export type ProcessWebhookInput = z.infer<typeof processWebhookSchema>;
