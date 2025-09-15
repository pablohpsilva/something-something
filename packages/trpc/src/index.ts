// Export the main router and types
export { appRouter, type AppRouter } from "./routers";
export { createContext, type Context } from "./trpc";
export { createTRPCContext, createMockContext } from "./context";

// Export commonly used schemas
export * from "./schemas/dto";
export * from "./schemas/base";
export * from "./schemas/social";
export * from "./schemas/donations";

// Export auth middleware
export {
  authMiddleware,
  roleMiddleware,
  adminMiddleware,
  modMiddleware,
} from "./middleware/auth";

// Export enhanced auth validation
export {
  validateAuth,
  requireSpecificRole,
  requireOwnershipOrMod,
  requireVerifiedUser,
  requireCompleteProfile,
  canUserEditResource,
  getCurrentUser,
  getCurrentUserId,
} from "./middleware/auth-validation";

// Export enhanced protected procedures
export {
  protectedProcedure,
  verifiedProcedure,
  completeProcedure,
  modProcedure,
  adminProcedure,
  rateLimitedProcedure,
  strictRateLimitedProcedure,
  contentCreationProcedure,
  votingProcedure,
  socialProcedure,
  discussionProcedure,
  moderationProcedure,
  adminActionProcedure,
  createRateLimitedProcedure,
  profileProcedure,
  contentManagementProcedure,
  sensitiveProcedure,
} from "./procedures/protected";

// Export router types for client usage
export type {
  CreateRuleInput,
  UpdateRuleInput,
  ListRulesInput,
  GetRuleBySlugInput,
} from "./schemas/rule";

export type {
  CreateVersionInput,
  ForkVersionInput,
  ListVersionsByRuleInput,
} from "./schemas/version";

export type { CommentCreateInput, CommentListInput } from "./schemas/comment";

export type { VoteRuleInput, VoteVersionInput } from "./schemas/vote";

export type { SearchInput, AdvancedFilters } from "./schemas/search";

export type { ListTagsInput, AttachTagsInput } from "./schemas/tags";
