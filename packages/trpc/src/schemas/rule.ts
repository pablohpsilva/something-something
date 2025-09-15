import { z } from "zod"
import {
  ruleIdSchema,
  slugSchema,
  titleSchema,
  summarySchema,
  bodySchema,
  contentTypeSchema,
  statusFilterSchema,
  tagsFilterSchema,
  modelFilterSchema,
  paginationSchema,
  sortSchema,
  resourceLinkSchema,
  testedOnSchema,
  idempotencyKeySchema,
} from "./base"

// Rule creation schema
export const createRuleSchema = z.object({
  title: titleSchema,
  summary: summarySchema,
  contentType: contentTypeSchema,
  primaryModel: z.string().optional(),
  tags: z.array(z.string()).optional(),
  body: bodySchema,
  testedOn: testedOnSchema.optional(),
  links: z.array(resourceLinkSchema).optional(),
  idempotencyKey: idempotencyKeySchema,
})

export type CreateRuleInput = z.infer<typeof createRuleSchema>

// Rule update schema
export const updateRuleSchema = z.object({
  ruleId: ruleIdSchema,
  title: titleSchema.optional(),
  summary: summarySchema,
  primaryModel: z.string().optional(),
  tags: z.array(z.string()).optional(),
  links: z.array(resourceLinkSchema).optional(),
  idempotencyKey: idempotencyKeySchema,
})

export type UpdateRuleInput = z.infer<typeof updateRuleSchema>

// Rule list filters schema
export const ruleListFiltersSchema = z.object({
  tags: tagsFilterSchema,
  model: modelFilterSchema,
  status: statusFilterSchema,
  contentType: contentTypeSchema.optional(),
  authorId: z.string().optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
})

export type RuleListFilters = z.infer<typeof ruleListFiltersSchema>

// Rule list input schema
export const listRulesSchema = z.object({
  ...paginationSchema.shape,
  sort: sortSchema,
  filters: ruleListFiltersSchema.optional(),
})

export type ListRulesInput = z.infer<typeof listRulesSchema>

// Get rule by slug schema
export const getRuleBySlugSchema = z.object({
  slug: slugSchema,
  includeMetrics: z.boolean().default(true),
  includeUserActions: z.boolean().default(false),
})

export type GetRuleBySlugInput = z.infer<typeof getRuleBySlugSchema>

// Get rule by ID schema
export const getRuleByIdSchema = z.object({
  ruleId: ruleIdSchema,
  includeMetrics: z.boolean().default(true),
  includeUserActions: z.boolean().default(false),
})

export type GetRuleByIdInput = z.infer<typeof getRuleByIdSchema>

// Publish rule schema
export const publishRuleSchema = z.object({
  ruleId: ruleIdSchema,
  idempotencyKey: idempotencyKeySchema,
})

export type PublishRuleInput = z.infer<typeof publishRuleSchema>

// Deprecate rule schema
export const deprecateRuleSchema = z.object({
  ruleId: ruleIdSchema,
  reason: z.string().max(500).optional(),
  idempotencyKey: idempotencyKeySchema,
})

export type DeprecateRuleInput = z.infer<typeof deprecateRuleSchema>

// Soft delete rule schema
export const softDeleteRuleSchema = z.object({
  ruleId: ruleIdSchema,
  reason: z.string().max(500).optional(),
  idempotencyKey: idempotencyKeySchema,
})

export type SoftDeleteRuleInput = z.infer<typeof softDeleteRuleSchema>

// Get rules by author schema
export const getRulesByAuthorSchema = z.object({
  authorId: z.string(),
  ...paginationSchema.shape,
  sort: sortSchema,
  includePrivate: z.boolean().default(false),
})

export type GetRulesByAuthorInput = z.infer<typeof getRulesByAuthorSchema>

// Get trending rules schema
export const getTrendingRulesSchema = z.object({
  ...paginationSchema.shape,
  period: z.enum(["day", "week", "month"]).default("week"),
  filters: ruleListFiltersSchema.optional(),
})

export type GetTrendingRulesInput = z.infer<typeof getTrendingRulesSchema>

// Duplicate rule schema
export const duplicateRuleSchema = z.object({
  ruleId: ruleIdSchema,
  title: titleSchema.optional(),
  summary: summarySchema,
  idempotencyKey: idempotencyKeySchema,
})

export type DuplicateRuleInput = z.infer<typeof duplicateRuleSchema>

// Rule stats schema
export const getRuleStatsSchema = z.object({
  ruleId: ruleIdSchema,
  period: z.enum(["day", "week", "month", "all"]).default("week"),
})

export type GetRuleStatsInput = z.infer<typeof getRuleStatsSchema>
