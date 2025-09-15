import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateId,
  generateShortId,
  generateLongId,
  generateNumericId,
  generateUppercaseId,
  generateSlugId,
  generatePrefixedId,
  generateUserId,
  generatePostId,
  generateSessionId,
  generateApiKeyId,
  generateInviteId,
  generateWebhookId,
  generateTimeBasedId,
  extractTimestampFromId,
  isValidNanoid,
  isValidPrefixedId,
  generateSecureToken,
  generateReadableId,
} from "./ids";

describe("ID generation utilities", () => {
  describe("generateId", () => {
    it("should generate standard nanoid", () => {
      const id = generateId();

      expect(id).toHaveLength(21);
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("should generate unique IDs", () => {
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).not.toBe(id2);
    });

    it("should generate multiple unique IDs", () => {
      const ids = Array.from({ length: 100 }, () => generateId());
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(100); // All should be unique
    });
  });

  describe("generateShortId", () => {
    it("should generate short ID with correct length", () => {
      const id = generateShortId();

      expect(id).toHaveLength(10);
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("should generate unique short IDs", () => {
      const id1 = generateShortId();
      const id2 = generateShortId();

      expect(id1).not.toBe(id2);
    });
  });

  describe("generateLongId", () => {
    it("should generate long ID with correct length", () => {
      const id = generateLongId();

      expect(id).toHaveLength(32);
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("should generate unique long IDs", () => {
      const id1 = generateLongId();
      const id2 = generateLongId();

      expect(id1).not.toBe(id2);
    });
  });

  describe("generateNumericId", () => {
    it("should generate numeric-only ID", () => {
      const id = generateNumericId();

      expect(id).toHaveLength(10);
      expect(id).toMatch(/^\d+$/);
    });

    it("should generate unique numeric IDs", () => {
      const id1 = generateNumericId();
      const id2 = generateNumericId();

      expect(id1).not.toBe(id2);
    });

    it("should not start with zero (very unlikely but possible)", () => {
      // Generate many IDs to test distribution
      const ids = Array.from({ length: 50 }, () => generateNumericId());

      ids.forEach((id) => {
        expect(id).toMatch(/^\d{10}$/);
      });
    });
  });

  describe("generateUppercaseId", () => {
    it("should generate uppercase alphanumeric ID", () => {
      const id = generateUppercaseId();

      expect(id).toHaveLength(12);
      expect(id).toMatch(/^[A-Z0-9]+$/);
    });

    it("should not contain lowercase letters", () => {
      const id = generateUppercaseId();

      expect(id).not.toMatch(/[a-z]/);
    });

    it("should generate unique uppercase IDs", () => {
      const id1 = generateUppercaseId();
      const id2 = generateUppercaseId();

      expect(id1).not.toBe(id2);
    });
  });

  describe("generateSlugId", () => {
    it("should generate slug-friendly ID", () => {
      const id = generateSlugId();

      expect(id).toHaveLength(16);
      expect(id).toMatch(/^[a-z0-9]+$/);
    });

    it("should not contain uppercase or special characters", () => {
      const id = generateSlugId();

      expect(id).not.toMatch(/[A-Z_-]/);
    });

    it("should generate unique slug IDs", () => {
      const id1 = generateSlugId();
      const id2 = generateSlugId();

      expect(id1).not.toBe(id2);
    });
  });

  describe("generatePrefixedId", () => {
    it("should generate ID with prefix", () => {
      const id = generatePrefixedId("test");

      expect(id).toMatch(/^test_[A-Za-z0-9_-]{21}$/);
    });

    it("should use custom length", () => {
      const id = generatePrefixedId("test", 10);

      expect(id).toMatch(/^test_[A-Za-z0-9_-]{10}$/);
    });

    it("should generate unique prefixed IDs", () => {
      const id1 = generatePrefixedId("test");
      const id2 = generatePrefixedId("test");

      expect(id1).not.toBe(id2);
      expect(id1.startsWith("test_")).toBe(true);
      expect(id2.startsWith("test_")).toBe(true);
    });

    it("should handle different prefixes", () => {
      const id1 = generatePrefixedId("prefix1");
      const id2 = generatePrefixedId("prefix2");

      expect(id1.startsWith("prefix1_")).toBe(true);
      expect(id2.startsWith("prefix2_")).toBe(true);
    });

    it("should handle empty prefix", () => {
      const id = generatePrefixedId("");

      expect(id).toMatch(/^_[A-Za-z0-9_-]{21}$/);
    });
  });

  describe("Common prefixed ID generators", () => {
    it("should generate user ID with correct format", () => {
      const id = generateUserId();

      expect(id).toMatch(/^usr_[A-Za-z0-9_-]{16}$/);
    });

    it("should generate post ID with correct format", () => {
      const id = generatePostId();

      expect(id).toMatch(/^post_[A-Za-z0-9_-]{16}$/);
    });

    it("should generate session ID with correct format", () => {
      const id = generateSessionId();

      expect(id).toMatch(/^sess_[A-Za-z0-9_-]{32}$/);
    });

    it("should generate API key ID with correct format", () => {
      const id = generateApiKeyId();

      expect(id).toMatch(/^key_[A-Za-z0-9_-]{24}$/);
    });

    it("should generate invite ID with correct format", () => {
      const id = generateInviteId();

      expect(id).toMatch(/^inv_[A-Za-z0-9_-]{16}$/);
    });

    it("should generate webhook ID with correct format", () => {
      const id = generateWebhookId();

      expect(id).toMatch(/^wh_[A-Za-z0-9_-]{16}$/);
    });

    it("should generate unique IDs for each type", () => {
      const userId1 = generateUserId();
      const userId2 = generateUserId();
      const postId = generatePostId();

      expect(userId1).not.toBe(userId2);
      expect(userId1).not.toBe(postId);
    });
  });

  describe("generateTimeBasedId", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should generate time-based ID without prefix", () => {
      const fixedTime = 1640995200000; // Fixed timestamp
      vi.setSystemTime(fixedTime);

      const id = generateTimeBasedId();
      const expectedTimestamp = fixedTime.toString(36);

      expect(id).toMatch(new RegExp(`^${expectedTimestamp}_[A-Za-z0-9_-]{8}$`));
    });

    it("should generate time-based ID with prefix", () => {
      const fixedTime = 1640995200000;
      vi.setSystemTime(fixedTime);

      const id = generateTimeBasedId("order");
      const expectedTimestamp = fixedTime.toString(36);

      expect(id).toMatch(
        new RegExp(`^order_${expectedTimestamp}_[A-Za-z0-9_-]{8}$`)
      );
    });

    it("should generate different IDs at same time", () => {
      const id1 = generateTimeBasedId("test");
      const id2 = generateTimeBasedId("test");

      expect(id1).not.toBe(id2);
      // Should have same timestamp part but different random part
      const parts1 = id1.split("_");
      const parts2 = id2.split("_");
      expect(parts1[0]).toBe(parts2[0]); // prefix
      expect(parts1[1]).toBe(parts2[1]); // timestamp
      expect(parts1[2]).not.toBe(parts2[2]); // random part
    });

    it("should generate different timestamps for different times", () => {
      const time1 = 1640995200000;
      const time2 = 1640995260000; // 1 minute later

      vi.setSystemTime(time1);
      const id1 = generateTimeBasedId();

      vi.setSystemTime(time2);
      const id2 = generateTimeBasedId();

      const timestamp1 = id1.split("_")[0];
      const timestamp2 = id2.split("_")[0];

      expect(timestamp1).not.toBe(timestamp2);
    });
  });

  describe("extractTimestampFromId", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should extract timestamp from time-based ID without prefix", () => {
      const fixedTime = 1640995200000;
      vi.setSystemTime(fixedTime);

      const id = generateTimeBasedId();
      const extractedDate = extractTimestampFromId(id);

      expect(extractedDate).toBeInstanceOf(Date);
      expect(extractedDate?.getTime()).toBe(fixedTime);
    });

    it("should extract timestamp from time-based ID with prefix", () => {
      const fixedTime = 1640995200000;
      vi.setSystemTime(fixedTime);

      const id = generateTimeBasedId("order");
      const extractedDate = extractTimestampFromId(id);

      expect(extractedDate).toBeInstanceOf(Date);
      expect(extractedDate?.getTime()).toBe(fixedTime);
    });

    it("should return null for invalid ID format", () => {
      const invalidIds = [
        "invalid-id",
        "just_one_part",
        "prefix_invalid_timestamp_random",
        "",
        "prefix__random", // empty timestamp
      ];

      invalidIds.forEach((id) => {
        const result = extractTimestampFromId(id);
        expect(result).toBeNull();
      });
    });

    it("should return null for non-time-based ID", () => {
      const regularId = generateId();
      const result = extractTimestampFromId(regularId);

      expect(result).toBeNull();
    });

    it("should handle edge case timestamps", () => {
      // Test with timestamp 0
      vi.setSystemTime(0);
      const id = generateTimeBasedId();
      const extracted = extractTimestampFromId(id);

      expect(extracted?.getTime()).toBe(0);
    });
  });

  describe("isValidNanoid", () => {
    it("should validate standard nanoid", () => {
      const id = generateId();
      expect(isValidNanoid(id)).toBe(true);
    });

    it("should reject non-nanoid strings", () => {
      const invalidIds = [
        "too-short",
        "this-id-is-way-too-long-to-be-a-valid-nanoid",
        "invalid@characters!",
        "spaces not allowed",
        "",
        "exactly-20-chars-no", // 20 chars instead of 21
        "exactly-22-chars-yes!", // 22 chars instead of 21
      ];

      invalidIds.forEach((id) => {
        expect(isValidNanoid(id)).toBe(false);
      });
    });

    it("should accept valid characters", () => {
      const validId = "A1B2C3D4E5F6G7H8I9J0K"; // 21 chars, valid characters
      expect(isValidNanoid(validId)).toBe(true);
    });

    it("should accept underscores and hyphens", () => {
      const validId = "A_B-C_D-E_F-G_H-I_J-K"; // 21 chars with underscores and hyphens
      expect(isValidNanoid(validId)).toBe(true);
    });

    it("should reject invalid characters", () => {
      const invalidId = "A1B2C3D4E5F6G7H8I9J@K"; // @ is invalid
      expect(isValidNanoid(invalidId)).toBe(false);
    });
  });

  describe("isValidPrefixedId", () => {
    it("should validate correct prefixed ID", () => {
      const id = generatePrefixedId("test");
      expect(isValidPrefixedId(id, "test")).toBe(true);
    });

    it("should reject ID with wrong prefix", () => {
      const id = generatePrefixedId("test");
      expect(isValidPrefixedId(id, "wrong")).toBe(false);
    });

    it("should reject ID without prefix", () => {
      const id = generateId();
      expect(isValidPrefixedId(id, "test")).toBe(false);
    });

    it("should handle different prefix lengths", () => {
      const shortPrefix = generatePrefixedId("a");
      const longPrefix = generatePrefixedId("very-long-prefix");

      expect(isValidPrefixedId(shortPrefix, "a")).toBe(true);
      expect(isValidPrefixedId(longPrefix, "very-long-prefix")).toBe(true);
    });

    it("should reject empty prefix when expecting one", () => {
      const id = "_" + generateId();
      expect(isValidPrefixedId(id, "")).toBe(true);
      expect(isValidPrefixedId(id, "test")).toBe(false);
    });

    it("should validate common prefixed IDs", () => {
      expect(isValidPrefixedId(generateUserId(), "usr")).toBe(true);
      expect(isValidPrefixedId(generatePostId(), "post")).toBe(true);
      expect(isValidPrefixedId(generateSessionId(), "sess")).toBe(true);
    });

    it("should reject malformed prefixed IDs", () => {
      const invalidIds = [
        "test-no-underscore",
        "test_",
        "_no-prefix",
        "",
        "test_invalid@chars",
      ];

      invalidIds.forEach((id) => {
        expect(isValidPrefixedId(id, "test")).toBe(false);
      });
    });
  });

  describe("generateSecureToken", () => {
    it("should generate secure token with default length", () => {
      const token = generateSecureToken();

      expect(token).toHaveLength(32);
      expect(token).toMatch(/^[A-Za-z0-9]+$/);
    });

    it("should generate secure token with custom length", () => {
      const lengths = [16, 24, 48, 64];

      lengths.forEach((length) => {
        const token = generateSecureToken(length);
        expect(token).toHaveLength(length);
        expect(token).toMatch(/^[A-Za-z0-9]+$/);
      });
    });

    it("should generate unique secure tokens", () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();

      expect(token1).not.toBe(token2);
    });

    it("should use secure alphabet (no special characters)", () => {
      const token = generateSecureToken(100); // Large token for better testing

      expect(token).toMatch(/^[A-Za-z0-9]+$/);
      expect(token).not.toMatch(/[_-]/); // No underscores or hyphens
    });

    it("should handle edge case lengths", () => {
      const smallToken = generateSecureToken(1);
      const largeToken = generateSecureToken(256);

      expect(smallToken).toHaveLength(1);
      expect(largeToken).toHaveLength(256);
    });
  });

  describe("generateReadableId", () => {
    it("should generate readable ID with correct format", () => {
      const id = generateReadableId();

      expect(id).toMatch(/^[a-z]+-[a-z]+-\d+$/);
    });

    it("should use words from predefined list", () => {
      const words = [
        "happy",
        "sunny",
        "bright",
        "swift",
        "calm",
        "brave",
        "wise",
        "kind",
        "cool",
        "warm",
        "fresh",
        "clean",
        "smart",
        "quick",
        "safe",
        "free",
      ];

      const id = generateReadableId();
      const parts = id.split("-");

      expect(words).toContain(parts[0]);
      expect(words).toContain(parts[1]);
      expect(parseInt(parts[2] || "")).toBeGreaterThanOrEqual(0);
      expect(parseInt(parts[2] || "")).toBeLessThan(1000);
    });

    it("should generate different readable IDs", () => {
      const id1 = generateReadableId();
      const id2 = generateReadableId();

      expect(id1).not.toBe(id2);
    });

    it("should have three parts separated by hyphens", () => {
      const id = generateReadableId();
      const parts = id.split("-");

      expect(parts).toHaveLength(3);
      expect(parts[0]).toBeTruthy();
      expect(parts[1]).toBeTruthy();
      expect(parts[2]).toBeTruthy();
    });

    it("should generate numbers in expected range", () => {
      // Generate multiple IDs to test number range
      const ids = Array.from({ length: 20 }, () => generateReadableId());

      ids.forEach((id) => {
        const number = parseInt(id.split("-")[2] || "");
        expect(number).toBeGreaterThanOrEqual(0);
        expect(number).toBeLessThan(1000);
      });
    });

    it("should be human-friendly", () => {
      const id = generateReadableId();

      // Should not contain confusing characters
      expect(id).not.toMatch(/[0O1lI]/); // Common confusing characters

      // Should be lowercase for consistency
      expect(id).toBe(id.toLowerCase());

      // Should be reasonable length
      expect(id.length).toBeGreaterThan(5);
      expect(id.length).toBeLessThan(30);
    });
  });

  describe("Integration and edge cases", () => {
    it("should generate IDs that work well together", () => {
      const standardId = generateId();
      const prefixedId = generatePrefixedId("test");
      const timeBasedId = generateTimeBasedId("order");
      const readableId = generateReadableId();

      // All should be different
      const ids = [standardId, prefixedId, timeBasedId, readableId];
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(4);

      // Should have different characteristics
      expect(isValidNanoid(standardId)).toBe(true);
      expect(isValidPrefixedId(prefixedId, "test")).toBe(true);
      expect(extractTimestampFromId(timeBasedId)).toBeTruthy();
      expect(readableId).toMatch(/^[a-z]+-[a-z]+-\d+$/);
    });

    it("should handle high-frequency generation", () => {
      const ids = new Set();
      const count = 1000;

      for (let i = 0; i < count; i++) {
        ids.add(generateId());
      }

      expect(ids.size).toBe(count); // All should be unique
    });

    it("should maintain format consistency", () => {
      // Generate many IDs and verify they all follow format rules
      for (let i = 0; i < 100; i++) {
        const id = generateId();
        expect(isValidNanoid(id)).toBe(true);

        const shortId = generateShortId();
        expect(shortId).toHaveLength(10);

        const prefixedId = generatePrefixedId("test");
        expect(isValidPrefixedId(prefixedId, "test")).toBe(true);
      }
    });

    it("should handle special characters in prefixes", () => {
      const specialPrefixes = ["test-prefix", "test_prefix", "123", ""];

      specialPrefixes.forEach((prefix) => {
        const id = generatePrefixedId(prefix);
        expect(isValidPrefixedId(id, prefix)).toBe(true);
      });
    });

    it("should be URL-safe for appropriate types", () => {
      const urlSafeIds = [
        generateId(),
        generateShortId(),
        generateLongId(),
        generateSlugId(),
        generatePrefixedId("test"),
      ];

      urlSafeIds.forEach((id) => {
        // Should not need URL encoding
        expect(encodeURIComponent(id)).toBe(id);
      });
    });
  });
});
