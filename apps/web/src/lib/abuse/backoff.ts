/**
 * Client-side exponential backoff for handling rate limits
 */

export interface BackoffConfig {
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  jitter: boolean;
}

export interface BackoffState {
  attempt: number;
  nextDelayMs: number;
  lastAttemptAt?: number;
}

const DEFAULT_CONFIG: BackoffConfig = {
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 60000, // 1 minute
  multiplier: 2,
  jitter: true,
};

/**
 * Exponential backoff calculator
 */
export class ExponentialBackoff {
  private config: BackoffConfig;
  private state: BackoffState;

  constructor(config: Partial<BackoffConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      attempt: 0,
      nextDelayMs: this.config.initialDelayMs,
    };
  }

  /**
   * Calculate next delay after a failure
   */
  nextDelay(): number {
    this.state.attempt++;
    this.state.lastAttemptAt = Date.now();

    // Calculate exponential delay
    let delay = this.config.initialDelayMs * Math.pow(this.config.multiplier, this.state.attempt - 1);
    
    // Cap at maximum delay
    delay = Math.min(delay, this.config.maxDelayMs);

    // Add jitter to prevent thundering herd
    if (this.config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }

    this.state.nextDelayMs = delay;
    return delay;
  }

  /**
   * Reset backoff state after success
   */
  reset(): void {
    this.state = {
      attempt: 0,
      nextDelayMs: this.config.initialDelayMs,
    };
  }

  /**
   * Get current backoff state
   */
  getState(): BackoffState {
    return { ...this.state };
  }

  /**
   * Check if enough time has passed since last attempt
   */
  canRetry(): boolean {
    if (!this.state.lastAttemptAt) return true;
    
    const elapsed = Date.now() - this.state.lastAttemptAt;
    return elapsed >= this.state.nextDelayMs;
  }

  /**
   * Get remaining wait time in milliseconds
   */
  getRemainingWaitMs(): number {
    if (!this.state.lastAttemptAt) return 0;
    
    const elapsed = Date.now() - this.state.lastAttemptAt;
    return Math.max(0, this.state.nextDelayMs - elapsed);
  }
}

/**
 * Global backoff manager for different operation types
 */
class BackoffManager {
  private backoffs = new Map<string, ExponentialBackoff>();

  getBackoff(key: string, config?: Partial<BackoffConfig>): ExponentialBackoff {
    if (!this.backoffs.has(key)) {
      this.backoffs.set(key, new ExponentialBackoff(config));
    }
    return this.backoffs.get(key)!;
  }

  reset(key: string): void {
    const backoff = this.backoffs.get(key);
    if (backoff) {
      backoff.reset();
    }
  }

  canRetry(key: string): boolean {
    const backoff = this.backoffs.get(key);
    return backoff ? backoff.canRetry() : true;
  }

  getRemainingWait(key: string): number {
    const backoff = this.backoffs.get(key);
    return backoff ? backoff.getRemainingWaitMs() : 0;
  }

  cleanup(): void {
    // Remove old backoffs that haven't been used recently
    const cutoff = Date.now() - 5 * 60 * 1000; // 5 minutes
    
    for (const [key, backoff] of this.backoffs.entries()) {
      const state = backoff.getState();
      if (state.lastAttemptAt && state.lastAttemptAt < cutoff) {
        this.backoffs.delete(key);
      }
    }
  }
}

// Global manager instance
const globalManager = new BackoffManager();

// Cleanup old backoffs periodically
if (typeof window !== 'undefined') {
  setInterval(() => {
    globalManager.cleanup();
  }, 5 * 60 * 1000); // Every 5 minutes
}

/**
 * High-level backoff utilities
 */
export function createBackoff(key: string, config?: Partial<BackoffConfig>): ExponentialBackoff {
  return globalManager.getBackoff(key, config);
}

export function resetBackoff(key: string): void {
  globalManager.reset(key);
}

export function canRetry(key: string): boolean {
  return globalManager.canRetry(key);
}

export function getRemainingWait(key: string): number {
  return globalManager.getRemainingWait(key);
}

/**
 * Utility to handle rate limit responses
 */
export function handleRateLimit(error: any, operationKey: string): {
  shouldRetry: boolean;
  retryAfterMs: number;
  message: string;
} {
  // Check if this is a rate limit error
  const isRateLimit = error?.code === 'TOO_MANY_REQUESTS' || 
                     error?.status === 429 ||
                     error?.message?.includes('rate limit');

  if (!isRateLimit) {
    return {
      shouldRetry: false,
      retryAfterMs: 0,
      message: 'Not a rate limit error',
    };
  }

  // Extract retry-after from error
  let retryAfterMs = 0;
  
  if (error?.cause?.retryAfterMs) {
    retryAfterMs = error.cause.retryAfterMs;
  } else if (error?.retryAfter) {
    retryAfterMs = error.retryAfter * 1000; // Convert seconds to ms
  } else {
    // Use backoff calculation
    const backoff = globalManager.getBackoff(operationKey);
    retryAfterMs = backoff.nextDelay();
  }

  const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
  
  return {
    shouldRetry: true,
    retryAfterMs,
    message: `Rate limit exceeded. Try again in ${retryAfterSeconds} second${retryAfterSeconds !== 1 ? 's' : ''}.`,
  };
}

/**
 * Retry wrapper with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    key: string;
    maxAttempts?: number;
    config?: Partial<BackoffConfig>;
    onRetry?: (attempt: number, error: any) => void;
  }
): Promise<T> {
  const { key, maxAttempts = 3, config, onRetry } = options;
  const backoff = globalManager.getBackoff(key, config);
  
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await operation();
      
      // Success - reset backoff
      backoff.reset();
      return result;
    } catch (error) {
      lastError = error;
      
      // Check if this is a rate limit error
      const rateLimitInfo = handleRateLimit(error, key);
      
      if (!rateLimitInfo.shouldRetry || attempt === maxAttempts) {
        throw error;
      }
      
      // Calculate delay
      const delayMs = rateLimitInfo.retryAfterMs || backoff.nextDelay();
      
      // Call retry callback
      if (onRetry) {
        onRetry(attempt, error);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError;
}

/**
 * Format remaining wait time for user display
 */
export function formatWaitTime(ms: number): string {
  if (ms < 1000) return 'less than a second';
  
  const seconds = Math.ceil(ms / 1000);
  
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }
  
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}
