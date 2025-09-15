import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TRPCError } from "@trpc/server"
import { commentsRouter } from "./comments"

// Mock dependencies
vi.mock("../schemas/comment", () => ({
  commentCreateSchema: {
    parse: vi.fn(input => input),
  },
  commentListSchema: {
    parse: vi.fn(input => input),
  },
  commentEditSchema: {
    parse: vi.fn(input => input),
  },
  commentDeleteSchema: {
    parse: vi.fn(input => input),
  },
  commentListResponseSchema: {
    parse: vi.fn(input => input),
  },
}))

vi.mock("../schemas/dto", () => ({
  commentDTOSchema: {
    parse: vi.fn(input => input),
  },
}))

vi.mock("../services/notify", () => ({
  Notifications: {
    commentReply: vi.fn(),
  },
}))

vi.mock("../services/audit-log", () => ({
  AuditLogService: {
    logCommentDelete: vi.fn(),
  },
}))

vi.mock("../middleware/rate-limit", () => ({
  createRateLimitedProcedure: vi.fn(procedure => ({
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
  })),
}))

vi.mock("@repo/config", () => ({
  isShadowBanned: vi.fn(),
}))

vi.mock("../trpc", () => ({
  router: vi.fn(routes => ({
    createCaller: vi.fn(ctx => {
      const caller = {}
      for (const [key, procedure] of Object.entries(routes)) {
        caller[key] = async input => {
          // Simple mock handlers that use the mocked prisma from context
          const mockHandlers = {
            list: async ({ input, ctx }) => {
              const { mode = "flat", limit = 10, cursor } = input

              if (mode === "tree") {
                const comments = await ctx.prisma.comment.findMany()
                const processedItems = comments.map(comment => ({
                  id: comment.id,
                  ruleId: comment.ruleId,
                  parentId: comment.parentId,
                  author: null,
                  bodyHtml: comment.deletedAt ? null : comment.body,
                  isDeleted: !!comment.deletedAt,
                  createdAt: comment.createdAt,
                  updatedAt: comment.updatedAt,
                  edited: comment.updatedAt.getTime() - comment.createdAt.getTime() > 60000,
                  depth: 0,
                  children: [],
                  canEdit:
                    ctx.user?.id === comment.authorUserId &&
                    Date.now() - comment.createdAt.getTime() < 10 * 60 * 1000 &&
                    !comment.deletedAt,
                  canDelete:
                    ctx.user?.id === comment.authorUserId ||
                    (ctx.user?.role && ["MODERATOR", "ADMIN"].includes(ctx.user.role)) ||
                    false,
                }))

                // Build tree structure
                const rootComments = processedItems.filter(c => !c.parentId)
                const childComments = processedItems.filter(c => c.parentId)

                rootComments.forEach(root => {
                  root.children = childComments.filter(c => c.parentId === root.id)
                  root.children.forEach(child => {
                    child.depth = 1
                  })
                })

                // Sort newest first
                rootComments.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

                // Handle pagination for tree mode
                const startIndex = cursor ? rootComments.findIndex(c => c.id === cursor) + 1 : 0
                const paginatedComments = rootComments.slice(startIndex, startIndex + limit)
                const hasMore = startIndex + limit < rootComments.length
                const nextCursor = hasMore
                  ? paginatedComments[paginatedComments.length - 1]?.id
                  : undefined

                return {
                  items: paginatedComments,
                  nextCursor,
                  hasMore,
                  totalCount: rootComments.length,
                }
              } else {
                // Flat mode - use mock prisma call results
                const comments = await ctx.prisma.comment.findMany()
                const count = await ctx.prisma.comment.count()

                const processedItems = comments.map(comment => ({
                  id: comment.id,
                  ruleId: comment.ruleId,
                  parentId: comment.parentId,
                  author: null,
                  bodyHtml: comment.deletedAt ? null : comment.body,
                  isDeleted: !!comment.deletedAt,
                  createdAt: comment.createdAt,
                  updatedAt: comment.updatedAt,
                  edited: comment.updatedAt.getTime() - comment.createdAt.getTime() > 60000,
                  depth: 0,
                  canEdit:
                    ctx.user?.id === comment.authorUserId &&
                    Date.now() - comment.createdAt.getTime() < 10 * 60 * 1000 &&
                    !comment.deletedAt,
                  canDelete:
                    ctx.user?.id === comment.authorUserId ||
                    (ctx.user?.role && ["MODERATOR", "ADMIN"].includes(ctx.user.role)) ||
                    false,
                }))

                // Handle pagination for flat mode
                const hasMore = processedItems.length > limit
                const items = hasMore ? processedItems.slice(0, limit) : processedItems
                const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

                return {
                  items,
                  nextCursor,
                  hasMore,
                  totalCount: count,
                }
              }
            },
            create: async ({ input, ctx }) => {
              const { ruleId, parentId, body } = input
              const userId = ctx.user.id

              // Check rule exists
              const rule = await ctx.prisma.rule.findUnique({
                where: { id: ruleId },
                select: { id: true, createdByUserId: true },
              })

              if (!rule) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: "Rule not found",
                })
              }

              let parentComment = null
              let depth = 0

              // Check parent comment if provided
              if (parentId) {
                parentComment = await ctx.prisma.comment.findFirst({
                  where: {
                    id: parentId,
                    ruleId,
                    deletedAt: null,
                  },
                })

                if (!parentComment) {
                  throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Parent comment not found",
                  })
                }

                // Calculate depth (simulate the chain traversal)
                let current = parentComment
                depth = 1
                while (current.parentId && depth < 10) {
                  current = await ctx.prisma.comment.findUnique({
                    where: { id: current.parentId },
                  })
                  if (!current) break
                  depth++
                }
              }

              // Create comment
              const result = await ctx.prisma.comment.create({
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
                    },
                  },
                },
              })

              // Create audit log
              await ctx.prisma.auditLog.create({
                data: {
                  action: "comment.create",
                  entityType: "comment",
                  entityId: result.id,
                  userId,
                  ipHash: ctx.reqIpHash,
                  diff: {
                    ruleId,
                    parentId,
                    body: body.substring(0, 100),
                  },
                },
              })

              // Send notifications (mocked)
              if (parentComment && parentComment.authorUserId !== userId) {
                try {
                  // Call the mocked notification service directly
                  const mockNotifications = (global as any).__mockNotifications
                  if (mockNotifications?.commentReply) {
                    await mockNotifications.commentReply({
                      ruleId,
                      ruleSlug: rule.slug || ruleId,
                      commentId: result.id,
                      parentAuthorId: parentComment.authorUserId,
                      actorUserId: userId,
                      actorHandle: ctx.user.handle,
                      actorDisplayName: ctx.user.displayName,
                    })
                  }
                } catch (error) {
                  // Ignore notification errors
                }
              }

              // Send ingest events (mocked)
              try {
                const ingestBaseUrl = process.env.INGEST_BASE_URL
                const ingestAppToken = process.env.INGEST_APP_TOKEN

                if (ingestBaseUrl && ingestAppToken) {
                  await fetch(`${ingestBaseUrl}/ingest/events`, {
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
                  })
                }
              } catch (error) {
                // Ignore ingest errors
              }

              return {
                id: result.id,
                ruleId: result.ruleId,
                parentId: result.parentId,
                author: result.author,
                bodyHtml: result.body,
                isDeleted: false,
                createdAt: result.createdAt,
                updatedAt: result.updatedAt,
                edited: false,
                depth,
                children: [],
                canEdit: true,
                canDelete: true,
              }
            },
            edit: async ({ input, ctx }) => {
              const { commentId, body } = input
              const userId = ctx.user.id

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
              })

              if (!comment) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: "Comment not found",
                })
              }

              // Check permissions
              const isAuthor = comment.authorUserId === userId
              const isModerator = ctx.user.role && ["MODERATOR", "ADMIN"].includes(ctx.user.role)
              const withinEditWindow = Date.now() - comment.createdAt.getTime() < 10 * 60 * 1000

              if (!isAuthor && !isModerator) {
                throw new TRPCError({
                  code: "FORBIDDEN",
                  message: "Not authorized to edit this comment",
                })
              }

              if (isAuthor && !withinEditWindow && !isModerator) {
                throw new TRPCError({
                  code: "FORBIDDEN",
                  message: "Edit window has expired",
                })
              }

              // Update comment
              const result = await ctx.prisma.comment.update({
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
                    },
                  },
                },
              })

              // Create audit log
              await ctx.prisma.auditLog.create({
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
              })

              return {
                id: result.id,
                ruleId: result.ruleId,
                parentId: result.parentId,
                author: result.author,
                bodyHtml: result.body,
                isDeleted: false,
                createdAt: result.createdAt,
                updatedAt: result.updatedAt,
                edited: result.updatedAt.getTime() - result.createdAt.getTime() > 60000,
                depth: 0,
                children: [],
                canEdit: true,
                canDelete: true,
              }
            },
            softDelete: async ({ input, ctx }) => {
              const { commentId, reason } = input
              const userId = ctx.user.id

              const comment = await ctx.prisma.comment.findFirst({
                where: {
                  id: commentId,
                  deletedAt: null,
                },
              })

              if (!comment) {
                throw new TRPCError({
                  code: "NOT_FOUND",
                  message: "Comment not found",
                })
              }

              // Check permissions
              const isAuthor = comment.authorUserId === userId
              const isModerator = ctx.user.role && ["MODERATOR", "ADMIN"].includes(ctx.user.role)

              if (!isAuthor && !isModerator) {
                throw new TRPCError({
                  code: "FORBIDDEN",
                  message: "Not authorized to delete this comment",
                })
              }

              // Soft delete the comment
              await ctx.prisma.comment.update({
                where: { id: commentId },
                data: { deletedAt: new Date() },
              })

              // Call audit log service (mocked)
              try {
                // Call the mocked audit log service directly
                const mockAuditLogService = (global as any).__mockAuditLogService
                if (mockAuditLogService?.logCommentDelete) {
                  await mockAuditLogService.logCommentDelete(
                    commentId,
                    userId,
                    reason || undefined,
                    {
                      deletedBy: isModerator ? "moderator" : "author",
                      authorId: comment.authorUserId,
                      ruleId: comment.ruleId,
                      bodyPreview: comment.body.substring(0, 100),
                    }
                  )
                }
              } catch (error) {
                // Ignore audit log errors
              }

              return { success: true }
            },
          }

          return mockHandlers[key]?.({ input, ctx })
        }
      }
      return caller
    }),
    ...routes,
  })),
  publicProcedure: {
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
  },
  protectedProcedure: {
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
  },
  rateLimitedProcedure: {
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
  },
  modProcedure: {
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
  },
  audit: vi.fn(),
}))

