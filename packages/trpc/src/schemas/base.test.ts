import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  // ID schemas
  ruleIdSchema,
  ruleVersionIdSchema,
  userIdSchema,
  commentIdSchema,
  claimIdSchema,
  tagIdSchema,
  cuidOrUuidSchema,

  // Pagination schemas
  cursorSchema,
  limitSchema,
  paginationSchema,

  // Handle and slug schemas
  handleSchema,
  slugSchema,

  // Sorting and filtering schemas
  sortSchema,
  dateRangeSchema,
  tagsFilterSchema,
  modelFilterSchema,
  statusFilterSchema,

  // Content and role schemas
  contentTypeSchema,
  userRoleSchema,
  requiredRoleSchema,

  // Value schemas
  voteValueSchema,
  eventTypeSchema,
  notificationTypeSchema,
  claimStatusSchema,
  donationStatusSchema,
  currencySchema,

  // Leaderboard schemas
  leaderboardPeriodSchema,
  leaderboardScopeSchema,

  // Resource schemas
  resourceLinkKindSchema,
  testedOnSchema,
  resourceLinkSchema,

  // Text field schemas
  titleSchema,
  summarySchema,
  bodySchema,
  changelogSchema,
  bioSchema,
  commentBodySchema,

  // Version and key schemas
  semverSchema,
  idempotencyKeySchema,

  // Response schemas
  metadataSchema,
  errorSchema,
  createSuccessSchema,
  createPaginatedSchema,
} from "./base";

