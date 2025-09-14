import { z } from "zod";

// Base ID schemas
export const ruleIdSchema = z.string().cuid();
export const ruleVersionIdSchema = z.string().cuid();
export const userIdSchema = z.string().cuid();
export const commentIdSchema = z.string().cuid();
export const claimIdSchema = z.string().cuid();
export const tagIdSchema = z.string().cuid();

// Generic ID schema that accepts CUID or UUID
export const cuidOrUuidSchema = z.string().min(1);

// Pagination schemas
export const cursorSchema = z.string().optional();
export const limitSchema = z.number().int().min(1).max(100).default(20);

// Handle and slug schemas
export const handleSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(
    /^[a-z0-9-]+$/,
    "Handle must contain only lowercase letters, numbers, and hyphens"
  );

export const slugSchema = z
  .string()
  .min(3)
  .max(100)
  .regex(
    /^[a-z0-9-]+$/,
    "Slug must contain only lowercase letters, numbers, and hyphens"
  );

// Pagination schema
export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

// Sorting schema
export const sortSchema = z.enum(["new", "top", "trending"]).default("new");

// Date range schema
export const dateRangeSchema = z.object({
  from: z.date().optional(),
  to: z.date().optional(),
});

// Filter schemas
export const tagsFilterSchema = z.array(z.string()).optional();
export const modelFilterSchema = z.string().optional();
export const statusFilterSchema = z
  .enum(["DRAFT", "PUBLISHED", "DEPRECATED"])
  .optional();

// Content type schema
export const contentTypeSchema = z.enum(["PROMPT", "RULE", "MCP", "GUIDE"]);

// Role schemas
export const userRoleSchema = z.enum(["USER", "MOD", "ADMIN"]);
export const requiredRoleSchema = z.enum(["MOD", "ADMIN"]);

// Vote value schema
export const voteValueSchema = z.enum(["up", "down"]);

// Event type schema
export const eventTypeSchema = z.enum([
  "VIEW",
  "COPY",
  "SAVE",
  "FORK",
  "COMMENT",
  "VOTE",
  "DONATE",
  "CLAIM",
]);

// Notification type schema
export const notificationTypeSchema = z.enum([
  "NEW_VERSION",
  "COMMENT_REPLY",
  "AUTHOR_PUBLISHED",
  "CLAIM_VERDICT",
  "DONATION_RECEIVED",
]);

// Claim status schema
export const claimStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);

// Donation status schema
export const donationStatusSchema = z.enum(["INIT", "SUCCEEDED", "FAILED"]);

// Currency schema
export const currencySchema = z.string().length(3);

// Leaderboard schemas
export const leaderboardPeriodSchema = z.enum([
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "ALL",
]);
export const leaderboardScopeSchema = z.enum(["GLOBAL", "TAG", "MODEL"]);

// Resource link kind schema
export const resourceLinkKindSchema = z.enum([
  "DOCS",
  "GITHUB",
  "NPM",
  "PACKAGE",
  "VIDEO",
  "ARTICLE",
]);

// Tested on schema
export const testedOnSchema = z.object({
  models: z.array(z.string()).optional(),
  stacks: z.array(z.string()).optional(),
});

// Resource link schema
export const resourceLinkSchema = z.object({
  label: z.string().min(1).max(255),
  url: z.string().url(),
  kind: resourceLinkKindSchema,
});

// Common text fields
export const titleSchema = z.string().min(1).max(255);
export const summarySchema = z.string().max(1000).optional();
export const bodySchema = z.string().min(1);
export const changelogSchema = z.string().max(2000).optional();
export const bioSchema = z.string().max(500).optional();
export const commentBodySchema = z.string().min(1).max(2000);

// Semver schema
export const semverSchema = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, "Version must be in semver format (e.g., 1.0.0)");

// Idempotency key schema
export const idempotencyKeySchema = z.string().min(1).max(255).optional();

// Common response metadata
export const metadataSchema = z.object({
  total: z.number().int().optional(),
  hasMore: z.boolean().optional(),
  nextCursor: z.string().optional(),
});

// Error response schema
export const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

// Success response wrapper
export function createSuccessSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    metadata: metadataSchema.optional(),
  });
}

// Paginated response wrapper
export function createPaginatedSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().optional(),
    hasMore: z.boolean(),
    total: z.number().int().optional(),
  });
}
