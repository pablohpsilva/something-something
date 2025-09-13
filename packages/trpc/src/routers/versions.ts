import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  router,
  protectedProcedure,
  rateLimitedProcedure,
  audit,
  getRuleOwnership,
} from "../trpc";
import {
  createVersionSchema,
  forkVersionSchema,
  listVersionsByRuleSchema,
  getVersionByIdSchema,
  getVersionDiffSchema,
  updateVersionSchema,
  setCurrentVersionSchema,
} from "../schemas/version";
import { ruleVersionDetailDTOSchema } from "../schemas/dto";
import { createPaginatedSchema } from "../schemas/base";

// Helper function to increment semver
function incrementVersion(
  version: string,
  type: "patch" | "minor" | "major" = "minor"
): string {
  const [major, minor, patch] = version.split(".").map(Number);

  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    default:
      return `${major}.${minor + 1}.0`;
  }
}

// Helper function to generate diff
function generateDiff(oldText: string, newText: string): any {
  // Simple line-based diff - in production you'd use a proper diff library
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  const changes = [];
  const maxLines = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i] || "";
    const newLine = newLines[i] || "";

    if (oldLine !== newLine) {
      if (oldLine && newLine) {
        changes.push({
          type: "modified",
          line: i + 1,
          old: oldLine,
          new: newLine,
        });
      } else if (oldLine) {
        changes.push({ type: "deleted", line: i + 1, content: oldLine });
      } else {
        changes.push({ type: "added", line: i + 1, content: newLine });
      }
    }
  }

  return {
    changes,
    stats: {
      additions: changes.filter((c) => c.type === "added").length,
      deletions: changes.filter((c) => c.type === "deleted").length,
      modifications: changes.filter((c) => c.type === "modified").length,
    },
  };
}

