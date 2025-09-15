/**
 * Metrics configuration and utilities
 */

// Time windows for metrics aggregation
export const METRICS_WINDOW_RECENT_DAYS = 7;
export const METRICS_WINDOW_LONG_DAYS = 30;

// De-duplication and rate limiting
export const VIEW_DEDUP_WINDOW_MIN = 10; // minutes per (ipHash, ruleId)
export const RATE_LIMIT_EVENTS_PER_MIN = 60;

// Trending score calculation
export const TREND_DECAY_LAMBDA = 0.25; // per day
export const TREND_WEIGHTS = {
  views: 0.4,
  copies: 0.3,
  saves: 0.2,
  votes: 0.1,
} as const;

// API endpoints
export const EVENT_ENDPOINT = "/ingest/events";

// Anti-gaming limits
export const MAX_VIEWS_PER_IP_PER_RULE_PER_DAY = 5;
export const MAX_EVENTS_PER_IP_PER_MINUTE = 20;

/**
 * Calculate exponential decay weight for trending score
 * @param daysAgo Number of days ago (0 = today, 1 = yesterday, etc.)
 * @returns Decay weight between 0 and 1
 */
export function decayWeight(daysAgo: number): number {
  return Math.exp(-TREND_DECAY_LAMBDA * daysAgo);
}

/**
 * Calculate trending score from daily metrics
 * @param dailyMetrics Array of daily metrics for the last 7 days (index 0 = today)
 * @returns Trending score
 */
export function calculateTrendingScore(
  dailyMetrics: Array<{
    views: number;
    copies: number;
    saves: number;
    votes: number;
  }>
): number {
  let score = 0;

  for (let d = 0; d < Math.min(dailyMetrics.length, 7); d++) {
    const metrics = dailyMetrics[d];
    if (!metrics) continue;

    const weight = decayWeight(d);

    score +=
      weight *
      (TREND_WEIGHTS.views * metrics.views +
        TREND_WEIGHTS.copies * metrics.copies +
        TREND_WEIGHTS.saves * metrics.saves +
        TREND_WEIGHTS.votes * metrics.votes);
  }

  return Math.round(score * 100) / 100; // Round to 2 decimal places
}

/**
 * Generate idempotency key for events
 * @param userId User ID or null
 * @param ipHash IP hash
 * @param ruleId Rule ID
 * @param eventType Event type
 * @returns Idempotency key
 */
export function generateIdempotencyKey(
  userId: string | null,
  ipHash: string,
  ruleId: string,
  eventType: string
): string {
  const userPart = userId || ipHash;
  const timeBucket = Math.floor(Date.now() / (16 * 1000)); // 16-second buckets
  return `${userPart}-${ruleId}-${eventType}-${timeBucket}`;
}

/**
 * Event types that can be recorded
 */
export const EVENT_TYPES = {
  VIEW: "VIEW",
  COPY: "COPY",
  SAVE: "SAVE",
  FORK: "FORK",
  VOTE: "VOTE",
  COMMENT: "COMMENT",
  DONATE: "DONATE",
  CLAIM: "CLAIM",
} as const;

export type EventType = keyof typeof EVENT_TYPES;

/**
 * Validate event type
 */
export function isValidEventType(type: string): type is EventType {
  return type in EVENT_TYPES;
}

/**
 * Get date range for metrics window
 * @param days Number of days to look back
 * @returns Array of Date objects for each day in the window
 */
export function getMetricsDateRange(days: number): Date[] {
  const dates: Date[] = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setUTCHours(0, 0, 0, 0);
    dates.push(date);
  }

  return dates;
}

/**
 * Check if an IP should be rate limited
 * @param ipEvents Number of events from this IP in the current minute
 * @returns True if should be rate limited
 */
export function shouldRateLimit(ipEvents: number): boolean {
  return ipEvents >= MAX_EVENTS_PER_IP_PER_MINUTE;
}

/**
 * Apply anti-gaming caps to view counts
 * @param viewCount Raw view count
 * @returns Capped view count
 */
export function capViewCount(viewCount: number): number {
  return Math.min(viewCount, MAX_VIEWS_PER_IP_PER_RULE_PER_DAY);
}

/**
 * Create a simple hash for client-side deduplication
 * @param input String to hash
 * @returns Simple hash string
 */
export function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get cookie name for view deduplication
 * @param ruleId Rule ID
 * @returns Cookie name
 */
export function getViewDedupeCookieName(ruleId: string): string {
  return `view_${simpleHash(ruleId)}`;
}

/**
 * Check if view should be deduplicated based on cookie
 * @param ruleId Rule ID
 * @returns True if view should be skipped
 */
export function shouldDedupeView(ruleId: string): boolean {
  if (typeof document === "undefined") return false;

  const cookieName = getViewDedupeCookieName(ruleId);
  const lastView = (document as any).cookie
    .split("; ")
    .find((row: string) => row.startsWith(`${cookieName}=`))
    ?.split("=")[1];

  if (!lastView) return false;

  const lastViewTime = parseInt(lastView, 10);
  const now = Date.now();
  const windowMs = VIEW_DEDUP_WINDOW_MIN * 60 * 1000;

  return now - lastViewTime < windowMs;
}

/**
 * Set view deduplication cookie
 * @param ruleId Rule ID
 */
export function setViewDedupeCookie(ruleId: string): void {
  if (typeof document === "undefined") return;

  const cookieName = getViewDedupeCookieName(ruleId);
  const now = Date.now();
  const expireMs = VIEW_DEDUP_WINDOW_MIN * 60 * 1000;
  const expires = new Date(now + expireMs);

  (
    document as any
  ).cookie = `${cookieName}=${now}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}
