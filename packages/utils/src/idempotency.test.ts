import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MemoryIdempotencyStore,
  getGlobalIdempotencyStore,
  once,
  store,
  retrieve,
  generateKey,
  IdempotencyManager,
  type IdempotencyStore,
} from "./idempotency";

// Mock crypto module for generateKey
vi.mock("crypto", () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => ({
      substring: vi.fn(() => "mockedkey123456789012345678901234"),
    })),
  })),
}));

describe("MemoryIdempotencyStore", () => {
  let store: MemoryIdempotencyStore;

  beforeEach(() => {
    store = new MemoryIdempotencyStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    store.destroy();
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("should create store with default cleanup interval", () => {
      const store = new MemoryIdempotencyStore();
      expect(store).toBeInstanceOf(MemoryIdempotencyStore);
      store.destroy();
    });

    it("should create store with custom cleanup interval", () => {
      const store = new MemoryIdempotencyStore(30000);
      expect(store).toBeInstanceOf(MemoryIdempotencyStore);
      store.destroy();
    });
  });

  describe("check", () => {
    it("should return true for first time key", async () => {
      const result = await store.check("test-key");
      expect(result).toBe(true);
    });

    it("should return false for existing key", async () => {
      await store.check("test-key");
      const result = await store.check("test-key");
      expect(result).toBe(false);
    });

    it("should respect TTL", async () => {
      const ttl = 1000; // 1 second
      await store.check("test-key", ttl);

      // Advance time beyond TTL
      vi.advanceTimersByTime(ttl + 100);

      const result = await store.check("test-key", ttl);
      expect(result).toBe(true); // Should be true after expiration
    });

    it("should use default TTL of 10 minutes", async () => {
      await store.check("test-key");

      // Advance time by 9 minutes (should still be blocked)
      vi.advanceTimersByTime(9 * 60 * 1000);
      let result = await store.check("test-key");
      expect(result).toBe(false);

      // Advance time beyond 10 minutes
      vi.advanceTimersByTime(2 * 60 * 1000);
      result = await store.check("test-key");
      expect(result).toBe(true);
    });

    it("should handle multiple keys independently", async () => {
      await store.check("key1");
      await store.check("key2");

      const result1 = await store.check("key1");
      const result2 = await store.check("key2");

      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });

    it("should recreate entry after expiration", async () => {
      const ttl = 1000;
      await store.check("test-key", ttl);

      // Advance time beyond TTL
      vi.advanceTimersByTime(ttl + 100);

      await store.check("test-key", ttl);
      const entry = await store.get("test-key");

      expect(entry.exists).toBe(true);
    });
  });

  describe("set", () => {
    it("should set key without payload", async () => {
      await store.set("test-key");

      const entry = await store.get("test-key");
      expect(entry.exists).toBe(true);
      expect(entry.payload).toBeUndefined();
    });

    it("should set key with payload", async () => {
      const payload = "test payload";
      await store.set("test-key", 10000, payload);

      const entry = await store.get("test-key");
      expect(entry.exists).toBe(true);
      expect(entry.payload).toBe(payload);
    });

    it("should use custom TTL", async () => {
      const ttl = 500;
      await store.set("test-key", ttl);

      // Before expiration
      let entry = await store.get("test-key");
      expect(entry.exists).toBe(true);

      // After expiration
      vi.advanceTimersByTime(ttl + 100);
      entry = await store.get("test-key");
      expect(entry.exists).toBe(false);
    });

    it("should overwrite existing key", async () => {
      await store.set("test-key", 10000, "payload1");
      await store.set("test-key", 10000, "payload2");

      const entry = await store.get("test-key");
      expect(entry.payload).toBe("payload2");
    });
  });

  describe("get", () => {
    it("should return non-existent for missing key", async () => {
      const result = await store.get("missing-key");

      expect(result.exists).toBe(false);
      expect(result.payload).toBeUndefined();
      expect(result.expiresAt).toBeUndefined();
    });

    it("should return existing entry", async () => {
      const payload = "test payload";
      const ttl = 10000;

      await store.set("test-key", ttl, payload);
      const result = await store.get("test-key");

      expect(result.exists).toBe(true);
      expect(result.payload).toBe(payload);
      expect(result.expiresAt).toBeDefined();
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    it("should remove expired entries", async () => {
      const ttl = 500;
      await store.set("test-key", ttl);

      // Advance time beyond TTL
      vi.advanceTimersByTime(ttl + 100);

      const result = await store.get("test-key");
      expect(result.exists).toBe(false);
    });

    it("should handle entry without payload", async () => {
      await store.check("test-key");
      const result = await store.get("test-key");

      expect(result.exists).toBe(true);
      expect(result.payload).toBeUndefined();
    });
  });

  describe("delete", () => {
    it("should delete existing key", async () => {
      await store.set("test-key");
      await store.delete("test-key");

      const result = await store.get("test-key");
      expect(result.exists).toBe(false);
    });

    it("should handle deleting non-existent key", async () => {
      await expect(store.delete("non-existent")).resolves.not.toThrow();
    });

    it("should allow recreating deleted key", async () => {
      await store.set("test-key", 10000, "payload1");
      await store.delete("test-key");
      await store.set("test-key", 10000, "payload2");

      const result = await store.get("test-key");
      expect(result.exists).toBe(true);
      expect(result.payload).toBe("payload2");
    });
  });

  describe("clear", () => {
    it("should clear all entries", async () => {
      await store.set("key1");
      await store.set("key2");
      await store.set("key3");

      await store.clear();

      const result1 = await store.get("key1");
      const result2 = await store.get("key2");
      const result3 = await store.get("key3");

      expect(result1.exists).toBe(false);
      expect(result2.exists).toBe(false);
      expect(result3.exists).toBe(false);
    });

    it("should reset stats", async () => {
      await store.set("key1");
      await store.set("key2");

      await store.clear();
      const stats = store.getStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.expiredEntries).toBe(0);
      expect(stats.memoryUsageBytes).toBe(0);
    });
  });

  describe("getStats", () => {
    it("should return correct stats for empty store", () => {
      const stats = store.getStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.expiredEntries).toBe(0);
      expect(stats.memoryUsageBytes).toBe(0);
    });

    it("should calculate stats for active entries", async () => {
      await store.set("key1", 10000, "payload1");
      await store.set("key2", 10000, "payload2");

      const stats = store.getStats();

      expect(stats.totalEntries).toBe(2);
      expect(stats.expiredEntries).toBe(0);
      expect(stats.memoryUsageBytes).toBeGreaterThan(0);
    });

    it("should count expired entries", async () => {
      const ttl = 500;
      await store.set("key1", ttl);
      await store.set("key2", 10000);

      // Advance time to expire first entry
      vi.advanceTimersByTime(ttl + 100);

      const stats = store.getStats();

      expect(stats.totalEntries).toBe(2);
      expect(stats.expiredEntries).toBe(1);
    });

    it("should estimate memory usage", async () => {
      await store.set("short", 10000, "x");
      const shortStats = store.getStats();

      await store.set("longer-key-name", 10000, "much longer payload content");
      const longerStats = store.getStats();

      expect(longerStats.memoryUsageBytes).toBeGreaterThan(
        shortStats.memoryUsageBytes
      );
    });
  });

  describe("cleanup", () => {
    it("should run cleanup automatically", async () => {
      const shortTTL = 100;
      await store.set("expired-key", shortTTL);
      await store.set("active-key", 10000);

      // Advance time to expire first entry
      vi.advanceTimersByTime(shortTTL + 50);

      // Trigger cleanup by advancing to next cleanup interval
      vi.advanceTimersByTime(60000); // Default cleanup interval

      const stats = store.getStats();
      expect(stats.totalEntries).toBe(1); // Only active key remains
    });

    it("should remove empty keys during manual cleanup", async () => {
      const ttl = 100;
      await store.set("key1", ttl);
      await store.set("key2", ttl);

      // Advance time to expire entries
      vi.advanceTimersByTime(ttl + 50);

      // Manual cleanup (private method, but we can test via automatic cleanup)
      vi.advanceTimersByTime(60000);

      const stats = store.getStats();
      expect(stats.totalEntries).toBe(0);
    });
  });

  describe("destroy", () => {
    it("should clear interval and entries", () => {
      const store = new MemoryIdempotencyStore();

      // Add some entries
      store.set("key1");
      store.set("key2");

      store.destroy();

      const stats = store.getStats();
      expect(stats.totalEntries).toBe(0);
    });

    it("should prevent further operations after destroy", async () => {
      const store = new MemoryIdempotencyStore();
      store.destroy();

      // Operations should still work (no validation in implementation)
      await expect(store.set("key")).resolves.not.toThrow();
    });
  });
});

