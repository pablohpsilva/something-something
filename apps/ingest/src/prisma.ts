import { prisma } from "@repo/db";

// Re-export the Prisma client from the shared package
export { prisma };

// Export commonly used types
export type {
  Event,
  EventType,
  RuleMetricDaily,
  AuthorMetricDaily,
  LeaderboardSnapshot,
  LeaderboardPeriod,
  LeaderboardScope,
  Donation,
  DonationStatus,
  CrawlItem,
  CrawlStatus,
  AuditLog,
} from "@repo/db";
