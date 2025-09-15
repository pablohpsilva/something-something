import { describe, it, expect } from "vitest";
import {
  getLeaderboardSchema,
  getUserRankSchema,
  getLeaderboardHistorySchema,
  generateSnapshotSchema,
  getAvailableScopesSchema,
  type GetLeaderboardInput,
  type GetUserRankInput,
  type GetLeaderboardHistoryInput,
  type GenerateSnapshotInput,
  type GetAvailableScopesInput,
} from "./leaderboard";

describe("Leaderboard Schemas", () => {
  describe("getLeaderboardSchema", () => {
    it("should accept valid leaderboard input", () => {
      const validInput = {
        period: "WEEKLY" as const,
        scope: "GLOBAL" as const,
        scopeRef: "javascript",
        cursor: "cursor123",
        limit: 50,
        includeStats: true,
      };

      const result = getLeaderboardSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should use default values for optional fields", () => {
      const minimalInput = {
        period: "DAILY" as const,
        scope: "GLOBAL" as const,
      };

      const result = getLeaderboardSchema.parse(minimalInput);
      expect(result).toEqual({
        period: "DAILY",
        scope: "GLOBAL",
        limit: 20, // default from paginationSchema
        includeStats: true, // default value
      });
    });

    it("should accept all valid period values", () => {
      const periods = ["DAILY", "WEEKLY", "MONTHLY", "ALL"] as const;

      periods.forEach((period) => {
        const input = { period, scope: "GLOBAL" as const };
        expect(() => getLeaderboardSchema.parse(input)).not.toThrow();
      });
    });

    it("should accept all valid scope values", () => {
      const scopes = ["GLOBAL", "TAG", "MODEL"] as const;

      scopes.forEach((scope) => {
        const input = { period: "DAILY" as const, scope };
        expect(() => getLeaderboardSchema.parse(input)).not.toThrow();
      });
    });

    it("should reject invalid period values", () => {
      const invalidInput = {
        period: "INVALID",
        scope: "GLOBAL" as const,
      };

      expect(() => getLeaderboardSchema.parse(invalidInput)).toThrow();
    });

    it("should reject invalid scope values", () => {
      const invalidInput = {
        period: "DAILY" as const,
        scope: "INVALID",
      };

      expect(() => getLeaderboardSchema.parse(invalidInput)).toThrow();
    });

    it("should accept TAG scope with scopeRef", () => {
      const input = {
        period: "MONTHLY" as const,
        scope: "TAG" as const,
        scopeRef: "javascript",
      };

      const result = getLeaderboardSchema.parse(input);
      expect(result.scopeRef).toBe("javascript");
    });

    it("should accept MODEL scope with scopeRef", () => {
      const input = {
        period: "WEEKLY" as const,
        scope: "MODEL" as const,
        scopeRef: "gpt-4",
      };

      const result = getLeaderboardSchema.parse(input);
      expect(result.scopeRef).toBe("gpt-4");
    });

    it("should accept input without scopeRef", () => {
      const input = {
        period: "ALL" as const,
        scope: "GLOBAL" as const,
      };

      expect(() => getLeaderboardSchema.parse(input)).not.toThrow();
    });

    it("should accept custom cursor and limit", () => {
      const input = {
        period: "DAILY" as const,
        scope: "GLOBAL" as const,
        cursor: "custom_cursor_123",
        limit: 75,
      };

      const result = getLeaderboardSchema.parse(input);
      expect(result.cursor).toBe("custom_cursor_123");
      expect(result.limit).toBe(75);
    });

    it("should accept includeStats false", () => {
      const input = {
        period: "WEEKLY" as const,
        scope: "GLOBAL" as const,
        includeStats: false,
      };

      const result = getLeaderboardSchema.parse(input);
      expect(result.includeStats).toBe(false);
    });

    it("should validate limit constraints from paginationSchema", () => {
      // Test minimum limit
      const minLimitInput = {
        period: "DAILY" as const,
        scope: "GLOBAL" as const,
        limit: 1,
      };
      expect(() => getLeaderboardSchema.parse(minLimitInput)).not.toThrow();

      // Test maximum limit
      const maxLimitInput = {
        period: "DAILY" as const,
        scope: "GLOBAL" as const,
        limit: 100,
      };
      expect(() => getLeaderboardSchema.parse(maxLimitInput)).not.toThrow();

      // Test invalid limit (below minimum)
      const invalidMinInput = {
        period: "DAILY" as const,
        scope: "GLOBAL" as const,
        limit: 0,
      };
      expect(() => getLeaderboardSchema.parse(invalidMinInput)).toThrow();

      // Test invalid limit (above maximum)
      const invalidMaxInput = {
        period: "DAILY" as const,
        scope: "GLOBAL" as const,
        limit: 101,
      };
      expect(() => getLeaderboardSchema.parse(invalidMaxInput)).toThrow();
    });
  });

  describe("getUserRankSchema", () => {
    it("should accept valid user rank input", () => {
      const validInput = {
        userId: "user123",
        period: "WEEKLY" as const,
        scope: "TAG" as const,
        scopeRef: "react",
      };

      const result = getUserRankSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept input without userId", () => {
      const input = {
        period: "MONTHLY" as const,
        scope: "GLOBAL" as const,
      };

      const result = getUserRankSchema.parse(input);
      expect(result.userId).toBeUndefined();
      expect(result.period).toBe("MONTHLY");
      expect(result.scope).toBe("GLOBAL");
    });

    it("should accept input without scopeRef", () => {
      const input = {
        userId: "user456",
        period: "ALL" as const,
        scope: "GLOBAL" as const,
      };

      const result = getUserRankSchema.parse(input);
      expect(result.scopeRef).toBeUndefined();
    });

    it("should accept all valid period values", () => {
      const periods = ["DAILY", "WEEKLY", "MONTHLY", "ALL"] as const;

      periods.forEach((period) => {
        const input = {
          userId: "user123",
          period,
          scope: "GLOBAL" as const,
        };
        expect(() => getUserRankSchema.parse(input)).not.toThrow();
      });
    });

    it("should accept all valid scope values", () => {
      const scopes = ["GLOBAL", "TAG", "MODEL"] as const;

      scopes.forEach((scope) => {
        const input = {
          userId: "user123",
          period: "DAILY" as const,
          scope,
        };
        expect(() => getUserRankSchema.parse(input)).not.toThrow();
      });
    });

    it("should reject invalid period", () => {
      const invalidInput = {
        userId: "user123",
        period: "INVALID",
        scope: "GLOBAL" as const,
      };

      expect(() => getUserRankSchema.parse(invalidInput)).toThrow();
    });

    it("should reject invalid scope", () => {
      const invalidInput = {
        userId: "user123",
        period: "DAILY" as const,
        scope: "INVALID",
      };

      expect(() => getUserRankSchema.parse(invalidInput)).toThrow();
    });
  });

  describe("getLeaderboardHistorySchema", () => {
    it("should accept valid history input", () => {
      const validInput = {
        userId: "user123",
        period: "WEEKLY" as const,
        scope: "TAG" as const,
        scopeRef: "typescript",
        limit: 50,
      };

      const result = getLeaderboardHistorySchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should use default limit", () => {
      const input = {
        userId: "user123",
        period: "MONTHLY" as const,
        scope: "GLOBAL" as const,
      };

      const result = getLeaderboardHistorySchema.parse(input);
      expect(result.limit).toBe(30); // default value
    });

    it("should accept input without userId", () => {
      const input = {
        period: "DAILY" as const,
        scope: "MODEL" as const,
        scopeRef: "claude-3",
      };

      const result = getLeaderboardHistorySchema.parse(input);
      expect(result.userId).toBeUndefined();
    });

    it("should accept input without scopeRef", () => {
      const input = {
        userId: "user456",
        period: "ALL" as const,
        scope: "GLOBAL" as const,
        limit: 20,
      };

      const result = getLeaderboardHistorySchema.parse(input);
      expect(result.scopeRef).toBeUndefined();
    });

    it("should validate limit constraints", () => {
      // Test minimum limit
      const minLimitInput = {
        period: "DAILY" as const,
        scope: "GLOBAL" as const,
        limit: 1,
      };
      expect(() =>
        getLeaderboardHistorySchema.parse(minLimitInput)
      ).not.toThrow();

      // Test maximum limit
      const maxLimitInput = {
        period: "DAILY" as const,
        scope: "GLOBAL" as const,
        limit: 100,
      };
      expect(() =>
        getLeaderboardHistorySchema.parse(maxLimitInput)
      ).not.toThrow();

      // Test invalid limit (below minimum)
      const invalidMinInput = {
        period: "DAILY" as const,
        scope: "GLOBAL" as const,
        limit: 0,
      };
      expect(() =>
        getLeaderboardHistorySchema.parse(invalidMinInput)
      ).toThrow();

      // Test invalid limit (above maximum)
      const invalidMaxInput = {
        period: "DAILY" as const,
        scope: "GLOBAL" as const,
        limit: 101,
      };
      expect(() =>
        getLeaderboardHistorySchema.parse(invalidMaxInput)
      ).toThrow();
    });

    it("should reject non-integer limit", () => {
      const invalidInput = {
        period: "DAILY" as const,
        scope: "GLOBAL" as const,
        limit: 25.5,
      };

      expect(() => getLeaderboardHistorySchema.parse(invalidInput)).toThrow();
    });

    it("should accept all valid period and scope combinations", () => {
      const periods = ["DAILY", "WEEKLY", "MONTHLY", "ALL"] as const;
      const scopes = ["GLOBAL", "TAG", "MODEL"] as const;

      periods.forEach((period) => {
        scopes.forEach((scope) => {
          const input = {
            period,
            scope,
            limit: 15,
          };
          expect(() => getLeaderboardHistorySchema.parse(input)).not.toThrow();
        });
      });
    });
  });

  describe("generateSnapshotSchema", () => {
    it("should accept valid snapshot generation input", () => {
      const validInput = {
        period: "WEEKLY" as const,
        scope: "TAG" as const,
        scopeRef: "python",
        force: true,
      };

      const result = generateSnapshotSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should use default force value", () => {
      const input = {
        period: "MONTHLY" as const,
        scope: "GLOBAL" as const,
      };

      const result = generateSnapshotSchema.parse(input);
      expect(result.force).toBe(false); // default value
    });

    it("should accept input without scopeRef", () => {
      const input = {
        period: "ALL" as const,
        scope: "GLOBAL" as const,
        force: true,
      };

      const result = generateSnapshotSchema.parse(input);
      expect(result.scopeRef).toBeUndefined();
    });

    it("should accept force false", () => {
      const input = {
        period: "DAILY" as const,
        scope: "MODEL" as const,
        scopeRef: "gpt-3.5",
        force: false,
      };

      const result = generateSnapshotSchema.parse(input);
      expect(result.force).toBe(false);
    });

    it("should accept all valid period values", () => {
      const periods = ["DAILY", "WEEKLY", "MONTHLY", "ALL"] as const;

      periods.forEach((period) => {
        const input = {
          period,
          scope: "GLOBAL" as const,
        };
        expect(() => generateSnapshotSchema.parse(input)).not.toThrow();
      });
    });

    it("should accept all valid scope values", () => {
      const scopes = ["GLOBAL", "TAG", "MODEL"] as const;

      scopes.forEach((scope) => {
        const input = {
          period: "WEEKLY" as const,
          scope,
        };
        expect(() => generateSnapshotSchema.parse(input)).not.toThrow();
      });
    });

    it("should reject invalid period", () => {
      const invalidInput = {
        period: "INVALID",
        scope: "GLOBAL" as const,
      };

      expect(() => generateSnapshotSchema.parse(invalidInput)).toThrow();
    });

    it("should reject invalid scope", () => {
      const invalidInput = {
        period: "DAILY" as const,
        scope: "INVALID",
      };

      expect(() => generateSnapshotSchema.parse(invalidInput)).toThrow();
    });

    it("should handle TAG scope with specific scopeRef", () => {
      const input = {
        period: "MONTHLY" as const,
        scope: "TAG" as const,
        scopeRef: "machine-learning",
        force: true,
      };

      const result = generateSnapshotSchema.parse(input);
      expect(result.scope).toBe("TAG");
      expect(result.scopeRef).toBe("machine-learning");
    });

    it("should handle MODEL scope with specific scopeRef", () => {
      const input = {
        period: "WEEKLY" as const,
        scope: "MODEL" as const,
        scopeRef: "claude-3-opus",
        force: false,
      };

      const result = generateSnapshotSchema.parse(input);
      expect(result.scope).toBe("MODEL");
      expect(result.scopeRef).toBe("claude-3-opus");
    });
  });

  describe("getAvailableScopesSchema", () => {
    it("should accept valid available scopes input", () => {
      const validInput = {
        period: "WEEKLY" as const,
      };

      const result = getAvailableScopesSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept all valid period values", () => {
      const periods = ["DAILY", "WEEKLY", "MONTHLY", "ALL"] as const;

      periods.forEach((period) => {
        const input = { period };
        const result = getAvailableScopesSchema.parse(input);
        expect(result.period).toBe(period);
      });
    });

    it("should reject invalid period", () => {
      const invalidInput = {
        period: "INVALID",
      };

      expect(() => getAvailableScopesSchema.parse(invalidInput)).toThrow();
    });

    it("should require period field", () => {
      const emptyInput = {};

      expect(() => getAvailableScopesSchema.parse(emptyInput)).toThrow();
    });
  });

  describe("Type Exports", () => {
    it("should export all input types", () => {
      // Test that types are properly exported by creating variables of each type
      const getLeaderboardInput: GetLeaderboardInput = {
        period: "DAILY",
        scope: "GLOBAL",
      };

      const getUserRankInput: GetUserRankInput = {
        period: "WEEKLY",
        scope: "TAG",
      };

      const getLeaderboardHistoryInput: GetLeaderboardHistoryInput = {
        period: "MONTHLY",
        scope: "MODEL",
      };

      const generateSnapshotInput: GenerateSnapshotInput = {
        period: "ALL",
        scope: "GLOBAL",
      };

      const getAvailableScopesInput: GetAvailableScopesInput = {
        period: "DAILY",
      };

      expect(getLeaderboardInput).toBeDefined();
      expect(getUserRankInput).toBeDefined();
      expect(getLeaderboardHistoryInput).toBeDefined();
      expect(generateSnapshotInput).toBeDefined();
      expect(getAvailableScopesInput).toBeDefined();
    });
  });

  describe("Edge Cases and Integration", () => {
    it("should handle complex leaderboard query with all options", () => {
      const complexInput = {
        period: "MONTHLY" as const,
        scope: "TAG" as const,
        scopeRef: "artificial-intelligence",
        cursor: "eyJpZCI6IjEyMyIsInNjb3JlIjo5NS41fQ==", // Base64 encoded cursor
        limit: 75,
        includeStats: true,
      };

      expect(() => getLeaderboardSchema.parse(complexInput)).not.toThrow();
    });

    it("should handle user rank query for specific user and scope", () => {
      const specificUserInput = {
        userId: "cuid_user_12345",
        period: "WEEKLY" as const,
        scope: "MODEL" as const,
        scopeRef: "gpt-4-turbo",
      };

      expect(() => getUserRankSchema.parse(specificUserInput)).not.toThrow();
    });

    it("should handle history query with maximum limit", () => {
      const maxHistoryInput = {
        userId: "user_with_long_history",
        period: "ALL" as const,
        scope: "GLOBAL" as const,
        limit: 100, // Maximum allowed
      };

      expect(() =>
        getLeaderboardHistorySchema.parse(maxHistoryInput)
      ).not.toThrow();
    });

    it("should handle snapshot generation for all combinations", () => {
      const periods = ["DAILY", "WEEKLY", "MONTHLY", "ALL"] as const;
      const scopes = ["GLOBAL", "TAG", "MODEL"] as const;

      periods.forEach((period) => {
        scopes.forEach((scope) => {
          const input = {
            period,
            scope,
            force: Math.random() > 0.5, // Random boolean
          };

          if (scope !== "GLOBAL") {
            // Add scopeRef for non-global scopes
            (input as any).scopeRef =
              scope === "TAG" ? "test-tag" : "test-model";
          }

          expect(() => generateSnapshotSchema.parse(input)).not.toThrow();
        });
      });
    });

    it("should handle boundary values for limits", () => {
      // Test leaderboard schema with boundary limits
      const minLeaderboardInput = {
        period: "DAILY" as const,
        scope: "GLOBAL" as const,
        limit: 1,
      };
      expect(() =>
        getLeaderboardSchema.parse(minLeaderboardInput)
      ).not.toThrow();

      const maxLeaderboardInput = {
        period: "DAILY" as const,
        scope: "GLOBAL" as const,
        limit: 100,
      };
      expect(() =>
        getLeaderboardSchema.parse(maxLeaderboardInput)
      ).not.toThrow();

      // Test history schema with boundary limits
      const minHistoryInput = {
        period: "DAILY" as const,
        scope: "GLOBAL" as const,
        limit: 1,
      };
      expect(() =>
        getLeaderboardHistorySchema.parse(minHistoryInput)
      ).not.toThrow();

      const maxHistoryInput = {
        period: "DAILY" as const,
        scope: "GLOBAL" as const,
        limit: 100,
      };
      expect(() =>
        getLeaderboardHistorySchema.parse(maxHistoryInput)
      ).not.toThrow();
    });

    it("should handle long scopeRef values", () => {
      const longScopeRef = "very-long-tag-name-that-might-be-used-in-practice";

      const inputWithLongScopeRef = {
        period: "WEEKLY" as const,
        scope: "TAG" as const,
        scopeRef: longScopeRef,
      };

      expect(() =>
        getLeaderboardSchema.parse(inputWithLongScopeRef)
      ).not.toThrow();
      expect(() =>
        getUserRankSchema.parse(inputWithLongScopeRef)
      ).not.toThrow();
      expect(() =>
        getLeaderboardHistorySchema.parse(inputWithLongScopeRef)
      ).not.toThrow();
      expect(() =>
        generateSnapshotSchema.parse(inputWithLongScopeRef)
      ).not.toThrow();
    });

    it("should handle empty string scopeRef", () => {
      const inputWithEmptyScopeRef = {
        period: "DAILY" as const,
        scope: "TAG" as const,
        scopeRef: "",
      };

      // Empty string should be accepted as it's still a valid string
      expect(() =>
        getLeaderboardSchema.parse(inputWithEmptyScopeRef)
      ).not.toThrow();
    });

    it("should validate that all schemas use consistent period and scope enums", () => {
      const testPeriod = "WEEKLY" as const;
      const testScope = "TAG" as const;

      // All schemas should accept the same period and scope values
      const baseInput = { period: testPeriod, scope: testScope };

      expect(() => getLeaderboardSchema.parse(baseInput)).not.toThrow();
      expect(() => getUserRankSchema.parse(baseInput)).not.toThrow();
      expect(() => getLeaderboardHistorySchema.parse(baseInput)).not.toThrow();
      expect(() => generateSnapshotSchema.parse(baseInput)).not.toThrow();

      // Available scopes schema only needs period
      expect(() =>
        getAvailableScopesSchema.parse({ period: testPeriod })
      ).not.toThrow();
    });
  });
});
