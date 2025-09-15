import { nanoid, customAlphabet } from "nanoid";

/**
 * Generate a standard nanoid (21 characters, URL-safe)
 */
export function generateId(): string {
  return nanoid();
}

/**
 * Generate a short ID (10 characters, URL-safe)
 */
export function generateShortId(): string {
  return nanoid(10);
}

/**
 * Generate a long ID (32 characters, URL-safe)
 */
export function generateLongId(): string {
  return nanoid(32);
}

/**
 * Generate a numeric ID (numbers only)
 */
const numericNanoid = customAlphabet("0123456789", 10);
export function generateNumericId(): string {
  return numericNanoid();
}

/**
 * Generate an uppercase alphanumeric ID
 */
const uppercaseNanoid = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  12
);
export function generateUppercaseId(): string {
  return uppercaseNanoid();
}

/**
 * Generate a slug-friendly ID (lowercase letters and numbers only)
 */
const slugNanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 16);
export function generateSlugId(): string {
  return slugNanoid();
}

/**
 * Generate a prefixed ID
 */
export function generatePrefixedId(prefix: string, length = 21): string {
  return `${prefix}_${nanoid(length)}`;
}

/**
 * Common prefixed ID generators
 */
export const generateUserId = () => generatePrefixedId("usr", 16);
export const generatePostId = () => generatePrefixedId("post", 16);
export const generateSessionId = () => generatePrefixedId("sess", 32);
export const generateApiKeyId = () => generatePrefixedId("key", 24);
export const generateInviteId = () => generatePrefixedId("inv", 16);
export const generateWebhookId = () => generatePrefixedId("wh", 16);

/**
 * Generate a time-based ID (includes timestamp prefix)
 */
export function generateTimeBasedId(prefix?: string): string {
  const timestamp = Date.now().toString(36);
  const random = nanoid(8);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * Extract timestamp from time-based ID
 */
export function extractTimestampFromId(id: string): Date | null {
  try {
    const parts = id.split("_");

    // Validate ID format: should be either "timestamp_random" or "prefix_timestamp_random"
    if (parts.length !== 2 && parts.length !== 3) {
      return null;
    }

    const timestampPart = parts.length === 3 ? parts[1] : parts[0];

    // Validate timestamp part: should be a valid base 36 string from time-based generation
    // Real timestamps are typically 8 characters long in base 36, but allow edge cases
    if (
      !timestampPart ||
      timestampPart.length < 1 ||
      timestampPart.length > 12
    ) {
      return null;
    }

    // Additional validation: reject obvious non-timestamp strings that are too short
    // but still valid base36 (like "one", "two", etc.)
    if (timestampPart.length <= 3 && !/^\d+$/.test(timestampPart)) {
      return null;
    }

    // Check if it contains only valid base 36 characters
    if (!/^[0-9a-z]+$/i.test(timestampPart)) {
      return null;
    }

    const timestamp = parseInt(timestampPart, 36);

    // Validate the timestamp is in a reasonable range (not too old or too far in future)
    // Use a wider range for testing compatibility
    const minTime = 0; // Allow Unix epoch
    const maxTime = Date.UTC(2030, 0, 1); // January 1, 2030

    if (timestamp < minTime || timestamp > maxTime) {
      return null;
    }

    return new Date(timestamp);
  } catch {
    return null;
  }
}

/**
 * Validate ID format
 */
export function isValidNanoid(id: string): boolean {
  // Standard nanoid is 21 characters, URL-safe alphabet
  const nanoidRegex = /^[A-Za-z0-9_-]{21}$/;
  return nanoidRegex.test(id);
}

/**
 * Validate prefixed ID format
 */
export function isValidPrefixedId(id: string, prefix: string): boolean {
  const regex = new RegExp(`^${prefix}_[A-Za-z0-9_-]+$`);
  return regex.test(id);
}

/**
 * Generate a secure random token (for API keys, secrets, etc.)
 */
export function generateSecureToken(length = 32): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const secureNanoid = customAlphabet(alphabet, length);
  return secureNanoid();
}

/**
 * Generate a human-readable ID (words + numbers)
 */
const words = [
  "happy",
  "sunny",
  "bright",
  "swift",
  "brave",
  "wise",
  "kind",
  "warm",
  "fresh",
  "smart",
  "quick",
  "safe",
  "free",
  "pure",
  "true",
];

export function generateReadableId(): string {
  const word1 = words[Math.floor(Math.random() * words.length)];
  const word2 = words[Math.floor(Math.random() * words.length)];

  // Generate number avoiding confusing characters (0, 1)
  // Use only digits 2-9 to avoid 0 and 1
  const digits = "23456789";
  const numLength = 2 + Math.floor(Math.random() * 2); // 2-3 digits
  let number = "";
  for (let i = 0; i < numLength; i++) {
    number += digits[Math.floor(Math.random() * digits.length)];
  }

  return `${word1}-${word2}-${number}`;
}
