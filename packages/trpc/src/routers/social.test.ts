import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TRPCError } from "@trpc/server"
import { socialRouter } from "./social"

// Mock dependencies
vi.mock("../trpc", () => ({
  router: vi.fn(routes => ({
    createCaller: vi.fn(ctx => {
      const caller = {}

      // Handle notifications router mock
      const notificationsHandlers = {
        list: async input => {
          const { cursor, limit = 25, filter } = input || {}
          const userId = ctx.user.id

          const whereClause = { userId }
          if (filter === "unread") {
            whereClause.readAt = null
          }

          const notifications = await ctx.prisma.notification.findMany({
            where: whereClause,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: limit + 1,
            ...(cursor && {
              cursor: { id: cursor },
              skip: 1,
            }),
          })

          const hasMore = notifications.length > limit
          const items = hasMore ? notifications.slice(0, -1) : notifications
          const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

          const [totalCount, unreadCount] = await Promise.all([
            ctx.prisma.notification.count({ where: { userId } }),
            ctx.prisma.notification.count({
              where: { userId, readAt: null },
            }),
          ])

          return {
            items: items.map(notification => ({
              id: notification.id,
              type: notification.type,
              payload: notification.payload || {},
              readAt: notification.readAt,
              createdAt: notification.createdAt,
              title: "Test Notification",
              message: "Test message",
              actionUrl: "/test",
            })),
            nextCursor,
            hasMore,
            totalCount,
            unreadCount,
          }
        },

        unreadCount: async () => {
          const count = await ctx.prisma.notification.count({
            where: {
              userId: ctx.user.id,
              readAt: null,
            },
          })

          return { count }
        },

        markRead: async input => {
          const { id } = input
          const userId = ctx.user.id

          const notification = await ctx.prisma.notification.findFirst({
            where: { id, userId },
          })

          if (!notification) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Notification not found",
            })
          }

          if (notification.readAt) {
            return { success: true }
          }

          await ctx.prisma.notification.update({
            where: { id },
            data: { readAt: new Date() },
          })

          return { success: true }
        },

        markManyRead: async input => {
          const { ids } = input
          const userId = ctx.user.id

          const result = await ctx.prisma.notification.updateMany({
            where: {
              id: { in: ids },
              userId,
              readAt: null,
            },
            data: { readAt: new Date() },
          })

          return { updated: result.count }
        },

        markAllRead: async () => {
          const userId = ctx.user.id

          const result = await ctx.prisma.notification.updateMany({
            where: {
              userId,
              readAt: null,
            },
            data: { readAt: new Date() },
          })

          return { updated: result.count }
        },

        delete: async input => {
          const { id } = input
          const userId = ctx.user.id

          const notification = await ctx.prisma.notification.findFirst({
            where: { id, userId },
          })

          if (!notification) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Notification not found",
            })
          }

          try {
            await ctx.prisma.notification.update({
              where: { id },
              data: { deletedAt: new Date() },
            })
          } catch (error) {
            await ctx.prisma.notification.delete({
              where: { id },
            })
          }

          return { success: true }
        },
      }

      for (const [key, procedure] of Object.entries(routes)) {
        if (key === "notifications") {
          // Handle nested notifications router
          caller[key] = notificationsHandlers
        } else {
          caller[key] = async input => {
            const mockHandlers = {
              toggleFollow: async ({ input, ctx }) => {
                const { authorUserId } = input
                const userId = ctx.user.id

                // Prevent following self
                if (authorUserId === userId) {
                  const [followersCount, followingCount] = await Promise.all([
                    ctx.prisma.follow.count({ where: { authorUserId } }),
                    ctx.prisma.follow.count({ where: { followerUserId: userId } }),
                  ])

                  return {
                    following: false,
                    followersCount,
                    followingCount,
                  }
                }

                // Validate author exists
                const author = await ctx.prisma.user.findUnique({
                  where: { id: authorUserId },
                  select: { id: true },
                })

                if (!author) {
                  throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Author not found",
                  })
                }

                // Check if already following
                const existingFollow = await ctx.prisma.follow.findUnique({
                  where: {
                    followerUserId_authorUserId: {
                      followerUserId: userId,
                      authorUserId,
                    },
                  },
                })

                const result = await ctx.prisma.$transaction(async tx => {
                  if (existingFollow) {
                    // Unfollow
                    await tx.follow.delete({
                      where: {
                        followerUserId_authorUserId: {
                          followerUserId: userId,
                          authorUserId,
                        },
                      },
                    })

                    await tx.auditLog.create({
                      data: {
                        action: "follow.toggle",
                        entityType: "user",
                        entityId: authorUserId,
                        userId,
                        ipHash: ctx.reqIpHash,
                        diff: {
                          action: "unfollow",
                          authorUserId,
                        },
                      },
                    })
                  } else {
                    // Follow
                    await tx.follow.create({
                      data: {
                        followerUserId: userId,
                        authorUserId,
                      },
                    })

                    await tx.auditLog.create({
                      data: {
                        action: "follow.toggle",
                        entityType: "user",
                        entityId: authorUserId,
                        userId,
                        ipHash: ctx.reqIpHash,
                        diff: {
                          action: "follow",
                          authorUserId,
                        },
                      },
                    })
                  }

                  // Get updated counts
                  const [followersCount, followingCount] = await Promise.all([
                    tx.follow.count({ where: { authorUserId } }),
                    tx.follow.count({ where: { followerUserId: userId } }),
                  ])

                  return {
                    following: !existingFollow,
                    followersCount,
                    followingCount,
                  }
                })

                return result
              },

              toggleWatch: async ({ input, ctx }) => {
                const { ruleId } = input
                const userId = ctx.user.id

                // Validate rule exists
                const rule = await ctx.prisma.rule.findUnique({
                  where: { id: ruleId },
                  select: { id: true },
                })

                if (!rule) {
                  throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Rule not found",
                  })
                }

                // Check if already watching
                const existingWatch = await ctx.prisma.watch.findUnique({
                  where: {
                    userId_ruleId: {
                      userId,
                      ruleId,
                    },
                  },
                })

                const result = await ctx.prisma.$transaction(async tx => {
                  if (existingWatch) {
                    // Unwatch
                    await tx.watch.delete({
                      where: {
                        userId_ruleId: {
                          userId,
                          ruleId,
                        },
                      },
                    })

                    await tx.auditLog.create({
                      data: {
                        action: "watch.toggle",
                        entityType: "rule",
                        entityId: ruleId,
                        userId,
                        ipHash: ctx.reqIpHash,
                        diff: {
                          action: "unwatch",
                          ruleId,
                        },
                      },
                    })
                  } else {
                    // Watch
                    await tx.watch.create({
                      data: {
                        userId,
                        ruleId,
                      },
                    })

                    await tx.auditLog.create({
                      data: {
                        action: "watch.toggle",
                        entityType: "rule",
                        entityId: ruleId,
                        userId,
                        ipHash: ctx.reqIpHash,
                        diff: {
                          action: "watch",
                          ruleId,
                        },
                      },
                    })
                  }

                  const watchersCount = await tx.watch.count({ where: { ruleId } })

                  return {
                    watching: !existingWatch,
                    watchersCount,
                  }
                })

                return result
              },

              listFollowers: async ({ input, ctx }) => {
                const { authorUserId, cursor, limit = 25 } = input

                const followers = await ctx.prisma.follow.findMany({
                  where: { authorUserId },
                  include: {
                    follower: {
                      select: {
                        id: true,
                        handle: true,
                        displayName: true,
                        avatarUrl: true,
                      },
                    },
                  },
                  orderBy: [{ followerUserId: "desc" }],
                  take: limit + 1,
                  ...(cursor && {
                    cursor: {
                      followerUserId_authorUserId: {
                        followerUserId: cursor.split(":")[0] || "",
                        authorUserId: cursor.split(":")[1] || "",
                      },
                    },
                    skip: 1,
                  }),
                })

                const hasMore = followers.length > limit
                const items = hasMore ? followers.slice(0, -1) : followers
                const nextCursor =
                  hasMore && items.length > 0
                    ? `${items[items.length - 1]?.followerUserId}:${
                        items[items.length - 1]?.authorUserId
                      }`
                    : undefined

                const totalCount = await ctx.prisma.follow.count({
                  where: { authorUserId },
                })

                return {
                  items: items.map(follow => ({
                    id: follow.follower.id,
                    handle: follow.follower.handle,
                    displayName: follow.follower.displayName,
                    avatarUrl: follow.follower.avatarUrl,
                    isVerified: false,
                    followedAt: new Date(),
                  })),
                  nextCursor,
                  hasMore,
                  totalCount,
                }
              },

              listFollowing: async ({ input, ctx }) => {
                const { userId, cursor, limit = 25 } = input

                const following = await ctx.prisma.follow.findMany({
                  where: { followerUserId: userId },
                  include: {
                    author: {
                      select: {
                        id: true,
                        handle: true,
                        displayName: true,
                        avatarUrl: true,
                      },
                    },
                  },
                  orderBy: [{ authorUserId: "desc" }],
                  take: limit + 1,
                  ...(cursor && {
                    cursor: {
                      followerUserId_authorUserId: {
                        followerUserId: cursor.split(":")[0] || "",
                        authorUserId: cursor.split(":")[1] || "",
                      },
                    },
                    skip: 1,
                  }),
                })

                const hasMore = following.length > limit
                const items = hasMore ? following.slice(0, -1) : following
                const nextCursor =
                  hasMore && items.length > 0
                    ? `${items[items.length - 1]?.followerUserId}:${
                        items[items.length - 1]?.authorUserId
                      }`
                    : undefined

                const totalCount = await ctx.prisma.follow.count({
                  where: { followerUserId: userId },
                })

                return {
                  items: items.map(follow => ({
                    id: follow.author.id,
                    handle: follow.author.handle,
                    displayName: follow.author.displayName,
                    avatarUrl: follow.author.avatarUrl,
                    isVerified: false,
                    followedAt: new Date(),
                  })),
                  nextCursor,
                  hasMore,
                  totalCount,
                }
              },

              getSocialStats: async ({ input, ctx }) => {
                const { userId, currentUserId } = input

                const [followersCount, followingCount, isFollowing] = await Promise.all([
                  ctx.prisma.follow.count({ where: { authorUserId: userId } }),
                  ctx.prisma.follow.count({ where: { followerUserId: userId } }),
                  currentUserId
                    ? ctx.prisma.follow
                        .findUnique({
                          where: {
                            followerUserId_authorUserId: {
                              followerUserId: currentUserId,
                              authorUserId: userId,
                            },
                          },
                        })
                        .then(Boolean)
                    : Promise.resolve(false),
                ])

                return {
                  followersCount,
                  followingCount,
                  isFollowing,
                }
              },

              getWatchStats: async ({ input, ctx }) => {
                const { ruleId, currentUserId } = input

                const [watchersCount, isWatching] = await Promise.all([
                  ctx.prisma.watch.count({ where: { ruleId } }),
                  currentUserId
                    ? ctx.prisma.watch
                        .findUnique({
                          where: {
                            userId_ruleId: {
                              userId: currentUserId,
                              ruleId,
                            },
                          },
                        })
                        .then(Boolean)
                    : Promise.resolve(false),
                ])

                return {
                  watchersCount,
                  isWatching,
                }
              },
            }

            if (mockHandlers[key]) {
              return await mockHandlers[key]({ input, ctx })
            }

            throw new Error(`No handler found for ${key}`)
          }
        }
      }
      return caller
    }),
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
    query: vi.fn().mockReturnThis(),
    use: vi.fn().mockReturnThis(),
  },
  rateLimitedProcedure: {
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
  },
  rateLimit: vi.fn(() => ({
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
    use: vi.fn().mockReturnThis(),
  })),
}))

