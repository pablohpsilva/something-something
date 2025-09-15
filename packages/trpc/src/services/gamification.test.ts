import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  GamificationService,
  BadgeCatalog,
  type AwardContext,
  type LeaderboardEntry,
  type LeaderboardParams,
} from "../gamification";

// Mock the prisma client
vi.mock("@repo/db", () => ({
  prisma: {
    badge: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    userBadge: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    rule: {
      count: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    vote: {
      count: vi.fn(),
    },
    ruleMetricDaily: {
      aggregate: vi.fn(),
    },
    leaderboardSnapshot: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Get the mocked prisma instance
const { prisma } = await import("@repo/db");
const mockPrisma = prisma as any;

describe("GamificationService", () => {
  let mockContext: AwardContext;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods to avoid noise in test output
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    mockContext = {
      prisma: mockPrisma,
      now: new Date("2024-01-15T12:00:00Z"),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("BadgeCatalog", () => {
    it("should contain all expected badges", () => {
      expect(BadgeCatalog).toHaveLength(6);
      
      const slugs = BadgeCatalog.map(badge => badge.slug);
      expect(slugs).toEqual([
        "first-contribution",
        "ten-upvotes",
        "hundred-copies",
        "verified-author",
        "top-10-week",
        "streak-7",
      ]);
    });

    it("should have proper badge structure", () => {
      const firstBadge = BadgeCatalog[0];
      expect(firstBadge).toEqual({
        slug: "first-contribution",
        name: "First Contribution",
        description: "Published your first rule",
        criteria: { type: "event", name: "rule.published" },
      });
    });
  });

  describe("seedBadgeCatalog", () => {
    it("should seed all badges when none exist", async () => {
      mockPrisma.badge.findUnique.mockResolvedValue(null);
      mockPrisma.badge.create.mockResolvedValue({});

      const result = await GamificationService.seedBadgeCatalog(mockContext);

      expect(result).toBe(6);
      expect(mockPrisma.badge.findUnique).toHaveBeenCalledTimes(6);
      expect(mockPrisma.badge.create).toHaveBeenCalledTimes(6);

      // Verify first badge creation
      expect(mockPrisma.badge.create).toHaveBeenCalledWith({
        data: {
          slug: "first-contribution",
          name: "First Contribution",
          description: "Published your first rule",
          criteria: { type: "event", name: "rule.published" },
        },
      });
    });

    it("should skip existing badges", async () => {
      // Mock some badges as existing
      mockPrisma.badge.findUnique
        .mockResolvedValueOnce({ id: "badge-1" }) // first-contribution exists
        .mockResolvedValueOnce(null) // ten-upvotes doesn't exist
        .mockResolvedValueOnce({ id: "badge-3" }) // hundred-copies exists
        .mockResolvedValueOnce(null) // verified-author doesn't exist
        .mockResolvedValueOnce(null) // top-10-week doesn't exist
        .mockResolvedValueOnce({ id: "badge-6" }); // streak-7 exists

      mockPrisma.badge.create.mockResolvedValue({});

      const result = await GamificationService.seedBadgeCatalog(mockContext);

      expect(result).toBe(3); // Only 3 new badges created
      expect(mockPrisma.badge.create).toHaveBeenCalledTimes(3);
    });

    it("should be idempotent when all badges exist", async () => {
      mockPrisma.badge.findUnique.mockResolvedValue({ id: "existing-badge" });

      const result = await GamificationService.seedBadgeCatalog(mockContext);

      expect(result).toBe(0);
      expect(mockPrisma.badge.create).not.toHaveBeenCalled();
    });
  });

  describe("awardBadgeIfEligible", () => {
    it("should award badge successfully", async () => {
      const badge = { id: "badge-123", slug: "test-badge" };
      mockPrisma.badge.findUnique.mockResolvedValue(badge);
      mockPrisma.userBadge.findUnique.mockResolvedValue(null); // Not already awarded
      mockPrisma.userBadge.create.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await GamificationService.awardBadgeIfEligible(
        mockContext,
        "user-123",
        "test-badge",
        { reason: "test" }
      );

      expect(result).toBe(true);
      expect(mockPrisma.userBadge.create).toHaveBeenCalledWith({
        data: {
          userId: "user-123",
          badgeId: "badge-123",
          awardedAt: mockContext.now,
        },
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: "badge.award",
          targetType: "Badge",
          targetId: "badge-123",
          actorId: "user-123",
          metadata: {
            badgeSlug: "test-badge",
            userId: "user-123",
            badgeMetadata: { reason: "test" },
          },
        },
      });
    });

    it("should return false if badge not found", async () => {
      mockPrisma.badge.findUnique.mockResolvedValue(null);

      const result = await GamificationService.awardBadgeIfEligible(
        mockContext,
        "user-123",
        "nonexistent-badge"
      );

      expect(result).toBe(false);
      expect(console.warn).toHaveBeenCalledWith("Badge not found: nonexistent-badge");
      expect(mockPrisma.userBadge.create).not.toHaveBeenCalled();
    });

    it("should return false if badge already awarded", async () => {
      const badge = { id: "badge-123", slug: "test-badge" };
      mockPrisma.badge.findUnique.mockResolvedValue(badge);
      mockPrisma.userBadge.findUnique.mockResolvedValue({ id: "existing-award" });

      const result = await GamificationService.awardBadgeIfEligible(
        mockContext,
        "user-123",
        "test-badge"
      );

      expect(result).toBe(false);
      expect(mockPrisma.userBadge.create).not.toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      const badge = { id: "badge-123", slug: "test-badge" };
      mockPrisma.badge.findUnique.mockResolvedValue(badge);
      mockPrisma.userBadge.findUnique.mockResolvedValue(null);
      mockPrisma.userBadge.create.mockRejectedValue(new Error("Database error"));

      const result = await GamificationService.awardBadgeIfEligible(
        mockContext,
        "user-123",
        "test-badge"
      );

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        "Failed to award badge test-badge to user user-123:",
        expect.any(Error)
      );
    });

    it("should award badge without metadata", async () => {
      const badge = { id: "badge-123", slug: "test-badge" };
      mockPrisma.badge.findUnique.mockResolvedValue(badge);
      mockPrisma.userBadge.findUnique.mockResolvedValue(null);
      mockPrisma.userBadge.create.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await GamificationService.awardBadgeIfEligible(
        mockContext,
        "user-123",
        "test-badge"
      );

      expect(result).toBe(true);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: "badge.award",
          targetType: "Badge",
          targetId: "badge-123",
          actorId: "user-123",
          metadata: {
            badgeSlug: "test-badge",
            userId: "user-123",
            badgeMetadata: {},
          },
        },
      });
    });
  });

  describe("checkFirstContribution", () => {
    it("should award badge for first published rule", async () => {
      mockPrisma.rule.count.mockResolvedValue(1);
      
      // Mock the awardBadgeIfEligible method
      const awardSpy = vi.spyOn(GamificationService, "awardBadgeIfEligible").mockResolvedValue(true);

      const result = await GamificationService.checkFirstContribution(
        mockContext,
        "user-123"
      );

      expect(result).toBe(true);
      expect(mockPrisma.rule.count).toHaveBeenCalledWith({
        where: {
          createdByUserId: "user-123",
          status: "PUBLISHED",
        },
      });
      expect(awardSpy).toHaveBeenCalledWith(mockContext, "user-123", "first-contribution");
    });

    it("should not award badge if not first rule", async () => {
      mockPrisma.rule.count.mockResolvedValue(2);
      
      const awardSpy = vi.spyOn(GamificationService, "awardBadgeIfEligible");

      const result = await GamificationService.checkFirstContribution(
        mockContext,
        "user-123"
      );

      expect(result).toBe(false);
      expect(awardSpy).not.toHaveBeenCalled();
    });

    it("should not award badge if no published rules", async () => {
      mockPrisma.rule.count.mockResolvedValue(0);
      
      const awardSpy = vi.spyOn(GamificationService, "awardBadgeIfEligible");

      const result = await GamificationService.checkFirstContribution(
        mockContext,
        "user-123"
      );

      expect(result).toBe(false);
      expect(awardSpy).not.toHaveBeenCalled();
    });
  });

  describe("checkTenUpvotes", () => {
    it("should award badge when rule has 10+ net upvotes", async () => {
      const rule = {
        createdByUserId: "user-123",
        _count: { votes: 15 }, // 15 upvotes
      };
      mockPrisma.rule.findUnique.mockResolvedValue(rule);
      mockPrisma.vote.count.mockResolvedValue(3); // 3 downvotes
      
      const awardSpy = vi.spyOn(GamificationService, "awardBadgeIfEligible").mockResolvedValue(true);

      const result = await GamificationService.checkTenUpvotes(
        mockContext,
        "rule-123"
      );

      expect(result).toBe(true);
      expect(mockPrisma.rule.findUnique).toHaveBeenCalledWith({
        where: { id: "rule-123" },
        select: {
          createdByUserId: true,
          _count: {
            select: {
              votes: {
                where: { value: 1 },
              },
            },
          },
        },
      });
      expect(mockPrisma.vote.count).toHaveBeenCalledWith({
        where: { ruleId: "rule-123", value: -1 },
      });
      expect(awardSpy).toHaveBeenCalledWith(
        mockContext,
        "user-123",
        "ten-upvotes",
        { ruleId: "rule-123", netScore: 12 }
      );
    });

    it("should not award badge when net score is below 10", async () => {
      const rule = {
        createdByUserId: "user-123",
        _count: { votes: 8 }, // 8 upvotes
      };
      mockPrisma.rule.findUnique.mockResolvedValue(rule);
      mockPrisma.vote.count.mockResolvedValue(2); // 2 downvotes, net = 6

      const awardSpy = vi.spyOn(GamificationService, "awardBadgeIfEligible");

      const result = await GamificationService.checkTenUpvotes(
        mockContext,
        "rule-123"
      );

      expect(result).toBe(false);
      expect(awardSpy).not.toHaveBeenCalled();
    });

    it("should return false if rule not found", async () => {
      mockPrisma.rule.findUnique.mockResolvedValue(null);

      const result = await GamificationService.checkTenUpvotes(
        mockContext,
        "nonexistent-rule"
      );

      expect(result).toBe(false);
    });

    it("should handle exactly 10 net upvotes", async () => {
      const rule = {
        createdByUserId: "user-123",
        _count: { votes: 12 }, // 12 upvotes
      };
      mockPrisma.rule.findUnique.mockResolvedValue(rule);
      mockPrisma.vote.count.mockResolvedValue(2); // 2 downvotes, net = 10

      const awardSpy = vi.spyOn(GamificationService, "awardBadgeIfEligible").mockResolvedValue(true);

      const result = await GamificationService.checkTenUpvotes(
        mockContext,
        "rule-123"
      );

      expect(result).toBe(true);
      expect(awardSpy).toHaveBeenCalledWith(
        mockContext,
        "user-123",
        "ten-upvotes",
        { ruleId: "rule-123", netScore: 10 }
      );
    });
  });

  describe("checkHundredCopies", () => {
    it("should award badge when rule has 100+ copies", async () => {
      mockPrisma.ruleMetricDaily.aggregate.mockResolvedValue({
        _sum: { copies: 150 },
      });
      mockPrisma.rule.findUnique.mockResolvedValue({
        createdByUserId: "user-123",
      });

      const awardSpy = vi.spyOn(GamificationService, "awardBadgeIfEligible").mockResolvedValue(true);

      const result = await GamificationService.checkHundredCopies(
        mockContext,
        "rule-123"
      );

      expect(result).toBe(true);
      expect(mockPrisma.ruleMetricDaily.aggregate).toHaveBeenCalledWith({
        where: { ruleId: "rule-123" },
        _sum: { copies: true },
      });
      expect(awardSpy).toHaveBeenCalledWith(
        mockContext,
        "user-123",
        "hundred-copies",
        { ruleId: "rule-123", totalCopies: 150 }
      );
    });

    it("should not award badge when copies are below 100", async () => {
      mockPrisma.ruleMetricDaily.aggregate.mockResolvedValue({
        _sum: { copies: 75 },
      });

      const awardSpy = vi.spyOn(GamificationService, "awardBadgeIfEligible");

      const result = await GamificationService.checkHundredCopies(
        mockContext,
        "rule-123"
      );

      expect(result).toBe(false);
      expect(awardSpy).not.toHaveBeenCalled();
    });

    it("should handle null copies sum", async () => {
      mockPrisma.ruleMetricDaily.aggregate.mockResolvedValue({
        _sum: { copies: null },
      });

      const result = await GamificationService.checkHundredCopies(
        mockContext,
        "rule-123"
      );

      expect(result).toBe(false);
    });

    it("should return false if rule not found after copy check", async () => {
      mockPrisma.ruleMetricDaily.aggregate.mockResolvedValue({
        _sum: { copies: 150 },
      });
      mockPrisma.rule.findUnique.mockResolvedValue(null);

      const result = await GamificationService.checkHundredCopies(
        mockContext,
        "rule-123"
      );

      expect(result).toBe(false);
    });

    it("should handle exactly 100 copies", async () => {
      mockPrisma.ruleMetricDaily.aggregate.mockResolvedValue({
        _sum: { copies: 100 },
      });
      mockPrisma.rule.findUnique.mockResolvedValue({
        createdByUserId: "user-123",
      });

      const awardSpy = vi.spyOn(GamificationService, "awardBadgeIfEligible").mockResolvedValue(true);

      const result = await GamificationService.checkHundredCopies(
        mockContext,
        "rule-123"
      );

      expect(result).toBe(true);
      expect(awardSpy).toHaveBeenCalledWith(
        mockContext,
        "user-123",
        "hundred-copies",
        { ruleId: "rule-123", totalCopies: 100 }
      );
    });
  });

  describe("awardVerifiedAuthor", () => {
    it("should award verified author badge", async () => {
      const awardSpy = vi.spyOn(GamificationService, "awardBadgeIfEligible").mockResolvedValue(true);

      const result = await GamificationService.awardVerifiedAuthor(
        mockContext,
        "user-123"
      );

      expect(result).toBe(true);
      expect(awardSpy).toHaveBeenCalledWith(mockContext, "user-123", "verified-author");
    });

    it("should return false if badge not awarded", async () => {
      const awardSpy = vi.spyOn(GamificationService, "awardBadgeIfEligible").mockResolvedValue(false);

      const result = await GamificationService.awardVerifiedAuthor(
        mockContext,
        "user-123"
      );

      expect(result).toBe(false);
    });
  });

  describe("awardTop10WeeklyBadges", () => {
    it("should award badges to top 10 rule authors", async () => {
      const topRuleIds = Array.from({ length: 15 }, (_, i) => `rule-${i + 1}`);
      
      // Mock rule lookups for first 10 rules
      for (let i = 0; i < 10; i++) {
        mockPrisma.rule.findUnique.mockResolvedValueOnce({
          createdByUserId: `user-${i + 1}`,
        });
      }

      const awardSpy = vi.spyOn(GamificationService, "awardBadgeIfEligible").mockResolvedValue(true);

      const result = await GamificationService.awardTop10WeeklyBadges(
        mockContext,
        topRuleIds
      );

      expect(result).toBe(10);
      expect(mockPrisma.rule.findUnique).toHaveBeenCalledTimes(10);
      expect(awardSpy).toHaveBeenCalledTimes(10);

      // Check first award call
      expect(awardSpy).toHaveBeenNthCalledWith(
        1,
        mockContext,
        "user-1",
        "top-10-week",
        { ruleId: "rule-1", rank: 1 }
      );

      // Check last award call
      expect(awardSpy).toHaveBeenNthCalledWith(
        10,
        mockContext,
        "user-10",
        "top-10-week",
        { ruleId: "rule-10", rank: 10 }
      );
    });

    it("should handle fewer than 10 rules", async () => {
      const topRuleIds = ["rule-1", "rule-2", "rule-3"];
      
      mockPrisma.rule.findUnique.mockResolvedValue({
        createdByUserId: "user-1",
      });

      const awardSpy = vi.spyOn(GamificationService, "awardBadgeIfEligible").mockResolvedValue(true);

      const result = await GamificationService.awardTop10WeeklyBadges(
        mockContext,
        topRuleIds
      );

      expect(result).toBe(3);
      expect(awardSpy).toHaveBeenCalledTimes(3);
    });

    it("should handle rules not found", async () => {
      const topRuleIds = ["rule-1", "rule-2"];
      
      mockPrisma.rule.findUnique
        .mockResolvedValueOnce({ createdByUserId: "user-1" })
        .mockResolvedValueOnce(null); // Rule not found

      const awardSpy = vi.spyOn(GamificationService, "awardBadgeIfEligible").mockResolvedValue(true);

      const result = await GamificationService.awardTop10WeeklyBadges(
        mockContext,
        topRuleIds
      );

      expect(result).toBe(1); // Only one badge awarded
      expect(awardSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle badge award failures", async () => {
      const topRuleIds = ["rule-1", "rule-2"];
      
      mockPrisma.rule.findUnique.mockResolvedValue({
        createdByUserId: "user-1",
      });

      const awardSpy = vi.spyOn(GamificationService, "awardBadgeIfEligible")
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false); // Second award fails

      const result = await GamificationService.awardTop10WeeklyBadges(
        mockContext,
        topRuleIds
      );

      expect(result).toBe(1); // Only one badge successfully awarded
    });
  });

  describe("computeLeaderboard", () => {
    const mockRules = [
      {
        id: "rule-1",
        slug: "rule-1-slug",
        title: "Rule 1",
        status: "PUBLISHED",
        createdBy: {
          id: "user-1",
          handle: "user1",
          displayName: "User One",
          avatarUrl: "avatar1.jpg",
        },
        metrics: [
          { views: 100, copies: 10, saves: 5, forks: 2, votes: 8, score: 85 },
          { views: 50, copies: 5, saves: 3, forks: 1, votes: 4, score: 75 },
        ],
      },
      {
        id: "rule-2",
        slug: "rule-2-slug",
        title: "Rule 2",
        status: "PUBLISHED",
        createdBy: {
          id: "user-2",
          handle: "user2",
          displayName: "User Two",
          avatarUrl: null,
        },
        metrics: [
          { views: 200, copies: 20, saves: 10, forks: 5, votes: 15, score: 95 },
        ],
      },
      {
        id: "rule-3",
        slug: "rule-3-slug",
        title: "Rule 3",
        status: "PUBLISHED",
        createdBy: {
          id: "user-3",
          handle: "user3",
          displayName: "User Three",
          avatarUrl: "avatar3.jpg",
        },
        metrics: [
          { views: 5, copies: 0, saves: 0, forks: 0, votes: 1, score: 10 }, // Below threshold
        ],
      },
    ];

    it("should compute leaderboard with proper ranking", async () => {
      mockPrisma.rule.findMany.mockResolvedValue(mockRules);

      const params: LeaderboardParams = {
        period: "WEEKLY",
        scope: "GLOBAL",
        limit: 10,
      };

      const result = await GamificationService.computeLeaderboard(
        mockContext,
        params
      );

      expect(result).toHaveLength(2); // Rule 3 filtered out due to low metrics
      
      // Check ranking order (rule-2 should be first due to higher score)
      expect(result[0]).toEqual({
        rank: 1,
        ruleId: "rule-2",
        ruleSlug: "rule-2-slug",
        title: "Rule 2",
        author: {
          id: "user-2",
          handle: "user2",
          displayName: "User Two",
          avatarUrl: null,
        },
        score: 95,
        copies: 20,
        views: 200,
        saves: 10,
        forks: 5,
        votes: 15,
      });

      expect(result[1]).toEqual({
        rank: 2,
        ruleId: "rule-1",
        ruleSlug: "rule-1-slug",
        title: "Rule 1",
        author: {
          id: "user-1",
          handle: "user1",
          displayName: "User One",
          avatarUrl: "avatar1.jpg",
        },
        score: 85, // Max score from metrics
        copies: 15, // Sum of copies
        views: 150, // Sum of views
        saves: 8, // Sum of saves
        forks: 3, // Sum of forks
        votes: 12, // Sum of votes
      });
    });

    it("should handle ALL period without date filtering", async () => {
      mockPrisma.rule.findMany.mockResolvedValue(mockRules.slice(0, 2));

      const params: LeaderboardParams = {
        period: "ALL",
        scope: "GLOBAL",
      };

      await GamificationService.computeLeaderboard(mockContext, params);

      expect(mockPrisma.rule.findMany).toHaveBeenCalledWith({
        where: {
          status: "PUBLISHED",
        },
        include: {
          createdBy: {
            select: {
              id: true,
              handle: true,
              displayName: true,
              avatarUrl: true,
            },
          },
          metrics: {
            where: undefined, // No date filtering for ALL period
          },
        },
      });
    });

    it("should handle TAG scope filtering", async () => {
      mockPrisma.rule.findMany.mockResolvedValue([]);

      const params: LeaderboardParams = {
        period: "WEEKLY",
        scope: "TAG",
        scopeRef: "javascript",
      };

      await GamificationService.computeLeaderboard(mockContext, params);

      expect(mockPrisma.rule.findMany).toHaveBeenCalledWith({
        where: {
          status: "PUBLISHED",
          tags: {
            some: { slug: "javascript" },
          },
        },
        include: expect.any(Object),
      });
    });

    it("should handle MODEL scope filtering", async () => {
      mockPrisma.rule.findMany.mockResolvedValue([]);

      const params: LeaderboardParams = {
        period: "MONTHLY",
        scope: "MODEL",
        scopeRef: "gpt-4",
      };

      await GamificationService.computeLeaderboard(mockContext, params);

      expect(mockPrisma.rule.findMany).toHaveBeenCalledWith({
        where: {
          status: "PUBLISHED",
          primaryModel: "gpt-4",
        },
        include: expect.any(Object),
      });
    });

    it("should apply custom window days", async () => {
      mockPrisma.rule.findMany.mockResolvedValue([]);

      const params: LeaderboardParams = {
        period: "WEEKLY",
        scope: "GLOBAL",
        windowDays: 14, // Custom 2-week window
      };

      await GamificationService.computeLeaderboard(mockContext, params);

      // Check that date filtering uses custom window
      const expectedStartDate = new Date("2024-01-01T12:00:00Z"); // 14 days before mockContext.now
      
      expect(mockPrisma.rule.findMany).toHaveBeenCalledWith({
        where: {
          status: "PUBLISHED",
        },
        include: {
          createdBy: expect.any(Object),
          metrics: {
            where: { date: { gte: expectedStartDate } },
          },
        },
      });
    });

    it("should apply limit correctly", async () => {
      const manyRules = Array.from({ length: 150 }, (_, i) => ({
        ...mockRules[0],
        id: `rule-${i}`,
        slug: `rule-${i}-slug`,
        title: `Rule ${i}`,
      }));
      
      mockPrisma.rule.findMany.mockResolvedValue(manyRules);

      const params: LeaderboardParams = {
        period: "WEEKLY",
        scope: "GLOBAL",
        limit: 50,
      };

      const result = await GamificationService.computeLeaderboard(
        mockContext,
        params
      );

      expect(result).toHaveLength(50);
    });

    it("should handle rules with no metrics", async () => {
      const rulesWithNoMetrics = [
        {
          ...mockRules[0],
          metrics: [], // No metrics
        },
      ];
      
      mockPrisma.rule.findMany.mockResolvedValue(rulesWithNoMetrics);

      const params: LeaderboardParams = {
        period: "WEEKLY",
        scope: "GLOBAL",
      };

      const result = await GamificationService.computeLeaderboard(
        mockContext,
        params
      );

      expect(result).toHaveLength(0); // Filtered out due to no views/copies
    });
  });

  describe("createLeaderboardSnapshot", () => {
    const mockEntries: LeaderboardEntry[] = [
      {
        rank: 1,
        ruleId: "rule-1",
        ruleSlug: "rule-1-slug",
        title: "Rule 1",
        author: {
          id: "user-1",
          handle: "user1",
          displayName: "User One",
          avatarUrl: "avatar1.jpg",
        },
        score: 95,
        copies: 20,
        views: 200,
      },
    ];

    it("should create new snapshot when none exists", async () => {
      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(null);
      mockPrisma.leaderboardSnapshot.create.mockResolvedValue({
        id: "snapshot-123",
      });

      const params: LeaderboardParams = {
        period: "WEEKLY",
        scope: "GLOBAL",
      };

      const result = await GamificationService.createLeaderboardSnapshot(
        mockContext,
        params,
        mockEntries
      );

      expect(result).toBe("snapshot-123");
      expect(mockPrisma.leaderboardSnapshot.create).toHaveBeenCalledWith({
        data: {
          period: "WEEKLY",
          scope: "GLOBAL",
          scopeRef: null,
          rank: {
            entries: mockEntries,
            meta: {
              period: "WEEKLY",
              scope: "GLOBAL",
              scopeRef: null,
              windowDays: 7,
              generatedAt: "2024-01-15T12:00:00.000Z",
            },
          },
        },
      });
    });

    it("should update existing snapshot", async () => {
      const existingSnapshot = { id: "existing-snapshot" };
      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(existingSnapshot);
      mockPrisma.leaderboardSnapshot.update.mockResolvedValue(existingSnapshot);

      const params: LeaderboardParams = {
        period: "DAILY",
        scope: "TAG",
        scopeRef: "javascript",
      };

      const result = await GamificationService.createLeaderboardSnapshot(
        mockContext,
        params,
        mockEntries
      );

      expect(result).toBe("existing-snapshot");
      expect(mockPrisma.leaderboardSnapshot.update).toHaveBeenCalledWith({
        where: { id: "existing-snapshot" },
        data: {
          rank: {
            entries: mockEntries,
            meta: {
              period: "DAILY",
              scope: "TAG",
              scopeRef: "javascript",
              windowDays: 1,
              generatedAt: "2024-01-15T12:00:00.000Z",
            },
          },
        },
      });
    });

    it("should check for existing snapshot with correct date range", async () => {
      mockPrisma.leaderboardSnapshot.findFirst.mockResolvedValue(null);
      mockPrisma.leaderboardSnapshot.create.mockResolvedValue({ id: "new-snapshot" });

      const params: LeaderboardParams = {
        period: "MONTHLY",
        scope: "GLOBAL",
      };

      await GamificationService.createLeaderboardSnapshot(
        mockContext,
        params,
        mockEntries
      );

      // The actual implementation creates a new Date and sets hours to 0
      // We need to match what actually happens in the code
      expect(mockPrisma.leaderboardSnapshot.findFirst).toHaveBeenCalledWith({
        where: {
          period: "MONTHLY",
          scope: "GLOBAL",
          scopeRef: null,
          createdAt: { gte: expect.any(Date) },
        },
      });

      // Verify the date is set to start of day
      const actualCall = mockPrisma.leaderboardSnapshot.findFirst.mock.calls[0][0];
      const actualDate = actualCall.where.createdAt.gte;
      expect(actualDate.getHours()).toBe(0);
      expect(actualDate.getMinutes()).toBe(0);
      expect(actualDate.getSeconds()).toBe(0);
      expect(actualDate.getMilliseconds()).toBe(0);
    });
  });

  describe("getPreviousSnapshot", () => {
    it("should return previous snapshot when multiple exist", async () => {
      const snapshots = [
        { id: "current-snapshot", createdAt: new Date("2024-01-15") },
        { id: "previous-snapshot", createdAt: new Date("2024-01-08") },
      ];
      
      mockPrisma.leaderboardSnapshot.findMany.mockResolvedValue(snapshots);

      const result = await GamificationService.getPreviousSnapshot(
        mockContext,
        "WEEKLY",
        "GLOBAL"
      );

      expect(result).toEqual(snapshots[1]);
      expect(mockPrisma.leaderboardSnapshot.findMany).toHaveBeenCalledWith({
        where: {
          period: "WEEKLY",
          scope: "GLOBAL",
          scopeRef: null,
        },
        orderBy: { createdAt: "desc" },
        take: 2,
      });
    });

    it("should return null when only one snapshot exists", async () => {
      const snapshots = [
        { id: "current-snapshot", createdAt: new Date("2024-01-15") },
      ];
      
      mockPrisma.leaderboardSnapshot.findMany.mockResolvedValue(snapshots);

      const result = await GamificationService.getPreviousSnapshot(
        mockContext,
        "WEEKLY",
        "GLOBAL"
      );

      expect(result).toBeNull();
    });

    it("should handle scopeRef parameter", async () => {
      mockPrisma.leaderboardSnapshot.findMany.mockResolvedValue([]);

      await GamificationService.getPreviousSnapshot(
        mockContext,
        "WEEKLY",
        "TAG",
        "javascript"
      );

      expect(mockPrisma.leaderboardSnapshot.findMany).toHaveBeenCalledWith({
        where: {
          period: "WEEKLY",
          scope: "TAG",
          scopeRef: "javascript",
        },
        orderBy: { createdAt: "desc" },
        take: 2,
      });
    });
  });

  describe("getPeriodDays", () => {
    it("should return correct days for each period", () => {
      expect(GamificationService.getPeriodDays("DAILY")).toBe(1);
      expect(GamificationService.getPeriodDays("WEEKLY")).toBe(7);
      expect(GamificationService.getPeriodDays("MONTHLY")).toBe(30);
      expect(GamificationService.getPeriodDays("ALL")).toBe(365);
      expect(GamificationService.getPeriodDays("UNKNOWN")).toBe(365); // Default
    });
  });

  describe("recheckUserBadges", () => {
    it("should recheck all badge types for a user", async () => {
      // Mock user rules
      const userRules = [
        { id: "rule-1" },
        { id: "rule-2" },
      ];
      mockPrisma.rule.findMany.mockResolvedValue(userRules);

      // Mock badge check methods
      const firstContributionSpy = vi.spyOn(GamificationService, "checkFirstContribution").mockResolvedValue(true);
      const tenUpvotesSpy = vi.spyOn(GamificationService, "checkTenUpvotes")
        .mockResolvedValueOnce(false) // rule-1 doesn't get ten upvotes badge
        .mockResolvedValueOnce(true); // rule-2 gets ten upvotes badge
      const hundredCopiesSpy = vi.spyOn(GamificationService, "checkHundredCopies")
        .mockResolvedValueOnce(true) // rule-1 gets hundred copies badge
        .mockResolvedValueOnce(false); // rule-2 doesn't get hundred copies badge

      const result = await GamificationService.recheckUserBadges(
        mockContext,
        "user-123"
      );

      expect(result).toBe(3); // 1 first contribution + 1 ten upvotes + 1 hundred copies
      
      expect(firstContributionSpy).toHaveBeenCalledWith(mockContext, "user-123");
      expect(tenUpvotesSpy).toHaveBeenCalledTimes(2); // Called for each rule
      expect(hundredCopiesSpy).toHaveBeenCalledTimes(2); // Called for each rule
      
      expect(mockPrisma.rule.findMany).toHaveBeenCalledWith({
        where: { createdByUserId: "user-123", status: "PUBLISHED" },
        select: { id: true },
      });
    });

    it("should handle user with no published rules", async () => {
      mockPrisma.rule.findMany.mockResolvedValue([]);
      
      const firstContributionSpy = vi.spyOn(GamificationService, "checkFirstContribution").mockResolvedValue(false);
      const tenUpvotesSpy = vi.spyOn(GamificationService, "checkTenUpvotes");
      const hundredCopiesSpy = vi.spyOn(GamificationService, "checkHundredCopies");

      const result = await GamificationService.recheckUserBadges(
        mockContext,
        "user-123"
      );

      expect(result).toBe(0);
      expect(firstContributionSpy).toHaveBeenCalled();
      expect(tenUpvotesSpy).not.toHaveBeenCalled();
      expect(hundredCopiesSpy).not.toHaveBeenCalled();
    });

    it("should count all awarded badges correctly", async () => {
      const userRules = [{ id: "rule-1" }];
      mockPrisma.rule.findMany.mockResolvedValue(userRules);

      vi.spyOn(GamificationService, "checkFirstContribution").mockResolvedValue(true);
      vi.spyOn(GamificationService, "checkTenUpvotes").mockResolvedValue(true);
      vi.spyOn(GamificationService, "checkHundredCopies").mockResolvedValue(true);

      const result = await GamificationService.recheckUserBadges(
        mockContext,
        "user-123"
      );

      expect(result).toBe(3); // All badges awarded
    });
  });
});
