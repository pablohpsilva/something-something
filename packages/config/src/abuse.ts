/**
 * Anti-abuse configuration with privacy-preserving settings
 */

export const AbuseConfig = {
  // Salts for privacy-preserving identity hashing
  salts: {
    ip: process.env.ABUSE_IP_SALT ?? "dev-ip-salt-change-in-production",
    ua: process.env.ABUSE_UA_SALT ?? "dev-ua-salt-change-in-production",
  },

  // Rate limits per user/IP per minute
  limits: {
    // Content creation limits
    commentsPerUserPerMin: 6,
    votesPerUserPerMin: 20,
    rulesCreatePerUserPerMin: 10,
    rulesPublishPerUserPerMin: 4,
    versionsCreatePerUserPerMin: 15,

    // Social interaction limits
    followsPerUserPerMin: 30,
    watchesPerUserPerMin: 60,
    notificationsOpsPerUserPerMin: 120,

    // Financial operations
    donationsCreatePerUserPerMin: 10,

    // Search and discovery
    searchPerIpPerMin: 120,
    suggestionsPerIpPerMin: 60,

    // Ingest service limits
    eventsPerIpPerMin: 60,
    crawlPerIpPerMin: 10,
    webhookPerIpPerMin: 30,

    // Admin operations
    adminOpsPerUserPerMin: 30,
    rebuildSearchPerUserPerMin: 2,

    // Badge and gamification
    badgeRecheckPerUserPerMin: 5,

    // Author claims
    claimsPerUserPerHour: 3,
  },

  // Time windows and deduplication
  windows: {
    defaultMs: 60_000, // 1 minute
    viewDedupMs: 10 * 60_000, // 10 minutes for view deduplication
    idempotencyMs: 10 * 60_000, // 10 minutes for idempotency keys
    challengeValidMs: 30 * 60_000, // 30 minutes for challenge tokens
    claimsPerUserPerHour: 1, // 1 hour for claim rate limiting
  },

  // Circuit breaker configuration
  circuitBreaker: {
    ipQpsMax: 25, // Maximum QPS before circuit opens
    banSeconds: 300, // 5 minutes ban duration
    windowSeconds: 5, // QPS calculation window
    recoveryThreshold: 0.5, // Success rate needed to close circuit
  },

  // Burst detection and caps
  burst: {
    maxIdenticalEventsPerMin: 20, // Max identical events per minute
    maxViewsPerIpPerRulePerDay: 5, // Max views counted per IP per rule per day
    anomalyThreshold: 3.0, // Multiplier over baseline for anomaly detection
  },

  // Shadow ban configuration
  shadowBan: {
    enabled: process.env.SHADOW_BAN_ENABLED === "true",
    userIds: process.env.SHADOW_BANNED_USER_IDS?.split(",").filter(Boolean) ?? [],
  },

  // Optional CAPTCHA/Challenge configuration
  challenge: {
    enabled: process.env.CHALLENGE_ENABLED === "true",
    provider: (process.env.CHALLENGE_PROVIDER as "turnstile" | "hcaptcha") ?? "turnstile",
    siteKey: process.env.CHALLENGE_SITE_KEY ?? "",
    secretKey: process.env.CHALLENGE_SECRET_KEY ?? "",
    triggerOnScore: 0.75, // Abuse score threshold to trigger challenge
    bypassDuration: 30 * 60_000, // 30 minutes bypass after successful challenge
  },

  // Anomaly detection weights
  anomaly: {
    weights: {
      burst: 0.6, // Weight for burst detection
      duplication: 0.3, // Weight for duplicate events
      entropy: 0.1, // Weight for user agent entropy
    },
    thresholds: {
      warning: 0.5, // Log warning at this score
      action: 0.8, // Take action at this score
    },
  },

  // Audit logging configuration
  audit: {
    logRateLimits: true,
    logAnomalies: true,
    logCircuitBreakers: true,
    retentionDays: 30,
  },
} as const;

// Type exports for better DX
export type AbuseConfigType = typeof AbuseConfig;
export type RateLimitBucket = keyof typeof AbuseConfig.limits;

// Helper to check if shadow ban is enabled and user is banned
export function isShadowBanned(userId: string): boolean {
  return AbuseConfig.shadowBan.enabled && 
         AbuseConfig.shadowBan.userIds.includes(userId);
}

// Helper to get rate limit for a specific bucket
export function getRateLimit(bucket: RateLimitBucket): {
  limit: number;
  windowMs: number;
} {
  return {
    limit: AbuseConfig.limits[bucket],
    windowMs: AbuseConfig.windows.defaultMs,
  };
}

// Validate configuration on import
function validateConfig() {
  const errors: string[] = [];

  // Check required environment variables in production
  if (process.env.NODE_ENV === "production") {
    if (AbuseConfig.salts.ip.includes("dev-")) {
      errors.push("ABUSE_IP_SALT must be set in production");
    }
    if (AbuseConfig.salts.ua.includes("dev-")) {
      errors.push("ABUSE_UA_SALT must be set in production");
    }
    if (AbuseConfig.challenge.enabled && !AbuseConfig.challenge.secretKey) {
      errors.push("CHALLENGE_SECRET_KEY must be set when challenges are enabled");
    }
  }

  // Validate numeric limits
  Object.entries(AbuseConfig.limits).forEach(([key, value]) => {
    if (typeof value !== "number" || value <= 0) {
      errors.push(`Invalid limit for ${key}: ${value}`);
    }
  });

  if (errors.length > 0) {
    console.warn("Abuse configuration warnings:", errors);
  }
}

// Run validation
validateConfig();
