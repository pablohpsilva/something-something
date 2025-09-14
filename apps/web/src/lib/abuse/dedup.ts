/**
 * Client-side event deduplication using cookies and localStorage
 */

interface DedupEntry {
  key: string;
  timestamp: number;
  count: number;
}

/**
 * LRU cache for event deduplication
 */
class LRUDedupCache {
  private cache = new Map<string, DedupEntry>();
  private maxSize: number;
  private windowMs: number;

  constructor(maxSize = 1000, windowMs = 10 * 60 * 1000) {
    this.maxSize = maxSize;
    this.windowMs = windowMs;
  }

  /**
   * Check if event should be deduplicated
   */
  shouldDedupe(key: string): boolean {
    const now = Date.now();
    const entry = this.cache.get(key);

    // Clean up expired entries
    this.cleanup();

    if (entry && now - entry.timestamp < this.windowMs) {
      // Update count and timestamp
      entry.count++;
      entry.timestamp = now;

      // Move to end (LRU)
      this.cache.delete(key);
      this.cache.set(key, entry);

      return true; // Should dedupe
    }

    // Add new entry
    const newEntry: DedupEntry = {
      key,
      timestamp: now,
      count: 1,
    };

    // Ensure cache size limit
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, newEntry);
    return false; // Don't dedupe
  }

  /**
   * Get entry statistics
   */
  getEntry(key: string): DedupEntry | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp >= this.windowMs) {
      this.cache.delete(key);
      return null;
    }

    return { ...entry };
  }

  /**
   * Clear expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= this.windowMs) {
        toDelete.push(key);
      }
    }

    toDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    windowMs: number;
  } {
    this.cleanup();
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      windowMs: this.windowMs,
    };
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }
}

// Global cache instance
let globalCache: LRUDedupCache | null = null;

function getGlobalCache(): LRUDedupCache {
  if (!globalCache) {
    globalCache = new LRUDedupCache();
  }
  return globalCache;
}

/**
 * Cookie-based deduplication for VIEW events
 */
export class CookieDedupManager {
  private cookieName: string;
  private maxEntries: number;
  private windowMs: number;

  constructor(
    cookieName = "m_evt",
    maxEntries = 100,
    windowMs = 10 * 60 * 1000
  ) {
    this.cookieName = cookieName;
    this.maxEntries = maxEntries;
    this.windowMs = windowMs;
  }

  /**
   * Check if VIEW event should be deduplicated
   */
  shouldDedupeView(ruleId: string): boolean {
    if (typeof document === "undefined") return false;

    const entries = this.getEntries();
    const now = Date.now();
    const key = `view:${ruleId}`;

    // Check if already seen recently
    const existing = entries.find((e) => e.key === key);
    if (existing && now - existing.timestamp < this.windowMs) {
      return true; // Should dedupe
    }

    // Add new entry
    const newEntry: DedupEntry = {
      key,
      timestamp: now,
      count: 1,
    };

    // Remove expired entries
    const validEntries = entries.filter(
      (e) => now - e.timestamp < this.windowMs
    );

    // Add new entry and limit size
    validEntries.push(newEntry);
    const limitedEntries = validEntries.slice(-this.maxEntries);

    // Save back to cookie
    this.setEntries(limitedEntries);

    return false; // Don't dedupe
  }

  /**
   * Get entries from cookie
   */
  private getEntries(): DedupEntry[] {
    try {
      const cookie = document.cookie
        .split(";")
        .find((c) => c.trim().startsWith(`${this.cookieName}=`));

      if (!cookie) return [];

      const value = cookie.split("=")[1];
      if (!value) return [];
      const decoded = decodeURIComponent(value);
      return JSON.parse(decoded);
    } catch (error) {
      console.warn("Failed to parse dedup cookie:", error);
      return [];
    }
  }

  /**
   * Set entries to cookie
   */
  private setEntries(entries: DedupEntry[]): void {
    try {
      const value = JSON.stringify(entries);
      const encoded = encodeURIComponent(value);

      // Set cookie with 1 hour expiry
      const expires = new Date(Date.now() + 60 * 60 * 1000).toUTCString();
      document.cookie = `${this.cookieName}=${encoded}; expires=${expires}; path=/; SameSite=Lax`;
    } catch (error) {
      console.warn("Failed to set dedup cookie:", error);
    }
  }

