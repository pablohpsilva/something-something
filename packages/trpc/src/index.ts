// Export the main router and types
export { appRouter, type AppRouter } from "./routers";
export { createContext, type Context } from "./trpc";

// Export commonly used schemas
export * from "./schemas/dto";
export * from "./schemas/base";
export * from "./schemas/social";
export * from "./schemas/donations";

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

export type { CreateCommentInput, ListCommentsInput } from "./schemas/comment";

export type {
  UpsertRuleVoteInput,
  UpsertVersionVoteInput,
} from "./schemas/vote";

export type { SearchQueryInput, SearchFilters } from "./schemas/search";

export type { ListTagsInput, AttachTagsInput } from "./schemas/tags";
