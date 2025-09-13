import { z } from "zod";
import { cuidOrUuidSchema, cursorSchema, limitSchema } from "./base";

/**
 * Leaderboard query input schema
 */
export const leaderboardGetInputSchema = z.object({
  period: z.enum(["DAILY", "WEEKLY", "MONTHLY", "ALL"]),
  scope: z.enum(["GLOBAL", "TAG", "MODEL"]).default("GLOBAL"),
  scopeRef: z.string().optional(), // tag slug or model string
  cursor: cursorSchema.optional(),
  limit: limitSchema.optional().default(25),
});

/**
 * Badges list input schema
 */
export const badgesListInputSchema = z.object({
  userId: cuidOrUuidSchema.optional(), // defaults to current user if omitted
});

/**
 * All badges catalog input schema
 */
export const badgesAllInputSchema = z.object({});

/**
 * Recheck badges input schema
 */
export const badgesRecheckInputSchema = z.object({});

/**
 * Leaderboard entry schema
 */
export const leaderboardEntrySchema = z.object({
  rank: z.number().int().positive(),
  ruleId: cuidOrUuidSchema,
  ruleSlug: z.string(),
  title: z.string(),
  author: z.object({
    id: cuidOrUuidSchema,
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

/**
 * Leaderboard response schema
 */
export const leaderboardResponseSchema = z.object({
  entries: z.array(leaderboardEntrySchema),
  meta: z.object({
    period: z.enum(["DAILY", "WEEKLY", "MONTHLY", "ALL"]),
    scope: z.enum(["GLOBAL", "TAG", "MODEL"]),
    scopeRef: z.string().nullable(),
    windowDays: z.number().int(),
    generatedAt: z.string(),
    totalEntries: z.number().int(),
  }),
  pagination: z.object({
    hasMore: z.boolean(),
    nextCursor: z.string().optional(),
  }),
});

/**
 * Badge schema
 */
export const badgeSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  criteria: z.record(z.unknown()),
  awardedAt: z.date().optional(), // present when listing user badges
});

/**
 * User badges response schema
 */
export const userBadgesResponseSchema = z.object({
  badges: z.array(badgeSchema),
  totalCount: z.number().int(),
});

/**
 * Badge catalog response schema
 */
export const badgeCatalogResponseSchema = z.object({
  badges: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      description: z.string(),
      criteria: z.record(z.unknown()),
    })
  ),
});

/**
 * Recheck badges response schema
 */
export const badgesRecheckResponseSchema = z.object({
  awarded: z.number().int(),
  message: z.string(),
});

// Type exports
export type LeaderboardGetInput = z.infer<typeof leaderboardGetInputSchema>;
export type BadgesListInput = z.infer<typeof badgesListInputSchema>;
export type BadgesAllInput = z.infer<typeof badgesAllInputSchema>;
export type BadgesRecheckInput = z.infer<typeof badgesRecheckInputSchema>;

export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>;
export type LeaderboardResponse = z.infer<typeof leaderboardResponseSchema>;
export type Badge = z.infer<typeof badgeSchema>;
export type UserBadgesResponse = z.infer<typeof userBadgesResponseSchema>;
export type BadgeCatalogResponse = z.infer<typeof badgeCatalogResponseSchema>;
export type BadgesRecheckResponse = z.infer<typeof badgesRecheckResponseSchema>;