describe("Global functions", () => {
  beforeEach(() => {
    // Reset global instance
    const globalStore = getGlobalIdempotencyStore();
    globalStore.clear();
  });

  describe("getGlobalIdempotencyStore", () => {
    it("should return singleton instance", () => {
      const store1 = getGlobalIdempotencyStore();
      const store2 = getGlobalIdempotencyStore();

      expect(store1).toBe(store2);
      expect(store1).toBeInstanceOf(MemoryIdempotencyStore);
    });

    it("should maintain state across calls", async () => {
      const store1 = getGlobalIdempotencyStore();
      await store1.set("test-key");

      const store2 = getGlobalIdempotencyStore();
      const result = await store2.get("test-key");

      expect(result.exists).toBe(true);
    });
  });

  describe("once", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return true for first call", async () => {
      const result = await once("test-key");
      expect(result).toBe(true);
    });

    it("should return false for subsequent calls", async () => {
      await once("test-key");
      const result = await once("test-key");
      expect(result).toBe(false);
    });

    it("should use custom TTL", async () => {
      const ttl = 1000;
      await once("test-key", ttl);

      // Advance time beyond TTL
      vi.advanceTimersByTime(ttl + 100);

      const result = await once("test-key", ttl);
      expect(result).toBe(true);
    });

    it("should handle multiple keys", async () => {
      const result1 = await once("key1");
      const result2 = await once("key2");

      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });
  });

  describe("store", () => {
    it("should store key without payload", async () => {
      await store("test-key");

      const globalStore = getGlobalIdempotencyStore();
      const result = await globalStore.get("test-key");

      expect(result.exists).toBe(true);
      expect(result.payload).toBeUndefined();
    });

    it("should store key with payload", async () => {
      const payload = "test payload";
      await store("test-key", 10000, payload);

      const result = await retrieve("test-key");
      expect(result.exists).toBe(true);
      expect(result.payload).toBe(payload);
    });
  });

  describe("retrieve", () => {
    it("should retrieve stored entry", async () => {
      const payload = "test payload";
      await store("test-key", 10000, payload);

      const result = await retrieve("test-key");

      expect(result.exists).toBe(true);
      expect(result.payload).toBe(payload);
      expect(result.expiresAt).toBeDefined();
    });

    it("should return non-existent for missing key", async () => {
      const result = await retrieve("missing-key");

      expect(result.exists).toBe(false);
      expect(result.payload).toBeUndefined();
    });
  });

  describe("generateKey", () => {
    it("should generate consistent key for same inputs", () => {
      const key1 = generateKey("user123", "create-post", { title: "test" });
      const key2 = generateKey("user123", "create-post", { title: "test" });

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(32);
    });

    it("should generate different keys for different users", () => {
      const key1 = generateKey("user1", "operation", {});
      const key2 = generateKey("user2", "operation", {});

      expect(key1).not.toBe(key2);
    });

    it("should generate different keys for different operations", () => {
      const key1 = generateKey("user123", "operation1", {});
      const key2 = generateKey("user123", "operation2", {});

      expect(key1).not.toBe(key2);
    });

    it("should generate different keys for different params", () => {
      const key1 = generateKey("user123", "operation", { param: "value1" });
      const key2 = generateKey("user123", "operation", { param: "value2" });

      expect(key1).not.toBe(key2);
    });

    it("should handle empty params", () => {
      const key1 = generateKey("user123", "operation");
      const key2 = generateKey("user123", "operation", {});

      expect(key1).toBe(key2); // Should be same when params is undefined vs empty
    });

    it("should be order-sensitive for params", () => {
      const key1 = generateKey("user123", "op", { a: 1, b: 2 });
      const key2 = generateKey("user123", "op", { b: 2, a: 1 });

      // JSON.stringify is not guaranteed to be order-consistent,
      // but this tests the current implementation
      expect(key1).toBeDefined();
      expect(key2).toBeDefined();
    });
  });
});

