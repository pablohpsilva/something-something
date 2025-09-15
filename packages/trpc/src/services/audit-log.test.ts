import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { AuditLogService, AuditLog, auditLog } from "./audit-log"
import type { AuditLogEntry } from "./audit-log"

// Mock the prisma client
vi.mock("@repo/db/client", () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

// Get the mocked prisma instance
const { prisma } = await import("@repo/db/client")
const mockPrismaAuditLog = prisma.auditLog as any

describe("AuditLogService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock console.error to avoid noise in test output
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("log", () => {
    it("should create audit log entry successfully", async () => {
      const entry: AuditLogEntry = {
        action: "test.action",
        actorId: "user-123",
        targetId: "target-456",
        targetType: "test",
        metadata: { key: "value" },
        reason: "Test reason",
      }

      mockPrismaAuditLog.create.mockResolvedValue({
        id: "log-123",
        ...entry,
        createdAt: new Date(),
      })

      await AuditLogService.log(entry)

      expect(mockPrismaAuditLog.create).toHaveBeenCalledWith({
        data: {
          action: "test.action",
          actorId: "user-123",
          targetId: "target-456",
          targetType: "test",
          metadata: { key: "value" },
          reason: "Test reason",
        },
      })
    })

    it("should handle missing optional fields", async () => {
      const entry: AuditLogEntry = {
        action: "minimal.action",
      }

      mockPrismaAuditLog.create.mockResolvedValue({
        id: "log-123",
        ...entry,
        createdAt: new Date(),
      })

      await AuditLogService.log(entry)

      expect(mockPrismaAuditLog.create).toHaveBeenCalledWith({
        data: {
          action: "minimal.action",
          actorId: undefined,
          targetId: undefined,
          targetType: undefined,
          metadata: undefined,
          reason: undefined,
        },
      })
    })

    it("should handle database errors gracefully", async () => {
      const entry: AuditLogEntry = {
        action: "failing.action",
        actorId: "user-123",
      }

      const dbError = new Error("Database connection failed")
      mockPrismaAuditLog.create.mockRejectedValue(dbError)

      // Should not throw
      await expect(AuditLogService.log(entry)).resolves.toBeUndefined()

      expect(console.error).toHaveBeenCalledWith("Failed to create audit log entry:", dbError)
    })
  })

  describe("logRulePublish", () => {
    it("should log rule publication", async () => {
      mockPrismaAuditLog.create.mockResolvedValue({})

      await AuditLogService.logRulePublish("rule-123", "user-456", {
        version: "1.0.0",
      })

      expect(mockPrismaAuditLog.create).toHaveBeenCalledWith({
        data: {
          action: "rule.publish",
          actorId: "user-456",
          targetId: "rule-123",
          targetType: "rule",
          metadata: { version: "1.0.0" },
          reason: undefined,
        },
      })
    })

    it("should log rule publication without metadata", async () => {
      mockPrismaAuditLog.create.mockResolvedValue({})

      await AuditLogService.logRulePublish("rule-123", "user-456")

      expect(mockPrismaAuditLog.create).toHaveBeenCalledWith({
        data: {
          action: "rule.publish",
          actorId: "user-456",
          targetId: "rule-123",
          targetType: "rule",
          metadata: undefined,
          reason: undefined,
        },
      })
    })
  })

  describe("logRuleDeprecate", () => {
    it("should log rule deprecation with reason and metadata", async () => {
      mockPrismaAuditLog.create.mockResolvedValue({})

      await AuditLogService.logRuleDeprecate("rule-123", "user-456", "Outdated approach", {
        replacedBy: "rule-789",
      })

      expect(mockPrismaAuditLog.create).toHaveBeenCalledWith({
        data: {
          action: "rule.deprecate",
          actorId: "user-456",
          targetId: "rule-123",
          targetType: "rule",
          metadata: { replacedBy: "rule-789" },
          reason: "Outdated approach",
        },
      })
    })

    it("should log rule deprecation without optional parameters", async () => {
      mockPrismaAuditLog.create.mockResolvedValue({})

      await AuditLogService.logRuleDeprecate("rule-123", "user-456")

      expect(mockPrismaAuditLog.create).toHaveBeenCalledWith({
        data: {
          action: "rule.deprecate",
          actorId: "user-456",
          targetId: "rule-123",
          targetType: "rule",
          metadata: undefined,
          reason: undefined,
        },
      })
    })
  })

  describe("logCommentDelete", () => {
    it("should log comment deletion with reason and metadata", async () => {
      mockPrismaAuditLog.create.mockResolvedValue({})

      await AuditLogService.logCommentDelete("comment-123", "moderator-456", "Spam content", {
        reportCount: 5,
      })

      expect(mockPrismaAuditLog.create).toHaveBeenCalledWith({
        data: {
          action: "comment.delete",
          actorId: "moderator-456",
          targetId: "comment-123",
          targetType: "comment",
          metadata: { reportCount: 5 },
          reason: "Spam content",
        },
      })
    })

    it("should log comment deletion without optional parameters", async () => {
      mockPrismaAuditLog.create.mockResolvedValue({})

      await AuditLogService.logCommentDelete("comment-123", "moderator-456")

      expect(mockPrismaAuditLog.create).toHaveBeenCalledWith({
        data: {
          action: "comment.delete",
          actorId: "moderator-456",
          targetId: "comment-123",
          targetType: "comment",
          metadata: undefined,
          reason: undefined,
        },
      })
    })
  })

  describe("logClaimApprove", () => {
    it("should log claim approval", async () => {
      mockPrismaAuditLog.create.mockResolvedValue({})

      await AuditLogService.logClaimApprove("claim-123", "admin-456", {
        verificationMethod: "email",
      })

      expect(mockPrismaAuditLog.create).toHaveBeenCalledWith({
        data: {
          action: "claim.approve",
          actorId: "admin-456",
          targetId: "claim-123",
          targetType: "author_claim",
          metadata: { verificationMethod: "email" },
          reason: undefined,
        },
      })
    })

    it("should log claim approval without metadata", async () => {
      mockPrismaAuditLog.create.mockResolvedValue({})

      await AuditLogService.logClaimApprove("claim-123", "admin-456")

      expect(mockPrismaAuditLog.create).toHaveBeenCalledWith({
        data: {
          action: "claim.approve",
          actorId: "admin-456",
          targetId: "claim-123",
          targetType: "author_claim",
          metadata: undefined,
          reason: undefined,
        },
      })
    })
  })

  describe("logClaimReject", () => {
    it("should log claim rejection with reason and metadata", async () => {
      mockPrismaAuditLog.create.mockResolvedValue({})

      await AuditLogService.logClaimReject("claim-123", "admin-456", "Insufficient evidence", {
        documentsProvided: 2,
        requiredDocuments: 3,
      })

      expect(mockPrismaAuditLog.create).toHaveBeenCalledWith({
        data: {
          action: "claim.reject",
          actorId: "admin-456",
          targetId: "claim-123",
          targetType: "author_claim",
          metadata: { documentsProvided: 2, requiredDocuments: 3 },
          reason: "Insufficient evidence",
        },
      })
    })

    it("should log claim rejection without optional parameters", async () => {
      mockPrismaAuditLog.create.mockResolvedValue({})

      await AuditLogService.logClaimReject("claim-123", "admin-456")

      expect(mockPrismaAuditLog.create).toHaveBeenCalledWith({
        data: {
          action: "claim.reject",
          actorId: "admin-456",
          targetId: "claim-123",
          targetType: "author_claim",
          metadata: undefined,
          reason: undefined,
        },
      })
    })
  })

  describe("logUserBan", () => {
    it("should log user ban with reason and metadata", async () => {
      mockPrismaAuditLog.create.mockResolvedValue({})

      await AuditLogService.logUserBan("user-123", "admin-456", "Repeated violations", {
        violationCount: 5,
        banDuration: "30d",
      })

      expect(mockPrismaAuditLog.create).toHaveBeenCalledWith({
        data: {
          action: "user.ban",
          actorId: "admin-456",
          targetId: "user-123",
          targetType: "user",
          metadata: { violationCount: 5, banDuration: "30d" },
          reason: "Repeated violations",
        },
      })
    })

    it("should log user ban without optional parameters", async () => {
      mockPrismaAuditLog.create.mockResolvedValue({})

      await AuditLogService.logUserBan("user-123", "admin-456")

      expect(mockPrismaAuditLog.create).toHaveBeenCalledWith({
        data: {
          action: "user.ban",
          actorId: "admin-456",
          targetId: "user-123",
          targetType: "user",
          metadata: undefined,
          reason: undefined,
        },
      })
    })
  })

  describe("logUserUnban", () => {
    it("should log user unban", async () => {
      mockPrismaAuditLog.create.mockResolvedValue({})

      await AuditLogService.logUserUnban("user-123", "admin-456", {
        appealId: "appeal-789",
      })

      expect(mockPrismaAuditLog.create).toHaveBeenCalledWith({
        data: {
          action: "user.unban",
          actorId: "admin-456",
          targetId: "user-123",
          targetType: "user",
          metadata: { appealId: "appeal-789" },
          reason: undefined,
        },
      })
    })

    it("should log user unban without metadata", async () => {
      mockPrismaAuditLog.create.mockResolvedValue({})

      await AuditLogService.logUserUnban("user-123", "admin-456")

      expect(mockPrismaAuditLog.create).toHaveBeenCalledWith({
        data: {
          action: "user.unban",
          actorId: "admin-456",
          targetId: "user-123",
          targetType: "user",
          metadata: undefined,
          reason: undefined,
        },
      })
    })
  })

  describe("getLogsForTarget", () => {
    it("should retrieve logs for a specific target with default limit", async () => {
      const mockLogs = [
        {
          id: "log-1",
          action: "rule.publish",
          targetId: "rule-123",
          targetType: "rule",
          actor: {
            id: "user-456",
            displayName: "John Doe",
            handle: "johndoe",
            role: "USER",
          },
          createdAt: new Date(),
        },
        {
          id: "log-2",
          action: "rule.deprecate",
          targetId: "rule-123",
          targetType: "rule",
          actor: {
            id: "admin-789",
            displayName: "Admin User",
            handle: "admin",
            role: "ADMIN",
          },
          createdAt: new Date(),
        },
      ]

      mockPrismaAuditLog.findMany.mockResolvedValue(mockLogs)

      const result = await AuditLogService.getLogsForTarget("rule-123", "rule")

      expect(mockPrismaAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          targetId: "rule-123",
          targetType: "rule",
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
        take: 50,
      })

      expect(result).toEqual(mockLogs)
    })

    it("should retrieve logs for a specific target with custom limit", async () => {
      const mockLogs = [
        {
          id: "log-1",
          action: "comment.delete",
          targetId: "comment-123",
          targetType: "comment",
          actor: {
            id: "moderator-456",
            displayName: "Moderator",
            handle: "mod",
            role: "MODERATOR",
          },
          createdAt: new Date(),
        },
      ]

      mockPrismaAuditLog.findMany.mockResolvedValue(mockLogs)

      const result = await AuditLogService.getLogsForTarget("comment-123", "comment", 10)

      expect(mockPrismaAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          targetId: "comment-123",
          targetType: "comment",
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
        take: 10,
      })

      expect(result).toEqual(mockLogs)
    })
  })

  describe("getRecentLogs", () => {
    it("should retrieve recent logs with default limit", async () => {
      const mockLogs = [
        {
          id: "log-1",
          action: "user.ban",
          targetId: "user-123",
          targetType: "user",
          actor: {
            id: "admin-456",
            displayName: "Admin",
            handle: "admin",
            role: "ADMIN",
          },
          createdAt: new Date(),
        },
        {
          id: "log-2",
          action: "claim.approve",
          targetId: "claim-789",
          targetType: "author_claim",
          actor: {
            id: "admin-456",
            displayName: "Admin",
            handle: "admin",
            role: "ADMIN",
          },
          createdAt: new Date(),
        },
      ]

      mockPrismaAuditLog.findMany.mockResolvedValue(mockLogs)

      const result = await AuditLogService.getRecentLogs()

      expect(mockPrismaAuditLog.findMany).toHaveBeenCalledWith({
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
        take: 100,
      })

      expect(result).toEqual(mockLogs)
    })

    it("should retrieve recent logs with custom limit", async () => {
      const mockLogs = [
        {
          id: "log-1",
          action: "rule.publish",
          targetId: "rule-123",
          targetType: "rule",
          actor: {
            id: "user-456",
            displayName: "User",
            handle: "user",
            role: "USER",
          },
          createdAt: new Date(),
        },
      ]

      mockPrismaAuditLog.findMany.mockResolvedValue(mockLogs)

      const result = await AuditLogService.getRecentLogs(25)

      expect(mockPrismaAuditLog.findMany).toHaveBeenCalledWith({
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
        take: 25,
      })

      expect(result).toEqual(mockLogs)
    })
  })

  describe("getLogsByAction", () => {
    it("should retrieve logs by action type with default limit", async () => {
      const mockLogs = [
        {
          id: "log-1",
          action: "user.ban",
          targetId: "user-123",
          targetType: "user",
          actor: {
            id: "admin-456",
            displayName: "Admin",
            handle: "admin",
            role: "ADMIN",
          },
          createdAt: new Date(),
        },
        {
          id: "log-2",
          action: "user.ban",
          targetId: "user-789",
          targetType: "user",
          actor: {
            id: "admin-456",
            displayName: "Admin",
            handle: "admin",
            role: "ADMIN",
          },
          createdAt: new Date(),
        },
      ]

      mockPrismaAuditLog.findMany.mockResolvedValue(mockLogs)

      const result = await AuditLogService.getLogsByAction("user.ban")

      expect(mockPrismaAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          action: "user.ban",
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
        take: 50,
      })

      expect(result).toEqual(mockLogs)
    })

    it("should retrieve logs by action type with custom limit", async () => {
      const mockLogs = [
        {
          id: "log-1",
          action: "rule.publish",
          targetId: "rule-123",
          targetType: "rule",
          actor: {
            id: "user-456",
            displayName: "User",
            handle: "user",
            role: "USER",
          },
          createdAt: new Date(),
        },
      ]

      mockPrismaAuditLog.findMany.mockResolvedValue(mockLogs)

      const result = await AuditLogService.getLogsByAction("rule.publish", 10)

      expect(mockPrismaAuditLog.findMany).toHaveBeenCalledWith({
        where: {
          action: "rule.publish",
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
        take: 10,
      })

      expect(result).toEqual(mockLogs)
    })
  })

  describe("convenience exports", () => {
    it("should export auditLog convenience functions", () => {
      expect(auditLog.rulePublish).toBe(AuditLogService.logRulePublish)
      expect(auditLog.ruleDeprecate).toBe(AuditLogService.logRuleDeprecate)
      expect(auditLog.commentDelete).toBe(AuditLogService.logCommentDelete)
      expect(auditLog.claimApprove).toBe(AuditLogService.logClaimApprove)
      expect(auditLog.claimReject).toBe(AuditLogService.logClaimReject)
      expect(auditLog.userBan).toBe(AuditLogService.logUserBan)
      expect(auditLog.userUnban).toBe(AuditLogService.logUserUnban)
    })

    it("should export AuditLog as alias for AuditLogService", () => {
      expect(AuditLog).toBe(AuditLogService)
    })
  })

  describe("error handling in specific methods", () => {
    it("should handle errors in logRulePublish", async () => {
      const dbError = new Error("Database error")
      mockPrismaAuditLog.create.mockRejectedValue(dbError)

      await expect(AuditLogService.logRulePublish("rule-123", "user-456")).resolves.toBeUndefined()

      expect(console.error).toHaveBeenCalledWith("Failed to create audit log entry:", dbError)
    })

    it("should handle errors in logCommentDelete", async () => {
      const dbError = new Error("Connection timeout")
      mockPrismaAuditLog.create.mockRejectedValue(dbError)

      await expect(
        AuditLogService.logCommentDelete("comment-123", "moderator-456")
      ).resolves.toBeUndefined()

      expect(console.error).toHaveBeenCalledWith("Failed to create audit log entry:", dbError)
    })

    it("should handle errors in logUserBan", async () => {
      const dbError = new Error("Validation error")
      mockPrismaAuditLog.create.mockRejectedValue(dbError)

      await expect(AuditLogService.logUserBan("user-123", "admin-456")).resolves.toBeUndefined()

      expect(console.error).toHaveBeenCalledWith("Failed to create audit log entry:", dbError)
    })
  })

  describe("integration with convenience functions", () => {
    it("should work through auditLog.rulePublish", async () => {
      mockPrismaAuditLog.create.mockResolvedValue({})

      // Test that the convenience function is correctly mapped
      expect(auditLog.rulePublish).toBe(AuditLogService.logRulePublish)

      // Test the actual functionality through the class method
      await AuditLogService.logRulePublish("rule-123", "user-456", {
        version: "2.0.0",
      })

      expect(mockPrismaAuditLog.create).toHaveBeenCalledWith({
        data: {
          action: "rule.publish",
          actorId: "user-456",
          targetId: "rule-123",
          targetType: "rule",
          metadata: { version: "2.0.0" },
          reason: undefined,
        },
      })
    })

    it("should work through auditLog.userBan", async () => {
      mockPrismaAuditLog.create.mockResolvedValue({})

      // Test that the convenience function is correctly mapped
      expect(auditLog.userBan).toBe(AuditLogService.logUserBan)

      // Test the actual functionality through the class method
      await AuditLogService.logUserBan("user-123", "admin-456", "Policy violation", {
        policySection: "3.2",
      })

      expect(mockPrismaAuditLog.create).toHaveBeenCalledWith({
        data: {
          action: "user.ban",
          actorId: "admin-456",
          targetId: "user-123",
          targetType: "user",
          metadata: { policySection: "3.2" },
          reason: "Policy violation",
        },
      })
    })
  })

  describe("edge cases", () => {
    it("should handle null and undefined values in metadata", async () => {
      mockPrismaAuditLog.create.mockResolvedValue({})

      const entry: AuditLogEntry = {
        action: "test.action",
        actorId: "user-123",
        metadata: {
          nullValue: null,
          undefinedValue: undefined,
          emptyString: "",
          zeroValue: 0,
          falseValue: false,
        },
      }

      await AuditLogService.log(entry)

      expect(mockPrismaAuditLog.create).toHaveBeenCalledWith({
        data: {
          action: "test.action",
          actorId: "user-123",
          targetId: undefined,
          targetType: undefined,
          metadata: {
            nullValue: null,
            undefinedValue: undefined,
            emptyString: "",
            zeroValue: 0,
            falseValue: false,
          },
          reason: undefined,
        },
      })
    })

    it("should handle empty strings as valid values", async () => {
      mockPrismaAuditLog.create.mockResolvedValue({})

      const entry: AuditLogEntry = {
        action: "",
        actorId: "",
        targetId: "",
        targetType: "",
        reason: "",
      }

      await AuditLogService.log(entry)

      expect(mockPrismaAuditLog.create).toHaveBeenCalledWith({
        data: {
          action: "",
          actorId: "",
          targetId: "",
          targetType: "",
          metadata: undefined,
          reason: "",
        },
      })
    })

    it("should handle complex metadata objects", async () => {
      mockPrismaAuditLog.create.mockResolvedValue({})

      const complexMetadata = {
        nested: {
          object: {
            with: "deep nesting",
            array: [1, 2, 3],
            boolean: true,
          },
        },
        topLevel: "value",
        numbers: [1, 2, 3, 4, 5],
        mixed: {
          string: "text",
          number: 42,
          boolean: false,
          null: null,
          undefined: undefined,
        },
      }

      await AuditLogService.logRulePublish("rule-123", "user-456", complexMetadata)

      expect(mockPrismaAuditLog.create).toHaveBeenCalledWith({
        data: {
          action: "rule.publish",
          actorId: "user-456",
          targetId: "rule-123",
          targetType: "rule",
          metadata: complexMetadata,
          reason: undefined,
        },
      })
    })
  })
})
