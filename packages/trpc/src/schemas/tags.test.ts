import { describe, it, expect } from "vitest";
import {
  listTagsSchema,
  getTagBySlugSchema,
  attachTagsSchema,
  detachTagsSchema,
  createTagSchema,
  updateTagSchema,
  getPopularTagsSchema,
  getTagSuggestionsSchema,
  type ListTagsInput,
  type GetTagBySlugInput,
  type AttachTagsInput,
  type DetachTagsInput,
  type CreateTagInput,
  type UpdateTagInput,
  type GetPopularTagsInput,
  type GetTagSuggestionsInput,
} from "./tags";

describe("Tags Schemas", () => {
  describe("listTagsSchema", () => {
    it("should accept valid input with all fields", () => {
      const validInput = {
        cursor: "cursor-string-123",
        limit: 50,
        search: "javascript",
        sort: "name" as const,
        includeCount: false,
      };

      const result = listTagsSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept minimal input with defaults", () => {
      const minimalInput = {};

      const result = listTagsSchema.parse(minimalInput);
      expect(result).toEqual({
        limit: 20, // default from paginationSchema
        sort: "count", // default value
        includeCount: true, // default value
      });
    });

    it("should accept input without search", () => {
      const inputWithoutSearch = {
        limit: 30,
        sort: "recent" as const,
        includeCount: true,
      };

      expect(() => listTagsSchema.parse(inputWithoutSearch)).not.toThrow();
    });

    it("should accept all valid sort values", () => {
      const sortValues = ["name", "count", "recent"] as const;

      sortValues.forEach((sort) => {
        const input = { sort };
        expect(() => listTagsSchema.parse(input)).not.toThrow();
      });
    });

    it("should use default sort value", () => {
      const input = {};

      const result = listTagsSchema.parse(input);
      expect(result.sort).toBe("count");
    });

    it("should reject invalid sort", () => {
      const invalidSortInput = {
        sort: "invalid_sort",
      };

      expect(() => listTagsSchema.parse(invalidSortInput)).toThrow();
    });

    it("should accept both includeCount values", () => {
      const includeCountValues = [true, false];

      includeCountValues.forEach((includeCount) => {
        const input = { includeCount };
        expect(() => listTagsSchema.parse(input)).not.toThrow();
      });
    });

    it("should use default includeCount value", () => {
      const input = {};

      const result = listTagsSchema.parse(input);
      expect(result.includeCount).toBe(true);
    });

    it("should validate pagination constraints from paginationSchema", () => {
      // Test minimum limit
      const minLimitInput = {
        limit: 1,
      };
      expect(() => listTagsSchema.parse(minLimitInput)).not.toThrow();

      // Test maximum limit
      const maxLimitInput = {
        limit: 100,
      };
      expect(() => listTagsSchema.parse(maxLimitInput)).not.toThrow();

      // Test invalid limit (below minimum)
      const invalidMinInput = {
        limit: 0,
      };
      expect(() => listTagsSchema.parse(invalidMinInput)).toThrow();

      // Test invalid limit (above maximum)
      const invalidMaxInput = {
        limit: 101,
      };
      expect(() => listTagsSchema.parse(invalidMaxInput)).toThrow();
    });

    it("should validate integer limit", () => {
      const invalidIntegerInput = {
        limit: 25.5, // Should be integer
      };

      expect(() => listTagsSchema.parse(invalidIntegerInput)).toThrow();
    });

    it("should accept optional cursor", () => {
      const inputWithCursor = {
        cursor: "pagination-cursor-456",
      };

      expect(() => listTagsSchema.parse(inputWithCursor)).not.toThrow();
    });
  });

  describe("getTagBySlugSchema", () => {
    it("should accept valid input with all fields", () => {
      const validInput = {
        slug: "javascript-testing",
        includeStats: false,
      };

      const result = getTagBySlugSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept minimal input with defaults", () => {
      const minimalInput = {
        slug: "react-hooks",
      };

      const result = getTagBySlugSchema.parse(minimalInput);
      expect(result).toEqual({
        slug: "react-hooks",
        includeStats: true, // default value
      });
    });

    it("should accept both includeStats values", () => {
      const includeStatsValues = [true, false];

      includeStatsValues.forEach((includeStats) => {
        const input = {
          slug: "test-tag",
          includeStats,
        };
        expect(() => getTagBySlugSchema.parse(input)).not.toThrow();
      });
    });

    it("should use default includeStats value", () => {
      const input = {
        slug: "default-stats-tag",
      };

      const result = getTagBySlugSchema.parse(input);
      expect(result.includeStats).toBe(true);
    });

    it("should validate slug constraints", () => {
      // Test minimum slug length (from slugSchema)
      const minSlugInput = {
        slug: "abc", // Minimum 3 characters
      };
      expect(() => getTagBySlugSchema.parse(minSlugInput)).not.toThrow();

      // Test slug too short
      const tooShortSlugInput = {
        slug: "ab", // Less than 3 characters
      };
      expect(() => getTagBySlugSchema.parse(tooShortSlugInput)).toThrow();

      // Test empty slug
      const emptySlugInput = {
        slug: "",
      };
      expect(() => getTagBySlugSchema.parse(emptySlugInput)).toThrow();
    });

    it("should require slug field", () => {
      const inputWithoutSlug = {
        includeStats: true,
      };

      expect(() => getTagBySlugSchema.parse(inputWithoutSlug)).toThrow();
    });
  });

  describe("attachTagsSchema", () => {
    it("should accept valid input with all fields", () => {
      const validInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        tagSlugs: ["javascript", "testing", "react"],
        idempotencyKey: "attach-tags-key-123",
      };

      const result = attachTagsSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept single tag slug", () => {
      const singleTagInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        tagSlugs: ["single-tag"],
        idempotencyKey: "single-tag-key",
      };

      expect(() => attachTagsSchema.parse(singleTagInput)).not.toThrow();
    });

    it("should accept maximum number of tag slugs", () => {
      const maxTagsInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        tagSlugs: Array(10).fill("tag-slug"), // Exactly 10 tags
        idempotencyKey: "max-tags-key",
      };

      expect(() => attachTagsSchema.parse(maxTagsInput)).not.toThrow();
    });

    it("should reject empty tag slugs array", () => {
      const emptyTagsInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        tagSlugs: [],
        idempotencyKey: "empty-tags-key",
      };

      expect(() => attachTagsSchema.parse(emptyTagsInput)).toThrow();
    });

    it("should reject too many tag slugs", () => {
      const tooManyTagsInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        tagSlugs: Array(11).fill("tag-slug"), // Exceeds 10 tag limit
        idempotencyKey: "too-many-tags-key",
      };

      expect(() => attachTagsSchema.parse(tooManyTagsInput)).toThrow();
    });

    it("should validate each tag slug", () => {
      // Test valid tag slugs
      const validTagSlugsInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        tagSlugs: ["valid-tag-1", "valid-tag-2", "valid-tag-3"],
        idempotencyKey: "valid-slugs-key",
      };
      expect(() => attachTagsSchema.parse(validTagSlugsInput)).not.toThrow();

      // Test invalid tag slug (too short)
      const invalidTagSlugInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        tagSlugs: ["valid-tag", "ab"], // "ab" is too short
        idempotencyKey: "invalid-slug-key",
      };
      expect(() => attachTagsSchema.parse(invalidTagSlugInput)).toThrow();
    });

    it("should validate ruleId (CUID)", () => {
      const validRuleIdInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        tagSlugs: ["test-tag"],
        idempotencyKey: "rule-id-key",
      };
      expect(() => attachTagsSchema.parse(validRuleIdInput)).not.toThrow();

      // Test empty ruleId
      const emptyRuleIdInput = {
        ruleId: "",
        tagSlugs: ["test-tag"],
        idempotencyKey: "empty-rule-id-key",
      };
      expect(() => attachTagsSchema.parse(emptyRuleIdInput)).toThrow();
    });

    it("should require mandatory fields", () => {
      const requiredFields = ["ruleId", "tagSlugs"];

      requiredFields.forEach((field) => {
        const invalidInput = {
          ruleId: "clkv6q4a40000356h2g8h2g8h",
          tagSlugs: ["test-tag"],
          idempotencyKey: "test-key",
        };
        delete (invalidInput as any)[field];

        expect(() => attachTagsSchema.parse(invalidInput)).toThrow();
      });
    });

    it("should accept input without idempotencyKey", () => {
      const inputWithoutIdempotencyKey = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        tagSlugs: ["test-tag"],
      };

      expect(() =>
        attachTagsSchema.parse(inputWithoutIdempotencyKey)
      ).not.toThrow();
    });
  });

  describe("detachTagsSchema", () => {
    it("should accept valid input with all fields", () => {
      const validInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        tagSlugs: ["javascript", "testing", "react", "deprecated"],
        idempotencyKey: "detach-tags-key-456",
      };

      const result = detachTagsSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept single tag slug", () => {
      const singleTagInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        tagSlugs: ["single-detach-tag"],
        idempotencyKey: "single-detach-key",
      };

      expect(() => detachTagsSchema.parse(singleTagInput)).not.toThrow();
    });

    it("should accept many tag slugs (no max limit)", () => {
      const manyTagsInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        tagSlugs: Array(50).fill("detach-tag"), // More than attach limit, should be fine
        idempotencyKey: "many-detach-tags-key",
      };

      expect(() => detachTagsSchema.parse(manyTagsInput)).not.toThrow();
    });

    it("should reject empty tag slugs array", () => {
      const emptyTagsInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        tagSlugs: [],
        idempotencyKey: "empty-detach-tags-key",
      };

      expect(() => detachTagsSchema.parse(emptyTagsInput)).toThrow();
    });

    it("should validate each tag slug", () => {
      // Test valid tag slugs
      const validTagSlugsInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        tagSlugs: ["valid-detach-1", "valid-detach-2"],
        idempotencyKey: "valid-detach-slugs-key",
      };
      expect(() => detachTagsSchema.parse(validTagSlugsInput)).not.toThrow();

      // Test invalid tag slug (too short)
      const invalidTagSlugInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        tagSlugs: ["valid-detach-tag", "xy"], // "xy" is too short
        idempotencyKey: "invalid-detach-slug-key",
      };
      expect(() => detachTagsSchema.parse(invalidTagSlugInput)).toThrow();
    });

    it("should validate ruleId (CUID)", () => {
      const validRuleIdInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        tagSlugs: ["detach-test-tag"],
        idempotencyKey: "detach-rule-id-key",
      };
      expect(() => detachTagsSchema.parse(validRuleIdInput)).not.toThrow();

      // Test empty ruleId
      const emptyRuleIdInput = {
        ruleId: "",
        tagSlugs: ["detach-test-tag"],
        idempotencyKey: "empty-detach-rule-id-key",
      };
      expect(() => detachTagsSchema.parse(emptyRuleIdInput)).toThrow();
    });

    it("should require mandatory fields", () => {
      const requiredFields = ["ruleId", "tagSlugs"];

      requiredFields.forEach((field) => {
        const invalidInput = {
          ruleId: "clkv6q4a40000356h2g8h2g8h",
          tagSlugs: ["detach-test-tag"],
          idempotencyKey: "detach-test-key",
        };
        delete (invalidInput as any)[field];

        expect(() => detachTagsSchema.parse(invalidInput)).toThrow();
      });
    });

    it("should accept input without idempotencyKey", () => {
      const inputWithoutIdempotencyKey = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        tagSlugs: ["detach-test-tag"],
      };

      expect(() =>
        detachTagsSchema.parse(inputWithoutIdempotencyKey)
      ).not.toThrow();
    });
  });

  describe("createTagSchema", () => {
    it("should accept valid input with all fields", () => {
      const validInput = {
        slug: "new-tag-slug",
        name: "New Tag Name",
        description: "This is a description for the new tag",
        idempotencyKey: "create-tag-key-789",
      };

      const result = createTagSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept input without description", () => {
      const inputWithoutDescription = {
        slug: "no-desc-tag",
        name: "Tag Without Description",
        idempotencyKey: "no-desc-key",
      };

      expect(() =>
        createTagSchema.parse(inputWithoutDescription)
      ).not.toThrow();
    });

    it("should validate name constraints", () => {
      // Test minimum name length
      const minNameInput = {
        slug: "min-name-tag",
        name: "A", // Minimum 1 character
        idempotencyKey: "min-name-key",
      };
      expect(() => createTagSchema.parse(minNameInput)).not.toThrow();

      // Test maximum name length
      const maxNameInput = {
        slug: "max-name-tag",
        name: "A".repeat(100), // Exactly 100 characters
        idempotencyKey: "max-name-key",
      };
      expect(() => createTagSchema.parse(maxNameInput)).not.toThrow();

      // Test empty name
      const emptyNameInput = {
        slug: "empty-name-tag",
        name: "",
        idempotencyKey: "empty-name-key",
      };
      expect(() => createTagSchema.parse(emptyNameInput)).toThrow();

      // Test name too long
      const tooLongNameInput = {
        slug: "long-name-tag",
        name: "A".repeat(101), // Exceeds 100 character limit
        idempotencyKey: "long-name-key",
      };
      expect(() => createTagSchema.parse(tooLongNameInput)).toThrow();
    });

    it("should validate description constraints", () => {
      // Test maximum description length
      const maxDescInput = {
        slug: "max-desc-tag",
        name: "Tag with Max Description",
        description: "A".repeat(500), // Exactly 500 characters
        idempotencyKey: "max-desc-key",
      };
      expect(() => createTagSchema.parse(maxDescInput)).not.toThrow();

      // Test description too long
      const tooLongDescInput = {
        slug: "long-desc-tag",
        name: "Tag with Long Description",
        description: "A".repeat(501), // Exceeds 500 character limit
        idempotencyKey: "long-desc-key",
      };
      expect(() => createTagSchema.parse(tooLongDescInput)).toThrow();

      // Test empty description (should be allowed)
      const emptyDescInput = {
        slug: "empty-desc-tag",
        name: "Tag with Empty Description",
        description: "",
        idempotencyKey: "empty-desc-key",
      };
      expect(() => createTagSchema.parse(emptyDescInput)).not.toThrow();
    });

    it("should validate slug constraints", () => {
      // Test minimum slug length
      const minSlugInput = {
        slug: "abc", // Minimum 3 characters
        name: "Tag with Min Slug",
        idempotencyKey: "min-slug-key",
      };
      expect(() => createTagSchema.parse(minSlugInput)).not.toThrow();

      // Test slug too short
      const tooShortSlugInput = {
        slug: "ab", // Less than 3 characters
        name: "Tag with Short Slug",
        idempotencyKey: "short-slug-key",
      };
      expect(() => createTagSchema.parse(tooShortSlugInput)).toThrow();
    });

    it("should require mandatory fields", () => {
      const requiredFields = ["slug", "name"];

      requiredFields.forEach((field) => {
        const invalidInput = {
          slug: "test-tag-slug",
          name: "Test Tag Name",
          idempotencyKey: "test-create-key",
        };
        delete (invalidInput as any)[field];

        expect(() => createTagSchema.parse(invalidInput)).toThrow();
      });
    });

    it("should accept input without idempotencyKey", () => {
      const inputWithoutIdempotencyKey = {
        slug: "test-tag-slug",
        name: "Test Tag Name",
      };

      expect(() =>
        createTagSchema.parse(inputWithoutIdempotencyKey)
      ).not.toThrow();
    });
  });

  describe("updateTagSchema", () => {
    it("should accept valid input with all fields", () => {
      const validInput = {
        tagId: "clkv6q4a40000356h2g8h2g8h",
        name: "Updated Tag Name",
        description: "Updated description for the tag",
        idempotencyKey: "update-tag-key-101",
      };

      const result = updateTagSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept input with only tagId and idempotencyKey", () => {
      const minimalInput = {
        tagId: "clkv6q4a40000356h2g8h2g8h",
        idempotencyKey: "minimal-update-key",
      };

      expect(() => updateTagSchema.parse(minimalInput)).not.toThrow();
    });

    it("should accept input with only name update", () => {
      const nameOnlyInput = {
        tagId: "clkv6q4a40000356h2g8h2g8h",
        name: "Only Name Updated",
        idempotencyKey: "name-only-key",
      };

      expect(() => updateTagSchema.parse(nameOnlyInput)).not.toThrow();
    });

    it("should accept input with only description update", () => {
      const descOnlyInput = {
        tagId: "clkv6q4a40000356h2g8h2g8h",
        description: "Only description updated",
        idempotencyKey: "desc-only-key",
      };

      expect(() => updateTagSchema.parse(descOnlyInput)).not.toThrow();
    });

    it("should validate name constraints when provided", () => {
      // Test minimum name length
      const minNameInput = {
        tagId: "clkv6q4a40000356h2g8h2g8h",
        name: "A", // Minimum 1 character
        idempotencyKey: "update-min-name-key",
      };
      expect(() => updateTagSchema.parse(minNameInput)).not.toThrow();

      // Test maximum name length
      const maxNameInput = {
        tagId: "clkv6q4a40000356h2g8h2g8h",
        name: "A".repeat(100), // Exactly 100 characters
        idempotencyKey: "update-max-name-key",
      };
      expect(() => updateTagSchema.parse(maxNameInput)).not.toThrow();

      // Test empty name
      const emptyNameInput = {
        tagId: "clkv6q4a40000356h2g8h2g8h",
        name: "",
        idempotencyKey: "update-empty-name-key",
      };
      expect(() => updateTagSchema.parse(emptyNameInput)).toThrow();

      // Test name too long
      const tooLongNameInput = {
        tagId: "clkv6q4a40000356h2g8h2g8h",
        name: "A".repeat(101), // Exceeds 100 character limit
        idempotencyKey: "update-long-name-key",
      };
      expect(() => updateTagSchema.parse(tooLongNameInput)).toThrow();
    });

    it("should validate description constraints when provided", () => {
      // Test maximum description length
      const maxDescInput = {
        tagId: "clkv6q4a40000356h2g8h2g8h",
        description: "A".repeat(500), // Exactly 500 characters
        idempotencyKey: "update-max-desc-key",
      };
      expect(() => updateTagSchema.parse(maxDescInput)).not.toThrow();

      // Test description too long
      const tooLongDescInput = {
        tagId: "clkv6q4a40000356h2g8h2g8h",
        description: "A".repeat(501), // Exceeds 500 character limit
        idempotencyKey: "update-long-desc-key",
      };
      expect(() => updateTagSchema.parse(tooLongDescInput)).toThrow();

      // Test empty description (should be allowed)
      const emptyDescInput = {
        tagId: "clkv6q4a40000356h2g8h2g8h",
        description: "",
        idempotencyKey: "update-empty-desc-key",
      };
      expect(() => updateTagSchema.parse(emptyDescInput)).not.toThrow();
    });

    it("should validate tagId (CUID)", () => {
      const validTagIdInput = {
        tagId: "clkv6q4a40000356h2g8h2g8h",
        name: "Valid Tag ID Update",
        idempotencyKey: "valid-tag-id-key",
      };
      expect(() => updateTagSchema.parse(validTagIdInput)).not.toThrow();

      // Test empty tagId
      const emptyTagIdInput = {
        tagId: "",
        name: "Empty Tag ID Update",
        idempotencyKey: "empty-tag-id-key",
      };
      expect(() => updateTagSchema.parse(emptyTagIdInput)).toThrow();
    });

    it("should require mandatory fields", () => {
      const requiredFields = ["tagId"];

      requiredFields.forEach((field) => {
        const invalidInput = {
          tagId: "clkv6q4a40000356h2g8h2g8h",
          name: "Test Update Name",
          idempotencyKey: "test-update-key",
        };
        delete (invalidInput as any)[field];

        expect(() => updateTagSchema.parse(invalidInput)).toThrow();
      });
    });

    it("should accept input without idempotencyKey", () => {
      const inputWithoutIdempotencyKey = {
        tagId: "clkv6q4a40000356h2g8h2g8h",
        name: "Test Update Name",
      };

      expect(() =>
        updateTagSchema.parse(inputWithoutIdempotencyKey)
      ).not.toThrow();
    });
  });

  describe("getPopularTagsSchema", () => {
    it("should accept valid input with all fields", () => {
      const validInput = {
        limit: 50,
        period: "week" as const,
      };

      const result = getPopularTagsSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept minimal input with defaults", () => {
      const minimalInput = {};

      const result = getPopularTagsSchema.parse(minimalInput);
      expect(result).toEqual({
        limit: 20, // default value
        period: "month", // default value
      });
    });

    it("should validate limit constraints", () => {
      // Test minimum limit
      const minLimitInput = {
        limit: 1,
      };
      expect(() => getPopularTagsSchema.parse(minLimitInput)).not.toThrow();

      // Test maximum limit
      const maxLimitInput = {
        limit: 100,
      };
      expect(() => getPopularTagsSchema.parse(maxLimitInput)).not.toThrow();

      // Test invalid limit (below minimum)
      const invalidMinInput = {
        limit: 0,
      };
      expect(() => getPopularTagsSchema.parse(invalidMinInput)).toThrow();

      // Test invalid limit (above maximum)
      const invalidMaxInput = {
        limit: 101,
      };
      expect(() => getPopularTagsSchema.parse(invalidMaxInput)).toThrow();
    });

    it("should validate integer limit", () => {
      const invalidIntegerInput = {
        limit: 25.5, // Should be integer
      };

      expect(() => getPopularTagsSchema.parse(invalidIntegerInput)).toThrow();
    });

    it("should accept all valid period values", () => {
      const periodValues = ["day", "week", "month", "all"] as const;

      periodValues.forEach((period) => {
        const input = { period };
        expect(() => getPopularTagsSchema.parse(input)).not.toThrow();
      });
    });

    it("should use default period value", () => {
      const input = {};

      const result = getPopularTagsSchema.parse(input);
      expect(result.period).toBe("month");
    });

    it("should reject invalid period", () => {
      const invalidPeriodInput = {
        period: "invalid_period",
      };

      expect(() => getPopularTagsSchema.parse(invalidPeriodInput)).toThrow();
    });

    it("should use default limit value", () => {
      const input = {};

      const result = getPopularTagsSchema.parse(input);
      expect(result.limit).toBe(20);
    });
  });

  describe("getTagSuggestionsSchema", () => {
    it("should accept valid input with all fields", () => {
      const validInput = {
        query: "javascript",
        limit: 15,
        excludeExisting: ["react", "vue", "angular"],
      };

      const result = getTagSuggestionsSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept minimal input with defaults", () => {
      const minimalInput = {
        query: "test",
      };

      const result = getTagSuggestionsSchema.parse(minimalInput);
      expect(result).toEqual({
        query: "test",
        limit: 10, // default value
      });
    });

    it("should accept input without excludeExisting", () => {
      const inputWithoutExclude = {
        query: "python",
        limit: 8,
      };

      expect(() =>
        getTagSuggestionsSchema.parse(inputWithoutExclude)
      ).not.toThrow();
    });

    it("should validate query constraints", () => {
      // Test minimum query length
      const minQueryInput = {
        query: "a", // Minimum 1 character
      };
      expect(() => getTagSuggestionsSchema.parse(minQueryInput)).not.toThrow();

      // Test maximum query length
      const maxQueryInput = {
        query: "a".repeat(50), // Exactly 50 characters
      };
      expect(() => getTagSuggestionsSchema.parse(maxQueryInput)).not.toThrow();

      // Test empty query
      const emptyQueryInput = {
        query: "",
      };
      expect(() => getTagSuggestionsSchema.parse(emptyQueryInput)).toThrow();

      // Test query too long
      const tooLongQueryInput = {
        query: "a".repeat(51), // Exceeds 50 character limit
      };
      expect(() => getTagSuggestionsSchema.parse(tooLongQueryInput)).toThrow();
    });

    it("should validate limit constraints", () => {
      // Test minimum limit
      const minLimitInput = {
        query: "test",
        limit: 1,
      };
      expect(() => getTagSuggestionsSchema.parse(minLimitInput)).not.toThrow();

      // Test maximum limit
      const maxLimitInput = {
        query: "test",
        limit: 20,
      };
      expect(() => getTagSuggestionsSchema.parse(maxLimitInput)).not.toThrow();

      // Test invalid limit (below minimum)
      const invalidMinInput = {
        query: "test",
        limit: 0,
      };
      expect(() => getTagSuggestionsSchema.parse(invalidMinInput)).toThrow();

      // Test invalid limit (above maximum)
      const invalidMaxInput = {
        query: "test",
        limit: 21,
      };
      expect(() => getTagSuggestionsSchema.parse(invalidMaxInput)).toThrow();
    });

    it("should validate integer limit", () => {
      const invalidIntegerInput = {
        query: "test",
        limit: 12.7, // Should be integer
      };

      expect(() =>
        getTagSuggestionsSchema.parse(invalidIntegerInput)
      ).toThrow();
    });

    it("should use default limit value", () => {
      const input = {
        query: "default-limit-test",
      };

      const result = getTagSuggestionsSchema.parse(input);
      expect(result.limit).toBe(10);
    });

    it("should validate excludeExisting slugs", () => {
      // Test valid exclude slugs
      const validExcludeInput = {
        query: "test",
        excludeExisting: ["valid-slug-1", "valid-slug-2", "valid-slug-3"],
      };
      expect(() =>
        getTagSuggestionsSchema.parse(validExcludeInput)
      ).not.toThrow();

      // Test invalid exclude slug (too short)
      const invalidExcludeInput = {
        query: "test",
        excludeExisting: ["valid-slug", "xy"], // "xy" is too short
      };
      expect(() =>
        getTagSuggestionsSchema.parse(invalidExcludeInput)
      ).toThrow();

      // Test empty excludeExisting array
      const emptyExcludeInput = {
        query: "test",
        excludeExisting: [],
      };
      expect(() =>
        getTagSuggestionsSchema.parse(emptyExcludeInput)
      ).not.toThrow();
    });

    it("should require query field", () => {
      const inputWithoutQuery = {
        limit: 10,
        excludeExisting: ["test-slug"],
      };

      expect(() => getTagSuggestionsSchema.parse(inputWithoutQuery)).toThrow();
    });
  });

  describe("Type Exports", () => {
    it("should export all input types", () => {
      // Test that types are properly exported by creating variables of each type
      const listTagsInput: ListTagsInput = {};

      const getTagBySlugInput: GetTagBySlugInput = {
        slug: "test-slug",
      };

      const attachTagsInput: AttachTagsInput = {
        ruleId: "test-rule-id",
        tagSlugs: ["test-tag"],
        idempotencyKey: "test-key",
      };

      const detachTagsInput: DetachTagsInput = {
        ruleId: "test-rule-id",
        tagSlugs: ["test-tag"],
        idempotencyKey: "test-key",
      };

      const createTagInput: CreateTagInput = {
        slug: "test-slug",
        name: "Test Name",
        idempotencyKey: "test-key",
      };

      const updateTagInput: UpdateTagInput = {
        tagId: "test-tag-id",
        idempotencyKey: "test-key",
      };

      const getPopularTagsInput: GetPopularTagsInput = {};

      const getTagSuggestionsInput: GetTagSuggestionsInput = {
        query: "test",
      };

      expect(listTagsInput).toBeDefined();
      expect(getTagBySlugInput).toBeDefined();
      expect(attachTagsInput).toBeDefined();
      expect(detachTagsInput).toBeDefined();
      expect(createTagInput).toBeDefined();
      expect(updateTagInput).toBeDefined();
      expect(getPopularTagsInput).toBeDefined();
      expect(getTagSuggestionsInput).toBeDefined();
    });
  });

  describe("Edge Cases and Integration", () => {
    it("should handle complex tag management scenarios", () => {
      // Complex list tags scenario
      const complexListInput = {
        cursor: "complex-pagination-cursor-with-special-chars-123",
        limit: 75,
        search: "javascript framework testing library",
        sort: "recent" as const,
        includeCount: false,
      };
      expect(() => listTagsSchema.parse(complexListInput)).not.toThrow();

      // Complex attach tags scenario
      const complexAttachInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        tagSlugs: [
          "javascript",
          "typescript",
          "react",
          "nextjs",
          "testing",
          "vitest",
          "jest",
          "cypress",
          "playwright",
          "automation",
        ], // Maximum 10 tags
        idempotencyKey: "complex-attach-tags-key-with-timestamp-123456789",
      };
      expect(() => attachTagsSchema.parse(complexAttachInput)).not.toThrow();

      // Complex create tag scenario
      const complexCreateInput = {
        slug: "complex-new-tag-slug-with-dashes",
        name: "Complex New Tag Name with Spaces and Numbers 123",
        description:
          "This is a comprehensive description for a complex tag that demonstrates the maximum length capabilities of the description field. It includes various details about the tag's purpose, usage guidelines, and examples of when this tag should be applied to rules. The description can contain up to 500 characters to provide detailed information.",
        idempotencyKey: "complex-create-tag-key-with-uuid-style-format",
      };
      expect(() => createTagSchema.parse(complexCreateInput)).not.toThrow();
    });

    it("should handle boundary values for all constraints", () => {
      // Test list tags boundaries
      const listBoundaries = [
        { limit: 1, sort: "name" as const }, // Minimum limit
        { limit: 100, sort: "count" as const }, // Maximum limit
      ];

      listBoundaries.forEach((bounds) => {
        const input = bounds;
        expect(() => listTagsSchema.parse(input)).not.toThrow();
      });

      // Test attach tags boundaries
      const attachBoundaries = [
        {
          ruleId: "clkv6q4a40000356h2g8h2g8h",
          tagSlugs: ["single-tag"], // Minimum 1 tag
          idempotencyKey: "min-attach-key",
        },
        {
          ruleId: "clkv6q4a40000356h2g8h2g8h",
          tagSlugs: Array(10).fill("max-tag"), // Maximum 10 tags
          idempotencyKey: "max-attach-key",
        },
      ];

      attachBoundaries.forEach((bounds) => {
        expect(() => attachTagsSchema.parse(bounds)).not.toThrow();
      });

      // Test create tag boundaries
      const createBoundaries = [
        {
          slug: "abc", // Minimum slug length
          name: "A", // Minimum name length
          idempotencyKey: "min-create-key",
        },
        {
          slug: "maximum-length-slug-with-many-characters",
          name: "A".repeat(100), // Maximum name length
          description: "A".repeat(500), // Maximum description length
          idempotencyKey: "max-create-key",
        },
      ];

      createBoundaries.forEach((bounds) => {
        expect(() => createTagSchema.parse(bounds)).not.toThrow();
      });

      // Test suggestions boundaries
      const suggestionsBoundaries = [
        {
          query: "a", // Minimum query length
          limit: 1, // Minimum limit
        },
        {
          query: "a".repeat(50), // Maximum query length
          limit: 20, // Maximum limit
        },
      ];

      suggestionsBoundaries.forEach((bounds) => {
        expect(() => getTagSuggestionsSchema.parse(bounds)).not.toThrow();
      });
    });

    it("should handle comprehensive tag operations workflow", () => {
      // 1. List tags with search
      const listInput = {
        search: "javascript",
        sort: "count" as const,
        limit: 20,
        includeCount: true,
      };
      expect(() => listTagsSchema.parse(listInput)).not.toThrow();

      // 2. Get tag suggestions
      const suggestionsInput = {
        query: "js",
        limit: 10,
        excludeExisting: ["javascript", "jquery"],
      };
      expect(() =>
        getTagSuggestionsSchema.parse(suggestionsInput)
      ).not.toThrow();

      // 3. Create new tag
      const createInput = {
        slug: "javascript-testing",
        name: "JavaScript Testing",
        description: "Tag for JavaScript testing frameworks and tools",
        idempotencyKey: "create-js-testing-tag",
      };
      expect(() => createTagSchema.parse(createInput)).not.toThrow();

      // 4. Get tag by slug
      const getBySlugInput = {
        slug: "javascript-testing",
        includeStats: true,
      };
      expect(() => getTagBySlugSchema.parse(getBySlugInput)).not.toThrow();

      // 5. Attach tags to rule
      const attachInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        tagSlugs: ["javascript-testing", "vitest", "unit-testing"],
        idempotencyKey: "attach-testing-tags",
      };
      expect(() => attachTagsSchema.parse(attachInput)).not.toThrow();

      // 6. Update tag
      const updateInput = {
        tagId: "clkv6q4a40000356h2g8h2g8h",
        name: "JavaScript Testing Framework",
        description: "Updated description for JavaScript testing frameworks",
        idempotencyKey: "update-js-testing-tag",
      };
      expect(() => updateTagSchema.parse(updateInput)).not.toThrow();

      // 7. Get popular tags
      const popularInput = {
        limit: 50,
        period: "month" as const,
      };
      expect(() => getPopularTagsSchema.parse(popularInput)).not.toThrow();

      // 8. Detach some tags
      const detachInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        tagSlugs: ["unit-testing"], // Remove one tag
        idempotencyKey: "detach-unit-testing-tag",
      };
      expect(() => detachTagsSchema.parse(detachInput)).not.toThrow();
    });

    it("should handle various slug formats and constraints", () => {
      const slugVariations = [
        "abc", // Minimum length
        "simple-tag",
        "tag-with-numbers-123",
        "very-long-tag-slug-with-many-words-and-dashes",
        "tag123",
        "javascript-testing-framework",
      ];

      slugVariations.forEach((slug) => {
        // Test in getTagBySlug
        const getBySlugInput = { slug };
        expect(() => getTagBySlugSchema.parse(getBySlugInput)).not.toThrow();

        // Test in createTag
        const createInput = {
          slug,
          name: `Tag for ${slug}`,
          idempotencyKey: `create-${slug}-key`,
        };
        expect(() => createTagSchema.parse(createInput)).not.toThrow();

        // Test in attach/detach arrays
        const attachInput = {
          ruleId: "clkv6q4a40000356h2g8h2g8h",
          tagSlugs: [slug],
          idempotencyKey: `attach-${slug}-key`,
        };
        expect(() => attachTagsSchema.parse(attachInput)).not.toThrow();

        const detachInput = {
          ruleId: "clkv6q4a40000356h2g8h2g8h",
          tagSlugs: [slug],
          idempotencyKey: `detach-${slug}-key`,
        };
        expect(() => detachTagsSchema.parse(detachInput)).not.toThrow();
      });
    });

    it("should handle edge cases for optional fields", () => {
      // Test all optional field combinations for listTags
      const listVariations = [
        {}, // All defaults
        { search: "test" }, // Only search
        { sort: "name" as const }, // Only sort
        { includeCount: false }, // Only includeCount
        { limit: 50 }, // Only limit
        { cursor: "test-cursor" }, // Only cursor
      ];

      listVariations.forEach((variation) => {
        expect(() => listTagsSchema.parse(variation)).not.toThrow();
      });

      // Test optional field combinations for updateTag
      const updateVariations = [
        {
          tagId: "clkv6q4a40000356h2g8h2g8h",
          idempotencyKey: "test-key",
        }, // Only required fields
        {
          tagId: "clkv6q4a40000356h2g8h2g8h",
          name: "Updated Name",
          idempotencyKey: "test-key",
        }, // Only name
        {
          tagId: "clkv6q4a40000356h2g8h2g8h",
          description: "Updated description",
          idempotencyKey: "test-key",
        }, // Only description
      ];

      updateVariations.forEach((variation) => {
        expect(() => updateTagSchema.parse(variation)).not.toThrow();
      });

      // Test optional field combinations for getTagSuggestions
      const suggestionsVariations = [
        { query: "test" }, // Only required field
        { query: "test", limit: 15 }, // With limit
        { query: "test", excludeExisting: ["tag1", "tag2"] }, // With excludeExisting
        { query: "test", excludeExisting: [] }, // With empty excludeExisting
      ];

      suggestionsVariations.forEach((variation) => {
        expect(() => getTagSuggestionsSchema.parse(variation)).not.toThrow();
      });
    });
  });
});
