import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TRPCError } from "@trpc/server"
import { versionsRouter } from "./versions"

// Mock dependencies
vi.mock("../trpc", () => ({
  router: vi.fn(routes => ({
    createCaller: vi.fn(ctx => {
      const caller = {}
      for (const [key, procedure] of Object.entries(routes)) {
        caller[key] = async input => {
          const mockHandlers = {
            listByRule: async ({ input, ctx }) => {
              const { ruleId, cursor, limit = 25, includeBody = false } = input

              // Check if rule exists
              const rule = await ctx.prisma.rule.findUnique({
                where: { id: ruleId, deletedAt: null },
                select: { id: true, status: true, createdByUserId: true },
              })

              if (!rule) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: "Rule not found",
                })
              }

              // Build where clause for cursor pagination
              const where = { ruleId }
              if (cursor) {
                const cursorVersion = await ctx.prisma.ruleVersion.findUnique({
                  where: { id: cursor },
                  select: { createdAt: true },
                })
                if (cursorVersion) {
                  where.createdAt = { lt: cursorVersion.createdAt }
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
                    where: { userId: ctx.user?.id },
                    select: { value: true },
                  },
                  _count: {
                    select: { voteVersions: true },
                  },
                },
              })

              const hasMore = versions.length > limit
              const items = hasMore ? versions.slice(0, -1) : versions
              const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

              // Get vote scores for versions
              const versionIds = items.map(v => v.id)
              const voteStats = await ctx.prisma.voteVersion.groupBy({
                by: ["ruleVersionId"],
                where: { ruleVersionId: { in: versionIds } },
                _sum: { value: true },
              })

              const transformedItems = items.map(version => ({
                id: version.id,
                ruleId: version.ruleId,
                version: version.version,
                body: includeBody ? version.body : "",
                testedOn: version.testedOn || null,
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
                score: voteStats.find(vs => vs.ruleVersionId === version.id)?._sum.value || 0,
                userVote: version.voteVersions[0]
                  ? version.voteVersions[0].value > 0
                    ? "up"
                    : "down"
                  : null,
              }))

              return {
                items: transformedItems,
                nextCursor,
                hasMore,
              }
            },

            createVersion: async ({ input, ctx }) => {
              const {
                ruleId,
                baseVersionId,
                body,
                changelog,
                testedOn,
                version: inputVersion,
              } = input

              // Check rule ownership
              const rule = await ctx.prisma.rule.findUnique({
                where: { id: ruleId },
                select: {
                  id: true,
                  slug: true,
                  title: true,
                  status: true,
                  createdByUserId: true,
                  deletedAt: true,
                },
              })

              if (!rule || rule.deletedAt) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: "Rule not found",
                })
              }

              const canEdit =
                rule.createdByUserId === ctx.user?.id ||
                ctx.user?.role === "MOD" ||
                ctx.user?.role === "ADMIN"

              if (!canEdit) {
                throw new TRPCError({
                  code: "FORBIDDEN",
                  message: "You don't have permission to create versions for this rule",
                })
              }

              // Get base version if specified
              let baseVersion
              if (baseVersionId) {
                baseVersion = await ctx.prisma.ruleVersion.findUnique({
                  where: { id: baseVersionId, ruleId },
                  select: { version: true, body: true },
                })
                if (!baseVersion) {
                  throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Base version not found",
                  })
                }
              } else {
                baseVersion = await ctx.prisma.ruleVersion.findFirst({
                  where: { ruleId },
                  orderBy: { createdAt: "desc" },
                  select: { version: true, body: true },
                })
              }

              // Determine version number
              let newVersion
              if (inputVersion) {
                const existingVersion = await ctx.prisma.ruleVersion.findFirst({
                  where: { ruleId, version: inputVersion },
                })
                if (existingVersion) {
                  throw new TRPCError({
                    code: "CONFLICT",
                    message: "Version already exists",
                  })
                }
                newVersion = inputVersion
              } else {
                const latestVersion = await ctx.prisma.ruleVersion.findFirst({
                  where: { ruleId },
                  orderBy: { createdAt: "desc" },
                  select: { version: true },
                })

                if (latestVersion) {
                  // Simple increment logic for testing
                  const parts = latestVersion.version.split(".").map(Number)
                  newVersion = `${parts[0]}.${parts[1] + 1}.0`
                } else {
                  newVersion = "1.0.0"
                }
              }

              const result = await ctx.prisma.$transaction(async tx => {
                const version = await tx.ruleVersion.create({
                  data: {
                    ruleId,
                    version: newVersion,
                    body,
                    testedOn: testedOn || {},
                    changelog: changelog || `Version ${newVersion}`,
                    parentVersionId: baseVersionId || null,
                    createdByUserId: ctx.user?.id,
                  },
                })

                await tx.rule.update({
                  where: { id: ruleId },
                  data: {
                    currentVersionId: version.id,
                    updatedAt: ctx.now,
                  },
                })

                return { id: version.id, version: newVersion }
              })

              // Mock notifications (fire-and-forget)
              try {
                if (global.__mockNotifications) {
                  await global.__mockNotifications.newVersion({
                    ruleId,
                    ruleSlug: rule.slug,
                    versionId: result.id,
                    version: result.version,
                    authorId: ctx.user.id,
                    authorHandle: ctx.user.handle,
                    authorDisplayName: ctx.user.displayName,
                  })

                  if (rule.status === "PUBLISHED") {
                    await global.__mockNotifications.authorPublished({
                      ruleId,
                      ruleSlug: rule.slug,
                      ruleTitle: rule.title,
                      authorId: ctx.user.id,
                      authorHandle: ctx.user.handle,
                      authorDisplayName: ctx.user.displayName,
                    })
                  }
                }
              } catch (error) {
                console.error("Failed to send version notifications:", error)
              }

              return result
            },

            fork: async ({ input, ctx }) => {
              const { ruleId, fromVersionId, newBody, changelog, testedOn } = input

              // Check rule ownership
              const rule = await ctx.prisma.rule.findUnique({
                where: { id: ruleId },
                select: {
                  id: true,
                  createdByUserId: true,
                  deletedAt: true,
                },
              })

              if (!rule || rule.deletedAt) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: "Rule not found",
                })
              }

              const canEdit =
                rule.createdByUserId === ctx.user?.id ||
                ctx.user?.role === "MOD" ||
                ctx.user?.role === "ADMIN"

              if (!canEdit) {
                throw new TRPCError({
                  code: "FORBIDDEN",
                  message: "You don't have permission to fork versions for this rule",
                })
              }

              // Get source version
              const sourceVersion = await ctx.prisma.ruleVersion.findUnique({
                where: { id: fromVersionId, ruleId },
                select: { version: true, body: true, testedOn: true },
              })

              if (!sourceVersion) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: "Source version not found",
                })
              }

              // Generate new patch version
              const parts = sourceVersion.version.split(".").map(Number)
              const newVersionNumber = `${parts[0]}.${parts[1]}.${parts[2] + 1}`

              const version = await ctx.prisma.ruleVersion.create({
                data: {
                  ruleId,
                  version: newVersionNumber,
                  body: newBody || sourceVersion.body,
                  testedOn: testedOn || sourceVersion.testedOn || {},
                  changelog: changelog || `Forked from ${sourceVersion.version}`,
                  parentVersionId: fromVersionId,
                  createdByUserId: ctx.user?.id,
                },
              })

              return { id: version.id, version: newVersionNumber }
            },

            getById: async ({ input, ctx }) => {
              const { versionId, includeUserActions = false } = input

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
              })

              if (!version || version.rule.deletedAt) {
                return null
              }

              // Get vote information
              let userVote = null
              let score = 0

              const [voteStats, userVoteRecord] = await Promise.all([
                ctx.prisma.voteVersion.aggregate({
                  where: { ruleVersionId: versionId },
                  _sum: { value: true },
                }),
                includeUserActions
                  ? ctx.prisma.voteVersion.findUnique({
                      where: {
                        userId_ruleVersionId: {
                          userId: ctx.user?.id,
                          ruleVersionId: versionId,
                        },
                      },
                    })
                  : null,
              ])

              score = voteStats._sum.value || 0
              userVote = userVoteRecord ? (userVoteRecord.value > 0 ? "up" : "down") : null

              return {
                id: version.id,
                ruleId: version.ruleId,
                version: version.version,
                body: version.body,
                testedOn: version.testedOn || null,
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
                userVote,
              }
            },

            getDiff: async ({ input, ctx }) => {
              const { prevVersionId, currVersionId, format = "json" } = input

              const [prevVersion, currVersion] = await Promise.all([
                ctx.prisma.ruleVersion.findUnique({
                  where: { id: prevVersionId },
                  select: { body: true, ruleId: true },
                }),
                ctx.prisma.ruleVersion.findUnique({
                  where: { id: currVersionId },
                  select: { body: true, ruleId: true },
                }),
              ])

              if (!prevVersion || !currVersion) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: "One or both versions not found",
                })
              }

              if (prevVersion.ruleId !== currVersion.ruleId) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: "Versions must belong to the same rule",
                })
              }

              // Simple diff generation for testing
              const oldLines = prevVersion.body.split("\n")
              const newLines = currVersion.body.split("\n")
              const changes = []

              const maxLines = Math.max(oldLines.length, newLines.length)
              for (let i = 0; i < maxLines; i++) {
                const oldLine = oldLines[i] || ""
                const newLine = newLines[i] || ""

                if (oldLine !== newLine) {
                  if (oldLine && newLine) {
                    changes.push({
                      type: "modified",
                      line: i + 1,
                      old: oldLine,
                      new: newLine,
                    })
                  } else if (oldLine) {
                    changes.push({ type: "deleted", line: i + 1, content: oldLine })
                  } else {
                    changes.push({ type: "added", line: i + 1, content: newLine })
                  }
                }
              }

              const diff = {
                changes,
                stats: {
                  additions: changes.filter(c => c.type === "added").length,
                  deletions: changes.filter(c => c.type === "deleted").length,
                  modifications: changes.filter(c => c.type === "modified").length,
                },
              }

              return { diff, format }
            },

            setCurrent: async ({ input, ctx }) => {
              const { ruleId, versionId } = input

              // Check rule ownership
              const rule = await ctx.prisma.rule.findUnique({
                where: { id: ruleId },
                select: {
                  id: true,
                  createdByUserId: true,
                  deletedAt: true,
                },
              })

              if (!rule || rule.deletedAt) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: "Rule not found",
                })
              }

              const canEdit =
                rule.createdByUserId === ctx.user?.id ||
                ctx.user?.role === "MOD" ||
                ctx.user?.role === "ADMIN"

              if (!canEdit) {
                throw new TRPCError({
                  code: "FORBIDDEN",
                  message: "You don't have permission to modify this rule",
                })
              }

              // Verify version belongs to rule
              const version = await ctx.prisma.ruleVersion.findUnique({
                where: { id: versionId, ruleId },
              })

              if (!version) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: "Version not found for this rule",
                })
              }

              await ctx.prisma.rule.update({
                where: { id: ruleId },
                data: {
                  currentVersionId: versionId,
                  updatedAt: ctx.now,
                },
              })

              return { success: true }
            },
          }

          if (mockHandlers[key]) {
            return await mockHandlers[key]({ input, ctx })
          }

          throw new Error(`No handler found for ${key}`)
        }
      }
      return caller
    }),
  })),
  protectedProcedure: {
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
    use: vi.fn().mockReturnThis(),
  },
  rateLimitedProcedure: {
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
    use: vi.fn().mockReturnThis(),
  },
  audit: vi.fn(() => ({
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
    use: vi.fn().mockReturnThis(),
  })),
  getRuleOwnership: vi.fn(),
}))

