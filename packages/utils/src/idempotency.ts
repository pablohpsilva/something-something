/**
 * Idempotency system for preventing duplicate operations
 */

export interface IdempotencyStore {
  check(key: string, ttlMs?: number): Promise<boolean>;
  set(key: string, ttlMs?: number, payload?: string): Promise<void>;
  get(key: string): Promise<{ exists: boolean; payload?: string; expiresAt?: number }>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

type IdempotencyEntry = {
  key: string;
  payload?: string;
  createdAt: number;
  expiresAt: number;
};

/**
 * In-memory idempotency store
 */
export class MemoryIdempotencyStore implements IdempotencyStore {
  private entries = new Map<string, IdempotencyEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(cleanupIntervalMs = 60_000) {
    // Periodic cleanup of expired entries
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);
  }

  async check(key: string, ttlMs = 10 * 60_000): Promise<boolean> {
    const now = Date.now();
    const entry = this.entries.get(key);
    
    if (!entry) {
      // Key doesn't exist, create it
      this.entries.set(key, {
        key,
        createdAt: now,
        expiresAt: now + ttlMs,
      });
      return true; // First time seeing this key
    }
    
    if (entry.expiresAt <= now) {
      // Entry expired, remove and allow
      this.entries.delete(key);
      this.entries.set(key, {
        key,
        createdAt: now,
        expiresAt: now + ttlMs,
      });
      return true;
    }
    
    // Key exists and hasn't expired
    return false;
  }

  async set(key: string, ttlMs = 10 * 60_000, payload?: string): Promise<void> {
    const now = Date.now();
    this.entries.set(key, {
      key,
      payload,
      createdAt: now,
      expiresAt: now + ttlMs,
    });
  }

  async get(key: string): Promise<{ exists: boolean; payload?: string; expiresAt?: number }> {
    const now = Date.now();
    const entry = this.entries.get(key);
    
    if (!entry || entry.expiresAt <= now) {
      if (entry) {
        this.entries.delete(key);
      }
      return { exists: false };
    }
    
    return {
      exists: true,
      payload: entry.payload,
      expiresAt: entry.expiresAt,
    };
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries.entries()) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }

  getStats(): {
    totalEntries: number;
    expiredEntries: number;
    memoryUsageBytes: number;
  } {
    const now = Date.now();
    let expiredEntries = 0;
    let memoryUsageBytes = 0;
    
    for (const [key, entry] of this.entries.entries()) {
      if (entry.expiresAt <= now) {
        expiredEntries++;
      }
      
      // Rough memory calculation
      memoryUsageBytes += key.length * 2; // key
      memoryUsageBytes += (entry.payload?.length ?? 0) * 2; // payload
      memoryUsageBytes += 32; // timestamps and overhead
    }
    
    return {
      totalEntries: this.entries.size,
      expiredEntries,
      memoryUsageBytes,
    };
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.entries.clear();
  }
}

// Global store instance
let globalIdempotencyStore: MemoryIdempotencyStore | null = null;

/**
 * Get or create the global idempotency store
 */
export function getGlobalIdempotencyStore(): MemoryIdempotencyStore {
  if (!globalIdempotencyStore) {
    globalIdempotencyStore = new MemoryIdempotencyStore();
  }
  return globalIdempotencyStore;
}

/**
 * Check if an operation should be executed (idempotency check)
 * Returns true if this is the first time seeing this key
 */
export async function once(key: string, ttlMs = 10 * 60_000): Promise<boolean> {
  const store = getGlobalIdempotencyStore();
  return store.check(key, ttlMs);
}

/**
 * Store idempotency key with optional payload
 */
export async function store(key: string, ttlMs = 10 * 60_000, payload?: string): Promise<void> {
  const store = getGlobalIdempotencyStore();
  return store.set(key, ttlMs, payload);
}

/**
 * Get idempotency entry
 */
export async function retrieve(key: string): Promise<{ exists: boolean; payload?: string; expiresAt?: number }> {
  const store = getGlobalIdempotencyStore();
  return store.get(key);
}

/**
 * Generate idempotency key from request parameters
 */
export function generateKey(userId: string, operation: string, params?: Record<string, any>): string {
  const paramString = params ? JSON.stringify(params) : "";
  const input = `${userId}:${operation}:${paramString}`;
  
  // Use a simple hash for the key
  return require("crypto").createHash("sha256").update(input).digest("hex").substring(0, 32);
}

/**
 * Idempotency middleware helper for common patterns
 */
export class IdempotencyManager {
  private store: IdempotencyStore;

  constructor(store?: IdempotencyStore) {
    this.store = store ?? getGlobalIdempotencyStore();
  }

  /**
   * Execute operation with idempotency protection
   */
  async execute<T>(
    key: string,
    operation: () => Promise<T>,
    options: {
      ttlMs?: number;
      onDuplicate?: () => Promise<T>;
    } = {}
  ): Promise<T> {
    const { ttlMs = 10 * 60_000, onDuplicate } = options;
    
    const isFirst = await this.store.check(key, ttlMs);
    
    if (!isFirst) {
      if (onDuplicate) {
        return onDuplicate();
      }
      throw new Error(`Duplicate operation detected for key: ${key}`);
    }
    
    try {
      const result = await operation();
      
      // Store the result as payload for potential duplicate requests
      await this.store.set(key, ttlMs, JSON.stringify({ success: true, result }));
      
      return result;
    } catch (error) {
      // Store the error for duplicate requests
      await this.store.set(key, ttlMs, JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }));
      
      throw error;
    }
  }

  /**
   * Get cached result from previous execution
   */
  async getCachedResult<T>(key: string): Promise<T | null> {
    const entry = await this.store.get(key);
    
    if (!entry.exists || !entry.payload) {
      return null;
    }
    
    try {
      const parsed = JSON.parse(entry.payload);
      
      if (parsed.success) {
        return parsed.result;
      } else {
        throw new Error(parsed.error);
      }
    } catch (error) {
      return null;
    }
  }
}
