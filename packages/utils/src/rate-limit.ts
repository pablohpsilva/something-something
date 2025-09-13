/**
 * Rate limiting system with sliding window implementation
 */

export type LimitOutcome = 
  | { ok: true; remaining: number; resetMs: number }
  | { ok: false; retryAfterMs: number; resetMs: number };

export interface RateLimitStore {
  consume(key: string, weight: number, windowMs: number, limit: number): Promise<LimitOutcome>;
  getWindow(key: string, windowMs: number, limit: number): Promise<{ remaining: number; resetMs: number } | null>;
  clear(key: string): Promise<void>;
  clearAll(): Promise<void>;
}

export type BucketKey = {
  bucket: string;
  userId?: string;
  ipHash?: string;
  uaHash?: string;
  extra?: string;
};

/**
 * Create a composite key from bucket components
 */
export function makeKey(k: BucketKey): string {
  return [
    k.bucket,
    k.userId ?? "-",
    k.ipHash ?? "-", 
    k.uaHash ?? "-",
    k.extra ?? "-"
  ].join(":");
}

/**
 * In-memory sliding window rate limiter
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, number[]>(); // key -> timestamps array
  private cleanupInterval: NodeJS.Timeout;

  constructor(cleanupIntervalMs = 60_000) {
    // Periodic cleanup of expired entries
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);
  }

  async consume(
    key: string, 
    weight: number, 
    windowMs: number, 
    limit: number
  ): Promise<LimitOutcome> {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get or create bucket
    let timestamps = this.buckets.get(key) ?? [];
    
    // Remove expired timestamps
    timestamps = timestamps.filter(ts => ts > windowStart);
    
    // Check if we can consume
    const currentUsage = timestamps.length;
    if (currentUsage + weight > limit) {
      // Calculate retry after based on oldest timestamp
      const oldestTimestamp = timestamps[0] ?? now;
      const retryAfterMs = Math.max(1000, oldestTimestamp + windowMs - now);
      const resetMs = windowMs - (now - oldestTimestamp);
      
      // Update bucket without adding new timestamps
      this.buckets.set(key, timestamps);
      
      return {
        ok: false,
        retryAfterMs,
        resetMs: Math.max(0, resetMs),
      };
    }
    
    // Add new timestamps for the weight
    for (let i = 0; i < weight; i++) {
      timestamps.push(now);
    }
    
    // Update bucket
    this.buckets.set(key, timestamps);
    
    const remaining = Math.max(0, limit - timestamps.length);
    const oldestTimestamp = timestamps[0] ?? now;
    const resetMs = windowMs - (now - oldestTimestamp);
    
    return {
      ok: true,
      remaining,
      resetMs: Math.max(0, resetMs),
    };
  }

  async getWindow(
    key: string, 
    windowMs: number, 
    limit: number
  ): Promise<{ remaining: number; resetMs: number } | null> {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    let timestamps = this.buckets.get(key);
    if (!timestamps || timestamps.length === 0) {
      return { remaining: limit, resetMs: windowMs };
    }
    
    // Remove expired timestamps
    timestamps = timestamps.filter(ts => ts > windowStart);
    this.buckets.set(key, timestamps);
    
    if (timestamps.length === 0) {
      return { remaining: limit, resetMs: windowMs };
    }
    
    const remaining = Math.max(0, limit - timestamps.length);
    const oldestTimestamp = timestamps[0];
    const resetMs = windowMs - (now - oldestTimestamp);
    
    return {
      remaining,
      resetMs: Math.max(0, resetMs),
    };
  }

  async clear(key: string): Promise<void> {
    this.buckets.delete(key);
  }

  async clearAll(): Promise<void> {
    this.buckets.clear();
  }

  /**
   * Clean up expired entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [key, timestamps] of this.buckets.entries()) {
      // Remove timestamps older than maxAge
      const filtered = timestamps.filter(ts => now - ts < maxAge);
      
      if (filtered.length === 0) {
        this.buckets.delete(key);
      } else if (filtered.length !== timestamps.length) {
        this.buckets.set(key, filtered);
      }
    }
  }

  /**
   * Get current memory usage stats
   */
  getStats(): {
    totalBuckets: number;
    totalTimestamps: number;
    memoryUsageBytes: number;
  } {
    let totalTimestamps = 0;
    for (const timestamps of this.buckets.values()) {
      totalTimestamps += timestamps.length;
    }
    
    // Rough memory calculation (key + timestamps array)
    const memoryUsageBytes = Array.from(this.buckets.entries()).reduce((acc, [key, timestamps]) => {
      return acc + key.length * 2 + timestamps.length * 8; // Rough estimate
    }, 0);
    
    return {
      totalBuckets: this.buckets.size,
      totalTimestamps,
      memoryUsageBytes,
    };
  }

  /**
   * Destroy the store and cleanup resources
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.buckets.clear();
  }
}

// Global store instance
let globalStore: MemoryRateLimitStore | null = null;

/**
 * Get or create the global rate limit store
 */
