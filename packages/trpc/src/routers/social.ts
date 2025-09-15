import { z } from "zod"
import { TRPCError } from "@trpc/server"
import {
  router,
  publicProcedure,
  protectedProcedure,
  rateLimitedProcedure,
  rateLimit,
} from "../trpc"
import {
  toggleFollowInputSchema,
  toggleWatchInputSchema,
  listFollowersInputSchema,
  listFollowingInputSchema,
  notificationsListInputSchema,
  markReadInputSchema,
  markManyReadInputSchema,
  deleteNotificationInputSchema,
  followResponseSchema,
  watchResponseSchema,
  followersListResponseSchema,
  followingListResponseSchema,
  notificationsListResponseSchema,
  unreadCountResponseSchema,
  markReadResponseSchema,
  markManyReadResponseSchema,
  deleteNotificationResponseSchema,
} from "../schemas/social"
import { Notifications } from "../services/notify"

// Rate limited procedures
const followRateLimitedProcedure = protectedProcedure.use(rateLimit("follow", 30, 60 * 1000))
const watchRateLimitedProcedure = protectedProcedure.use(rateLimit("watch", 60, 60 * 1000))
const notificationsRateLimitedProcedure = protectedProcedure.use(
  rateLimit("notifications", 120, 60 * 1000)
)
const markAllReadRateLimitedProcedure = protectedProcedure.use(
  rateLimit("markAllRead", 10, 60 * 1000)
)

export const socialRouter = router({
  // Follow functionality
  toggleFollow: followRateLimitedProcedure
    .input(toggleFollowInputSchema)
    .output(followResponseSchema)
    .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
      const { authorUserId } = input
      const userId = ctx.user!.id

      // Prevent following self
      if (authorUserId === userId) {
        // Return current state without changes
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

      const result = await ctx.prisma.$transaction(async (tx: any) => {
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

          // Create audit log
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

          // Create audit log
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
    }),

  // Watch functionality
  toggleWatch: watchRateLimitedProcedure
    .input(toggleWatchInputSchema)
    .output(watchResponseSchema)
    .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
      const { ruleId } = input
      const userId = ctx.user!.id

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

      const result = await ctx.prisma.$transaction(async (tx: any) => {
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

          // Create audit log
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

          // Create audit log
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

        // Get updated watcher count
        const watchersCount = await tx.watch.count({ where: { ruleId } })

        return {
          watching: !existingWatch,
          watchersCount,
        }
      })

      return result
    }),

  // List followers
  listFollowers: publicProcedure
    .input(listFollowersInputSchema)
    .output(followersListResponseSchema)
    .query(async ({ input, ctx }) => {
      const { authorUserId, cursor, limit } = input

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
          ? `${items[items.length - 1]?.followerUserId}:${items[items.length - 1]?.authorUserId}`
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
          isVerified: false, // Default value since field doesn't exist in schema
          followedAt: new Date(), // Default value since field doesn't exist in schema
        })),
        nextCursor,
        hasMore,
        totalCount,
      }
    }),

  // List following
  listFollowing: publicProcedure
    .input(listFollowingInputSchema)
    .output(followingListResponseSchema)
    .query(async ({ input, ctx }) => {
      const { userId, cursor, limit } = input

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
          ? `${items[items.length - 1]?.followerUserId}:${items[items.length - 1]?.authorUserId}`
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
          isVerified: false, // Default value since field doesn't exist in schema
          followedAt: new Date(), // Default value since field doesn't exist in schema
        })),
        nextCursor,
        hasMore,
        totalCount,
      }
    }),

  // Notifications
  notifications: router({
    list: protectedProcedure
      .input(notificationsListInputSchema)
      .output(notificationsListResponseSchema)
      .query(async ({ input, ctx }) => {
        const { cursor, limit, filter } = input
        const userId = ctx.user!.id

        const whereClause: any = { userId }
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
          items: items.map(notification => {
            const parsed = Notifications.parseNotificationForUI(notification)
            return {
              id: notification.id,
              type: notification.type as any,
              payload: (notification.payload as Record<string, unknown>) || {},
              readAt: notification.readAt,
              createdAt: notification.createdAt,
              ...parsed,
            }
          }),
          nextCursor,
          hasMore,
          totalCount,
          unreadCount,
        }
      }),

    unreadCount: protectedProcedure.output(unreadCountResponseSchema).query(async ({ ctx }) => {
      const count = await ctx.prisma.notification.count({
        where: {
          userId: ctx.user!.id,
          readAt: null,
        },
      })

      return { count }
    }),

    markRead: notificationsRateLimitedProcedure
      .input(markReadInputSchema)
      .output(markReadResponseSchema)
      .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
        const { id } = input
        const userId = ctx.user!.id

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
          return { success: true } // Already read
        }

        await ctx.prisma.notification.update({
          where: { id },
          data: { readAt: new Date() },
        })

        return { success: true }
      }),

    markManyRead: notificationsRateLimitedProcedure
      .input(markManyReadInputSchema)
      .output(markManyReadResponseSchema)
      .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
        const { ids } = input
        const userId = ctx.user!.id

        const result = await ctx.prisma.notification.updateMany({
          where: {
            id: { in: ids },
            userId,
            readAt: null, // Only update unread notifications
          },
          data: { readAt: new Date() },
        })

        return { updated: result.count }
      }),

    markAllRead: markAllReadRateLimitedProcedure
      .output(markManyReadResponseSchema)
      .mutation(async ({ ctx }: { ctx: any }) => {
        const userId = ctx.user!.id

        const result = await ctx.prisma.notification.updateMany({
          where: {
            userId,
            readAt: null,
          },
          data: { readAt: new Date() },
        })

        return { updated: result.count }
      }),

    delete: notificationsRateLimitedProcedure
      .input(deleteNotificationInputSchema)
      .output(deleteNotificationResponseSchema)
      .mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
        const { id } = input
        const userId = ctx.user!.id

        const notification = await ctx.prisma.notification.findFirst({
          where: { id, userId },
        })

        if (!notification) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Notification not found",
          })
        }

        // Soft delete if deletedAt column exists, otherwise hard delete
        try {
          await ctx.prisma.notification.update({
            where: { id },
            data: { deletedAt: new Date() },
          })
        } catch (error) {
          // If deletedAt column doesn't exist, do hard delete
          await ctx.prisma.notification.delete({
            where: { id },
          })
        }

        return { success: true }
      }),
  }),

  // Get social stats for a user
  getSocialStats: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        currentUserId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
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
    }),

  // Get watch stats for a rule
  getWatchStats: publicProcedure
    .input(
      z.object({
        ruleId: z.string(),
        currentUserId: z.string().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
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
    }),
})
