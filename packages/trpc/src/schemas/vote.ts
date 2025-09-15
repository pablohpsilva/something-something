import { z } from "zod"
import { cuidOrUuidSchema } from "./base"

/**
 * Vote value enum
 */
export const voteValueSchema = z.enum(["up", "down", "none"])

/**
 * Rule vote input schema
 */
export const voteRuleSchema = z.object({
  ruleId: cuidOrUuidSchema,
  value: voteValueSchema,
})

/**
 * Version vote input schema
 */
export const voteVersionSchema = z.object({
  ruleVersionId: cuidOrUuidSchema,
  value: voteValueSchema,
})

/**
 * Vote score query schema
 */
export const voteScoreQuerySchema = z.object({
  ruleId: cuidOrUuidSchema.optional(),
  ruleVersionId: cuidOrUuidSchema.optional(),
})

/**
 * Vote DTO schema for API responses
 */
export const voteDTOSchema = z.object({
  score: z.number(), // net score (upvotes - downvotes)
  upCount: z.number(),
  downCount: z.number(),
  myVote: z.number().min(-1).max(1), // -1, 0, or 1
})

/**
 * User votes query schema
 */
export const userVotesQuerySchema = z.object({
  ruleIds: z.array(cuidOrUuidSchema).optional(),
  ruleVersionIds: z.array(cuidOrUuidSchema).optional(),
})

/**
 * User votes response schema
 */
export const userVotesResponseSchema = z.object({
  ruleVotes: z.record(z.string(), z.number()), // ruleId -> vote value
  versionVotes: z.record(z.string(), z.number()), // versionId -> vote value
})

export type VoteValue = z.infer<typeof voteValueSchema>
export type VoteRuleInput = z.infer<typeof voteRuleSchema>
export type VoteVersionInput = z.infer<typeof voteVersionSchema>
export type VoteScoreQuery = z.infer<typeof voteScoreQuerySchema>
export type VoteDTO = z.infer<typeof voteDTOSchema>
export type UserVotesQuery = z.infer<typeof userVotesQuerySchema>
export type UserVotesResponse = z.infer<typeof userVotesResponseSchema>

/**
 * Convert vote value to numeric
 */
export function voteValueToNumber(value: VoteValue): number {
  switch (value) {
    case "up":
      return 1
    case "down":
      return -1
    case "none":
      return 0
  }
}

/**
 * Convert numeric vote to value
 */
export function numberToVoteValue(num: number): VoteValue {
  if (num > 0) return "up"
  if (num < 0) return "down"
  return "none"
}
