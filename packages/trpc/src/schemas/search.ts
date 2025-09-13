import { z } from "zod";
import {
  paginationSchema,
  tagsFilterSchema,
  modelFilterSchema,
  statusFilterSchema,
  contentTypeSchema,
  sortSchema,
} from "./base";

// Search filters schema
export const searchFiltersSchema = z.object({
  tags: tagsFilterSchema,
  model: modelFilterSchema,
  status: statusFilterSchema,
  contentType: contentTypeSchema.optional(),
  authorId: z.string().optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
  minScore: z.number().optional(),
  hasLinks: z.boolean().optional(),
  testedModels: z.array(z.string()).optional(),
});

export type SearchFilters = z.infer<typeof searchFiltersSchema>;

// Search query schema
export const searchQuerySchema = z.object({
  q: z.string().min(2).max(200),
  filters: searchFiltersSchema.optional(),
  ...paginationSchema.shape,
  sort: z.enum(["relevance", "new", "top", "trending"]).default("relevance"),
  includeSnippets: z.boolean().default(true),
  highlightTerms: z.boolean().default(true),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;

// Search suggestions schema
export const searchSuggestionsSchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.number().int().min(1).max(20).default(10),
  types: z
    .array(z.enum(["rules", "authors", "tags"]))
    .default(["rules", "authors", "tags"]),
});

export type SearchSuggestionsInput = z.infer<typeof searchSuggestionsSchema>;

// Advanced search schema
export const advancedSearchSchema = z.object({
  title: z.string().optional(),
  body: z.string().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
  excludeTags: z.array(z.string()).optional(),
  model: z.string().optional(),
  status: statusFilterSchema,
  contentType: contentTypeSchema.optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
  minScore: z.number().optional(),
  maxScore: z.number().optional(),
  hasLinks: z.boolean().optional(),
  testedModels: z.array(z.string()).optional(),
  ...paginationSchema.shape,
  sort: z.enum(["relevance", "new", "top", "trending"]).default("relevance"),
});

export type AdvancedSearchInput = z.infer<typeof advancedSearchSchema>;

// Search analytics schema (admin only)
export const searchAnalyticsSchema = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  includeNoResults: z.boolean().default(false),
});

export type SearchAnalyticsInput = z.infer<typeof searchAnalyticsSchema>;

// Popular searches schema
export const popularSearchesSchema = z.object({
  period: z.enum(["day", "week", "month"]).default("week"),
  limit: z.number().int().min(1).max(50).default(20),
});

export type PopularSearchesInput = z.infer<typeof popularSearchesSchema>;
