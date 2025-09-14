import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, adminProcedure } from "../trpc";
import { prisma } from "@repo/db/client";
import { AuditLogService } from "../services/audit-log";

export const adminRouter = createTRPCRouter({
  // ============================================================================
  // AUTHOR CLAIMS
  // ============================================================================

  /**
   * Get pending author claims for review
   */
  getPendingClaims: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const claims = await prisma.authorClaim.findMany({
        where: {
          status: "PENDING",
        },
        include: {
          rule: {
            select: {
              id: true,
              title: true,
              slug: true,
              createdBy: {
                select: {
                  id: true,
                  displayName: true,
                  handle: true,
                },
              },
            },
          },
          claimant: {
            select: {
              id: true,
              displayName: true,
              handle: true,
              // email: true, // Field doesn't exist in schema
            },
          },
        },
        orderBy: {
          createdAt: "asc", // Oldest first for FIFO processing
        },
        take: input.limit + 1,
        ...(input.cursor && {
          cursor: { id: input.cursor },
          skip: 1,
        }),
      });

      const hasMore = claims.length > input.limit;
      const items = hasMore ? claims.slice(0, -1) : claims;
      const nextCursor = hasMore ? items[items.length - 1]?.id : null;

      return {
        items,
        nextCursor,
      };
    }),

  /**
   * Get claim details for review
   */
  getClaim: adminProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const claim = await prisma.authorClaim.findUnique({
        where: { id: input.id },
        include: {
          rule: {
            include: {
              createdBy: {
                select: {
                  id: true,
                  displayName: true,
                  handle: true,
                  // email: true, // Field doesn't exist in schema
                },
              },
              currentVersion: {
                select: {
                  body: true,
                  createdAt: true,
                },
              },
            },
          },
          claimant: {
            select: {
              id: true,
              displayName: true,
              handle: true,
              // email: true, // Field doesn't exist in schema
              bio: true,
              createdAt: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              displayName: true,
              handle: true,
            },
          },
        },
      });

      if (!claim) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Claim not found",
        });
      }

      return claim;
    }),

  /**
   * Approve an author claim
   */
  approveClaim: adminProcedure
    .input(
      z.object({
        id: z.string(),
        reviewNote: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const claim = await prisma.authorClaim.findUnique({
        where: { id: input.id },
        include: { rule: true, claimant: true },
      });

      if (!claim) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Claim not found",
        });
      }

      if (claim.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Claim has already been reviewed",
        });
      }

      // Update claim status
      const updatedClaim = await prisma.authorClaim.update({
        where: { id: input.id },
        data: {
          status: "APPROVED",
          reviewerId: ctx.user.id,
          reviewNote: input.reviewNote,
          reviewedAt: new Date(),
        },
      });

      // Update rule ownership
      await prisma.rule.update({
        where: { id: claim.ruleId },
        data: {
          createdByUserId: claim.claimantId,
        },
      });

      // Create audit log entry
      await AuditLogService.logClaimApprove(input.id, ctx.user.id, {
        ruleId: claim.ruleId,
        claimantId: claim.claimantId,
        originalAuthorId: claim.rule.createdByUserId,
        reviewNote: input.reviewNote,
      });

      return updatedClaim;
    }),

  /**
   * Reject an author claim
   */
  rejectClaim: adminProcedure
    .input(
      z.object({
        id: z.string(),
        reviewNote: z.string().min(1, "Review note is required for rejection"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const claim = await prisma.authorClaim.findUnique({
        where: { id: input.id },
        include: { rule: true, claimant: true },
      });

      if (!claim) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Claim not found",
        });
      }

      if (claim.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Claim has already been reviewed",
        });
      }

      // Update claim status
      const updatedClaim = await prisma.authorClaim.update({
        where: { id: input.id },
        data: {
          status: "REJECTED",
          reviewerId: ctx.user.id,
          reviewNote: input.reviewNote,
          reviewedAt: new Date(),
        },
      });

      // Create audit log entry
      await AuditLogService.logClaimReject(
        input.id,
        ctx.user.id,
        input.reviewNote,
        {
          ruleId: claim.ruleId,
          claimantId: claim.claimantId,
          originalAuthorId: claim.rule.createdByUserId,
        }
      );

      return updatedClaim;
    }),

  // ============================================================================
  // CONTENT MODERATION
  // ============================================================================

  /**
   * Get flagged content for moderation
   */
  getFlaggedContent: adminProcedure
    .input(
      z.object({
        type: z.enum(["rule", "comment"]).optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      // For now, we'll return recently reported content
      // In a real implementation, you'd have a flagging system

      if (input.type === "comment" || !input.type) {
        const comments = await prisma.comment.findMany({
          where: {
            deletedAt: null, // Only non-deleted comments
          },
          include: {
            author: {
              select: {
                id: true,
                displayName: true,
                handle: true,
              },
            },
            rule: {
              select: {
                id: true,
                title: true,
                slug: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: input.limit + 1,
          ...(input.cursor && {
            cursor: { id: input.cursor },
            skip: 1,
          }),
        });

        const hasMore = comments.length > input.limit;
        const items = hasMore ? comments.slice(0, -1) : comments;
        const nextCursor = hasMore ? items[items.length - 1]?.id : null;

        return {
          items: items.map((comment) => ({
            ...comment,
            type: "comment" as const,
          })),
          nextCursor,
        };
      }

      return { items: [], nextCursor: null };
    }),

  /**
   * Delete a comment (soft delete)
   */
  deleteComment: adminProcedure
    .input(
      z.object({
        id: z.string(),
        reason: z.string().min(1, "Reason is required"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const comment = await prisma.comment.findUnique({
        where: { id: input.id },
      });

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      if (comment.deletedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Comment is already deleted",
        });
      }

      // Soft delete the comment
      const deletedComment = await prisma.comment.update({
        where: { id: input.id },
        data: {
          deletedAt: new Date(),
        },
      });

      // Create audit log entry
      await AuditLogService.logCommentDelete(
        input.id,
        ctx.user.id,
        input.reason,
        {
          authorId: comment.authorUserId,
          ruleId: comment.ruleId,
        }
      );

      return deletedComment;
    }),

  /**
   * Deprecate a rule
   */
  deprecateRule: adminProcedure
    .input(
      z.object({
        id: z.string(),
        reason: z.string().min(1, "Reason is required"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const rule = await prisma.rule.findUnique({
        where: { id: input.id },
      });

      if (!rule) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Rule not found",
        });
      }

      if (rule.status === "DEPRECATED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Rule is already deprecated",
        });
      }

      // Update rule status
      const updatedRule = await prisma.rule.update({
        where: { id: input.id },
        data: {
          status: "DEPRECATED",
        },
      });

      // Create audit log entry
      await AuditLogService.logRuleDeprecate(
        input.id,
        ctx.user.id,
        input.reason,
        {
          originalStatus: rule.status,
          authorId: rule.createdByUserId,
        }
      );

      return updatedRule;
    }),

  // ============================================================================
  // AUDIT LOGS
  // ============================================================================

  /**
   * Get recent audit logs
   */
  getAuditLogs: adminProcedure
    .input(
      z.object({
        action: z.string().optional(),
        targetType: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const where: any = {};

      if (input.action) {
        where.action = input.action;
      }

      if (input.targetType) {
        where.targetType = input.targetType;
      }

      const logs = await prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              displayName: true,
              handle: true,
              role: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: input.limit + 1,
        ...(input.cursor && {
          cursor: { id: input.cursor },
          skip: 1,
        }),
      });

      const hasMore = logs.length > input.limit;
      const items = hasMore ? logs.slice(0, -1) : logs;
      const nextCursor = hasMore ? items[items.length - 1]?.id : null;

      return {
        items,
        nextCursor,
      };
    }),

  /**
   * Get audit logs for a specific target
   */
  getTargetAuditLogs: adminProcedure
    .input(
      z.object({
        targetId: z.string(),
        targetType: z.string(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      return AuditLogService.getLogsForTarget(
        input.targetId,
        input.targetType,
        input.limit
      );
    }),

  // ============================================================================
  // DASHBOARD STATS
  // ============================================================================

  /**
   * Get admin dashboard statistics
   */
  getDashboardStats: adminProcedure.query(async () => {
    const [
      pendingClaims,
      totalUsers,
      totalRules,
      totalComments,
      recentAuditLogs,
    ] = await Promise.all([
      prisma.authorClaim.count({
        where: { status: "PENDING" },
      }),
      prisma.user.count(),
      prisma.rule.count({
        where: { status: "PUBLISHED" },
      }),
      prisma.comment.count({
        where: { deletedAt: null },
      }),
      prisma.auditLog.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      }),
    ]);

    return {
      pendingClaims,
      totalUsers,
      totalRules,
      totalComments,
      recentAuditLogs,
    };
  }),
});
