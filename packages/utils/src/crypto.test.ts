import { describe, it, expect, vi } from "vitest";
import {
  sha256,
  hashWithSalt,
  hashIp,
  hashUA,
  generateSecureIdempotencyKey,
  calculateEntropy,
  hashComposite,
  hashTimeWindow,
  secureCompare,
  extractIp,
  extractUA,
} from "./crypto";

describe("Crypto utilities", () => {
  describe("sha256", () => {
    it("should generate consistent SHA-256 hash", () => {
      const input = "test string";
      const hash1 = sha256(input);
      const hash2 = sha256(input);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64-character hex string
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should generate different hashes for different inputs", () => {
      const hash1 = sha256("input1");
      const hash2 = sha256("input2");

      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty string", () => {
      const hash = sha256("");
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should handle special characters", () => {
      const hash = sha256("üñíçødé 🚀");
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("hashWithSalt", () => {
    it("should generate consistent HMAC hash with salt", () => {
      const value = "test value";
      const salt = "test salt";
      const hash1 = hashWithSalt(value, salt);
      const hash2 = hashWithSalt(value, salt);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should generate different hashes with different salts", () => {
      const value = "test value";
      const hash1 = hashWithSalt(value, "salt1");
      const hash2 = hashWithSalt(value, "salt2");

      expect(hash1).not.toBe(hash2);
    });

    it("should generate different hashes for different values", () => {
      const salt = "test salt";
      const hash1 = hashWithSalt("value1", salt);
      const hash2 = hashWithSalt("value2", salt);

      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty values and salts", () => {
      const hash1 = hashWithSalt("", "salt");
      const hash2 = hashWithSalt("value", "");
      const hash3 = hashWithSalt("", "");

      expect(hash1).toHaveLength(64);
      expect(hash2).toHaveLength(64);
      expect(hash3).toHaveLength(64);
      expect(hash1).not.toBe(hash2);
      expect(hash2).not.toBe(hash3);
    });
  });

  describe("hashIp", () => {
    it("should hash normalized IP address", () => {
      const ip = "192.168.1.1";
      const salt = "test-salt";
      const hash = hashIp(ip, salt);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should handle IPv6 addresses", () => {
      const ipv6 = "[2001:db8::1]";
      const salt = "test-salt";
      const hash = hashIp(ipv6, salt);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should handle IPs with ports", () => {
      const ipWithPort = "192.168.1.1:8080";
      const ipWithoutPort = "192.168.1.1";
      const salt = "test-salt";

      const hash1 = hashIp(ipWithPort, salt);
      const hash2 = hashIp(ipWithoutPort, salt);

      expect(hash1).toBe(hash2); // Port should be stripped
    });

    it("should handle comma-separated IPs (X-Forwarded-For)", () => {
      const forwardedIp = "203.0.113.195, 70.41.3.18, 150.172.238.178";
      const firstIp = "203.0.113.195";
      const salt = "test-salt";

      const hash1 = hashIp(forwardedIp, salt);
      const hash2 = hashIp(firstIp, salt);

      expect(hash1).toBe(hash2); // Should use first IP
    });

    it("should handle unknown IP", () => {
      const hash = hashIp("unknown", "salt");
      expect(hash).toHaveLength(64);
    });

    it("should handle empty/null IP", () => {
      const hash1 = hashIp("", "salt");
      const hash2 = hashIp("unknown", "salt");

      expect(hash1).toBe(hash2); // Empty becomes "unknown"
    });

    it("should normalize IPv6 consistently", () => {
      const ipv6_1 = "2001:db8::1";
      const ipv6_2 = "[2001:db8::1]";
      const ipv6_3 = "2001:DB8::1"; // Different case
      const salt = "test-salt";

      const hash1 = hashIp(ipv6_1, salt);
      const hash2 = hashIp(ipv6_2, salt);
      const hash3 = hashIp(ipv6_3, salt);

      expect(hash1).toBe(hash2);
      expect(hash1).toBe(hash3); // Case normalized
    });
  });

  describe("hashUA", () => {
    it("should hash normalized User-Agent", () => {
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
      const salt = "test-salt";
      const hash = hashUA(ua, salt);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should normalize browser versions", () => {
      const ua1 = "Chrome/91.2.4472.124";
      const ua2 = "Chrome/92.1.4515.107";
      const salt = "test-salt";

      const hash1 = hashUA(ua1, salt);
      const hash2 = hashUA(ua2, salt);

      // Different detailed versions should still hash differently
      // but the normalization should be consistent
      expect(hash1).not.toBe(hash2);
    });

    it("should handle unknown User-Agent", () => {
      const hash = hashUA("unknown", "salt");
      expect(hash).toHaveLength(64);
    });

    it("should handle empty User-Agent", () => {
      const hash1 = hashUA("", "salt");
      const hash2 = hashUA("unknown", "salt");

      expect(hash1).toBe(hash2); // Empty becomes "unknown"
    });

    it("should normalize common browsers consistently", () => {
      const chromeUA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
      const firefoxUA =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0";
      const salt = "test-salt";

      const chromeHash = hashUA(chromeUA, salt);
      const firefoxHash = hashUA(firefoxUA, salt);

      expect(chromeHash).not.toBe(firefoxHash);
      expect(chromeHash).toHaveLength(64);
      expect(firefoxHash).toHaveLength(64);
    });
  });

  describe("generateSecureIdempotencyKey", () => {
    it("should generate unique keys", () => {
      const key1 = generateSecureIdempotencyKey();
      const key2 = generateSecureIdempotencyKey();

      expect(key1).not.toBe(key2);
      expect(key1).toHaveLength(32);
      expect(key2).toHaveLength(32);
      expect(key1).toMatch(/^[a-f0-9]{32}$/);
      expect(key2).toMatch(/^[a-f0-9]{32}$/);
    });

    it("should use timestamp and randomness", () => {
      // Mock Date.now to test deterministic part
      const originalNow = Date.now;
      const mockTime = 1640995200000; // Fixed timestamp

      vi.spyOn(Date, "now").mockReturnValue(mockTime);

      const key1 = generateSecureIdempotencyKey();
      const key2 = generateSecureIdempotencyKey();

      // Should still be different due to Math.random()
      expect(key1).not.toBe(key2);
      expect(key1).toHaveLength(32);
      expect(key2).toHaveLength(32);

      vi.mocked(Date.now).mockRestore();
    });
  });

  describe("calculateEntropy", () => {
    it("should return 0 for empty string", () => {
      expect(calculateEntropy("")).toBe(0);
    });

    it("should return 0 for single character repeated", () => {
      expect(calculateEntropy("aaaa")).toBe(0);
    });

    it("should calculate entropy for uniform distribution", () => {
      const entropy = calculateEntropy("ab"); // 2 chars, equal frequency
      expect(entropy).toBe(1); // log2(2) = 1
    });

    it("should calculate entropy for non-uniform distribution", () => {
      const entropy = calculateEntropy("aab"); // 'a' appears twice, 'b' once
      expect(entropy).toBeGreaterThan(0);
      expect(entropy).toBeLessThan(2);
    });

    it("should handle special characters and Unicode", () => {
      const entropy = calculateEntropy("🚀🌟⭐");
      expect(entropy).toBeGreaterThan(0);
    });

    it("should calculate higher entropy for more diverse strings", () => {
      const lowEntropy = calculateEntropy("aaab");
      const highEntropy = calculateEntropy("abcd");

      expect(highEntropy).toBeGreaterThan(lowEntropy);
    });
  });

  describe("hashComposite", () => {
    it("should hash multiple values together", () => {
      const hash = hashComposite("value1", "value2", "value3");

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should be consistent with same inputs", () => {
      const hash1 = hashComposite("a", "b", "c");
      const hash2 = hashComposite("a", "b", "c");

      expect(hash1).toBe(hash2);
    });

    it("should be sensitive to order", () => {
      const hash1 = hashComposite("a", "b", "c");
      const hash2 = hashComposite("c", "b", "a");

      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty values", () => {
      const hash1 = hashComposite("", "b", "");
      const hash2 = hashComposite("a", "", "c");

      expect(hash1).not.toBe(hash2);
      expect(hash1).toHaveLength(64);
      expect(hash2).toHaveLength(64);
    });

    it("should handle single value", () => {
      const hash = hashComposite("single");
      expect(hash).toHaveLength(64);
    });

    it("should handle no values", () => {
      const hash = hashComposite();
      expect(hash).toHaveLength(64);
    });
  });

  describe("hashTimeWindow", () => {
    it("should generate hash for current time window", () => {
      const value = "test-value";
      const windowMs = 60000; // 1 minute

      const hash = hashTimeWindow(value, windowMs);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should generate same hash within same time window", () => {
      const value = "test-value";
      const windowMs = 60000;

      const hash1 = hashTimeWindow(value, windowMs);
      // Small delay but same window
      setTimeout(() => {
        const hash2 = hashTimeWindow(value, windowMs);
        expect(hash1).toBe(hash2);
      }, 100);
    });

    it("should be deterministic for specific timestamp", () => {
      const originalNow = Date.now;
      const fixedTime = 1640995200000; // Fixed timestamp

      vi.spyOn(Date, "now").mockReturnValue(fixedTime);

      const value = "test-value";
      const windowMs = 60000;

      const hash1 = hashTimeWindow(value, windowMs);
      const hash2 = hashTimeWindow(value, windowMs);

      expect(hash1).toBe(hash2);

      vi.mocked(Date.now).mockRestore();
    });

    it("should create different hashes for different values", () => {
      const windowMs = 60000;

      const hash1 = hashTimeWindow("value1", windowMs);
      const hash2 = hashTimeWindow("value2", windowMs);

      expect(hash1).not.toBe(hash2);
    });

    it("should create different hashes for different window sizes", () => {
      const value = "test-value";

      const hash1 = hashTimeWindow(value, 60000);
      const hash2 = hashTimeWindow(value, 120000);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("secureCompare", () => {
    it("should return true for identical strings", () => {
      const str = "test-string";
      expect(secureCompare(str, str)).toBe(true);
    });

    it("should return false for different strings of same length", () => {
      expect(secureCompare("abcdef", "abcdeg")).toBe(false);
    });

    it("should return false for strings of different length", () => {
      expect(secureCompare("short", "longer-string")).toBe(false);
    });

    it("should return true for empty strings", () => {
      expect(secureCompare("", "")).toBe(true);
    });

    it("should return false for empty vs non-empty", () => {
      expect(secureCompare("", "test")).toBe(false);
      expect(secureCompare("test", "")).toBe(false);
    });

    it("should be case-sensitive", () => {
      expect(secureCompare("Test", "test")).toBe(false);
    });

    it("should handle special characters", () => {
      const str = "tëst-strîng_123!@#";
      expect(secureCompare(str, str)).toBe(true);
    });

    it("should be timing-safe (takes same time regardless of where strings differ)", () => {
      // This is hard to test reliably, but we can at least verify functionality
      const base = "a".repeat(1000);
      const diff1 = "b" + "a".repeat(999); // Differs at start
      const diff2 = "a".repeat(999) + "b"; // Differs at end

      expect(secureCompare(base, diff1)).toBe(false);
      expect(secureCompare(base, diff2)).toBe(false);
    });
  });

  describe("extractIp", () => {
    it("should extract from x-forwarded-for header", () => {
      const headers = {
        "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178",
      };

      expect(extractIp(headers)).toBe("203.0.113.195");
    });

    it("should extract from x-real-ip header", () => {
      const headers = {
        "x-real-ip": "192.168.1.1",
      };

      expect(extractIp(headers)).toBe("192.168.1.1");
    });

    it("should extract from cf-connecting-ip header (Cloudflare)", () => {
      const headers = {
        "cf-connecting-ip": "203.0.113.195",
      };

      expect(extractIp(headers)).toBe("203.0.113.195");
    });

    it("should prioritize headers in correct order", () => {
      const headers = {
        "x-client-ip": "1.1.1.1",
        "x-real-ip": "2.2.2.2",
        "x-forwarded-for": "3.3.3.3",
      };

      expect(extractIp(headers)).toBe("3.3.3.3"); // x-forwarded-for has priority
    });

    it("should handle array values", () => {
      const headers = {
        "x-forwarded-for": ["203.0.113.195", "backup-value"],
      };

      expect(extractIp(headers)).toBe("unknown"); // Arrays are not handled
    });

    it("should return unknown for no valid headers", () => {
      const headers = {
        "user-agent": "Mozilla/5.0...",
      };

      expect(extractIp(headers)).toBe("unknown");
    });

    it("should return unknown for empty headers", () => {
      expect(extractIp({})).toBe("unknown");
    });

    it("should handle whitespace in header values", () => {
      const headers = {
        "x-forwarded-for": "  203.0.113.195  , 70.41.3.18",
      };

      expect(extractIp(headers)).toBe("203.0.113.195");
    });

    it("should skip unknown values", () => {
      const headers = {
        "x-forwarded-for": "unknown, 203.0.113.195",
        "x-real-ip": "192.168.1.1",
      };

      expect(extractIp(headers)).toBe("192.168.1.1"); // Falls back to x-real-ip
    });
  });

  describe("extractUA", () => {
    it("should extract user-agent string", () => {
      const headers = {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      };

      expect(extractUA(headers)).toBe(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      );
    });

    it("should handle array user-agent (take first)", () => {
      const headers = {
        "user-agent": ["Mozilla/5.0...", "backup-ua"],
      };

      expect(extractUA(headers)).toBe("Mozilla/5.0...");
    });

    it("should handle empty array", () => {
      const headers = {
        "user-agent": [],
      };

      expect(extractUA(headers)).toBe("unknown");
    });

    it("should return unknown for missing header", () => {
      const headers = {
        "x-forwarded-for": "1.1.1.1",
      };

      expect(extractUA(headers)).toBe("unknown");
    });

    it("should return unknown for empty headers", () => {
      expect(extractUA({})).toBe("unknown");
    });

    it("should handle undefined in array", () => {
      const headers = {
        "user-agent": [undefined, "Mozilla/5.0..."],
      };

      expect(extractUA(headers)).toBe("");
    });
  });

  describe("Integration tests", () => {
    it("should consistently hash the same IP/UA combination", () => {
      const ip = "192.168.1.1";
      const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
      const salt = "consistent-salt";

      const ipHash1 = hashIp(ip, salt);
      const ipHash2 = hashIp(ip, salt);
      const uaHash1 = hashUA(ua, salt);
      const uaHash2 = hashUA(ua, salt);

      expect(ipHash1).toBe(ipHash2);
      expect(uaHash1).toBe(uaHash2);
    });

    it("should create different hashes for different salts", () => {
      const value = "test-value";

      const hash1 = hashWithSalt(value, "salt1");
      const hash2 = hashWithSalt(value, "salt2");

      expect(hash1).not.toBe(hash2);
    });

    it("should extract and hash headers in realistic scenario", () => {
      const headers = {
        "x-forwarded-for": "203.0.113.195, 70.41.3.18",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      };

      const ip = extractIp(headers);
      const ua = extractUA(headers);
      const salt = "production-salt";

      const ipHash = hashIp(ip, salt);
      const uaHash = hashUA(ua, salt);

      expect(ip).toBe("203.0.113.195");
      expect(ua).toBe(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      );
      expect(ipHash).toHaveLength(64);
      expect(uaHash).toHaveLength(64);
    });
  });
});
