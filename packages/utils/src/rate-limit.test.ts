import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryRateLimitStore, limit, makeKey } from "./rate-limit";

describe("Rate Limiting", () => {
  beforeEach(() => {
    // Reset time mocks
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("MemoryRateLimitStore", () => {
    it("should allow requests within limit", async () => {
      const store = new MemoryRateLimitStore();
      const key = "test-key";
      const windowMs = 60000; // 1 minute
      const maxRequests = 5;

      // Should allow first 5 requests
      for (let i = 0; i < 5; i++) {
        const result = await store.consume(key, 1, windowMs, maxRequests);
        expect(result.ok).toBe(true);
        expect(result.remaining).toBe(4 - i);
        expect(result.resetMs).toBeGreaterThanOrEqual(0);
      }
    });

    it("should block requests exceeding limit", async () => {
      const store = new MemoryRateLimitStore();
      const key = "test-key";
      const windowMs = 60000;
      const maxRequests = 3;

      // Consume all allowed requests
      for (let i = 0; i < 3; i++) {
        await store.consume(key, 1, windowMs, maxRequests);
      }

      // Next request should be blocked
      const result = await store.consume(key, 1, windowMs, maxRequests);
      expect(result.ok).toBe(false);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it("should reset window after time expires", async () => {
      const store = new MemoryRateLimitStore();
      const key = "test-key";
      const windowMs = 60000;
      const maxRequests = 2;

      // Consume all requests
      await store.consume(key, 1, windowMs, maxRequests);
      await store.consume(key, 1, windowMs, maxRequests);

      // Should be blocked
      let result = await store.consume(key, 1, windowMs, maxRequests);
      expect(result.ok).toBe(false);

      // Advance time past window
      vi.advanceTimersByTime(windowMs + 1000);

      // Should be allowed again
      result = await store.consume(key, 1, windowMs, maxRequests);
      expect(result.ok).toBe(true);
      expect(result.remaining).toBe(1);
    });

    it("should handle multiple keys independently", async () => {
      const store = new MemoryRateLimitStore();
      const windowMs = 60000;
      const maxRequests = 2;

      // Consume requests for key1
      await store.consume("key1", 1, windowMs, maxRequests);
      await store.consume("key1", 1, windowMs, maxRequests);

      // key1 should be blocked
      let result = await store.consume("key1", 1, windowMs, maxRequests);
      expect(result.ok).toBe(false);

      // key2 should still be allowed
      result = await store.consume("key2", 1, windowMs, maxRequests);
      expect(result.ok).toBe(true);
    });

    it("should provide accurate window information", async () => {
      const store = new MemoryRateLimitStore();
      const key = "test-key";
      const windowMs = 60000;
      const maxRequests = 5;

      const window = await store.getWindow(key, windowMs, maxRequests);
      expect(window?.remaining).toBe(5);
      expect(window?.resetMs).toBeGreaterThanOrEqual(0);

      // Make some requests
      await store.consume(key, 1, windowMs, maxRequests);
      await store.consume(key, 1, windowMs, maxRequests);

      const updatedWindow = await store.getWindow(key, windowMs, maxRequests);
      expect(updatedWindow?.remaining).toBe(3);
    });
  });

  describe("makeKey", () => {
    it("should create consistent keys from same inputs", () => {
      const key1 = makeKey({ bucket: "action", userId: "user", ipHash: "127.0.0.1" });
      const key2 = makeKey({ bucket: "action", userId: "user", ipHash: "127.0.0.1" });
      expect(key1).toBe(key2);
    });

    it("should create different keys for different inputs", () => {
      const key1 = makeKey({ bucket: "action", userId: "user1", ipHash: "127.0.0.1" });
      const key2 = makeKey({ bucket: "action", userId: "user2", ipHash: "127.0.0.1" });
      expect(key1).not.toBe(key2);
    });

    it("should handle optional metadata", () => {
      const key1 = makeKey({ bucket: "action", userId: "user" });
      const key2 = makeKey({ bucket: "action", userId: "user" });
      const key3 = makeKey({ bucket: "action", userId: "user", ipHash: "127.0.0.1" });

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });
  });

  describe("limit function", () => {
    it("should apply rate limiting correctly", async () => {
      const config = {
        windowMs: 60000,
        limit: 3,
      };

      // First 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        const result = await limit({ bucket: "test-action", userId: "test-user" }, config);
        expect(result.ok).toBe(true);
      }

      // 4th request should fail
      const result = await limit({ bucket: "test-action", userId: "test-user" }, config);
      expect(result.ok).toBe(false);
    });

    it("should handle different users independently", async () => {
      const config = {
        windowMs: 60000,
        limit: 1,
      };

      // User 1 makes request
      let result = await limit({ bucket: "action", userId: "user1" }, config);
      expect(result.ok).toBe(true);

      // User 1 is now blocked
      result = await limit({ bucket: "action", userId: "user1" }, config);
      expect(result.ok).toBe(false);

      // User 2 should still be allowed
      result = await limit({ bucket: "action", userId: "user2" }, config);
      expect(result.ok).toBe(true);
    });

    it("should include metadata in rate limit key", async () => {
      const config = {
        windowMs: 60000,
        limit: 1,
      };

      // Same user, different IPs should be tracked separately
      let result = await limit({
        bucket: "action",
        userId: "user1",
        ipHash: "192.168.1.1",
      }, config);
      expect(result.ok).toBe(true);

      result = await limit({
        bucket: "action",
        userId: "user1",
        ipHash: "192.168.1.2",
      }, config);
      expect(result.ok).toBe(true);

      // Same IP should be blocked
      result = await limit({
        bucket: "action",
        userId: "user1",
        ipHash: "192.168.1.1",
      }, config);
      expect(result.ok).toBe(false);
    });
  });
});
