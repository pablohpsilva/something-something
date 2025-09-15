import { describe, it, expect } from "vitest";
import {
  recordEventSchema,
  getOpenMetricsSchema,
  getRuleMetricsSchema,
  getVersionMetricsSchema,
  getAuthorMetricsSchema,
  getPlatformMetricsSchema,
  getTrendingContentSchema,
  type RecordEventInput,
  type GetOpenMetricsInput,
  type GetRuleMetricsInput,
  type GetVersionMetricsInput,
  type GetAuthorMetricsInput,
  type GetPlatformMetricsInput,
  type GetTrendingContentInput,
} from "./metrics";

describe("Metrics Schemas", () => {
  describe("recordEventSchema", () => {
    it("should accept valid event recording input", () => {
      const validInput = {
        type: "VIEW" as const,
        ruleId: "clkv6q4a40000356h2g8h2g8h",
        ruleVersionId: "clkv6q4a40001356h2g8h2g8h",
        metadata: {
          source: "web",
          userAgent: "Mozilla/5.0",
          referrer: "https://example.com",
        },
        idempotencyKey: "unique-key-123",
      };

      const result = recordEventSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept input without optional fields", () => {
      const minimalInput = {
        type: "COPY" as const,
        idempotencyKey: "minimal-key-456",
      };

      const result = recordEventSchema.parse(minimalInput);
      expect(result).toEqual(minimalInput);
    });

    it("should accept all valid event types", () => {
      const eventTypes = [
        "VIEW",
        "COPY",
        "SAVE",
        "FORK",
        "COMMENT",
        "VOTE",
        "DONATE",
        "CLAIM",
      ] as const;

      eventTypes.forEach((type) => {
        const input = {
          type,
          idempotencyKey: `key-${type.toLowerCase()}`,
        };
        expect(() => recordEventSchema.parse(input)).not.toThrow();
      });
    });

    it("should reject invalid event type", () => {
      const invalidInput = {
        type: "INVALID_TYPE",
        idempotencyKey: "key-123",
      };

      expect(() => recordEventSchema.parse(invalidInput)).toThrow();
    });

    it("should accept input with only ruleId", () => {
      const input = {
        type: "VIEW" as const,
        ruleId: "clkv6q4a40002356h2g8h2g8h",
        idempotencyKey: "key-rule-only",
      };

      const result = recordEventSchema.parse(input);
      expect(result.ruleVersionId).toBeUndefined();
    });

    it("should accept input with only ruleVersionId", () => {
      const input = {
        type: "VOTE" as const,
        ruleVersionId: "clkv6q4a40003356h2g8h2g8h",
        idempotencyKey: "key-version-only",
      };

      const result = recordEventSchema.parse(input);
      expect(result.ruleId).toBeUndefined();
    });

    it("should accept complex metadata object", () => {
      const input = {
        type: "FORK" as const,
        ruleId: "clkv6q4a40004356h2g8h2g8h",
        metadata: {
          nested: {
            data: {
              level: 3,
              array: [1, 2, 3],
              boolean: true,
            },
          },
          timestamp: "2024-01-15T10:00:00Z",
          tags: ["javascript", "react"],
        },
        idempotencyKey: "complex-metadata-key",
      };

      expect(() => recordEventSchema.parse(input)).not.toThrow();
    });

    it("should accept input without idempotencyKey", () => {
      const inputWithoutKey = {
        type: "VIEW" as const,
        ruleId: "clkv6q4a40004356h2g8h2g8h",
      };

      expect(() => recordEventSchema.parse(inputWithoutKey)).not.toThrow();
    });

    it("should accept empty metadata object", () => {
      const input = {
        type: "SAVE" as const,
        metadata: {},
        idempotencyKey: "empty-metadata-key",
      };

      expect(() => recordEventSchema.parse(input)).not.toThrow();
    });
  });

  describe("getOpenMetricsSchema", () => {
    it("should accept valid open metrics input", () => {
      const validInput = {
        ruleId: "clkv6q4a40004356h2g8h2g8h",
        period: "month" as const,
        granularity: "week" as const,
      };

      const result = getOpenMetricsSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should use default values for optional fields", () => {
      const minimalInput = {
        ruleId: "clkv6q4a40005356h2g8h2g8h",
      };

      const result = getOpenMetricsSchema.parse(minimalInput);
      expect(result).toEqual({
        ruleId: "clkv6q4a40005356h2g8h2g8h",
        period: "week", // default value
        granularity: "day", // default value
      });
    });

    it("should accept all valid period values", () => {
      const periods = ["day", "week", "month", "all"] as const;

      periods.forEach((period) => {
        const input = {
          ruleId: "clkv6q4a40004356h2g8h2g8h",
          period,
        };
        expect(() => getOpenMetricsSchema.parse(input)).not.toThrow();
      });
    });

    it("should accept all valid granularity values", () => {
      const granularities = ["hour", "day", "week"] as const;

      granularities.forEach((granularity) => {
        const input = {
          ruleId: "clkv6q4a40004356h2g8h2g8h",
          granularity,
        };
        expect(() => getOpenMetricsSchema.parse(input)).not.toThrow();
      });
    });

    it("should reject invalid period", () => {
      const invalidInput = {
        ruleId: "clkv6q4a40004356h2g8h2g8h",
        period: "year",
      };

      expect(() => getOpenMetricsSchema.parse(invalidInput)).toThrow();
    });

    it("should reject invalid granularity", () => {
      const invalidInput = {
        ruleId: "clkv6q4a40004356h2g8h2g8h",
        granularity: "minute",
      };

      expect(() => getOpenMetricsSchema.parse(invalidInput)).toThrow();
    });

    it("should require ruleId", () => {
      const inputWithoutRuleId = {
        period: "week" as const,
      };

      expect(() => getOpenMetricsSchema.parse(inputWithoutRuleId)).toThrow();
    });
  });

  describe("getRuleMetricsSchema", () => {
    it("should accept valid rule metrics input", () => {
      const validInput = {
        ruleId: "clkv6q4a40004356h2g8h2g8h",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
        granularity: "week" as const,
      };

      const result = getRuleMetricsSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should use default granularity", () => {
      const input = {
        ruleId: "clkv6q4a40050356h2g8h2g8h",
        startDate: new Date("2024-01-01"),
      };

      const result = getRuleMetricsSchema.parse(input);
      expect(result.granularity).toBe("day"); // default value
    });

    it("should accept input without date range", () => {
      const input = {
        ruleId: "clkv6q4a40002356h2g8h2g8h",
        granularity: "month" as const,
      };

      const result = getRuleMetricsSchema.parse(input);
      expect(result.startDate).toBeUndefined();
      expect(result.endDate).toBeUndefined();
    });

    it("should accept all valid granularity values", () => {
      const granularities = ["hour", "day", "week", "month"] as const;

      granularities.forEach((granularity) => {
        const input = {
          ruleId: "clkv6q4a40004356h2g8h2g8h",
          granularity,
        };
        expect(() => getRuleMetricsSchema.parse(input)).not.toThrow();
      });
    });

    it("should reject invalid granularity", () => {
      const invalidInput = {
        ruleId: "clkv6q4a40004356h2g8h2g8h",
        granularity: "year",
      };

      expect(() => getRuleMetricsSchema.parse(invalidInput)).toThrow();
    });

    it("should accept only startDate", () => {
      const input = {
        ruleId: "clkv6q4a40004356h2g8h2g8h",
        startDate: new Date("2024-01-01"),
      };

      const result = getRuleMetricsSchema.parse(input);
      expect(result.endDate).toBeUndefined();
    });

    it("should accept only endDate", () => {
      const input = {
        ruleId: "clkv6q4a40004356h2g8h2g8h",
        endDate: new Date("2024-01-31"),
      };

      const result = getRuleMetricsSchema.parse(input);
      expect(result.startDate).toBeUndefined();
    });

    it("should require ruleId", () => {
      const inputWithoutRuleId = {
        startDate: new Date("2024-01-01"),
      };

      expect(() => getRuleMetricsSchema.parse(inputWithoutRuleId)).toThrow();
    });
  });

  describe("getVersionMetricsSchema", () => {
    it("should accept valid version metrics input", () => {
      const validInput = {
        ruleVersionId: "clkv6q4a40007356h2g8h2g8h",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
        granularity: "hour" as const,
      };

      const result = getVersionMetricsSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should use default granularity", () => {
      const input = {
        ruleVersionId: "clkv6q4a40006356h2g8h2g8h",
      };

      const result = getVersionMetricsSchema.parse(input);
      expect(result.granularity).toBe("day"); // default value
    });

    it("should accept input without date range", () => {
      const input = {
        ruleVersionId: "clkv6q4a40003356h2g8h2g8h",
        granularity: "week" as const,
      };

      const result = getVersionMetricsSchema.parse(input);
      expect(result.startDate).toBeUndefined();
      expect(result.endDate).toBeUndefined();
    });

    it("should accept all valid granularity values", () => {
      const granularities = ["hour", "day", "week", "month"] as const;

      granularities.forEach((granularity) => {
        const input = {
          ruleVersionId: "clkv6q4a40007356h2g8h2g8h",
          granularity,
        };
        expect(() => getVersionMetricsSchema.parse(input)).not.toThrow();
      });
    });

    it("should reject invalid granularity", () => {
      const invalidInput = {
        ruleVersionId: "clkv6q4a40007356h2g8h2g8h",
        granularity: "second",
      };

      expect(() => getVersionMetricsSchema.parse(invalidInput)).toThrow();
    });

    it("should require ruleVersionId", () => {
      const inputWithoutVersionId = {
        startDate: new Date("2024-01-01"),
      };

      expect(() =>
        getVersionMetricsSchema.parse(inputWithoutVersionId)
      ).toThrow();
    });

    it("should handle date range edge cases", () => {
      const input = {
        ruleVersionId: "clkv6q4a40007356h2g8h2g8h",
        startDate: new Date("2024-12-31T23:59:59Z"),
        endDate: new Date("2024-01-01T00:00:00Z"), // End before start
      };

      // Schema doesn't validate date logic, just types
      expect(() => getVersionMetricsSchema.parse(input)).not.toThrow();
    });
  });

  describe("getAuthorMetricsSchema", () => {
    it("should accept valid author metrics input", () => {
      const validInput = {
        authorId: "author123",
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
        granularity: "month" as const,
      };

      const result = getAuthorMetricsSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should use default granularity", () => {
      const input = {
        authorId: "author456",
      };

      const result = getAuthorMetricsSchema.parse(input);
      expect(result.granularity).toBe("day"); // default value
    });

    it("should accept input without date range", () => {
      const input = {
        authorId: "author789",
        granularity: "week" as const,
      };

      const result = getAuthorMetricsSchema.parse(input);
      expect(result.startDate).toBeUndefined();
      expect(result.endDate).toBeUndefined();
    });

    it("should accept all valid granularity values", () => {
      const granularities = ["day", "week", "month"] as const;

      granularities.forEach((granularity) => {
        const input = {
          authorId: "author123",
          granularity,
        };
        expect(() => getAuthorMetricsSchema.parse(input)).not.toThrow();
      });
    });

    it("should reject invalid granularity", () => {
      const invalidInput = {
        authorId: "author123",
        granularity: "hour", // Not supported for author metrics
      };

      expect(() => getAuthorMetricsSchema.parse(invalidInput)).toThrow();
    });

    it("should require authorId", () => {
      const inputWithoutAuthorId = {
        startDate: new Date("2024-01-01"),
      };

      expect(() =>
        getAuthorMetricsSchema.parse(inputWithoutAuthorId)
      ).toThrow();
    });

    it("should accept string authorId", () => {
      const input = {
        authorId: "user_cuid_12345",
        granularity: "week" as const,
      };

      expect(() => getAuthorMetricsSchema.parse(input)).not.toThrow();
    });
  });

  describe("getPlatformMetricsSchema", () => {
    it("should accept valid platform metrics input", () => {
      const validInput = {
        startDate: new Date("2024-01-01"),
        endDate: new Date("2024-01-31"),
        granularity: "week" as const,
        includeBreakdown: true,
      };

      const result = getPlatformMetricsSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should use default values for all optional fields", () => {
      const emptyInput = {};

      const result = getPlatformMetricsSchema.parse(emptyInput);
      expect(result).toEqual({
        granularity: "day", // default value
        includeBreakdown: false, // default value
      });
    });

    it("should accept input without date range", () => {
      const input = {
        granularity: "month" as const,
        includeBreakdown: true,
      };

      const result = getPlatformMetricsSchema.parse(input);
      expect(result.startDate).toBeUndefined();
      expect(result.endDate).toBeUndefined();
    });

    it("should accept all valid granularity values", () => {
      const granularities = ["day", "week", "month"] as const;

      granularities.forEach((granularity) => {
        const input = { granularity };
        expect(() => getPlatformMetricsSchema.parse(input)).not.toThrow();
      });
    });

    it("should reject invalid granularity", () => {
      const invalidInput = {
        granularity: "hour", // Not supported for platform metrics
      };

      expect(() => getPlatformMetricsSchema.parse(invalidInput)).toThrow();
    });

    it("should accept includeBreakdown false", () => {
      const input = {
        includeBreakdown: false,
      };

      const result = getPlatformMetricsSchema.parse(input);
      expect(result.includeBreakdown).toBe(false);
    });

    it("should accept includeBreakdown true", () => {
      const input = {
        includeBreakdown: true,
      };

      const result = getPlatformMetricsSchema.parse(input);
      expect(result.includeBreakdown).toBe(true);
    });

    it("should accept only startDate", () => {
      const input = {
        startDate: new Date("2024-01-01"),
      };

      const result = getPlatformMetricsSchema.parse(input);
      expect(result.endDate).toBeUndefined();
    });

    it("should accept only endDate", () => {
      const input = {
        endDate: new Date("2024-01-31"),
      };

      const result = getPlatformMetricsSchema.parse(input);
      expect(result.startDate).toBeUndefined();
    });
  });

  describe("getTrendingContentSchema", () => {
    it("should accept valid trending content input", () => {
      const validInput = {
        period: "month" as const,
        limit: 50,
        contentType: "authors" as const,
      };

      const result = getTrendingContentSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should use default values for all optional fields", () => {
      const emptyInput = {};

      const result = getTrendingContentSchema.parse(emptyInput);
      expect(result).toEqual({
        period: "week", // default value
        limit: 20, // default value
        contentType: "rules", // default value
      });
    });

    it("should accept all valid period values", () => {
      const periods = ["day", "week", "month"] as const;

      periods.forEach((period) => {
        const input = { period };
        expect(() => getTrendingContentSchema.parse(input)).not.toThrow();
      });
    });

    it("should accept all valid contentType values", () => {
      const contentTypes = ["rules", "authors", "tags"] as const;

      contentTypes.forEach((contentType) => {
        const input = { contentType };
        expect(() => getTrendingContentSchema.parse(input)).not.toThrow();
      });
    });

    it("should reject invalid period", () => {
      const invalidInput = {
        period: "year",
      };

      expect(() => getTrendingContentSchema.parse(invalidInput)).toThrow();
    });

    it("should reject invalid contentType", () => {
      const invalidInput = {
        contentType: "comments",
      };

      expect(() => getTrendingContentSchema.parse(invalidInput)).toThrow();
    });

    it("should validate limit constraints", () => {
      // Test minimum limit
      const minLimitInput = {
        limit: 1,
      };
      expect(() => getTrendingContentSchema.parse(minLimitInput)).not.toThrow();

      // Test maximum limit
      const maxLimitInput = {
        limit: 100,
      };
      expect(() => getTrendingContentSchema.parse(maxLimitInput)).not.toThrow();

      // Test invalid limit (below minimum)
      const invalidMinInput = {
        limit: 0,
      };
      expect(() => getTrendingContentSchema.parse(invalidMinInput)).toThrow();

      // Test invalid limit (above maximum)
      const invalidMaxInput = {
        limit: 101,
      };
      expect(() => getTrendingContentSchema.parse(invalidMaxInput)).toThrow();
    });

    it("should reject non-integer limit", () => {
      const invalidInput = {
        limit: 25.5,
      };

      expect(() => getTrendingContentSchema.parse(invalidInput)).toThrow();
    });

    it("should accept custom limit within range", () => {
      const input = {
        limit: 75,
      };

      const result = getTrendingContentSchema.parse(input);
      expect(result.limit).toBe(75);
    });
  });

  describe("Type Exports", () => {
    it("should export all input types", () => {
      // Test that types are properly exported by creating variables of each type
      const recordEventInput: RecordEventInput = {
        type: "VIEW",
        idempotencyKey: "key-123",
      };

      const getOpenMetricsInput: GetOpenMetricsInput = {
        ruleId: "clkv6q4a40004356h2g8h2g8h",
      };

      const getRuleMetricsInput: GetRuleMetricsInput = {
        ruleId: "clkv6q4a40004356h2g8h2g8h",
      };

      const getVersionMetricsInput: GetVersionMetricsInput = {
        ruleVersionId: "clkv6q4a40007356h2g8h2g8h",
      };

      const getAuthorMetricsInput: GetAuthorMetricsInput = {
        authorId: "author123",
      };

      const getPlatformMetricsInput: GetPlatformMetricsInput = {};

      const getTrendingContentInput: GetTrendingContentInput = {};

      expect(recordEventInput).toBeDefined();
      expect(getOpenMetricsInput).toBeDefined();
      expect(getRuleMetricsInput).toBeDefined();
      expect(getVersionMetricsInput).toBeDefined();
      expect(getAuthorMetricsInput).toBeDefined();
      expect(getPlatformMetricsInput).toBeDefined();
      expect(getTrendingContentInput).toBeDefined();
    });
  });

  describe("Edge Cases and Integration", () => {
    it("should handle complex event recording with all fields", () => {
      const complexEvent = {
        type: "DONATE" as const,
        ruleId: "clkv6q4a40030356h2g8h2g8h",
        ruleVersionId: "clkv6q4a40031356h2g8h2g8h",
        metadata: {
          amount: 1000,
          currency: "USD",
          donor: {
            id: "user123",
            anonymous: false,
          },
          campaign: {
            id: "campaign456",
            name: "Support Open Source",
          },
          tracking: {
            source: "newsletter",
            medium: "email",
            campaign: "monthly_highlight",
          },
        },
        idempotencyKey: "donation_event_2024_01_15_user123_rule123",
      };

      expect(() => recordEventSchema.parse(complexEvent)).not.toThrow();
    });

    it("should handle metrics queries with full date ranges", () => {
      const startDate = new Date("2024-01-01T00:00:00Z");
      const endDate = new Date("2024-12-31T23:59:59Z");

      const ruleMetricsInput = {
        ruleId: "clkv6q4a40040356h2g8h2g8h",
        startDate,
        endDate,
        granularity: "month" as const,
      };

      const versionMetricsInput = {
        ruleVersionId: "clkv6q4a40041356h2g8h2g8h",
        startDate,
        endDate,
        granularity: "week" as const,
      };

      const authorMetricsInput = {
        authorId: "author_annual_report",
        startDate,
        endDate,
        granularity: "month" as const,
      };

      const platformMetricsInput = {
        startDate,
        endDate,
        granularity: "week" as const,
        includeBreakdown: true,
      };

      expect(() => getRuleMetricsSchema.parse(ruleMetricsInput)).not.toThrow();
      expect(() =>
        getVersionMetricsSchema.parse(versionMetricsInput)
      ).not.toThrow();
      expect(() =>
        getAuthorMetricsSchema.parse(authorMetricsInput)
      ).not.toThrow();
      expect(() =>
        getPlatformMetricsSchema.parse(platformMetricsInput)
      ).not.toThrow();
    });

    it("should handle boundary values for trending content", () => {
      // Test minimum values
      const minTrendingInput = {
        period: "day" as const,
        limit: 1,
        contentType: "tags" as const,
      };

      // Test maximum values
      const maxTrendingInput = {
        period: "month" as const,
        limit: 100,
        contentType: "authors" as const,
      };

      expect(() =>
        getTrendingContentSchema.parse(minTrendingInput)
      ).not.toThrow();
      expect(() =>
        getTrendingContentSchema.parse(maxTrendingInput)
      ).not.toThrow();
    });

    it("should handle all event types with different metadata structures", () => {
      const eventTypes = [
        "VIEW",
        "COPY",
        "SAVE",
        "FORK",
        "COMMENT",
        "VOTE",
        "DONATE",
        "CLAIM",
      ] as const;

      eventTypes.forEach((type, index) => {
        const input = {
          type,
          ruleId: `clkv6q4a4000${index}356h2g8h2g8h`,
          metadata: {
            eventType: type,
            timestamp: new Date().toISOString(),
            sequenceNumber: index,
            userContext: {
              authenticated: index % 2 === 0,
              sessionId: `session_${index}`,
            },
          },
          idempotencyKey: `${type.toLowerCase()}_event_${index}`,
        };

        expect(() => recordEventSchema.parse(input)).not.toThrow();
      });
    });

    it("should handle granularity consistency across schemas", () => {
      // Test that granularities are consistent where they overlap
      const commonGranularities = ["day", "week", "month"] as const;

      commonGranularities.forEach((granularity) => {
        // These schemas should all accept common granularities
        const openMetricsInput = {
          ruleId: "clkv6q4a40004356h2g8h2g8h",
          granularity: granularity === "month" ? "week" : granularity, // Open metrics doesn't support month
        };

        const ruleMetricsInput = {
          ruleId: "clkv6q4a40004356h2g8h2g8h",
          granularity,
        };

        const authorMetricsInput = {
          authorId: "author123",
          granularity,
        };

        const platformMetricsInput = {
          granularity,
        };

        if (granularity !== "month") {
          expect(() =>
            getOpenMetricsSchema.parse(openMetricsInput)
          ).not.toThrow();
        }
        expect(() =>
          getRuleMetricsSchema.parse(ruleMetricsInput)
        ).not.toThrow();
        expect(() =>
          getAuthorMetricsSchema.parse(authorMetricsInput)
        ).not.toThrow();
        expect(() =>
          getPlatformMetricsSchema.parse(platformMetricsInput)
        ).not.toThrow();
      });
    });

    it("should handle date edge cases", () => {
      const edgeDates = [
        new Date("1970-01-01T00:00:00Z"), // Unix epoch
        new Date("2000-01-01T00:00:00Z"), // Y2K
        new Date("2024-02-29T12:00:00Z"), // Leap year
        new Date("2024-12-31T23:59:59Z"), // End of year
      ];

      edgeDates.forEach((date, index) => {
        const input = {
          ruleId: `clkv6q4a4001${index}356h2g8h2g8h`,
          startDate: date,
          endDate: new Date(date.getTime() + 86400000), // +1 day
        };

        expect(() => getRuleMetricsSchema.parse(input)).not.toThrow();
      });
    });

    it("should validate that all schemas handle empty optional fields correctly", () => {
      // Test minimal inputs for all schemas
      const minimalInputs = [
        {
          schema: recordEventSchema,
          input: { type: "VIEW", idempotencyKey: "key" },
        },
        {
          schema: getOpenMetricsSchema,
          input: { ruleId: "clkv6q4a40020356h2g8h2g8h" },
        },
        {
          schema: getRuleMetricsSchema,
          input: { ruleId: "clkv6q4a40021356h2g8h2g8h" },
        },
        {
          schema: getVersionMetricsSchema,
          input: { ruleVersionId: "clkv6q4a40022356h2g8h2g8h" },
        },
        { schema: getAuthorMetricsSchema, input: { authorId: "author123" } },
        { schema: getPlatformMetricsSchema, input: {} },
        { schema: getTrendingContentSchema, input: {} },
      ];

      minimalInputs.forEach(({ schema, input }) => {
        expect(() => schema.parse(input)).not.toThrow();
      });
    });
  });
});
