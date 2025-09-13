import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  router,
  publicProcedure,
  protectedProcedure,
  rateLimitedProcedure,
  audit,
  getRuleOwnership,
} from "../trpc";
import {
  createRuleSchema,
  updateRuleSchema,
  listRulesSchema,
  getRuleBySlugSchema,
  getRuleByIdSchema,
  publishRuleSchema,
  deprecateRuleSchema,
  softDeleteRuleSchema,
  getRulesByAuthorSchema,
  getTrendingRulesSchema,
  duplicateRuleSchema,
  getRuleStatsSchema,
} from "../schemas/rule";
import { ruleCardDTOSchema, ruleDetailDTOSchema } from "../schemas/dto";
import { GamificationService } from "../services/gamification";
import { AuditLogService } from "../services/audit-log";
import { createPaginatedSchema } from "../schemas/base";

export const rulesRouter = router({
  // List rules with pagination and filtering
  list: publicProcedure
    .input(listRulesSchema)
    .output(createPaginatedSchema(ruleCardDTOSchema))
    .query(async ({ input, ctx }) => {
      const { cursor, limit, sort, filters } = input;

      // Build where clause
      const where: any = {
        deletedAt: null,
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

      // Build orderBy
      let orderBy: any;
      switch (sort) {
        case "top":
          orderBy = [{ score: "desc" }, { createdAt: "desc" }];
          break;
        case "trending":
          // For trending, we'd typically use recent metrics, but for now use score
          orderBy = [{ updatedAt: "desc" }, { score: "desc" }];
          break;
        case "new":
        default:
          orderBy = [{ createdAt: "desc" }];
      }

      // Handle cursor pagination
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
          _count: {
            select: {
              votes: true,
              favorites: true,
              comments: { where: { deletedAt: null } },
            },
          },
        },
      });

      const hasMore = rules.length > limit;
      const items = hasMore ? rules.slice(0, -1) : rules;
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

      // Get metrics for the last 7 days
      const ruleIds = items.map((r) => r.id);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const metrics = await ctx.prisma.event.groupBy({
        by: ["ruleId", "type"],
        where: {
          ruleId: { in: ruleIds },
          createdAt: { gte: sevenDaysAgo },
          type: { in: ["VIEW", "COPY", "SAVE", "FORK"] },
        },
        _count: true,
      });

      // Transform to DTO format
      const transformedItems = items.map((rule) => ({
        id: rule.id,
        slug: rule.slug,
        title: rule.title,
        summary: rule.summary,
        contentType: rule.contentType,
        status: rule.status,
        primaryModel: rule.primaryModel,
        tags: rule.tags.map((rt) => ({
          id: rt.tag.id,
          slug: rt.tag.slug,
          name: rt.tag.name,
        })),
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
          views7:
            metrics.find((m) => m.ruleId === rule.id && m.type === "VIEW")
              ?._count || 0,
          copies7:
            metrics.find((m) => m.ruleId === rule.id && m.type === "COPY")
              ?._count || 0,
          saves7:
            metrics.find((m) => m.ruleId === rule.id && m.type === "SAVE")
              ?._count || 0,
          forks7:
            metrics.find((m) => m.ruleId === rule.id && m.type === "FORK")
              ?._count || 0,
          score: rule.score || 0,
        },
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      }));

      return {
        items: transformedItems,
        nextCursor,
        hasMore,
        total: undefined, // Could add total count if needed
      };
    }),

  // Get rule by slug
  getBySlug: publicProcedure
    .input(getRuleBySlugSchema)
    .output(ruleDetailDTOSchema.nullable())
    .query(async ({ input, ctx }) => {
      const { slug, includeMetrics, includeUserActions } = input;

      const rule = await ctx.prisma.rule.findUnique({
        where: { slug, deletedAt: null },
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
              body: true,
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
          resourceLinks: true,
          versions: {
            select: { id: true },
            where: { deletedAt: null },
          },
          _count: {
            select: {
              votes: true,
              favorites: true,
              comments: { where: { deletedAt: null } },
              watches: true,
            },
          },
        },
      });

      if (!rule) {
        return null;
      }

      // Get user-specific data if authenticated
      let userVote = null;
      let userFavorited = false;
      let userWatching = false;

      if (ctx.user && includeUserActions) {
        const [vote, favorite, watch] = await Promise.all([
          ctx.prisma.vote.findUnique({
            where: {
              userId_ruleId: {
                userId: ctx.user.id,
                ruleId: rule.id,
              },
            },
          }),
          ctx.prisma.favorite.findUnique({
            where: {
              userId_ruleId: {
                userId: ctx.user.id,
                ruleId: rule.id,
              },
            },
          }),
          ctx.prisma.watch.findUnique({
            where: {
              userId_ruleId: {
                userId: ctx.user.id,
                ruleId: rule.id,
              },
            },
          }),
        ]);

        userVote = vote ? (vote.value > 0 ? "up" : "down") : null;
        userFavorited = !!favorite;
        userWatching = !!watch;
      }

      // Get metrics if requested
      let metrics = {
        views7: 0,
        copies7: 0,
        saves7: 0,
        forks7: 0,
        score: rule.score || 0,
      };

      if (includeMetrics) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const eventMetrics = await ctx.prisma.event.groupBy({
          by: ["type"],
          where: {
            ruleId: rule.id,
            createdAt: { gte: sevenDaysAgo },
            type: { in: ["VIEW", "COPY", "SAVE", "FORK"] },
          },
          _count: true,
        });

        metrics = {
          views7: eventMetrics.find((m) => m.type === "VIEW")?._count || 0,
          copies7: eventMetrics.find((m) => m.type === "COPY")?._count || 0,
          saves7: eventMetrics.find((m) => m.type === "SAVE")?._count || 0,
          forks7: eventMetrics.find((m) => m.type === "FORK")?._count || 0,
          score: rule.score || 0,
        };
      }

      return {
        id: rule.id,
        slug: rule.slug,
        title: rule.title,
        summary: rule.summary,
        contentType: rule.contentType,
        status: rule.status,
        primaryModel: rule.primaryModel,
        body: rule.currentVersion?.body || null,
        tags: rule.tags.map((rt) => ({
          id: rt.tag.id,
          slug: rt.tag.slug,
          name: rt.tag.name,
        })),
        resourceLinks: rule.resourceLinks.map((rl) => ({
          label: rl.label,
          url: rl.url,
          kind: rl.kind as any,
        })),
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
        metrics,
        versionsCount: rule.versions.length,
        commentsCount: rule._count.comments,
        votesCount: rule._count.votes,
        favoritesCount: rule._count.favorites,
        watchersCount: rule._count.watches,
        userVote: userVote as any,
        userFavorited,
        userWatching,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      };
    }),

  // Create new rule
  create: rateLimitedProcedure
    .input(createRuleSchema)
    .use(audit("rule.create"))
    .output(z.object({ id: z.string(), slug: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const {
        title,
        summary,
        contentType,
        primaryModel,
        tags,
        body,
        testedOn,
        links,
        idempotencyKey,
      } = input;

      // Check for idempotency
      if (idempotencyKey) {
        const existing = await ctx.prisma.auditLog.findFirst({
          where: {
            actorUserId: ctx.user.id,
            action: "rule.create",
            diff: {
              path: ["idempotencyKey"],
              equals: idempotencyKey,
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        });

        if (
          existing &&
          existing.createdAt > new Date(Date.now() - 10 * 60 * 1000)
        ) {
          const entityId = existing.entityId;
          const rule = await ctx.prisma.rule.findUnique({
            where: { id: entityId },
            select: { id: true, slug: true },
          });
          if (rule) {
            return { id: rule.id, slug: rule.slug };
          }
        }
      }

      // Generate unique slug from title
      let slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      // Ensure slug uniqueness
      let counter = 0;
      let finalSlug = slug;
      while (true) {
        const existing = await ctx.prisma.rule.findUnique({
          where: { slug: finalSlug },
        });
        if (!existing) break;
        counter++;
        finalSlug = `${slug}-${counter}`;
      }

      // Create rule and initial version in transaction
      const result = await ctx.prisma.$transaction(async (tx) => {
        // Create the rule
        const rule = await tx.rule.create({
          data: {
            slug: finalSlug,
            title,
            summary,
            contentType,
            primaryModel,
            status: "DRAFT",
            createdByUserId: ctx.user.id,
            score: 0,
          },
        });

        // Create initial version
        const version = await tx.ruleVersion.create({
          data: {
            ruleId: rule.id,
            version: "0.1.0",
            body,
            testedOn: testedOn || null,
            changelog: "Initial version",
            createdByUserId: ctx.user.id,
          },
        });

        // Set current version
        await tx.rule.update({
          where: { id: rule.id },
          data: { currentVersionId: version.id },
        });

        // Add tags if provided
        if (tags && tags.length > 0) {
          // Find or create tags
          const tagRecords = await Promise.all(
            tags.map(async (tagSlug) => {
              const tag = await tx.tag.upsert({
                where: { slug: tagSlug },
                update: {},
                create: {
                  slug: tagSlug,
                  name: tagSlug.charAt(0).toUpperCase() + tagSlug.slice(1),
                },
              });
              return tag;
            })
          );

          // Create rule-tag relationships
          await tx.ruleTag.createMany({
            data: tagRecords.map((tag) => ({
              ruleId: rule.id,
              tagId: tag.id,
            })),
          });
        }

        // Add resource links if provided
        if (links && links.length > 0) {
          await tx.resourceLink.createMany({
            data: links.map((link) => ({
              ruleId: rule.id,
              label: link.label,
              url: link.url,
              kind: link.kind,
            })),
          });
        }

        return { id: rule.id, slug: rule.slug };
      });

      return result;
    }),

  // Update rule
  update: rateLimitedProcedure
    .input(updateRuleSchema)
    .use(audit("rule.update"))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const {
        ruleId,
        title,
        summary,
        primaryModel,
        tags,
        links,
        idempotencyKey,
      } = input;

      const { rule, canEdit } = await getRuleOwnership(ctx, ruleId);

      if (!canEdit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to edit this rule",
        });
      }

      // Cannot edit published rules' core properties (only mods/admins can)
      if (rule.status === "PUBLISHED" && ctx.user.role === "USER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Published rules can only be edited by moderators or admins",
        });
      }

      await ctx.prisma.$transaction(async (tx) => {
        // Update rule
        await tx.rule.update({
          where: { id: ruleId },
          data: {
            ...(title && { title }),
            ...(summary !== undefined && { summary }),
            ...(primaryModel !== undefined && { primaryModel }),
          },
        });

        // Update tags if provided
        if (tags) {
          // Remove existing tags
          await tx.ruleTag.deleteMany({
            where: { ruleId },
          });

          if (tags.length > 0) {
            // Find or create new tags
            const tagRecords = await Promise.all(
              tags.map(async (tagSlug) => {
                const tag = await tx.tag.upsert({
                  where: { slug: tagSlug },
                  update: {},
                  create: {
                    slug: tagSlug,
                    name: tagSlug.charAt(0).toUpperCase() + tagSlug.slice(1),
                  },
                });
                return tag;
              })
            );

            // Create new rule-tag relationships
            await tx.ruleTag.createMany({
              data: tagRecords.map((tag) => ({
                ruleId,
                tagId: tag.id,
              })),
            });
          }
        }

        // Update resource links if provided
        if (links) {
          // Remove existing links
          await tx.resourceLink.deleteMany({
            where: { ruleId },
          });

          if (links.length > 0) {
            // Create new links
            await tx.resourceLink.createMany({
              data: links.map((link) => ({
                ruleId,
                label: link.label,
                url: link.url,
                kind: link.kind,
              })),
            });
          }
        }
      });

      return { success: true };
    }),

  // Publish rule
  publish: rateLimitedProcedure
    .input(publishRuleSchema)
    .use(audit("rule.publish"))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const { ruleId } = input;

      const { rule, canEdit } = await getRuleOwnership(ctx, ruleId);

      if (!canEdit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to publish this rule",
        });
      }

      if (rule.status === "PUBLISHED") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Rule is already published",
        });
      }

      // Ensure rule has a current version
      const ruleWithVersion = await ctx.prisma.rule.findUnique({
        where: { id: ruleId },
        include: { currentVersion: true },
      });

      if (!ruleWithVersion?.currentVersion) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Rule must have a current version before publishing",
        });
      }

      await ctx.prisma.rule.update({
        where: { id: ruleId },
        data: { status: "PUBLISHED" },
      });

      // Log the publication
      await AuditLogService.logRulePublish(ruleId, ctx.user!.id, {
        title: rule.title,
        slug: rule.slug,
        previousStatus: rule.status,
      });

      // Award first contribution badge if this is their first published rule
      try {
        const awardContext = {
          prisma: ctx.prisma,
          now: new Date(),
        };
        await GamificationService.checkFirstContribution(
          awardContext,
          ctx.user!.id
        );
      } catch (error) {
        console.error("Failed to check first contribution badge:", error);
      }

      return { success: true };
    }),

  // Soft delete rule
  softDelete: rateLimitedProcedure
    .input(softDeleteRuleSchema)
    .use(audit("rule.delete"))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const { ruleId, reason } = input;

      const { rule, canEdit } = await getRuleOwnership(ctx, ruleId);

      if (!canEdit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to delete this rule",
        });
      }

      await ctx.prisma.rule.update({
        where: { id: ruleId },
        data: {
          deletedAt: ctx.now,
          status: "DEPRECATED",
        },
      });

      return { success: true };
    }),
});
