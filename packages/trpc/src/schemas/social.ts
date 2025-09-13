import { z } from "zod";
import { cuidOrUuidSchema } from "./base";

/**
 * Toggle follow input schema
 */
export const toggleFollowInputSchema = z.object({
  authorUserId: cuidOrUuidSchema,
});

/**
 * Toggle watch input schema
 */
export const toggleWatchInputSchema = z.object({
  ruleId: cuidOrUuidSchema,
});

/**
 * List followers input schema
 */
export const listFollowersInputSchema = z.object({
  authorUserId: cuidOrUuidSchema,
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

/**
 * List following input schema
 */
export const listFollowingInputSchema = z.object({
  userId: cuidOrUuidSchema,
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

/**
 * Notifications list input schema
 */
export const notificationsListInputSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(30),
  filter: z.enum(["all", "unread"]).default("all"),
});

/**
 * Mark notification as read input schema
 */
export const markReadInputSchema = z.object({
  id: cuidOrUuidSchema,
});

/**
 * Mark many notifications as read input schema
 */
export const markManyReadInputSchema = z.object({
  ids: z.array(cuidOrUuidSchema).min(1).max(200),
});

/**
 * Delete notification input schema
 */
export const deleteNotificationInputSchema = z.object({
  id: cuidOrUuidSchema,
});

/**
 * Follow response schema
 */
export const followResponseSchema = z.object({
  following: z.boolean(),
  followersCount: z.number().int(),
  followingCount: z.number().int(),
});

/**
 * Watch response schema
 */
export const watchResponseSchema = z.object({
  watching: z.boolean(),
  watchersCount: z.number().int(),
});

/**
 * Followers list response schema
 */
export const followersListResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      handle: z.string(),
      displayName: z.string(),
      avatarUrl: z.string().nullable(),
      isVerified: z.boolean().optional(),
      followedAt: z.date(),
    })
  ),
  nextCursor: z.string().optional(),
  hasMore: z.boolean(),
  totalCount: z.number().int(),
});

/**
 * Following list response schema
 */
export const followingListResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      handle: z.string(),
      displayName: z.string(),
      avatarUrl: z.string().nullable(),
      isVerified: z.boolean().optional(),
      followedAt: z.date(),
    })
  ),
  nextCursor: z.string().optional(),
  hasMore: z.boolean(),
  totalCount: z.number().int(),
});

/**
 * Notifications list response schema
 */
export const notificationsListResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      type: z.enum([
        "NEW_VERSION",
        "COMMENT_REPLY",
        "AUTHOR_PUBLISHED",
        "CLAIM_VERDICT",
        "DONATION_RECEIVED",
      ]),
      payload: z.record(z.unknown()),
      readAt: z.date().nullable(),
      createdAt: z.date(),
      // Parsed fields for easier UI rendering
      title: z.string().optional(),
      message: z.string().optional(),
      actionUrl: z.string().optional(),
      actor: z
        .object({
          id: z.string(),
          handle: z.string(),
          displayName: z.string(),
          avatarUrl: z.string().nullable(),
        })
        .optional(),
    })
  ),
  nextCursor: z.string().optional(),
  hasMore: z.boolean(),
  totalCount: z.number().int(),
  unreadCount: z.number().int(),
});

/**
 * Unread count response schema
 */
export const unreadCountResponseSchema = z.object({
  count: z.number().int(),
});

/**
 * Mark read response schema
 */
export const markReadResponseSchema = z.object({
  success: z.boolean(),
});

/**
 * Mark many read response schema
 */
export const markManyReadResponseSchema = z.object({
  updated: z.number().int(),
});

/**
 * Delete notification response schema
 */
export const deleteNotificationResponseSchema = z.object({
  success: z.boolean(),
});

// Type exports
export type ToggleFollowInput = z.infer<typeof toggleFollowInputSchema>;
export type ToggleWatchInput = z.infer<typeof toggleWatchInputSchema>;
export type ListFollowersInput = z.infer<typeof listFollowersInputSchema>;
export type ListFollowingInput = z.infer<typeof listFollowingInputSchema>;
export type NotificationsListInput = z.infer<
  typeof notificationsListInputSchema
>;
export type MarkReadInput = z.infer<typeof markReadInputSchema>;
export type MarkManyReadInput = z.infer<typeof markManyReadInputSchema>;
export type DeleteNotificationInput = z.infer<
  typeof deleteNotificationInputSchema
>;

export type FollowResponse = z.infer<typeof followResponseSchema>;
export type WatchResponse = z.infer<typeof watchResponseSchema>;
export type FollowersListResponse = z.infer<typeof followersListResponseSchema>;
export type FollowingListResponse = z.infer<typeof followingListResponseSchema>;
export type NotificationsListResponse = z.infer<
  typeof notificationsListResponseSchema
>;
export type UnreadCountResponse = z.infer<typeof unreadCountResponseSchema>;
export type MarkReadResponse = z.infer<typeof markReadResponseSchema>;
export type MarkManyReadResponse = z.infer<typeof markManyReadResponseSchema>;
export type DeleteNotificationResponse = z.infer<
  typeof deleteNotificationResponseSchema
>;