  /**
   * Clear dedup cookie
   */
  clear(): void {
    if (typeof document !== "undefined") {
      document.cookie = `${this.cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    entries: number;
    cookieSize: number;
  } {
    const entries = this.getEntries();
    const cookieValue = document.cookie
      .split(";")
      .find((c) => c.trim().startsWith(`${this.cookieName}=`));

    return {
      entries: entries.length,
      cookieSize: cookieValue ? cookieValue.length : 0,
    };
  }
}

/**
 * localStorage-based deduplication for authenticated actions
 */
export class LocalStorageDedupManager {
  private storageKey: string;
  private maxEntries: number;
  private windowMs: number;

  constructor(
    storageKey = "abuse_dedup",
    maxEntries = 500,
    windowMs = 10 * 60 * 1000
  ) {
    this.storageKey = storageKey;
    this.maxEntries = maxEntries;
    this.windowMs = windowMs;
  }

  /**
   * Check if action should be deduplicated
   */
  shouldDedupe(actionKey: string): boolean {
    if (typeof localStorage === "undefined") return false;

    const entries = this.getEntries();
    const now = Date.now();

    // Check if already seen recently
    const existing = entries.find((e) => e.key === actionKey);
    if (existing && now - existing.timestamp < this.windowMs) {
      existing.count++;
      existing.timestamp = now;
      this.setEntries(entries);
      return true; // Should dedupe
    }

    // Add new entry
    const newEntry: DedupEntry = {
      key: actionKey,
      timestamp: now,
      count: 1,
    };

    // Remove expired entries
    const validEntries = entries.filter(
      (e) => now - e.timestamp < this.windowMs
    );

    // Add new entry and limit size
    validEntries.push(newEntry);
    const limitedEntries = validEntries.slice(-this.maxEntries);

    // Save back to localStorage
    this.setEntries(limitedEntries);

    return false; // Don't dedupe
  }

  /**
   * Get entries from localStorage
   */
  private getEntries(): DedupEntry[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.warn("Failed to parse dedup localStorage:", error);
      return [];
    }
  }

  /**
   * Set entries to localStorage
   */
  private setEntries(entries: DedupEntry[]): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(entries));
    } catch (error) {
      console.warn("Failed to set dedup localStorage:", error);

      // If storage is full, clear old entries and try again
      if (error instanceof Error && error.name === "QuotaExceededError") {
        const halfEntries = entries.slice(-Math.floor(entries.length / 2));
        try {
          localStorage.setItem(this.storageKey, JSON.stringify(halfEntries));
        } catch (retryError) {
          console.error(
            "Failed to set dedup localStorage after cleanup:",
            retryError
          );
        }
      }
    }
  }

  /**
   * Clear localStorage
   */
  clear(): void {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(this.storageKey);
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    entries: number;
    storageSize: number;
  } {
    const entries = this.getEntries();
    const stored =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(this.storageKey)
        : null;

    return {
      entries: entries.length,
      storageSize: stored ? stored.length : 0,
    };
  }
}

// Global instances
let globalCookieManager: CookieDedupManager | null = null;
let globalLocalStorageManager: LocalStorageDedupManager | null = null;

export function getCookieDedupManager(): CookieDedupManager {
  if (!globalCookieManager) {
    globalCookieManager = new CookieDedupManager();
  }
  return globalCookieManager;
}

export function getLocalStorageDedupManager(): LocalStorageDedupManager {
  if (!globalLocalStorageManager) {
    globalLocalStorageManager = new LocalStorageDedupManager();
  }
  return globalLocalStorageManager;
}

/**
 * High-level deduplication functions
 */
export function shouldDedupeView(ruleId: string): boolean {
  const manager = getCookieDedupManager();
  return manager.shouldDedupeView(ruleId);
}

export function shouldDedupeAction(actionKey: string): boolean {
  const manager = getLocalStorageDedupManager();
  return manager.shouldDedupe(actionKey);
}

export function shouldDedupeMemory(key: string): boolean {
  const cache = getGlobalCache();
  return cache.shouldDedupe(key);
}

/**
 * Generate action key for deduplication
 */
export function generateActionKey(
  action: string,
  targetId?: string,
  userId?: string
): string {
  const parts = [action];
  if (targetId) parts.push(targetId);
  if (userId) parts.push(userId);
  return parts.join(":");
}

/**
 * Clear all deduplication data
 */
export function clearAllDedup(): void {
  getCookieDedupManager().clear();
  getLocalStorageDedupManager().clear();
  getGlobalCache().clear();
}

/**
 * Get comprehensive deduplication statistics
 */
export function getDedupStats(): {
  memory: ReturnType<LRUDedupCache["getStats"]>;
  cookie: ReturnType<CookieDedupManager["getStats"]>;
  localStorage: ReturnType<LocalStorageDedupManager["getStats"]>;
} {
  return {
    memory: getGlobalCache().getStats(),
    cookie: getCookieDedupManager().getStats(),
    localStorage: getLocalStorageDedupManager().getStats(),
  };
}
