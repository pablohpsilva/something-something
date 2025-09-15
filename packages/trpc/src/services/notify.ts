/**
 * Notifications service for fanout to users
 * Handles creation of notifications for various social events
 */

import { prisma } from "@repo/db"
import type { NotificationType } from "@repo/db"

// Notification payload types
export interface NotifyNewVersionParams {
  ruleId: string
  ruleSlug: string
  versionId: string
  version: string
  authorId: string
  authorHandle: string
  authorDisplayName: string
}

export interface NotifyCommentReplyParams {
  ruleId: string
  ruleSlug: string
  commentId: string
  parentAuthorId?: string
  actorUserId: string
  actorHandle: string
  actorDisplayName: string
}

export interface NotifyAuthorPublishedParams {
  ruleId: string
  ruleSlug: string
  ruleTitle: string
  authorId: string
  authorHandle: string
  authorDisplayName: string
}

export interface NotifyClaimVerdictParams {
  userId: string
  ruleId: string
  ruleSlug: string
  ruleTitle: string
  verdict: "APPROVED" | "REJECTED"
  reviewerHandle?: string
}

export interface NotifyDonationReceivedParams {
  toUserId: string
  donationId: string
  amountCents: number
  currency: string
  fromUserId?: string
  fromUserHandle?: string
  fromUserDisplayName?: string
  ruleId?: string
  ruleSlug?: string
}

/**
 * Notifications service with fanout helpers
 */
