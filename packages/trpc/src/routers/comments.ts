import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  router,
  publicProcedure,
  protectedProcedure,
  strictRateLimitedProcedure,
  audit,
} from "../trpc";
import {
  createCommentSchema,
  listCommentsSchema,
  updateCommentSchema,
  softDeleteCommentSchema,
  getCommentByIdSchema,
} from "../schemas/comment";
import { commentDTOSchema } from "../schemas/dto";
import { createPaginatedSchema } from "../schemas/base";

// Helper to build comment tree
function buildCommentTree(comments: any[], maxDepth: number = 3): any[] {
  const commentMap = new Map();
  const rootComments: any[] = [];

  // First pass: create map and identify root comments
  comments.forEach((comment) => {
    commentMap.set(comment.id, { ...comment, children: [] });
    if (!comment.parentId) {
      rootComments.push(commentMap.get(comment.id));
    }
  });

  // Second pass: build tree
  comments.forEach((comment) => {
    if (comment.parentId && commentMap.has(comment.parentId)) {
      const parent = commentMap.get(comment.parentId);
      const child = commentMap.get(comment.id);
      if (parent && child) {
        parent.children.push(child);
      }
    }
  });

  return rootComments;
}

export const commentsRouter = router({
  // List comments for a rule
  list: publicProcedure
    .input(listCommentsSchema)
    .output(createPaginatedSchema(commentDTOSchema))
    .query(async ({ input, ctx }) => {
      const { ruleId, cursor, limit, sort, includeReplies, maxDepth } = input;

      // Check if rule exists
      const rule = await ctx.prisma.rule.findUnique({
        where: { id: ruleId, deletedAt: null },
        select: { id: true },
      });

      if (!rule) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Rule not found",
        });
      }

      // Build where clause
      const where: any = {
        ruleId,
        ...(includeReplies ? {} : { parentId: null }),
      };

      if (cursor) {
        const cursorComment = await ctx.prisma.comment.findUnique({
          where: { id: cursor },
          select: { createdAt: true },
        });
        if (cursorComment) {
          where.createdAt = { lt: cursorComment.createdAt };
        }
      }

      // Build orderBy
      let orderBy: any;
      switch (sort) {
        case "old":
          orderBy = { createdAt: "asc" };
          break;
        case "top":
          // For now, just use createdAt desc. In production, you'd have a score field
          orderBy = { createdAt: "desc" };
          break;
        case "new":
        default:
          orderBy = { createdAt: "desc" };
      }

      const comments = await ctx.prisma.comment.findMany({
        where,
        orderBy,
        take: includeReplies ? limit * 3 : limit + 1, // Get more if including replies
        include: {
          author: {
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
          _count: {
            select: {
              children: {
                where: { deletedAt: null },
              },
            },
          },
        },
      });

      let items: any[];
      let hasMore = false;
      let nextCursor: string | undefined;

      if (includeReplies) {
        // Build comment tree
        items = buildCommentTree(comments, maxDepth);
        hasMore = comments.length >= limit * 3;
        nextCursor = hasMore ? comments[comments.length - 1]?.id : undefined;
      } else {
        hasMore = comments.length > limit;
        items = hasMore ? comments.slice(0, -1) : comments;
        nextCursor = hasMore ? items[items.length - 1]?.id : undefined;
      }

      // Transform to DTO format
      const transformComment = (comment: any): any => ({
        id: comment.id,
        ruleId: comment.ruleId,
        parentId: comment.parentId,
        author: {
          id: comment.author.id,
          handle: comment.author.handle,
          displayName: comment.author.displayName,
          avatarUrl: comment.author.avatarUrl,
          role: comment.author.role,
          isVerified: comment.author.authorProfile?.isVerified || false,
        },
        body: comment.deletedAt ? null : comment.body,
        isDeleted: !!comment.deletedAt,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        repliesCount: comment._count?.children || 0,
        children: comment.children?.map(transformComment) || [],
      });

      return {
        items: items.map(transformComment),
        nextCursor,
        hasMore,
      };
    }),

  // Create comment
  create: strictRateLimitedProcedure
    .input(createCommentSchema)
    .use(audit("comment.create"))
    .output(commentDTOSchema)
    .mutation(async ({ input, ctx }) => {
      const { ruleId, parentId, body } = input;

      // Check if rule exists
      const rule = await ctx.prisma.rule.findUnique({
        where: { id: ruleId, deletedAt: null },
        select: { id: true, createdByUserId: true },
      });

      if (!rule) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Rule not found",
        });
      }

      // Check parent comment if provided
      let parentComment = null;
      if (parentId) {
        parentComment = await ctx.prisma.comment.findUnique({
          where: { id: parentId, ruleId },
          select: { id: true, authorUserId: true, deletedAt: true },
        });

        if (!parentComment || parentComment.deletedAt) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Parent comment not found",
          });
        }
      }

      // Create comment and notifications in transaction
      const result = await ctx.prisma.$transaction(async (tx) => {
        // Create the comment
        const comment = await tx.comment.create({
          data: {
            ruleId,
            parentId,
            authorUserId: ctx.user.id,
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
                authorProfile: {
                  select: { isVerified: true },
                },
              },
            },
          },
        });

        // Record event
        await tx.event.create({
          data: {
            type: "COMMENT",
            userId: ctx.user.id,
            ruleId,
            ipHash: ctx.reqIpHash,
            uaHash: ctx.uaHash,
          },
        });

        // Create notifications
        const notifications = [];

        // Notify rule author (if not the commenter)
        if (rule.createdByUserId !== ctx.user.id) {
          notifications.push({
            userId: rule.createdByUserId,
            type: "COMMENT_REPLY",
            payload: {
              commentId: comment.id,
              ruleId,
              authorId: ctx.user.id,
              authorName: ctx.user.displayName,
              isReply: false,
            },
          });
        }

        // Notify parent comment author (if replying and not the same as rule author)
        if (
          parentComment &&
          parentComment.authorUserId !== ctx.user.id &&
          parentComment.authorUserId !== rule.createdByUserId
        ) {
          notifications.push({
            userId: parentComment.authorUserId,
            type: "COMMENT_REPLY",
            payload: {
              commentId: comment.id,
              parentCommentId: parentId,
              ruleId,
              authorId: ctx.user.id,
              authorName: ctx.user.displayName,
              isReply: true,
            },
          });
        }

        if (notifications.length > 0) {
          await tx.notification.createMany({
            data: notifications as any,
          });
        }

        return comment;
      });

      return {
        id: result.id,
        ruleId: result.ruleId,
        parentId: result.parentId,
        author: {
          id: result.author.id,
          handle: result.author.handle,
          displayName: result.author.displayName,
          avatarUrl: result.author.avatarUrl,
          role: result.author.role,
          isVerified: result.author.authorProfile?.isVerified || false,
        },
        body: result.body,
        isDeleted: false,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        children: [],
      };
    }),

  // Update comment
  update: strictRateLimitedProcedure
    .input(updateCommentSchema)
    .use(audit("comment.update"))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const { commentId, body } = input;

      const comment = await ctx.prisma.comment.findUnique({
        where: { id: commentId },
        select: {
          id: true,
          authorUserId: true,
          deletedAt: true,
          createdAt: true,
        },
      });

      if (!comment || comment.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      // Check ownership or mod permissions
      const canEdit =
        comment.authorUserId === ctx.user.id ||
        ctx.user.role === "MOD" ||
        ctx.user.role === "ADMIN";

      if (!canEdit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to edit this comment",
        });
      }

      // Check if comment is too old to edit (15 minutes for regular users)
      if (comment.authorUserId === ctx.user.id && ctx.user.role === "USER") {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        if (comment.createdAt < fifteenMinutesAgo) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Comment is too old to edit",
          });
        }
      }

      await ctx.prisma.comment.update({
        where: { id: commentId },
        data: { body },
      });

      return { success: true };
    }),

  // Soft delete comment
  softDelete: strictRateLimitedProcedure
    .input(softDeleteCommentSchema)
    .use(audit("comment.delete"))
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const { commentId, reason } = input;

      const comment = await ctx.prisma.comment.findUnique({
        where: { id: commentId },
        select: {
          id: true,
          authorUserId: true,
          deletedAt: true,
        },
      });

      if (!comment || comment.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      // Check ownership or mod permissions
      const canDelete =
        comment.authorUserId === ctx.user.id ||
        ctx.user.role === "MOD" ||
        ctx.user.role === "ADMIN";

      if (!canDelete) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to delete this comment",
        });
      }

      await ctx.prisma.comment.update({
        where: { id: commentId },
        data: { deletedAt: ctx.now },
      });

      return { success: true };
    }),
});
