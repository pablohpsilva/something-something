/**
 * String manipulation utilities
 */

/**
 * Capitalize first letter of a string
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Capitalize first letter of each word
 */
export function capitalizeWords(str: string): string {
  if (!str) return str;
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Convert string to camelCase
 */
export function toCamelCase(str: string): string {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, "");
}

/**
 * Convert string to PascalCase
 */
export function toPascalCase(str: string): string {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => {
      return word.toUpperCase();
    })
    .replace(/\s+/g, "");
}

/**
 * Convert string to kebab-case
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();
}

/**
 * Convert string to snake_case
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
}

/**
 * Convert string to CONSTANT_CASE
 */
export function toConstantCase(str: string): string {
  return toSnakeCase(str).toUpperCase();
}

/**
 * Truncate string with ellipsis
 */
export function truncate(
  str: string,
  length: number,
  suffix: string = "..."
): string {
  if (str.length <= length) return str;
  return str.slice(0, length - suffix.length) + suffix;
}

/**
 * Truncate string at word boundary
 */
export function truncateWords(
  str: string,
  maxWords: number,
  suffix: string = "..."
): string {
  const words = str.split(/\s+/);
  if (words.length <= maxWords) return str;
  return words.slice(0, maxWords).join(" ") + suffix;
}

/**
 * Remove extra whitespace and normalize spaces
 */
export function normalizeWhitespace(str: string): string {
  return str.replace(/\s+/g, " ").trim();
}

/**
 * Remove all whitespace
 */
export function removeWhitespace(str: string): string {
  return str.replace(/\s/g, "");
}

/**
 * Pad string to specified length
 */
export function padString(
  str: string,
  length: number,
  padChar: string = " ",
  padLeft: boolean = false
): string {
  if (str.length >= length) return str;
  const padding = padChar.repeat(length - str.length);
  return padLeft ? padding + str : str + padding;
}

/**
 * Generate a slug from string
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/[\s_-]+/g, "-") // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Extract initials from name
 */
export function getInitials(name: string, maxInitials: number = 2): string {
  return name
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, maxInitials)
    .join("");
}

/**
 * Count words in string
 */
export function countWords(str: string): number {
  return str
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

/**
 * Count characters (excluding whitespace)
 */
export function countCharacters(
  str: string,
  includeSpaces: boolean = true
): number {
  return includeSpaces ? str.length : str.replace(/\s/g, "").length;
}

/**
 * Reverse string
 */
export function reverse(str: string): string {
  return str.split("").reverse().join("");
}

/**
 * Check if string is palindrome
 */
export function isPalindrome(str: string): boolean {
  const cleaned = str.toLowerCase().replace(/[^a-z0-9]/g, "");
  return cleaned === reverse(cleaned);
}

/**
 * Generate random string
 */
export function randomString(
  length: number,
  charset: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

/**
 * Escape HTML characters
 */
export function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
  };

  return str.replace(/[&<>"'/]/g, (match) => htmlEscapes[match] || match);
}

/**
 * Unescape HTML characters
 */
export function unescapeHtml(str: string): string {
  const htmlUnescapes: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#x27;": "'",
    "&#x2F;": "/",
  };

  return str.replace(
    /&(?:amp|lt|gt|quot|#x27|#x2F);/g,
    (match) => htmlUnescapes[match] || match
  );
}

/**
 * Extract domain from email
 */
export function extractEmailDomain(email: string): string {
  const match = email.match(/@(.+)$/);
  return match ? match[1] || "" : "";
}

/**
 * Mask email address
 */
export function maskEmail(email: string): string {
  const [username, domain] = email.split("@");
  if (!username || !domain) return email;

  const maskedUsername =
    username.length > 2
      ? username.charAt(0) +
        "*".repeat(username.length - 2) +
        username.charAt(username.length - 1)
      : "*".repeat(username.length);

  return `${maskedUsername}@${domain}`;
}

/**
 * Format phone number
 */
export function formatPhoneNumber(
  phone: string,
  format: "us" | "international" = "us"
): string {
  const digits = phone.replace(/\D/g, "");

  if (format === "us" && digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (
    format === "us" &&
    digits.length === 11 &&
    digits.startsWith("1")
  ) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(
      7
    )}`;
  }

  return phone; // Return original if can't format
}

/**
 * Generate excerpt from text
 */
export function generateExcerpt(text: string, maxLength: number = 150): string {
  if (text.length <= maxLength) return text;

  // Try to break at sentence boundary
  const sentences = text.split(/[.!?]+/);
  let excerpt = "";

  for (const sentence of sentences) {
    if ((excerpt + sentence).length > maxLength) break;
    excerpt += sentence + ".";
  }

  if (excerpt.length === 0) {
    // Fallback to word boundary
    return truncate(text, maxLength);
  }

  return excerpt.trim();
}
