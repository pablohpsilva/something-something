import { z } from "zod";

// Health check response schema
export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  time: z.string().datetime(),
  version: z.string().optional(),
});

// Generic success response schema
export const successResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

// Generic error response schema
export const errorResponseSchema = z.object({
  error: z.string(),
  code: z.number().int().optional(),
  details: z.unknown().optional(),
});

// Stripe webhook event schema (simplified)
export const stripeWebhookEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.unknown(),
  }),
  created: z.number(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type SuccessResponse = z.infer<typeof successResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type StripeWebhookEvent = z.infer<typeof stripeWebhookEventSchema>;
