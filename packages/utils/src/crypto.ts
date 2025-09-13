/**
 * Crypto utilities for hashing, encryption, and secure operations
 * Note: These are basic implementations. For production, consider using dedicated crypto libraries.
 */

/**
 * Generate a secure random string
 */
export function generateSecureRandom(length: number = 32): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";

  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    // Browser/modern environment
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length];
    }
  } else {
    // Fallback for older environments
    for (let i = 0; i < length; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }

  return result;
}

/**
 * Simple hash function (not cryptographically secure)
 * For production, use a proper hashing library like bcrypt
 */
export function simpleHash(input: string): string {
  let hash = 0;
  if (input.length === 0) return hash.toString();

  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(36);
}

/**
 * Generate a hash using Web Crypto API (if available)
 */
export async function sha256Hash(input: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Web Crypto API not available");
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return hashHex;
}

/**
 * Generate a HMAC signature
 */
export async function generateHMAC(
  message: string,
  secret: string
): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    throw new Error("Web Crypto API not available");
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  const signatureArray = Array.from(new Uint8Array(signature));
  const signatureHex = signatureArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return signatureHex;
}

/**
 * Verify HMAC signature
 */
export async function verifyHMAC(
  message: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const expectedSignature = await generateHMAC(message, secret);
    return expectedSignature === signature;
  } catch {
    return false;
  }
}

/**
 * Generate a JWT-like token (simplified, not a real JWT)
 * For production, use a proper JWT library
 */
export function generateSimpleToken(
  payload: Record<string, any>,
  secret: string
): string {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const signature = simpleHash(`${encodedHeader}.${encodedPayload}.${secret}`);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify and decode simple token
 */
export function verifySimpleToken(
  token: string,
  secret: string
): Record<string, any> | null {
  try {
    const [encodedHeader, encodedPayload, signature] = token.split(".");
    const expectedSignature = simpleHash(
      `${encodedHeader}.${encodedPayload}.${secret}`
    );

    if (signature !== expectedSignature) {
      return null;
    }

    const payload = JSON.parse(atob(encodedPayload));

    // Check expiration if present
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Mask sensitive data (like API keys, emails)
 */
export function maskSensitiveData(
  data: string,
  visibleChars: number = 4
): string {
  if (data.length <= visibleChars * 2) {
    return "*".repeat(data.length);
  }

  const start = data.slice(0, visibleChars);
  const end = data.slice(-visibleChars);
  const middle = "*".repeat(data.length - visibleChars * 2);

  return `${start}${middle}${end}`;
}

/**
 * Generate a secure API key
 */
export function generateApiKey(prefix: string = "sk"): string {
  const randomPart = generateSecureRandom(32);
  return `${prefix}_${randomPart}`;
}

/**
 * Constant-time string comparison (prevents timing attacks)
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
