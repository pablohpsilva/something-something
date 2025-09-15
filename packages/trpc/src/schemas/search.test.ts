import { describe, it, expect } from "vitest";
import {
  searchInputSchema,
  suggestInputSchema,
  refreshRuleInputSchema,
  searchResultResponseSchema,
  suggestResponseSchema,
  searchStatsResponseSchema,
  searchOperationResponseSchema,
  advancedFiltersSchema,
  searchFacetsResponseSchema,
  type SearchInput,
  type SuggestInput,
  type RefreshRuleInput,
  type SearchResultResponse,
  type SuggestResponse,
  type SearchStatsResponse,
  type SearchOperationResponse,
  type AdvancedFilters,
  type SearchFacetsResponse,
} from "./search";

describe("Search Schemas", () => {
  describe("searchInputSchema", () => {
    it("should accept valid search input", () => {
      const validInput = {
        q: "javascript testing framework",
        filters: {
          tags: ["javascript", "testing"],
          model: "gpt-4",
          status: "PUBLISHED" as const,
          contentType: "RULE" as const,
          authorHandle: "john-doe",
          dateFrom: "2024-01-01T00:00:00Z",
          dateTo: "2024-12-31T23:59:59Z",
        },
        limit: 25,
        offset: 50,
      };

      const result = searchInputSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept minimal search input", () => {
      const minimalInput = {
        q: "test query",
      };

      const result = searchInputSchema.parse(minimalInput);
      expect(result).toEqual({
        q: "test query",
        filters: {
          status: "PUBLISHED", // default value in filters
        },
        limit: 20, // default
        offset: 0, // default
      });
    });

    it("should trim and validate query string", () => {
      const inputWithWhitespace = {
        q: "  trimmed query  ",
      };

      const result = searchInputSchema.parse(inputWithWhitespace);
      expect(result.q).toBe("trimmed query");
    });

    it("should reject empty query", () => {
      const emptyQuery = {
        q: "",
      };

      expect(() => searchInputSchema.parse(emptyQuery)).toThrow();
    });

    it("should reject query that is too long", () => {
      const longQuery = {
        q: "a".repeat(201), // Exceeds 200 char limit
      };

      expect(() => searchInputSchema.parse(longQuery)).toThrow();
    });

    it("should accept query at max length", () => {
      const maxLengthQuery = {
        q: "a".repeat(200), // Exactly 200 chars
      };

      expect(() => searchInputSchema.parse(maxLengthQuery)).not.toThrow();
    });

    it("should validate limit constraints", () => {
      // Test minimum limit
      const minLimitInput = {
        q: "test",
        limit: 1,
      };
      expect(() => searchInputSchema.parse(minLimitInput)).not.toThrow();

      // Test maximum limit
      const maxLimitInput = {
        q: "test",
        limit: 100,
      };
      expect(() => searchInputSchema.parse(maxLimitInput)).not.toThrow();

      // Test invalid limit (below minimum)
      const invalidMinInput = {
        q: "test",
        limit: 0,
      };
      expect(() => searchInputSchema.parse(invalidMinInput)).toThrow();

      // Test invalid limit (above maximum)
      const invalidMaxInput = {
        q: "test",
        limit: 101,
      };
      expect(() => searchInputSchema.parse(invalidMaxInput)).toThrow();
    });

    it("should validate offset constraints", () => {
      // Test minimum offset
      const minOffsetInput = {
        q: "test",
        offset: 0,
      };
      expect(() => searchInputSchema.parse(minOffsetInput)).not.toThrow();

      // Test maximum offset
      const maxOffsetInput = {
        q: "test",
        offset: 1000,
      };
      expect(() => searchInputSchema.parse(maxOffsetInput)).not.toThrow();

      // Test invalid offset (below minimum)
      const invalidMinInput = {
        q: "test",
        offset: -1,
      };
      expect(() => searchInputSchema.parse(invalidMinInput)).toThrow();

      // Test invalid offset (above maximum)
      const invalidMaxInput = {
        q: "test",
        offset: 1001,
      };
      expect(() => searchInputSchema.parse(invalidMaxInput)).toThrow();
    });

    it("should validate filters.tags constraints", () => {
      // Test maximum tags
      const maxTagsInput = {
        q: "test",
        filters: {
          tags: Array(10).fill("tag"), // Exactly 10 tags
        },
      };
      expect(() => searchInputSchema.parse(maxTagsInput)).not.toThrow();

      // Test too many tags
      const tooManyTagsInput = {
        q: "test",
        filters: {
          tags: Array(11).fill("tag"), // Exceeds 10 tag limit
        },
      };
      expect(() => searchInputSchema.parse(tooManyTagsInput)).toThrow();

      // Test empty tag strings
      const emptyTagInput = {
        q: "test",
        filters: {
          tags: ["valid-tag", ""], // Empty tag
        },
      };
      expect(() => searchInputSchema.parse(emptyTagInput)).toThrow();
    });

    it("should validate filters.model constraints", () => {
      // Test valid model
      const validModelInput = {
        q: "test",
        filters: {
          model: "gpt-4-turbo",
        },
      };
      expect(() => searchInputSchema.parse(validModelInput)).not.toThrow();

      // Test model too long
      const longModelInput = {
        q: "test",
        filters: {
          model: "a".repeat(51), // Exceeds 50 char limit
        },
      };
      expect(() => searchInputSchema.parse(longModelInput)).toThrow();

      // Test empty model
      const emptyModelInput = {
        q: "test",
        filters: {
          model: "",
        },
      };
      expect(() => searchInputSchema.parse(emptyModelInput)).toThrow();
    });

    it("should accept all valid status values", () => {
      const statusValues = ["PUBLISHED", "DEPRECATED", "ALL"] as const;

      statusValues.forEach((status) => {
        const input = {
          q: "test",
          filters: { status },
        };
        expect(() => searchInputSchema.parse(input)).not.toThrow();
      });
    });

    it("should use default status value", () => {
      const input = {
        q: "test",
        filters: {},
      };

      const result = searchInputSchema.parse(input);
      expect(result.filters.status).toBe("PUBLISHED");
    });

    it("should reject invalid status", () => {
      const invalidStatusInput = {
        q: "test",
        filters: {
          status: "INVALID_STATUS",
        },
      };

      expect(() => searchInputSchema.parse(invalidStatusInput)).toThrow();
    });

    it("should accept all valid content types", () => {
      const contentTypes = ["PROMPT", "RULE", "MCP", "GUIDE"] as const;

      contentTypes.forEach((contentType) => {
        const input = {
          q: "test",
          filters: { contentType },
        };
        expect(() => searchInputSchema.parse(input)).not.toThrow();
      });
    });

    it("should reject invalid content type", () => {
      const invalidContentTypeInput = {
        q: "test",
        filters: {
          contentType: "INVALID_TYPE",
        },
      };

      expect(() => searchInputSchema.parse(invalidContentTypeInput)).toThrow();
    });

    it("should validate authorHandle constraints", () => {
      // Test valid author handle
      const validAuthorInput = {
        q: "test",
        filters: {
          authorHandle: "john-doe-123",
        },
      };
      expect(() => searchInputSchema.parse(validAuthorInput)).not.toThrow();

      // Test author handle too long
      const longAuthorInput = {
        q: "test",
        filters: {
          authorHandle: "a".repeat(51), // Exceeds 50 char limit
        },
      };
      expect(() => searchInputSchema.parse(longAuthorInput)).toThrow();

      // Test empty author handle
      const emptyAuthorInput = {
        q: "test",
        filters: {
          authorHandle: "",
        },
      };
      expect(() => searchInputSchema.parse(emptyAuthorInput)).toThrow();
    });

    it("should validate datetime strings", () => {
      // Test valid datetime
      const validDateInput = {
        q: "test",
        filters: {
          dateFrom: "2024-01-01T00:00:00Z",
          dateTo: "2024-12-31T23:59:59.999Z",
        },
      };
      expect(() => searchInputSchema.parse(validDateInput)).not.toThrow();

      // Test invalid datetime format
      const invalidDateInput = {
        q: "test",
        filters: {
          dateFrom: "2024-01-01", // Missing time component
        },
      };
      expect(() => searchInputSchema.parse(invalidDateInput)).toThrow();
    });

    it("should accept partial filters", () => {
      const partialFiltersInput = {
        q: "test query",
        filters: {
          tags: ["javascript"],
          status: "ALL" as const,
        },
      };

      expect(() => searchInputSchema.parse(partialFiltersInput)).not.toThrow();
    });
  });

  describe("suggestInputSchema", () => {
    it("should accept valid suggest input", () => {
      const validInput = {
        q: "javascript",
        limit: 10,
      };

      const result = suggestInputSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should use default limit", () => {
      const minimalInput = {
        q: "test",
      };

      const result = suggestInputSchema.parse(minimalInput);
      expect(result.limit).toBe(8); // default value
    });

    it("should trim query string", () => {
      const inputWithWhitespace = {
        q: "  suggestion query  ",
      };

      const result = suggestInputSchema.parse(inputWithWhitespace);
      expect(result.q).toBe("suggestion query");
    });

    it("should validate query length constraints", () => {
      // Test maximum length
      const maxLengthInput = {
        q: "a".repeat(100), // Exactly 100 chars
      };
      expect(() => suggestInputSchema.parse(maxLengthInput)).not.toThrow();

      // Test too long
      const tooLongInput = {
        q: "a".repeat(101), // Exceeds 100 char limit
      };
      expect(() => suggestInputSchema.parse(tooLongInput)).toThrow();

      // Test empty query
      const emptyInput = {
        q: "",
      };
      expect(() => suggestInputSchema.parse(emptyInput)).toThrow();
    });

    it("should validate limit constraints", () => {
      // Test minimum limit
      const minLimitInput = {
        q: "test",
        limit: 1,
      };
      expect(() => suggestInputSchema.parse(minLimitInput)).not.toThrow();

      // Test maximum limit
      const maxLimitInput = {
        q: "test",
        limit: 20,
      };
      expect(() => suggestInputSchema.parse(maxLimitInput)).not.toThrow();

      // Test invalid limit (below minimum)
      const invalidMinInput = {
        q: "test",
        limit: 0,
      };
      expect(() => suggestInputSchema.parse(invalidMinInput)).toThrow();

      // Test invalid limit (above maximum)
      const invalidMaxInput = {
        q: "test",
        limit: 21,
      };
      expect(() => suggestInputSchema.parse(invalidMaxInput)).toThrow();
    });
  });

  describe("refreshRuleInputSchema", () => {
    it("should accept valid CUID", () => {
      const validInput = {
        ruleId: "clkv6q4a40000356h2g8h2g8h",
      };

      const result = refreshRuleInputSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept any non-empty string (cuidOrUuidSchema)", () => {
      const validInput = {
        ruleId: "any-non-empty-string",
      };

      expect(() => refreshRuleInputSchema.parse(validInput)).not.toThrow();
    });

    it("should reject empty string", () => {
      const emptyInput = {
        ruleId: "",
      };

      expect(() => refreshRuleInputSchema.parse(emptyInput)).toThrow();
    });

    it("should require ruleId", () => {
      const inputWithoutRuleId = {};

      expect(() => refreshRuleInputSchema.parse(inputWithoutRuleId)).toThrow();
    });
  });

  describe("searchResultResponseSchema", () => {
    it("should accept valid search result response", () => {
      const validResponse = {
        results: [
          {
            id: "rule123",
            slug: "test-rule-slug",
            title: "Test Rule Title",
            summary: "This is a test rule summary",
            author: {
              id: "author123",
              handle: "john-doe",
              displayName: "John Doe",
              avatarUrl: "https://example.com/avatar.jpg",
            },
            tags: ["javascript", "testing"],
            primaryModel: "gpt-4",
            status: "PUBLISHED",
            score: 0.95,
            ftsRank: 0.8,
            trending: 0.7,
            snippetHtml: "<em>Test</em> rule snippet",
            createdAt: new Date("2024-01-15T10:00:00Z"),
            updatedAt: new Date("2024-01-20T15:30:00Z"),
          },
        ],
        pagination: {
          total: 150,
          hasMore: true,
          nextOffset: 20,
        },
        meta: {
          query: "javascript testing",
          filters: {
            tags: ["javascript"],
            status: "PUBLISHED",
          },
          took: 45.5,
        },
      };

      const result = searchResultResponseSchema.parse(validResponse);
      expect(result).toEqual(validResponse);
    });

    it("should accept empty results", () => {
      const emptyResponse = {
        results: [],
        pagination: {
          total: 0,
          hasMore: false,
        },
        meta: {
          query: "no results query",
          filters: {},
          took: 12.3,
        },
      };

      expect(() =>
        searchResultResponseSchema.parse(emptyResponse)
      ).not.toThrow();
    });

    it("should accept null values for optional fields", () => {
      const responseWithNulls = {
        results: [
          {
            id: "rule456",
            slug: "minimal-rule",
            title: "Minimal Rule",
            summary: null, // nullable
            author: {
              id: "author456",
              handle: "jane-smith",
              displayName: "Jane Smith",
              avatarUrl: null, // nullable
            },
            tags: [],
            primaryModel: null, // nullable
            status: "DRAFT",
            score: 0.5,
            ftsRank: 0.3,
            trending: 0.1,
            snippetHtml: null, // nullable
            createdAt: new Date("2024-02-01T00:00:00Z"),
            updatedAt: new Date("2024-02-01T00:00:00Z"),
          },
        ],
        pagination: {
          total: 1,
          hasMore: false,
          // nextOffset is optional
        },
        meta: {
          query: "minimal",
          filters: {},
          took: 5.2,
        },
      };

      expect(() =>
        searchResultResponseSchema.parse(responseWithNulls)
      ).not.toThrow();
    });

    it("should validate required fields", () => {
      const requiredFields = ["results", "pagination", "meta"];

      requiredFields.forEach((field) => {
        const invalidResponse = {
          results: [],
          pagination: { total: 0, hasMore: false },
          meta: { query: "test", filters: {}, took: 1 },
        };
        delete (invalidResponse as any)[field];

        expect(() =>
          searchResultResponseSchema.parse(invalidResponse)
        ).toThrow();
      });
    });
  });

  describe("suggestResponseSchema", () => {
    it("should accept valid suggest response", () => {
      const validResponse = {
        suggestions: [
          {
            id: "suggestion1",
            slug: "first-suggestion",
            title: "First Suggestion",
            similarity: 0.95,
          },
          {
            id: "suggestion2",
            slug: "second-suggestion",
            title: "Second Suggestion",
            similarity: 0.87,
          },
        ],
      };

      const result = suggestResponseSchema.parse(validResponse);
      expect(result).toEqual(validResponse);
    });

    it("should accept empty suggestions", () => {
      const emptyResponse = {
        suggestions: [],
      };

      expect(() => suggestResponseSchema.parse(emptyResponse)).not.toThrow();
    });

    it("should validate suggestion structure", () => {
      const validSuggestion = {
        suggestions: [
          {
            id: "test-id",
            slug: "test-slug",
            title: "Test Title",
            similarity: 0.5,
          },
        ],
      };

      expect(() => suggestResponseSchema.parse(validSuggestion)).not.toThrow();
    });

    it("should require all suggestion fields", () => {
      const requiredFields = ["id", "slug", "title", "similarity"];

      requiredFields.forEach((field) => {
        const invalidSuggestion = {
          suggestions: [
            {
              id: "test",
              slug: "test",
              title: "Test",
              similarity: 0.5,
            },
          ],
        };
        delete (invalidSuggestion.suggestions[0] as any)[field];

        expect(() => suggestResponseSchema.parse(invalidSuggestion)).toThrow();
      });
    });
  });

  describe("searchStatsResponseSchema", () => {
    it("should accept valid search stats response", () => {
      const validResponse = {
        totalIndexed: 50000,
        lastUpdated: new Date("2024-01-20T12:00:00Z"),
        avgTsvLength: 1250.75,
      };

      const result = searchStatsResponseSchema.parse(validResponse);
      expect(result).toEqual(validResponse);
    });

    it("should accept null lastUpdated", () => {
      const responseWithNullDate = {
        totalIndexed: 0,
        lastUpdated: null,
        avgTsvLength: 0,
      };

      expect(() =>
        searchStatsResponseSchema.parse(responseWithNullDate)
      ).not.toThrow();
    });

    it("should validate integer totalIndexed", () => {
      const invalidIntegerResponse = {
        totalIndexed: 123.45, // Should be integer
        lastUpdated: new Date(),
        avgTsvLength: 100,
      };

      expect(() =>
        searchStatsResponseSchema.parse(invalidIntegerResponse)
      ).toThrow();
    });

    it("should require all fields", () => {
      const requiredFields = ["totalIndexed", "lastUpdated", "avgTsvLength"];

      requiredFields.forEach((field) => {
        const invalidResponse = {
          totalIndexed: 100,
          lastUpdated: new Date(),
          avgTsvLength: 50.5,
        };
        delete (invalidResponse as any)[field];

        expect(() =>
          searchStatsResponseSchema.parse(invalidResponse)
        ).toThrow();
      });
    });
  });

  describe("searchOperationResponseSchema", () => {
    it("should accept valid operation response", () => {
      const validResponse = {
        success: true,
        message: "Operation completed successfully",
        count: 25,
      };

      const result = searchOperationResponseSchema.parse(validResponse);
      expect(result).toEqual(validResponse);
    });

    it("should accept minimal response", () => {
      const minimalResponse = {
        success: false,
      };

      const result = searchOperationResponseSchema.parse(minimalResponse);
      expect(result.message).toBeUndefined();
      expect(result.count).toBeUndefined();
    });

    it("should accept response with only message", () => {
      const responseWithMessage = {
        success: true,
        message: "Custom message",
      };

      expect(() =>
        searchOperationResponseSchema.parse(responseWithMessage)
      ).not.toThrow();
    });

    it("should accept response with only count", () => {
      const responseWithCount = {
        success: true,
        count: 42,
      };

      expect(() =>
        searchOperationResponseSchema.parse(responseWithCount)
      ).not.toThrow();
    });

    it("should validate integer count", () => {
      const invalidCountResponse = {
        success: true,
        count: 12.34, // Should be integer
      };

      expect(() =>
        searchOperationResponseSchema.parse(invalidCountResponse)
      ).toThrow();
    });

    it("should require success field", () => {
      const responseWithoutSuccess = {
        message: "Missing success field",
      };

      expect(() =>
        searchOperationResponseSchema.parse(responseWithoutSuccess)
      ).toThrow();
    });
  });

  describe("advancedFiltersSchema", () => {
    it("should accept valid advanced filters", () => {
      const validFilters = {
        tags: ["javascript", "react"],
        excludeTags: ["deprecated", "legacy"],
        models: ["gpt-4", "claude-3"],
        authors: ["john-doe", "jane-smith"],
        contentTypes: ["RULE", "GUIDE"] as const,
        statuses: ["PUBLISHED"] as const,
        dateRange: {
          from: "2024-01-01T00:00:00Z",
          to: "2024-12-31T23:59:59Z",
        },
        scoreRange: {
          min: 0.5,
          max: 1.0,
        },
        sortBy: "relevance" as const,
        sortOrder: "desc" as const,
      };

      const result = advancedFiltersSchema.parse(validFilters);
      expect(result).toEqual(validFilters);
    });

    it("should use default values", () => {
      const minimalFilters = {};

      const result = advancedFiltersSchema.parse(minimalFilters);
      expect(result.sortBy).toBe("relevance"); // default
      expect(result.sortOrder).toBe("desc"); // default
    });

    it("should accept all valid content types", () => {
      const contentTypes = ["PROMPT", "RULE", "MCP", "GUIDE"] as const;

      const filters = {
        contentTypes,
      };

      expect(() => advancedFiltersSchema.parse(filters)).not.toThrow();
    });

    it("should accept all valid statuses", () => {
      const statuses = ["PUBLISHED", "DEPRECATED"] as const;

      const filters = {
        statuses,
      };

      expect(() => advancedFiltersSchema.parse(filters)).not.toThrow();
    });

    it("should accept all valid sortBy values", () => {
      const sortByValues = [
        "relevance",
        "date",
        "score",
        "trending",
        "title",
      ] as const;

      sortByValues.forEach((sortBy) => {
        const filters = { sortBy };
        expect(() => advancedFiltersSchema.parse(filters)).not.toThrow();
      });
    });

    it("should accept all valid sortOrder values", () => {
      const sortOrderValues = ["asc", "desc"] as const;

      sortOrderValues.forEach((sortOrder) => {
        const filters = { sortOrder };
        expect(() => advancedFiltersSchema.parse(filters)).not.toThrow();
      });
    });

    it("should reject invalid sortBy", () => {
      const invalidFilters = {
        sortBy: "invalid_sort",
      };

      expect(() => advancedFiltersSchema.parse(invalidFilters)).toThrow();
    });

    it("should reject invalid sortOrder", () => {
      const invalidFilters = {
        sortOrder: "invalid_order",
      };

      expect(() => advancedFiltersSchema.parse(invalidFilters)).toThrow();
    });

    it("should validate scoreRange constraints", () => {
      // Test valid score range
      const validScoreRange = {
        scoreRange: {
          min: 0.0,
          max: 1.0,
        },
      };
      expect(() => advancedFiltersSchema.parse(validScoreRange)).not.toThrow();

      // Test invalid min score (negative)
      const invalidMinScore = {
        scoreRange: {
          min: -0.1,
          max: 1.0,
        },
      };
      expect(() => advancedFiltersSchema.parse(invalidMinScore)).toThrow();

      // Test invalid max score (negative)
      const invalidMaxScore = {
        scoreRange: {
          min: 0.0,
          max: -0.1,
        },
      };
      expect(() => advancedFiltersSchema.parse(invalidMaxScore)).toThrow();
    });

    it("should validate dateRange datetime format", () => {
      // Test valid date range
      const validDateRange = {
        dateRange: {
          from: "2024-01-01T00:00:00Z",
          to: "2024-12-31T23:59:59Z",
        },
      };
      expect(() => advancedFiltersSchema.parse(validDateRange)).not.toThrow();

      // Test invalid date format
      const invalidDateRange = {
        dateRange: {
          from: "2024-01-01", // Missing time component
          to: "2024-12-31T23:59:59Z",
        },
      };
      expect(() => advancedFiltersSchema.parse(invalidDateRange)).toThrow();
    });

    it("should accept partial filters", () => {
      const partialFilters = {
        tags: ["javascript"],
        sortBy: "date" as const,
      };

      expect(() => advancedFiltersSchema.parse(partialFilters)).not.toThrow();
    });
  });

  describe("searchFacetsResponseSchema", () => {
    it("should accept valid facets response", () => {
      const validResponse = {
        tags: [
          {
            name: "JavaScript",
            slug: "javascript",
            count: 150,
          },
          {
            name: "React",
            slug: "react",
            count: 89,
          },
        ],
        models: [
          {
            name: "GPT-4",
            count: 200,
          },
          {
            name: "Claude-3",
            count: 75,
          },
        ],
        authors: [
          {
            handle: "john-doe",
            displayName: "John Doe",
            count: 25,
          },
          {
            handle: "jane-smith",
            displayName: "Jane Smith",
            count: 18,
          },
        ],
        contentTypes: [
          {
            type: "RULE",
            count: 120,
          },
          {
            type: "GUIDE",
            count: 45,
          },
        ],
      };

      const result = searchFacetsResponseSchema.parse(validResponse);
      expect(result).toEqual(validResponse);
    });

    it("should accept empty facets", () => {
      const emptyResponse = {
        tags: [],
        models: [],
        authors: [],
        contentTypes: [],
      };

      expect(() =>
        searchFacetsResponseSchema.parse(emptyResponse)
      ).not.toThrow();
    });

    it("should validate integer counts", () => {
      const invalidCountResponse = {
        tags: [
          {
            name: "Test",
            slug: "test",
            count: 12.5, // Should be integer
          },
        ],
        models: [],
        authors: [],
        contentTypes: [],
      };

      expect(() =>
        searchFacetsResponseSchema.parse(invalidCountResponse)
      ).toThrow();
    });

    it("should require all facet fields", () => {
      const requiredFields = ["tags", "models", "authors", "contentTypes"];

      requiredFields.forEach((field) => {
        const invalidResponse = {
          tags: [],
          models: [],
          authors: [],
          contentTypes: [],
        };
        delete (invalidResponse as any)[field];

        expect(() =>
          searchFacetsResponseSchema.parse(invalidResponse)
        ).toThrow();
      });
    });

    it("should validate tag facet structure", () => {
      const validTagFacet = {
        tags: [
          {
            name: "Valid Tag",
            slug: "valid-tag",
            count: 10,
          },
        ],
        models: [],
        authors: [],
        contentTypes: [],
      };

      expect(() =>
        searchFacetsResponseSchema.parse(validTagFacet)
      ).not.toThrow();
    });

    it("should validate model facet structure", () => {
      const validModelFacet = {
        tags: [],
        models: [
          {
            name: "Valid Model",
            count: 5,
          },
        ],
        authors: [],
        contentTypes: [],
      };

      expect(() =>
        searchFacetsResponseSchema.parse(validModelFacet)
      ).not.toThrow();
    });

    it("should validate author facet structure", () => {
      const validAuthorFacet = {
        tags: [],
        models: [],
        authors: [
          {
            handle: "valid-handle",
            displayName: "Valid Name",
            count: 3,
          },
        ],
        contentTypes: [],
      };

      expect(() =>
        searchFacetsResponseSchema.parse(validAuthorFacet)
      ).not.toThrow();
    });

    it("should validate content type facet structure", () => {
      const validContentTypeFacet = {
        tags: [],
        models: [],
        authors: [],
        contentTypes: [
          {
            type: "PROMPT",
            count: 8,
          },
        ],
      };

      expect(() =>
        searchFacetsResponseSchema.parse(validContentTypeFacet)
      ).not.toThrow();
    });
  });

  describe("Type Exports", () => {
    it("should export all input and response types", () => {
      // Test that types are properly exported by creating variables of each type
      const searchInput: SearchInput = {
        q: "test",
      };

      const suggestInput: SuggestInput = {
        q: "test",
      };

      const refreshRuleInput: RefreshRuleInput = {
        ruleId: "test-id",
      };

      const searchResultResponse: SearchResultResponse = {
        results: [],
        pagination: { total: 0, hasMore: false },
        meta: { query: "test", filters: {}, took: 1 },
      };

      const suggestResponse: SuggestResponse = {
        suggestions: [],
      };

      const searchStatsResponse: SearchStatsResponse = {
        totalIndexed: 0,
        lastUpdated: null,
        avgTsvLength: 0,
      };

      const searchOperationResponse: SearchOperationResponse = {
        success: true,
      };

      const advancedFilters: AdvancedFilters = {};

      const searchFacetsResponse: SearchFacetsResponse = {
        tags: [],
        models: [],
        authors: [],
        contentTypes: [],
      };

      expect(searchInput).toBeDefined();
      expect(suggestInput).toBeDefined();
      expect(refreshRuleInput).toBeDefined();
      expect(searchResultResponse).toBeDefined();
      expect(suggestResponse).toBeDefined();
      expect(searchStatsResponse).toBeDefined();
      expect(searchOperationResponse).toBeDefined();
      expect(advancedFilters).toBeDefined();
      expect(searchFacetsResponse).toBeDefined();
    });
  });

  describe("Edge Cases and Integration", () => {
    it("should handle complex search scenarios", () => {
      const complexSearchInput = {
        q: "advanced javascript testing framework with typescript support",
        filters: {
          tags: [
            "javascript",
            "typescript",
            "testing",
            "framework",
            "jest",
            "vitest",
          ],
          model: "gpt-4-turbo-preview",
          status: "ALL" as const,
          contentType: "RULE" as const,
          authorHandle: "testing-expert-2024",
          dateFrom: "2024-01-01T00:00:00.000Z",
          dateTo: "2024-12-31T23:59:59.999Z",
        },
        limit: 50,
        offset: 100,
      };

      expect(() => searchInputSchema.parse(complexSearchInput)).not.toThrow();
    });

    it("should handle edge case query lengths", () => {
      // Test query at exact limits
      const queries = [
        "a", // Minimum length (1 char)
        "a".repeat(200), // Maximum length for search
        "b".repeat(100), // Maximum length for suggest
      ];

      queries.forEach((q, index) => {
        if (index < 2) {
          // Search input
          const searchInput = { q };
          expect(() => searchInputSchema.parse(searchInput)).not.toThrow();
        }
        if (index === 0 || index === 2) {
          // Suggest input
          const suggestInput = { q };
          expect(() => suggestInputSchema.parse(suggestInput)).not.toThrow();
        }
      });
    });

    it("should handle boundary values for numeric constraints", () => {
      // Test search input boundaries
      const searchBoundaries = [
        { limit: 1, offset: 0 }, // Minimum values
        { limit: 100, offset: 1000 }, // Maximum values
      ];

      searchBoundaries.forEach((bounds) => {
        const input = {
          q: "test",
          ...bounds,
        };
        expect(() => searchInputSchema.parse(input)).not.toThrow();
      });

      // Test suggest input boundaries
      const suggestBoundaries = [
        { limit: 1 }, // Minimum
        { limit: 20 }, // Maximum
      ];

      suggestBoundaries.forEach((bounds) => {
        const input = {
          q: "test",
          ...bounds,
        };
        expect(() => suggestInputSchema.parse(input)).not.toThrow();
      });
    });

    it("should handle comprehensive response structures", () => {
      const comprehensiveResponse = {
        results: [
          {
            id: "comprehensive-rule-id",
            slug: "comprehensive-rule-slug",
            title: "Comprehensive Rule with All Features",
            summary:
              "This is a comprehensive rule that demonstrates all possible fields and features available in the search system.",
            author: {
              id: "comprehensive-author-id",
              handle: "comprehensive-author",
              displayName: "Comprehensive Author Name",
              avatarUrl: "https://cdn.example.com/avatars/comprehensive.jpg",
            },
            tags: [
              "comprehensive",
              "testing",
              "javascript",
              "typescript",
              "react",
              "nextjs",
              "vitest",
              "zod",
            ],
            primaryModel: "gpt-4-turbo-preview-comprehensive",
            status: "PUBLISHED",
            score: 0.9876543210987654,
            ftsRank: 0.8765432109876543,
            trending: 0.7654321098765432,
            snippetHtml:
              "<em>Comprehensive</em> rule with <strong>highlighted</strong> terms and <mark>search</mark> matches",
            createdAt: new Date("2024-01-01T00:00:00.000Z"),
            updatedAt: new Date("2024-12-31T23:59:59.999Z"),
          },
        ],
        pagination: {
          total: 9999999,
          hasMore: true,
          nextOffset: 999,
        },
        meta: {
          query: "comprehensive search query with multiple terms",
          filters: {
            tags: ["comprehensive", "testing"],
            model: "gpt-4-turbo-preview",
            status: "PUBLISHED",
            contentType: "RULE",
            authorHandle: "comprehensive-author",
            dateFrom: "2024-01-01T00:00:00Z",
            dateTo: "2024-12-31T23:59:59Z",
          },
          took: 123.456789,
        },
      };

      expect(() =>
        searchResultResponseSchema.parse(comprehensiveResponse)
      ).not.toThrow();
    });

    it("should handle advanced filter combinations", () => {
      const advancedFilterCombinations = [
        {
          tags: ["tag1", "tag2", "tag3"],
          excludeTags: ["exclude1", "exclude2"],
          models: ["gpt-4", "claude-3", "gemini-pro"],
          authors: ["author1", "author2", "author3"],
          contentTypes: ["PROMPT", "RULE"] as const,
          statuses: ["PUBLISHED", "DEPRECATED"] as const,
          dateRange: {
            from: "2024-01-01T00:00:00Z",
            to: "2024-06-30T23:59:59Z",
          },
          scoreRange: {
            min: 0.75,
            max: 1.0,
          },
          sortBy: "trending" as const,
          sortOrder: "asc" as const,
        },
        {
          // Minimal advanced filters
          sortBy: "title" as const,
        },
        {
          // Only arrays
          tags: ["single-tag"],
          models: ["single-model"],
          authors: ["single-author"],
        },
      ];

      advancedFilterCombinations.forEach((filters) => {
        expect(() => advancedFiltersSchema.parse(filters)).not.toThrow();
      });
    });

    it("should handle facet responses with various counts", () => {
      const facetVariations = {
        tags: [
          { name: "Popular Tag", slug: "popular-tag", count: 999999 },
          { name: "Rare Tag", slug: "rare-tag", count: 1 },
          { name: "Zero Tag", slug: "zero-tag", count: 0 },
        ],
        models: [
          { name: "Dominant Model", count: 500000 },
          { name: "Niche Model", count: 5 },
        ],
        authors: [
          {
            handle: "prolific-author",
            displayName: "Prolific Author",
            count: 1000,
          },
          { handle: "new-author", displayName: "New Author", count: 1 },
        ],
        contentTypes: [
          { type: "RULE", count: 300000 },
          { type: "PROMPT", count: 200000 },
          { type: "GUIDE", count: 50000 },
          { type: "MCP", count: 1000 },
        ],
      };

      expect(() =>
        searchFacetsResponseSchema.parse(facetVariations)
      ).not.toThrow();
    });

    it("should validate all schemas work together in a search flow", () => {
      // 1. Search input
      const searchInput = {
        q: "javascript testing",
        filters: {
          tags: ["javascript", "testing"],
          status: "PUBLISHED" as const,
        },
        limit: 10,
        offset: 0,
      };
      expect(() => searchInputSchema.parse(searchInput)).not.toThrow();

      // 2. Search result response
      const searchResponse = {
        results: [
          {
            id: "result1",
            slug: "test-result",
            title: "Test Result",
            summary: "A test result",
            author: {
              id: "author1",
              handle: "test-author",
              displayName: "Test Author",
              avatarUrl: null,
            },
            tags: ["javascript", "testing"],
            primaryModel: "gpt-4",
            status: "PUBLISHED",
            score: 0.9,
            ftsRank: 0.8,
            trending: 0.7,
            snippetHtml: "Test snippet",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        pagination: { total: 1, hasMore: false },
        meta: { query: "javascript testing", filters: {}, took: 25 },
      };
      expect(() =>
        searchResultResponseSchema.parse(searchResponse)
      ).not.toThrow();

      // 3. Suggest input
      const suggestInput = { q: "javascript" };
      expect(() => suggestInputSchema.parse(suggestInput)).not.toThrow();

      // 4. Suggest response
      const suggestResponse = {
        suggestions: [
          {
            id: "suggestion1",
            slug: "js-suggestion",
            title: "JavaScript Suggestion",
            similarity: 0.95,
          },
        ],
      };
      expect(() => suggestResponseSchema.parse(suggestResponse)).not.toThrow();

      // 5. Advanced filters
      const advancedFilters = {
        tags: ["javascript"],
        sortBy: "relevance" as const,
        sortOrder: "desc" as const,
      };
      expect(() => advancedFiltersSchema.parse(advancedFilters)).not.toThrow();
    });
  });
});