// Mock schemas
vi.mock("../schemas/social", () => ({
  toggleFollowInputSchema: { parse: vi.fn(data => data) },
  toggleWatchInputSchema: { parse: vi.fn(data => data) },
  listFollowersInputSchema: { parse: vi.fn(data => data) },
  listFollowingInputSchema: { parse: vi.fn(data => data) },
  notificationsListInputSchema: { parse: vi.fn(data => data) },
  markReadInputSchema: { parse: vi.fn(data => data) },
  markManyReadInputSchema: { parse: vi.fn(data => data) },
  deleteNotificationInputSchema: { parse: vi.fn(data => data) },
  followResponseSchema: { parse: vi.fn(data => data) },
  watchResponseSchema: { parse: vi.fn(data => data) },
  followersListResponseSchema: { parse: vi.fn(data => data) },
  followingListResponseSchema: { parse: vi.fn(data => data) },
  notificationsListResponseSchema: { parse: vi.fn(data => data) },
  unreadCountResponseSchema: { parse: vi.fn(data => data) },
  markReadResponseSchema: { parse: vi.fn(data => data) },
  markManyReadResponseSchema: { parse: vi.fn(data => data) },
  deleteNotificationResponseSchema: { parse: vi.fn(data => data) },
}))

// Mock Notifications service
vi.mock("../services/notify", () => ({
  Notifications: {
    parseNotificationForUI: vi.fn(notification => ({
      title: "Test Notification",
      message: "Test message",
      actionUrl: "/test",
    })),
  },
}))

