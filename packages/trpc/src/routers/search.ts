import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  router,
  publicProcedure,
  protectedProcedure,
  rateLimitedProcedure,
  requireRole,
} from "../trpc";
import {
  searchInputSchema,
  suggestInputSchema,
  refreshRuleInputSchema,
  searchResultResponseSchema,
  suggestResponseSchema,
  searchStatsResponseSchema,
  searchOperationResponseSchema,
} from "../schemas/search";
import {
  searchRulesDB,
  suggestRulesDB,
  refreshRuleSearch,
  rebuildAllSearch,
  getSearchStats,
  searchRulesSimple,
  type SearchFilters,
} from "@repo/db/search";

// Rate limited procedures for search operations
const searchRateLimitedProcedure = rateLimitedProcedure("search", 120); // 120 per minute
const suggestRateLimitedProcedure = rateLimitedProcedure("suggest", 60); // 60 per minute
const adminSearchProcedure = rateLimitedProcedure("adminSearch", 10); // 10 per minute for admin

export const searchRouter = router({
  /**
   * Main search endpoint with full-text search and trending integration
   */
  query: searchRateLimitedProcedure
    .input(searchInputSchema)
    .output(searchResultResponseSchema)
    .query(async ({ input, ctx }) => {
      const startTime = Date.now();
      const { q, filters, limit, offset } = input;

      try {
        // Convert filters to database format
        const dbFilters: SearchFilters = {
          tags: filters.tags,
          model: filters.model,
          status: filters.status,
          contentType: filters.contentType,
          authorHandle: filters.authorHandle,
          dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
          dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined,
        };

        // Use simple search for very short queries, FTS for longer ones
        const results =
          q.trim().length < 3
            ? await searchRulesSimple(q, dbFilters, limit, offset)
            : await searchRulesDB(q, dbFilters, limit, offset);

        // Transform database results to DTOs
        const searchResults = results.map((row) => ({
          id: row.ruleId,
          slug: row.slug,
          title: row.title,
          summary: row.summary,
          author: {
            id: row.authorId,
            handle: row.authorHandle,
            displayName: row.authorDisplayName,
            avatarUrl: row.authorAvatarUrl,
          },
          tags: row.tags,
          primaryModel: row.primaryModel,
          status: row.status,
          score: row.scoreFinal,
          ftsRank: row.ftsRank,
          trending: row.trend,
          snippetHtml: row.snippet,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }));

        const took = Date.now() - startTime;

        return {
          results: searchResults,
          pagination: {
            total: searchResults.length, // Approximate - exact count would be expensive
            hasMore: searchResults.length === limit,
            nextOffset:
              searchResults.length === limit ? offset + limit : undefined,
          },
          meta: {
            query: q,
            filters: filters,
            took,
          },
        };
      } catch (error) {
        console.error("Search query failed:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Search query failed",
        });
      }
    }),

  /**
   * Search suggestions for autocomplete
   */
  suggest: suggestRateLimitedProcedure
    .input(suggestInputSchema)
    .output(suggestResponseSchema)
    .query(async ({ input }) => {
      const { q, limit } = input;

      try {
        const suggestions = await suggestRulesDB(q, limit);

        return {
          suggestions: suggestions.map((row) => ({
            id: row.ruleId,
            slug: row.slug,
            title: row.title,
            similarity: row.similarity,
          })),
        };
      } catch (error) {
        console.error("Search suggestions failed:", error);
        // Return empty suggestions on error rather than failing
        return { suggestions: [] };
      }
    }),

  /**
   * Get search facets for filtering UI
   */
  getFacets: publicProcedure
    .input(
      z.object({
        q: z.string().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        // Get popular tags
        const tags = await ctx.prisma.tag.findMany({
          include: {
            _count: {
              select: {
                rules: {
                  where: { status: "PUBLISHED" },
                },
              },
            },
          },
          orderBy: {
            rules: { _count: "desc" },
          },
          take: input.limit,
        });

        // Get popular models
        const models = await ctx.prisma.rule.groupBy({
          by: ["primaryModel"],
          where: {
            status: "PUBLISHED",
            primaryModel: { not: null },
          },
          _count: true,
          orderBy: { _count: "desc" },
          take: input.limit,
        });

        // Get active authors
        const authors = await ctx.prisma.user.findMany({
          include: {
            _count: {
              select: {
                rulesCreated: {
                  where: { status: "PUBLISHED" },
                },
              },
            },
          },
          where: {
            rulesCreated: {
              some: { status: "PUBLISHED" },
            },
          },
          orderBy: {
            rulesCreated: { _count: "desc" },
          },
          take: input.limit,
        });

        // Get content type distribution
        const contentTypes = await ctx.prisma.rule.groupBy({
          by: ["contentType"],
          where: { status: "PUBLISHED" },
          _count: true,
          orderBy: { _count: "desc" },
        });

        return {
          tags: tags
            .filter((tag) => tag._count.rules > 0)
            .map((tag) => ({
              name: tag.name,
              slug: tag.slug,
              count: tag._count.rules,
            })),
          models: models.map((model) => ({
            name: model.primaryModel!,
            count: model._count,
          })),
          authors: authors
            .filter((author) => author._count.rulesCreated > 0)
            .map((author) => ({
              handle: author.handle,
              displayName: author.displayName,
              count: author._count.rulesCreated,
            })),
          contentTypes: contentTypes.map((ct) => ({
            type: ct.contentType,
            count: ct._count,
          })),
        };
      } catch (error) {
        console.error("Failed to get search facets:", error);
        return {
          tags: [],
          models: [],
          authors: [],
          contentTypes: [],
        };
      }
    }),

  /**
   * Refresh search index for a specific rule
   */
  refreshRule: protectedProcedure
    .input(refreshRuleInputSchema)
    .output(searchOperationResponseSchema)
    .mutation(async ({ input }) => {
      const { ruleId } = input;

      try {
        await refreshRuleSearch(ruleId);
        return {
          success: true,
          message: `Search index refreshed for rule ${ruleId}`,
        };
      } catch (error) {
        console.error(`Failed to refresh search for rule ${ruleId}:`, error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to refresh search index",
        });
      }
    }),

  /**
   * Get search statistics (admin only)
   */
  getStats: requireRole("ADMIN")
    .output(searchStatsResponseSchema)
    .query(async () => {
      try {
        const stats = await getSearchStats();
        return stats;
      } catch (error) {
        console.error("Failed to get search stats:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to get search statistics",
        });
      }
    }),

  /**
   * Rebuild all search indexes (admin only)
   */
  rebuildAll: adminSearchProcedure
    .use(requireRole("ADMIN"))
    .output(searchOperationResponseSchema)
    .mutation(async () => {
      try {
        const count = await rebuildAllSearch();
        return {
          success: true,
          message: `Rebuilt search indexes for ${count} rules`,
          count,
        };
      } catch (error) {
        console.error("Failed to rebuild search indexes:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to rebuild search indexes",
        });
      }
    }),

  /**
   * Search with advanced filters and sorting
   */
  advanced: searchRateLimitedProcedure
    .input(
      z.object({
        q: z.string().trim().min(1).max(200),
        tags: z.array(z.string()).optional(),
        excludeTags: z.array(z.string()).optional(),
        models: z.array(z.string()).optional(),
        authors: z.array(z.string()).optional(),
        contentTypes: z
          .array(z.enum(["PROMPT", "RULE", "MCP", "GUIDE"]))
          .optional(),
        statuses: z.array(z.enum(["PUBLISHED", "DEPRECATED"])).optional(),
        dateRange: z
          .object({
            from: z.string().datetime(),
            to: z.string().datetime(),
          })
          .optional(),
        sortBy: z
          .enum(["relevance", "date", "score", "trending", "title"])
          .default("relevance"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
        limit: z.number().int().min(1).max(100).default(20),
        offset: z.number().int().min(0).max(1000).default(0),
      })
    )
    .query(async ({ input }) => {
      // Advanced search implementation would go here
      // For now, fall back to basic search
      const basicFilters: SearchFilters = {
        tags: input.tags,
        model: input.models?.[0],
        status: input.statuses?.includes("DEPRECATED") ? "ALL" : "PUBLISHED",
        contentType: input.contentTypes?.[0],
        authorHandle: input.authors?.[0],
        dateFrom: input.dateRange ? new Date(input.dateRange.from) : undefined,
        dateTo: input.dateRange ? new Date(input.dateRange.to) : undefined,
      };

      const results = await searchRulesDB(
        input.q,
        basicFilters,
        input.limit,
        input.offset
      );

      return {
        results: results.map((row) => ({
          id: row.ruleId,
          slug: row.slug,
          title: row.title,
          summary: row.summary,
          author: {
            id: row.authorId,
            handle: row.authorHandle,
            displayName: row.authorDisplayName,
            avatarUrl: row.authorAvatarUrl,
          },
          tags: row.tags,
          primaryModel: row.primaryModel,
          status: row.status,
          score: row.scoreFinal,
          ftsRank: row.ftsRank,
          trending: row.trend,
          snippetHtml: row.snippet,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })),
        pagination: {
          total: results.length,
          hasMore: results.length === input.limit,
          nextOffset:
            results.length === input.limit
              ? input.offset + input.limit
              : undefined,
        },
        meta: {
          query: input.q,
          filters: {
            tags: input.tags,
            models: input.models,
            authors: input.authors,
            contentTypes: input.contentTypes,
            statuses: input.statuses,
            dateRange: input.dateRange,
            sortBy: input.sortBy,
            sortOrder: input.sortOrder,
          },
          took: 0, // Would be calculated in real implementation
        },
      };
    }),

  /**
   * Get popular search terms (for analytics/suggestions)
   */
  getPopularTerms: publicProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(10),
        period: z.enum(["day", "week", "month"]).default("week"),
      })
    )
    .query(async ({ input }) => {
      // This would require storing search analytics
      // For now, return empty array
      return {
        terms: [],
        period: input.period,
      };
    }),
});
