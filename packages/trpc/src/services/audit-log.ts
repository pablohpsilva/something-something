import { prisma } from "@repo/db/client";
import type { User } from "@repo/db";

export interface AuditLogEntry {
  action: string;
  actorId?: string;
  targetId?: string;
  targetType?: string;
  metadata?: Record<string, any>;
  reason?: string;
}

/**
 * Service for creating audit log entries
 */
export class AuditLogService {
  /**
   * Create a new audit log entry
   */
  static async log(entry: AuditLogEntry): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          action: entry.action,
          actorId: entry.actorId,
          targetId: entry.targetId,
          targetType: entry.targetType,
          metadata: entry.metadata,
          reason: entry.reason,
        },
      });
    } catch (error) {
      console.error("Failed to create audit log entry:", error);
      // Don't throw - audit logging should not break the main flow
    }
  }

  /**
   * Log rule publication
   */
  static async logRulePublish(
    ruleId: string,
    actorId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      action: "rule.publish",
      actorId,
      targetId: ruleId,
      targetType: "rule",
      metadata,
    });
  }

  /**
   * Log rule deprecation
   */
  static async logRuleDeprecate(
    ruleId: string,
    actorId: string,
    reason?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      action: "rule.deprecate",
      actorId,
      targetId: ruleId,
      targetType: "rule",
      reason,
      metadata,
    });
  }

  /**
   * Log comment deletion
   */
  static async logCommentDelete(
    commentId: string,
    actorId: string,
    reason?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      action: "comment.delete",
      actorId,
      targetId: commentId,
      targetType: "comment",
      reason,
      metadata,
    });
  }

  /**
   * Log author claim approval
   */
  static async logClaimApprove(
    claimId: string,
    actorId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      action: "claim.approve",
      actorId,
      targetId: claimId,
      targetType: "author_claim",
      metadata,
    });
  }

  /**
   * Log author claim rejection
   */
  static async logClaimReject(
    claimId: string,
    actorId: string,
    reason?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      action: "claim.reject",
      actorId,
      targetId: claimId,
      targetType: "author_claim",
      reason,
      metadata,
    });
  }

  /**
   * Log user ban
   */
  static async logUserBan(
    userId: string,
    actorId: string,
    reason?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      action: "user.ban",
      actorId,
      targetId: userId,
      targetType: "user",
      reason,
      metadata,
    });
  }

  /**
   * Log user unban
   */
  static async logUserUnban(
    userId: string,
    actorId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.log({
      action: "user.unban",
      actorId,
      targetId: userId,
      targetType: "user",
      metadata,
    });
  }

  /**
   * Get audit logs for a specific target
   */
  static async getLogsForTarget(
    targetId: string,
    targetType: string,
    limit = 50
  ): Promise<any> {
    return prisma.auditLog.findMany({
      where: {
        targetId,
        targetType,
      },
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
      take: limit,
    });
  }

  /**
   * Get recent audit logs for admin dashboard
   */
  static async getRecentLogs(limit = 100): Promise<any> {
    return prisma.auditLog.findMany({
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
      take: limit,
    });
  }

  /**
   * Get audit logs by action type
   */
  static async getLogsByAction(action: string, limit = 50): Promise<any> {
    return prisma.auditLog.findMany({
      where: {
        action,
      },
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
      take: limit,
    });
  }
}

/**
 * Convenience functions for common audit log actions
 */
export const auditLog = {
  rulePublish: AuditLogService.logRulePublish,
  ruleDeprecate: AuditLogService.logRuleDeprecate,
  commentDelete: AuditLogService.logCommentDelete,
  claimApprove: AuditLogService.logClaimApprove,
  claimReject: AuditLogService.logClaimReject,
  userBan: AuditLogService.logUserBan,
  userUnban: AuditLogService.logUserUnban,
};

// Export AuditLog as an alias for AuditLogService for backward compatibility
export const AuditLog = AuditLogService;
