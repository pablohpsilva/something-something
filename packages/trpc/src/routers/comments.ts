import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  router,
  publicProcedure,
  protectedProcedure,
  rateLimitedProcedure,
  modProcedure,
  audit,
} from "../trpc";
import {
  commentCreateSchema,
  commentListSchema,
  commentEditSchema,
  commentDeleteSchema,
  commentListResponseSchema,
} from "../schemas/comment";
import { commentDTOSchema } from "../schemas/dto";
import { Notifications } from "../services/notify";

// Rate limited procedure for comments (6 per minute)
const commentRateLimitedProcedure = rateLimitedProcedure("comments", 6);

export const commentsRouter = router({
  list: publicProcedure
    .input(commentListSchema)
    .output(commentListResponseSchema)
    .query(async ({ input, ctx }) => {
      const { ruleId, cursor, limit, mode } = input;

      if (mode === "tree") {
        // Build threaded tree structure
        const allComments = await ctx.prisma.comment.findMany({
          where: {
            ruleId,
          },
          include: {
            author: {
              select: {
                id: true,
                handle: true,
                displayName: true,
                avatarUrl: true,
                role: true,
                isVerified: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        });

        // Build comment tree
        const commentMap = new Map();
        const rootComments: any[] = [];

        // First pass: create comment objects
        for (const comment of allComments) {
          const isEdited =
            comment.updatedAt.getTime() - comment.createdAt.getTime() > 60000; // 1 minute
          const canEdit =
            ctx.user?.id === comment.authorUserId &&
            Date.now() - comment.createdAt.getTime() < 10 * 60 * 1000 && // 10 minutes
            !comment.deletedAt;
          const canDelete =
            ctx.user?.id === comment.authorUserId ||
            (ctx.user?.role && ["MODERATOR", "ADMIN"].includes(ctx.user.role));

          const commentDTO = {
            id: comment.id,
            ruleId: comment.ruleId,
            parentId: comment.parentId,
            author: comment.author,
            bodyHtml: comment.deletedAt ? null : comment.body, // TODO: Convert markdown to HTML
            isDeleted: !!comment.deletedAt,
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt,
            edited: isEdited,
            depth: 0, // Will be calculated
            children: [],
            canEdit,
            canDelete,
          };

          commentMap.set(comment.id, commentDTO);
        }

        // Second pass: build tree structure and calculate depth
        for (const comment of allComments) {
          const commentDTO = commentMap.get(comment.id);

          if (comment.parentId) {
            const parent = commentMap.get(comment.parentId);
            if (parent) {
              commentDTO.depth = parent.depth + 1;
              parent.children.push(commentDTO);
            }
          } else {
            rootComments.push(commentDTO);
          }
        }

        // Sort root comments by creation date (newest first)
        rootComments.sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );

        // Apply pagination to root comments only
        const startIndex = cursor
          ? rootComments.findIndex((c) => c.id === cursor) + 1
          : 0;
        const paginatedComments = rootComments.slice(
          startIndex,
          startIndex + limit
        );
        const hasMore = startIndex + limit < rootComments.length;
        const nextCursor = hasMore
          ? paginatedComments[paginatedComments.length - 1]?.id
          : undefined;

        return {
          items: paginatedComments,
          nextCursor,
          hasMore,
          totalCount: rootComments.length,
        };
      } else {
        // Flat mode - simple chronological list
        const comments = await ctx.prisma.comment.findMany({
          where: {
            ruleId,
          },
          include: {
            author: {
              select: {
                id: true,
                handle: true,
                displayName: true,
                avatarUrl: true,
                role: true,
                isVerified: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: limit + 1,
          ...(cursor && {
            cursor: { id: cursor },
            skip: 1,
          }),
        });

        const hasMore = comments.length > limit;
        const items = hasMore ? comments.slice(0, -1) : comments;
        const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

        const totalCount = await ctx.prisma.comment.count({
          where: { ruleId },
        });

        return {
          items: items.map((comment) => {
            const isEdited =
              comment.updatedAt.getTime() - comment.createdAt.getTime() > 60000;
            const canEdit =
              ctx.user?.id === comment.authorUserId &&
              Date.now() - comment.createdAt.getTime() < 10 * 60 * 1000 &&
              !comment.deletedAt;
            const canDelete =
              ctx.user?.id === comment.authorUserId ||
              (ctx.user?.role &&
                ["MODERATOR", "ADMIN"].includes(ctx.user.role));

            return {
              id: comment.id,
              ruleId: comment.ruleId,
              parentId: comment.parentId,
              author: comment.author,
              bodyHtml: comment.deletedAt ? null : comment.body, // TODO: Convert markdown to HTML
              isDeleted: !!comment.deletedAt,
              createdAt: comment.createdAt,
              updatedAt: comment.updatedAt,
              edited: isEdited,
              depth: 0,
              canEdit,
              canDelete,
            };
          }),
          nextCursor,
          hasMore,
          totalCount,
        };
      }
    }),

  create: commentRateLimitedProcedure
    .input(commentCreateSchema)
    .output(commentDTOSchema)
    .mutation(async ({ input, ctx }) => {
      const { ruleId, parentId, body } = input;
      const userId = ctx.user!.id;

      // Validate rule exists
      const rule = await ctx.prisma.rule.findUnique({
        where: { id: ruleId },
        select: { id: true, createdByUserId: true },
      });

      if (!rule) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Rule not found",
        });
      }

      let parentComment = null;
      let depth = 0;

      // Validate parent comment exists and belongs to same rule
      if (parentId) {
        parentComment = await ctx.prisma.comment.findFirst({
          where: {
            id: parentId,
            ruleId,
            deletedAt: null,
          },
        });

        if (!parentComment) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Parent comment not found",
          });
        }

        // Calculate depth (limit to reasonable depth)
        let current = parentComment;
        depth = 1;
        while (current.parentId && depth < 10) {
          current = await ctx.prisma.comment.findUnique({
            where: { id: current.parentId },
          });
          if (!current) break;
          depth++;
        }
      }

      // Create comment in transaction
      const result = await ctx.prisma.$transaction(async (tx) => {
        // Create the comment
        const comment = await tx.comment.create({
          data: {
            ruleId,
            parentId,
            authorUserId: userId,
            body,
          },
          include: {
            author: {
              select: {
                id: true,
                handle: true,
                displayName: true,
                avatarUrl: true,
                role: true,
                isVerified: true,
              },
            },
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: "comment.create",
            entityType: "comment",
            entityId: comment.id,
            userId,
            ipHash: ctx.reqIpHash,
            diff: {
              ruleId,
              parentId,
              body: body.substring(0, 100), // Truncate for audit
            },
          },
        });

        // Create notifications
        const notifications = [];

        // Notify parent comment author (if replying)
        if (parentComment && parentComment.authorUserId !== userId) {
          notifications.push({
            userId: parentComment.authorUserId,
            type: "COMMENT_REPLY" as const,
            payload: {
              ruleId,
              commentId: comment.id,
              parentId,
              actorId: userId,
              actorHandle: ctx.user!.handle,
              actorDisplayName: ctx.user!.displayName,
            },
          });
        }

        // Notify rule author (if top-level comment and not self)
        if (!parentId && rule.createdByUserId !== userId) {
          notifications.push({
            userId: rule.createdByUserId,
            type: "NEW_COMMENT" as const,
            payload: {
              ruleId,
              commentId: comment.id,
              actorId: userId,
              actorHandle: ctx.user!.handle,
              actorDisplayName: ctx.user!.displayName,
            },
          });
        }

        return comment;
      });

      // Send notifications (fire-and-forget)
      try {
        await Notifications.commentReply({
          ruleId,
          ruleSlug: rule.slug || ruleId, // Use slug if available
          commentId: result.id,
          parentAuthorId: parentComment?.authorUserId,
          actorUserId: userId,
          actorHandle: ctx.user!.handle,
          actorDisplayName: ctx.user!.displayName,
        });
      } catch (error) {
        console.error("Failed to send comment reply notifications:", error);
      }

      // Emit COMMENT event to ingest (fire-and-forget)
      try {
        const ingestBaseUrl = process.env.INGEST_BASE_URL;
        const ingestAppToken = process.env.INGEST_APP_TOKEN;

        if (ingestBaseUrl && ingestAppToken) {
          fetch(`${ingestBaseUrl}/ingest/events`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-app-token": ingestAppToken,
              "x-forwarded-for": ctx.reqIpHeader || "0.0.0.0",
              "user-agent": ctx.reqUAHeader || "",
            },
            body: JSON.stringify({
              events: [
                {
                  type: "COMMENT",
                  ruleId,
                  userId,
                  ts: new Date().toISOString(),
                },
              ],
            }),
          }).catch(() => {}); // Fire-and-forget
        }
      } catch (error) {
        // Ignore ingest errors
      }

      return {
        id: result.id,
        ruleId: result.ruleId,
        parentId: result.parentId,
        author: result.author,
        bodyHtml: result.body, // TODO: Convert markdown to HTML
        isDeleted: false,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        edited: false,
        depth,
        children: [],
        canEdit: true,
        canDelete: true,
      };
    }),

  edit: protectedProcedure
    .input(commentEditSchema)
    .output(commentDTOSchema)
    .mutation(async ({ input, ctx }) => {
      const { commentId, body } = input;
      const userId = ctx.user!.id;

      const comment = await ctx.prisma.comment.findFirst({
        where: {
          id: commentId,
          deletedAt: null,
        },
        include: {
          author: {
            select: {
              id: true,
              handle: true,
              displayName: true,
              avatarUrl: true,
              role: true,
              isVerified: true,
            },
          },
        },
      });

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      // Check permissions
      const isAuthor = comment.authorUserId === userId;
      const isModerator =
        ctx.user!.role && ["MODERATOR", "ADMIN"].includes(ctx.user!.role);
      const withinEditWindow =
        Date.now() - comment.createdAt.getTime() < 10 * 60 * 1000; // 10 minutes

      if (!isAuthor && !isModerator) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to edit this comment",
        });
      }

      if (isAuthor && !withinEditWindow && !isModerator) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Edit window has expired",
        });
      }

      // Update comment in transaction
      const result = await ctx.prisma.$transaction(async (tx) => {
        const updatedComment = await tx.comment.update({
          where: { id: commentId },
          data: {
            body,
            updatedAt: new Date(),
          },
          include: {
            author: {
              select: {
                id: true,
                handle: true,
                displayName: true,
                avatarUrl: true,
                role: true,
                isVerified: true,
              },
            },
          },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: "comment.edit",
            entityType: "comment",
            entityId: commentId,
            userId,
            ipHash: ctx.reqIpHash,
            diff: {
              oldBody: comment.body.substring(0, 100),
              newBody: body.substring(0, 100),
            },
          },
        });

        return updatedComment;
      });

      const isEdited =
        result.updatedAt.getTime() - result.createdAt.getTime() > 60000;
      const canEdit =
        userId === result.authorUserId &&
        Date.now() - result.createdAt.getTime() < 10 * 60 * 1000 &&
        !result.deletedAt;
      const canDelete =
        userId === result.authorUserId ||
        (ctx.user!.role && ["MODERATOR", "ADMIN"].includes(ctx.user!.role));

      return {
        id: result.id,
        ruleId: result.ruleId,
        parentId: result.parentId,
        author: result.author,
        bodyHtml: result.body, // TODO: Convert markdown to HTML
        isDeleted: false,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        edited: isEdited,
        depth: 0, // Will be recalculated by client
        children: [],
        canEdit,
        canDelete,
      };
    }),

  softDelete: protectedProcedure
    .input(commentDeleteSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const { commentId, reason } = input;
      const userId = ctx.user!.id;

      const comment = await ctx.prisma.comment.findFirst({
        where: {
          id: commentId,
          deletedAt: null,
        },
      });

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      // Check permissions
      const isAuthor = comment.authorUserId === userId;
      const isModerator =
        ctx.user!.role && ["MODERATOR", "ADMIN"].includes(ctx.user!.role);

      if (!isAuthor && !isModerator) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to delete this comment",
        });
      }

      // Soft delete in transaction
      await ctx.prisma.$transaction(async (tx) => {
        await tx.comment.update({
          where: { id: commentId },
          data: { deletedAt: new Date() },
        });

        // Create audit log
        await tx.auditLog.create({
          data: {
            action: "comment.delete",
            entityType: "comment",
            entityId: commentId,
            userId,
            ipHash: ctx.reqIpHash,
            diff: {
              reason: reason || null,
              deletedBy: isModerator ? "moderator" : "author",
              body: comment.body.substring(0, 100),
            },
          },
        });
      });

      return { success: true };
    }),
});
