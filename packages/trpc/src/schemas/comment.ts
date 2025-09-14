import { z } from "zod";
import { cuidOrUuidSchema } from "./base";

/**
 * Comment creation input schema
 */
export const commentCreateSchema = z.object({
  ruleId: cuidOrUuidSchema,
  parentId: cuidOrUuidSchema.optional(),
  body: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(5000, "Comment too long"),
});

/**
 * Comment list input schema
 */
export const commentListSchema = z.object({
  ruleId: cuidOrUuidSchema,
  cursor: z.string().optional(),
  limit: z.number().min(1).max(50).default(20),
  mode: z.enum(["flat", "tree"]).default("tree"),
});

/**
 * Comment edit input schema
 */
export const commentEditSchema = z.object({
  commentId: cuidOrUuidSchema,
  body: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(5000, "Comment too long"),
});

/**
 * Comment delete input schema
 */
export const commentDeleteSchema = z.object({
  commentId: cuidOrUuidSchema,
  reason: z.string().max(200, "Reason too long").optional(),
});

/**
 * Comment DTO schema for API responses
 */
export const commentDTOSchema: z.ZodType<any> = z.object({
  id: z.string(),
  ruleId: z.string(),
  parentId: z.string().nullable(),
  author: z.object({
    id: z.string(),
    handle: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  bodyHtml: z.string().nullable(), // null if deleted
  isDeleted: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  edited: z.boolean(), // true if updatedAt > createdAt + 1min
  depth: z.number().min(0),
  children: z.array(z.lazy(() => commentDTOSchema)).optional(),
  canEdit: z.boolean().optional(), // if user can edit this comment
  canDelete: z.boolean().optional(), // if user can delete this comment
});

export type CommentCreateInput = z.infer<typeof commentCreateSchema>;
export type CommentListInput = z.infer<typeof commentListSchema>;
export type CommentEditInput = z.infer<typeof commentEditSchema>;
export type CommentDeleteInput = z.infer<typeof commentDeleteSchema>;
export type CommentDTO = z.infer<typeof commentDTOSchema>;

/**
 * Comment list response schema
 */
export const commentListResponseSchema = z.object({
  items: z.array(commentDTOSchema),
  nextCursor: z.string().optional(),
  hasMore: z.boolean(),
  totalCount: z.number(),
});

export type CommentListResponse = z.infer<typeof commentListResponseSchema>;
