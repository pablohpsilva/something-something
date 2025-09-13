import { z } from "zod";
import {
  ruleIdSchema,
  ruleVersionIdSchema,
  voteValueSchema,
  idempotencyKeySchema,
} from "./base";

// Upsert rule vote schema
export const upsertRuleVoteSchema = z.object({
  ruleId: ruleIdSchema,
  value: voteValueSchema,
  idempotencyKey: idempotencyKeySchema,
});

export type UpsertRuleVoteInput = z.infer<typeof upsertRuleVoteSchema>;

// Upsert version vote schema
export const upsertVersionVoteSchema = z.object({
  ruleVersionId: ruleVersionIdSchema,
  value: voteValueSchema,
  idempotencyKey: idempotencyKeySchema,
});

export type UpsertVersionVoteInput = z.infer<typeof upsertVersionVoteSchema>;

// Remove rule vote schema
export const removeRuleVoteSchema = z.object({
  ruleId: ruleIdSchema,
  idempotencyKey: idempotencyKeySchema,
});

export type RemoveRuleVoteInput = z.infer<typeof removeRuleVoteSchema>;

// Remove version vote schema
export const removeVersionVoteSchema = z.object({
  ruleVersionId: ruleVersionIdSchema,
  idempotencyKey: idempotencyKeySchema,
});

export type RemoveVersionVoteInput = z.infer<typeof removeVersionVoteSchema>;

// Get rule score schema
export const getRuleScoreSchema = z.object({
  ruleId: ruleIdSchema,
  includeUserVote: z.boolean().default(false),
});

export type GetRuleScoreInput = z.infer<typeof getRuleScoreSchema>;

// Get version score schema
export const getVersionScoreSchema = z.object({
  ruleVersionId: ruleVersionIdSchema,
  includeUserVote: z.boolean().default(false),
});

export type GetVersionScoreInput = z.infer<typeof getVersionScoreSchema>;

// Get user votes schema
export const getUserVotesSchema = z.object({
  ruleIds: z.array(ruleIdSchema).optional(),
  versionIds: z.array(ruleVersionIdSchema).optional(),
});

export type GetUserVotesInput = z.infer<typeof getUserVotesSchema>;
