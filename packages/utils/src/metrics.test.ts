import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  METRICS_WINDOW_RECENT_DAYS,
  METRICS_WINDOW_LONG_DAYS,
  VIEW_DEDUP_WINDOW_MIN,
  RATE_LIMIT_EVENTS_PER_MIN,
  TREND_DECAY_LAMBDA,
  TREND_WEIGHTS,
  EVENT_ENDPOINT,
  MAX_VIEWS_PER_IP_PER_RULE_PER_DAY,
  MAX_EVENTS_PER_IP_PER_MINUTE,
  decayWeight,
  calculateTrendingScore,
  generateIdempotencyKey,
  EVENT_TYPES,
  isValidEventType,
  getMetricsDateRange,
  shouldRateLimit,
  capViewCount,
  simpleHash,
  getViewDedupeCookieName,
  shouldDedupeView,
  setViewDedupeCookie,
  type EventType,
} from "./metrics";

// Mock document for browser-related tests
const mockDocument = {
  cookie: "",
};

Object.defineProperty(global, "document", {
  value: mockDocument,
  writable: true,
});

describe("Metrics utilities", () => {
  describe("Constants", () => {
    it("should have correct metric window constants", () => {
      expect(METRICS_WINDOW_RECENT_DAYS).toBe(7);
      expect(METRICS_WINDOW_LONG_DAYS).toBe(30);
    });

    it("should have correct deduplication and rate limiting constants", () => {
      expect(VIEW_DEDUP_WINDOW_MIN).toBe(10);
      expect(RATE_LIMIT_EVENTS_PER_MIN).toBe(60);
    });

    it("should have correct trending calculation constants", () => {
      expect(TREND_DECAY_LAMBDA).toBe(0.25);
      expect(TREND_WEIGHTS).toEqual({
        views: 0.4,
        copies: 0.3,
        saves: 0.2,
        votes: 0.1,
      });
    });

    it("should have correct API and anti-gaming constants", () => {
      expect(EVENT_ENDPOINT).toBe("/ingest/events");
      expect(MAX_VIEWS_PER_IP_PER_RULE_PER_DAY).toBe(5);
      expect(MAX_EVENTS_PER_IP_PER_MINUTE).toBe(20);
    });

    it("should have trending weights sum to 1.0", () => {
      const sum = Object.values(TREND_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });
  });

  describe("decayWeight", () => {
    it("should return 1 for current day (0 days ago)", () => {
      const weight = decayWeight(0);
      expect(weight).toBe(1);
    });

    it("should return values between 0 and 1", () => {
      for (let days = 0; days <= 10; days++) {
        const weight = decayWeight(days);
        expect(weight).toBeGreaterThanOrEqual(0);
        expect(weight).toBeLessThanOrEqual(1);
      }
    });

    it("should decrease as days increase", () => {
      const weight0 = decayWeight(0);
      const weight1 = decayWeight(1);
      const weight2 = decayWeight(2);
      const weight7 = decayWeight(7);

      expect(weight0).toBeGreaterThan(weight1);
      expect(weight1).toBeGreaterThan(weight2);
      expect(weight2).toBeGreaterThan(weight7);
    });

    it("should calculate correct exponential decay", () => {
      const weight1 = decayWeight(1);
      const expectedWeight1 = Math.exp(-TREND_DECAY_LAMBDA * 1);
      expect(weight1).toBeCloseTo(expectedWeight1, 10);

      const weight3 = decayWeight(3);
      const expectedWeight3 = Math.exp(-TREND_DECAY_LAMBDA * 3);
      expect(weight3).toBeCloseTo(expectedWeight3, 10);
    });

    it("should handle fractional days", () => {
      const weight0_5 = decayWeight(0.5);
      const weight1 = decayWeight(1);

      expect(weight0_5).toBeGreaterThan(weight1);
    });

    it("should approach zero for large values", () => {
      const weightLarge = decayWeight(50);
      expect(weightLarge).toBeCloseTo(0, 5);
    });
  });

  describe("calculateTrendingScore", () => {
    it("should return 0 for empty metrics", () => {
      const score = calculateTrendingScore([]);
      expect(score).toBe(0);
    });

    it("should calculate score for single day", () => {
      const metrics = [{ views: 100, copies: 50, saves: 25, votes: 10 }];

      const score = calculateTrendingScore(metrics);
      const expectedScore =
        TREND_WEIGHTS.views * 100 +
        TREND_WEIGHTS.copies * 50 +
        TREND_WEIGHTS.saves * 25 +
        TREND_WEIGHTS.votes * 10;

      expect(score).toBeCloseTo(expectedScore, 2);
    });

    it("should apply decay weights for multiple days", () => {
      const metrics = [
        { views: 100, copies: 50, saves: 25, votes: 10 }, // Today (day 0)
        { views: 80, copies: 40, saves: 20, votes: 8 }, // Yesterday (day 1)
        { views: 60, copies: 30, saves: 15, votes: 6 }, // Day 2
      ];

      const score = calculateTrendingScore(metrics);

      let expectedScore = 0;
      metrics.forEach((metric, day) => {
        const weight = decayWeight(day);
        expectedScore +=
          weight *
          (TREND_WEIGHTS.views * metric.views +
            TREND_WEIGHTS.copies * metric.copies +
            TREND_WEIGHTS.saves * metric.saves +
            TREND_WEIGHTS.votes * metric.votes);
      });

      expect(score).toBeCloseTo(expectedScore, 2);
    });

    it("should limit to 7 days maximum", () => {
      const metrics = Array.from({ length: 10 }, (_, i) => ({
        views: 100 - i * 10,
        copies: 50 - i * 5,
        saves: 25 - i * 2,
        votes: 10 - i,
      }));

      const score = calculateTrendingScore(metrics);

      // Manually calculate for first 7 days only
      let expectedScore = 0;
      for (let d = 0; d < 7; d++) {
        const metric = metrics[d];
        if (!metric) continue;

        const weight = decayWeight(d);
        expectedScore +=
          weight *
          (TREND_WEIGHTS.views * metric.views +
            TREND_WEIGHTS.copies * metric.copies +
            TREND_WEIGHTS.saves * metric.saves +
            TREND_WEIGHTS.votes * metric.votes);
      }

      expect(score).toBeCloseTo(expectedScore, 2);
    });

    it("should handle missing metrics (undefined)", () => {
      const metrics = [
        { views: 100, copies: 50, saves: 25, votes: 10 },
        undefined as any,
        { views: 60, copies: 30, saves: 15, votes: 6 },
      ];

      const score = calculateTrendingScore(metrics);

      // Should skip undefined entries
      const day0Score =
        1 *
        (TREND_WEIGHTS.views * 100 +
          TREND_WEIGHTS.copies * 50 +
          TREND_WEIGHTS.saves * 25 +
          TREND_WEIGHTS.votes * 10);

      const day2Score =
        decayWeight(2) *
        (TREND_WEIGHTS.views * 60 +
          TREND_WEIGHTS.copies * 30 +
          TREND_WEIGHTS.saves * 15 +
          TREND_WEIGHTS.votes * 6);

      const expectedScore = day0Score + day2Score;
      expect(score).toBeCloseTo(expectedScore, 2);
    });

    it("should round to 2 decimal places", () => {
      const metrics = [{ views: 1, copies: 1, saves: 1, votes: 1 }];

      const score = calculateTrendingScore(metrics);

      // Check that result has at most 2 decimal places
      const decimalPlaces = (score.toString().split(".")[1] || "").length;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });

    it("should handle zero values", () => {
      const metrics = [
        { views: 0, copies: 0, saves: 0, votes: 0 },
        { views: 100, copies: 0, saves: 0, votes: 0 },
      ];

      const score = calculateTrendingScore(metrics);
      const expectedScore = decayWeight(1) * TREND_WEIGHTS.views * 100;

      expect(score).toBeCloseTo(expectedScore, 2);
    });
  });

  describe("generateIdempotencyKey", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should generate key with user ID", () => {
      const fixedTime = 1640995200000;
      vi.setSystemTime(fixedTime);

      const key = generateIdempotencyKey(
        "user123",
        "ip-hash",
        "rule456",
        "VIEW"
      );
      const expectedTimeBucket = Math.floor(fixedTime / (16 * 1000));

      expect(key).toBe(`user123-rule456-VIEW-${expectedTimeBucket}`);
    });

    it("should use IP hash when user ID is null", () => {
      const fixedTime = 1640995200000;
      vi.setSystemTime(fixedTime);

      const key = generateIdempotencyKey(null, "ip-hash", "rule456", "VIEW");
      const expectedTimeBucket = Math.floor(fixedTime / (16 * 1000));

      expect(key).toBe(`ip-hash-rule456-VIEW-${expectedTimeBucket}`);
    });

    it("should create different keys for different time buckets", () => {
      const time1 = 1640995200000; // Start of bucket
      const time2 = 1640995216000; // 16 seconds later (new bucket)

      vi.setSystemTime(time1);
      const key1 = generateIdempotencyKey(
        "user123",
        "ip-hash",
        "rule456",
        "VIEW"
      );

      vi.setSystemTime(time2);
      const key2 = generateIdempotencyKey(
        "user123",
        "ip-hash",
        "rule456",
        "VIEW"
      );

      expect(key1).not.toBe(key2);
    });

    it("should create same key within time bucket", () => {
      const time1 = 1640995200000;
      const time2 = 1640995210000; // 10 seconds later (same bucket)

      vi.setSystemTime(time1);
      const key1 = generateIdempotencyKey(
        "user123",
        "ip-hash",
        "rule456",
        "VIEW"
      );

      vi.setSystemTime(time2);
      const key2 = generateIdempotencyKey(
        "user123",
        "ip-hash",
        "rule456",
        "VIEW"
      );

      expect(key1).toBe(key2);
    });

    it("should create different keys for different parameters", () => {
      const baseParams = ["user123", "ip-hash", "rule456", "VIEW"] as const;

      const key1 = generateIdempotencyKey(...baseParams);
      const key2 = generateIdempotencyKey(
        "user456",
        "ip-hash",
        "rule456",
        "VIEW"
      );
      const key3 = generateIdempotencyKey(
        "user123",
        "different-ip",
        "rule456",
        "VIEW"
      );
      const key4 = generateIdempotencyKey(
        "user123",
        "ip-hash",
        "rule789",
        "VIEW"
      );
      const key5 = generateIdempotencyKey(
        "user123",
        "ip-hash",
        "rule456",
        "COPY"
      );

      const keys = [key1, key2, key3, key4, key5];
      const uniqueKeys = new Set(keys);

      expect(uniqueKeys.size).toBe(5);
    });

    it("should use 16-second buckets", () => {
      const baseTime = 1640995200000;

      // Test bucket boundaries
      const times = [
        baseTime, // Start of bucket
        baseTime + 8000, // Middle of bucket
        baseTime + 15999, // End of bucket
        baseTime + 16000, // Start of next bucket
      ];

      const keys = times.map((time) => {
        vi.setSystemTime(time);
        return generateIdempotencyKey("user123", "ip-hash", "rule456", "VIEW");
      });

      expect(keys[0]).toBe(keys[1]); // Same bucket
      expect(keys[1]).toBe(keys[2]); // Same bucket
      expect(keys[2]).not.toBe(keys[3]); // Different bucket
    });
  });

  describe("EVENT_TYPES and isValidEventType", () => {
    it("should have all expected event types", () => {
      const expectedTypes = [
        "VIEW",
        "COPY",
        "SAVE",
        "FORK",
        "VOTE",
        "COMMENT",
        "DONATE",
        "CLAIM",
      ];

      expectedTypes.forEach((type) => {
        expect(EVENT_TYPES).toHaveProperty(type);
        expect(EVENT_TYPES[type as keyof typeof EVENT_TYPES]).toBe(type);
      });
    });

    it("should validate correct event types", () => {
      Object.values(EVENT_TYPES).forEach((eventType) => {
        expect(isValidEventType(eventType)).toBe(true);
      });
    });

    it("should reject invalid event types", () => {
      const invalidTypes = [
        "INVALID",
        "view", // lowercase
        "View", // mixed case
        "",
        "UNKNOWN",
        "DELETE",
        123 as any,
        null as any,
        undefined as any,
      ];

      invalidTypes.forEach((type) => {
        expect(isValidEventType(type)).toBe(false);
      });
    });

    it("should provide type safety", () => {
      // This is a compile-time test, but we can verify runtime behavior
      const validType: EventType = "VIEW";
      expect(isValidEventType(validType)).toBe(true);
    });
  });

  describe("getMetricsDateRange", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return correct number of dates", () => {
      const days = 7;
      const dates = getMetricsDateRange(days);

      expect(dates).toHaveLength(days);
    });

    it("should return dates in descending order (today first)", () => {
      const fixedDate = new Date("2023-06-15T12:30:45Z");
      vi.setSystemTime(fixedDate);

      const dates = getMetricsDateRange(3);

      expect(dates[0]?.toISOString()).toBe("2023-06-15T00:00:00.000Z"); // Today
      expect(dates[1]?.toISOString()).toBe("2023-06-14T00:00:00.000Z"); // Yesterday
      expect(dates[2]?.toISOString()).toBe("2023-06-13T00:00:00.000Z"); // Day before
    });

    it("should normalize times to start of day UTC", () => {
      const fixedDate = new Date("2023-06-15T18:45:30.123Z"); // Afternoon with milliseconds
      vi.setSystemTime(fixedDate);

      const dates = getMetricsDateRange(1);
      const todayDate = dates[0];

      expect(todayDate?.getUTCHours()).toBe(0);
      expect(todayDate?.getUTCMinutes()).toBe(0);
      expect(todayDate?.getUTCSeconds()).toBe(0);
      expect(todayDate?.getUTCMilliseconds()).toBe(0);
    });

    it("should handle month boundaries", () => {
      vi.setSystemTime(new Date("2023-07-01T12:00:00Z")); // July 1st

      const dates = getMetricsDateRange(3);

      expect(dates[0]?.toISOString()).toBe("2023-07-01T00:00:00.000Z"); // July 1st
      expect(dates[1]?.toISOString()).toBe("2023-06-30T00:00:00.000Z"); // June 30th
      expect(dates[2]?.toISOString()).toBe("2023-06-29T00:00:00.000Z"); // June 29th
    });

    it("should handle year boundaries", () => {
      vi.setSystemTime(new Date("2024-01-01T12:00:00Z")); // New Year's Day

      const dates = getMetricsDateRange(3);

      expect(dates[0]?.toISOString()).toBe("2024-01-01T00:00:00.000Z"); // Jan 1, 2024
      expect(dates[1]?.toISOString()).toBe("2023-12-31T00:00:00.000Z"); // Dec 31, 2023
      expect(dates[2]?.toISOString()).toBe("2023-12-30T00:00:00.000Z"); // Dec 30, 2023
    });

    it("should handle single day", () => {
      const fixedDate = new Date("2023-06-15T12:30:45Z");
      vi.setSystemTime(fixedDate);

      const dates = getMetricsDateRange(1);

      expect(dates).toHaveLength(1);
      expect(dates[0]?.toISOString()).toBe("2023-06-15T00:00:00.000Z");
    });

    it("should handle large ranges", () => {
      const dates = getMetricsDateRange(365);

      expect(dates).toHaveLength(365);
      expect(dates[0]?.getTime()).toBeGreaterThan(dates[364]?.getTime() || 0);
    });
  });

  describe("shouldRateLimit", () => {
    it("should not rate limit below threshold", () => {
      for (let i = 0; i < MAX_EVENTS_PER_IP_PER_MINUTE; i++) {
        expect(shouldRateLimit(i)).toBe(false);
      }
    });

    it("should rate limit at threshold", () => {
      expect(shouldRateLimit(MAX_EVENTS_PER_IP_PER_MINUTE)).toBe(true);
    });

    it("should rate limit above threshold", () => {
      expect(shouldRateLimit(MAX_EVENTS_PER_IP_PER_MINUTE + 1)).toBe(true);
      expect(shouldRateLimit(MAX_EVENTS_PER_IP_PER_MINUTE + 100)).toBe(true);
    });

    it("should handle edge cases", () => {
      expect(shouldRateLimit(0)).toBe(false);
      expect(shouldRateLimit(-1)).toBe(false); // Negative values
      expect(shouldRateLimit(Infinity)).toBe(true);
    });
  });

  describe("capViewCount", () => {
    it("should not cap below limit", () => {
      for (let i = 0; i <= MAX_VIEWS_PER_IP_PER_RULE_PER_DAY; i++) {
        expect(capViewCount(i)).toBe(i);
      }
    });

    it("should cap above limit", () => {
      expect(capViewCount(MAX_VIEWS_PER_IP_PER_RULE_PER_DAY + 1)).toBe(
        MAX_VIEWS_PER_IP_PER_RULE_PER_DAY
      );
      expect(capViewCount(MAX_VIEWS_PER_IP_PER_RULE_PER_DAY + 100)).toBe(
        MAX_VIEWS_PER_IP_PER_RULE_PER_DAY
      );
    });

    it("should handle edge cases", () => {
      expect(capViewCount(0)).toBe(0);
      expect(capViewCount(-1)).toBe(-1); // Negative values pass through
      expect(capViewCount(Infinity)).toBe(MAX_VIEWS_PER_IP_PER_RULE_PER_DAY);
    });

    it("should preserve exact limit value", () => {
      expect(capViewCount(MAX_VIEWS_PER_IP_PER_RULE_PER_DAY)).toBe(
        MAX_VIEWS_PER_IP_PER_RULE_PER_DAY
      );
    });
  });

  describe("simpleHash", () => {
    it("should generate consistent hash for same input", () => {
      const input = "test-string";
      const hash1 = simpleHash(input);
      const hash2 = simpleHash(input);

      expect(hash1).toBe(hash2);
    });

    it("should generate different hashes for different inputs", () => {
      const hash1 = simpleHash("input1");
      const hash2 = simpleHash("input2");

      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty string", () => {
      const hash = simpleHash("");
      expect(hash).toBe("0"); // Hash of 0 in base 36
    });

    it("should generate base-36 string", () => {
      const hash = simpleHash("test");
      expect(hash).toMatch(/^[a-z0-9]+$/);
    });

    it("should handle special characters", () => {
      const hash1 = simpleHash("test!@#$%");
      const hash2 = simpleHash("test üñíçødé");

      expect(hash1).toBeTruthy();
      expect(hash2).toBeTruthy();
      expect(hash1).not.toBe(hash2);
    });

    it("should be deterministic", () => {
      const input = "consistent-test";
      const hashes = Array.from({ length: 10 }, () => simpleHash(input));

      expect(new Set(hashes).size).toBe(1); // All should be the same
    });

    it("should handle very long strings", () => {
      const longString = "a".repeat(10000);
      const hash = simpleHash(longString);

      expect(hash).toBeTruthy();
      expect(hash).toMatch(/^[a-z0-9]+$/);
    });
  });

  describe("getViewDedupeCookieName", () => {
    it("should generate cookie name with hash", () => {
      const ruleId = "rule123";
      const cookieName = getViewDedupeCookieName(ruleId);
      const expectedHash = simpleHash(ruleId);

      expect(cookieName).toBe(`view_${expectedHash}`);
    });

    it("should generate consistent names for same rule", () => {
      const ruleId = "rule123";
      const name1 = getViewDedupeCookieName(ruleId);
      const name2 = getViewDedupeCookieName(ruleId);

      expect(name1).toBe(name2);
    });

    it("should generate different names for different rules", () => {
      const name1 = getViewDedupeCookieName("rule1");
      const name2 = getViewDedupeCookieName("rule2");

      expect(name1).not.toBe(name2);
    });

    it("should start with 'view_'", () => {
      const cookieName = getViewDedupeCookieName("any-rule");
      expect(cookieName.startsWith("view_")).toBe(true);
    });
  });

  describe("shouldDedupeView", () => {
    beforeEach(() => {
      mockDocument.cookie = "";
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return false when document is undefined (server-side)", () => {
      // Temporarily remove document
      const originalDocument = global.document;
      delete (global as any).document;

      const result = shouldDedupeView("rule123");
      expect(result).toBe(false);

      // Restore document
      global.document = originalDocument;
    });

    it("should return false when no cookie exists", () => {
      mockDocument.cookie = "";

      const result = shouldDedupeView("rule123");
      expect(result).toBe(false);
    });

    it("should return false when cookie is expired", () => {
      const now = Date.now();
      const expiredTime = now - VIEW_DEDUP_WINDOW_MIN * 60 * 1000 - 1000; // 1 second past expiry

      const cookieName = getViewDedupeCookieName("rule123");
      mockDocument.cookie = `${cookieName}=${expiredTime}`;

      vi.setSystemTime(now);

      const result = shouldDedupeView("rule123");
      expect(result).toBe(false);
    });

    it("should return true when cookie is within window", () => {
      const now = Date.now();
      const recentTime = now - VIEW_DEDUP_WINDOW_MIN * 60 * 1000 + 60000; // 1 minute before expiry

      const cookieName = getViewDedupeCookieName("rule123");
      mockDocument.cookie = `${cookieName}=${recentTime}`;

      vi.setSystemTime(now);

      const result = shouldDedupeView("rule123");
      expect(result).toBe(true);
    });

    it("should handle multiple cookies", () => {
      const now = Date.now();
      const recentTime = now - 60000; // 1 minute ago

      const cookieName = getViewDedupeCookieName("rule123");
      mockDocument.cookie = `other_cookie=value; ${cookieName}=${recentTime}; another_cookie=value2`;

      vi.setSystemTime(now);

      const result = shouldDedupeView("rule123");
      expect(result).toBe(true);
    });

    it("should handle invalid cookie values", () => {
      const cookieName = getViewDedupeCookieName("rule123");
      mockDocument.cookie = `${cookieName}=invalid-timestamp`;

      const result = shouldDedupeView("rule123");
      expect(result).toBe(false); // Invalid timestamp should be treated as expired/missing
    });

    it("should be case-sensitive for rule IDs", () => {
      const now = Date.now();
      const recentTime = now - 60000;

      const cookieName1 = getViewDedupeCookieName("Rule123");
      const cookieName2 = getViewDedupeCookieName("rule123");

      mockDocument.cookie = `${cookieName1}=${recentTime}`;

      vi.setSystemTime(now);

      expect(shouldDedupeView("Rule123")).toBe(true);
      expect(shouldDedupeView("rule123")).toBe(false); // Different rule
    });
  });

  describe("setViewDedupeCookie", () => {
    beforeEach(() => {
      mockDocument.cookie = "";
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should return early when document is undefined", () => {
      const originalDocument = global.document;
      delete (global as any).document;

      // Should not throw
      expect(() => setViewDedupeCookie("rule123")).not.toThrow();

      global.document = originalDocument;
    });

    it("should set cookie with correct format", () => {
      const now = Date.now();
      vi.setSystemTime(now);

      setViewDedupeCookie("rule123");

      const cookieName = getViewDedupeCookieName("rule123");
      const expectedExpiry = new Date(now + VIEW_DEDUP_WINDOW_MIN * 60 * 1000);

      expect(mockDocument.cookie).toContain(`${cookieName}=${now}`);
      expect(mockDocument.cookie).toContain(
        `expires=${expectedExpiry.toUTCString()}`
      );
      expect(mockDocument.cookie).toContain("path=/");
      expect(mockDocument.cookie).toContain("SameSite=Lax");
    });

    it("should use current timestamp", () => {
      const fixedTime = 1640995200000;
      vi.setSystemTime(fixedTime);

      setViewDedupeCookie("rule123");

      const cookieName = getViewDedupeCookieName("rule123");
      expect(mockDocument.cookie).toContain(`${cookieName}=${fixedTime}`);
    });

    it("should set expiry time correctly", () => {
      const now = 1640995200000;
      vi.setSystemTime(now);

      setViewDedupeCookie("rule123");

      const expectedExpiry = new Date(now + VIEW_DEDUP_WINDOW_MIN * 60 * 1000);
      expect(mockDocument.cookie).toContain(
        `expires=${expectedExpiry.toUTCString()}`
      );
    });

    it("should handle different rule IDs", () => {
      setViewDedupeCookie("rule1");
      setViewDedupeCookie("rule2");

      const cookieName1 = getViewDedupeCookieName("rule1");
      const cookieName2 = getViewDedupeCookieName("rule2");

      expect(mockDocument.cookie).toContain(cookieName1);
      expect(mockDocument.cookie).toContain(cookieName2);
    });
  });

  describe("Integration tests", () => {
    beforeEach(() => {
      mockDocument.cookie = "";
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should coordinate deduplication flow", () => {
      const ruleId = "rule123";
      const now = Date.now();
      vi.setSystemTime(now);

      // Initially should not dedupe
      expect(shouldDedupeView(ruleId)).toBe(false);

      // Set the cookie
      setViewDedupeCookie(ruleId);

      // Now should dedupe
      expect(shouldDedupeView(ruleId)).toBe(true);

      // After expiry window, should not dedupe
      vi.advanceTimersByTime(VIEW_DEDUP_WINDOW_MIN * 60 * 1000 + 1000);
      expect(shouldDedupeView(ruleId)).toBe(false);
    });

    it("should handle trending score calculation with realistic data", () => {
      const dailyMetrics = [
        { views: 1000, copies: 100, saves: 50, votes: 20 }, // Today
        { views: 800, copies: 80, saves: 40, votes: 15 }, // Yesterday
        { views: 600, copies: 60, saves: 30, votes: 10 }, // 2 days ago
        { views: 400, copies: 40, saves: 20, votes: 8 }, // 3 days ago
        { views: 200, copies: 20, saves: 10, votes: 4 }, // 4 days ago
        { views: 100, copies: 10, saves: 5, votes: 2 }, // 5 days ago
        { views: 50, copies: 5, saves: 2, votes: 1 }, // 6 days ago
      ];

      const score = calculateTrendingScore(dailyMetrics);

      // Should be a reasonable positive number
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1000); // Reasonable upper bound

      // Should be influenced more by recent days
      const recentOnlyScore = calculateTrendingScore(dailyMetrics.slice(0, 3));
      const oldOnlyScore = calculateTrendingScore(dailyMetrics.slice(4));

      expect(recentOnlyScore).toBeGreaterThan(oldOnlyScore);
    });

    it("should generate consistent idempotency keys for rate limiting", () => {
      vi.setSystemTime(1640995200000);

      const userId = "user123";
      const ipHash = "ip-hash-abc";
      const ruleId = "rule456";
      const eventType = "VIEW";

      const key1 = generateIdempotencyKey(userId, ipHash, ruleId, eventType);
      const key2 = generateIdempotencyKey(userId, ipHash, ruleId, eventType);

      expect(key1).toBe(key2);

      // Different users should have different keys
      const key3 = generateIdempotencyKey("user456", ipHash, ruleId, eventType);
      expect(key1).not.toBe(key3);
    });

    it("should validate all event types correctly", () => {
      const allEventTypes = Object.values(EVENT_TYPES);

      allEventTypes.forEach((eventType) => {
        expect(isValidEventType(eventType)).toBe(true);

        // Should work in idempotency key generation
        const key = generateIdempotencyKey("user", "ip", "rule", eventType);
        expect(key).toContain(eventType);
      });
    });
  });
});
