import { z } from "zod";
import {
  ruleIdSchema,
  commentIdSchema,
  commentBodySchema,
  paginationSchema,
  idempotencyKeySchema,
} from "./base";

// Create comment schema
export const createCommentSchema = z.object({
  ruleId: ruleIdSchema,
  parentId: commentIdSchema.optional(),
  body: commentBodySchema,
  idempotencyKey: idempotencyKeySchema,
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

// List comments schema
export const listCommentsSchema = z.object({
  ruleId: ruleIdSchema,
  ...paginationSchema.shape,
  sort: z.enum(["new", "old", "top"]).default("new"),
  includeReplies: z.boolean().default(true),
  maxDepth: z.number().int().min(1).max(5).default(3),
});

export type ListCommentsInput = z.infer<typeof listCommentsSchema>;

// Update comment schema
export const updateCommentSchema = z.object({
  commentId: commentIdSchema,
  body: commentBodySchema,
  idempotencyKey: idempotencyKeySchema,
});

export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;

// Soft delete comment schema
export const softDeleteCommentSchema = z.object({
  commentId: commentIdSchema,
  reason: z.string().max(500).optional(),
  idempotencyKey: idempotencyKeySchema,
});

export type SoftDeleteCommentInput = z.infer<typeof softDeleteCommentSchema>;

// Get comment by ID schema
export const getCommentByIdSchema = z.object({
  commentId: commentIdSchema,
  includeReplies: z.boolean().default(true),
  maxDepth: z.number().int().min(1).max(5).default(3),
});

export type GetCommentByIdInput = z.infer<typeof getCommentByIdSchema>;

// Get comment thread schema
export const getCommentThreadSchema = z.object({
  commentId: commentIdSchema,
  ...paginationSchema.shape,
  sort: z.enum(["new", "old", "top"]).default("new"),
});

export type GetCommentThreadInput = z.infer<typeof getCommentThreadSchema>;

// Report comment schema
export const reportCommentSchema = z.object({
  commentId: commentIdSchema,
  reason: z.enum(["spam", "harassment", "inappropriate", "off-topic", "other"]),
  details: z.string().max(1000).optional(),
  idempotencyKey: idempotencyKeySchema,
});

export type ReportCommentInput = z.infer<typeof reportCommentSchema>;

// Get comments by user schema
export const getCommentsByUserSchema = z.object({
  userId: z.string(),
  ...paginationSchema.shape,
  sort: z.enum(["new", "old"]).default("new"),
  includeDeleted: z.boolean().default(false),
});

export type GetCommentsByUserInput = z.infer<typeof getCommentsByUserSchema>;
