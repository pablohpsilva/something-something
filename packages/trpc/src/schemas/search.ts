import { z } from "zod";
import { cuidOrUuidSchema, cursorSchema, limitSchema } from "./base";

/**
 * Search input schema with filters and pagination
 */
export const searchInputSchema = z.object({
  q: z.string().trim().min(1).max(200),
  filters: z
    .object({
      tags: z.array(z.string().min(1)).max(10).optional(),
      model: z.string().min(1).max(50).optional(),
      status: z.enum(["PUBLISHED", "DEPRECATED", "ALL"]).default("PUBLISHED"),
      contentType: z.enum(["PROMPT", "RULE", "MCP", "GUIDE"]).optional(),
      authorHandle: z.string().min(1).max(50).optional(),
      dateFrom: z.string().datetime().optional(),
      dateTo: z.string().datetime().optional(),
    })
    .default({}),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).max(1000).default(0),
});

/**
 * Search suggestion input schema
 */
export const suggestInputSchema = z.object({
  q: z.string().trim().min(1).max(100),
  limit: z.number().int().min(1).max(20).default(8),
});

/**
 * Search refresh input schema
 */
export const refreshRuleInputSchema = z.object({
  ruleId: cuidOrUuidSchema,
});

/**
 * Search result response schema
 */
export const searchResultResponseSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      title: z.string(),
      summary: z.string().nullable(),
      author: z.object({
        id: z.string(),
        handle: z.string(),
        displayName: z.string(),
        avatarUrl: z.string().nullable(),
      }),
      tags: z.array(z.string()),
      primaryModel: z.string().nullable(),
      status: z.string(),
      score: z.number(),
      ftsRank: z.number(),
      trending: z.number(),
      snippetHtml: z.string().nullable(),
      createdAt: z.date(),
      updatedAt: z.date(),
    })
  ),
  pagination: z.object({
    total: z.number().int(),
    hasMore: z.boolean(),
    nextOffset: z.number().int().optional(),
  }),
  meta: z.object({
    query: z.string(),
    filters: z.record(z.unknown()),
    took: z.number(),
  }),
});

/**
 * Search suggestion response schema
 */
export const suggestResponseSchema = z.object({
  suggestions: z.array(
    z.object({
      id: z.string(),
      slug: z.string(),
      title: z.string(),
      similarity: z.number(),
    })
  ),
});

/**
 * Search stats response schema
 */
export const searchStatsResponseSchema = z.object({
  totalIndexed: z.number().int(),
  lastUpdated: z.date().nullable(),
  avgTsvLength: z.number(),
});

/**
 * Search operation response schema
 */
export const searchOperationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  count: z.number().int().optional(),
});

/**
 * Advanced search filters schema
 */
export const advancedFiltersSchema = z.object({
  tags: z.array(z.string()).optional(),
  excludeTags: z.array(z.string()).optional(),
  models: z.array(z.string()).optional(),
  authors: z.array(z.string()).optional(),
  contentTypes: z.array(z.enum(["PROMPT", "RULE", "MCP", "GUIDE"])).optional(),
  statuses: z.array(z.enum(["PUBLISHED", "DEPRECATED"])).optional(),
  dateRange: z
    .object({
      from: z.string().datetime(),
      to: z.string().datetime(),
    })
    .optional(),
  scoreRange: z
    .object({
      min: z.number().min(0),
      max: z.number().min(0),
    })
    .optional(),
  sortBy: z
    .enum(["relevance", "date", "score", "trending", "title"])
    .default("relevance"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * Search facets response schema
 */
export const searchFacetsResponseSchema = z.object({
  tags: z.array(
    z.object({
      name: z.string(),
      slug: z.string(),
      count: z.number().int(),
    })
  ),
  models: z.array(
    z.object({
      name: z.string(),
      count: z.number().int(),
    })
  ),
  authors: z.array(
    z.object({
      handle: z.string(),
      displayName: z.string(),
      count: z.number().int(),
    })
  ),
  contentTypes: z.array(
    z.object({
      type: z.string(),
      count: z.number().int(),
    })
  ),
});

// Type exports
export type SearchInput = z.infer<typeof searchInputSchema>;
export type SuggestInput = z.infer<typeof suggestInputSchema>;
export type RefreshRuleInput = z.infer<typeof refreshRuleInputSchema>;
export type SearchResultResponse = z.infer<typeof searchResultResponseSchema>;
export type SuggestResponse = z.infer<typeof suggestResponseSchema>;
export type SearchStatsResponse = z.infer<typeof searchStatsResponseSchema>;
export type SearchOperationResponse = z.infer<
  typeof searchOperationResponseSchema
>;
export type AdvancedFilters = z.infer<typeof advancedFiltersSchema>;
export type SearchFacetsResponse = z.infer<typeof searchFacetsResponseSchema>;
