import { prisma } from "@repo/db";

/**
 * Reserved handles that cannot be used by users
 */
const RESERVED_HANDLES = [
  "admin",
  "me",
  "api",
  "rules",
  "authors",
  "leaderboards",
  "notifications",
  "sign-in",
  "sign-up",
  "onboarding",
  "settings",
  "profile",
  "dashboard",
  "help",
  "support",
  "about",
  "contact",
  "privacy",
  "terms",
  "blog",
  "docs",
  "www",
  "mail",
  "ftp",
  "root",
  "null",
  "undefined",
  "true",
  "false",
  "test",
  "demo",
  "example",
  "sample",
];

/**
 * Convert input string to a valid handle slug
 * - Lowercase only
 * - Alphanumeric and hyphens only
 * - No leading/trailing hyphens
 * - Collapse multiple hyphens
 */
export function slugifyHandle(input: string): string {
  return (
    input
      .toLowerCase()
      .trim()
      // Replace any non-alphanumeric characters with hyphens
      .replace(/[^a-z0-9]+/g, "-")
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, "")
      // Collapse multiple hyphens
      .replace(/-+/g, "-") ||
    // Ensure it's not empty
    "user"
  );
}

/**
 * Check if a handle is in the reserved list
 */
export function isReserved(handle: string): boolean {
  return RESERVED_HANDLES.includes(handle.toLowerCase());
}

/**
 * Generate a unique handle by checking the database
 * If the base handle is taken, append -2, -3, etc.
 */
export async function generateUniqueHandle(base: string): Promise<string> {
  const slugified = slugifyHandle(base);

  // If it's reserved, start with a suffix
  if (isReserved(slugified)) {
    return generateUniqueHandle(`${slugified}-user`);
  }

  // Check if the base handle is available
  const existing = await prisma.user.findUnique({
    where: { handle: slugified },
    select: { id: true },
  });

  if (!existing) {
    return slugified;
  }

  // Try with suffixes
  let counter = 2;
  while (counter <= 999) {
    // Reasonable limit
    const candidate = `${slugified}-${counter}`;

    const existingWithSuffix = await prisma.user.findUnique({
      where: { handle: candidate },
      select: { id: true },
    });

    if (!existingWithSuffix) {
      return candidate;
    }

    counter++;
  }

  // Fallback to a random suffix if we've exhausted reasonable attempts
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${slugified}-${randomSuffix}`;
}

/**
 * Validate a handle meets our requirements
 */
export function validateHandle(handle: string): {
  isValid: boolean;
  error?: string;
} {
  if (!handle || handle.length === 0) {
    return { isValid: false, error: "Handle is required" };
  }

  if (handle.length < 3) {
    return { isValid: false, error: "Handle must be at least 3 characters" };
  }

  if (handle.length > 30) {
    return { isValid: false, error: "Handle must be at most 30 characters" };
  }

  if (!/^[a-z0-9-]+$/.test(handle)) {
    return {
      isValid: false,
      error: "Handle can only contain lowercase letters, numbers, and hyphens",
    };
  }

  if (handle.startsWith("-") || handle.endsWith("-")) {
    return {
      isValid: false,
      error: "Handle cannot start or end with a hyphen",
    };
  }

  if (handle.includes("--")) {
    return {
      isValid: false,
      error: "Handle cannot contain consecutive hyphens",
    };
  }

  if (isReserved(handle)) {
    return {
      isValid: false,
      error: "This handle is reserved and cannot be used",
    };
  }

  return { isValid: true };
}

/**
 * Check if a handle is available (not taken by another user)
 */
export async function isHandleAvailable(
  handle: string,
  excludeUserId?: string
): Promise<boolean> {
  const validation = validateHandle(handle);
  if (!validation.isValid) {
    return false;
  }

  const existing = await prisma.user.findUnique({
    where: { handle },
    select: { id: true },
  });

  // If no existing user, it's available
  if (!existing) {
    return true;
  }

  // If excluding a specific user ID (for updates), check if it's the same user
  if (excludeUserId && existing.id === excludeUserId) {
    return true;
  }

  return false;
}
