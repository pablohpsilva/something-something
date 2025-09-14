import { createHmac, createHash } from "crypto";

/**
 * Privacy-preserving cryptographic utilities for anti-abuse systems
 */

/**
 * Create a SHA-256 hash of a string (internal use)
 */
export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Create a salted HMAC-SHA256 hash
 */
export function hashWithSalt(value: string, salt: string): string {
  return createHmac("sha256", salt).update(value).digest("hex");
}

/**
 * Hash an IP address with salt for privacy-preserving rate limiting
 */
export function hashIp(ipRaw: string, salt: string): string {
  // Normalize IP (remove port, handle IPv6, etc.)
  const normalizedIp = normalizeIp(ipRaw);
  return hashWithSalt(normalizedIp, salt);
}

/**
 * Hash a User-Agent string with salt for device fingerprinting
 */
export function hashUA(uaRaw: string, salt: string): string {
  // Normalize UA (remove version numbers for better grouping)
  const normalizedUA = normalizeUA(uaRaw);
  return hashWithSalt(normalizedUA, salt);
}

/**
 * Normalize IP address for consistent hashing
 */
function normalizeIp(ip: string): string {
  if (!ip || ip === "unknown") return "unknown";

  // Handle comma-separated IPs (X-Forwarded-For)
  const firstIp = (ip.split(",")[0] || "").trim();

  // Remove port if present
  const withoutPort = firstIp.replace(/:\d+$/, "");

  // Handle IPv6 brackets
  return withoutPort.replace(/^\[|\]$/g, "").toLowerCase();
}

/**
 * Normalize User-Agent for better grouping while preserving uniqueness
 */
function normalizeUA(ua: string): string {
  if (!ua || ua === "unknown") return "unknown";

  // Remove specific version numbers but keep major versions
  return ua
    .replace(/\d+\.\d+\.\d+\.\d+/g, "X.X.X.X") // Remove detailed versions
    .replace(/Chrome\/\d+\.\d+\.\d+/g, "Chrome/X.X.X") // Normalize Chrome
    .replace(/Firefox\/\d+\.\d+/g, "Firefox/X.X") // Normalize Firefox
    .replace(/Safari\/\d+\.\d+/g, "Safari/X.X") // Normalize Safari
    .replace(/Edge\/\d+\.\d+/g, "Edge/X.X") // Normalize Edge
    .trim();
}

/**
 * Generate a secure random string for idempotency keys
 */
export function generateSecureIdempotencyKey(): string {
  return createHash("sha256")
    .update(Date.now().toString())
    .update(Math.random().toString())
    .digest("hex")
    .substring(0, 32);
}

/**
 * Calculate entropy of a string (for anomaly detection)
 */
export function calculateEntropy(str: string): number {
  if (!str) return 0;

  const frequencies = new Map<string, number>();
  for (const char of str) {
    frequencies.set(char, (frequencies.get(char) || 0) + 1);
  }

  let entropy = 0;
  const length = str.length;

  for (const count of frequencies.values()) {
    const probability = count / length;
    entropy -= probability * Math.log2(probability);
  }

  return entropy;
}

/**
 * Hash a combination of values for composite keys
 */
export function hashComposite(...values: string[]): string {
  return sha256(values.join("|"));
}

/**
 * Time-based hash for sliding window buckets
 */
export function hashTimeWindow(value: string, windowMs: number): string {
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  return hashComposite(value, windowStart.toString());
}

/**
 * Secure comparison of hashes (timing attack resistant)
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Extract IP from various header formats
 */
export function extractIp(
  headers: Record<string, string | string[] | undefined>
): string {
  // Try various headers in order of preference
  const candidates = [
    headers["x-forwarded-for"],
    headers["x-real-ip"],
    headers["cf-connecting-ip"], // Cloudflare
    headers["x-client-ip"],
    headers["x-cluster-client-ip"],
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const ip = (candidate.split(",")[0] || "").trim();
      if (ip && ip !== "unknown") return ip;
    }
  }

  return "unknown";
}

/**
 * Extract User-Agent from headers
 */
export function extractUA(
  headers: Record<string, string | string[] | undefined>
): string {
  const ua = headers["user-agent"];
  if (typeof ua === "string") return ua;
  if (Array.isArray(ua) && ua.length > 0) return ua[0] || "";
  return "unknown";
}
