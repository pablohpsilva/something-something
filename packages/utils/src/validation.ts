import { z } from "zod";

/**
 * Common validation schemas
 */

// Email validation
export const emailSchema = z.string().email("Invalid email address");

// URL validation
export const urlSchema = z.string().url("Invalid URL");

// Password validation (at least 8 characters, 1 uppercase, 1 lowercase, 1 number)
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

// Strong password validation (includes special characters)
export const strongPasswordSchema = passwordSchema.regex(
  /[^A-Za-z0-9]/,
  "Password must contain at least one special character"
);

// Username validation (alphanumeric + underscore/hyphen, 3-30 chars)
export const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Username can only contain letters, numbers, underscores, and hyphens"
  );

// Slug validation (lowercase letters, numbers, hyphens)
export const slugSchema = z
  .string()
  .min(1, "Slug is required")
  .max(100, "Slug must be at most 100 characters")
  .regex(
    /^[a-z0-9-]+$/,
    "Slug can only contain lowercase letters, numbers, and hyphens"
  )
  .refine((val) => !val.startsWith("-") && !val.endsWith("-"), {
    message: "Slug cannot start or end with a hyphen",
  });

// Phone number validation (basic international format)
export const phoneSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format");

// Color hex validation
export const hexColorSchema = z
  .string()
  .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid hex color format");

// Date string validation (ISO 8601)
export const dateStringSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/,
    "Invalid date format"
  );

// Pagination schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// Sort schema
export const sortSchema = z.object({
  sortBy: z.string().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// Search schema
export const searchSchema = z.object({
  q: z
    .string()
    .min(1, "Search query is required")
    .max(100, "Search query too long"),
});

// File upload validation
export const fileUploadSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  mimetype: z.string().min(1, "MIME type is required"),
  size: z.number().int().min(1, "File size must be greater than 0"),
});

// Image file validation
export const imageFileSchema = fileUploadSchema.extend({
  mimetype: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"], {
    errorMap: () => ({
      message: "File must be a valid image (JPEG, PNG, GIF, or WebP)",
    }),
  }),
  size: z
    .number()
    .int()
    .max(5 * 1024 * 1024, "Image must be smaller than 5MB"),
});

// Document file validation
export const documentFileSchema = fileUploadSchema.extend({
  mimetype: z.enum(
    [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    {
      errorMap: () => ({
        message: "File must be a valid document (PDF, DOC, or DOCX)",
      }),
    }
  ),
  size: z
    .number()
    .int()
    .max(10 * 1024 * 1024, "Document must be smaller than 10MB"),
});

/**
 * Validation helper functions
 */

// Validate email
export function isValidEmail(email: string): boolean {
  return emailSchema.safeParse(email).success;
}

// Validate URL
export function isValidUrl(url: string): boolean {
  return urlSchema.safeParse(url).success;
}

// Validate password strength
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  score: number;
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score += 1;
  else feedback.push("Use at least 8 characters");

  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push("Include uppercase letters");

  if (/[a-z]/.test(password)) score += 1;
  else feedback.push("Include lowercase letters");

  if (/[0-9]/.test(password)) score += 1;
  else feedback.push("Include numbers");

  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  else feedback.push("Include special characters");

  return {
    isValid: score >= 4,
    score,
    feedback,
  };
}

// Sanitize string (remove HTML tags and trim)
export function sanitizeString(input: string): string {
  return input.replace(/<[^>]*>/g, "").trim();
}

// Validate and normalize slug
export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Validate JSON string
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

// Create a validation error message
export function formatValidationError(error: z.ZodError): string {
  return error.errors
    .map((err) => `${err.path.join(".")}: ${err.message}`)
    .join(", ");
}