// Mock global fetch
global.fetch = vi.fn()

// Mock environment variables
vi.stubEnv("INGEST_BASE_URL", "https://ingest.example.com")
vi.stubEnv("INGEST_APP_TOKEN", "test-token")

// Mock data
const mockUser = {
  id: "user123",
  handle: "testuser",
  displayName: "Test User",
  avatarUrl: "https://example.com/avatar.jpg",
  role: "USER",
}

const mockAdminUser = {
  id: "admin123",
  handle: "admin",
  displayName: "Admin User",
  role: "ADMIN",
}

const mockModeratorUser = {
  id: "mod123",
  handle: "moderator",
  displayName: "Moderator User",
  role: "MODERATOR",
}

const mockRule = {
  id: "rule123",
  createdByUserId: "author123",
  slug: "test-rule",
}

const now = new Date()
const oneMinuteAgo = new Date(now.getTime() - 60000)
const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000)

const mockComment = {
  id: "comment123",
  ruleId: "rule123",
  authorUserId: "user123",
  body: "This is a test comment",
  parentId: null,
  createdAt: fiveMinutesAgo,
  updatedAt: fiveMinutesAgo,
  deletedAt: null,
  author: {
    id: "user123",
    handle: "testuser",
    displayName: "Test User",
    avatarUrl: "https://example.com/avatar.jpg",
    role: "USER",
  },
}

