import { z } from "zod"
import { leaderboardPeriodSchema, leaderboardScopeSchema, paginationSchema } from "./base"

// Get leaderboard schema
export const getLeaderboardSchema = z.object({
  period: leaderboardPeriodSchema,
  scope: leaderboardScopeSchema,
  scopeRef: z.string().optional(), // Tag slug or model name for scoped leaderboards
  ...paginationSchema.shape,
  includeStats: z.boolean().default(true),
})

export type GetLeaderboardInput = z.infer<typeof getLeaderboardSchema>

// Get user rank schema
export const getUserRankSchema = z.object({
  userId: z.string().optional(), // If not provided, uses current user
  period: leaderboardPeriodSchema,
  scope: leaderboardScopeSchema,
  scopeRef: z.string().optional(),
})

export type GetUserRankInput = z.infer<typeof getUserRankSchema>

// Get leaderboard history schema
export const getLeaderboardHistorySchema = z.object({
  userId: z.string().optional(), // If not provided, uses current user
  period: leaderboardPeriodSchema,
  scope: leaderboardScopeSchema,
  scopeRef: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(30),
})

export type GetLeaderboardHistoryInput = z.infer<typeof getLeaderboardHistorySchema>

// Generate leaderboard snapshot schema (admin only)
export const generateSnapshotSchema = z.object({
  period: leaderboardPeriodSchema,
  scope: leaderboardScopeSchema,
  scopeRef: z.string().optional(),
  force: z.boolean().default(false), // Force regeneration even if recent snapshot exists
})

export type GenerateSnapshotInput = z.infer<typeof generateSnapshotSchema>

// Get available scopes schema
export const getAvailableScopesSchema = z.object({
  period: leaderboardPeriodSchema,
})

export type GetAvailableScopesInput = z.infer<typeof getAvailableScopesSchema>
