import { z } from "zod";
import {
  ruleIdSchema,
  ruleVersionIdSchema,
  userIdSchema,
  commentIdSchema,
  claimIdSchema,
  handleSchema,
  slugSchema,
  titleSchema,
  summarySchema,
  bodySchema,
  contentTypeSchema,
  statusFilterSchema,
  userRoleSchema,
  claimStatusSchema,
  notificationTypeSchema,
  leaderboardPeriodSchema,
  leaderboardScopeSchema,
  resourceLinkSchema,
  testedOnSchema,
} from "./base";

// Author DTO
export const authorDTOSchema = z.object({
  id: userIdSchema,
  handle: handleSchema,
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  role: userRoleSchema,
  isVerified: z.boolean().optional(),
});

export type AuthorDTO = z.infer<typeof authorDTOSchema>;

// Tag DTO
export const tagDTOSchema = z.object({
  id: z.string(),
  slug: slugSchema,
  name: z.string(),
  count: z.number().int().optional(),
});

export type TagDTO = z.infer<typeof tagDTOSchema>;

// Rule version summary DTO
export const ruleVersionSummaryDTOSchema = z.object({
  id: ruleVersionIdSchema,
  version: z.string(),
  testedOn: testedOnSchema.nullable(),
  createdAt: z.date(),
});

export type RuleVersionSummaryDTO = z.infer<typeof ruleVersionSummaryDTOSchema>;

// Rule metrics DTO
export const ruleMetricsDTOSchema = z.object({
  views7: z.number().int(),
  copies7: z.number().int(),
  saves7: z.number().int(),
  forks7: z.number().int(),
  score: z.number(),
});

export type RuleMetricsDTO = z.infer<typeof ruleMetricsDTOSchema>;