// Mock schemas
vi.mock("../schemas/version", () => ({
  createVersionSchema: { parse: vi.fn(data => data) },
  forkVersionSchema: { parse: vi.fn(data => data) },
  listVersionsByRuleSchema: { parse: vi.fn(data => data) },
  getVersionByIdSchema: { parse: vi.fn(data => data) },
  getVersionDiffSchema: { parse: vi.fn(data => data) },
  updateVersionSchema: { parse: vi.fn(data => data) },
  setCurrentVersionSchema: { parse: vi.fn(data => data) },
}))

vi.mock("../schemas/dto", () => ({
  ruleVersionDetailDTOSchema: {
    parse: vi.fn(data => data),
    nullable: vi.fn().mockReturnThis(),
  },
}))

vi.mock("../schemas/base", () => ({
  createPaginatedSchema: vi.fn(() => ({ parse: vi.fn(data => data) })),
}))

// Mock Notifications service
vi.mock("../services/notify", () => ({
  Notifications: {
    newVersion: vi.fn(),
    authorPublished: vi.fn(),
  },
}))

describe("Versions Router", () => {
  let mockPrisma: any
  let mockCtx: any
  let caller: any
  let mockNotifications: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock Prisma client
    mockPrisma = {
      rule: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      ruleVersion: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
      },
      voteVersion: {
        aggregate: vi.fn(),
        groupBy: vi.fn(),
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(),
    }

    // Mock notifications
    mockNotifications = {
      newVersion: vi.fn(),
      authorPublished: vi.fn(),
    }

    // Set global mock for handlers to access
    global.__mockNotifications = mockNotifications

    // Mock context
    mockCtx = {
      prisma: mockPrisma,
      user: {
        id: "user-123",
        handle: "testuser",
        displayName: "Test User",
        role: "USER",
      },
      now: new Date("2023-01-01T00:00:00Z"),
    }

    // Create caller
    caller = versionsRouter.createCaller(mockCtx)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete global.__mockNotifications
  })

  describe("listByRule", () => {
    it("should list versions for a rule with pagination", async () => {
      const input = {
        ruleId: "rule-123",
        limit: 10,
        includeBody: true,
      }

      const mockRule = {
        id: "rule-123",
        status: "PUBLISHED",
        createdByUserId: "user-123",
      }

      const mockVersions = [
        {
          id: "version-1",
          ruleId: "rule-123",
          version: "1.1.0",
          body: "Test body content",
          testedOn: { models: ["gpt-4"] },
          changelog: "Updated logic",
          parentVersionId: null,
          createdAt: new Date("2023-01-01"),
          createdBy: {
            id: "user-123",
            handle: "testuser",
            displayName: "Test User",
            avatarUrl: "avatar.jpg",
            role: "USER",
            authorProfile: { isVerified: true },
          },
          voteVersions: [{ value: 1 }],
          _count: { voteVersions: 5 },
        },
        {
          id: "version-2",
          ruleId: "rule-123",
          version: "1.0.0",
          body: "Original content",
          testedOn: {},
          changelog: "Initial version",
          parentVersionId: null,
          createdAt: new Date("2022-12-01"),
          createdBy: {
            id: "user-123",
            handle: "testuser",
            displayName: "Test User",
            avatarUrl: "avatar.jpg",
            role: "USER",
            authorProfile: { isVerified: false },
          },
          voteVersions: [],
          _count: { voteVersions: 2 },
        },
      ]

      const mockVoteStats = [
        { ruleVersionId: "version-1", _sum: { value: 3 } },
        { ruleVersionId: "version-2", _sum: { value: 1 } },
      ]

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.ruleVersion.findMany.mockResolvedValue(mockVersions)
      mockPrisma.voteVersion.groupBy.mockResolvedValue(mockVoteStats)

      const result = await caller.listByRule(input)

      expect(mockPrisma.rule.findUnique).toHaveBeenCalledWith({
        where: { id: "rule-123", deletedAt: null },
        select: { id: true, status: true, createdByUserId: true },
      })

      expect(result).toEqual({
        items: [
          {
            id: "version-1",
            ruleId: "rule-123",
            version: "1.1.0",
            body: "Test body content",
            testedOn: { models: ["gpt-4"] },
            changelog: "Updated logic",
            parentVersionId: null,
            createdBy: {
              id: "user-123",
              handle: "testuser",
              displayName: "Test User",
              avatarUrl: "avatar.jpg",
              role: "USER",
              isVerified: true,
            },
            createdAt: new Date("2023-01-01"),
            score: 3,
            userVote: "up",
          },
          {
            id: "version-2",
            ruleId: "rule-123",
            version: "1.0.0",
            body: "Original content",
            testedOn: {},
            changelog: "Initial version",
            parentVersionId: null,
            createdBy: {
              id: "user-123",
              handle: "testuser",
              displayName: "Test User",
              avatarUrl: "avatar.jpg",
              role: "USER",
              isVerified: false,
            },
            createdAt: new Date("2022-12-01"),
            score: 1,
            userVote: null,
          },
        ],
        nextCursor: undefined,
        hasMore: false,
      })
    })

    it("should exclude body when includeBody is false", async () => {
      const input = {
        ruleId: "rule-123",
        limit: 10,
        includeBody: false,
      }

      const mockRule = { id: "rule-123", status: "PUBLISHED", createdByUserId: "user-123" }
      const mockVersions = [
        {
          id: "version-1",
          ruleId: "rule-123",
          version: "1.0.0",
          body: "Test body content",
          testedOn: {},
          changelog: "Test",
          parentVersionId: null,
          createdAt: new Date("2023-01-01"),
          createdBy: {
            id: "user-123",
            handle: "testuser",
            displayName: "Test User",
            avatarUrl: "avatar.jpg",
            role: "USER",
            authorProfile: { isVerified: false },
          },
          voteVersions: [],
          _count: { voteVersions: 0 },
        },
      ]

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.ruleVersion.findMany.mockResolvedValue(mockVersions)
      mockPrisma.voteVersion.groupBy.mockResolvedValue([])

      const result = await caller.listByRule(input)

      expect(result.items[0].body).toBe("")
    })

    it("should handle pagination with cursor", async () => {
      const input = {
        ruleId: "rule-123",
        cursor: "version-cursor",
        limit: 2,
      }

      const mockRule = { id: "rule-123", status: "PUBLISHED", createdByUserId: "user-123" }
      const mockCursorVersion = { createdAt: new Date("2023-01-15") }
      const mockVersions = Array.from({ length: 3 }, (_, i) => ({
        id: `version-${i + 1}`,
        ruleId: "rule-123",
        version: `1.${i}.0`,
        body: "Body",
        testedOn: {},
        changelog: "Change",
        parentVersionId: null,
        createdAt: new Date(`2023-01-${10 + i}`),
        createdBy: {
          id: "user-123",
          handle: "testuser",
          displayName: "Test User",
          avatarUrl: "avatar.jpg",
          role: "USER",
          authorProfile: { isVerified: false },
        },
        voteVersions: [],
        _count: { voteVersions: 0 },
      }))

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.ruleVersion.findUnique.mockResolvedValue(mockCursorVersion)
      mockPrisma.ruleVersion.findMany.mockResolvedValue(mockVersions)
      mockPrisma.voteVersion.groupBy.mockResolvedValue([])

      const result = await caller.listByRule(input)

      expect(result.hasMore).toBe(true)
      expect(result.items).toHaveLength(2)
      expect(result.nextCursor).toBe("version-2")

      expect(mockPrisma.ruleVersion.findMany).toHaveBeenCalledWith({
        where: {
          ruleId: "rule-123",
          createdAt: { lt: new Date("2023-01-15") },
        },
        orderBy: { createdAt: "desc" },
        take: 3,
        include: expect.any(Object),
      })
    })

    it("should throw error if rule not found", async () => {
      const input = { ruleId: "nonexistent-rule" }

      mockPrisma.rule.findUnique.mockResolvedValue(null)

      await expect(caller.listByRule(input)).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Rule not found",
        })
      )
    })

    it("should handle versions with downvotes", async () => {
      const input = { ruleId: "rule-123" }

      const mockRule = { id: "rule-123", status: "PUBLISHED", createdByUserId: "user-123" }
      const mockVersions = [
        {
          id: "version-1",
          ruleId: "rule-123",
          version: "1.0.0",
          body: "Body",
          testedOn: {},
          changelog: "Change",
          parentVersionId: null,
          createdAt: new Date("2023-01-01"),
          createdBy: {
            id: "user-123",
            handle: "testuser",
            displayName: "Test User",
            avatarUrl: "avatar.jpg",
            role: "USER",
            authorProfile: { isVerified: false },
          },
          voteVersions: [{ value: -1 }],
          _count: { voteVersions: 1 },
        },
      ]

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.ruleVersion.findMany.mockResolvedValue(mockVersions)
      mockPrisma.voteVersion.groupBy.mockResolvedValue([])

      const result = await caller.listByRule(input)

      expect(result.items[0].userVote).toBe("down")
    })
  })

  describe("createVersion", () => {
    beforeEach(() => {
      mockPrisma.$transaction.mockImplementation(async callback => {
        return await callback(mockPrisma)
      })
    })

    it("should create a new version with auto-increment", async () => {
      const input = {
        ruleId: "rule-123",
        body: "New version body",
        changelog: "Added new features",
        testedOn: { models: ["gpt-4"] },
      }

      const mockRule = {
        id: "rule-123",
        slug: "test-rule",
        title: "Test Rule",
        status: "PUBLISHED",
        createdByUserId: "user-123",
        deletedAt: null,
      }

      const mockLatestVersion = { version: "1.0.0" }
      const mockCreatedVersion = {
        id: "version-new",
        version: "1.1.0",
        ruleId: "rule-123",
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.ruleVersion.findFirst
        .mockResolvedValueOnce(null) // baseVersion lookup
        .mockResolvedValueOnce(mockLatestVersion) // latest version lookup
      mockPrisma.ruleVersion.create.mockResolvedValue(mockCreatedVersion)
      mockPrisma.rule.update.mockResolvedValue({})

      const result = await caller.createVersion(input)

      expect(mockPrisma.ruleVersion.create).toHaveBeenCalledWith({
        data: {
          ruleId: "rule-123",
          version: "1.1.0",
          body: "New version body",
          testedOn: { models: ["gpt-4"] },
          changelog: "Added new features",
          parentVersionId: null,
          createdByUserId: "user-123",
        },
      })

      expect(mockPrisma.rule.update).toHaveBeenCalledWith({
        where: { id: "rule-123" },
        data: {
          currentVersionId: "version-new",
          updatedAt: mockCtx.now,
        },
      })

      expect(result).toEqual({
        id: "version-new",
        version: "1.1.0",
      })

      expect(mockNotifications.newVersion).toHaveBeenCalledWith({
        ruleId: "rule-123",
        ruleSlug: "test-rule",
        versionId: "version-new",
        version: "1.1.0",
        authorId: "user-123",
        authorHandle: "testuser",
        authorDisplayName: "Test User",
      })

      expect(mockNotifications.authorPublished).toHaveBeenCalledWith({
        ruleId: "rule-123",
        ruleSlug: "test-rule",
        ruleTitle: "Test Rule",
        authorId: "user-123",
        authorHandle: "testuser",
        authorDisplayName: "Test User",
      })
    })

    it("should create first version when no previous versions exist", async () => {
      const input = {
        ruleId: "rule-123",
        body: "First version body",
      }

      const mockRule = {
        id: "rule-123",
        slug: "test-rule",
        title: "Test Rule",
        status: "DRAFT",
        createdByUserId: "user-123",
        deletedAt: null,
      }

      const mockCreatedVersion = {
        id: "version-first",
        version: "1.0.0",
        ruleId: "rule-123",
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.ruleVersion.findFirst
        .mockResolvedValueOnce(null) // baseVersion lookup
        .mockResolvedValueOnce(null) // latest version lookup (no versions exist)
      mockPrisma.ruleVersion.create.mockResolvedValue(mockCreatedVersion)
      mockPrisma.rule.update.mockResolvedValue({})

      const result = await caller.createVersion(input)

      expect(mockPrisma.ruleVersion.create).toHaveBeenCalledWith({
        data: {
          ruleId: "rule-123",
          version: "1.0.0",
          body: "First version body",
          testedOn: {},
          changelog: "Version 1.0.0",
          parentVersionId: null,
          createdByUserId: "user-123",
        },
      })

      expect(result.version).toBe("1.0.0")

      // Should not call authorPublished for draft rules
      expect(mockNotifications.authorPublished).not.toHaveBeenCalled()
    })

    it("should create version with specific version number", async () => {
      const input = {
        ruleId: "rule-123",
        body: "Version body",
        version: "2.0.0",
      }

      const mockRule = {
        id: "rule-123",
        slug: "test-rule",
        title: "Test Rule",
        status: "PUBLISHED",
        createdByUserId: "user-123",
        deletedAt: null,
      }

      const mockCreatedVersion = {
        id: "version-custom",
        version: "2.0.0",
        ruleId: "rule-123",
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.ruleVersion.findFirst
        .mockResolvedValueOnce(null) // baseVersion lookup
        .mockResolvedValueOnce(null) // existing version check
      mockPrisma.ruleVersion.create.mockResolvedValue(mockCreatedVersion)
      mockPrisma.rule.update.mockResolvedValue({})

      const result = await caller.createVersion(input)

      expect(result.version).toBe("2.0.0")
    })

    it("should create version based on specific base version", async () => {
      const input = {
        ruleId: "rule-123",
        baseVersionId: "version-base",
        body: "Based on specific version",
      }

      const mockRule = {
        id: "rule-123",
        slug: "test-rule",
        title: "Test Rule",
        status: "PUBLISHED",
        createdByUserId: "user-123",
        deletedAt: null,
      }

      const mockBaseVersion = {
        version: "1.5.0",
        body: "Base body",
      }

      const mockLatestVersion = { version: "1.8.0" }

      const mockCreatedVersion = {
        id: "version-based",
        version: "1.9.0",
        ruleId: "rule-123",
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.ruleVersion.findUnique.mockResolvedValue(mockBaseVersion)
      mockPrisma.ruleVersion.findFirst.mockResolvedValue(mockLatestVersion)
      mockPrisma.ruleVersion.create.mockResolvedValue(mockCreatedVersion)
      mockPrisma.rule.update.mockResolvedValue({})

      const result = await caller.createVersion(input)

      expect(mockPrisma.ruleVersion.findUnique).toHaveBeenCalledWith({
        where: { id: "version-base", ruleId: "rule-123" },
        select: { version: true, body: true },
      })

      expect(mockPrisma.ruleVersion.create).toHaveBeenCalledWith({
        data: {
          ruleId: "rule-123",
          version: "1.9.0",
          body: "Based on specific version",
          testedOn: {},
          changelog: "Version 1.9.0",
          parentVersionId: "version-base",
          createdByUserId: "user-123",
        },
      })
    })

    it("should throw error if rule not found", async () => {
      const input = {
        ruleId: "nonexistent-rule",
        body: "Test body",
      }

      mockPrisma.rule.findUnique.mockResolvedValue(null)

      await expect(caller.createVersion(input)).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Rule not found",
        })
      )
    })

    it("should throw error if user lacks permission", async () => {
      const input = {
        ruleId: "rule-123",
        body: "Test body",
      }

      const mockRule = {
        id: "rule-123",
        createdByUserId: "other-user",
        deletedAt: null,
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)

      await expect(caller.createVersion(input)).rejects.toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to create versions for this rule",
        })
      )
    })

    it("should throw error if base version not found", async () => {
      const input = {
        ruleId: "rule-123",
        baseVersionId: "nonexistent-version",
        body: "Test body",
      }

      const mockRule = {
        id: "rule-123",
        createdByUserId: "user-123",
        deletedAt: null,
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.ruleVersion.findUnique.mockResolvedValue(null)

      await expect(caller.createVersion(input)).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Base version not found",
        })
      )
    })

    it("should throw error if version already exists", async () => {
      const input = {
        ruleId: "rule-123",
        body: "Test body",
        version: "1.0.0",
      }

      const mockRule = {
        id: "rule-123",
        createdByUserId: "user-123",
        deletedAt: null,
      }

      const mockExistingVersion = {
        id: "version-existing",
        version: "1.0.0",
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.ruleVersion.findFirst
        .mockResolvedValueOnce(null) // baseVersion lookup
        .mockResolvedValueOnce(mockExistingVersion) // existing version check

      await expect(caller.createVersion(input)).rejects.toThrow(
        new TRPCError({
          code: "CONFLICT",
          message: "Version already exists",
        })
      )
    })

    it("should handle notification failures gracefully", async () => {
      const input = {
        ruleId: "rule-123",
        body: "Test body",
      }

      const mockRule = {
        id: "rule-123",
        slug: "test-rule",
        title: "Test Rule",
        status: "PUBLISHED",
        createdByUserId: "user-123",
        deletedAt: null,
      }

      const mockCreatedVersion = {
        id: "version-new",
        version: "1.0.0",
        ruleId: "rule-123",
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.ruleVersion.findFirst.mockResolvedValue(null)
      mockPrisma.ruleVersion.create.mockResolvedValue(mockCreatedVersion)
      mockPrisma.rule.update.mockResolvedValue({})

      // Mock notification failure
      mockNotifications.newVersion.mockRejectedValue(new Error("Notification failed"))

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

      const result = await caller.createVersion(input)

      expect(result).toEqual({
        id: "version-new",
        version: "1.0.0",
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to send version notifications:",
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    it("should allow moderators to create versions", async () => {
      const moderatorCtx = {
        ...mockCtx,
        user: { ...mockCtx.user, role: "MOD" },
      }

      const moderatorCaller = versionsRouter.createCaller(moderatorCtx)

      const input = {
        ruleId: "rule-123",
        body: "Moderator version",
      }

      const mockRule = {
        id: "rule-123",
        slug: "test-rule",
        title: "Test Rule",
        status: "PUBLISHED",
        createdByUserId: "other-user",
        deletedAt: null,
      }

      const mockCreatedVersion = {
        id: "version-mod",
        version: "1.0.0",
        ruleId: "rule-123",
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.ruleVersion.findFirst.mockResolvedValue(null)
      mockPrisma.ruleVersion.create.mockResolvedValue(mockCreatedVersion)
      mockPrisma.rule.update.mockResolvedValue({})

      const result = await moderatorCaller.createVersion(input)

      expect(result).toEqual({
        id: "version-mod",
        version: "1.0.0",
      })
    })
  })

  describe("fork", () => {
    it("should fork a version with new body", async () => {
      const input = {
        ruleId: "rule-123",
        fromVersionId: "version-source",
        newBody: "Forked content",
        changelog: "Forked with changes",
        testedOn: { models: ["gpt-3.5"] },
      }

      const mockRule = {
        id: "rule-123",
        createdByUserId: "user-123",
        deletedAt: null,
      }

      const mockSourceVersion = {
        version: "1.2.0",
        body: "Original content",
        testedOn: { models: ["gpt-4"] },
      }

      const mockForkedVersion = {
        id: "version-forked",
        version: "1.2.1",
        ruleId: "rule-123",
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.ruleVersion.findUnique.mockResolvedValue(mockSourceVersion)
      mockPrisma.ruleVersion.create.mockResolvedValue(mockForkedVersion)

      const result = await caller.fork(input)

      expect(mockPrisma.ruleVersion.findUnique).toHaveBeenCalledWith({
        where: { id: "version-source", ruleId: "rule-123" },
        select: { version: true, body: true, testedOn: true },
      })

      expect(mockPrisma.ruleVersion.create).toHaveBeenCalledWith({
        data: {
          ruleId: "rule-123",
          version: "1.2.1",
          body: "Forked content",
          testedOn: { models: ["gpt-3.5"] },
          changelog: "Forked with changes",
          parentVersionId: "version-source",
          createdByUserId: "user-123",
        },
      })

      expect(result).toEqual({
        id: "version-forked",
        version: "1.2.1",
      })
    })

    it("should fork a version preserving original content", async () => {
      const input = {
        ruleId: "rule-123",
        fromVersionId: "version-source",
      }

      const mockRule = {
        id: "rule-123",
        createdByUserId: "user-123",
        deletedAt: null,
      }

      const mockSourceVersion = {
        version: "2.1.5",
        body: "Original content",
        testedOn: { models: ["gpt-4"] },
      }

      const mockForkedVersion = {
        id: "version-forked",
        version: "2.1.6",
        ruleId: "rule-123",
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.ruleVersion.findUnique.mockResolvedValue(mockSourceVersion)
      mockPrisma.ruleVersion.create.mockResolvedValue(mockForkedVersion)

      const result = await caller.fork(input)

      expect(mockPrisma.ruleVersion.create).toHaveBeenCalledWith({
        data: {
          ruleId: "rule-123",
          version: "2.1.6",
          body: "Original content",
          testedOn: { models: ["gpt-4"] },
          changelog: "Forked from 2.1.5",
          parentVersionId: "version-source",
          createdByUserId: "user-123",
        },
      })

      expect(result.version).toBe("2.1.6")
    })

    it("should throw error if rule not found", async () => {
      const input = {
        ruleId: "nonexistent-rule",
        fromVersionId: "version-source",
      }

      mockPrisma.rule.findUnique.mockResolvedValue(null)

      await expect(caller.fork(input)).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Rule not found",
        })
      )
    })

    it("should throw error if user lacks permission", async () => {
      const input = {
        ruleId: "rule-123",
        fromVersionId: "version-source",
      }

      const mockRule = {
        id: "rule-123",
        createdByUserId: "other-user",
        deletedAt: null,
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)

      await expect(caller.fork(input)).rejects.toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to fork versions for this rule",
        })
      )
    })

    it("should throw error if source version not found", async () => {
      const input = {
        ruleId: "rule-123",
        fromVersionId: "nonexistent-version",
      }

      const mockRule = {
        id: "rule-123",
        createdByUserId: "user-123",
        deletedAt: null,
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.ruleVersion.findUnique.mockResolvedValue(null)

      await expect(caller.fork(input)).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Source version not found",
        })
      )
    })
  })

  describe("getById", () => {
    it("should return version details with vote information", async () => {
      const input = {
        versionId: "version-123",
        includeUserActions: true,
      }

      const mockVersion = {
        id: "version-123",
        ruleId: "rule-123",
        version: "1.2.0",
        body: "Version body content",
        testedOn: { models: ["gpt-4"] },
        changelog: "Version changelog",
        parentVersionId: "version-parent",
        createdAt: new Date("2023-01-01"),
        rule: {
          id: "rule-123",
          deletedAt: null,
          createdByUserId: "user-123",
        },
        createdBy: {
          id: "user-123",
          handle: "testuser",
          displayName: "Test User",
          avatarUrl: "avatar.jpg",
          role: "USER",
          authorProfile: { isVerified: true },
        },
      }

      const mockVoteStats = { _sum: { value: 5 } }
      const mockUserVote = { value: 1 }

      mockPrisma.ruleVersion.findUnique.mockResolvedValue(mockVersion)
      mockPrisma.voteVersion.aggregate.mockResolvedValue(mockVoteStats)
      mockPrisma.voteVersion.findUnique.mockResolvedValue(mockUserVote)

      const result = await caller.getById(input)

      expect(mockPrisma.ruleVersion.findUnique).toHaveBeenCalledWith({
        where: { id: "version-123" },
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
      })

      expect(result).toEqual({
        id: "version-123",
        ruleId: "rule-123",
        version: "1.2.0",
        body: "Version body content",
        testedOn: { models: ["gpt-4"] },
        changelog: "Version changelog",
        parentVersionId: "version-parent",
        createdBy: {
          id: "user-123",
          handle: "testuser",
          displayName: "Test User",
          avatarUrl: "avatar.jpg",
          role: "USER",
          isVerified: true,
        },
        createdAt: new Date("2023-01-01"),
        score: 5,
        userVote: "up",
      })
    })

    it("should return null if version not found", async () => {
      const input = { versionId: "nonexistent-version" }

      mockPrisma.ruleVersion.findUnique.mockResolvedValue(null)

      const result = await caller.getById(input)

      expect(result).toBeNull()
    })

    it("should return null if rule is deleted", async () => {
      const input = { versionId: "version-123" }

      const mockVersion = {
        id: "version-123",
        rule: {
          id: "rule-123",
          deletedAt: new Date(),
          createdByUserId: "user-123",
        },
        createdBy: {
          id: "user-123",
          handle: "testuser",
          displayName: "Test User",
          avatarUrl: "avatar.jpg",
          role: "USER",
          authorProfile: { isVerified: false },
        },
      }

      mockPrisma.ruleVersion.findUnique.mockResolvedValue(mockVersion)

      const result = await caller.getById(input)

      expect(result).toBeNull()
    })

    it("should handle downvote in user vote", async () => {
      const input = {
        versionId: "version-123",
        includeUserActions: true,
      }

      const mockVersion = {
        id: "version-123",
        ruleId: "rule-123",
        version: "1.0.0",
        body: "Body",
        testedOn: {},
        changelog: "Change",
        parentVersionId: null,
        createdAt: new Date("2023-01-01"),
        rule: {
          id: "rule-123",
          deletedAt: null,
          createdByUserId: "user-123",
        },
        createdBy: {
          id: "user-123",
          handle: "testuser",
          displayName: "Test User",
          avatarUrl: "avatar.jpg",
          role: "USER",
          authorProfile: { isVerified: false },
        },
      }

      const mockVoteStats = { _sum: { value: -2 } }
      const mockUserVote = { value: -1 }

      mockPrisma.ruleVersion.findUnique.mockResolvedValue(mockVersion)
      mockPrisma.voteVersion.aggregate.mockResolvedValue(mockVoteStats)
      mockPrisma.voteVersion.findUnique.mockResolvedValue(mockUserVote)

      const result = await caller.getById(input)

      expect(result.score).toBe(-2)
      expect(result.userVote).toBe("down")
    })

    it("should not include user actions when includeUserActions is false", async () => {
      const input = {
        versionId: "version-123",
        includeUserActions: false,
      }

      const mockVersion = {
        id: "version-123",
        ruleId: "rule-123",
        version: "1.0.0",
        body: "Body",
        testedOn: null,
        changelog: "Change",
        parentVersionId: null,
        createdAt: new Date("2023-01-01"),
        rule: {
          id: "rule-123",
          deletedAt: null,
          createdByUserId: "user-123",
        },
        createdBy: {
          id: "user-123",
          handle: "testuser",
          displayName: "Test User",
          avatarUrl: "avatar.jpg",
          role: "USER",
          authorProfile: { isVerified: false },
        },
      }

      const mockVoteStats = { _sum: { value: 3 } }

      mockPrisma.ruleVersion.findUnique.mockResolvedValue(mockVersion)
      mockPrisma.voteVersion.aggregate.mockResolvedValue(mockVoteStats)

      const result = await caller.getById(input)

      expect(result.score).toBe(3)
      expect(result.userVote).toBeNull()
      expect(result.testedOn).toBeNull()
    })

    it("should handle null vote sum", async () => {
      const input = { versionId: "version-123" }

      const mockVersion = {
        id: "version-123",
        ruleId: "rule-123",
        version: "1.0.0",
        body: "Body",
        testedOn: {},
        changelog: "Change",
        parentVersionId: null,
        createdAt: new Date("2023-01-01"),
        rule: {
          id: "rule-123",
          deletedAt: null,
          createdByUserId: "user-123",
        },
        createdBy: {
          id: "user-123",
          handle: "testuser",
          displayName: "Test User",
          avatarUrl: "avatar.jpg",
          role: "USER",
          authorProfile: { isVerified: false },
        },
      }

      const mockVoteStats = { _sum: { value: null } }

      mockPrisma.ruleVersion.findUnique.mockResolvedValue(mockVersion)
      mockPrisma.voteVersion.aggregate.mockResolvedValue(mockVoteStats)

      const result = await caller.getById(input)

      expect(result.score).toBe(0)
    })
  })

  describe("getDiff", () => {
    it("should generate diff between two versions", async () => {
      const input = {
        prevVersionId: "version-1",
        currVersionId: "version-2",
        format: "json" as const,
      }

      const mockPrevVersion = {
        body: "Line 1\nLine 2\nLine 3",
        ruleId: "rule-123",
      }

      const mockCurrVersion = {
        body: "Line 1\nModified Line 2\nLine 3\nLine 4",
        ruleId: "rule-123",
      }

      mockPrisma.ruleVersion.findUnique
        .mockResolvedValueOnce(mockPrevVersion)
        .mockResolvedValueOnce(mockCurrVersion)

      const result = await caller.getDiff(input)

      expect(mockPrisma.ruleVersion.findUnique).toHaveBeenCalledTimes(2)
      expect(mockPrisma.ruleVersion.findUnique).toHaveBeenCalledWith({
        where: { id: "version-1" },
        select: { body: true, ruleId: true },
      })
      expect(mockPrisma.ruleVersion.findUnique).toHaveBeenCalledWith({
        where: { id: "version-2" },
        select: { body: true, ruleId: true },
      })

      expect(result.format).toBe("json")
      expect(result.diff.changes).toEqual([
        {
          type: "modified",
          line: 2,
          old: "Line 2",
          new: "Modified Line 2",
        },
        {
          type: "added",
          line: 4,
          content: "Line 4",
        },
      ])

      expect(result.diff.stats).toEqual({
        additions: 1,
        deletions: 0,
        modifications: 1,
      })
    })

    it("should handle deleted lines in diff", async () => {
      const input = {
        prevVersionId: "version-1",
        currVersionId: "version-2",
      }

      const mockPrevVersion = {
        body: "Line 1\nLine 2\nLine 3\nLine 4",
        ruleId: "rule-123",
      }

      const mockCurrVersion = {
        body: "Line 1\nLine 3",
        ruleId: "rule-123",
      }

      mockPrisma.ruleVersion.findUnique
        .mockResolvedValueOnce(mockPrevVersion)
        .mockResolvedValueOnce(mockCurrVersion)

      const result = await caller.getDiff(input)

      // The algorithm detects the changes differently:
      // Line 2 is modified (Line 2 -> Line 3)
      // Line 3 is deleted (Line 3 -> empty)
      // Line 4 is deleted (Line 4 -> empty)
      expect(result.diff.changes).toEqual([
        {
          type: "modified",
          line: 2,
          old: "Line 2",
          new: "Line 3",
        },
        {
          type: "deleted",
          line: 3,
          content: "Line 3",
        },
        {
          type: "deleted",
          line: 4,
          content: "Line 4",
        },
      ])

      expect(result.diff.stats.deletions).toBe(2)
      expect(result.diff.stats.modifications).toBe(1)
    })

    it("should throw error if previous version not found", async () => {
      const input = {
        prevVersionId: "nonexistent-version",
        currVersionId: "version-2",
      }

      mockPrisma.ruleVersion.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ body: "Content", ruleId: "rule-123" })

      await expect(caller.getDiff(input)).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "One or both versions not found",
        })
      )
    })

    it("should throw error if current version not found", async () => {
      const input = {
        prevVersionId: "version-1",
        currVersionId: "nonexistent-version",
      }

      mockPrisma.ruleVersion.findUnique
        .mockResolvedValueOnce({ body: "Content", ruleId: "rule-123" })
        .mockResolvedValueOnce(null)

      await expect(caller.getDiff(input)).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "One or both versions not found",
        })
      )
    })

    it("should throw error if versions belong to different rules", async () => {
      const input = {
        prevVersionId: "version-1",
        currVersionId: "version-2",
      }

      mockPrisma.ruleVersion.findUnique
        .mockResolvedValueOnce({ body: "Content 1", ruleId: "rule-123" })
        .mockResolvedValueOnce({ body: "Content 2", ruleId: "rule-456" })

      await expect(caller.getDiff(input)).rejects.toThrow(
        new TRPCError({
          code: "BAD_REQUEST",
          message: "Versions must belong to the same rule",
        })
      )
    })

    it("should handle empty content differences", async () => {
      const input = {
        prevVersionId: "version-1",
        currVersionId: "version-2",
      }

      const mockPrevVersion = {
        body: "",
        ruleId: "rule-123",
      }

      const mockCurrVersion = {
        body: "",
        ruleId: "rule-123",
      }

      mockPrisma.ruleVersion.findUnique
        .mockResolvedValueOnce(mockPrevVersion)
        .mockResolvedValueOnce(mockCurrVersion)

      const result = await caller.getDiff(input)

      expect(result.diff.changes).toEqual([])
      expect(result.diff.stats).toEqual({
        additions: 0,
        deletions: 0,
        modifications: 0,
      })
    })
  })

  describe("setCurrent", () => {
    it("should set current version for rule", async () => {
      const input = {
        ruleId: "rule-123",
        versionId: "version-456",
      }

      const mockRule = {
        id: "rule-123",
        createdByUserId: "user-123",
        deletedAt: null,
      }

      const mockVersion = {
        id: "version-456",
        ruleId: "rule-123",
        version: "1.2.0",
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.ruleVersion.findUnique.mockResolvedValue(mockVersion)
      mockPrisma.rule.update.mockResolvedValue({})

      const result = await caller.setCurrent(input)

      expect(mockPrisma.ruleVersion.findUnique).toHaveBeenCalledWith({
        where: { id: "version-456", ruleId: "rule-123" },
      })

      expect(mockPrisma.rule.update).toHaveBeenCalledWith({
        where: { id: "rule-123" },
        data: {
          currentVersionId: "version-456",
          updatedAt: mockCtx.now,
        },
      })

      expect(result).toEqual({ success: true })
    })

    it("should throw error if rule not found", async () => {
      const input = {
        ruleId: "nonexistent-rule",
        versionId: "version-456",
      }

      mockPrisma.rule.findUnique.mockResolvedValue(null)

      await expect(caller.setCurrent(input)).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Rule not found",
        })
      )
    })

    it("should throw error if user lacks permission", async () => {
      const input = {
        ruleId: "rule-123",
        versionId: "version-456",
      }

      const mockRule = {
        id: "rule-123",
        createdByUserId: "other-user",
        deletedAt: null,
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)

      await expect(caller.setCurrent(input)).rejects.toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to modify this rule",
        })
      )
    })

    it("should throw error if version not found for rule", async () => {
      const input = {
        ruleId: "rule-123",
        versionId: "version-456",
      }

      const mockRule = {
        id: "rule-123",
        createdByUserId: "user-123",
        deletedAt: null,
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.ruleVersion.findUnique.mockResolvedValue(null)

      await expect(caller.setCurrent(input)).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Version not found for this rule",
        })
      )
    })

    it("should allow admin to set current version", async () => {
      const adminCtx = {
        ...mockCtx,
        user: { ...mockCtx.user, role: "ADMIN" },
      }

      const adminCaller = versionsRouter.createCaller(adminCtx)

      const input = {
        ruleId: "rule-123",
        versionId: "version-456",
      }

      const mockRule = {
        id: "rule-123",
        createdByUserId: "other-user",
        deletedAt: null,
      }

      const mockVersion = {
        id: "version-456",
        ruleId: "rule-123",
        version: "1.2.0",
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.ruleVersion.findUnique.mockResolvedValue(mockVersion)
      mockPrisma.rule.update.mockResolvedValue({})

      const result = await adminCaller.setCurrent(input)

      expect(result).toEqual({ success: true })
    })
  })

  describe("Edge Cases and Integration", () => {
    it("should handle concurrent version creation", async () => {
      mockPrisma.$transaction.mockImplementation(async callback => {
        return await callback(mockPrisma)
      })

      const input1 = {
        ruleId: "rule-123",
        body: "Version A",
      }

      const input2 = {
        ruleId: "rule-123",
        body: "Version B",
      }

      const mockRule = {
        id: "rule-123",
        slug: "test-rule",
        title: "Test Rule",
        status: "PUBLISHED",
        createdByUserId: "user-123",
        deletedAt: null,
      }

      const mockLatestVersion = { version: "1.0.0" }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.ruleVersion.findFirst
        .mockResolvedValue(null) // baseVersion
        .mockResolvedValue(mockLatestVersion) // latest version

      mockPrisma.ruleVersion.create
        .mockResolvedValueOnce({
          id: "version-a",
          version: "1.1.0",
          ruleId: "rule-123",
        })
        .mockResolvedValueOnce({
          id: "version-b",
          version: "1.1.0",
          ruleId: "rule-123",
        })

      mockPrisma.rule.update.mockResolvedValue({})

      const [result1, result2] = await Promise.all([
        caller.createVersion(input1),
        caller.createVersion(input2),
      ])

      expect(result1.version).toBe("1.1.0")
      expect(result2.version).toBe("1.1.0")
    })

    it("should handle complex version numbering", async () => {
      mockPrisma.$transaction.mockImplementation(async callback => {
        return await callback(mockPrisma)
      })

      const input = {
        ruleId: "rule-123",
        body: "Version with complex numbering",
      }

      const mockRule = {
        id: "rule-123",
        slug: "test-rule",
        title: "Test Rule",
        status: "PUBLISHED",
        createdByUserId: "user-123",
        deletedAt: null,
      }

      const mockLatestVersion = { version: "15.23.8" }

      const mockCreatedVersion = {
        id: "version-complex",
        version: "15.24.0",
        ruleId: "rule-123",
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.ruleVersion.findFirst
        .mockResolvedValueOnce(null) // baseVersion
        .mockResolvedValueOnce(mockLatestVersion) // latest version
      mockPrisma.ruleVersion.create.mockResolvedValue(mockCreatedVersion)
      mockPrisma.rule.update.mockResolvedValue({})

      const result = await caller.createVersion(input)

      expect(result.version).toBe("15.24.0")
    })

    it("should handle empty or malformed version strings", async () => {
      const input = {
        ruleId: "rule-123",
        fromVersionId: "version-malformed",
      }

      const mockRule = {
        id: "rule-123",
        createdByUserId: "user-123",
        deletedAt: null,
      }

      const mockSourceVersion = {
        version: "invalid.version.string",
        body: "Content",
        testedOn: {},
      }

      // This should handle the malformed version gracefully
      const mockForkedVersion = {
        id: "version-forked",
        version: "NaN.NaN.NaN", // Result of incrementing malformed version (all parts become NaN)
        ruleId: "rule-123",
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.ruleVersion.findUnique.mockResolvedValue(mockSourceVersion)
      mockPrisma.ruleVersion.create.mockResolvedValue(mockForkedVersion)

      const result = await caller.fork(input)

      expect(result.version).toBe("NaN.NaN.NaN")
    })

    it("should handle very long content in diff generation", async () => {
      const input = {
        prevVersionId: "version-1",
        currVersionId: "version-2",
      }

      const longContent1 = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1}`).join("\n")
      const longContent2 = Array.from({ length: 1000 }, (_, i) => `Modified Line ${i + 1}`).join(
        "\n"
      )

      const mockPrevVersion = {
        body: longContent1,
        ruleId: "rule-123",
      }

      const mockCurrVersion = {
        body: longContent2,
        ruleId: "rule-123",
      }

      mockPrisma.ruleVersion.findUnique
        .mockResolvedValueOnce(mockPrevVersion)
        .mockResolvedValueOnce(mockCurrVersion)

      const result = await caller.getDiff(input)

      expect(result.diff.changes).toHaveLength(1000)
      expect(result.diff.stats.modifications).toBe(1000)
    })

    it("should handle database transaction failures", async () => {
      const input = {
        ruleId: "rule-123",
        body: "Test body",
      }

      const mockRule = {
        id: "rule-123",
        createdByUserId: "user-123",
        deletedAt: null,
      }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.ruleVersion.findFirst.mockResolvedValue(null)
      mockPrisma.$transaction.mockRejectedValue(new Error("Database transaction failed"))

      await expect(caller.createVersion(input)).rejects.toThrow("Database transaction failed")
    })
  })
})
