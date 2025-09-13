import { z } from "zod";
import {
  ruleIdSchema,
  tagIdSchema,
  slugSchema,
  paginationSchema,
  idempotencyKeySchema,
} from "./base";

// List tags schema
export const listTagsSchema = z.object({
  ...paginationSchema.shape,
  search: z.string().optional(),
  sort: z.enum(["name", "count", "recent"]).default("count"),
  includeCount: z.boolean().default(true),
});

export type ListTagsInput = z.infer<typeof listTagsSchema>;

// Get tag by slug schema
export const getTagBySlugSchema = z.object({
  slug: slugSchema,
  includeStats: z.boolean().default(true),
});

export type GetTagBySlugInput = z.infer<typeof getTagBySlugSchema>;

// Attach tags schema
export const attachTagsSchema = z.object({
  ruleId: ruleIdSchema,
  tagSlugs: z.array(slugSchema).min(1).max(10),
  idempotencyKey: idempotencyKeySchema,
});

export type AttachTagsInput = z.infer<typeof attachTagsSchema>;

// Detach tags schema
export const detachTagsSchema = z.object({
  ruleId: ruleIdSchema,
  tagSlugs: z.array(slugSchema).min(1),
  idempotencyKey: idempotencyKeySchema,
});

export type DetachTagsInput = z.infer<typeof detachTagsSchema>;

// Create tag schema (admin/mod only)
export const createTagSchema = z.object({
  slug: slugSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  idempotencyKey: idempotencyKeySchema,
});

export type CreateTagInput = z.infer<typeof createTagSchema>;

// Update tag schema (admin/mod only)
export const updateTagSchema = z.object({
  tagId: tagIdSchema,
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  idempotencyKey: idempotencyKeySchema,
});

export type UpdateTagInput = z.infer<typeof updateTagSchema>;

// Get popular tags schema
export const getPopularTagsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  period: z.enum(["day", "week", "month", "all"]).default("month"),
});

export type GetPopularTagsInput = z.infer<typeof getPopularTagsSchema>;

// Get tag suggestions schema
export const getTagSuggestionsSchema = z.object({
  query: z.string().min(1).max(50),
  limit: z.number().int().min(1).max(20).default(10),
  excludeExisting: z.array(slugSchema).optional(),
});

export type GetTagSuggestionsInput = z.infer<typeof getTagSuggestionsSchema>;
