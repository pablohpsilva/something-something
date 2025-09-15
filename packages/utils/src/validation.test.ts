import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  emailSchema,
  urlSchema,
  passwordSchema,
  strongPasswordSchema,
  usernameSchema,
  slugSchema,
  phoneSchema,
  hexColorSchema,
  dateStringSchema,
  paginationSchema,
  cursorPaginationSchema,
  sortSchema,
  searchSchema,
  fileUploadSchema,
  imageFileSchema,
  documentFileSchema,
  isValidEmail,
  isValidUrl,
  validatePasswordStrength,
  sanitizeString,
  normalizeSlug,
  isValidJson,
  formatValidationError,
} from "./validation";

describe("Validation utilities", () => {
  describe("emailSchema", () => {
    it("should validate correct emails", () => {
      const validEmails = [
        "user@example.com",
        "test.email@domain.co.uk",
        "user+tag@example.org",
        "123@numbers.com",
        "a@b.co",
      ];

      validEmails.forEach((email) => {
        expect(() => emailSchema.parse(email)).not.toThrow();
      });
    });

    it("should reject invalid emails", () => {
      const invalidEmails = [
        "invalid-email",
        "user@",
        "@domain.com",
        "user..double@example.com",
        "user@domain",
        "",
        "spaces in@email.com",
      ];

      invalidEmails.forEach((email) => {
        expect(() => emailSchema.parse(email)).toThrow();
      });
    });
  });

  describe("urlSchema", () => {
    it("should validate correct URLs", () => {
      const validUrls = [
        "https://example.com",
        "http://test.org",
        "https://subdomain.example.com/path?query=value",
        "ftp://files.example.com",
        "https://localhost:3000",
      ];

      validUrls.forEach((url) => {
        expect(() => urlSchema.parse(url)).not.toThrow();
      });
    });

    it("should reject invalid URLs", () => {
      const invalidUrls = [
        "not-a-url",
        "example.com", // missing protocol
        "https://",
        "",
        "javascript:alert('xss')",
      ];

      invalidUrls.forEach((url) => {
        expect(() => urlSchema.parse(url)).toThrow();
      });
    });
  });

  describe("passwordSchema", () => {
    it("should validate strong passwords", () => {
      const validPasswords = [
        "Password1",
        "MyStrongPass123",
        "Test1234",
        "Abcdefgh1",
      ];

      validPasswords.forEach((password) => {
        expect(() => passwordSchema.parse(password)).not.toThrow();
      });
    });

    it("should reject weak passwords", () => {
      const invalidPasswords = [
        "short", // too short
        "alllowercase1", // no uppercase
        "ALLUPPERCASE1", // no lowercase
        "NoNumbers", // no numbers
        "password", // too weak
        "",
      ];

      invalidPasswords.forEach((password) => {
        expect(() => passwordSchema.parse(password)).toThrow();
      });
    });

    it("should require minimum length", () => {
      expect(() => passwordSchema.parse("Test1")).toThrow(
        "at least 8 characters"
      );
    });

    it("should require uppercase letter", () => {
      expect(() => passwordSchema.parse("password123")).toThrow(
        "uppercase letter"
      );
    });

    it("should require lowercase letter", () => {
      expect(() => passwordSchema.parse("PASSWORD123")).toThrow(
        "lowercase letter"
      );
    });

    it("should require number", () => {
      expect(() => passwordSchema.parse("Password")).toThrow("one number");
    });
  });

  describe("strongPasswordSchema", () => {
    it("should validate very strong passwords", () => {
      const validPasswords = [
        "Password1!",
        "MyStr0ng@Pass",
        "Test123#$",
        "Secure&Pass9",
      ];

      validPasswords.forEach((password) => {
        expect(() => strongPasswordSchema.parse(password)).not.toThrow();
      });
    });

    it("should reject passwords without special characters", () => {
      expect(() => strongPasswordSchema.parse("Password123")).toThrow(
        "special character"
      );
    });

    it("should inherit all password requirements", () => {
      expect(() => strongPasswordSchema.parse("weak!")).toThrow(
        "at least 8 characters"
      );
      expect(() => strongPasswordSchema.parse("password123!")).toThrow(
        "uppercase letter"
      );
    });
  });

  describe("usernameSchema", () => {
    it("should validate correct usernames", () => {
      const validUsernames = [
        "user123",
        "test_user",
        "my-username",
        "user",
        "a".repeat(30), // max length
      ];

      validUsernames.forEach((username) => {
        expect(() => usernameSchema.parse(username)).not.toThrow();
      });
    });

    it("should reject invalid usernames", () => {
      const invalidUsernames = [
        "ab", // too short
        "a".repeat(31), // too long
        "user@name", // invalid character
        "user.name", // invalid character
        "user name", // space
        "",
      ];

      invalidUsernames.forEach((username) => {
        expect(() => usernameSchema.parse(username)).toThrow();
      });
    });
  });

  describe("slugSchema", () => {
    it("should validate correct slugs", () => {
      const validSlugs = [
        "my-slug",
        "test-123",
        "a",
        "very-long-slug-with-many-words",
        "123-numbers",
      ];

      validSlugs.forEach((slug) => {
        expect(() => slugSchema.parse(slug)).not.toThrow();
      });
    });

    it("should reject invalid slugs", () => {
      const invalidSlugs = [
        "", // empty
        "a".repeat(101), // too long
        "-starts-with-hyphen",
        "ends-with-hyphen-",
        "has_underscore",
        "has SPACE",
        "hasUPPER",
        "has@special",
      ];

      invalidSlugs.forEach((slug) => {
        expect(() => slugSchema.parse(slug)).toThrow();
      });
    });

    it("should provide specific error messages", () => {
      expect(() => slugSchema.parse("")).toThrow("Slug is required");
      expect(() => slugSchema.parse("a".repeat(101))).toThrow(
        "at most 100 characters"
      );
      expect(() => slugSchema.parse("-invalid")).toThrow(
        "cannot start or end with a hyphen"
      );
      expect(() => slugSchema.parse("invalid-")).toThrow(
        "cannot start or end with a hyphen"
      );
    });
  });

  describe("phoneSchema", () => {
    it("should validate international phone numbers", () => {
      const validPhones = [
        "+1234567890",
        "+12345678901234",
        "1234567890",
        "+441234567890",
      ];

      validPhones.forEach((phone) => {
        expect(() => phoneSchema.parse(phone)).not.toThrow();
      });
    });

    it("should reject invalid phone numbers", () => {
      const invalidPhones = [
        "", // empty
        "+", // just plus
        "123", // too short
        "+0123", // starts with 0 after country code
        "abc123", // letters
        "+12345678901234567890", // too long
      ];

      invalidPhones.forEach((phone) => {
        expect(() => phoneSchema.parse(phone)).toThrow();
      });
    });
  });

  describe("hexColorSchema", () => {
    it("should validate hex colors", () => {
      const validColors = [
        "#ff0000", // 6 digit
        "#f00", // 3 digit
        "#123456",
        "#abc",
        "#FFFFFF",
        "#000",
      ];

      validColors.forEach((color) => {
        expect(() => hexColorSchema.parse(color)).not.toThrow();
      });
    });

    it("should reject invalid hex colors", () => {
      const invalidColors = [
        "ff0000", // missing #
        "#gg0000", // invalid characters
        "#12345", // wrong length
        "#1234567", // too long
        "#", // just hash
        "",
      ];

      invalidColors.forEach((color) => {
        expect(() => hexColorSchema.parse(color)).toThrow();
      });
    });
  });

  describe("dateStringSchema", () => {
    it("should validate ISO date strings", () => {
      const validDates = [
        "2023-06-15T12:30:45Z",
        "2023-06-15T12:30:45.123Z",
        "2023-06-15T12:30:45",
        "2023-12-31T23:59:59.999Z",
      ];

      validDates.forEach((date) => {
        expect(() => dateStringSchema.parse(date)).not.toThrow();
      });
    });

    it("should reject invalid date strings", () => {
      const invalidDates = [
        "2023-06-15", // date only
        "12:30:45", // time only
        "2023/06/15", // wrong format
        "not-a-date",
        "",
        "2023-13-01T12:30:45Z", // invalid month
      ];

      invalidDates.forEach((date) => {
        expect(() => dateStringSchema.parse(date)).toThrow();
      });
    });
  });

  describe("paginationSchema", () => {
    it("should validate pagination parameters", () => {
      const validPagination = [
        { page: 1, limit: 10 },
        { page: 5, limit: 50 },
        { page: "1", limit: "20" }, // string numbers
      ];

      validPagination.forEach((pagination) => {
        const result = paginationSchema.parse(pagination);
        expect(result.page).toBeGreaterThanOrEqual(1);
        expect(result.limit).toBeGreaterThanOrEqual(1);
        expect(result.limit).toBeLessThanOrEqual(100);
      });
    });

    it("should use default values", () => {
      const result = paginationSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it("should coerce string numbers", () => {
      const result = paginationSchema.parse({ page: "3", limit: "25" });
      expect(result.page).toBe(3);
      expect(result.limit).toBe(25);
    });

    it("should reject invalid pagination", () => {
      const invalidPagination = [
        { page: 0 }, // page must be >= 1
        { page: -1 },
        { limit: 0 }, // limit must be >= 1
        { limit: 101 }, // limit must be <= 100
        { page: "abc" }, // non-numeric
      ];

      invalidPagination.forEach((pagination) => {
        expect(() => paginationSchema.parse(pagination)).toThrow();
      });
    });
  });

  describe("cursorPaginationSchema", () => {
    it("should validate cursor pagination", () => {
      const validPagination = [
        { cursor: "abc123", limit: 20 },
        { limit: 10 }, // cursor optional
        {},
      ];

      validPagination.forEach((pagination) => {
        const result = cursorPaginationSchema.parse(pagination);
        expect(result.limit).toBeGreaterThanOrEqual(1);
        expect(result.limit).toBeLessThanOrEqual(100);
      });
    });

    it("should handle optional cursor", () => {
      const result = cursorPaginationSchema.parse({ limit: 25 });
      expect(result.cursor).toBeUndefined();
      expect(result.limit).toBe(25);
    });

    it("should use default limit", () => {
      const result = cursorPaginationSchema.parse({});
      expect(result.limit).toBe(10);
    });
  });

  describe("sortSchema", () => {
    it("should validate sort parameters", () => {
      const validSort = [
        { sortBy: "name", sortOrder: "asc" },
        { sortBy: "date", sortOrder: "desc" },
        {}, // use defaults
      ];

      validSort.forEach((sort) => {
        const result = sortSchema.parse(sort);
        expect(["asc", "desc"]).toContain(result.sortOrder);
      });
    });

    it("should use default values", () => {
      const result = sortSchema.parse({});
      expect(result.sortBy).toBe("createdAt");
      expect(result.sortOrder).toBe("desc");
    });

    it("should reject invalid sort order", () => {
      expect(() => sortSchema.parse({ sortOrder: "invalid" })).toThrow();
    });
  });

  describe("searchSchema", () => {
    it("should validate search queries", () => {
      const validQueries = [
        { q: "search term" },
        { q: "a" }, // minimum length
        { q: "a".repeat(100) }, // maximum length
      ];

      validQueries.forEach((query) => {
        expect(() => searchSchema.parse(query)).not.toThrow();
      });
    });

    it("should reject invalid queries", () => {
      const invalidQueries = [
        {}, // missing q
        { q: "" }, // empty
        { q: "a".repeat(101) }, // too long
      ];

      invalidQueries.forEach((query) => {
        expect(() => searchSchema.parse(query)).toThrow();
      });
    });
  });

  describe("fileUploadSchema", () => {
    it("should validate file upload data", () => {
      const validFiles = [
        {
          filename: "document.pdf",
          mimetype: "application/pdf",
          size: 1024,
        },
        {
          filename: "image.jpg",
          mimetype: "image/jpeg",
          size: 500000,
        },
      ];

      validFiles.forEach((file) => {
        expect(() => fileUploadSchema.parse(file)).not.toThrow();
      });
    });

    it("should reject invalid file data", () => {
      const invalidFiles = [
        {}, // missing fields
        { filename: "", mimetype: "text/plain", size: 100 }, // empty filename
        { filename: "file.txt", mimetype: "", size: 100 }, // empty mimetype
        { filename: "file.txt", mimetype: "text/plain", size: 0 }, // zero size
        { filename: "file.txt", mimetype: "text/plain", size: -1 }, // negative size
      ];

      invalidFiles.forEach((file) => {
        expect(() => fileUploadSchema.parse(file)).toThrow();
      });
    });
  });

  describe("imageFileSchema", () => {
    it("should validate image files", () => {
      const validImages = [
        {
          filename: "photo.jpg",
          mimetype: "image/jpeg",
          size: 1024 * 1024, // 1MB
        },
        {
          filename: "graphic.png",
          mimetype: "image/png",
          size: 2 * 1024 * 1024, // 2MB
        },
        {
          filename: "animation.gif",
          mimetype: "image/gif",
          size: 500 * 1024, // 500KB
        },
        {
          filename: "modern.webp",
          mimetype: "image/webp",
          size: 1024,
        },
      ];

      validImages.forEach((image) => {
        expect(() => imageFileSchema.parse(image)).not.toThrow();
      });
    });

    it("should reject non-image files", () => {
      const invalidImages = [
        {
          filename: "document.pdf",
          mimetype: "application/pdf",
          size: 1024,
        },
        {
          filename: "video.mp4",
          mimetype: "video/mp4",
          size: 1024,
        },
      ];

      invalidImages.forEach((image) => {
        expect(() => imageFileSchema.parse(image)).toThrow("valid image");
      });
    });

    it("should reject oversized images", () => {
      const oversizedImage = {
        filename: "huge.jpg",
        mimetype: "image/jpeg",
        size: 6 * 1024 * 1024, // 6MB
      };

      expect(() => imageFileSchema.parse(oversizedImage)).toThrow(
        "smaller than 5MB"
      );
    });
  });

  describe("documentFileSchema", () => {
    it("should validate document files", () => {
      const validDocuments = [
        {
          filename: "report.pdf",
          mimetype: "application/pdf",
          size: 2 * 1024 * 1024, // 2MB
        },
        {
          filename: "document.doc",
          mimetype: "application/msword",
          size: 1024 * 1024, // 1MB
        },
        {
          filename: "document.docx",
          mimetype:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          size: 3 * 1024 * 1024, // 3MB
        },
      ];

      validDocuments.forEach((doc) => {
        expect(() => documentFileSchema.parse(doc)).not.toThrow();
      });
    });

    it("should reject non-document files", () => {
      const invalidDocuments = [
        {
          filename: "image.jpg",
          mimetype: "image/jpeg",
          size: 1024,
        },
        {
          filename: "text.txt",
          mimetype: "text/plain",
          size: 1024,
        },
      ];

      invalidDocuments.forEach((doc) => {
        expect(() => documentFileSchema.parse(doc)).toThrow("valid document");
      });
    });

    it("should reject oversized documents", () => {
      const oversizedDoc = {
        filename: "huge.pdf",
        mimetype: "application/pdf",
        size: 11 * 1024 * 1024, // 11MB
      };

      expect(() => documentFileSchema.parse(oversizedDoc)).toThrow(
        "smaller than 10MB"
      );
    });
  });

  describe("Helper functions", () => {
    describe("isValidEmail", () => {
      it("should return boolean for email validation", () => {
        expect(isValidEmail("user@example.com")).toBe(true);
        expect(isValidEmail("invalid-email")).toBe(false);
        expect(isValidEmail("")).toBe(false);
      });
    });

    describe("isValidUrl", () => {
      it("should return boolean for URL validation", () => {
        expect(isValidUrl("https://example.com")).toBe(true);
        expect(isValidUrl("not-a-url")).toBe(false);
        expect(isValidUrl("")).toBe(false);
      });
    });

    describe("validatePasswordStrength", () => {
      it("should return validation result for strong password", () => {
        const result = validatePasswordStrength("StrongPass123!");

        expect(result.isValid).toBe(true);
        expect(result.score).toBe(5);
        expect(result.feedback).toHaveLength(0);
      });

      it("should return validation result for weak password", () => {
        const result = validatePasswordStrength("weak");

        expect(result.isValid).toBe(false);
        expect(result.score).toBeLessThan(4);
        expect(result.feedback.length).toBeGreaterThan(0);
      });

      it("should provide specific feedback", () => {
        const result = validatePasswordStrength("password");

        expect(result.feedback).toContain("Use at least 8 characters");
        expect(result.feedback).toContain("Include uppercase letters");
        expect(result.feedback).toContain("Include numbers");
        expect(result.feedback).toContain("Include special characters");
      });

      it("should handle edge cases", () => {
        expect(validatePasswordStrength("").isValid).toBe(false);
        expect(validatePasswordStrength("12345678").score).toBe(1); // Only length
      });
    });

    describe("sanitizeString", () => {
      it("should remove HTML tags", () => {
        expect(sanitizeString("<script>alert('xss')</script>")).toBe(
          "alert('xss')"
        );
        expect(sanitizeString("<p>Hello <b>world</b></p>")).toBe("Hello world");
      });

      it("should trim whitespace", () => {
        expect(sanitizeString("  hello world  ")).toBe("hello world");
      });

      it("should handle empty string", () => {
        expect(sanitizeString("")).toBe("");
      });

      it("should handle string without HTML", () => {
        expect(sanitizeString("plain text")).toBe("plain text");
      });
    });

    describe("normalizeSlug", () => {
      it("should create valid slug", () => {
        expect(normalizeSlug("Hello World!")).toBe("hello-world");
        expect(normalizeSlug("Test_123")).toBe("test-123");
      });

      it("should handle special characters", () => {
        expect(normalizeSlug("café & münü")).toBe("caf-m-n");
      });

      it("should remove leading/trailing hyphens", () => {
        expect(normalizeSlug("-hello-world-")).toBe("hello-world");
      });

      it("should collapse multiple hyphens", () => {
        expect(normalizeSlug("hello---world")).toBe("hello-world");
      });

      it("should handle empty string", () => {
        expect(normalizeSlug("")).toBe("");
      });
    });

    describe("isValidJson", () => {
      it("should validate JSON strings", () => {
        expect(isValidJson('{"key": "value"}')).toBe(true);
        expect(isValidJson("[]")).toBe(true);
        expect(isValidJson('"string"')).toBe(true);
        expect(isValidJson("123")).toBe(true);
        expect(isValidJson("true")).toBe(true);
      });

      it("should reject invalid JSON", () => {
        expect(isValidJson("invalid json")).toBe(false);
        expect(isValidJson('{"key": value}')).toBe(false); // unquoted value
        expect(isValidJson("")).toBe(false);
        expect(isValidJson("{")).toBe(false); // incomplete
      });
    });

    describe("formatValidationError", () => {
      it("should format Zod errors", () => {
        try {
          emailSchema.parse("invalid-email");
        } catch (error) {
          if (error instanceof z.ZodError) {
            const formatted = formatValidationError(error);
            expect(formatted).toContain("Invalid email address");
          }
        }
      });

      it("should handle nested path errors", () => {
        const schema = z.object({
          user: z.object({
            email: emailSchema,
          }),
        });

        try {
          schema.parse({ user: { email: "invalid" } });
        } catch (error) {
          if (error instanceof z.ZodError) {
            const formatted = formatValidationError(error);
            expect(formatted).toContain("user.email");
          }
        }
      });

      it("should handle multiple errors", () => {
        const schema = z.object({
          email: emailSchema,
          password: passwordSchema,
        });

        try {
          schema.parse({ email: "invalid", password: "weak" });
        } catch (error) {
          if (error instanceof z.ZodError) {
            const formatted = formatValidationError(error);
            expect(formatted).toContain("email");
            expect(formatted).toContain("password");
          }
        }
      });
    });
  });

  describe("Integration tests", () => {
    it("should handle complete form validation", () => {
      const formSchema = z.object({
        email: emailSchema,
        password: strongPasswordSchema,
        username: usernameSchema,
        website: urlSchema.optional(),
      });

      const validForm = {
        email: "user@example.com",
        password: "StrongPass123!",
        username: "user123",
        website: "https://example.com",
      };

      const invalidForm = {
        email: "invalid-email",
        password: "weak",
        username: "u",
        website: "not-a-url",
      };

      expect(() => formSchema.parse(validForm)).not.toThrow();
      expect(() => formSchema.parse(invalidForm)).toThrow();
    });

    it("should validate file upload workflow", () => {
      const uploadSchema = z.discriminatedUnion("type", [
        z.object({
          type: z.literal("image"),
          file: imageFileSchema,
        }),
        z.object({
          type: z.literal("document"),
          file: documentFileSchema,
        }),
      ]);

      const validImageUpload = {
        type: "image" as const,
        file: {
          filename: "photo.jpg",
          mimetype: "image/jpeg",
          size: 1024 * 1024,
        },
      };

      const validDocUpload = {
        type: "document" as const,
        file: {
          filename: "report.pdf",
          mimetype: "application/pdf",
          size: 2 * 1024 * 1024,
        },
      };

      expect(() => uploadSchema.parse(validImageUpload)).not.toThrow();
      expect(() => uploadSchema.parse(validDocUpload)).not.toThrow();
    });

    it("should validate API request schemas", () => {
      const searchRequestSchema = z.object({
        query: searchSchema.shape.q,
        pagination: paginationSchema,
        sort: sortSchema,
        filters: z
          .object({
            category: slugSchema.optional(),
            dateRange: z
              .object({
                start: dateStringSchema,
                end: dateStringSchema,
              })
              .optional(),
          })
          .optional(),
      });

      const validRequest = {
        query: "search term",
        pagination: { page: 1, limit: 20 },
        sort: { sortBy: "relevance", sortOrder: "desc" as const },
        filters: {
          category: "technology",
          dateRange: {
            start: "2023-01-01T00:00:00Z",
            end: "2023-12-31T23:59:59Z",
          },
        },
      };

      expect(() => searchRequestSchema.parse(validRequest)).not.toThrow();
    });

    it("should handle validation with transformations", () => {
      const userSchema = z.object({
        email: emailSchema.transform((email) => email.toLowerCase()),
        username: usernameSchema.transform((username) =>
          username.toLowerCase()
        ),
        slug: z.string().transform(normalizeSlug).pipe(slugSchema),
      });

      const input = {
        email: "USER@EXAMPLE.COM",
        username: "UserName123",
        slug: "My Blog Post!",
      };

      const result = userSchema.parse(input);

      expect(result.email).toBe("user@example.com");
      expect(result.username).toBe("username123");
      expect(result.slug).toBe("my-blog-post");
    });
  });
});
