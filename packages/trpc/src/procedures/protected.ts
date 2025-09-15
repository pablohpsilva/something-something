import { publicProcedure, middleware } from "../trpc";
import {
  validateAuth,
  requireSpecificRole,
  requireVerifiedUser,
  requireCompleteProfile,
  getCurrentUser,
  getCurrentUserId,
  requireOwnershipOrMod,
} from "../middleware/auth-validation";
import { rateLimit } from "../trpc";

/**
 * Basic protected procedure - requires authentication
 */
export const protectedProcedure = publicProcedure.use(validateAuth);

/**
 * Protected procedure that requires verified email
 */
export const verifiedProcedure = publicProcedure
  .use(validateAuth)
  .use(requireVerifiedUser);

/**
 * Protected procedure that requires complete profile
 */
export const completeProcedure = publicProcedure
  .use(validateAuth)
  .use(requireCompleteProfile);

/**
 * Moderator-only procedure
 */
export const modProcedure = publicProcedure
  .use(validateAuth)
  .use(requireSpecificRole("MOD"));

/**
 * Admin-only procedure
 */
export const adminProcedure = publicProcedure
  .use(validateAuth)
  .use(requireSpecificRole("ADMIN"));

/**
 * Rate-limited protected procedures
 */

// General rate-limited procedure (10 requests per minute)
export const rateLimitedProcedure = protectedProcedure.use(
  rateLimit("general", 10, 60 * 1000)
);

// Strict rate-limited procedure (6 requests per minute) for sensitive operations
export const strictRateLimitedProcedure = protectedProcedure.use(
  rateLimit("strict", 6, 60 * 1000)
);

// Content creation procedure (requires complete profile + rate limiting)
export const contentCreationProcedure = completeProcedure.use(
  rateLimit("content", 15, 60 * 1000)
);

// Voting procedure (higher rate limit for interactions)
export const votingProcedure = protectedProcedure.use(
  rateLimit("vote", 30, 60 * 1000)
);

// Social interaction procedure (following, favoriting, etc.)
export const socialProcedure = protectedProcedure.use(
  rateLimit("social", 20, 60 * 1000)
);

// Comment/discussion procedure
export const discussionProcedure = verifiedProcedure.use(
  rateLimit("discussion", 12, 60 * 1000)
);

// Moderation procedure (higher limits for mods)
export const moderationProcedure = modProcedure.use(
  rateLimit("moderation", 50, 60 * 1000)
);

// Admin procedure (highest limits)
export const adminActionProcedure = adminProcedure.use(
  rateLimit("admin", 100, 60 * 1000)
);

/**
 * Helper to create custom rate-limited procedures
 */
export function createRateLimitedProcedure(
  baseProcedure: typeof protectedProcedure,
  bucket: string,
  options: {
    limit?: number;
    windowMs?: number;
    requireVerified?: boolean;
    requireComplete?: boolean;
  } = {}
) {
  const {
    limit = 10,
    windowMs = 60 * 1000,
    requireVerified = false,
    requireComplete = false,
  } = options;

  let procedure = baseProcedure;

  if (requireComplete) {
    procedure = completeProcedure;
  } else if (requireVerified) {
    procedure = verifiedProcedure;
  }

  return procedure.use(rateLimit(bucket, limit, windowMs));
}

/**
 * Procedure factories for common patterns
 */

// For user profile operations
export const profileProcedure = createRateLimitedProcedure(
  protectedProcedure,
  "profile",
  { limit: 8, requireVerified: true }
);

// For content management
export const contentManagementProcedure = createRateLimitedProcedure(
  protectedProcedure,
  "contentMgmt",
  { limit: 20, requireComplete: true }
);

// For sensitive operations
export const sensitiveProcedure = createRateLimitedProcedure(
  protectedProcedure,
  "sensitive",
  { limit: 3, windowMs: 5 * 60 * 1000, requireComplete: true } // 3 per 5 minutes
);

// Re-export helper functions for convenience
export { getCurrentUser, getCurrentUserId, requireOwnershipOrMod };
