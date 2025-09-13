import { z } from "zod";
import {
  ruleIdSchema,
  ruleVersionIdSchema,
  eventTypeSchema,
  idempotencyKeySchema,
} from "./base";

// Record event schema
export const recordEventSchema = z.object({
  type: eventTypeSchema,
  ruleId: ruleIdSchema.optional(),
  ruleVersionId: ruleVersionIdSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
  idempotencyKey: idempotencyKeySchema,
});

export type RecordEventInput = z.infer<typeof recordEventSchema>;

// Get open metrics schema
export const getOpenMetricsSchema = z.object({
  ruleId: ruleIdSchema,
  period: z.enum(["day", "week", "month", "all"]).default("week"),
  granularity: z.enum(["hour", "day", "week"]).default("day"),
});

export type GetOpenMetricsInput = z.infer<typeof getOpenMetricsSchema>;

// Get rule metrics schema
export const getRuleMetricsSchema = z.object({
  ruleId: ruleIdSchema,
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  granularity: z.enum(["hour", "day", "week", "month"]).default("day"),
});

export type GetRuleMetricsInput = z.infer<typeof getRuleMetricsSchema>;

// Get version metrics schema
export const getVersionMetricsSchema = z.object({
  ruleVersionId: ruleVersionIdSchema,
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  granularity: z.enum(["hour", "day", "week", "month"]).default("day"),
});

export type GetVersionMetricsInput = z.infer<typeof getVersionMetricsSchema>;

// Get author metrics schema
export const getAuthorMetricsSchema = z.object({
  authorId: z.string(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  granularity: z.enum(["day", "week", "month"]).default("day"),
});

export type GetAuthorMetricsInput = z.infer<typeof getAuthorMetricsSchema>;

// Get platform metrics schema (admin only)
export const getPlatformMetricsSchema = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  granularity: z.enum(["day", "week", "month"]).default("day"),
  includeBreakdown: z.boolean().default(false),
});

export type GetPlatformMetricsInput = z.infer<typeof getPlatformMetricsSchema>;

// Get trending content schema
export const getTrendingContentSchema = z.object({
  period: z.enum(["day", "week", "month"]).default("week"),
  limit: z.number().int().min(1).max(100).default(20),
  contentType: z.enum(["rules", "authors", "tags"]).default("rules"),
});

export type GetTrendingContentInput = z.infer<typeof getTrendingContentSchema>;