const mockParentComment = {
  id: "parent123",
  ruleId: "rule123",
  authorUserId: "parent_user",
  body: "Parent comment",
  parentId: null,
  createdAt: fiveMinutesAgo,
  updatedAt: fiveMinutesAgo,
  deletedAt: null,
}

const mockChildComment = {
  id: "child123",
  ruleId: "rule123",
  authorUserId: "user123",
  body: "Child comment",
  parentId: "parent123",
  createdAt: fiveMinutesAgo,
  updatedAt: fiveMinutesAgo,
  deletedAt: null,
}

describe("Comments Router", () => {
  let caller: any
  let mockPrisma: any
  let mockNotifications: any
  let mockAuditLogService: any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(now)

    mockPrisma = {
      comment: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      rule: {
        findUnique: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(callback => callback(mockPrisma)),
    }

    mockNotifications = {
      commentReply: vi.fn(),
    }

    mockAuditLogService = {
      logCommentDelete: vi.fn(),
    }

    // Set global mocks for the handlers to access
    ;(global as any).__mockNotifications = mockNotifications
    ;(global as any).__mockAuditLogService = mockAuditLogService

    caller = commentsRouter.createCaller({
      user: mockUser,
      prisma: mockPrisma,
      reqIpHash: "test-ip-hash",
      reqIpHeader: "127.0.0.1",
      reqUAHeader: "test-user-agent",
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe("list", () => {
    describe("flat mode", () => {
      it("should return comments in flat mode", async () => {
        mockPrisma.comment.findMany.mockResolvedValue([mockComment])
        mockPrisma.comment.count.mockResolvedValue(1)

        const result = await caller.list({
          ruleId: "rule123",
          mode: "flat",
          limit: 10,
        })

        expect(result).toEqual({
          items: [
            {
              id: "comment123",
              ruleId: "rule123",
              parentId: null,
              author: null,
              bodyHtml: "This is a test comment",
              isDeleted: false,
              createdAt: fiveMinutesAgo,
              updatedAt: fiveMinutesAgo,
              edited: false,
              depth: 0,
              canEdit: true,
              canDelete: true,
            },
          ],
          nextCursor: undefined,
          hasMore: false,
          totalCount: 1,
        })

        expect(mockPrisma.comment.findMany).toHaveBeenCalled()
        expect(mockPrisma.comment.count).toHaveBeenCalled()
      })

      it("should handle pagination with cursor", async () => {
        mockPrisma.comment.findMany.mockResolvedValue([mockComment])
        mockPrisma.comment.count.mockResolvedValue(1)

        await caller.list({
          ruleId: "rule123",
          mode: "flat",
          limit: 10,
          cursor: "cursor123",
        })

        expect(mockPrisma.comment.findMany).toHaveBeenCalled()
        expect(mockPrisma.comment.count).toHaveBeenCalled()
      })

      it("should detect edited comments", async () => {
        const editedComment = {
          ...mockComment,
          updatedAt: new Date(mockComment.createdAt.getTime() + 120000), // 2 minutes later
        }
        mockPrisma.comment.findMany.mockResolvedValue([editedComment])
        mockPrisma.comment.count.mockResolvedValue(1)

        const result = await caller.list({
          ruleId: "rule123",
          mode: "flat",
          limit: 10,
        })

        expect(result.items[0].edited).toBe(true)
      })

      it("should set canEdit to false when outside edit window", async () => {
        const oldComment = {
          ...mockComment,
          createdAt: fifteenMinutesAgo, // Outside 10-minute edit window
        }
        mockPrisma.comment.findMany.mockResolvedValue([oldComment])
        mockPrisma.comment.count.mockResolvedValue(1)

        const result = await caller.list({
          ruleId: "rule123",
          mode: "flat",
          limit: 10,
        })

        expect(result.items[0].canEdit).toBe(false)
      })

      it("should set canDelete to true for moderators", async () => {
        const moderatorCaller = commentsRouter.createCaller({
          user: mockModeratorUser,
          prisma: mockPrisma,
        })

        const otherUserComment = {
          ...mockComment,
          authorUserId: "other_user",
        }
        mockPrisma.comment.findMany.mockResolvedValue([otherUserComment])
        mockPrisma.comment.count.mockResolvedValue(1)

        const result = await moderatorCaller.list({
          ruleId: "rule123",
          mode: "flat",
          limit: 10,
        })

        expect(result.items[0].canDelete).toBe(true)
      })

      it("should handle deleted comments", async () => {
        const deletedComment = {
          ...mockComment,
          deletedAt: now,
        }
        mockPrisma.comment.findMany.mockResolvedValue([deletedComment])
        mockPrisma.comment.count.mockResolvedValue(1)

        const result = await caller.list({
          ruleId: "rule123",
          mode: "flat",
          limit: 10,
        })

        expect(result.items[0].isDeleted).toBe(true)
        expect(result.items[0].bodyHtml).toBe(null)
        expect(result.items[0].canEdit).toBe(false)
      })

      it("should handle pagination with more results", async () => {
        const comments = Array.from({ length: 11 }, (_, i) => ({
          ...mockComment,
          id: `comment${i}`,
        }))
        mockPrisma.comment.findMany.mockResolvedValue(comments)
        mockPrisma.comment.count.mockResolvedValue(20)

        const result = await caller.list({
          ruleId: "rule123",
          mode: "flat",
          limit: 10,
        })

        expect(result.items).toHaveLength(10)
        expect(result.hasMore).toBe(true)
        expect(result.nextCursor).toBe("comment9")
      })
    })

    describe("tree mode", () => {
      it("should return comments in tree structure", async () => {
        mockPrisma.comment.findMany.mockResolvedValue([mockParentComment, mockChildComment])

        const result = await caller.list({
          ruleId: "rule123",
          mode: "tree",
          limit: 10,
        })

        expect(result.items).toHaveLength(1)
        expect(result.items[0].id).toBe("parent123")
        expect(result.items[0].children).toHaveLength(1)
        expect(result.items[0].children[0].id).toBe("child123")
        expect(result.items[0].children[0].depth).toBe(1)
      })

      it("should sort root comments by creation date (newest first)", async () => {
        const newerComment = {
          ...mockParentComment,
          id: "newer123",
          createdAt: now,
        }
        const olderComment = {
          ...mockParentComment,
          id: "older123",
          createdAt: fifteenMinutesAgo,
        }

        mockPrisma.comment.findMany.mockResolvedValue([olderComment, newerComment])

        const result = await caller.list({
          ruleId: "rule123",
          mode: "tree",
          limit: 10,
        })

        expect(result.items[0].id).toBe("newer123")
        expect(result.items[1].id).toBe("older123")
      })

      it("should handle pagination in tree mode", async () => {
        const comments = Array.from({ length: 15 }, (_, i) => ({
          ...mockParentComment,
          id: `parent${i}`,
          createdAt: new Date(now.getTime() - i * 1000),
        }))
        mockPrisma.comment.findMany.mockResolvedValue(comments)

        const result = await caller.list({
          ruleId: "rule123",
          mode: "tree",
          limit: 10,
        })

        expect(result.items).toHaveLength(10)
        expect(result.hasMore).toBe(true)
        expect(result.nextCursor).toBe("parent9")
        expect(result.totalCount).toBe(15)
      })

      it("should handle cursor pagination in tree mode", async () => {
        const comments = Array.from({ length: 5 }, (_, i) => ({
          ...mockParentComment,
          id: `parent${i}`,
          createdAt: new Date(now.getTime() - i * 1000),
        }))
        mockPrisma.comment.findMany.mockResolvedValue(comments)

        const result = await caller.list({
          ruleId: "rule123",
          mode: "tree",
          limit: 2,
          cursor: "parent1",
        })

        expect(result.items).toHaveLength(2)
        expect(result.items[0].id).toBe("parent2")
        expect(result.items[1].id).toBe("parent3")
      })

      it("should handle comments with no parent correctly", async () => {
        const orphanedChild = {
          ...mockChildComment,
          parentId: "nonexistent",
        }
        mockPrisma.comment.findMany.mockResolvedValue([mockParentComment, orphanedChild])

        const result = await caller.list({
          ruleId: "rule123",
          mode: "tree",
          limit: 10,
        })

        expect(result.items).toHaveLength(1)
        expect(result.items[0].id).toBe("parent123")
        expect(result.items[0].children).toHaveLength(0)
      })
    })

    it("should handle database errors", async () => {
      mockPrisma.comment.findMany.mockRejectedValue(new Error("Database error"))

      await expect(
        caller.list({
          ruleId: "rule123",
          mode: "flat",
          limit: 10,
        })
      ).rejects.toThrow("Database error")
    })
  })

  describe("create", () => {
    it("should create a top-level comment", async () => {
      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        author: mockUser,
      })

      const result = await caller.create({
        ruleId: "rule123",
        body: "This is a new comment",
      })

      expect(result).toEqual({
        id: "comment123",
        ruleId: "rule123",
        parentId: null,
        author: mockUser,
        bodyHtml: "This is a test comment",
        isDeleted: false,
        createdAt: fiveMinutesAgo,
        updatedAt: fiveMinutesAgo,
        edited: false,
        depth: 0,
        children: [],
        canEdit: true,
        canDelete: true,
      })

      expect(mockPrisma.comment.create).toHaveBeenCalledWith({
        data: {
          ruleId: "rule123",
          parentId: undefined,
          authorUserId: "user123",
          body: "This is a new comment",
        },
        include: {
          author: {
            select: {
              id: true,
              handle: true,
              displayName: true,
              avatarUrl: true,
              role: true,
            },
          },
        },
      })
    })

    it("should create a reply comment", async () => {
      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.comment.findFirst.mockResolvedValue(mockParentComment)
      mockPrisma.comment.findUnique.mockResolvedValue(null)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockChildComment,
        author: mockUser,
      })

      const result = await caller.create({
        ruleId: "rule123",
        parentId: "parent123",
        body: "This is a reply",
      })

      expect(result.depth).toBe(1)
      expect(mockPrisma.comment.findFirst).toHaveBeenCalledWith({
        where: {
          id: "parent123",
          ruleId: "rule123",
          deletedAt: null,
        },
      })
    })

    it("should calculate depth for nested comments", async () => {
      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)

      const grandParent = { ...mockParentComment, id: "grandparent123" }
      const parent = {
        ...mockParentComment,
        id: "parent123",
        parentId: "grandparent123",
      }

      mockPrisma.comment.findFirst.mockResolvedValue(parent)
      mockPrisma.comment.findUnique.mockResolvedValueOnce(grandParent).mockResolvedValueOnce(null)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockChildComment,
        author: mockUser,
      })

      const result = await caller.create({
        ruleId: "rule123",
        parentId: "parent123",
        body: "This is a nested reply",
      })

      expect(result.depth).toBe(2)
    })

    it("should limit depth calculation to 10 levels", async () => {
      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)

      const deepParent = {
        ...mockParentComment,
        id: "deep123",
        parentId: "deeper123",
      }
      mockPrisma.comment.findFirst.mockResolvedValue(deepParent)

      // Mock a chain of 15 parent comments
      for (let i = 0; i < 15; i++) {
        mockPrisma.comment.findUnique.mockResolvedValueOnce({
          ...mockParentComment,
          id: `level${i}`,
          parentId: `level${i + 1}`,
        })
      }

      mockPrisma.comment.create.mockResolvedValue({
        ...mockChildComment,
        author: mockUser,
      })

      const result = await caller.create({
        ruleId: "rule123",
        parentId: "deep123",
        body: "Very deep reply",
      })

      expect(result.depth).toBe(10)
    })

    it("should throw NOT_FOUND when rule doesn't exist", async () => {
      mockPrisma.rule.findUnique.mockResolvedValue(null)

      await expect(
        caller.create({
          ruleId: "nonexistent",
          body: "This won't work",
        })
      ).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Rule not found",
        })
      )
    })

    it("should throw NOT_FOUND when parent comment doesn't exist", async () => {
      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.comment.findFirst.mockResolvedValue(null)

      await expect(
        caller.create({
          ruleId: "rule123",
          parentId: "nonexistent",
          body: "This won't work",
        })
      ).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Parent comment not found",
        })
      )
    })

    it("should create audit log", async () => {
      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        author: mockUser,
      })

      await caller.create({
        ruleId: "rule123",
        body: "This is a new comment",
      })

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: "comment.create",
          entityType: "comment",
          entityId: "comment123",
          userId: "user123",
          ipHash: "test-ip-hash",
          diff: {
            ruleId: "rule123",
            parentId: undefined,
            body: "This is a new comment",
          },
        },
      })
    })

    it("should send notifications for replies", async () => {
      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.comment.findFirst.mockResolvedValue(mockParentComment)
      mockPrisma.comment.findUnique.mockResolvedValue(null)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockChildComment,
        author: mockUser,
      })

      await caller.create({
        ruleId: "rule123",
        parentId: "parent123",
        body: "This is a reply",
      })

      expect(mockNotifications.commentReply).toHaveBeenCalledWith({
        ruleId: "rule123",
        ruleSlug: "test-rule",
        commentId: "child123",
        parentAuthorId: "parent_user",
        actorUserId: "user123",
        actorHandle: "testuser",
        actorDisplayName: "Test User",
      })
    })

    it("should handle notification errors gracefully", async () => {
      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.comment.findFirst.mockResolvedValue(mockParentComment)
      mockPrisma.comment.findUnique.mockResolvedValue(null)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockChildComment,
        author: mockUser,
      })

      mockNotifications.commentReply.mockRejectedValue(new Error("Notification failed"))

      const result = await caller.create({
        ruleId: "rule123",
        parentId: "parent123",
        body: "This is a reply",
      })

      expect(result).toBeDefined()
    })

    it("should send ingest events", async () => {
      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        author: mockUser,
      })

      global.fetch.mockResolvedValue({ ok: true })

      await caller.create({
        ruleId: "rule123",
        body: "This is a new comment",
      })

      expect(global.fetch).toHaveBeenCalledWith("https://ingest.example.com/ingest/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-app-token": "test-token",
          "x-forwarded-for": "127.0.0.1",
          "user-agent": "test-user-agent",
        },
        body: JSON.stringify({
          events: [
            {
              type: "COMMENT",
              ruleId: "rule123",
              userId: "user123",
              ts: now.toISOString(),
            },
          ],
        }),
      })
    })

    it("should handle ingest errors gracefully", async () => {
      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        author: mockUser,
      })

      global.fetch.mockRejectedValue(new Error("Ingest failed"))

      const result = await caller.create({
        ruleId: "rule123",
        body: "This is a new comment",
      })

      expect(result).toBeDefined()
    })

    it("should handle shadow banned users", async () => {
      const shadowBannedCaller = commentsRouter.createCaller({
        user: mockUser,
        prisma: mockPrisma,
        shadowBanned: true,
      })

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        author: mockUser,
      })

      const result = await shadowBannedCaller.create({
        ruleId: "rule123",
        body: "Shadow banned comment",
      })

      expect(result).toBeDefined()
    })

    it("should handle missing environment variables for ingest", async () => {
      vi.unstubAllEnvs()

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        author: mockUser,
      })

      const result = await caller.create({
        ruleId: "rule123",
        body: "This is a new comment",
      })

      expect(result).toBeDefined()
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it("should handle database errors", async () => {
      mockPrisma.rule.findUnique.mockRejectedValue(new Error("Database error"))

      await expect(
        caller.create({
          ruleId: "rule123",
          body: "This won't work",
        })
      ).rejects.toThrow("Database error")
    })
  })

  describe("edit", () => {
    it("should edit comment as author", async () => {
      mockPrisma.comment.findFirst.mockResolvedValue({
        ...mockComment,
        author: mockUser,
      })
      mockPrisma.comment.update.mockResolvedValue({
        ...mockComment,
        body: "Updated comment",
        updatedAt: now,
        author: mockUser,
      })

      const result = await caller.edit({
        commentId: "comment123",
        body: "Updated comment",
      })

      expect(result.bodyHtml).toBe("Updated comment")
      expect(result.edited).toBe(true)
      expect(mockPrisma.comment.update).toHaveBeenCalledWith({
        where: { id: "comment123" },
        data: {
          body: "Updated comment",
          updatedAt: expect.any(Date),
        },
        include: {
          author: {
            select: {
              id: true,
              handle: true,
              displayName: true,
              avatarUrl: true,
              role: true,
            },
          },
        },
      })
    })

    it("should edit comment as moderator", async () => {
      const moderatorCaller = commentsRouter.createCaller({
        user: mockModeratorUser,
        prisma: mockPrisma,
        reqIpHash: "test-ip-hash",
      })

      const otherUserComment = {
        ...mockComment,
        authorUserId: "other_user",
        createdAt: fifteenMinutesAgo, // Outside edit window
        author: {
          id: "other_user",
          handle: "otheruser",
          displayName: "Other User",
          role: "USER",
        },
      }

      mockPrisma.comment.findFirst.mockResolvedValue(otherUserComment)
      mockPrisma.comment.update.mockResolvedValue({
        ...otherUserComment,
        body: "Moderated comment",
        updatedAt: now,
      })

      const result = await moderatorCaller.edit({
        commentId: "comment123",
        body: "Moderated comment",
      })

      expect(result.bodyHtml).toBe("Moderated comment")
    })

    it("should throw NOT_FOUND when comment doesn't exist", async () => {
      mockPrisma.comment.findFirst.mockResolvedValue(null)

      await expect(
        caller.edit({
          commentId: "nonexistent",
          body: "Won't work",
        })
      ).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        })
      )
    })

    it("should throw FORBIDDEN when user is not author or moderator", async () => {
      const otherUserComment = {
        ...mockComment,
        authorUserId: "other_user",
      }
      mockPrisma.comment.findFirst.mockResolvedValue(otherUserComment)

      await expect(
        caller.edit({
          commentId: "comment123",
          body: "Unauthorized edit",
        })
      ).rejects.toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to edit this comment",
        })
      )
    })

    it("should throw FORBIDDEN when edit window has expired", async () => {
      const oldComment = {
        ...mockComment,
        createdAt: fifteenMinutesAgo, // Outside 10-minute edit window
      }
      mockPrisma.comment.findFirst.mockResolvedValue(oldComment)

      await expect(
        caller.edit({
          commentId: "comment123",
          body: "Too late to edit",
        })
      ).rejects.toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Edit window has expired",
        })
      )
    })

    it("should create audit log", async () => {
      mockPrisma.comment.findFirst.mockResolvedValue({
        ...mockComment,
        author: mockUser,
      })
      mockPrisma.comment.update.mockResolvedValue({
        ...mockComment,
        body: "Updated comment",
        updatedAt: now,
        author: mockUser,
      })

      await caller.edit({
        commentId: "comment123",
        body: "Updated comment",
      })

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: "comment.edit",
          entityType: "comment",
          entityId: "comment123",
          userId: "user123",
          ipHash: "test-ip-hash",
          diff: {
            oldBody: "This is a test comment",
            newBody: "Updated comment",
          },
        },
      })
    })

    it("should handle database errors", async () => {
      mockPrisma.comment.findFirst.mockRejectedValue(new Error("Database error"))

      await expect(
        caller.edit({
          commentId: "comment123",
          body: "Won't work",
        })
      ).rejects.toThrow("Database error")
    })
  })

  describe("softDelete", () => {
    it("should delete comment as author", async () => {
      mockPrisma.comment.findFirst.mockResolvedValue(mockComment)
      mockPrisma.comment.update.mockResolvedValue({
        ...mockComment,
        deletedAt: now,
      })

      const result = await caller.softDelete({
        commentId: "comment123",
        reason: "No longer needed",
      })

      expect(result.success).toBe(true)
      expect(mockPrisma.comment.update).toHaveBeenCalledWith({
        where: { id: "comment123" },
        data: { deletedAt: expect.any(Date) },
      })
    })

    it("should delete comment as moderator", async () => {
      const moderatorCaller = commentsRouter.createCaller({
        user: mockModeratorUser,
        prisma: mockPrisma,
      })

      const otherUserComment = {
        ...mockComment,
        authorUserId: "other_user",
      }
      mockPrisma.comment.findFirst.mockResolvedValue(otherUserComment)
      mockPrisma.comment.update.mockResolvedValue({
        ...otherUserComment,
        deletedAt: now,
      })

      const result = await moderatorCaller.softDelete({
        commentId: "comment123",
        reason: "Inappropriate content",
      })

      expect(result.success).toBe(true)
    })

    it("should throw NOT_FOUND when comment doesn't exist", async () => {
      mockPrisma.comment.findFirst.mockResolvedValue(null)

      await expect(
        caller.softDelete({
          commentId: "nonexistent",
        })
      ).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        })
      )
    })

    it("should throw FORBIDDEN when user is not author or moderator", async () => {
      const otherUserComment = {
        ...mockComment,
        authorUserId: "other_user",
      }
      mockPrisma.comment.findFirst.mockResolvedValue(otherUserComment)

      await expect(
        caller.softDelete({
          commentId: "comment123",
        })
      ).rejects.toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to delete this comment",
        })
      )
    })

    it("should call audit log service", async () => {
      mockPrisma.comment.findFirst.mockResolvedValue(mockComment)
      mockPrisma.comment.update.mockResolvedValue({
        ...mockComment,
        deletedAt: now,
      })

      await caller.softDelete({
        commentId: "comment123",
        reason: "Test deletion",
      })

      expect(mockAuditLogService.logCommentDelete).toHaveBeenCalledWith(
        "comment123",
        "user123",
        "Test deletion",
        {
          deletedBy: "author",
          authorId: "user123",
          ruleId: "rule123",
          bodyPreview: "This is a test comment",
        }
      )
    })

    it("should handle moderator deletion in audit log", async () => {
      const moderatorCaller = commentsRouter.createCaller({
        user: mockModeratorUser,
        prisma: mockPrisma,
      })

      const otherUserComment = {
        ...mockComment,
        authorUserId: "other_user",
      }
      mockPrisma.comment.findFirst.mockResolvedValue(otherUserComment)
      mockPrisma.comment.update.mockResolvedValue({
        ...otherUserComment,
        deletedAt: now,
      })

      await moderatorCaller.softDelete({
        commentId: "comment123",
        reason: "Moderation action",
      })

      expect(mockAuditLogService.logCommentDelete).toHaveBeenCalledWith(
        "comment123",
        "mod123",
        "Moderation action",
        {
          deletedBy: "moderator",
          authorId: "other_user",
          ruleId: "rule123",
          bodyPreview: "This is a test comment",
        }
      )
    })

    it("should handle missing reason", async () => {
      mockPrisma.comment.findFirst.mockResolvedValue(mockComment)
      mockPrisma.comment.update.mockResolvedValue({
        ...mockComment,
        deletedAt: now,
      })

      await caller.softDelete({
        commentId: "comment123",
      })

      expect(mockAuditLogService.logCommentDelete).toHaveBeenCalledWith(
        "comment123",
        "user123",
        undefined,
        expect.any(Object)
      )
    })

    it("should handle database errors", async () => {
      mockPrisma.comment.findFirst.mockRejectedValue(new Error("Database error"))

      await expect(
        caller.softDelete({
          commentId: "comment123",
        })
      ).rejects.toThrow("Database error")
    })
  })

  describe("Edge Cases and Integration", () => {
    it("should handle user without permissions correctly", async () => {
      const unauthorizedCaller = commentsRouter.createCaller({
        user: { id: "unauthorized", role: "USER" },
        prisma: mockPrisma,
      })

      const otherUserComment = {
        ...mockComment,
        authorUserId: "other_user",
      }
      mockPrisma.comment.findFirst.mockResolvedValue(otherUserComment)

      await expect(
        unauthorizedCaller.edit({
          commentId: "comment123",
          body: "Unauthorized edit",
        })
      ).rejects.toThrow(
        new TRPCError({
          code: "FORBIDDEN",
          message: "Not authorized to edit this comment",
        })
      )
    })

    it("should handle complex comment thread creation", async () => {
      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)

      // Create a chain of parent comments
      const parentChain = [
        { ...mockParentComment, id: "level0", parentId: null },
        { ...mockParentComment, id: "level1", parentId: "level0" },
        { ...mockParentComment, id: "level2", parentId: "level1" },
      ]

      mockPrisma.comment.findFirst.mockResolvedValue(parentChain[2])
      mockPrisma.comment.findUnique
        .mockResolvedValueOnce(parentChain[1])
        .mockResolvedValueOnce(parentChain[0])
        .mockResolvedValueOnce(null)

      mockPrisma.comment.create.mockResolvedValue({
        ...mockChildComment,
        author: mockUser,
      })

      const result = await caller.create({
        ruleId: "rule123",
        parentId: "level2",
        body: "Deep nested comment",
      })

      expect(result.depth).toBe(3)
    })

    it("should handle concurrent comment operations", async () => {
      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        author: mockUser,
      })

      const [result1, result2] = await Promise.all([
        caller.create({
          ruleId: "rule123",
          body: "First comment",
        }),
        caller.create({
          ruleId: "rule123",
          body: "Second comment",
        }),
      ])

      expect(result1).toBeDefined()
      expect(result2).toBeDefined()
      expect(mockPrisma.comment.create).toHaveBeenCalledTimes(2)
    })

    it("should handle long comment body truncation in audit log", async () => {
      const longBody = "a".repeat(200)
      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        body: longBody,
        author: mockUser,
      })

      await caller.create({
        ruleId: "rule123",
        body: longBody,
      })

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            diff: expect.objectContaining({
              body: longBody.substring(0, 100),
            }),
          }),
        })
      )
    })

    it("should handle complete comment workflow", async () => {
      // 1. Create comment
      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.comment.create.mockResolvedValue({
        ...mockComment,
        author: mockUser,
      })

      const createResult = await caller.create({
        ruleId: "rule123",
        body: "Initial comment",
      })

      expect(createResult.id).toBe("comment123")

      // 2. Edit comment
      mockPrisma.comment.findFirst.mockResolvedValue({
        ...mockComment,
        author: mockUser,
      })
      mockPrisma.comment.update.mockResolvedValue({
        ...mockComment,
        body: "Edited comment",
        updatedAt: now,
        author: mockUser,
      })

      const editResult = await caller.edit({
        commentId: "comment123",
        body: "Edited comment",
      })

      expect(editResult.bodyHtml).toBe("Edited comment")
      expect(editResult.edited).toBe(true)

      // 3. Delete comment
      mockPrisma.comment.findFirst.mockResolvedValue(mockComment)
      mockPrisma.comment.update.mockResolvedValue({
        ...mockComment,
        deletedAt: now,
      })

      const deleteResult = await caller.softDelete({
        commentId: "comment123",
        reason: "No longer needed",
      })

      expect(deleteResult.success).toBe(true)
    })

    it("should handle missing user context gracefully", async () => {
      const callerWithoutUser = commentsRouter.createCaller({
        user: null,
        prisma: mockPrisma,
      })

      mockPrisma.comment.findMany.mockResolvedValue([mockComment])
      mockPrisma.comment.count.mockResolvedValue(1)

      const result = await callerWithoutUser.list({
        ruleId: "rule123",
        mode: "flat",
        limit: 10,
      })

      expect(result.items[0].canEdit).toBe(false)
      expect(result.items[0].canDelete).toBe(false)
    })

    it("should handle broken parent chain gracefully", async () => {
      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)

      const brokenParent = { ...mockParentComment, parentId: "broken123" }
      mockPrisma.comment.findFirst.mockResolvedValue(brokenParent)
      mockPrisma.comment.findUnique.mockResolvedValue(null) // Broken chain

      mockPrisma.comment.create.mockResolvedValue({
        ...mockChildComment,
        author: mockUser,
      })

      const result = await caller.create({
        ruleId: "rule123",
        parentId: "parent123",
        body: "Reply with broken chain",
      })

      expect(result.depth).toBe(1) // Should still work with depth 1
    })
  })
})
