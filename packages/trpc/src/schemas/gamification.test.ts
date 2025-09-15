import { describe, it, expect } from "vitest";
import {
  leaderboardGetInputSchema,
  badgesListInputSchema,
  badgesAllInputSchema,
  badgesRecheckInputSchema,
  leaderboardEntrySchema,
  leaderboardResponseSchema,
  badgeSchema,
  userBadgesResponseSchema,
  badgeCatalogResponseSchema,
  badgesRecheckResponseSchema,
  type LeaderboardGetInput,
  type BadgesListInput,
  type BadgesAllInput,
  type BadgesRecheckInput,
  type LeaderboardEntry,
  type LeaderboardResponse,
  type Badge,
  type UserBadgesResponse,
  type BadgeCatalogResponse,
  type BadgesRecheckResponse,
} from "./gamification";

describe("Gamification Schemas", () => {
  describe("leaderboardGetInputSchema", () => {
    it("should accept valid leaderboard input", () => {
      const validInput = {
        period: "WEEKLY" as const,
        scope: "GLOBAL" as const,
        scopeRef: "javascript",
        cursor: "cursor123",
        limit: 50,
      };

      const result = leaderboardGetInputSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should use default values for optional fields", () => {
      const minimalInput = {
        period: "DAILY" as const,
      };

      const result = leaderboardGetInputSchema.parse(minimalInput);
      expect(result).toEqual({
        period: "DAILY",
        scope: "GLOBAL",
        limit: 25,
      });
    });

    it("should accept all valid period values", () => {
      const periods = ["DAILY", "WEEKLY", "MONTHLY", "ALL"] as const;

      periods.forEach((period) => {
        const input = { period };
        expect(() => leaderboardGetInputSchema.parse(input)).not.toThrow();
      });
    });

    it("should accept all valid scope values", () => {
      const scopes = ["GLOBAL", "TAG", "MODEL"] as const;

      scopes.forEach((scope) => {
        const input = { period: "DAILY" as const, scope };
        expect(() => leaderboardGetInputSchema.parse(input)).not.toThrow();
      });
    });

    it("should reject invalid period values", () => {
      const invalidInput = {
        period: "INVALID",
      };

      expect(() => leaderboardGetInputSchema.parse(invalidInput)).toThrow();
    });

    it("should reject invalid scope values", () => {
      const invalidInput = {
        period: "DAILY" as const,
        scope: "INVALID",
      };

      expect(() => leaderboardGetInputSchema.parse(invalidInput)).toThrow();
    });

    it("should accept input without optional fields", () => {
      const input = {
        period: "MONTHLY" as const,
        scope: "TAG" as const,
      };

      const result = leaderboardGetInputSchema.parse(input);
      expect(result.period).toBe("MONTHLY");
      expect(result.scope).toBe("TAG");
      expect(result.limit).toBe(25); // default value
    });
  });

  describe("badgesListInputSchema", () => {
    it("should accept valid badges list input", () => {
      const validInput = {
        userId: "user123",
      };

      const result = badgesListInputSchema.parse(validInput);
      expect(result).toEqual(validInput);
    });

    it("should accept empty input", () => {
      const emptyInput = {};

      const result = badgesListInputSchema.parse(emptyInput);
      expect(result).toEqual({});
    });

    it("should accept input without userId", () => {
      const input = {};

      expect(() => badgesListInputSchema.parse(input)).not.toThrow();
    });
  });

  describe("badgesAllInputSchema", () => {
    it("should accept empty input", () => {
      const emptyInput = {};

      const result = badgesAllInputSchema.parse(emptyInput);
      expect(result).toEqual({});
    });
  });

  describe("badgesRecheckInputSchema", () => {
    it("should accept empty input", () => {
      const emptyInput = {};

      const result = badgesRecheckInputSchema.parse(emptyInput);
      expect(result).toEqual({});
    });
  });

  describe("leaderboardEntrySchema", () => {
    it("should accept valid leaderboard entry", () => {
      const validEntry = {
        rank: 1,
        ruleId: "rule123",
        ruleSlug: "awesome-rule",
        title: "Awesome Rule",
        author: {
          id: "user123",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: "https://example.com/avatar.jpg",
        },
        score: 95.5,
        copies: 100,
        views: 1000,
        saves: 50,
        forks: 25,
        votes: 75,
        rankDelta: 2,
      };

      const result = leaderboardEntrySchema.parse(validEntry);
      expect(result).toEqual(validEntry);
    });

    it("should accept entry without optional fields", () => {
      const minimalEntry = {
        rank: 5,
        ruleId: "rule456",
        ruleSlug: "simple-rule",
        title: "Simple Rule",
        author: {
          id: "user456",
          handle: "janedoe",
          displayName: "Jane Doe",
          avatarUrl: null,
        },
        score: 80.0,
        copies: 50,
        views: 500,
      };

      const result = leaderboardEntrySchema.parse(minimalEntry);
      expect(result).toEqual(minimalEntry);
    });

    it("should accept null avatarUrl", () => {
      const entry = {
        rank: 3,
        ruleId: "rule789",
        ruleSlug: "test-rule",
        title: "Test Rule",
        author: {
          id: "user789",
          handle: "testuser",
          displayName: "Test User",
          avatarUrl: null,
        },
        score: 70.0,
        copies: 30,
        views: 300,
      };

      expect(() => leaderboardEntrySchema.parse(entry)).not.toThrow();
    });

    it("should accept null rankDelta", () => {
      const entry = {
        rank: 10,
        ruleId: "rule999",
        ruleSlug: "new-rule",
        title: "New Rule",
        author: {
          id: "user999",
          handle: "newuser",
          displayName: "New User",
          avatarUrl: "https://example.com/new.jpg",
        },
        score: 60.0,
        copies: 20,
        views: 200,
        rankDelta: null,
      };

      expect(() => leaderboardEntrySchema.parse(entry)).not.toThrow();
    });

    it("should reject zero or negative rank", () => {
      const invalidEntry = {
        rank: 0,
        ruleId: "rule123",
        ruleSlug: "test-rule",
        title: "Test Rule",
        author: {
          id: "user123",
          handle: "testuser",
          displayName: "Test User",
          avatarUrl: null,
        },
        score: 50.0,
        copies: 10,
        views: 100,
      };

      expect(() => leaderboardEntrySchema.parse(invalidEntry)).toThrow();
    });

    it("should accept negative integer values", () => {
      const entryWithNegatives = {
        rank: 1,
        ruleId: "rule123",
        ruleSlug: "test-rule",
        title: "Test Rule",
        author: {
          id: "user123",
          handle: "testuser",
          displayName: "Test User",
          avatarUrl: null,
        },
        score: 50.0,
        copies: -10, // negative values are allowed
        views: -5,
        saves: -1,
        forks: -2,
        votes: -3,
        rankDelta: -5,
      };

      expect(() =>
        leaderboardEntrySchema.parse(entryWithNegatives)
      ).not.toThrow();
    });
  });

  describe("leaderboardResponseSchema", () => {
    it("should accept valid leaderboard response", () => {
      const validResponse = {
        entries: [
          {
            rank: 1,
            ruleId: "rule123",
            ruleSlug: "top-rule",
            title: "Top Rule",
            author: {
              id: "user123",
              handle: "topuser",
              displayName: "Top User",
              avatarUrl: "https://example.com/top.jpg",
            },
            score: 100.0,
            copies: 200,
            views: 2000,
          },
        ],
        meta: {
          period: "WEEKLY" as const,
          scope: "GLOBAL" as const,
          scopeRef: null,
          windowDays: 7,
          generatedAt: "2024-01-15T10:00:00Z",
          totalEntries: 100,
        },
        pagination: {
          hasMore: true,
          nextCursor: "cursor456",
        },
      };

      const result = leaderboardResponseSchema.parse(validResponse);
      expect(result).toEqual(validResponse);
    });

    it("should accept response without nextCursor", () => {
      const response = {
        entries: [],
        meta: {
          period: "DAILY" as const,
          scope: "TAG" as const,
          scopeRef: "javascript",
          windowDays: 1,
          generatedAt: "2024-01-15T10:00:00Z",
          totalEntries: 0,
        },
        pagination: {
          hasMore: false,
        },
      };

      expect(() => leaderboardResponseSchema.parse(response)).not.toThrow();
    });

    it("should accept all valid period values in meta", () => {
      const periods = ["DAILY", "WEEKLY", "MONTHLY", "ALL"] as const;

      periods.forEach((period) => {
        const response = {
          entries: [],
          meta: {
            period,
            scope: "GLOBAL" as const,
            scopeRef: null,
            windowDays: 7,
            generatedAt: "2024-01-15T10:00:00Z",
            totalEntries: 0,
          },
          pagination: {
            hasMore: false,
          },
        };
        expect(() => leaderboardResponseSchema.parse(response)).not.toThrow();
      });
    });

    it("should accept all valid scope values in meta", () => {
      const scopes = ["GLOBAL", "TAG", "MODEL"] as const;

      scopes.forEach((scope) => {
        const response = {
          entries: [],
          meta: {
            period: "DAILY" as const,
            scope,
            scopeRef: null,
            windowDays: 1,
            generatedAt: "2024-01-15T10:00:00Z",
            totalEntries: 0,
          },
          pagination: {
            hasMore: false,
          },
        };
        expect(() => leaderboardResponseSchema.parse(response)).not.toThrow();
      });
    });
  });

  describe("badgeSchema", () => {
    it("should accept valid badge", () => {
      const validBadge = {
        slug: "first-rule",
        name: "First Rule",
        description: "Created your first rule",
        criteria: {
          rulesCreated: 1,
        },
        awardedAt: new Date("2024-01-15T10:00:00Z"),
      };

      const result = badgeSchema.parse(validBadge);
      expect(result).toEqual(validBadge);
    });

    it("should accept badge without awardedAt", () => {
      const badge = {
        slug: "prolific-author",
        name: "Prolific Author",
        description: "Created 100 rules",
        criteria: {
          rulesCreated: 100,
        },
      };

      const result = badgeSchema.parse(badge);
      expect(result).toEqual(badge);
    });

    it("should accept complex criteria object", () => {
      const badge = {
        slug: "community-favorite",
        name: "Community Favorite",
        description: "Rule received 1000 upvotes",
        criteria: {
          upvotes: 1000,
          timeframe: "all-time",
          ruleTypes: ["PROMPT", "RULE"],
        },
      };

      expect(() => badgeSchema.parse(badge)).not.toThrow();
    });
  });

  describe("userBadgesResponseSchema", () => {
    it("should accept valid user badges response", () => {
      const validResponse = {
        badges: [
          {
            slug: "first-rule",
            name: "First Rule",
            description: "Created your first rule",
            criteria: { rulesCreated: 1 },
            awardedAt: new Date("2024-01-15T10:00:00Z"),
          },
          {
            slug: "early-adopter",
            name: "Early Adopter",
            description: "Joined in the first month",
            criteria: { joinedBefore: "2024-02-01" },
          },
        ],
        totalCount: 2,
      };

      const result = userBadgesResponseSchema.parse(validResponse);
      expect(result).toEqual(validResponse);
    });

    it("should accept empty badges array", () => {
      const response = {
        badges: [],
        totalCount: 0,
      };

      const result = userBadgesResponseSchema.parse(response);
      expect(result).toEqual(response);
    });
  });

  describe("badgeCatalogResponseSchema", () => {
    it("should accept valid badge catalog response", () => {
      const validResponse = {
        badges: [
          {
            slug: "first-rule",
            name: "First Rule",
            description: "Created your first rule",
            criteria: { rulesCreated: 1 },
          },
          {
            slug: "top-contributor",
            name: "Top Contributor",
            description: "In top 10 contributors this month",
            criteria: { monthlyRank: { lte: 10 } },
          },
        ],
      };

      const result = badgeCatalogResponseSchema.parse(validResponse);
      expect(result).toEqual(validResponse);
    });

    it("should accept empty badges array", () => {
      const response = {
        badges: [],
      };

      const result = badgeCatalogResponseSchema.parse(response);
      expect(result).toEqual(response);
    });

    it("should not include awardedAt in catalog badges", () => {
      const response = {
        badges: [
          {
            slug: "test-badge",
            name: "Test Badge",
            description: "Test description",
            criteria: {},
            // awardedAt should not be present in catalog
          },
        ],
      };

      expect(() => badgeCatalogResponseSchema.parse(response)).not.toThrow();
    });
  });

  describe("badgesRecheckResponseSchema", () => {
    it("should accept valid recheck response", () => {
      const validResponse = {
        awarded: 3,
        message: "Awarded 3 new badges",
      };

      const result = badgesRecheckResponseSchema.parse(validResponse);
      expect(result).toEqual(validResponse);
    });

    it("should accept zero awarded badges", () => {
      const response = {
        awarded: 0,
        message: "No new badges awarded",
      };

      const result = badgesRecheckResponseSchema.parse(response);
      expect(result).toEqual(response);
    });

    it("should accept negative awarded count", () => {
      const responseWithNegative = {
        awarded: -1,
        message: "Negative count is allowed",
      };

      expect(() =>
        badgesRecheckResponseSchema.parse(responseWithNegative)
      ).not.toThrow();
    });
  });

  describe("Type Exports", () => {
    it("should export all input types", () => {
      // Test that types are properly exported by creating variables of each type
      const leaderboardInput: LeaderboardGetInput = {
        period: "DAILY",
        scope: "GLOBAL",
        limit: 25,
      };

      const badgesListInput: BadgesListInput = {};
      const badgesAllInput: BadgesAllInput = {};
      const badgesRecheckInput: BadgesRecheckInput = {};

      expect(leaderboardInput).toBeDefined();
      expect(badgesListInput).toBeDefined();
      expect(badgesAllInput).toBeDefined();
      expect(badgesRecheckInput).toBeDefined();
    });

    it("should export all response types", () => {
      // Test that types are properly exported by creating variables of each type
      const leaderboardEntry: LeaderboardEntry = {
        rank: 1,
        ruleId: "rule123",
        ruleSlug: "test-rule",
        title: "Test Rule",
        author: {
          id: "user123",
          handle: "testuser",
          displayName: "Test User",
          avatarUrl: null,
        },
        score: 100,
        copies: 50,
        views: 500,
      };

      const leaderboardResponse: LeaderboardResponse = {
        entries: [leaderboardEntry],
        meta: {
          period: "DAILY",
          scope: "GLOBAL",
          scopeRef: null,
          windowDays: 1,
          generatedAt: "2024-01-15T10:00:00Z",
          totalEntries: 1,
        },
        pagination: {
          hasMore: false,
        },
      };

      const badge: Badge = {
        slug: "test-badge",
        name: "Test Badge",
        description: "Test description",
        criteria: {},
      };

      const userBadgesResponse: UserBadgesResponse = {
        badges: [badge],
        totalCount: 1,
      };

      const badgeCatalogResponse: BadgeCatalogResponse = {
        badges: [
          {
            slug: "test-badge",
            name: "Test Badge",
            description: "Test description",
            criteria: {},
          },
        ],
      };

      const badgesRecheckResponse: BadgesRecheckResponse = {
        awarded: 1,
        message: "Awarded 1 badge",
      };

      expect(leaderboardEntry).toBeDefined();
      expect(leaderboardResponse).toBeDefined();
      expect(badge).toBeDefined();
      expect(userBadgesResponse).toBeDefined();
      expect(badgeCatalogResponse).toBeDefined();
      expect(badgesRecheckResponse).toBeDefined();
    });
  });

  describe("Edge Cases and Integration", () => {
    it("should handle large numbers in leaderboard entries", () => {
      const entryWithLargeNumbers = {
        rank: 999999,
        ruleId: "rule-large",
        ruleSlug: "large-numbers-rule",
        title: "Large Numbers Rule",
        author: {
          id: "user-large",
          handle: "largeuser",
          displayName: "Large User",
          avatarUrl: null,
        },
        score: 999999.99,
        copies: 999999,
        views: 999999,
        saves: 999999,
        forks: 999999,
        votes: 999999,
        rankDelta: -999999,
      };

      expect(() =>
        leaderboardEntrySchema.parse(entryWithLargeNumbers)
      ).not.toThrow();
    });

    it("should handle complex nested criteria in badges", () => {
      const complexBadge = {
        slug: "complex-badge",
        name: "Complex Badge",
        description: "A badge with complex criteria",
        criteria: {
          rules: {
            created: { gte: 10 },
            types: ["PROMPT", "RULE"],
            tags: ["javascript", "python"],
          },
          engagement: {
            totalViews: { gte: 10000 },
            avgScore: { gte: 4.5 },
          },
          timeframe: {
            start: "2024-01-01",
            end: "2024-12-31",
          },
        },
      };

      expect(() => badgeSchema.parse(complexBadge)).not.toThrow();
    });

    it("should handle boundary values", () => {
      // Test minimum valid rank
      const minRankEntry = {
        rank: 1,
        ruleId: "rule-min",
        ruleSlug: "min-rule",
        title: "Min Rule",
        author: {
          id: "user-min",
          handle: "minuser",
          displayName: "Min User",
          avatarUrl: null,
        },
        score: 0,
        copies: 0,
        views: 0,
      };

      expect(() => leaderboardEntrySchema.parse(minRankEntry)).not.toThrow();

      // Test zero awarded badges
      const zeroAwardedResponse = {
        awarded: 0,
        message: "No badges awarded",
      };

      expect(() =>
        badgesRecheckResponseSchema.parse(zeroAwardedResponse)
      ).not.toThrow();
    });

    it("should validate leaderboard response with multiple entries", () => {
      const multiEntryResponse = {
        entries: [
          {
            rank: 1,
            ruleId: "rule1",
            ruleSlug: "first-rule",
            title: "First Rule",
            author: {
              id: "user1",
              handle: "user1",
              displayName: "User One",
              avatarUrl: "https://example.com/user1.jpg",
            },
            score: 100,
            copies: 200,
            views: 2000,
            rankDelta: 0,
          },
          {
            rank: 2,
            ruleId: "rule2",
            ruleSlug: "second-rule",
            title: "Second Rule",
            author: {
              id: "user2",
              handle: "user2",
              displayName: "User Two",
              avatarUrl: null,
            },
            score: 95,
            copies: 180,
            views: 1800,
            rankDelta: 1,
          },
        ],
        meta: {
          period: "MONTHLY" as const,
          scope: "TAG" as const,
          scopeRef: "javascript",
          windowDays: 30,
          generatedAt: "2024-01-15T10:00:00Z",
          totalEntries: 2,
        },
        pagination: {
          hasMore: false,
        },
      };

      expect(() =>
        leaderboardResponseSchema.parse(multiEntryResponse)
      ).not.toThrow();
    });
  });
});
