import { z } from "zod";
import {
  ruleIdSchema,
  claimIdSchema,
  claimStatusSchema,
  paginationSchema,
  idempotencyKeySchema,
} from "./base";

// Submit claim schema
export const submitClaimSchema = z.object({
  ruleId: ruleIdSchema,
  evidenceUrl: z.string().url().optional(),
  description: z.string().min(10).max(1000),
  idempotencyKey: idempotencyKeySchema,
});

export type SubmitClaimInput = z.infer<typeof submitClaimSchema>;

// Review claim schema
export const reviewClaimSchema = z.object({
  claimId: claimIdSchema,
  verdict: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().max(1000).optional(),
  idempotencyKey: idempotencyKeySchema,
});

export type ReviewClaimInput = z.infer<typeof reviewClaimSchema>;

// List my claims schema
export const listMyClaimsSchema = z.object({
  ...paginationSchema.shape,
  status: claimStatusSchema.optional(),
  sort: z.enum(["new", "old"]).default("new"),
});

export type ListMyClaimsInput = z.infer<typeof listMyClaimsSchema>;

// List claims for review schema (mod/admin only)
export const listClaimsForReviewSchema = z.object({
  ...paginationSchema.shape,
  status: claimStatusSchema.optional(),
  sort: z.enum(["new", "old", "priority"]).default("new"),
  assignedToMe: z.boolean().default(false),
});

export type ListClaimsForReviewInput = z.infer<
  typeof listClaimsForReviewSchema
>;

// Get claim by ID schema
export const getClaimByIdSchema = z.object({
  claimId: claimIdSchema,
});

export type GetClaimByIdInput = z.infer<typeof getClaimByIdSchema>;

// Assign claim schema (admin only)
export const assignClaimSchema = z.object({
  claimId: claimIdSchema,
  reviewerId: z.string(),
  idempotencyKey: idempotencyKeySchema,
});

export type AssignClaimInput = z.infer<typeof assignClaimSchema>;

// Get claims by rule schema
export const getClaimsByRuleSchema = z.object({
  ruleId: ruleIdSchema,
  ...paginationSchema.shape,
  status: claimStatusSchema.optional(),
});

export type GetClaimsByRuleInput = z.infer<typeof getClaimsByRuleSchema>;
