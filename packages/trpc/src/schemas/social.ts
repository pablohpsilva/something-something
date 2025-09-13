import { z } from "zod";
import {
  userIdSchema,
  ruleIdSchema,
  paginationSchema,
  idempotencyKeySchema,
} from "./base";

// Follow author schema
export const followAuthorSchema = z.object({
  authorUserId: userIdSchema,
  idempotencyKey: idempotencyKeySchema,
});

export type FollowAuthorInput = z.infer<typeof followAuthorSchema>;

// Unfollow author schema
export const unfollowAuthorSchema = z.object({
  authorUserId: userIdSchema,
  idempotencyKey: idempotencyKeySchema,
});

export type UnfollowAuthorInput = z.infer<typeof unfollowAuthorSchema>;

// Watch rule schema
export const watchRuleSchema = z.object({
  ruleId: ruleIdSchema,
  idempotencyKey: idempotencyKeySchema,
});

export type WatchRuleInput = z.infer<typeof watchRuleSchema>;

// Unwatch rule schema
export const unwatchRuleSchema = z.object({
  ruleId: ruleIdSchema,
  idempotencyKey: idempotencyKeySchema,
});

export type UnwatchRuleInput = z.infer<typeof unwatchRuleSchema>;

// Favorite rule schema
export const favoriteRuleSchema = z.object({
  ruleId: ruleIdSchema,
  idempotencyKey: idempotencyKeySchema,
});

export type FavoriteRuleInput = z.infer<typeof favoriteRuleSchema>;

// Unfavorite rule schema
export const unfavoriteRuleSchema = z.object({
  ruleId: ruleIdSchema,
  idempotencyKey: idempotencyKeySchema,
});

export type UnfavoriteRuleInput = z.infer<typeof unfavoriteRuleSchema>;

// List notifications schema
export const listNotificationsSchema = z.object({
  ...paginationSchema.shape,
  unreadOnly: z.boolean().default(false),
  types: z
    .array(
      z.enum([
        "NEW_VERSION",
        "COMMENT_REPLY",
        "AUTHOR_PUBLISHED",
        "CLAIM_VERDICT",
        "DONATION_RECEIVED",
      ])
    )
    .optional(),
});

export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;

// Mark notification read schema
export const markNotificationReadSchema = z.object({
  notificationId: z.string(),
  idempotencyKey: idempotencyKeySchema,
});

export type MarkNotificationReadInput = z.infer<
  typeof markNotificationReadSchema
>;

// Mark all notifications read schema
export const markAllNotificationsReadSchema = z.object({
  beforeDate: z.date().optional(),
  idempotencyKey: idempotencyKeySchema,
});

export type MarkAllNotificationsReadInput = z.infer<
  typeof markAllNotificationsReadSchema
>;

// Get followers schema
export const getFollowersSchema = z.object({
  authorUserId: userIdSchema,
  ...paginationSchema.shape,
});

export type GetFollowersInput = z.infer<typeof getFollowersSchema>;

// Get following schema
export const getFollowingSchema = z.object({
  userId: userIdSchema,
  ...paginationSchema.shape,
});

export type GetFollowingInput = z.infer<typeof getFollowingSchema>;

// Get favorites schema
export const getFavoritesSchema = z.object({
  userId: userIdSchema.optional(), // If not provided, uses current user
  ...paginationSchema.shape,
  sort: z.enum(["new", "old"]).default("new"),
});

export type GetFavoritesInput = z.infer<typeof getFavoritesSchema>;

// Get watched rules schema
export const getWatchedRulesSchema = z.object({
  ...paginationSchema.shape,
  sort: z.enum(["new", "old", "activity"]).default("activity"),
});

export type GetWatchedRulesInput = z.infer<typeof getWatchedRulesSchema>;

// Get social stats schema
export const getSocialStatsSchema = z.object({
  userId: userIdSchema.optional(), // If not provided, uses current user
});

export type GetSocialStatsInput = z.infer<typeof getSocialStatsSchema>;

// Get rule social info schema
export const getRuleSocialInfoSchema = z.object({
  ruleId: ruleIdSchema,
  includeUserActions: z.boolean().default(false),
});

export type GetRuleSocialInfoInput = z.infer<typeof getRuleSocialInfoSchema>;