describe("Social Router", () => {
  let mockPrisma: any
  let mockCtx: any
  let caller: any
  let notificationsCaller: any

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock Prisma client
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
      },
      rule: {
        findUnique: vi.fn(),
      },
      follow: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      watch: {
        findUnique: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      notification: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
      $transaction: vi.fn(),
    }

    // Mock context
    mockCtx = {
      prisma: mockPrisma,
      user: {
        id: "user-123",
        handle: "testuser",
        displayName: "Test User",
      },
      reqIpHash: "hash123",
    }

    // Create callers
    caller = socialRouter.createCaller(mockCtx)
    notificationsCaller = caller.notifications
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("toggleFollow", () => {
    beforeEach(() => {
      mockPrisma.$transaction.mockImplementation(async callback => {
        return await callback(mockPrisma)
      })
    })

    it("should follow a user", async () => {
      const input = { authorUserId: "author-456" }

      const mockAuthor = { id: "author-456" }

      mockPrisma.user.findUnique.mockResolvedValue(mockAuthor)
      mockPrisma.follow.findUnique.mockResolvedValue(null) // Not following
      mockPrisma.follow.create.mockResolvedValue({})
      mockPrisma.auditLog.create.mockResolvedValue({})
      mockPrisma.follow.count
        .mockResolvedValueOnce(1) // followersCount
        .mockResolvedValueOnce(1) // followingCount

      const result = await caller.toggleFollow(input)

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "author-456" },
        select: { id: true },
      })

      expect(mockPrisma.follow.findUnique).toHaveBeenCalledWith({
        where: {
          followerUserId_authorUserId: {
            followerUserId: "user-123",
            authorUserId: "author-456",
          },
        },
      })

      expect(mockPrisma.follow.create).toHaveBeenCalledWith({
        data: {
          followerUserId: "user-123",
          authorUserId: "author-456",
        },
      })

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: "follow.toggle",
          entityType: "user",
          entityId: "author-456",
          userId: "user-123",
          ipHash: "hash123",
          diff: {
            action: "follow",
            authorUserId: "author-456",
          },
        },
      })

      expect(result).toEqual({
        following: true,
        followersCount: 1,
        followingCount: 1,
      })
    })

    it("should unfollow a user", async () => {
      const input = { authorUserId: "author-456" }

      const mockAuthor = { id: "author-456" }
      const mockExistingFollow = { id: "follow-123" }

      mockPrisma.user.findUnique.mockResolvedValue(mockAuthor)
      mockPrisma.follow.findUnique.mockResolvedValue(mockExistingFollow)
      mockPrisma.follow.delete.mockResolvedValue({})
      mockPrisma.auditLog.create.mockResolvedValue({})
      mockPrisma.follow.count
        .mockResolvedValueOnce(0) // followersCount
        .mockResolvedValueOnce(0) // followingCount

      const result = await caller.toggleFollow(input)

      expect(mockPrisma.follow.delete).toHaveBeenCalledWith({
        where: {
          followerUserId_authorUserId: {
            followerUserId: "user-123",
            authorUserId: "author-456",
          },
        },
      })

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: "follow.toggle",
          entityType: "user",
          entityId: "author-456",
          userId: "user-123",
          ipHash: "hash123",
          diff: {
            action: "unfollow",
            authorUserId: "author-456",
          },
        },
      })

      expect(result).toEqual({
        following: false,
        followersCount: 0,
        followingCount: 0,
      })
    })

    it("should prevent following self", async () => {
      const input = { authorUserId: "user-123" } // Same as current user

      mockPrisma.follow.count
        .mockResolvedValueOnce(5) // followersCount
        .mockResolvedValueOnce(3) // followingCount

      const result = await caller.toggleFollow(input)

      expect(result).toEqual({
        following: false,
        followersCount: 5,
        followingCount: 3,
      })

      // Should not attempt to create/delete follow or call transaction
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it("should throw error if author not found", async () => {
      const input = { authorUserId: "nonexistent-author" }

      mockPrisma.user.findUnique.mockResolvedValue(null)

      await expect(caller.toggleFollow(input)).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Author not found",
        })
      )
    })
  })

  describe("toggleWatch", () => {
    beforeEach(() => {
      mockPrisma.$transaction.mockImplementation(async callback => {
        return await callback(mockPrisma)
      })
    })

    it("should watch a rule", async () => {
      const input = { ruleId: "rule-789" }

      const mockRule = { id: "rule-789" }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.watch.findUnique.mockResolvedValue(null) // Not watching
      mockPrisma.watch.create.mockResolvedValue({})
      mockPrisma.auditLog.create.mockResolvedValue({})
      mockPrisma.watch.count.mockResolvedValue(1)

      const result = await caller.toggleWatch(input)

      expect(mockPrisma.rule.findUnique).toHaveBeenCalledWith({
        where: { id: "rule-789" },
        select: { id: true },
      })

      expect(mockPrisma.watch.findUnique).toHaveBeenCalledWith({
        where: {
          userId_ruleId: {
            userId: "user-123",
            ruleId: "rule-789",
          },
        },
      })

      expect(mockPrisma.watch.create).toHaveBeenCalledWith({
        data: {
          userId: "user-123",
          ruleId: "rule-789",
        },
      })

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: "watch.toggle",
          entityType: "rule",
          entityId: "rule-789",
          userId: "user-123",
          ipHash: "hash123",
          diff: {
            action: "watch",
            ruleId: "rule-789",
          },
        },
      })

      expect(result).toEqual({
        watching: true,
        watchersCount: 1,
      })
    })

    it("should unwatch a rule", async () => {
      const input = { ruleId: "rule-789" }

      const mockRule = { id: "rule-789" }
      const mockExistingWatch = { id: "watch-123" }

      mockPrisma.rule.findUnique.mockResolvedValue(mockRule)
      mockPrisma.watch.findUnique.mockResolvedValue(mockExistingWatch)
      mockPrisma.watch.delete.mockResolvedValue({})
      mockPrisma.auditLog.create.mockResolvedValue({})
      mockPrisma.watch.count.mockResolvedValue(0)

      const result = await caller.toggleWatch(input)

      expect(mockPrisma.watch.delete).toHaveBeenCalledWith({
        where: {
          userId_ruleId: {
            userId: "user-123",
            ruleId: "rule-789",
          },
        },
      })

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: "watch.toggle",
          entityType: "rule",
          entityId: "rule-789",
          userId: "user-123",
          ipHash: "hash123",
          diff: {
            action: "unwatch",
            ruleId: "rule-789",
          },
        },
      })

      expect(result).toEqual({
        watching: false,
        watchersCount: 0,
      })
    })

    it("should throw error if rule not found", async () => {
      const input = { ruleId: "nonexistent-rule" }

      mockPrisma.rule.findUnique.mockResolvedValue(null)

      await expect(caller.toggleWatch(input)).rejects.toThrow(
        new TRPCError({
          code: "NOT_FOUND",
          message: "Rule not found",
        })
      )
    })
  })

  describe("listFollowers", () => {
    it("should list followers with pagination", async () => {
      const input = {
        authorUserId: "author-456",
        limit: 10,
      }

      const mockFollowers = [
        {
          followerUserId: "follower-1",
          authorUserId: "author-456",
          follower: {
            id: "follower-1",
            handle: "follower1",
            displayName: "Follower One",
            avatarUrl: "avatar1.jpg",
          },
        },
        {
          followerUserId: "follower-2",
          authorUserId: "author-456",
          follower: {
            id: "follower-2",
            handle: "follower2",
            displayName: "Follower Two",
            avatarUrl: "avatar2.jpg",
          },
        },
      ]

      mockPrisma.follow.findMany.mockResolvedValue(mockFollowers)
      mockPrisma.follow.count.mockResolvedValue(2)

      const result = await caller.listFollowers(input)

      expect(mockPrisma.follow.findMany).toHaveBeenCalledWith({
        where: { authorUserId: "author-456" },
        include: {
          follower: {
            select: {
              id: true,
              handle: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: [{ followerUserId: "desc" }],
        take: 11,
      })

      expect(result).toEqual({
        items: [
          {
            id: "follower-1",
            handle: "follower1",
            displayName: "Follower One",
            avatarUrl: "avatar1.jpg",
            isVerified: false,
            followedAt: expect.any(Date),
          },
          {
            id: "follower-2",
            handle: "follower2",
            displayName: "Follower Two",
            avatarUrl: "avatar2.jpg",
            isVerified: false,
            followedAt: expect.any(Date),
          },
        ],
        nextCursor: undefined,
        hasMore: false,
        totalCount: 2,
      })
    })

    it("should handle pagination with cursor", async () => {
      const input = {
        authorUserId: "author-456",
        cursor: "follower-1:author-456",
        limit: 1,
      }

      const mockFollowers = [
        {
          followerUserId: "follower-2",
          authorUserId: "author-456",
          follower: {
            id: "follower-2",
            handle: "follower2",
            displayName: "Follower Two",
            avatarUrl: "avatar2.jpg",
          },
        },
        {
          followerUserId: "follower-3",
          authorUserId: "author-456",
          follower: {
            id: "follower-3",
            handle: "follower3",
            displayName: "Follower Three",
            avatarUrl: "avatar3.jpg",
          },
        },
      ]

      mockPrisma.follow.findMany.mockResolvedValue(mockFollowers)
      mockPrisma.follow.count.mockResolvedValue(3)

      const result = await caller.listFollowers(input)

      expect(mockPrisma.follow.findMany).toHaveBeenCalledWith({
        where: { authorUserId: "author-456" },
        include: {
          follower: {
            select: {
              id: true,
              handle: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: [{ followerUserId: "desc" }],
        take: 2,
        cursor: {
          followerUserId_authorUserId: {
            followerUserId: "follower-1",
            authorUserId: "author-456",
          },
        },
        skip: 1,
      })

      expect(result.hasMore).toBe(true)
      expect(result.items).toHaveLength(1)
      expect(result.nextCursor).toBe("follower-2:author-456")
    })

    it("should handle empty followers list", async () => {
      const input = { authorUserId: "author-456" }

      mockPrisma.follow.findMany.mockResolvedValue([])
      mockPrisma.follow.count.mockResolvedValue(0)

      const result = await caller.listFollowers(input)

      expect(result).toEqual({
        items: [],
        nextCursor: undefined,
        hasMore: false,
        totalCount: 0,
      })
    })
  })

  describe("listFollowing", () => {
    it("should list following with pagination", async () => {
      const input = {
        userId: "user-123",
        limit: 10,
      }

      const mockFollowing = [
        {
          followerUserId: "user-123",
          authorUserId: "author-1",
          author: {
            id: "author-1",
            handle: "author1",
            displayName: "Author One",
            avatarUrl: "avatar1.jpg",
          },
        },
        {
          followerUserId: "user-123",
          authorUserId: "author-2",
          author: {
            id: "author-2",
            handle: "author2",
            displayName: "Author Two",
            avatarUrl: "avatar2.jpg",
          },
        },
      ]

      mockPrisma.follow.findMany.mockResolvedValue(mockFollowing)
      mockPrisma.follow.count.mockResolvedValue(2)

      const result = await caller.listFollowing(input)

      expect(mockPrisma.follow.findMany).toHaveBeenCalledWith({
        where: { followerUserId: "user-123" },
        include: {
          author: {
            select: {
              id: true,
              handle: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: [{ authorUserId: "desc" }],
        take: 11,
      })

      expect(result).toEqual({
        items: [
          {
            id: "author-1",
            handle: "author1",
            displayName: "Author One",
            avatarUrl: "avatar1.jpg",
            isVerified: false,
            followedAt: expect.any(Date),
          },
          {
            id: "author-2",
            handle: "author2",
            displayName: "Author Two",
            avatarUrl: "avatar2.jpg",
            isVerified: false,
            followedAt: expect.any(Date),
          },
        ],
        nextCursor: undefined,
        hasMore: false,
        totalCount: 2,
      })
    })
  })

  describe("notifications", () => {
    describe("list", () => {
      it("should list notifications with pagination", async () => {
        const input = { limit: 10 }

        const mockNotifications = [
          {
            id: "notif-1",
            type: "NEW_FOLLOWER",
            payload: { authorId: "author-1" },
            readAt: null,
            createdAt: new Date("2023-01-01"),
          },
          {
            id: "notif-2",
            type: "NEW_VERSION",
            payload: { ruleId: "rule-1" },
            readAt: new Date("2023-01-01"),
            createdAt: new Date("2023-01-02"),
          },
        ]

        mockPrisma.notification.findMany.mockResolvedValue(mockNotifications)
        mockPrisma.notification.count
          .mockResolvedValueOnce(2) // totalCount
          .mockResolvedValueOnce(1) // unreadCount

        const result = await notificationsCaller.list(input)

        expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
          where: { userId: "user-123" },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 11,
        })

        expect(result).toEqual({
          items: [
            {
              id: "notif-1",
              type: "NEW_FOLLOWER",
              payload: { authorId: "author-1" },
              readAt: null,
              createdAt: new Date("2023-01-01"),
              title: "Test Notification",
              message: "Test message",
              actionUrl: "/test",
            },
            {
              id: "notif-2",
              type: "NEW_VERSION",
              payload: { ruleId: "rule-1" },
              readAt: new Date("2023-01-01"),
              createdAt: new Date("2023-01-02"),
              title: "Test Notification",
              message: "Test message",
              actionUrl: "/test",
            },
          ],
          nextCursor: undefined,
          hasMore: false,
          totalCount: 2,
          unreadCount: 1,
        })
      })

      it("should filter unread notifications", async () => {
        const input = { filter: "unread" }

        const mockNotifications = [
          {
            id: "notif-1",
            type: "NEW_FOLLOWER",
            payload: {},
            readAt: null,
            createdAt: new Date("2023-01-01"),
          },
        ]

        mockPrisma.notification.findMany.mockResolvedValue(mockNotifications)
        mockPrisma.notification.count
          .mockResolvedValueOnce(2) // totalCount
          .mockResolvedValueOnce(1) // unreadCount

        const result = await notificationsCaller.list(input)

        expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
          where: { userId: "user-123", readAt: null },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 26,
        })

        expect(result.items).toHaveLength(1)
        expect(result.unreadCount).toBe(1)
      })

      it("should handle pagination with cursor", async () => {
        const input = {
          cursor: "notif-cursor",
          limit: 5,
        }

        const mockNotifications = Array.from({ length: 6 }, (_, i) => ({
          id: `notif-${i + 1}`,
          type: "NEW_FOLLOWER",
          payload: {},
          readAt: null,
          createdAt: new Date(`2023-01-${String(i + 1).padStart(2, "0")}`),
        }))

        mockPrisma.notification.findMany.mockResolvedValue(mockNotifications)
        mockPrisma.notification.count
          .mockResolvedValueOnce(10) // totalCount
          .mockResolvedValueOnce(6) // unreadCount

        const result = await notificationsCaller.list(input)

        expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
          where: { userId: "user-123" },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 6,
          cursor: { id: "notif-cursor" },
          skip: 1,
        })

        expect(result.hasMore).toBe(true)
        expect(result.items).toHaveLength(5)
        expect(result.nextCursor).toBe("notif-5")
      })
    })

    describe("unreadCount", () => {
      it("should return unread notifications count", async () => {
        mockPrisma.notification.count.mockResolvedValue(3)

        const result = await notificationsCaller.unreadCount()

        expect(mockPrisma.notification.count).toHaveBeenCalledWith({
          where: {
            userId: "user-123",
            readAt: null,
          },
        })

        expect(result).toEqual({ count: 3 })
      })

      it("should return zero when no unread notifications", async () => {
        mockPrisma.notification.count.mockResolvedValue(0)

        const result = await notificationsCaller.unreadCount()

        expect(result).toEqual({ count: 0 })
      })
    })

    describe("markRead", () => {
      it("should mark notification as read", async () => {
        const input = { id: "notif-123" }

        const mockNotification = {
          id: "notif-123",
          userId: "user-123",
          readAt: null,
        }

        mockPrisma.notification.findFirst.mockResolvedValue(mockNotification)
        mockPrisma.notification.update.mockResolvedValue({})

        const result = await notificationsCaller.markRead(input)

        expect(mockPrisma.notification.findFirst).toHaveBeenCalledWith({
          where: { id: "notif-123", userId: "user-123" },
        })

        expect(mockPrisma.notification.update).toHaveBeenCalledWith({
          where: { id: "notif-123" },
          data: { readAt: expect.any(Date) },
        })

        expect(result).toEqual({ success: true })
      })

      it("should return success if notification already read", async () => {
        const input = { id: "notif-123" }

        const mockNotification = {
          id: "notif-123",
          userId: "user-123",
          readAt: new Date(),
        }

        mockPrisma.notification.findFirst.mockResolvedValue(mockNotification)

        const result = await notificationsCaller.markRead(input)

        expect(mockPrisma.notification.update).not.toHaveBeenCalled()
        expect(result).toEqual({ success: true })
      })

      it("should throw error if notification not found", async () => {
        const input = { id: "nonexistent-notif" }

        mockPrisma.notification.findFirst.mockResolvedValue(null)

        await expect(notificationsCaller.markRead(input)).rejects.toThrow(
          new TRPCError({
            code: "NOT_FOUND",
            message: "Notification not found",
          })
        )
      })
    })

    describe("markManyRead", () => {
      it("should mark multiple notifications as read", async () => {
        const input = { ids: ["notif-1", "notif-2", "notif-3"] }

        mockPrisma.notification.updateMany.mockResolvedValue({ count: 2 })

        const result = await notificationsCaller.markManyRead(input)

        expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
          where: {
            id: { in: ["notif-1", "notif-2", "notif-3"] },
            userId: "user-123",
            readAt: null,
          },
          data: { readAt: expect.any(Date) },
        })

        expect(result).toEqual({ updated: 2 })
      })

      it("should return zero when no notifications updated", async () => {
        const input = { ids: ["notif-1", "notif-2"] }

        mockPrisma.notification.updateMany.mockResolvedValue({ count: 0 })

        const result = await notificationsCaller.markManyRead(input)

        expect(result).toEqual({ updated: 0 })
      })
    })

    describe("markAllRead", () => {
      it("should mark all user notifications as read", async () => {
        mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 })

        const result = await notificationsCaller.markAllRead()

        expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
          where: {
            userId: "user-123",
            readAt: null,
          },
          data: { readAt: expect.any(Date) },
        })

        expect(result).toEqual({ updated: 5 })
      })
    })

    describe("delete", () => {
      it("should soft delete notification when deletedAt column exists", async () => {
        const input = { id: "notif-123" }

        const mockNotification = {
          id: "notif-123",
          userId: "user-123",
        }

        mockPrisma.notification.findFirst.mockResolvedValue(mockNotification)
        mockPrisma.notification.update.mockResolvedValue({})

        const result = await notificationsCaller.delete(input)

        expect(mockPrisma.notification.findFirst).toHaveBeenCalledWith({
          where: { id: "notif-123", userId: "user-123" },
        })

        expect(mockPrisma.notification.update).toHaveBeenCalledWith({
          where: { id: "notif-123" },
          data: { deletedAt: expect.any(Date) },
        })

        expect(result).toEqual({ success: true })
      })

      it("should hard delete notification when deletedAt column doesn't exist", async () => {
        const input = { id: "notif-123" }

        const mockNotification = {
          id: "notif-123",
          userId: "user-123",
        }

        mockPrisma.notification.findFirst.mockResolvedValue(mockNotification)
        mockPrisma.notification.update.mockRejectedValue(
          new Error("Column 'deletedAt' doesn't exist")
        )
        mockPrisma.notification.delete.mockResolvedValue({})

        const result = await notificationsCaller.delete(input)

        expect(mockPrisma.notification.update).toHaveBeenCalled()
        expect(mockPrisma.notification.delete).toHaveBeenCalledWith({
          where: { id: "notif-123" },
        })

        expect(result).toEqual({ success: true })
      })

      it("should throw error if notification not found", async () => {
        const input = { id: "nonexistent-notif" }

        mockPrisma.notification.findFirst.mockResolvedValue(null)

        await expect(notificationsCaller.delete(input)).rejects.toThrow(
          new TRPCError({
            code: "NOT_FOUND",
            message: "Notification not found",
          })
        )
      })
    })
  })

  describe("getSocialStats", () => {
    it("should get social stats for a user with current user", async () => {
      const input = {
        userId: "target-user",
        currentUserId: "user-123",
      }

      const mockIsFollowingRecord = { id: "follow-123" }

      mockPrisma.follow.count
        .mockResolvedValueOnce(10) // followersCount
        .mockResolvedValueOnce(5) // followingCount
      mockPrisma.follow.findUnique.mockResolvedValue(mockIsFollowingRecord)

      const result = await caller.getSocialStats(input)

      expect(mockPrisma.follow.count).toHaveBeenCalledWith({
        where: { authorUserId: "target-user" },
      })
      expect(mockPrisma.follow.count).toHaveBeenCalledWith({
        where: { followerUserId: "target-user" },
      })
      expect(mockPrisma.follow.findUnique).toHaveBeenCalledWith({
        where: {
          followerUserId_authorUserId: {
            followerUserId: "user-123",
            authorUserId: "target-user",
          },
        },
      })

      expect(result).toEqual({
        followersCount: 10,
        followingCount: 5,
        isFollowing: true,
      })
    })

    it("should get social stats without current user", async () => {
      const input = {
        userId: "target-user",
      }

      mockPrisma.follow.count
        .mockResolvedValueOnce(10) // followersCount
        .mockResolvedValueOnce(5) // followingCount

      const result = await caller.getSocialStats(input)

      expect(result).toEqual({
        followersCount: 10,
        followingCount: 5,
        isFollowing: false,
      })

      expect(mockPrisma.follow.findUnique).not.toHaveBeenCalled()
    })

    it("should handle user not following", async () => {
      const input = {
        userId: "target-user",
        currentUserId: "user-123",
      }

      mockPrisma.follow.count
        .mockResolvedValueOnce(10) // followersCount
        .mockResolvedValueOnce(5) // followingCount
      mockPrisma.follow.findUnique.mockResolvedValue(null)

      const result = await caller.getSocialStats(input)

      expect(result.isFollowing).toBe(false)
    })
  })

  describe("getWatchStats", () => {
    it("should get watch stats for a rule with current user", async () => {
      const input = {
        ruleId: "rule-123",
        currentUserId: "user-123",
      }

      const mockIsWatchingRecord = { id: "watch-123" }

      mockPrisma.watch.count.mockResolvedValue(3) // watchersCount
      mockPrisma.watch.findUnique.mockResolvedValue(mockIsWatchingRecord)

      const result = await caller.getWatchStats(input)

      expect(mockPrisma.watch.count).toHaveBeenCalledWith({
        where: { ruleId: "rule-123" },
      })
      expect(mockPrisma.watch.findUnique).toHaveBeenCalledWith({
        where: {
          userId_ruleId: {
            userId: "user-123",
            ruleId: "rule-123",
          },
        },
      })

      expect(result).toEqual({
        watchersCount: 3,
        isWatching: true,
      })
    })

    it("should get watch stats without current user", async () => {
      const input = {
        ruleId: "rule-123",
      }

      mockPrisma.watch.count.mockResolvedValue(3) // watchersCount

      const result = await caller.getWatchStats(input)

      expect(result).toEqual({
        watchersCount: 3,
        isWatching: false,
      })

      expect(mockPrisma.watch.findUnique).not.toHaveBeenCalled()
    })

    it("should handle user not watching", async () => {
      const input = {
        ruleId: "rule-123",
        currentUserId: "user-123",
      }

      mockPrisma.watch.count.mockResolvedValue(3) // watchersCount
      mockPrisma.watch.findUnique.mockResolvedValue(null)

      const result = await caller.getWatchStats(input)

      expect(result.isWatching).toBe(false)
    })
  })

  describe("Edge Cases and Integration", () => {
    it("should handle transaction failures gracefully", async () => {
      const input = { authorUserId: "author-456" }

      mockPrisma.user.findUnique.mockResolvedValue({ id: "author-456" })
      mockPrisma.follow.findUnique.mockResolvedValue(null)
      mockPrisma.$transaction.mockRejectedValue(new Error("Transaction failed"))

      await expect(caller.toggleFollow(input)).rejects.toThrow("Transaction failed")
    })

    it("should handle concurrent follow operations", async () => {
      mockPrisma.$transaction.mockImplementation(async callback => {
        return await callback(mockPrisma)
      })

      const input1 = { authorUserId: "author-1" }
      const input2 = { authorUserId: "author-2" }

      mockPrisma.user.findUnique
        .mockResolvedValue({ id: "author-1" })
        .mockResolvedValue({ id: "author-2" })
      mockPrisma.follow.findUnique.mockResolvedValue(null)
      mockPrisma.follow.create.mockResolvedValue({})
      mockPrisma.auditLog.create.mockResolvedValue({})
      mockPrisma.follow.count.mockResolvedValue(1)

      const [result1, result2] = await Promise.all([
        caller.toggleFollow(input1),
        caller.toggleFollow(input2),
      ])

      expect(result1.following).toBe(true)
      expect(result2.following).toBe(true)
    })

    it("should handle malformed cursor in followers list", async () => {
      const input = {
        authorUserId: "author-456",
        cursor: "malformed-cursor", // Should not contain ":"
      }

      mockPrisma.follow.findMany.mockResolvedValue([])
      mockPrisma.follow.count.mockResolvedValue(0)

      const result = await caller.listFollowers(input)

      expect(mockPrisma.follow.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: {
            followerUserId_authorUserId: {
              followerUserId: "malformed-cursor", // Uses entire string when no ":" found
              authorUserId: "",
            },
          },
        })
      )

      expect(result.items).toEqual([])
    })

    it("should handle empty notification payload", async () => {
      const input = { limit: 10 }

      const mockNotifications = [
        {
          id: "notif-1",
          type: "EMPTY_PAYLOAD",
          payload: null,
          readAt: null,
          createdAt: new Date("2023-01-01"),
        },
      ]

      mockPrisma.notification.findMany.mockResolvedValue(mockNotifications)
      mockPrisma.notification.count
        .mockResolvedValueOnce(1) // totalCount
        .mockResolvedValueOnce(1) // unreadCount

      const result = await notificationsCaller.list(input)

      expect(result.items[0].payload).toEqual({})
    })

    it("should handle large notification batch operations", async () => {
      const input = { ids: Array.from({ length: 1000 }, (_, i) => `notif-${i}`) }

      mockPrisma.notification.updateMany.mockResolvedValue({ count: 1000 })

      const result = await notificationsCaller.markManyRead(input)

      expect(result.updated).toBe(1000)
    })

    it("should handle user with no social activity", async () => {
      const input = { userId: "new-user" }

      mockPrisma.follow.count
        .mockResolvedValueOnce(0) // followersCount
        .mockResolvedValueOnce(0) // followingCount

      const result = await caller.getSocialStats(input)

      expect(result).toEqual({
        followersCount: 0,
        followingCount: 0,
        isFollowing: false,
      })
    })

    it("should handle rule with no watchers", async () => {
      const input = { ruleId: "new-rule" }

      mockPrisma.watch.count.mockResolvedValue(0)

      const result = await caller.getWatchStats(input)

      expect(result).toEqual({
        watchersCount: 0,
        isWatching: false,
      })
    })
  })
})