export const versionsRouter = router({
  // List versions by rule
  listByRule: protectedProcedure
    .input(listVersionsByRuleSchema)
    .output(createPaginatedSchema(ruleVersionDetailDTOSchema))
    .query(async ({ input, ctx }) => {
      const { ruleId, cursor, limit, includeBody } = input;

      // Check if rule exists and user can access it
      const rule = await ctx.prisma.rule.findUnique({
        where: { id: ruleId, deletedAt: null },
        select: { id: true, status: true, createdByUserId: true },
      });

      if (!rule) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Rule not found",
        });
      }

      // Build where clause for cursor pagination
      const where: any = { ruleId };
      if (cursor) {
        const cursorVersion = await ctx.prisma.ruleVersion.findUnique({
          where: { id: cursor },
          select: { createdAt: true },
        });
        if (cursorVersion) {
          where.createdAt = { lt: cursorVersion.createdAt };
        }
      }

      const versions = await ctx.prisma.ruleVersion.findMany({
        where,
        orderBy: { createdAt: "desc" },
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
          voteVersions: {
            where: { userId: ctx.user.id },
            select: { value: true },
          },
          _count: {
            select: { voteVersions: true },
          },
        },
      });

      const hasMore = versions.length > limit;
      const items = hasMore ? versions.slice(0, -1) : versions;
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

      // Get vote scores for versions
      const versionIds = items.map((v) => v.id);
      const voteStats = await ctx.prisma.voteVersion.groupBy({
        by: ["ruleVersionId"],
        where: { ruleVersionId: { in: versionIds } },
        _sum: { value: true },
      });

      const transformedItems = items.map((version) => ({
        id: version.id,
        ruleId: version.ruleId,
        version: version.version,
        body: includeBody ? version.body : "",
        testedOn: version.testedOn,
        changelog: version.changelog,
        parentVersionId: version.parentVersionId,
        createdBy: {
          id: version.createdBy.id,
          handle: version.createdBy.handle,
          displayName: version.createdBy.displayName,
          avatarUrl: version.createdBy.avatarUrl,
          role: version.createdBy.role,
          isVerified: version.createdBy.authorProfile?.isVerified || false,
        },
        createdAt: version.createdAt,
        score:
          voteStats.find((vs) => vs.ruleVersionId === version.id)?._sum.value ||
          0,
        userVote: version.voteVersions[0]
          ? version.voteVersions[0].value > 0
            ? "up"
            : "down"
          : null,
      }));

      return {
        items: transformedItems,
        nextCursor,
        hasMore,
      };
    }),

  // Create new version
  createVersion: rateLimitedProcedure
    .input(createVersionSchema)
    .use(audit("version.create"))
    .output(z.object({ id: z.string(), version: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const {
        ruleId,
        baseVersionId,
        body,
        changelog,
        testedOn,
        version: inputVersion,
      } = input;

      const { rule, canEdit } = await getRuleOwnership(ctx, ruleId);

      if (!canEdit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to create versions for this rule",
        });
      }

      // Get the base version or latest version
      let baseVersion;
      if (baseVersionId) {
        baseVersion = await ctx.prisma.ruleVersion.findUnique({
          where: { id: baseVersionId, ruleId },
          select: { version: true, body: true },
        });
        if (!baseVersion) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Base version not found",
          });
        }
      } else {
        baseVersion = await ctx.prisma.ruleVersion.findFirst({
          where: { ruleId },
          orderBy: { createdAt: "desc" },
          select: { version: true, body: true },
        });
      }

      // Determine new version number
      let newVersion: string;
      if (inputVersion) {
        // Check if version already exists
        const existingVersion = await ctx.prisma.ruleVersion.findFirst({
          where: { ruleId, version: inputVersion },
        });
        if (existingVersion) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Version already exists",
          });
        }
        newVersion = inputVersion;
      } else {
        // Auto-increment version
        const latestVersion = await ctx.prisma.ruleVersion.findFirst({
          where: { ruleId },
          orderBy: { createdAt: "desc" },
          select: { version: true },
        });

        if (latestVersion) {
          newVersion = incrementVersion(latestVersion.version, "minor");
        } else {
          newVersion = "1.0.0";
        }
      }

      // Create version and update rule in transaction
      const result = await ctx.prisma.$transaction(async (tx) => {
        // Create the new version
        const version = await tx.ruleVersion.create({
          data: {
            ruleId,
            version: newVersion,
            body,
            testedOn: testedOn || null,
            changelog: changelog || `Version ${newVersion}`,
            parentVersionId: baseVersionId || null,
            createdByUserId: ctx.user.id,
          },
        });

        // Update rule's current version
        await tx.rule.update({
          where: { id: ruleId },
          data: {
            currentVersionId: version.id,
            updatedAt: ctx.now,
          },
        });

        // Create notifications for watchers
        const watchers = await tx.watch.findMany({
          where: { ruleId },
          select: { userId: true },
        });

        if (watchers.length > 0) {
          await tx.notification.createMany({
            data: watchers
              .filter((w) => w.userId !== ctx.user.id) // Don't notify the creator
              .map((w) => ({
                userId: w.userId,
                type: "NEW_VERSION",
                payload: {
                  ruleId,
                  versionId: version.id,
                  version: newVersion,
                  authorId: ctx.user.id,
                  authorName: ctx.user.displayName,
                },
              })),
          });
        }

        return { id: version.id, version: newVersion };
      });

      return result;
    }),

  // Fork version
  fork: rateLimitedProcedure
    .input(forkVersionSchema)
    .use(audit("version.fork"))
    .output(z.object({ id: z.string(), version: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const { ruleId, fromVersionId, newBody, changelog, testedOn } = input;

      const { rule, canEdit } = await getRuleOwnership(ctx, ruleId);

      if (!canEdit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to fork versions for this rule",
        });
      }

      // Get the source version
      const sourceVersion = await ctx.prisma.ruleVersion.findUnique({
        where: { id: fromVersionId, ruleId },
        select: { version: true, body: true, testedOn: true },
      });

      if (!sourceVersion) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Source version not found",
        });
      }

      // Generate new version number
      const newVersionNumber = incrementVersion(sourceVersion.version, "patch");

      // Create forked version
      const version = await ctx.prisma.ruleVersion.create({
        data: {
          ruleId,
          version: newVersionNumber,
          body: newBody || sourceVersion.body,
          testedOn: testedOn || sourceVersion.testedOn,
          changelog: changelog || `Forked from ${sourceVersion.version}`,
          parentVersionId: fromVersionId,
          createdByUserId: ctx.user.id,
        },
      });

      return { id: version.id, version: newVersionNumber };
    }),

  // Get version by ID
  getById: protectedProcedure
    .input(getVersionByIdSchema)
    .output(ruleVersionDetailDTOSchema.nullable())
    .query(async ({ input, ctx }) => {
      const { versionId, includeUserActions } = input;

      const version = await ctx.prisma.ruleVersion.findUnique({
        where: { id: versionId },
        include: {
          rule: {
            select: {
              id: true,
              deletedAt: true,
              createdByUserId: true,
            },
          },
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
        },
      });

      if (!version || version.rule.deletedAt) {
        return null;
      }

      // Get vote information
      let userVote = null;
      let score = 0;

      const [voteStats, userVoteRecord] = await Promise.all([
        ctx.prisma.voteVersion.aggregate({
          where: { ruleVersionId: versionId },
          _sum: { value: true },
        }),
        includeUserActions
          ? ctx.prisma.voteVersion.findUnique({
              where: {
                userId_ruleVersionId: {
                  userId: ctx.user.id,
                  ruleVersionId: versionId,
                },
              },
            })
          : null,
      ]);

      score = voteStats._sum.value || 0;
      userVote = userVoteRecord
        ? userVoteRecord.value > 0
          ? "up"
          : "down"
        : null;

      return {
        id: version.id,
        ruleId: version.ruleId,
        version: version.version,
        body: version.body,
        testedOn: version.testedOn,
        changelog: version.changelog,
        parentVersionId: version.parentVersionId,
        createdBy: {
          id: version.createdBy.id,
          handle: version.createdBy.handle,
          displayName: version.createdBy.displayName,
          avatarUrl: version.createdBy.avatarUrl,
          role: version.createdBy.role,
          isVerified: version.createdBy.authorProfile?.isVerified || false,
        },
        createdAt: version.createdAt,
        score,
        userVote: userVote as any,
      };
    }),

  // Get version diff
  getDiff: protectedProcedure
    .input(getVersionDiffSchema)
    .output(
      z.object({
        diff: z.any(),
        format: z.enum(["unified", "split", "json"]),
      })
    )
    .query(async ({ input, ctx }) => {
      const { prevVersionId, currVersionId, format } = input;

      const [prevVersion, currVersion] = await Promise.all([
        ctx.prisma.ruleVersion.findUnique({
          where: { id: prevVersionId },
          select: { body: true, ruleId: true },
        }),
        ctx.prisma.ruleVersion.findUnique({
          where: { id: currVersionId },
          select: { body: true, ruleId: true },
        }),
      ]);

      if (!prevVersion || !currVersion) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "One or both versions not found",
        });
      }

      if (prevVersion.ruleId !== currVersion.ruleId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Versions must belong to the same rule",
        });
      }

      const diff = generateDiff(prevVersion.body, currVersion.body);

      return { diff, format };
    }),

  // Set current version
  setCurrent: rateLimitedProcedure
    .input(setCurrentVersionSchema)
    .use(audit("version.set_current"))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const { ruleId, versionId } = input;

      const { rule, canEdit } = await getRuleOwnership(ctx, ruleId);

      if (!canEdit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to modify this rule",
        });
      }

      // Verify version belongs to rule
      const version = await ctx.prisma.ruleVersion.findUnique({
        where: { id: versionId, ruleId },
      });

      if (!version) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Version not found for this rule",
        });
      }

      await ctx.prisma.rule.update({
        where: { id: ruleId },
        data: {
          currentVersionId: versionId,
          updatedAt: ctx.now,
        },
      });

      return { success: true };
    }),
});
