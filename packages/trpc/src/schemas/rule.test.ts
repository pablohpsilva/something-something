import { describe, it, expect } from "vitest";
import {
  createRuleSchema,
  updateRuleSchema,
  ruleListFiltersSchema,
  listRulesSchema,
  getRuleBySlugSchema,
  getRuleByIdSchema,
  publishRuleSchema,
  deprecateRuleSchema,
  softDeleteRuleSchema,
  getRulesByAuthorSchema,
  getTrendingRulesSchema,
  duplicateRuleSchema,
  getRuleStatsSchema,
  type CreateRuleInput,
  type UpdateRuleInput,
  type RuleListFilters,
  type ListRulesInput,
  type GetRuleBySlugInput,
  type GetRuleByIdInput,
  type PublishRuleInput,
  type DeprecateRuleInput,
  type SoftDeleteRuleInput,
  type GetRulesByAuthorInput,
  type GetTrendingRulesInput,
  type DuplicateRuleInput,
  type GetRuleStatsInput,
} from "./rule";

describe("Rule Schemas", () => {
  describe("createRuleSchema", () => {
    it("should accept valid rule creation input", () => {
      const validInput = {
        title: "Test Rule",
        summary: "This is a test rule summary",
        contentType: "RULE" as const,
        primaryModel: "gpt-4",
        tags: ["javascript", "testing"],
        body: "This is the rule body content",
        testedOn: {
          models: ["gpt-4"],
          stacks: ["openai"],
        },
        links: [
          {
            label: "Example Link",
            url: "https://example.com",
            kind: "DOCS" as const,
          },
        ],
        idempotencyKey: "create-rule-key-123",
      };

      const result = createRuleSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept minimal required fields", () => {
      const minimalInput = {
        title: "Minimal Rule",
        summary: "Minimal summary",
        contentType: "RULE" as const,
        body: "Minimal body content",
        idempotencyKey: "minimal-key-456",
      };

      const result = createRuleSchema.parse(minimalInput);
      expect(result).toEqual(minimalInput);
    });

    it("should accept all valid content types", () => {
      const contentTypes = ["PROMPT", "RULE", "MCP", "GUIDE"] as const;

      contentTypes.forEach((contentType) => {
        const input = {
          title: `${contentType} Title`,
          summary: `${contentType} summary`,
          contentType,
          body: `${contentType} body`,
          idempotencyKey: `key-${contentType.toLowerCase()}`,
        };
        expect(() => createRuleSchema.parse(input)).not.toThrow();
      });
    });

    it("should reject invalid content type", () => {
      const invalidInput = {
        title: "Test Rule",
        summary: "Test summary",
        contentType: "INVALID_TYPE",
        body: "Test body",
        idempotencyKey: "test-key",
      };

      expect(() => createRuleSchema.parse(invalidInput)).toThrow();
    });

    it("should accept input without optional fields", () => {
      const inputWithoutOptionals = {
        title: "Rule Without Optionals",
        summary: "Summary without optionals",
        contentType: "GUIDE" as const,
        body: "Body without optionals",
        idempotencyKey: "no-optionals-key",
      };

      const result = createRuleSchema.parse(inputWithoutOptionals);
      expect(result.primaryModel).toBeUndefined();
      expect(result.tags).toBeUndefined();
      expect(result.testedOn).toBeUndefined();
      expect(result.links).toBeUndefined();
    });

    it("should accept empty arrays for optional array fields", () => {
      const input = {
        title: "Rule With Empty Arrays",
        summary: "Summary with empty arrays",
        contentType: "MCP" as const,
        body: "Body with empty arrays",
        tags: [],
        links: [],
        idempotencyKey: "empty-arrays-key",
      };

      expect(() => createRuleSchema.parse(input)).not.toThrow();
    });

    it("should accept multiple tags", () => {
      const input = {
        title: "Multi-tag Rule",
        summary: "Rule with multiple tags",
        contentType: "GUIDE" as const,
        body: "Body with multiple tags",
        tags: ["tag1", "tag2", "tag3", "javascript", "react", "testing"],
        idempotencyKey: "multi-tag-key",
      };

      expect(() => createRuleSchema.parse(input)).not.toThrow();
    });

    it("should accept multiple resource links", () => {
      const input = {
        title: "Multi-link Rule",
        summary: "Rule with multiple links",
        contentType: "RULE" as const,
        body: "Body with multiple links",
        links: [
          {
            label: "First Link",
            url: "https://example1.com",
            kind: "DOCS" as const,
          },
          {
            label: "Second Link",
            url: "https://example2.com",
            kind: "GITHUB" as const,
          },
          {
            label: "Third Link",
            url: "https://example3.com",
            kind: "ARTICLE" as const,
          },
        ],
        idempotencyKey: "multi-link-key",
      };

      expect(() => createRuleSchema.parse(input)).not.toThrow();
    });

    it("should require all mandatory fields", () => {
      const requiredFields = ["title", "contentType", "body"];

      requiredFields.forEach((field) => {
        const input = {
          title: "Test Rule",
          contentType: "RULE" as const,
          body: "Test body",
        };
        delete (input as any)[field];

        expect(() => createRuleSchema.parse(input)).toThrow();
      });
    });
  });

  describe("updateRuleSchema", () => {
    it("should accept valid rule update input", () => {
      const validInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        title: "Updated Rule Title",
        summary: "Updated rule summary",
        primaryModel: "gpt-4-turbo",
        tags: ["updated", "tags"],
        links: [
          {
            label: "Updated Link",
            url: "https://updated-example.com",
            kind: "DOCS" as const,
          },
        ],
        idempotencyKey: "update-rule-key-123",
      };

      const result = updateRuleSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept minimal update input", () => {
      const minimalInput = {
        ruleId: "clkv6q4a40001356h2g8h2g8h",
        summary: "Updated summary only",
        idempotencyKey: "minimal-update-key",
      };

      const result = updateRuleSchema.parse(minimalInput);
      expect(result.title).toBeUndefined();
      expect(result.primaryModel).toBeUndefined();
      expect(result.tags).toBeUndefined();
      expect(result.links).toBeUndefined();
    });

    it("should require ruleId", () => {
      const inputWithoutRuleId = {
        summary: "Summary without ruleId",
        idempotencyKey: "key-without-ruleid",
      };

      expect(() => updateRuleSchema.parse(inputWithoutRuleId)).toThrow();
    });

    it("should accept update with only some optional fields", () => {
      const partialUpdate = {
        ruleId: "clkv6q4a40003356h2g8h2g8h",
        title: "Only Title Updated",
        summary: "Summary is required",
        idempotencyKey: "partial-update-key",
      };

      expect(() => updateRuleSchema.parse(partialUpdate)).not.toThrow();
    });
  });

  describe("ruleListFiltersSchema", () => {
    it("should accept valid filters", () => {
      const validFilters = {
        tags: ["javascript", "react"],
        model: "gpt-4",
        status: "PUBLISHED" as const,
        contentType: "RULE" as const,
        authorId: "author123",
        createdAfter: new Date("2024-01-01"),
        createdBefore: new Date("2024-12-31"),
      };

      const result = ruleListFiltersSchema.parse(validFilters);
      expect(result).toEqual(validFilters);
    });

    it("should accept empty filters", () => {
      const emptyFilters = {
        tags: [],
        model: "",
        status: "DRAFT" as const,
      };

      expect(() => ruleListFiltersSchema.parse(emptyFilters)).not.toThrow();
    });

    it("should accept filters with only some fields", () => {
      const partialFilters = {
        tags: ["typescript"],
        status: "DRAFT" as const,
      };

      expect(() => ruleListFiltersSchema.parse(partialFilters)).not.toThrow();
    });

    it("should accept all valid status values", () => {
      const statusValues = ["DRAFT", "PUBLISHED", "DEPRECATED"] as const;

      statusValues.forEach((status) => {
        const filters = {
          tags: [],
          model: "",
          status,
        };
        expect(() => ruleListFiltersSchema.parse(filters)).not.toThrow();
      });
    });

    it("should reject invalid status", () => {
      const invalidFilters = {
        tags: [],
        model: "",
        status: "INVALID_STATUS",
      };

      expect(() => ruleListFiltersSchema.parse(invalidFilters)).toThrow();
    });

    it("should accept date range filters", () => {
      const dateFilters = {
        tags: [],
        model: "",
        status: "PUBLISHED" as const,
        createdAfter: new Date("2024-01-01T00:00:00Z"),
        createdBefore: new Date("2024-12-31T23:59:59Z"),
      };

      expect(() => ruleListFiltersSchema.parse(dateFilters)).not.toThrow();
    });
  });

  describe("listRulesSchema", () => {
    it("should accept valid list rules input", () => {
      const validInput = {
        cursor: "cursor123",
        limit: 25,
        sort: "new" as const,
        filters: {
          tags: ["javascript"],
          model: "gpt-4",
          status: "PUBLISHED" as const,
          contentType: "RULE" as const,
        },
      };

      const result = listRulesSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept minimal input with defaults", () => {
      const minimalInput = {
        sort: "top" as const,
      };

      const result = listRulesSchema.parse(minimalInput);
      expect(result.sort).toBe("top");
      expect(result.filters).toBeUndefined();
    });

    it("should accept all valid sort options", () => {
      const sortOptions = ["new", "top", "trending"] as const;

      sortOptions.forEach((sort) => {
        const input = { sort };
        expect(() => listRulesSchema.parse(input)).not.toThrow();
      });
    });

    it("should reject invalid sort option", () => {
      const invalidInput = {
        sort: "INVALID_SORT",
      };

      expect(() => listRulesSchema.parse(invalidInput)).toThrow();
    });

    it("should accept input without filters", () => {
      const inputWithoutFilters = {
        cursor: "no-filters-cursor",
        limit: 10,
        sort: "trending" as const,
      };

      expect(() => listRulesSchema.parse(inputWithoutFilters)).not.toThrow();
    });
  });

  describe("getRuleBySlugSchema", () => {
    it("should accept valid slug input", () => {
      const validInput = {
        slug: "test-rule-slug",
        includeMetrics: true,
        includeUserActions: true,
      };

      const result = getRuleBySlugSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should use default values", () => {
      const minimalInput = {
        slug: "minimal-slug",
      };

      const result = getRuleBySlugSchema.parse(minimalInput);
      expect(result.includeMetrics).toBe(true); // default
      expect(result.includeUserActions).toBe(false); // default
    });

    it("should accept boolean overrides", () => {
      const customInput = {
        slug: "custom-slug",
        includeMetrics: false,
        includeUserActions: true,
      };

      const result = getRuleBySlugSchema.parse(customInput);
      expect(result.includeMetrics).toBe(false);
      expect(result.includeUserActions).toBe(true);
    });

    it("should require slug", () => {
      const inputWithoutSlug = {
        includeMetrics: true,
      };

      expect(() => getRuleBySlugSchema.parse(inputWithoutSlug)).toThrow();
    });

    it("should accept various slug formats", () => {
      const slugFormats = [
        "simple-slug",
        "slug-with-numbers-123",
        "very-long-slug-with-many-words-and-dashes",
        "abc",
      ];

      slugFormats.forEach((slug) => {
        const input = { slug };
        expect(() => getRuleBySlugSchema.parse(input)).not.toThrow();
      });
    });
  });

  describe("getRuleByIdSchema", () => {
    it("should accept valid ID input", () => {
      const validInput = {
        ruleId: "clkv6q4a40010356h2g8h2g8h",
        includeMetrics: false,
        includeUserActions: true,
      };

      const result = getRuleByIdSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should use default values", () => {
      const minimalInput = {
        ruleId: "clkv6q4a40011356h2g8h2g8h",
      };

      const result = getRuleByIdSchema.parse(minimalInput);
      expect(result.includeMetrics).toBe(true); // default
      expect(result.includeUserActions).toBe(false); // default
    });

    it("should require ruleId", () => {
      const inputWithoutId = {
        includeMetrics: false,
      };

      expect(() => getRuleByIdSchema.parse(inputWithoutId)).toThrow();
    });
  });

  describe("publishRuleSchema", () => {
    it("should accept valid publish input", () => {
      const validInput = {
        ruleId: "clkv6q4a40012356h2g8h2g8h",
        idempotencyKey: "publish-key-123",
      };

      const result = publishRuleSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should require ruleId", () => {
      const inputWithoutRuleId = {
        idempotencyKey: "publish-key",
      };

      expect(() => publishRuleSchema.parse(inputWithoutRuleId)).toThrow();
    });
  });

  describe("deprecateRuleSchema", () => {
    it("should accept valid deprecate input with reason", () => {
      const validInput = {
        ruleId: "clkv6q4a40014356h2g8h2g8h",
        reason: "This rule is outdated and no longer applicable",
        idempotencyKey: "deprecate-key-123",
      };

      const result = deprecateRuleSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept input without reason", () => {
      const inputWithoutReason = {
        ruleId: "clkv6q4a40015356h2g8h2g8h",
        idempotencyKey: "deprecate-no-reason-key",
      };

      const result = deprecateRuleSchema.parse(inputWithoutReason);
      expect(result.reason).toBeUndefined();
    });

    it("should validate reason length", () => {
      const longReason = "a".repeat(501); // Exceeds 500 char limit
      const invalidInput = {
        ruleId: "clkv6q4a40016356h2g8h2g8h",
        reason: longReason,
        idempotencyKey: "long-reason-key",
      };

      expect(() => deprecateRuleSchema.parse(invalidInput)).toThrow();
    });

    it("should accept reason at max length", () => {
      const maxLengthReason = "a".repeat(500); // Exactly 500 chars
      const validInput = {
        ruleId: "clkv6q4a40017356h2g8h2g8h",
        reason: maxLengthReason,
        idempotencyKey: "max-reason-key",
      };

      expect(() => deprecateRuleSchema.parse(validInput)).not.toThrow();
    });

    it("should require ruleId", () => {
      const inputWithoutRuleId = {
        idempotencyKey: "deprecate-key",
      };

      expect(() => deprecateRuleSchema.parse(inputWithoutRuleId)).toThrow();
    });
  });

  describe("softDeleteRuleSchema", () => {
    it("should accept valid soft delete input with reason", () => {
      const validInput = {
        ruleId: "clkv6q4a40019356h2g8h2g8h",
        reason: "Rule violates community guidelines",
        idempotencyKey: "soft-delete-key-123",
      };

      const result = softDeleteRuleSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept input without reason", () => {
      const inputWithoutReason = {
        ruleId: "clkv6q4a40020356h2g8h2g8h",
        idempotencyKey: "soft-delete-no-reason-key",
      };

      const result = softDeleteRuleSchema.parse(inputWithoutReason);
      expect(result.reason).toBeUndefined();
    });

    it("should validate reason length", () => {
      const longReason = "b".repeat(501); // Exceeds 500 char limit
      const invalidInput = {
        ruleId: "clkv6q4a40021356h2g8h2g8h",
        reason: longReason,
        idempotencyKey: "long-delete-reason-key",
      };

      expect(() => softDeleteRuleSchema.parse(invalidInput)).toThrow();
    });

    it("should accept empty reason string", () => {
      const emptyReasonInput = {
        ruleId: "clkv6q4a40022356h2g8h2g8h",
        reason: "",
        idempotencyKey: "empty-reason-key",
      };

      expect(() => softDeleteRuleSchema.parse(emptyReasonInput)).not.toThrow();
    });
  });

  describe("getRulesByAuthorSchema", () => {
    it("should accept valid author rules input", () => {
      const validInput = {
        authorId: "author123",
        cursor: "author-cursor",
        limit: 15,
        sort: "new" as const,
        includePrivate: true,
      };

      const result = getRulesByAuthorSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should use default values", () => {
      const minimalInput = {
        authorId: "author456",
        sort: "top" as const,
      };

      const result = getRulesByAuthorSchema.parse(minimalInput);
      expect(result.includePrivate).toBe(false); // default
    });

    it("should require authorId", () => {
      const inputWithoutAuthorId = {
        sort: "new" as const,
      };

      expect(() =>
        getRulesByAuthorSchema.parse(inputWithoutAuthorId)
      ).toThrow();
    });

    it("should accept includePrivate true and false", () => {
      const privateTrue = {
        authorId: "author-private-true",
        sort: "top" as const,
        includePrivate: true,
      };

      const privateFalse = {
        authorId: "author-private-false",
        sort: "trending" as const,
        includePrivate: false,
      };

      expect(() => getRulesByAuthorSchema.parse(privateTrue)).not.toThrow();
      expect(() => getRulesByAuthorSchema.parse(privateFalse)).not.toThrow();
    });
  });

  describe("getTrendingRulesSchema", () => {
    it("should accept valid trending rules input", () => {
      const validInput = {
        cursor: "trending-cursor",
        limit: 20,
        period: "month" as const,
        filters: {
          tags: ["trending"],
          model: "gpt-4",
          status: "PUBLISHED" as const,
        },
      };

      const result = getTrendingRulesSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should use default values", () => {
      const minimalInput = {};

      const result = getTrendingRulesSchema.parse(minimalInput);
      expect(result.period).toBe("week"); // default
      expect(result.filters).toBeUndefined();
    });

    it("should accept all valid period values", () => {
      const periods = ["day", "week", "month"] as const;

      periods.forEach((period) => {
        const input = { period };
        expect(() => getTrendingRulesSchema.parse(input)).not.toThrow();
      });
    });

    it("should reject invalid period", () => {
      const invalidInput = {
        period: "year",
      };

      expect(() => getTrendingRulesSchema.parse(invalidInput)).toThrow();
    });

    it("should accept input without filters", () => {
      const inputWithoutFilters = {
        cursor: "no-filters-trending",
        limit: 30,
        period: "day" as const,
      };

      expect(() =>
        getTrendingRulesSchema.parse(inputWithoutFilters)
      ).not.toThrow();
    });
  });

  describe("duplicateRuleSchema", () => {
    it("should accept valid duplicate input", () => {
      const validInput = {
        ruleId: "clkv6q4a40030356h2g8h2g8h",
        title: "Duplicated Rule Title",
        summary: "Summary for duplicated rule",
        idempotencyKey: "duplicate-key-123",
      };

      const result = duplicateRuleSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept input without title", () => {
      const inputWithoutTitle = {
        ruleId: "clkv6q4a40031356h2g8h2g8h",
        summary: "Summary without custom title",
        idempotencyKey: "duplicate-no-title-key",
      };

      const result = duplicateRuleSchema.parse(inputWithoutTitle);
      expect(result.title).toBeUndefined();
    });

    it("should require ruleId", () => {
      const inputWithoutRuleId = {
        summary: "Required summary",
        idempotencyKey: "duplicate-key",
      };

      expect(() => duplicateRuleSchema.parse(inputWithoutRuleId)).toThrow();
    });
  });

  describe("getRuleStatsSchema", () => {
    it("should accept valid stats input", () => {
      const validInput = {
        ruleId: "clkv6q4a40040356h2g8h2g8h",
        period: "month" as const,
      };

      const result = getRuleStatsSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should use default period", () => {
      const minimalInput = {
        ruleId: "clkv6q4a40041356h2g8h2g8h",
      };

      const result = getRuleStatsSchema.parse(minimalInput);
      expect(result.period).toBe("week"); // default
    });

    it("should accept all valid period values", () => {
      const periods = ["day", "week", "month", "all"] as const;

      periods.forEach((period) => {
        const input = {
          ruleId: "clkv6q4a40042356h2g8h2g8h",
          period,
        };
        expect(() => getRuleStatsSchema.parse(input)).not.toThrow();
      });
    });

    it("should reject invalid period", () => {
      const invalidInput = {
        ruleId: "clkv6q4a40043356h2g8h2g8h",
        period: "year",
      };

      expect(() => getRuleStatsSchema.parse(invalidInput)).toThrow();
    });

    it("should require ruleId", () => {
      const inputWithoutId = {
        period: "day" as const,
      };

      expect(() => getRuleStatsSchema.parse(inputWithoutId)).toThrow();
    });
  });

  describe("Type Exports", () => {
    it("should export all input types", () => {
      // Test that types are properly exported by creating variables of each type
      const createRuleInput: CreateRuleInput = {
        title: "Test",
        summary: "Test",
        contentType: "RULE",
        body: "Test",
        idempotencyKey: "test",
      };

      const updateRuleInput: UpdateRuleInput = {
        ruleId: "clkv6q4a40050356h2g8h2g8h",
        summary: "Test",
        idempotencyKey: "test",
      };

      const ruleListFilters: RuleListFilters = {
        tags: [],
        model: "",
        status: "ALL",
      };

      const listRulesInput: ListRulesInput = {
        sort: "CREATED_ASC",
      };

      const getRuleBySlugInput: GetRuleBySlugInput = {
        slug: "test-slug",
      };

      const getRuleByIdInput: GetRuleByIdInput = {
        ruleId: "clkv6q4a40051356h2g8h2g8h",
      };

      const publishRuleInput: PublishRuleInput = {
        ruleId: "clkv6q4a40052356h2g8h2g8h",
        idempotencyKey: "test",
      };

      const deprecateRuleInput: DeprecateRuleInput = {
        ruleId: "clkv6q4a40053356h2g8h2g8h",
        idempotencyKey: "test",
      };

      const softDeleteRuleInput: SoftDeleteRuleInput = {
        ruleId: "clkv6q4a40054356h2g8h2g8h",
        idempotencyKey: "test",
      };

      const getRulesByAuthorInput: GetRulesByAuthorInput = {
        authorId: "author",
        sort: "CREATED_ASC",
      };

      const getTrendingRulesInput: GetTrendingRulesInput = {};

      const duplicateRuleInput: DuplicateRuleInput = {
        ruleId: "clkv6q4a40055356h2g8h2g8h",
        summary: "test",
        idempotencyKey: "test",
      };

      const getRuleStatsInput: GetRuleStatsInput = {
        ruleId: "clkv6q4a40056356h2g8h2g8h",
      };

      expect(createRuleInput).toBeDefined();
      expect(updateRuleInput).toBeDefined();
      expect(ruleListFilters).toBeDefined();
      expect(listRulesInput).toBeDefined();
      expect(getRuleBySlugInput).toBeDefined();
      expect(getRuleByIdInput).toBeDefined();
      expect(publishRuleInput).toBeDefined();
      expect(deprecateRuleInput).toBeDefined();
      expect(softDeleteRuleInput).toBeDefined();
      expect(getRulesByAuthorInput).toBeDefined();
      expect(getTrendingRulesInput).toBeDefined();
      expect(duplicateRuleInput).toBeDefined();
      expect(getRuleStatsInput).toBeDefined();
    });
  });

  describe("Edge Cases and Integration", () => {
    it("should handle complex rule creation with all optional fields", () => {
      const complexRule = {
        title: "Complex Rule with All Features",
        summary:
          "A comprehensive rule demonstrating all available features and options",
        contentType: "RULE" as const,
        primaryModel: "gpt-4-turbo-preview",
        tags: [
          "javascript",
          "typescript",
          "react",
          "nextjs",
          "testing",
          "vitest",
          "zod",
          "validation",
        ],
        body: `# Complex Rule

This is a comprehensive rule that demonstrates all the features available in the rule creation system.

## Features Covered
- Multiple tags
- Primary model specification
- Tested on information
- Multiple resource links
- Rich markdown content

## Implementation Details
\`\`\`javascript
function complexRule() {
  return "This rule covers everything";
}
\`\`\`

## Best Practices
1. Always validate input
2. Use proper error handling
3. Document your code
4. Write comprehensive tests`,
        testedOn: {
          models: ["gpt-4-turbo-preview"],
          stacks: ["openai", "typescript"],
        },
        links: [
          {
            label: "Complex Rules Documentation",
            url: "https://docs.example.com/complex-rules",
            kind: "DOCS" as const,
          },
          {
            label: "GitHub Repository",
            url: "https://github.com/example/complex-rules",
            kind: "GITHUB" as const,
          },
          {
            label: "Best Practices Blog Post",
            url: "https://blog.example.com/rule-best-practices",
            kind: "ARTICLE" as const,
          },
        ],
        idempotencyKey: "complex_rule_creation_2024_04_15_comprehensive",
      };

      expect(() => createRuleSchema.parse(complexRule)).not.toThrow();
    });

    it("should handle rule updates with partial data", () => {
      const partialUpdates = [
        {
          ruleId: "clkv6q4a40060356h2g8h2g8h",
          title: "Only Title Updated",
          summary: "Summary is always required",
          idempotencyKey: "title-only-update",
        },
        {
          ruleId: "clkv6q4a40061356h2g8h2g8h",
          summary: "Only Summary Updated",
          primaryModel: "claude-3-opus",
          idempotencyKey: "summary-model-update",
        },
        {
          ruleId: "clkv6q4a40062356h2g8h2g8h",
          summary: "Tags and Links Updated",
          tags: ["updated", "tags", "only"],
          links: [
            {
              label: "Updated Link",
              url: "https://updated-link.com",
              kind: "DOCS" as const,
            },
          ],
          idempotencyKey: "tags-links-update",
        },
      ];

      partialUpdates.forEach((update) => {
        expect(() => updateRuleSchema.parse(update)).not.toThrow();
      });
    });

    it("should handle complex filtering scenarios", () => {
      const complexFilters = [
        {
          tags: ["javascript", "typescript", "react"],
          model: "gpt-4",
          status: "PUBLISHED" as const,
          contentType: "RULE" as const,
          authorId: "prolific-author-123",
          createdAfter: new Date("2024-01-01T00:00:00Z"),
          createdBefore: new Date("2024-12-31T23:59:59Z"),
        },
        {
          tags: [],
          model: "",
          status: "DRAFT" as const,
          authorId: "draft-author-456",
        },
        {
          tags: ["guide"],
          model: "claude-3",
          status: "DEPRECATED" as const,
          contentType: "GUIDE" as const,
          createdAfter: new Date("2023-01-01T00:00:00Z"),
        },
      ];

      complexFilters.forEach((filters) => {
        expect(() => ruleListFiltersSchema.parse(filters)).not.toThrow();
      });
    });

    it("should handle pagination edge cases", () => {
      const paginationCases = [
        {
          cursor: "very-long-cursor-string-with-encoded-data-123456789",
          limit: 1, // Minimum limit
          sort: "top" as const,
        },
        {
          cursor: "short",
          limit: 100, // Maximum typical limit
          sort: "trending" as const,
        },
        {
          // No cursor (first page)
          limit: 25,
          sort: "new" as const,
        },
      ];

      paginationCases.forEach((pagination) => {
        expect(() => listRulesSchema.parse(pagination)).not.toThrow();
      });
    });

    it("should handle various slug formats", () => {
      const slugFormats = [
        "simple-slug",
        "slug-with-numbers-123",
        "very-long-slug-with-many-words-and-dashes-that-might-be-used-for-seo",
        "abc", // Minimum 3 characters
      ];

      slugFormats.forEach((slug) => {
        const input = {
          slug,
          includeMetrics: false,
          includeUserActions: true,
        };
        expect(() => getRuleBySlugSchema.parse(input)).not.toThrow();
      });
    });

    it("should handle reason field edge cases", () => {
      const reasonCases = [
        {
          ruleId: "clkv6q4a40070356h2g8h2g8h",
          reason: "Short reason",
          idempotencyKey: "short-reason-key",
        },
        {
          ruleId: "clkv6q4a40071356h2g8h2g8h",
          reason: "A".repeat(500), // Maximum length
          idempotencyKey: "max-reason-key",
        },
        {
          ruleId: "clkv6q4a40072356h2g8h2g8h",
          reason: "", // Empty string
          idempotencyKey: "empty-reason-key",
        },
        {
          ruleId: "clkv6q4a40073356h2g8h2g8h",
          // No reason field
          idempotencyKey: "no-reason-key",
        },
      ];

      reasonCases.forEach((reasonCase) => {
        expect(() => deprecateRuleSchema.parse(reasonCase)).not.toThrow();
        expect(() => softDeleteRuleSchema.parse(reasonCase)).not.toThrow();
      });
    });

    it("should handle all period combinations across schemas", () => {
      const periodSchemas = [
        { schema: getTrendingRulesSchema, periods: ["day", "week", "month"] },
        {
          schema: getRuleStatsSchema,
          periods: ["day", "week", "month", "all"],
        },
      ];

      periodSchemas.forEach(({ schema, periods }) => {
        periods.forEach((period) => {
          const input =
            schema === getTrendingRulesSchema
              ? { period }
              : { ruleId: "clkv6q4a40080356h2g8h2g8h", period };

          expect(() => schema.parse(input)).not.toThrow();
        });
      });
    });

    it("should validate that all schemas handle required fields correctly", () => {
      const schemaRequirements = [
        {
          schema: createRuleSchema,
          requiredFields: ["title", "contentType", "body"],
          validInput: {
            title: "Test",
            contentType: "RULE" as const,
            body: "Test",
          },
        },
        {
          schema: updateRuleSchema,
          requiredFields: ["ruleId"],
          validInput: {
            ruleId: "clkv6q4a40090356h2g8h2g8h",
          },
        },
        {
          schema: publishRuleSchema,
          requiredFields: ["ruleId"],
          validInput: {
            ruleId: "clkv6q4a40091356h2g8h2g8h",
          },
        },
      ];

      schemaRequirements.forEach(({ schema, requiredFields, validInput }) => {
        // Test that valid input passes
        expect(() => schema.parse(validInput)).not.toThrow();

        // Test that missing required fields fail
        requiredFields.forEach((field) => {
          const invalidInput = { ...validInput };
          delete (invalidInput as any)[field];
          expect(() => schema.parse(invalidInput)).toThrow();
        });
      });
    });
  });
});