describe("Base Schemas", () => {
  describe("ID Schemas", () => {
    describe("ruleIdSchema", () => {
      it("should accept valid CUID", () => {
        const validCuid = "clkv6tv5l0001l608w5i10wd7";
        expect(() => ruleIdSchema.parse(validCuid)).not.toThrow();
      });

      it("should reject invalid CUID", () => {
        expect(() => ruleIdSchema.parse("invalid-id")).toThrow();
        expect(() => ruleIdSchema.parse("")).toThrow();
        expect(() => ruleIdSchema.parse(123)).toThrow();
      });
    });

    describe("ruleVersionIdSchema", () => {
      it("should accept valid CUID", () => {
        const validCuid = "clkv6tv5l0001l608w5i10wd7";
        expect(() => ruleVersionIdSchema.parse(validCuid)).not.toThrow();
      });

      it("should reject invalid CUID", () => {
        expect(() => ruleVersionIdSchema.parse("invalid-id")).toThrow();
      });
    });

    describe("userIdSchema", () => {
      it("should accept valid CUID", () => {
        const validCuid = "clkv6tv5l0001l608w5i10wd7";
        expect(() => userIdSchema.parse(validCuid)).not.toThrow();
      });

      it("should reject invalid CUID", () => {
        expect(() => userIdSchema.parse("invalid-id")).toThrow();
      });
    });

    describe("commentIdSchema", () => {
      it("should accept valid CUID", () => {
        const validCuid = "clkv6tv5l0001l608w5i10wd7";
        expect(() => commentIdSchema.parse(validCuid)).not.toThrow();
      });

      it("should reject invalid CUID", () => {
        expect(() => commentIdSchema.parse("invalid-id")).toThrow();
      });
    });

    describe("claimIdSchema", () => {
      it("should accept valid CUID", () => {
        const validCuid = "clkv6tv5l0001l608w5i10wd7";
        expect(() => claimIdSchema.parse(validCuid)).not.toThrow();
      });

      it("should reject invalid CUID", () => {
        expect(() => claimIdSchema.parse("invalid-id")).toThrow();
      });
    });

    describe("tagIdSchema", () => {
      it("should accept valid CUID", () => {
        const validCuid = "clkv6tv5l0001l608w5i10wd7";
        expect(() => tagIdSchema.parse(validCuid)).not.toThrow();
      });

      it("should reject invalid CUID", () => {
        expect(() => tagIdSchema.parse("invalid-id")).toThrow();
      });
    });

    describe("cuidOrUuidSchema", () => {
      it("should accept any non-empty string", () => {
        expect(() =>
          cuidOrUuidSchema.parse("clkv6tv5l0001l608w5i10wd7")
        ).not.toThrow();
        expect(() =>
          cuidOrUuidSchema.parse("550e8400-e29b-41d4-a716-446655440000")
        ).not.toThrow();
        expect(() => cuidOrUuidSchema.parse("any-string")).not.toThrow();
      });

      it("should reject empty string", () => {
        expect(() => cuidOrUuidSchema.parse("")).toThrow();
      });
    });
  });

  describe("Pagination Schemas", () => {
    describe("cursorSchema", () => {
      it("should accept valid cursor string", () => {
        expect(() => cursorSchema.parse("cursor-123")).not.toThrow();
      });

      it("should accept undefined", () => {
        expect(() => cursorSchema.parse(undefined)).not.toThrow();
      });

      it("should reject non-string values", () => {
        expect(() => cursorSchema.parse(123)).toThrow();
      });
    });

    describe("limitSchema", () => {
      it("should accept valid limits", () => {
        expect(limitSchema.parse(1)).toBe(1);
        expect(limitSchema.parse(50)).toBe(50);
        expect(limitSchema.parse(100)).toBe(100);
      });

      it("should use default value", () => {
        expect(limitSchema.parse(undefined)).toBe(20);
      });

      it("should reject invalid limits", () => {
        expect(() => limitSchema.parse(0)).toThrow();
        expect(() => limitSchema.parse(101)).toThrow();
        expect(() => limitSchema.parse(-1)).toThrow();
        expect(() => limitSchema.parse(1.5)).toThrow();
      });
    });

    describe("paginationSchema", () => {
      it("should accept valid pagination object", () => {
        const result = paginationSchema.parse({
          cursor: "cursor-123",
          limit: 50,
        });
        expect(result).toEqual({
          cursor: "cursor-123",
          limit: 50,
        });
      });

      it("should use default limit", () => {
        const result = paginationSchema.parse({});
        expect(result).toEqual({
          limit: 20,
        });
      });

      it("should accept optional cursor", () => {
        const result = paginationSchema.parse({ limit: 10 });
        expect(result).toEqual({ limit: 10 });
      });
    });
  });

  describe("Handle and Slug Schemas", () => {
    describe("handleSchema", () => {
      it("should accept valid handles", () => {
        expect(() => handleSchema.parse("user123")).not.toThrow();
        expect(() => handleSchema.parse("my-handle")).not.toThrow();
        expect(() => handleSchema.parse("a-b-c")).not.toThrow();
        expect(() => handleSchema.parse("123")).not.toThrow();
      });

      it("should reject invalid handles", () => {
        expect(() => handleSchema.parse("ab")).toThrow(); // Too short
        expect(() => handleSchema.parse("a".repeat(31))).toThrow(); // Too long
        expect(() => handleSchema.parse("User123")).toThrow(); // Uppercase
        expect(() => handleSchema.parse("user_123")).toThrow(); // Underscore
        expect(() => handleSchema.parse("user 123")).toThrow(); // Space
        expect(() => handleSchema.parse("user@123")).toThrow(); // Special char
      });
    });

    describe("slugSchema", () => {
      it("should accept valid slugs", () => {
        expect(() => slugSchema.parse("my-rule")).not.toThrow();
        expect(() => slugSchema.parse("rule-123")).not.toThrow();
        expect(() => slugSchema.parse("a-very-long-slug-name")).not.toThrow();
      });

      it("should reject invalid slugs", () => {
        expect(() => slugSchema.parse("ab")).toThrow(); // Too short
        expect(() => slugSchema.parse("a".repeat(101))).toThrow(); // Too long
        expect(() => slugSchema.parse("My-Rule")).toThrow(); // Uppercase
        expect(() => slugSchema.parse("rule_123")).toThrow(); // Underscore
        expect(() => slugSchema.parse("rule 123")).toThrow(); // Space
      });
    });
  });

  describe("Sorting and Filtering Schemas", () => {
    describe("sortSchema", () => {
      it("should accept valid sort values", () => {
        expect(sortSchema.parse("new")).toBe("new");
        expect(sortSchema.parse("top")).toBe("top");
        expect(sortSchema.parse("trending")).toBe("trending");
      });

      it("should use default value", () => {
        expect(sortSchema.parse(undefined)).toBe("new");
      });

      it("should reject invalid sort values", () => {
        expect(() => sortSchema.parse("invalid")).toThrow();
        expect(() => sortSchema.parse("popular")).toThrow();
      });
    });

    describe("dateRangeSchema", () => {
      it("should accept valid date range", () => {
        const from = new Date("2024-01-01");
        const to = new Date("2024-01-31");
        const result = dateRangeSchema.parse({ from, to });
        expect(result).toEqual({ from, to });
      });

      it("should accept partial date range", () => {
        const from = new Date("2024-01-01");
        expect(dateRangeSchema.parse({ from })).toEqual({ from });

        const to = new Date("2024-01-31");
        expect(dateRangeSchema.parse({ to })).toEqual({ to });
      });

      it("should accept empty object", () => {
        expect(dateRangeSchema.parse({})).toEqual({});
      });
    });

    describe("tagsFilterSchema", () => {
      it("should accept array of strings", () => {
        expect(tagsFilterSchema.parse(["tag1", "tag2"])).toEqual([
          "tag1",
          "tag2",
        ]);
      });

      it("should accept undefined", () => {
        expect(tagsFilterSchema.parse(undefined)).toBeUndefined();
      });

      it("should reject non-string arrays", () => {
        expect(() => tagsFilterSchema.parse([1, 2, 3])).toThrow();
      });
    });

    describe("modelFilterSchema", () => {
      it("should accept string", () => {
        expect(modelFilterSchema.parse("gpt-4")).toBe("gpt-4");
      });

      it("should accept undefined", () => {
        expect(modelFilterSchema.parse(undefined)).toBeUndefined();
      });
    });

    describe("statusFilterSchema", () => {
      it("should accept valid status values", () => {
        expect(statusFilterSchema.parse("DRAFT")).toBe("DRAFT");
        expect(statusFilterSchema.parse("PUBLISHED")).toBe("PUBLISHED");
        expect(statusFilterSchema.parse("DEPRECATED")).toBe("DEPRECATED");
      });

      it("should accept undefined", () => {
        expect(statusFilterSchema.parse(undefined)).toBeUndefined();
      });

      it("should reject invalid status values", () => {
        expect(() => statusFilterSchema.parse("INVALID")).toThrow();
      });
    });
  });

  describe("Content and Role Schemas", () => {
    describe("contentTypeSchema", () => {
      it("should accept valid content types", () => {
        expect(contentTypeSchema.parse("PROMPT")).toBe("PROMPT");
        expect(contentTypeSchema.parse("RULE")).toBe("RULE");
        expect(contentTypeSchema.parse("MCP")).toBe("MCP");
        expect(contentTypeSchema.parse("GUIDE")).toBe("GUIDE");
      });

      it("should reject invalid content types", () => {
        expect(() => contentTypeSchema.parse("INVALID")).toThrow();
        expect(() => contentTypeSchema.parse("prompt")).toThrow(); // lowercase
      });
    });

    describe("userRoleSchema", () => {
      it("should accept valid user roles", () => {
        expect(userRoleSchema.parse("USER")).toBe("USER");
        expect(userRoleSchema.parse("MOD")).toBe("MOD");
        expect(userRoleSchema.parse("ADMIN")).toBe("ADMIN");
      });

      it("should reject invalid user roles", () => {
        expect(() => userRoleSchema.parse("INVALID")).toThrow();
        expect(() => userRoleSchema.parse("user")).toThrow(); // lowercase
      });
    });

    describe("requiredRoleSchema", () => {
      it("should accept valid required roles", () => {
        expect(requiredRoleSchema.parse("MOD")).toBe("MOD");
        expect(requiredRoleSchema.parse("ADMIN")).toBe("ADMIN");
      });

      it("should reject USER role", () => {
        expect(() => requiredRoleSchema.parse("USER")).toThrow();
      });
    });
  });

  describe("Value Schemas", () => {
    describe("voteValueSchema", () => {
      it("should accept valid vote values", () => {
        expect(voteValueSchema.parse("up")).toBe("up");
        expect(voteValueSchema.parse("down")).toBe("down");
      });

      it("should reject invalid vote values", () => {
        expect(() => voteValueSchema.parse("upvote")).toThrow();
        expect(() => voteValueSchema.parse("1")).toThrow();
      });
    });

    describe("eventTypeSchema", () => {
      it("should accept all valid event types", () => {
        const validEvents = [
          "VIEW",
          "COPY",
          "SAVE",
          "FORK",
          "COMMENT",
          "VOTE",
          "DONATE",
          "CLAIM",
        ];
        validEvents.forEach((event) => {
          expect(eventTypeSchema.parse(event)).toBe(event);
        });
      });

      it("should reject invalid event types", () => {
        expect(() => eventTypeSchema.parse("INVALID")).toThrow();
        expect(() => eventTypeSchema.parse("view")).toThrow(); // lowercase
      });
    });

    describe("notificationTypeSchema", () => {
      it("should accept all valid notification types", () => {
        const validTypes = [
          "NEW_VERSION",
          "COMMENT_REPLY",
          "AUTHOR_PUBLISHED",
          "CLAIM_VERDICT",
          "DONATION_RECEIVED",
        ];
        validTypes.forEach((type) => {
          expect(notificationTypeSchema.parse(type)).toBe(type);
        });
      });

      it("should reject invalid notification types", () => {
        expect(() => notificationTypeSchema.parse("INVALID")).toThrow();
      });
    });

    describe("claimStatusSchema", () => {
      it("should accept valid claim statuses", () => {
        expect(claimStatusSchema.parse("PENDING")).toBe("PENDING");
        expect(claimStatusSchema.parse("APPROVED")).toBe("APPROVED");
        expect(claimStatusSchema.parse("REJECTED")).toBe("REJECTED");
      });

      it("should reject invalid claim statuses", () => {
        expect(() => claimStatusSchema.parse("INVALID")).toThrow();
      });
    });

    describe("donationStatusSchema", () => {
      it("should accept valid donation statuses", () => {
        expect(donationStatusSchema.parse("INIT")).toBe("INIT");
        expect(donationStatusSchema.parse("SUCCEEDED")).toBe("SUCCEEDED");
        expect(donationStatusSchema.parse("FAILED")).toBe("FAILED");
      });

      it("should reject invalid donation statuses", () => {
        expect(() => donationStatusSchema.parse("INVALID")).toThrow();
      });
    });

    describe("currencySchema", () => {
      it("should accept valid 3-letter currency codes", () => {
        expect(currencySchema.parse("USD")).toBe("USD");
        expect(currencySchema.parse("EUR")).toBe("EUR");
        expect(currencySchema.parse("GBP")).toBe("GBP");
      });

      it("should reject invalid currency codes", () => {
        expect(() => currencySchema.parse("US")).toThrow(); // Too short
        expect(() => currencySchema.parse("USDD")).toThrow(); // Too long
        // Note: The schema only validates length, not content, so "123" is actually valid
      });
    });
  });

  describe("Leaderboard Schemas", () => {
    describe("leaderboardPeriodSchema", () => {
      it("should accept valid periods", () => {
        expect(leaderboardPeriodSchema.parse("DAILY")).toBe("DAILY");
        expect(leaderboardPeriodSchema.parse("WEEKLY")).toBe("WEEKLY");
        expect(leaderboardPeriodSchema.parse("MONTHLY")).toBe("MONTHLY");
        expect(leaderboardPeriodSchema.parse("ALL")).toBe("ALL");
      });

      it("should reject invalid periods", () => {
        expect(() => leaderboardPeriodSchema.parse("YEARLY")).toThrow();
      });
    });

    describe("leaderboardScopeSchema", () => {
      it("should accept valid scopes", () => {
        expect(leaderboardScopeSchema.parse("GLOBAL")).toBe("GLOBAL");
        expect(leaderboardScopeSchema.parse("TAG")).toBe("TAG");
        expect(leaderboardScopeSchema.parse("MODEL")).toBe("MODEL");
      });

      it("should reject invalid scopes", () => {
        expect(() => leaderboardScopeSchema.parse("LOCAL")).toThrow();
      });
    });
  });

  describe("Resource Schemas", () => {
    describe("resourceLinkKindSchema", () => {
      it("should accept all valid resource link kinds", () => {
        const validKinds = [
          "DOCS",
          "GITHUB",
          "NPM",
          "PACKAGE",
          "VIDEO",
          "ARTICLE",
        ];
        validKinds.forEach((kind) => {
          expect(resourceLinkKindSchema.parse(kind)).toBe(kind);
        });
      });

      it("should reject invalid resource link kinds", () => {
        expect(() => resourceLinkKindSchema.parse("INVALID")).toThrow();
      });
    });

    describe("testedOnSchema", () => {
      it("should accept valid tested on object", () => {
        const result = testedOnSchema.parse({
          models: ["gpt-4", "claude-3"],
          stacks: ["node", "python"],
        });
        expect(result).toEqual({
          models: ["gpt-4", "claude-3"],
          stacks: ["node", "python"],
        });
      });

      it("should accept partial tested on object", () => {
        expect(testedOnSchema.parse({ models: ["gpt-4"] })).toEqual({
          models: ["gpt-4"],
        });
        expect(testedOnSchema.parse({ stacks: ["node"] })).toEqual({
          stacks: ["node"],
        });
      });

      it("should accept empty object", () => {
        expect(testedOnSchema.parse({})).toEqual({});
      });
    });

    describe("resourceLinkSchema", () => {
      it("should accept valid resource link", () => {
        const validLink = {
          label: "Documentation",
          url: "https://example.com/docs",
          kind: "DOCS" as const,
        };
        const result = resourceLinkSchema.parse(validLink);
        expect(result).toEqual(validLink);
      });

      it("should reject invalid resource link", () => {
        expect(() =>
          resourceLinkSchema.parse({
            label: "",
            url: "https://example.com",
            kind: "DOCS",
          })
        ).toThrow(); // Empty label

        expect(() =>
          resourceLinkSchema.parse({
            label: "Test",
            url: "not-a-url",
            kind: "DOCS",
          })
        ).toThrow(); // Invalid URL

        expect(() =>
          resourceLinkSchema.parse({
            label: "Test",
            url: "https://example.com",
            kind: "INVALID",
          })
        ).toThrow(); // Invalid kind
      });

      it("should reject label that's too long", () => {
        expect(() =>
          resourceLinkSchema.parse({
            label: "a".repeat(256),
            url: "https://example.com",
            kind: "DOCS",
          })
        ).toThrow();
      });
    });
  });

  describe("Text Field Schemas", () => {
    describe("titleSchema", () => {
      it("should accept valid titles", () => {
        expect(titleSchema.parse("My Title")).toBe("My Title");
        expect(titleSchema.parse("A")).toBe("A"); // Minimum length
        expect(titleSchema.parse("a".repeat(255))).toBe("a".repeat(255)); // Maximum length
      });

      it("should reject invalid titles", () => {
        expect(() => titleSchema.parse("")).toThrow(); // Empty
        expect(() => titleSchema.parse("a".repeat(256))).toThrow(); // Too long
      });
    });

    describe("summarySchema", () => {
      it("should accept valid summaries", () => {
        expect(summarySchema.parse("A summary")).toBe("A summary");
        expect(summarySchema.parse("a".repeat(1000))).toBe("a".repeat(1000)); // Maximum length
      });

      it("should accept undefined", () => {
        expect(summarySchema.parse(undefined)).toBeUndefined();
      });

      it("should reject summary that's too long", () => {
        expect(() => summarySchema.parse("a".repeat(1001))).toThrow();
      });
    });

    describe("bodySchema", () => {
      it("should accept valid body", () => {
        expect(bodySchema.parse("Body content")).toBe("Body content");
      });

      it("should reject empty body", () => {
        expect(() => bodySchema.parse("")).toThrow();
      });
    });

    describe("changelogSchema", () => {
      it("should accept valid changelog", () => {
        expect(changelogSchema.parse("Changes made")).toBe("Changes made");
        expect(changelogSchema.parse("a".repeat(2000))).toBe("a".repeat(2000)); // Maximum length
      });

      it("should accept undefined", () => {
        expect(changelogSchema.parse(undefined)).toBeUndefined();
      });

      it("should reject changelog that's too long", () => {
        expect(() => changelogSchema.parse("a".repeat(2001))).toThrow();
      });
    });

    describe("bioSchema", () => {
      it("should accept valid bio", () => {
        expect(bioSchema.parse("My bio")).toBe("My bio");
        expect(bioSchema.parse("a".repeat(500))).toBe("a".repeat(500)); // Maximum length
      });

      it("should accept undefined", () => {
        expect(bioSchema.parse(undefined)).toBeUndefined();
      });

      it("should reject bio that's too long", () => {
        expect(() => bioSchema.parse("a".repeat(501))).toThrow();
      });
    });

    describe("commentBodySchema", () => {
      it("should accept valid comment body", () => {
        expect(commentBodySchema.parse("Comment text")).toBe("Comment text");
        expect(commentBodySchema.parse("a".repeat(2000))).toBe(
          "a".repeat(2000)
        ); // Maximum length
      });

      it("should reject invalid comment body", () => {
        expect(() => commentBodySchema.parse("")).toThrow(); // Empty
        expect(() => commentBodySchema.parse("a".repeat(2001))).toThrow(); // Too long
      });
    });
  });

  describe("Version and Key Schemas", () => {
    describe("semverSchema", () => {
      it("should accept valid semver", () => {
        expect(semverSchema.parse("1.0.0")).toBe("1.0.0");
        expect(semverSchema.parse("10.20.30")).toBe("10.20.30");
        expect(semverSchema.parse("0.0.1")).toBe("0.0.1");
      });

      it("should reject invalid semver", () => {
        expect(() => semverSchema.parse("1.0")).toThrow(); // Missing patch
        expect(() => semverSchema.parse("1.0.0.0")).toThrow(); // Too many parts
        expect(() => semverSchema.parse("v1.0.0")).toThrow(); // With prefix
        expect(() => semverSchema.parse("1.0.0-beta")).toThrow(); // With suffix
        expect(() => semverSchema.parse("a.b.c")).toThrow(); // Non-numeric
      });
    });

    describe("idempotencyKeySchema", () => {
      it("should accept valid idempotency key", () => {
        expect(idempotencyKeySchema.parse("key-123")).toBe("key-123");
        expect(idempotencyKeySchema.parse("a".repeat(255))).toBe(
          "a".repeat(255)
        ); // Maximum length
      });

      it("should accept undefined", () => {
        expect(idempotencyKeySchema.parse(undefined)).toBeUndefined();
      });

      it("should reject invalid idempotency key", () => {
        expect(() => idempotencyKeySchema.parse("")).toThrow(); // Empty
        expect(() => idempotencyKeySchema.parse("a".repeat(256))).toThrow(); // Too long
      });
    });
  });

  describe("Response Schemas", () => {
    describe("metadataSchema", () => {
      it("should accept valid metadata", () => {
        const metadata = {
          total: 100,
          hasMore: true,
          nextCursor: "cursor-123",
        };
        expect(metadataSchema.parse(metadata)).toEqual(metadata);
      });

      it("should accept partial metadata", () => {
        expect(metadataSchema.parse({ total: 50 })).toEqual({ total: 50 });
        expect(metadataSchema.parse({ hasMore: false })).toEqual({
          hasMore: false,
        });
      });

      it("should accept empty metadata", () => {
        expect(metadataSchema.parse({})).toEqual({});
      });
    });

    describe("errorSchema", () => {
      it("should accept valid error", () => {
        const error = {
          code: "VALIDATION_ERROR",
          message: "Invalid input",
          details: { field: "email" },
        };
        expect(errorSchema.parse(error)).toEqual(error);
      });

      it("should accept error without details", () => {
        const error = {
          code: "NOT_FOUND",
          message: "Resource not found",
        };
        expect(errorSchema.parse(error)).toEqual(error);
      });

      it("should reject invalid error", () => {
        expect(() =>
          errorSchema.parse({
            message: "Missing code",
          })
        ).toThrow(); // Missing code
      });
    });

    describe("createSuccessSchema", () => {
      it("should create valid success schema", () => {
        const dataSchema = z.object({ id: z.string() });
        const successSchema = createSuccessSchema(dataSchema);

        const validResponse = {
          success: true as const,
          data: { id: "123" },
          metadata: { total: 1 },
        };

        expect(successSchema.parse(validResponse)).toEqual(validResponse);
      });

      it("should work without metadata", () => {
        const dataSchema = z.string();
        const successSchema = createSuccessSchema(dataSchema);

        const validResponse = {
          success: true as const,
          data: "test",
        };

        expect(successSchema.parse(validResponse)).toEqual(validResponse);
      });

      it("should reject invalid success response", () => {
        const dataSchema = z.string();
        const successSchema = createSuccessSchema(dataSchema);

        expect(() =>
          successSchema.parse({
            success: false,
            data: "test",
          })
        ).toThrow(); // success must be true

        expect(() =>
          successSchema.parse({
            success: true,
            data: 123,
          })
        ).toThrow(); // data must be string
      });
    });

    describe("createPaginatedSchema", () => {
      it("should create valid paginated schema", () => {
        const itemSchema = z.object({ id: z.string() });
        const paginatedSchema = createPaginatedSchema(itemSchema);

        const validResponse = {
          items: [{ id: "1" }, { id: "2" }],
          nextCursor: "cursor-123",
          hasMore: true,
          total: 100,
        };

        expect(paginatedSchema.parse(validResponse)).toEqual(validResponse);
      });

      it("should work with minimal data", () => {
        const itemSchema = z.string();
        const paginatedSchema = createPaginatedSchema(itemSchema);

        const validResponse = {
          items: ["item1", "item2"],
          hasMore: false,
        };

        expect(paginatedSchema.parse(validResponse)).toEqual(validResponse);
      });

      it("should reject invalid paginated response", () => {
        const itemSchema = z.string();
        const paginatedSchema = createPaginatedSchema(itemSchema);

        expect(() =>
          paginatedSchema.parse({
            items: [123, 456], // Invalid item type
            hasMore: false,
          })
        ).toThrow();

        expect(() =>
          paginatedSchema.parse({
            items: ["valid"],
            // Missing hasMore
          })
        ).toThrow();
      });
    });
  });

  describe("Edge Cases and Integration", () => {
    it("should handle complex nested validation", () => {
      const complexSchema = z.object({
        pagination: paginationSchema,
        filters: z.object({
          tags: tagsFilterSchema,
          status: statusFilterSchema,
          dateRange: dateRangeSchema,
        }),
        sort: sortSchema,
      });

      const validData = {
        pagination: { cursor: "abc", limit: 50 },
        filters: {
          tags: ["javascript", "react"],
          status: "PUBLISHED",
          dateRange: {
            from: new Date("2024-01-01"),
            to: new Date("2024-01-31"),
          },
        },
        sort: "trending",
      };

      expect(() => complexSchema.parse(validData)).not.toThrow();
    });

    it("should handle schema composition", () => {
      const userSchema = z.object({
        id: userIdSchema,
        handle: handleSchema,
        role: userRoleSchema,
        bio: bioSchema,
      });

      const validUser = {
        id: "clkv6tv5l0001l608w5i10wd7",
        handle: "john-doe",
        role: "USER" as const,
        bio: "Software developer",
      };

      expect(() => userSchema.parse(validUser)).not.toThrow();
    });

    it("should validate resource links in context", () => {
      const ruleSchema = z.object({
        id: ruleIdSchema,
        title: titleSchema,
        slug: slugSchema,
        body: bodySchema,
        resourceLinks: z.array(resourceLinkSchema),
        testedOn: testedOnSchema,
      });

      const validRule = {
        id: "clkv6tv5l0001l608w5i10wd7",
        title: "My Awesome Rule",
        slug: "my-awesome-rule",
        body: "This is the rule content",
        resourceLinks: [
          {
            label: "Documentation",
            url: "https://docs.example.com",
            kind: "DOCS" as const,
          },
          {
            label: "GitHub Repository",
            url: "https://github.com/user/repo",
            kind: "GITHUB" as const,
          },
        ],
        testedOn: {
          models: ["gpt-4", "claude-3"],
          stacks: ["typescript", "react"],
        },
      };

      expect(() => ruleSchema.parse(validRule)).not.toThrow();
    });
  });
});