export const Notifications = {
  /**
   * Notify watchers when a new version is published
   */
  async newVersion(params: NotifyNewVersionParams): Promise<number> {
    try {
      // Get all watchers of the rule (excluding the author)
      const watchers = await prisma.watch.findMany({
        where: {
          ruleId: params.ruleId,
          userId: { not: params.authorId },
        },
        select: { userId: true },
      })

      const userIds = [...new Set(watchers.map(w => w.userId))]

      if (userIds.length === 0) {
        return 0
      }

      // Create notifications for all watchers
      await prisma.notification.createMany({
        data: userIds.map(userId => ({
          userId,
          type: "NEW_VERSION" as NotificationType,
          payload: {
            ruleId: params.ruleId,
            ruleSlug: params.ruleSlug,
            versionId: params.versionId,
            version: params.version,
            author: {
              id: params.authorId,
              handle: params.authorHandle,
              displayName: params.authorDisplayName,
            },
          },
        })),
      })

      return userIds.length
    } catch (error) {
      console.error("Failed to create new version notifications:", error)
      return 0
    }
  },

  /**
   * Notify parent comment author and watchers when someone replies
   */
  async commentReply(params: NotifyCommentReplyParams): Promise<number> {
    try {
      const recipients = new Set<string>()

      // Add parent comment author (if exists and not the actor)
      if (params.parentAuthorId && params.parentAuthorId !== params.actorUserId) {
        recipients.add(params.parentAuthorId)
      }

      // Add rule watchers (exclude actor)
      const watchers = await prisma.watch.findMany({
        where: {
          ruleId: params.ruleId,
          userId: { not: params.actorUserId },
        },
        select: { userId: true },
      })

      for (const watcher of watchers) {
        if (watcher.userId !== params.actorUserId) {
          recipients.add(watcher.userId)
        }
      }

      if (recipients.size === 0) {
        return 0
      }

      // Create notifications for all recipients
      await prisma.notification.createMany({
        data: [...recipients].map(userId => ({
          userId,
          type: "COMMENT_REPLY" as NotificationType,
          payload: {
            ruleId: params.ruleId,
            ruleSlug: params.ruleSlug,
            commentId: params.commentId,
            parentId: params.parentAuthorId || null,
            actor: {
              id: params.actorUserId,
              handle: params.actorHandle,
              displayName: params.actorDisplayName,
            },
          },
        })),
      })

      return recipients.size
    } catch (error) {
      console.error("Failed to create comment reply notifications:", error)
      return 0
    }
  },

  /**
   * Notify followers when an author publishes a new rule
   */
  async authorPublished(params: NotifyAuthorPublishedParams): Promise<number> {
    try {
      // Get all followers of the author
      const followers = await prisma.follow.findMany({
        where: { authorUserId: params.authorId },
        select: { followerUserId: true },
      })

      const userIds = followers.map(f => f.followerUserId)

      if (userIds.length === 0) {
        return 0
      }

      // Create notifications for all followers
      await prisma.notification.createMany({
        data: userIds.map(userId => ({
          userId,
          type: "AUTHOR_PUBLISHED" as NotificationType,
          payload: {
            ruleId: params.ruleId,
            ruleSlug: params.ruleSlug,
            ruleTitle: params.ruleTitle,
            author: {
              id: params.authorId,
              handle: params.authorHandle,
              displayName: params.authorDisplayName,
            },
          },
        })),
      })

      return userIds.length
    } catch (error) {
      console.error("Failed to create author published notifications:", error)
      return 0
    }
  },

  /**
   * Notify claimant when their claim is reviewed
   */
  async claimVerdict(params: NotifyClaimVerdictParams): Promise<number> {
    try {
      await prisma.notification.create({
        data: {
          userId: params.userId,
          type: "CLAIM_VERDICT" as NotificationType,
          payload: {
            ruleId: params.ruleId,
            ruleSlug: params.ruleSlug,
            ruleTitle: params.ruleTitle,
            verdict: params.verdict,
            reviewer: params.reviewerHandle
              ? {
                  handle: params.reviewerHandle,
                }
              : null,
          },
        },
      })

      return 1
    } catch (error) {
      console.error("Failed to create claim verdict notification:", error)
      return 0
    }
  },

  /**
   * Notify user when they receive a donation
   */
  async donationReceived(params: NotifyDonationReceivedParams): Promise<number> {
    try {
      await prisma.notification.create({
        data: {
          userId: params.toUserId,
          type: "DONATION_RECEIVED" as NotificationType,
          payload: {
            donationId: params.donationId,
            amountCents: params.amountCents,
            currency: params.currency,
            fromUser: params.fromUserId
              ? {
                  id: params.fromUserId,
                  handle: params.fromUserHandle,
                  displayName: params.fromUserDisplayName,
                }
              : null,
            rule: params.ruleId
              ? {
                  id: params.ruleId,
                  slug: params.ruleSlug,
                }
              : null,
          },
        },
      })

      return 1
    } catch (error) {
      console.error("Failed to create donation received notification:", error)
      return 0
    }
  },

  /**
   * Parse notification payload for UI display
   */
  parseNotificationForUI(notification: {
    id: string
    type: NotificationType
    payload: any
    readAt: Date | null
    createdAt: Date
  }): {
    title: string
    message: string
    actionUrl?: string
    actor?: {
      id: string
      handle: string
      displayName: string
      avatarUrl: string | null
    }
  } {
    const { type, payload } = notification

    switch (type) {
      case "NEW_VERSION":
        return {
          title: "New Version Published",
          message: `Version ${payload.version} of ${payload.ruleSlug} is now available`,
          actionUrl: `/rules/${payload.ruleSlug}/versions/${payload.versionId}`,
          actor: payload.author
            ? {
                id: payload.author.id,
                handle: payload.author.handle,
                displayName: payload.author.displayName,
                avatarUrl: null, // Would need to fetch from user table
              }
            : undefined,
        }

      case "COMMENT_REPLY":
        return {
          title: "New Reply",
          message: `${
            payload.actor?.displayName || "Someone"
          } replied to a comment on ${payload.ruleSlug}`,
          actionUrl: `/rules/${payload.ruleSlug}#comment-${payload.commentId}`,
          actor: payload.actor
            ? {
                id: payload.actor.id,
                handle: payload.actor.handle,
                displayName: payload.actor.displayName,
                avatarUrl: null,
              }
            : undefined,
        }

      case "AUTHOR_PUBLISHED":
        return {
          title: "New Rule Published",
          message: `${
            payload.author?.displayName || "An author you follow"
          } published "${payload.ruleTitle}"`,
          actionUrl: `/rules/${payload.ruleSlug}`,
          actor: payload.author
            ? {
                id: payload.author.id,
                handle: payload.author.handle,
                displayName: payload.author.displayName,
                avatarUrl: null,
              }
            : undefined,
        }

      case "CLAIM_VERDICT":
        return {
          title: `Claim ${payload.verdict}`,
          message: `Your claim on "${payload.ruleTitle}" was ${payload.verdict.toLowerCase()}`,
          actionUrl: `/rules/${payload.ruleSlug}`,
        }

      case "DONATION_RECEIVED":
        const amount = (payload.amountCents / 100).toFixed(2)
        const fromUser = payload.fromUser?.displayName || "Anonymous"
        return {
          title: "Donation Received",
          message: `You received ${payload.currency} ${amount} from ${fromUser}`,
          actionUrl: payload.rule ? `/rules/${payload.rule.slug}` : "/donations",
          actor: payload.fromUser
            ? {
                id: payload.fromUser.id,
                handle: payload.fromUser.handle,
                displayName: payload.fromUser.displayName,
                avatarUrl: null,
              }
            : undefined,
        }

      default:
        return {
          title: "Notification",
          message: "You have a new notification",
        }
    }
  },
}
