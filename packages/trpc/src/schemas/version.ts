import { z } from "zod"
import {
  ruleIdSchema,
  ruleVersionIdSchema,
  bodySchema,
  changelogSchema,
  testedOnSchema,
  paginationSchema,
  semverSchema,
  idempotencyKeySchema,
} from "./base"

// Create version schema
export const createVersionSchema = z.object({
  ruleId: ruleIdSchema,
  baseVersionId: ruleVersionIdSchema.optional(),
  body: bodySchema,
  changelog: changelogSchema,
  testedOn: testedOnSchema.optional(),
  version: semverSchema.optional(), // If not provided, will auto-increment
  idempotencyKey: idempotencyKeySchema,
})

export type CreateVersionInput = z.infer<typeof createVersionSchema>

// Fork version schema
export const forkVersionSchema = z.object({
  ruleId: ruleIdSchema,
  fromVersionId: ruleVersionIdSchema,
  newBody: bodySchema.optional(),
  changelog: changelogSchema,
  testedOn: testedOnSchema.optional(),
  idempotencyKey: idempotencyKeySchema,
})

export type ForkVersionInput = z.infer<typeof forkVersionSchema>

// List versions by rule schema
export const listVersionsByRuleSchema = z.object({
  ruleId: ruleIdSchema,
  ...paginationSchema.shape,
  includeBody: z.boolean().default(false),
})

export type ListVersionsByRuleInput = z.infer<typeof listVersionsByRuleSchema>

// Get version by ID schema
export const getVersionByIdSchema = z.object({
  versionId: ruleVersionIdSchema,
  includeUserActions: z.boolean().default(false),
})

export type GetVersionByIdInput = z.infer<typeof getVersionByIdSchema>

// Get version diff schema
export const getVersionDiffSchema = z.object({
  prevVersionId: ruleVersionIdSchema,
  currVersionId: ruleVersionIdSchema,
  format: z.enum(["unified", "split", "json"]).default("unified"),
})

export type GetVersionDiffInput = z.infer<typeof getVersionDiffSchema>

// Update version schema (limited fields)
export const updateVersionSchema = z.object({
  versionId: ruleVersionIdSchema,
  changelog: changelogSchema,
  testedOn: testedOnSchema.optional(),
  idempotencyKey: idempotencyKeySchema,
})

export type UpdateVersionInput = z.infer<typeof updateVersionSchema>

// Set current version schema
export const setCurrentVersionSchema = z.object({
  ruleId: ruleIdSchema,
  versionId: ruleVersionIdSchema,
  idempotencyKey: idempotencyKeySchema,
})

export type SetCurrentVersionInput = z.infer<typeof setCurrentVersionSchema>

// Get version history schema
export const getVersionHistorySchema = z.object({
  ruleId: ruleIdSchema,
  ...paginationSchema.shape,
  includeStats: z.boolean().default(true),
})

export type GetVersionHistoryInput = z.infer<typeof getVersionHistorySchema>

// Compare versions schema
export const compareVersionsSchema = z.object({
  baseVersionId: ruleVersionIdSchema,
  compareVersionId: ruleVersionIdSchema,
  format: z.enum(["side-by-side", "unified", "json"]).default("side-by-side"),
})

export type CompareVersionsInput = z.infer<typeof compareVersionsSchema>

// Version stats schema
export const getVersionStatsSchema = z.object({
  versionId: ruleVersionIdSchema,
  period: z.enum(["day", "week", "month", "all"]).default("week"),
})

export type GetVersionStatsInput = z.infer<typeof getVersionStatsSchema>