// Rule card DTO (for lists)
export const ruleCardDTOSchema = z.object({
  id: ruleIdSchema,
  slug: slugSchema,
  title: titleSchema,
  summary: summarySchema,
  contentType: contentTypeSchema,
  status: statusFilterSchema,
  primaryModel: z.string().nullable(),
  tags: z.array(tagDTOSchema),
  score: z.number(),
  author: authorDTOSchema,
  currentVersion: ruleVersionSummaryDTOSchema.nullable(),
  metrics: ruleMetricsDTOSchema,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type RuleCardDTO = z.infer<typeof ruleCardDTOSchema>;

// Rule detail DTO (for individual rule pages)
export const ruleDetailDTOSchema = ruleCardDTOSchema.extend({
  body: bodySchema.nullable(),
  resourceLinks: z.array(resourceLinkSchema),
  versionsCount: z.number().int(),
  commentsCount: z.number().int(),
  votesCount: z.number().int(),
  favoritesCount: z.number().int(),
  watchersCount: z.number().int(),
  userVote: z.enum(["up", "down"]).nullable().optional(),
  userFavorited: z.boolean().optional(),
  userWatching: z.boolean().optional(),
});

export type RuleDetailDTO = z.infer<typeof ruleDetailDTOSchema>;

// Rule version detail DTO
export const ruleVersionDetailDTOSchema = z.object({
  id: ruleVersionIdSchema,
  ruleId: ruleIdSchema,
  version: z.string(),
  body: bodySchema,
  testedOn: testedOnSchema.nullable(),
  changelog: z.string().nullable(),
  parentVersionId: ruleVersionIdSchema.nullable(),
  createdBy: authorDTOSchema,
  createdAt: z.date(),
  score: z.number().optional(),
  userVote: z.enum(["up", "down"]).nullable().optional(),
});

export type RuleVersionDetailDTO = z.infer<typeof ruleVersionDetailDTOSchema>;

// Comment DTO
export const commentDTOSchema = z.object({
  id: commentIdSchema,
  ruleId: ruleIdSchema,
  parentId: commentIdSchema.nullable(),
  author: authorDTOSchema,
  bodyHtml: z.string().nullable(), // null if deleted, HTML-rendered
  isDeleted: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  edited: z.boolean(), // true if updatedAt > createdAt + 1min
  depth: z.number().min(0),
  children: z.array(z.lazy(() => commentDTOSchema)).optional(),
  repliesCount: z.number().int().optional(),
  canEdit: z.boolean().optional(), // if user can edit this comment
  canDelete: z.boolean().optional(), // if user can delete this comment
});

export type CommentDTO = z.infer<typeof commentDTOSchema>;

// Notification DTO
export const notificationDTOSchema = z.object({
  id: z.string(),
  type: notificationTypeSchema,
  payload: z.record(z.unknown()),
  readAt: z.date().nullable(),
  createdAt: z.date(),
  // Parsed payload fields for common types
  title: z.string().optional(),
  message: z.string().optional(),
  actionUrl: z.string().optional(),
  actor: authorDTOSchema.optional(),
});

export type NotificationDTO = z.infer<typeof notificationDTOSchema>;

// Claim DTO
export const claimDTOSchema = z.object({
  id: claimIdSchema,
  rule: z.object({
    id: ruleIdSchema,
    slug: slugSchema,
    title: titleSchema,
  }),
  claimant: authorDTOSchema,
  status: claimStatusSchema,
  evidenceUrl: z.string().nullable(),
  createdAt: z.date(),
  reviewedBy: authorDTOSchema.nullable(),
  reviewedAt: z.date().nullable(),
  note: z.string().nullable(),
});

export type ClaimDTO = z.infer<typeof claimDTOSchema>;




// Vote summary DTO
export const voteSummaryDTOSchema = z.object({
  score: z.number().int(),
  upCount: z.number().int(),
  downCount: z.number().int(),
  myVote: z.number().min(-1).max(1), // -1, 0, or 1
});

export type VoteSummaryDTO = z.infer<typeof voteSummaryDTOSchema>;

// Metrics summary DTO
export const metricsSummaryDTOSchema = z.object({
  views: z.object({
    total: z.number().int(),
    last7Days: z.number().int(),
    last30Days: z.number().int(),
  }),
  copies: z.object({
    total: z.number().int(),
    last7Days: z.number().int(),
    last30Days: z.number().int(),
  }),
  saves: z.object({
    total: z.number().int(),
    last7Days: z.number().int(),
    last30Days: z.number().int(),
  }),
  forks: z.object({
    total: z.number().int(),
    last7Days: z.number().int(),
    last30Days: z.number().int(),
  }),
  score: z.number(),
  trend: z.enum(["up", "down", "stable"]),
});

export type MetricsSummaryDTO = z.infer<typeof metricsSummaryDTOSchema>;

// User profile DTO
export const userProfileDTOSchema = z.object({
  id: userIdSchema,
  handle: handleSchema,
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  role: userRoleSchema,
  isVerified: z.boolean(),
  createdAt: z.date(),
  stats: z.object({
    rulesCreated: z.number().int(),
    totalViews: z.number().int(),
    totalCopies: z.number().int(),
    followers: z.number().int(),
    following: z.number().int(),
  }),
  isFollowing: z.boolean().optional(),
});

export type UserProfileDTO = z.infer<typeof userProfileDTOSchema>;

// Follower DTO
export const followerDTOSchema = z.object({
  id: z.string(),
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  isVerified: z.boolean().optional(),
  followedAt: z.date(),
});

export type FollowerDTO = z.infer<typeof followerDTOSchema>;

// Enhanced Notification DTO
export const enhancedNotificationDTOSchema = z.object({
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
  // Parsed fields for UI
  title: z.string(),
  message: z.string(),
  actionUrl: z.string().optional(),
  actor: z
    .object({
      id: z.string(),
      handle: z.string(),
      displayName: z.string(),
      avatarUrl: z.string().nullable(),
    })
    .optional(),
});

export type EnhancedNotificationDTO = z.infer<
  typeof enhancedNotificationDTOSchema
>;

// Social stats DTO
export const socialStatsDTO = z.object({
  followersCount: z.number().int(),
  followingCount: z.number().int(),
  watchersCount: z.number().int().optional(),
  isFollowing: z.boolean().optional(),
  isWatching: z.boolean().optional(),
});

export type SocialStatsDTO = z.infer<typeof socialStatsDTO>;

// Leaderboard entry DTO
export const leaderboardEntryDTOSchema = z.object({
  rank: z.number().int().positive(),
  ruleId: z.string(),
  ruleSlug: z.string(),
  title: z.string(),
  author: z.object({
    id: z.string(),
    handle: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  score: z.number(),
  copies: z.number().int(),
  views: z.number().int(),
  saves: z.number().int().optional(),
  forks: z.number().int().optional(),
  votes: z.number().int().optional(),
  rankDelta: z.number().int().nullable().optional(),
});

export type LeaderboardEntryDTO = z.infer<typeof leaderboardEntryDTOSchema>;

// Badge DTO
export const badgeDTOSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  awardedAt: z.date().optional(), // present when listing user badges
});

export type BadgeDTO = z.infer<typeof badgeDTOSchema>;

// Donation DTO
export const donationDTOSchema = z.object({
  id: z.string(),
  from: z
    .object({
      id: z.string(),
      handle: z.string(),
      displayName: z.string(),
      avatarUrl: z.string().nullable(),
    })
    .nullable(),
  to: z.object({
    id: z.string(),
    handle: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  rule: z
    .object({
      id: z.string(),
      slug: z.string(),
      title: z.string(),
    })
    .nullable(),
  amountCents: z.number().int(),
  currency: z.string(),
  status: z.enum(["INIT", "SUCCEEDED", "FAILED"]),
  createdAt: z.date(),
  message: z.string().nullable(),
});

export type DonationDTO = z.infer<typeof donationDTOSchema>;

// Author donation stats DTO
export const authorDonationStatsDTOSchema = z.object({
  totalCentsAllTime: z.number().int(),
  totalCentsWindow: z.number().int(),
  countWindow: z.number().int(),
  topRules: z.array(
    z.object({
      ruleId: z.string(),
      slug: z.string(),
      title: z.string(),
      totalCents: z.number().int(),
      count: z.number().int(),
    })
  ),
  byDay: z.array(
    z.object({
      date: z.string(), // YYYY-MM-DD format
      cents: z.number().int(),
      count: z.number().int(),
    })
  ),
  recentDonors: z.array(
    z.object({
      id: z.string(),
      handle: z.string(),
      displayName: z.string(),
      avatarUrl: z.string().nullable(),
      totalCents: z.number().int(),
      lastDonationAt: z.date(),
    })
  ),
});

export type AuthorDonationStatsDTO = z.infer<
  typeof authorDonationStatsDTOSchema
>;

// Search result DTO
export const searchResultDTOSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  author: z.object({
    id: z.string(),
    handle: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  tags: z.array(z.string()),
  primaryModel: z.string().nullable(),
  status: z.string(),
  score: z.number(), // Blended FTS + trending score
  ftsRank: z.number(), // Raw text relevance
  trending: z.number(), // Normalized trending score (0-1)
  snippetHtml: z.string().nullable(), // Highlighted snippet
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SearchResultDTO = z.infer<typeof searchResultDTOSchema>;

// Search suggestion DTO
export const searchSuggestionDTOSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  similarity: z.number(),
});

export type SearchSuggestionDTO = z.infer<typeof searchSuggestionDTOSchema>;

// Search facet DTO
export const searchFacetDTOSchema = z.object({
  name: z.string(),
  value: z.string(),
  count: z.number().int(),
  selected: z.boolean().optional(),
});

export type SearchFacetDTO = z.infer<typeof searchFacetDTOSchema>;
