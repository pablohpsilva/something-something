import { z } from "zod";

// Rollup input schema
export const rollupInputSchema = z.object({
  date: z.string().datetime().optional(), // Defaults to today UTC
  dryRun: z.boolean().default(false),
  daysBack: z.number().int().min(1).max(30).optional(), // Override default
});

// Rollup response schema
export const rollupResponseSchema = z.object({
  rulesUpdated: z.number().int().min(0),
  authorsUpdated: z.number().int().min(0),
  snapshots: z.object({
    daily: z.number().int().min(0),
    weekly: z.number().int().min(0),
    monthly: z.number().int().min(0),
    all: z.number().int().min(0).optional(),
  }),
  tookMs: z.number().int().min(0),
  dryRun: z.boolean(),
});

// Leaderboard period schema
export const leaderboardPeriodSchema = z.enum(["DAILY", "WEEKLY", "MONTHLY", "ALL"]);

// Leaderboard scope schema  
export const leaderboardScopeSchema = z.enum(["GLOBAL", "TAG", "MODEL"]);

export type RollupInput = z.infer<typeof rollupInputSchema>;
export type RollupResponse = z.infer<typeof rollupResponseSchema>;
export type LeaderboardPeriod = z.infer<typeof leaderboardPeriodSchema>;
export type LeaderboardScope = z.infer<typeof leaderboardScopeSchema>;