export function getGlobalStore(): MemoryRateLimitStore {
  if (!globalStore) {
    globalStore = new MemoryRateLimitStore();
  }
  return globalStore;
}

/**
 * High-level rate limiting function
 */
export async function limit(
  bucket: BucketKey, 
  config: { limit: number; windowMs: number; weight?: number }
): Promise<LimitOutcome> {
  const store = getGlobalStore();
  const key = makeKey(bucket);
  const weight = config.weight ?? 1;
  
  return store.consume(key, weight, config.windowMs, config.limit);
}

/**
 * Check current rate limit status without consuming
 */
export async function check(
  bucket: BucketKey,
  config: { limit: number; windowMs: number }
): Promise<{ remaining: number; resetMs: number } | null> {
  const store = getGlobalStore();
  const key = makeKey(bucket);
  
  return store.getWindow(key, config.windowMs, config.limit);
}

/**
 * Clear rate limit for a specific bucket
 */
export async function clearLimit(bucket: BucketKey): Promise<void> {
  const store = getGlobalStore();
  const key = makeKey(bucket);
  
  return store.clear(key);
}

/**
 * Token bucket implementation (alternative to sliding window)
 */
export class TokenBucketStore implements RateLimitStore {
  private buckets = new Map<string, {
    tokens: number;
    lastRefill: number;
    capacity: number;
    refillRate: number; // tokens per second
  }>();

  async consume(
    key: string,
    weight: number,
    windowMs: number,
    limit: number
  ): Promise<LimitOutcome> {
    const now = Date.now();
    const refillRate = limit / (windowMs / 1000); // tokens per second
    
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = {
        tokens: limit,
        lastRefill: now,
        capacity: limit,
        refillRate,
      };
    }
    
    // Refill tokens based on elapsed time
    const elapsed = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = elapsed * bucket.refillRate;
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
    
    // Check if we can consume
    if (bucket.tokens < weight) {
      const tokensNeeded = weight - bucket.tokens;
      const retryAfterMs = (tokensNeeded / bucket.refillRate) * 1000;
      
      this.buckets.set(key, bucket);
      
      return {
        ok: false,
        retryAfterMs: Math.ceil(retryAfterMs),
        resetMs: Math.ceil(retryAfterMs),
      };
    }
    
    // Consume tokens
    bucket.tokens -= weight;
    this.buckets.set(key, bucket);
    
    return {
      ok: true,
      remaining: Math.floor(bucket.tokens),
      resetMs: Math.ceil((bucket.capacity - bucket.tokens) / bucket.refillRate * 1000),
    };
  }

  async getWindow(
    key: string,
    windowMs: number,
    limit: number
  ): Promise<{ remaining: number; resetMs: number } | null> {
    const bucket = this.buckets.get(key);
    if (!bucket) {
      return { remaining: limit, resetMs: 0 };
    }
    
    // Refill tokens
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = elapsed * bucket.refillRate;
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
    
    this.buckets.set(key, bucket);
    
    return {
      remaining: Math.floor(bucket.tokens),
      resetMs: Math.ceil((bucket.capacity - bucket.tokens) / bucket.refillRate * 1000),
    };
  }

  async clear(key: string): Promise<void> {
    this.buckets.delete(key);
  }

  async clearAll(): Promise<void> {
    this.buckets.clear();
  }
}