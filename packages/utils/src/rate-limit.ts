/**
 * Simple in-memory rate limiter
 * For production, consider using Redis or a dedicated rate limiting service
 */

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if a request is allowed for the given identifier
   */
  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const entry = this.store.get(identifier);

    // Clean up expired entries
    this.cleanup(now);

    if (!entry) {
      // First request for this identifier
      this.store.set(identifier, {
        count: 1,
        resetTime: now + this.config.windowMs,
      });
      return true;
    }

    if (now >= entry.resetTime) {
      // Window has expired, reset
      this.store.set(identifier, {
        count: 1,
        resetTime: now + this.config.windowMs,
      });
      return true;
    }

    if (entry.count >= this.config.maxRequests) {
      // Rate limit exceeded
      return false;
    }

    // Increment count
    entry.count++;
    return true;
  }

  /**
   * Get remaining requests for an identifier
   */
  getRemaining(identifier: string): number {
    const entry = this.store.get(identifier);
    if (!entry || Date.now() >= entry.resetTime) {
      return this.config.maxRequests;
    }
    return Math.max(0, this.config.maxRequests - entry.count);
  }

  /**
   * Get reset time for an identifier
   */
  getResetTime(identifier: string): number | null {
    const entry = this.store.get(identifier);
    if (!entry || Date.now() >= entry.resetTime) {
      return null;
    }
    return entry.resetTime;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(now: number): void {
    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clear all entries (useful for testing)
   */
  clear(): void {
    this.store.clear();
  }
}

// Default rate limiter instances
export const defaultRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
});

export const strictRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
});

export const apiRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60,
});

// Export the class for custom instances
export { RateLimiter, type RateLimitConfig };

/**
 * Utility function to create rate limit headers
 */
export function createRateLimitHeaders(
  limiter: RateLimiter,
  identifier: string
): Record<string, string> {
  const remaining = limiter.getRemaining(identifier);
  const resetTime = limiter.getResetTime(identifier);

  return {
    "X-RateLimit-Limit": limiter["config"].maxRequests.toString(),
    "X-RateLimit-Remaining": remaining.toString(),
    ...(resetTime && {
      "X-RateLimit-Reset": Math.ceil(resetTime / 1000).toString(),
    }),
  };
}

/**
 * Get client identifier from request (IP, user ID, etc.)
 */
export function getClientIdentifier(request: Request, userId?: string): string {
  if (userId) {
    return `user:${userId}`;
  }

  // Try to get IP from various headers
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");

  const ip = forwarded?.split(",")[0] || realIp || cfConnectingIp || "unknown";
  return `ip:${ip}`;
}