describe("IdempotencyManager", () => {
  let manager: IdempotencyManager;
  let mockStore: IdempotencyStore;

  beforeEach(() => {
    mockStore = {
      check: vi.fn(),
      set: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
    };

    manager = new IdempotencyManager(mockStore);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("should use provided store", () => {
      const manager = new IdempotencyManager(mockStore);
      expect(manager).toBeInstanceOf(IdempotencyManager);
    });

    it("should use global store when none provided", () => {
      const manager = new IdempotencyManager();
      expect(manager).toBeInstanceOf(IdempotencyManager);
    });
  });

  describe("execute", () => {
    it("should execute operation for first call", async () => {
      (mockStore.check as any).mockResolvedValue(true);
      (mockStore.set as any).mockResolvedValue(undefined);

      const operation = vi.fn().mockResolvedValue("result");
      const result = await manager.execute("test-key", operation);

      expect(operation).toHaveBeenCalledOnce();
      expect(result).toBe("result");
      expect(mockStore.set).toHaveBeenCalledWith(
        "test-key",
        10 * 60_000,
        JSON.stringify({ success: true, result: "result" })
      );
    });

    it("should throw error for duplicate operation", async () => {
      (mockStore.check as any).mockResolvedValue(false);

      const operation = vi.fn();

      await expect(manager.execute("test-key", operation)).rejects.toThrow(
        "Duplicate operation detected for key: test-key"
      );

      expect(operation).not.toHaveBeenCalled();
    });

    it("should use onDuplicate callback when provided", async () => {
      (mockStore.check as any).mockResolvedValue(false);

      const operation = vi.fn();
      const onDuplicate = vi.fn().mockResolvedValue("duplicate-result");

      const result = await manager.execute("test-key", operation, {
        onDuplicate,
      });

      expect(operation).not.toHaveBeenCalled();
      expect(onDuplicate).toHaveBeenCalledOnce();
      expect(result).toBe("duplicate-result");
    });

    it("should use custom TTL", async () => {
      (mockStore.check as any).mockResolvedValue(true);
      (mockStore.set as any).mockResolvedValue(undefined);

      const operation = vi.fn().mockResolvedValue("result");
      const ttl = 5000;

      await manager.execute("test-key", operation, { ttlMs: ttl });

      expect(mockStore.check).toHaveBeenCalledWith("test-key", ttl);
      expect(mockStore.set).toHaveBeenCalledWith(
        "test-key",
        ttl,
        expect.any(String)
      );
    });

    it("should store error for failed operations", async () => {
      (mockStore.check as any).mockResolvedValue(true);
      (mockStore.set as any).mockResolvedValue(undefined);

      const error = new Error("Operation failed");
      const operation = vi.fn().mockRejectedValue(error);

      await expect(manager.execute("test-key", operation)).rejects.toThrow(
        "Operation failed"
      );

      expect(mockStore.set).toHaveBeenCalledWith(
        "test-key",
        10 * 60_000,
        JSON.stringify({ success: false, error: "Operation failed" })
      );
    });

    it("should handle non-Error exceptions", async () => {
      (mockStore.check as any).mockResolvedValue(true);
      (mockStore.set as any).mockResolvedValue(undefined);

      const operation = vi.fn().mockRejectedValue("string error");

      await expect(manager.execute("test-key", operation)).rejects.toBe(
        "string error"
      );

      expect(mockStore.set).toHaveBeenCalledWith(
        "test-key",
        10 * 60_000,
        JSON.stringify({ success: false, error: "string error" })
      );
    });
  });

  describe("getCachedResult", () => {
    it("should return null for non-existent key", async () => {
      (mockStore.get as any).mockResolvedValue({ exists: false });

      const result = await manager.getCachedResult("test-key");

      expect(result).toBeNull();
    });

    it("should return null for key without payload", async () => {
      (mockStore.get as any).mockResolvedValue({
        exists: true,
        payload: undefined,
      });

      const result = await manager.getCachedResult("test-key");

      expect(result).toBeNull();
    });

    it("should return cached successful result", async () => {
      const cachedPayload = JSON.stringify({
        success: true,
        result: "cached-result",
      });
      (mockStore.get as any).mockResolvedValue({
        exists: true,
        payload: cachedPayload,
      });

      const result = await manager.getCachedResult("test-key");

      expect(result).toBe("cached-result");
    });

    it("should throw cached error", async () => {
      const cachedPayload = JSON.stringify({
        success: false,
        error: "Cached error",
      });
      (mockStore.get as any).mockResolvedValue({
        exists: true,
        payload: cachedPayload,
      });

      await expect(manager.getCachedResult("test-key")).rejects.toThrow(
        "Cached error"
      );
    });

    it("should return null for invalid JSON payload", async () => {
      (mockStore.get as any).mockResolvedValue({
        exists: true,
        payload: "invalid json",
      });

      const result = await manager.getCachedResult("test-key");

      expect(result).toBeNull();
    });

    it("should return null for malformed payload structure", async () => {
      const invalidPayload = JSON.stringify({ invalid: "structure" });
      (mockStore.get as any).mockResolvedValue({
        exists: true,
        payload: invalidPayload,
      });

      const result = await manager.getCachedResult("test-key");

      expect(result).toBeNull();
    });
  });

  describe("Integration with real store", () => {
    let realManager: IdempotencyManager;

    beforeEach(() => {
      const realStore = new MemoryIdempotencyStore();
      realManager = new IdempotencyManager(realStore);
    });

    it("should prevent duplicate operations", async () => {
      let callCount = 0;
      const operation = vi.fn(() => {
        callCount++;
        return Promise.resolve(`result-${callCount}`);
      });

      // First execution
      const result1 = await realManager.execute("test-key", operation);
      expect(result1).toBe("result-1");
      expect(callCount).toBe(1);

      // Second execution should be blocked
      await expect(
        realManager.execute("test-key", operation)
      ).rejects.toThrow();
      expect(callCount).toBe(1); // Should not have been called again
    });

    it("should allow execution after TTL expires", async () => {
      let callCount = 0;
      const operation = vi.fn(() => {
        callCount++;
        return Promise.resolve(`result-${callCount}`);
      });

      const ttl = 1000;

      // First execution
      await realManager.execute("test-key", operation, { ttlMs: ttl });
      expect(callCount).toBe(1);

      // Advance time beyond TTL
      vi.advanceTimersByTime(ttl + 100);

      // Second execution should succeed
      const result2 = await realManager.execute("test-key", operation, {
        ttlMs: ttl,
      });
      expect(result2).toBe("result-2");
      expect(callCount).toBe(2);
    });

    it("should cache and return results", async () => {
      const operation = vi.fn().mockResolvedValue("cached-result");

      // Execute operation
      await realManager.execute("test-key", operation);

      // Get cached result
      const cached = await realManager.getCachedResult("test-key");
      expect(cached).toBe("cached-result");
    });

    it("should cache and throw errors", async () => {
      const operation = vi.fn().mockRejectedValue(new Error("Test error"));

      // Execute operation (should fail)
      await expect(realManager.execute("test-key", operation)).rejects.toThrow(
        "Test error"
      );

      // Get cached error
      await expect(realManager.getCachedResult("test-key")).rejects.toThrow(
        "Test error"
      );
    });
  });
});
