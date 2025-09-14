import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  router,
  publicProcedure,
  protectedProcedure,
  rateLimitedProcedure,
  modProcedure,
  audit,
  getRuleOwnership,
} from "../trpc";
import {
  listTagsSchema,
  getTagBySlugSchema,
  attachTagsSchema,
  detachTagsSchema,
  createTagSchema,
  updateTagSchema,
  getPopularTagsSchema,
  getTagSuggestionsSchema,
} from "../schemas/tags";
import { tagDTOSchema } from "../schemas/dto";
import { createPaginatedSchema } from "../schemas/base";

export const tagsRouter = router({
  // List all tags
  list: publicProcedure
    .input(listTagsSchema)
    .output(createPaginatedSchema(tagDTOSchema))
    .query(async ({ input, ctx }) => {
      const { cursor, limit, search, sort, includeCount } = input;

      const where: any = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { slug: { contains: search, mode: "insensitive" } },
        ];
      }

      if (cursor) {
        where.id = { gt: cursor };
      }

      let orderBy: any;
      switch (sort) {
        case "name":
          orderBy = { name: "asc" };
          break;
        case "recent":
          orderBy = { id: "desc" };
          break;
        case "count":
        default:
          orderBy = includeCount
            ? { rules: { _count: "desc" } }
            : { name: "asc" };
      }

      const tags = await ctx.prisma.tag.findMany({
        where,
        orderBy,
        take: limit + 1,
        include: includeCount
          ? {
              _count: {
                select: {
                  rules: {
                    where: {
                      rule: { deletedAt: null, status: "PUBLISHED" },
                    },
                  },
                },
              },
            }
          : undefined,
      });

      const hasMore = tags.length > limit;
      const items = hasMore ? tags.slice(0, -1) : tags;
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

      return {
        items: items.map((tag) => ({
          id: tag.id,
          slug: tag.slug,
          name: tag.name,
          count: includeCount ? (tag as any)._count?.rules || 0 : undefined,
        })),
        nextCursor,
        hasMore,
      };
    }),

  // Get tag by slug
  getBySlug: publicProcedure
    .input(getTagBySlugSchema)
    .output(
      tagDTOSchema
        .extend({
          rulesCount: z.number().int(),
          recentRulesCount: z.number().int(),
        })
        .nullable()
    )
    .query(async ({ input, ctx }) => {
      const { slug, includeStats } = input;

      const tag = await ctx.prisma.tag.findUnique({
        where: { slug },
        include: includeStats
          ? {
              _count: {
                select: {
                  rules: {
                    where: {
                      rule: { deletedAt: null, status: "PUBLISHED" },
                    },
                  },
                },
              },
            }
          : undefined,
      });

      if (!tag) {
        return null;
      }

      let recentRulesCount = 0;
      if (includeStats) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        recentRulesCount = await ctx.prisma.ruleTag.count({
          where: {
            tagId: tag.id,
            rule: {
              deletedAt: null,
              status: "PUBLISHED",
              createdAt: { gte: thirtyDaysAgo },
            },
          },
        });
      }

      return {
        id: tag.id,
        slug: tag.slug,
        name: tag.name,
        rulesCount: (tag as any)._count?.rules || 0,
        recentRulesCount,
      };
    }),

  // Attach tags to rule
  attach: rateLimitedProcedure
    .input(attachTagsSchema)
    .use(audit("tags.attach"))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const { ruleId, tagSlugs } = input;

      const { rule, canEdit } = await getRuleOwnership(ctx, ruleId);

      if (!canEdit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to edit this rule",
        });
      }

      await ctx.prisma.$transaction(async (tx) => {
        // Find or create tags
        const tags = await Promise.all(
          tagSlugs.map(async (slug) => {
            return tx.tag.upsert({
              where: { slug },
              update: {},
              create: {
                slug,
                name: slug.charAt(0).toUpperCase() + slug.slice(1),
              },
            });
          })
        );

        // Create rule-tag relationships (ignore duplicates)
        for (const tag of tags) {
          await tx.ruleTag.upsert({
            where: {
              ruleId_tagId: {
                ruleId,
                tagId: tag.id,
              },
            },
            update: {},
            create: {
              ruleId,
              tagId: tag.id,
            },
          });
        }
      });

      return { success: true };
    }),

  // Detach tags from rule
  detach: rateLimitedProcedure
    .input(detachTagsSchema)
    .use(audit("tags.detach"))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const { ruleId, tagSlugs } = input;

      const { rule, canEdit } = await getRuleOwnership(ctx, ruleId);

      if (!canEdit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to edit this rule",
        });
      }

      // Find tag IDs
      const tags = await ctx.prisma.tag.findMany({
        where: { slug: { in: tagSlugs } },
        select: { id: true },
      });

      if (tags.length > 0) {
        await ctx.prisma.ruleTag.deleteMany({
          where: {
            ruleId,
            tagId: { in: tags.map((t) => t.id) },
          },
        });
      }

      return { success: true };
    }),

  // Create tag (mod/admin only)
  create: modProcedure
    .input(createTagSchema)
    .use(audit("tag.create"))
    .output(tagDTOSchema)
    .mutation(async ({ input, ctx }) => {
      const { slug, name, description } = input;

      const tag = await ctx.prisma.tag.create({
        data: { slug, name },
      });

      return {
        id: tag.id,
        slug: tag.slug,
        name: tag.name,
      };
    }),

  // Get popular tags
  getPopular: publicProcedure
    .input(getPopularTagsSchema)
    .output(z.array(tagDTOSchema))
    .query(async ({ input, ctx }) => {
      const { limit, period } = input;

      let createdAfter: Date | undefined;
      if (period !== "all") {
        createdAfter = new Date();
        switch (period) {
          case "day":
            createdAfter.setDate(createdAfter.getDate() - 1);
            break;
          case "week":
            createdAfter.setDate(createdAfter.getDate() - 7);
            break;
          case "month":
            createdAfter.setDate(createdAfter.getDate() - 30);
            break;
        }
      }

      const tags = await ctx.prisma.tag.findMany({
        take: limit,
        include: {
          _count: {
            select: {
              rules: {
                where: {
                  rule: {
                    deletedAt: null,
                    status: "PUBLISHED",
                    ...(createdAfter && { createdAt: { gte: createdAfter } }),
                  },
                },
              },
            },
          },
        },
        orderBy: {
          rules: { _count: "desc" },
        },
      });

      return tags.map((tag) => ({
        id: tag.id,
        slug: tag.slug,
        name: tag.name,
        count: tag._count.rules,
      }));
    }),

  // Get tag suggestions
  getSuggestions: publicProcedure
    .input(getTagSuggestionsSchema)
    .output(z.array(tagDTOSchema))
    .query(async ({ input, ctx }) => {
      const { query, limit, excludeExisting } = input;

      const where: any = {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { slug: { contains: query, mode: "insensitive" } },
        ],
      };

      if (excludeExisting && excludeExisting.length > 0) {
        where.slug = { notIn: excludeExisting };
      }

      const tags = await ctx.prisma.tag.findMany({
        where,
        take: limit,
        orderBy: [{ name: "asc" }],
      });

      return tags.map((tag) => ({
        id: tag.id,
        slug: tag.slug,
        name: tag.name,
      }));
    }),
});
