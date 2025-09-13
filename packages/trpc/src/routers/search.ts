import { z } from "zod";
import { router, publicProcedure, adminProcedure } from "../trpc";
import {
  searchQuerySchema,
  searchSuggestionsSchema,
  advancedSearchSchema,
  searchAnalyticsSchema,
  popularSearchesSchema,
} from "../schemas/search";
import { searchResultDTOSchema } from "../schemas/dto";
import { createPaginatedSchema } from "../schemas/base";

export const searchRouter = router({
  // Main search query
  query: publicProcedure
    .input(searchQuerySchema)
    .output(createPaginatedSchema(searchResultDTOSchema))
    .query(async ({ input, ctx }) => {
      const {
        q,
        filters,
        cursor,
        limit,
        sort,
        includeSnippets,
        highlightTerms,
      } = input;

      // Build base where clause
      const where: any = {
        deletedAt: null,
        status: "PUBLISHED", // Only search published rules
        ...(filters?.status && { status: filters.status }),
        ...(filters?.contentType && { contentType: filters.contentType }),
        ...(filters?.authorId && { createdByUserId: filters.authorId }),
        ...(filters?.createdAfter && {
          createdAt: { gte: filters.createdAfter },
        }),
        ...(filters?.createdBefore && {
          createdAt: {
            ...(filters.createdAfter ? { gte: filters.createdAfter } : {}),
            lte: filters.createdBefore,
          },
        }),
        ...(filters?.model && {
          primaryModel: { contains: filters.model, mode: "insensitive" },
        }),
        ...(filters?.minScore && { score: { gte: filters.minScore } }),
        ...(filters?.tags &&
          filters.tags.length > 0 && {
            tags: {
              some: {
                tag: {
                  slug: { in: filters.tags },
                },
              },
            },
          }),
      };

      let results: any[] = [];
      let hasMore = false;
      let nextCursor: string | undefined;

      if (sort === "relevance") {
        // Use full-text search
        const searchResults = await ctx.prisma.$queryRaw<
          Array<{
            id: string;
            slug: string;
            title: string;
            summary: string | null;
            contentType: string;
            status: string;
            primaryModel: string | null;
            createdAt: Date;
            updatedAt: Date;
            score: number;
            rank: number;
          }>
        >`
          SELECT 
            r.id,
            r.slug,
            r.title,
            r.summary,
            r."contentType",
            r.status,
            r."primaryModel",
            r."createdAt",
            r."updatedAt",
            r.score,
            ts_rank_cd(rs.tsv, plainto_tsquery('english', unaccent(${q}))) as rank
          FROM rules r
          INNER JOIN rule_search rs ON r.id = rs."ruleId"
          WHERE r."deletedAt" IS NULL 
            AND r.status = 'PUBLISHED'
            AND rs.tsv @@ plainto_tsquery('english', unaccent(${q}))
          ORDER BY rank DESC, r."createdAt" DESC
          LIMIT ${limit + 1}
          OFFSET ${cursor ? parseInt(cursor) : 0}
        `;

        hasMore = searchResults.length > limit;
        const items = hasMore ? searchResults.slice(0, -1) : searchResults;
        nextCursor = hasMore
          ? String((cursor ? parseInt(cursor) : 0) + limit)
          : undefined;

        // Get additional data for each result
        const ruleIds = items.map((r) => r.id);

        const [authors, tags, currentVersions, metrics] = await Promise.all([
          ctx.prisma.user.findMany({
            where: {
              rulesCreated: {
                some: { id: { in: ruleIds } },
              },
            },
            select: {
              id: true,
              handle: true,
              displayName: true,
              avatarUrl: true,
              role: true,
              rulesCreated: {
                where: { id: { in: ruleIds } },
                select: { id: true },
              },
              authorProfile: {
                select: { isVerified: true },
              },
            },
          }),
          ctx.prisma.ruleTag.findMany({
            where: { ruleId: { in: ruleIds } },
            include: {
              tag: {
                select: { id: true, slug: true, name: true },
              },
            },
          }),
          ctx.prisma.ruleVersion.findMany({
            where: {
              rulesUsingAsCurrent: {
                some: { id: { in: ruleIds } },
              },
            },
            select: {
              id: true,
              version: true,
              testedOn: true,
              createdAt: true,
              rulesUsingAsCurrent: {
                where: { id: { in: ruleIds } },
                select: { id: true },
              },
            },
          }),
          // Get 7-day metrics
          ctx.prisma.event.groupBy({
            by: ["ruleId", "type"],
            where: {
              ruleId: { in: ruleIds },
              createdAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              },
              type: { in: ["VIEW", "COPY", "SAVE", "FORK"] },
            },
            _count: true,
          }),
        ]);

        // Create lookup maps
        const authorMap = new Map();
        authors.forEach((author) => {
          author.rulesCreated.forEach((rule) => {
            authorMap.set(rule.id, author);
          });
        });

        const tagsMap = new Map();
        tags.forEach((rt) => {
          if (!tagsMap.has(rt.ruleId)) {
            tagsMap.set(rt.ruleId, []);
          }
          tagsMap.get(rt.ruleId).push(rt.tag);
        });

        const versionMap = new Map();
        currentVersions.forEach((version) => {
          version.rulesUsingAsCurrent.forEach((rule) => {
            versionMap.set(rule.id, version);
          });
        });

        const metricsMap = new Map();
        metrics.forEach((metric) => {
          if (!metricsMap.has(metric.ruleId)) {
            metricsMap.set(metric.ruleId, {});
          }
          metricsMap.get(metric.ruleId)[metric.type] = metric._count;
        });

        results = items.map((rule) => {
          const author = authorMap.get(rule.id);
          const ruleTags = tagsMap.get(rule.id) || [];
          const currentVersion = versionMap.get(rule.id);
          const ruleMetrics = metricsMap.get(rule.id) || {};

          return {
            id: rule.id,
            slug: rule.slug,
            title: rule.title,
            summary: rule.summary,
            contentType: rule.contentType,
            status: rule.status,
            primaryModel: rule.primaryModel,
            tags: ruleTags,
            score: rule.score,
            author: author
              ? {
                  id: author.id,
                  handle: author.handle,
                  displayName: author.displayName,
                  avatarUrl: author.avatarUrl,
                  role: author.role,
                  isVerified: author.authorProfile?.isVerified || false,
                }
              : null,
            currentVersion: currentVersion
              ? {
                  id: currentVersion.id,
                  version: currentVersion.version,
                  testedOn: currentVersion.testedOn,
                  createdAt: currentVersion.createdAt,
                }
              : null,
            metrics: {
              views7: ruleMetrics.VIEW || 0,
              copies7: ruleMetrics.COPY || 0,
              saves7: ruleMetrics.SAVE || 0,
              forks7: ruleMetrics.FORK || 0,
              score: rule.score,
            },
            createdAt: rule.createdAt,
            updatedAt: rule.updatedAt,
            rank: rule.rank,
            snippet: includeSnippets
              ? `${rule.title} - ${rule.summary || ""}`.substring(0, 200)
              : undefined,
            highlights: highlightTerms ? [q] : undefined,
          };
        });
      } else {
        // Use regular database search for other sort orders
        let orderBy: any;
        switch (sort) {
          case "top":
            orderBy = [{ score: "desc" }, { createdAt: "desc" }];
            break;
          case "trending":
            orderBy = [{ updatedAt: "desc" }, { score: "desc" }];
            break;
          case "new":
          default:
            orderBy = [{ createdAt: "desc" }];
        }

        // Add text search to where clause
        where.OR = [
          { title: { contains: q, mode: "insensitive" } },
          { summary: { contains: q, mode: "insensitive" } },
        ];

        if (cursor) {
          const cursorRule = await ctx.prisma.rule.findUnique({
            where: { id: cursor },
            select: { createdAt: true, score: true },
          });

          if (cursorRule) {
            if (sort === "top") {
              where.OR = [
                { score: { lt: cursorRule.score } },
                {
                  score: cursorRule.score,
                  createdAt: { lt: cursorRule.createdAt },
                },
              ];
            } else {
              where.createdAt = { lt: cursorRule.createdAt };
            }
          }
        }

        const rules = await ctx.prisma.rule.findMany({
          where,
          orderBy,
          take: limit + 1,
          include: {
            createdBy: {
              select: {
                id: true,
                handle: true,
                displayName: true,
                avatarUrl: true,
                role: true,
                authorProfile: {
                  select: { isVerified: true },
                },
              },
            },
            currentVersion: {
              select: {
                id: true,
                version: true,
                testedOn: true,
                createdAt: true,
              },
            },
            tags: {
              include: {
                tag: {
                  select: {
                    id: true,
                    slug: true,
                    name: true,
                  },
                },
              },
            },
          },
        });

        hasMore = rules.length > limit;
        const items = hasMore ? rules.slice(0, -1) : rules;
        nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

        results = items.map((rule) => ({
          id: rule.id,
          slug: rule.slug,
          title: rule.title,
          summary: rule.summary,
          contentType: rule.contentType,
          status: rule.status,
          primaryModel: rule.primaryModel,
          tags: rule.tags.map((rt) => rt.tag),
          score: rule.score || 0,
          author: {
            id: rule.createdBy.id,
            handle: rule.createdBy.handle,
            displayName: rule.createdBy.displayName,
            avatarUrl: rule.createdBy.avatarUrl,
            role: rule.createdBy.role,
            isVerified: rule.createdBy.authorProfile?.isVerified || false,
          },
          currentVersion: rule.currentVersion
            ? {
                id: rule.currentVersion.id,
                version: rule.currentVersion.version,
                testedOn: rule.currentVersion.testedOn,
                createdAt: rule.currentVersion.createdAt,
              }
            : null,
          metrics: {
            views7: 0,
            copies7: 0,
            saves7: 0,
            forks7: 0,
            score: rule.score || 0,
          },
          createdAt: rule.createdAt,
          updatedAt: rule.updatedAt,
          rank: 1.0, // Default rank for non-FTS results
          snippet: includeSnippets
            ? `${rule.title} - ${rule.summary || ""}`.substring(0, 200)
            : undefined,
          highlights: highlightTerms ? [q] : undefined,
        }));
      }

      return {
        items: results,
        nextCursor,
        hasMore,
      };
    }),

  // Search suggestions
  suggestions: publicProcedure
    .input(searchSuggestionsSchema)
    .output(
      z.object({
        rules: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            slug: z.string(),
          })
        ),
        authors: z.array(
          z.object({
            id: z.string(),
            handle: z.string(),
            displayName: z.string(),
          })
        ),
        tags: z.array(
          z.object({
            id: z.string(),
            slug: z.string(),
            name: z.string(),
          })
        ),
      })
    )
    .query(async ({ input, ctx }) => {
      const { q, limit, types } = input;

      const results = await Promise.all([
        types.includes("rules")
          ? ctx.prisma.rule.findMany({
              where: {
                deletedAt: null,
                status: "PUBLISHED",
                title: { contains: q, mode: "insensitive" },
              },
              select: { id: true, title: true, slug: true },
              take: Math.ceil(limit / types.length),
              orderBy: { score: "desc" },
            })
          : [],

        types.includes("authors")
          ? ctx.prisma.user.findMany({
              where: {
                OR: [
                  { handle: { contains: q, mode: "insensitive" } },
                  { displayName: { contains: q, mode: "insensitive" } },
                ],
              },
              select: { id: true, handle: true, displayName: true },
              take: Math.ceil(limit / types.length),
            })
          : [],

        types.includes("tags")
          ? ctx.prisma.tag.findMany({
              where: {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { slug: { contains: q, mode: "insensitive" } },
                ],
              },
              select: { id: true, slug: true, name: true },
              take: Math.ceil(limit / types.length),
            })
          : [],
      ]);

      return {
        rules: results[0] || [],
        authors: results[1] || [],
        tags: results[2] || [],
      };
    }),

  // Popular searches (admin only)
  popular: adminProcedure
    .input(popularSearchesSchema)
    .output(
      z.array(
        z.object({
          query: z.string(),
          count: z.number(),
          lastSearched: z.date(),
        })
      )
    )
    .query(async ({ input, ctx }) => {
      const { period, limit } = input;

      // This would typically be stored in a separate search_queries table
      // For now, return empty array as placeholder
      return [];
    }),
});
