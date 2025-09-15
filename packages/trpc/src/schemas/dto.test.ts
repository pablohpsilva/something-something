import { describe, it, expect } from "vitest";
import {
  authorDTOSchema,
  tagDTOSchema,
  ruleVersionSummaryDTOSchema,
  ruleMetricsDTOSchema,
  ruleCardDTOSchema,
  ruleDetailDTOSchema,
  ruleVersionDetailDTOSchema,
  commentDTOSchema,
  notificationDTOSchema,
  claimDTOSchema,
  voteSummaryDTOSchema,
  metricsSummaryDTOSchema,
  userProfileDTOSchema,
  followerDTOSchema,
  enhancedNotificationDTOSchema,
  socialStatsDTO,
  leaderboardEntryDTOSchema,
  badgeDTOSchema,
  donationDTOSchema,
  authorDonationStatsDTOSchema,
  searchResultDTOSchema,
  searchSuggestionDTOSchema,
  searchFacetDTOSchema,
  type AuthorDTO,
  type TagDTO,
  type RuleVersionSummaryDTO,
  type RuleMetricsDTO,
  type RuleCardDTO,
  type RuleDetailDTO,
  type RuleVersionDetailDTO,
  type CommentDTO,
  type NotificationDTO,
  type ClaimDTO,
  type VoteSummaryDTO,
  type MetricsSummaryDTO,
  type UserProfileDTO,
  type FollowerDTO,
  type EnhancedNotificationDTO,
  type SocialStatsDTO,
  type LeaderboardEntryDTO,
  type BadgeDTO,
  type DonationDTO,
  type AuthorDonationStatsDTO,
  type SearchResultDTO,
  type SearchSuggestionDTO,
  type SearchFacetDTO,
} from "./dto";

describe("DTO Schemas", () => {
  describe("authorDTOSchema", () => {
    it("should accept valid author DTO", () => {
      const validAuthor = {
        id: "clkv6tv5l0001l608w5i10wd7",
        handle: "johndoe",
        displayName: "John Doe",
        avatarUrl: "https://example.com/avatar.jpg",
        role: "USER",
        isVerified: true,
      };

      const result = authorDTOSchema.parse(validAuthor);
      expect(result).toEqual(validAuthor);
    });

    it("should accept author with null avatar", () => {
      const validAuthor = {
        id: "clkv6tv5l0001l608w5i10wd7",
        handle: "johndoe",
        displayName: "John Doe",
        avatarUrl: null,
        role: "USER",
      };

      const result = authorDTOSchema.parse(validAuthor);
      expect(result).toEqual(validAuthor);
    });

    it("should accept author without optional isVerified", () => {
      const validAuthor = {
        id: "clkv6tv5l0001l608w5i10wd7",
        handle: "johndoe",
        displayName: "John Doe",
        avatarUrl: null,
        role: "ADMIN",
      };

      const result = authorDTOSchema.parse(validAuthor);
      expect(result).toEqual(validAuthor);
    });

    it("should reject invalid role", () => {
      expect(() =>
        authorDTOSchema.parse({
          id: "clkv6tv5l0001l608w5i10wd7",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: null,
          role: "INVALID_ROLE",
        })
      ).toThrow();
    });

    it("should reject missing required fields", () => {
      expect(() =>
        authorDTOSchema.parse({
          handle: "johndoe",
          displayName: "John Doe",
        })
      ).toThrow();
    });
  });

  describe("tagDTOSchema", () => {
    it("should accept valid tag DTO", () => {
      const validTag = {
        id: "clkv6tv5l0001l608w5i10wdj",
        slug: "javascript",
        name: "JavaScript",
        count: 42,
      };

      const result = tagDTOSchema.parse(validTag);
      expect(result).toEqual(validTag);
    });

    it("should accept tag without optional count", () => {
      const validTag = {
        id: "clkv6tv5l0001l608w5i10wdj",
        slug: "javascript",
        name: "JavaScript",
      };

      const result = tagDTOSchema.parse(validTag);
      expect(result).toEqual(validTag);
    });

    it("should accept negative count", () => {
      const result = tagDTOSchema.parse({
        id: "clkv6tv5l0001l608w5i10wdj",
        slug: "javascript",
        name: "JavaScript",
        count: -1,
      });
      expect(result.count).toBe(-1);
    });

    it("should reject non-integer count", () => {
      expect(() =>
        tagDTOSchema.parse({
          id: "clkv6tv5l0001l608w5i10wdj",
          slug: "javascript",
          name: "JavaScript",
          count: 3.14,
        })
      ).toThrow();
    });
  });

  describe("ruleVersionSummaryDTOSchema", () => {
    it("should accept valid rule version summary", () => {
      const validVersion = {
        id: "clkv6tv5l0001l608w5i10wd7",
        version: "1.0.0",
        testedOn: {
          models: ["GPT-4"],
          stacks: ["javascript"],
        },
        createdAt: new Date(),
      };

      const result = ruleVersionSummaryDTOSchema.parse(validVersion);
      expect(result).toEqual(validVersion);
    });

    it("should accept version with null testedOn", () => {
      const validVersion = {
        id: "clkv6tv5l0001l608w5i10wd7",
        version: "1.0.0",
        testedOn: null,
        createdAt: new Date(),
      };

      const result = ruleVersionSummaryDTOSchema.parse(validVersion);
      expect(result).toEqual(validVersion);
    });

    it("should reject invalid date", () => {
      expect(() =>
        ruleVersionSummaryDTOSchema.parse({
          id: "clkv6tv5l0001l608w5i10wd7",
          version: "1.0.0",
          testedOn: null,
          createdAt: "invalid-date",
        })
      ).toThrow();
    });
  });

  describe("ruleMetricsDTOSchema", () => {
    it("should accept valid rule metrics", () => {
      const validMetrics = {
        views7: 100,
        copies7: 25,
        saves7: 15,
        forks7: 5,
        score: 85.5,
      };

      const result = ruleMetricsDTOSchema.parse(validMetrics);
      expect(result).toEqual(validMetrics);
    });

    it("should accept zero values", () => {
      const validMetrics = {
        views7: 0,
        copies7: 0,
        saves7: 0,
        forks7: 0,
        score: 0,
      };

      const result = ruleMetricsDTOSchema.parse(validMetrics);
      expect(result).toEqual(validMetrics);
    });

    it("should accept negative integer values", () => {
      const result = ruleMetricsDTOSchema.parse({
        views7: -1,
        copies7: 25,
        saves7: 15,
        forks7: 5,
        score: 85.5,
      });
      expect(result.views7).toBe(-1);
    });

    it("should reject non-integer values for count fields", () => {
      expect(() =>
        ruleMetricsDTOSchema.parse({
          views7: 100.5,
          copies7: 25,
          saves7: 15,
          forks7: 5,
          score: 85.5,
        })
      ).toThrow();
    });
  });

  describe("ruleCardDTOSchema", () => {
    it("should accept valid rule card", () => {
      const validRuleCard = {
        id: "clkv6tv5l0001l608w5i10wd7",
        slug: "test-rule",
        title: "Test Rule",
        summary: "A test rule for validation",
        contentType: "PROMPT",
        status: "PUBLISHED",
        primaryModel: "GPT-4",
        tags: [
          {
            id: "clkv6tv5l0001l608w5i10wd8",
            slug: "javascript",
            name: "JavaScript",
            count: 10,
          },
        ],
        score: 85.5,
        author: {
          id: "clkv6tv5l0001l608w5i10wd9",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: null,
          role: "USER",
        },
        currentVersion: {
          id: "clkv6tv5l0001l608w5i10wda",
          version: "1.0.0",
          testedOn: {
            models: ["GPT-4"],
            stacks: ["javascript"],
          },
          createdAt: new Date(),
        },
        metrics: {
          views7: 100,
          copies7: 25,
          saves7: 15,
          forks7: 5,
          score: 85.5,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = ruleCardDTOSchema.parse(validRuleCard);
      expect(result).toEqual(validRuleCard);
    });

    it("should accept rule card with null values", () => {
      const validRuleCard = {
        id: "clkv6tv5l0001l608w5i10wd7",
        slug: "test-rule",
        title: "Test Rule",
        summary: "A test rule for validation",
        contentType: "PROMPT",
        status: "PUBLISHED",
        primaryModel: null,
        tags: [],
        score: 85.5,
        author: {
          id: "clkv6tv5l0001l608w5i10wdb",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: null,
          role: "USER",
        },
        currentVersion: null,
        metrics: {
          views7: 100,
          copies7: 25,
          saves7: 15,
          forks7: 5,
          score: 85.5,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = ruleCardDTOSchema.parse(validRuleCard);
      expect(result).toEqual(validRuleCard);
    });
  });

  describe("ruleDetailDTOSchema", () => {
    it("should accept valid rule detail", () => {
      const validRuleDetail = {
        id: "clkv6tv5l0001l608w5i10wd7",
        slug: "test-rule",
        title: "Test Rule",
        summary: "A test rule for validation",
        contentType: "PROMPT",
        status: "PUBLISHED",
        primaryModel: "GPT-4",
        tags: [],
        score: 85.5,
        author: {
          id: "clkv6tv5l0001l608w5i10wdb",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: null,
          role: "USER",
        },
        currentVersion: null,
        metrics: {
          views7: 100,
          copies7: 25,
          saves7: 15,
          forks7: 5,
          score: 85.5,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        body: "This is the rule body content",
        resourceLinks: [
          {
            url: "https://example.com",
            label: "Example Documentation",
            kind: "DOCS",
          },
        ],
        versionsCount: 3,
        commentsCount: 5,
        votesCount: 10,
        favoritesCount: 2,
        watchersCount: 8,
        userVote: "up",
        userFavorited: true,
        userWatching: false,
      };

      const result = ruleDetailDTOSchema.parse(validRuleDetail);
      expect(result).toEqual(validRuleDetail);
    });

    it("should accept rule detail with null optional fields", () => {
      const validRuleDetail = {
        id: "clkv6tv5l0001l608w5i10wd7",
        slug: "test-rule",
        title: "Test Rule",
        summary: "A test rule for validation",
        contentType: "PROMPT",
        status: "PUBLISHED",
        primaryModel: null,
        tags: [],
        score: 85.5,
        author: {
          id: "clkv6tv5l0001l608w5i10wdb",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: null,
          role: "USER",
        },
        currentVersion: null,
        metrics: {
          views7: 100,
          copies7: 25,
          saves7: 15,
          forks7: 5,
          score: 85.5,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        body: null,
        resourceLinks: [],
        versionsCount: 0,
        commentsCount: 0,
        votesCount: 0,
        favoritesCount: 0,
        watchersCount: 0,
        userVote: null,
      };

      const result = ruleDetailDTOSchema.parse(validRuleDetail);
      expect(result).toEqual(validRuleDetail);
    });

    it("should reject invalid userVote value", () => {
      expect(() =>
        ruleDetailDTOSchema.parse({
          id: "clkv6tv5l0001l608w5i10wd7",
          slug: "test-rule",
          title: "Test Rule",
          summary: "A test rule for validation",
          contentType: "PROMPT",
          status: "PUBLISHED",
          primaryModel: null,
          tags: [],
          score: 85.5,
          author: {
            id: "clkv6tv5l0001l608w5i10wdb",
            handle: "johndoe",
            displayName: "John Doe",
            avatarUrl: null,
            role: "USER",
          },
          currentVersion: null,
          metrics: {
            views7: 100,
            copies7: 25,
            saves7: 15,
            forks7: 5,
            score: 85.5,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          body: null,
          resourceLinks: [],
          versionsCount: 0,
          commentsCount: 0,
          votesCount: 0,
          favoritesCount: 0,
          watchersCount: 0,
          userVote: "invalid",
        })
      ).toThrow();
    });
  });

  describe("ruleVersionDetailDTOSchema", () => {
    it("should accept valid rule version detail", () => {
      const validVersionDetail = {
        id: "clkv6tv5l0001l608w5i10wd7",
        ruleId: "clkv6tv5l0001l608w5i10wd8",
        version: "1.0.0",
        body: "This is the version body content",
        testedOn: {
          models: ["GPT-4"],
          stacks: ["javascript"],
        },
        changelog: "Initial version",
        parentVersionId: null,
        createdBy: {
          id: "clkv6tv5l0001l608w5i10wdb",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: null,
          role: "USER",
        },
        createdAt: new Date(),
        score: 85.5,
        userVote: "up",
      };

      const result = ruleVersionDetailDTOSchema.parse(validVersionDetail);
      expect(result).toEqual(validVersionDetail);
    });

    it("should accept version detail with null optional fields", () => {
      const validVersionDetail = {
        id: "clkv6tv5l0001l608w5i10wd7",
        ruleId: "clkv6tv5l0001l608w5i10wd8",
        version: "1.0.0",
        body: "This is the version body content",
        testedOn: null,
        changelog: null,
        parentVersionId: null,
        createdBy: {
          id: "clkv6tv5l0001l608w5i10wdb",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: null,
          role: "USER",
        },
        createdAt: new Date(),
        userVote: null,
      };

      const result = ruleVersionDetailDTOSchema.parse(validVersionDetail);
      expect(result).toEqual(validVersionDetail);
    });
  });

  describe("commentDTOSchema", () => {
    it("should accept valid comment DTO", () => {
      const validComment = {
        id: "clkv6tv5l0001l608w5i10wdd",
        ruleId: "clkv6tv5l0001l608w5i10wde",
        parentId: null,
        author: {
          id: "clkv6tv5l0001l608w5i10wdb",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: null,
          role: "USER",
        },
        bodyHtml: "<p>This is a comment</p>",
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        edited: false,
        depth: 0,
        children: [],
        repliesCount: 0,
        canEdit: true,
        canDelete: true,
      };

      const result = commentDTOSchema.parse(validComment);
      expect(result).toEqual(validComment);
    });

    it("should accept deleted comment", () => {
      const validComment = {
        id: "clkv6tv5l0001l608w5i10wdd",
        ruleId: "clkv6tv5l0001l608w5i10wde",
        parentId: null,
        author: {
          id: "clkv6tv5l0001l608w5i10wdb",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: null,
          role: "USER",
        },
        bodyHtml: null,
        isDeleted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        edited: false,
        depth: 0,
      };

      const result = commentDTOSchema.parse(validComment);
      expect(result).toEqual(validComment);
    });

    it("should accept nested comments", () => {
      const nestedComment = {
        id: "clkv6tv5l0001l608w5i10wdl",
        ruleId: "clkv6tv5l0001l608w5i10wde",
        parentId: "comment_1",
        author: {
          id: "clkv6tv5l0001l608w5i10wdm",
          handle: "janedoe",
          displayName: "Jane Doe",
          avatarUrl: null,
          role: "USER",
        },
        bodyHtml: "<p>This is a reply</p>",
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        edited: false,
        depth: 1,
      };

      const validComment = {
        id: "clkv6tv5l0001l608w5i10wdd",
        ruleId: "clkv6tv5l0001l608w5i10wde",
        parentId: null,
        author: {
          id: "clkv6tv5l0001l608w5i10wdb",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: null,
          role: "USER",
        },
        bodyHtml: "<p>This is a comment</p>",
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        edited: false,
        depth: 0,
        children: [nestedComment],
      };

      const result = commentDTOSchema.parse(validComment);
      expect(result).toEqual(validComment);
    });

    it("should reject negative depth", () => {
      expect(() =>
        commentDTOSchema.parse({
          id: "clkv6tv5l0001l608w5i10wdd",
          ruleId: "clkv6tv5l0001l608w5i10wde",
          parentId: null,
          author: {
            id: "clkv6tv5l0001l608w5i10wdb",
            handle: "johndoe",
            displayName: "John Doe",
            avatarUrl: null,
            role: "USER",
          },
          bodyHtml: "<p>This is a comment</p>",
          isDeleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          edited: false,
          depth: -1,
        })
      ).toThrow();
    });
  });

  describe("notificationDTOSchema", () => {
    it("should accept valid notification DTO", () => {
      const validNotification = {
        id: "clkv6tv5l0001l608w5i10wdn",
        type: "NEW_VERSION",
        payload: { ruleId: "rule_1", version: "1.1.0" },
        readAt: null,
        createdAt: new Date(),
        title: "New Version Available",
        message: "A new version of your rule is available",
        actionUrl: "/rules/test-rule",
        actor: {
          id: "clkv6tv5l0001l608w5i10wdb",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: null,
          role: "USER",
        },
      };

      const result = notificationDTOSchema.parse(validNotification);
      expect(result).toEqual(validNotification);
    });

    it("should accept notification with read timestamp", () => {
      const validNotification = {
        id: "clkv6tv5l0001l608w5i10wdn",
        type: "COMMENT_REPLY",
        payload: { commentId: "comment_1" },
        readAt: new Date(),
        createdAt: new Date(),
      };

      const result = notificationDTOSchema.parse(validNotification);
      expect(result).toEqual(validNotification);
    });

    it("should accept notification without optional fields", () => {
      const validNotification = {
        id: "clkv6tv5l0001l608w5i10wdn",
        type: "DONATION_RECEIVED",
        payload: { amount: 1000 },
        readAt: null,
        createdAt: new Date(),
      };

      const result = notificationDTOSchema.parse(validNotification);
      expect(result).toEqual(validNotification);
    });
  });

  describe("claimDTOSchema", () => {
    it("should accept valid claim DTO", () => {
      const validClaim = {
        id: "clkv6tv5l0001l608w5i10wdg",
        rule: {
          id: "clkv6tv5l0001l608w5i10wdc",
          slug: "test-rule",
          title: "Test Rule",
        },
        claimant: {
          id: "clkv6tv5l0001l608w5i10wdb",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: null,
          role: "USER",
        },
        status: "PENDING",
        evidenceUrl: "https://example.com/evidence",
        createdAt: new Date(),
        reviewedBy: null,
        reviewedAt: null,
        note: null,
      };

      const result = claimDTOSchema.parse(validClaim);
      expect(result).toEqual(validClaim);
    });

    it("should accept reviewed claim", () => {
      const validClaim = {
        id: "clkv6tv5l0001l608w5i10wdg",
        rule: {
          id: "clkv6tv5l0001l608w5i10wdc",
          slug: "test-rule",
          title: "Test Rule",
        },
        claimant: {
          id: "clkv6tv5l0001l608w5i10wdb",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: null,
          role: "USER",
        },
        status: "APPROVED",
        evidenceUrl: "https://example.com/evidence",
        createdAt: new Date(),
        reviewedBy: {
          id: "clkv6tv5l0001l608w5i10wdh",
          handle: "admin",
          displayName: "Admin User",
          avatarUrl: null,
          role: "ADMIN",
        },
        reviewedAt: new Date(),
        note: "Claim approved with valid evidence",
      };

      const result = claimDTOSchema.parse(validClaim);
      expect(result).toEqual(validClaim);
    });
  });

  describe("voteSummaryDTOSchema", () => {
    it("should accept valid vote summary", () => {
      const validVoteSummary = {
        score: 15,
        upCount: 20,
        downCount: 5,
        myVote: 1,
      };

      const result = voteSummaryDTOSchema.parse(validVoteSummary);
      expect(result).toEqual(validVoteSummary);
    });

    it("should accept zero vote", () => {
      const validVoteSummary = {
        score: 0,
        upCount: 5,
        downCount: 5,
        myVote: 0,
      };

      const result = voteSummaryDTOSchema.parse(validVoteSummary);
      expect(result).toEqual(validVoteSummary);
    });

    it("should accept negative vote", () => {
      const validVoteSummary = {
        score: -10,
        upCount: 5,
        downCount: 15,
        myVote: -1,
      };

      const result = voteSummaryDTOSchema.parse(validVoteSummary);
      expect(result).toEqual(validVoteSummary);
    });

    it("should reject invalid myVote value", () => {
      expect(() =>
        voteSummaryDTOSchema.parse({
          score: 15,
          upCount: 20,
          downCount: 5,
          myVote: 2,
        })
      ).toThrow();
    });

    it("should reject non-integer counts", () => {
      expect(() =>
        voteSummaryDTOSchema.parse({
          score: 15,
          upCount: 20.5,
          downCount: 5,
          myVote: 1,
        })
      ).toThrow();
    });
  });

  describe("metricsSummaryDTOSchema", () => {
    it("should accept valid metrics summary", () => {
      const validMetrics = {
        views: {
          total: 1000,
          last7Days: 100,
          last30Days: 400,
        },
        copies: {
          total: 250,
          last7Days: 25,
          last30Days: 100,
        },
        saves: {
          total: 150,
          last7Days: 15,
          last30Days: 60,
        },
        forks: {
          total: 50,
          last7Days: 5,
          last30Days: 20,
        },
        score: 85.5,
        trend: "up",
      };

      const result = metricsSummaryDTOSchema.parse(validMetrics);
      expect(result).toEqual(validMetrics);
    });

    it("should accept all trend values", () => {
      const trends = ["up", "down", "stable"];

      trends.forEach((trend) => {
        const validMetrics = {
          views: { total: 1000, last7Days: 100, last30Days: 400 },
          copies: { total: 250, last7Days: 25, last30Days: 100 },
          saves: { total: 150, last7Days: 15, last30Days: 60 },
          forks: { total: 50, last7Days: 5, last30Days: 20 },
          score: 85.5,
          trend,
        };

        const result = metricsSummaryDTOSchema.parse(validMetrics);
        expect(result.trend).toBe(trend);
      });
    });

    it("should reject invalid trend value", () => {
      expect(() =>
        metricsSummaryDTOSchema.parse({
          views: { total: 1000, last7Days: 100, last30Days: 400 },
          copies: { total: 250, last7Days: 25, last30Days: 100 },
          saves: { total: 150, last7Days: 15, last30Days: 60 },
          forks: { total: 50, last7Days: 5, last30Days: 20 },
          score: 85.5,
          trend: "invalid",
        })
      ).toThrow();
    });

    it("should accept negative integer values", () => {
      const result = metricsSummaryDTOSchema.parse({
        views: { total: -1, last7Days: 100, last30Days: 400 },
        copies: { total: 250, last7Days: 25, last30Days: 100 },
        saves: { total: 150, last7Days: 15, last30Days: 60 },
        forks: { total: 50, last7Days: 5, last30Days: 20 },
        score: 85.5,
        trend: "up",
      });
      expect(result.views.total).toBe(-1);
    });
  });

  describe("userProfileDTOSchema", () => {
    it("should accept valid user profile", () => {
      const validProfile = {
        id: "clkv6tv5l0001l608w5i10wdi",
        handle: "johndoe",
        displayName: "John Doe",
        avatarUrl: "https://example.com/avatar.jpg",
        bio: "Software developer and AI enthusiast",
        role: "USER",
        isVerified: true,
        createdAt: new Date(),
        stats: {
          rulesCreated: 10,
          totalViews: 5000,
          totalCopies: 1200,
          followers: 50,
          following: 25,
        },
        isFollowing: false,
      };

      const result = userProfileDTOSchema.parse(validProfile);
      expect(result).toEqual(validProfile);
    });

    it("should accept profile with null optional fields", () => {
      const validProfile = {
        id: "clkv6tv5l0001l608w5i10wdi",
        handle: "johndoe",
        displayName: "John Doe",
        avatarUrl: null,
        bio: null,
        role: "USER",
        isVerified: false,
        createdAt: new Date(),
        stats: {
          rulesCreated: 0,
          totalViews: 0,
          totalCopies: 0,
          followers: 0,
          following: 0,
        },
      };

      const result = userProfileDTOSchema.parse(validProfile);
      expect(result).toEqual(validProfile);
    });

    it("should accept negative stats values", () => {
      const result = userProfileDTOSchema.parse({
        id: "clkv6tv5l0001l608w5i10wdi",
        handle: "johndoe",
        displayName: "John Doe",
        avatarUrl: null,
        bio: null,
        role: "USER",
        isVerified: false,
        createdAt: new Date(),
        stats: {
          rulesCreated: -1,
          totalViews: 0,
          totalCopies: 0,
          followers: 0,
          following: 0,
        },
      });
      expect(result.stats.rulesCreated).toBe(-1);
    });
  });

  describe("followerDTOSchema", () => {
    it("should accept valid follower DTO", () => {
      const validFollower = {
        id: "clkv6tv5l0001l608w5i10wdi",
        handle: "johndoe",
        displayName: "John Doe",
        avatarUrl: "https://example.com/avatar.jpg",
        isVerified: true,
        followedAt: new Date(),
      };

      const result = followerDTOSchema.parse(validFollower);
      expect(result).toEqual(validFollower);
    });

    it("should accept follower without optional fields", () => {
      const validFollower = {
        id: "clkv6tv5l0001l608w5i10wdi",
        handle: "johndoe",
        displayName: "John Doe",
        avatarUrl: null,
        followedAt: new Date(),
      };

      const result = followerDTOSchema.parse(validFollower);
      expect(result).toEqual(validFollower);
    });
  });

  describe("enhancedNotificationDTOSchema", () => {
    it("should accept valid enhanced notification", () => {
      const validNotification = {
        id: "clkv6tv5l0001l608w5i10wdn",
        type: "NEW_VERSION",
        payload: { ruleId: "rule_1", version: "1.1.0" },
        readAt: null,
        createdAt: new Date(),
        title: "New Version Available",
        message: "A new version of your rule is available",
        actionUrl: "/rules/test-rule",
        actor: {
          id: "clkv6tv5l0001l608w5i10wdb",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: null,
        },
      };

      const result = enhancedNotificationDTOSchema.parse(validNotification);
      expect(result).toEqual(validNotification);
    });

    it("should accept all notification types", () => {
      const types = [
        "NEW_VERSION",
        "COMMENT_REPLY",
        "AUTHOR_PUBLISHED",
        "CLAIM_VERDICT",
        "DONATION_RECEIVED",
      ];

      types.forEach((type) => {
        const validNotification = {
          id: "clkv6tv5l0001l608w5i10wdn",
          type,
          payload: {},
          readAt: null,
          createdAt: new Date(),
          title: "Test Notification",
          message: "Test message",
        };

        const result = enhancedNotificationDTOSchema.parse(validNotification);
        expect(result.type).toBe(type);
      });
    });

    it("should reject invalid notification type", () => {
      expect(() =>
        enhancedNotificationDTOSchema.parse({
          id: "clkv6tv5l0001l608w5i10wdn",
          type: "INVALID_TYPE",
          payload: {},
          readAt: null,
          createdAt: new Date(),
          title: "Test Notification",
          message: "Test message",
        })
      ).toThrow();
    });
  });

  describe("socialStatsDTO", () => {
    it("should accept valid social stats", () => {
      const validStats = {
        followersCount: 100,
        followingCount: 50,
        watchersCount: 25,
        isFollowing: true,
        isWatching: false,
      };

      const result = socialStatsDTO.parse(validStats);
      expect(result).toEqual(validStats);
    });

    it("should accept stats without optional fields", () => {
      const validStats = {
        followersCount: 100,
        followingCount: 50,
      };

      const result = socialStatsDTO.parse(validStats);
      expect(result).toEqual(validStats);
    });

    it("should accept negative counts", () => {
      const result = socialStatsDTO.parse({
        followersCount: -1,
        followingCount: 50,
      });
      expect(result.followersCount).toBe(-1);
    });
  });

  describe("leaderboardEntryDTOSchema", () => {
    it("should accept valid leaderboard entry", () => {
      const validEntry = {
        rank: 1,
        ruleId: "clkv6tv5l0001l608w5i10wde",
        ruleSlug: "test-rule",
        title: "Test Rule",
        author: {
          id: "clkv6tv5l0001l608w5i10wdb",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: null,
        },
        score: 95.5,
        copies: 500,
        views: 2000,
        saves: 150,
        forks: 25,
        votes: 75,
        rankDelta: 2,
      };

      const result = leaderboardEntryDTOSchema.parse(validEntry);
      expect(result).toEqual(validEntry);
    });

    it("should accept entry without optional fields", () => {
      const validEntry = {
        rank: 1,
        ruleId: "clkv6tv5l0001l608w5i10wde",
        ruleSlug: "test-rule",
        title: "Test Rule",
        author: {
          id: "clkv6tv5l0001l608w5i10wdb",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: null,
        },
        score: 95.5,
        copies: 500,
        views: 2000,
      };

      const result = leaderboardEntryDTOSchema.parse(validEntry);
      expect(result).toEqual(validEntry);
    });

    it("should accept null rankDelta", () => {
      const validEntry = {
        rank: 1,
        ruleId: "clkv6tv5l0001l608w5i10wde",
        ruleSlug: "test-rule",
        title: "Test Rule",
        author: {
          id: "clkv6tv5l0001l608w5i10wdb",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: null,
        },
        score: 95.5,
        copies: 500,
        views: 2000,
        rankDelta: null,
      };

      const result = leaderboardEntryDTOSchema.parse(validEntry);
      expect(result).toEqual(validEntry);
    });

    it("should reject zero or negative rank", () => {
      expect(() =>
        leaderboardEntryDTOSchema.parse({
          rank: 0,
          ruleId: "clkv6tv5l0001l608w5i10wde",
          ruleSlug: "test-rule",
          title: "Test Rule",
          author: {
            id: "clkv6tv5l0001l608w5i10wdb",
            handle: "johndoe",
            displayName: "John Doe",
            avatarUrl: null,
          },
          score: 95.5,
          copies: 500,
          views: 2000,
        })
      ).toThrow();
    });

    it("should accept negative integer values", () => {
      const result = leaderboardEntryDTOSchema.parse({
        rank: 1,
        ruleId: "clkv6tv5l0001l608w5i10wde",
        ruleSlug: "test-rule",
        title: "Test Rule",
        author: {
          id: "clkv6tv5l0001l608w5i10wdb",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: null,
        },
        score: 95.5,
        copies: -1,
        views: 2000,
      });
      expect(result.copies).toBe(-1);
    });
  });

  describe("badgeDTOSchema", () => {
    it("should accept valid badge DTO", () => {
      const validBadge = {
        slug: "first-rule",
        name: "First Rule",
        description: "Created your first rule",
        awardedAt: new Date(),
      };

      const result = badgeDTOSchema.parse(validBadge);
      expect(result).toEqual(validBadge);
    });

    it("should accept badge without awardedAt", () => {
      const validBadge = {
        slug: "first-rule",
        name: "First Rule",
        description: "Created your first rule",
      };

      const result = badgeDTOSchema.parse(validBadge);
      expect(result).toEqual(validBadge);
    });
  });

  describe("donationDTOSchema", () => {
    it("should accept valid donation DTO", () => {
      const validDonation = {
        id: "clkv6tv5l0001l608w5i10wdp",
        from: {
          id: "clkv6tv5l0001l608w5i10wdi",
          handle: "donor",
          displayName: "Generous Donor",
          avatarUrl: null,
        },
        to: {
          id: "clkv6tv5l0001l608w5i10wdq",
          handle: "author",
          displayName: "Rule Author",
          avatarUrl: "https://example.com/avatar.jpg",
        },
        rule: {
          id: "clkv6tv5l0001l608w5i10wdc",
          slug: "test-rule",
          title: "Test Rule",
        },
        amountCents: 1000,
        currency: "USD",
        status: "SUCCEEDED",
        createdAt: new Date(),
        message: "Great rule, thanks!",
      };

      const result = donationDTOSchema.parse(validDonation);
      expect(result).toEqual(validDonation);
    });

    it("should accept anonymous donation", () => {
      const validDonation = {
        id: "clkv6tv5l0001l608w5i10wdp",
        from: null,
        to: {
          id: "clkv6tv5l0001l608w5i10wdq",
          handle: "author",
          displayName: "Rule Author",
          avatarUrl: null,
        },
        rule: null,
        amountCents: 500,
        currency: "USD",
        status: "SUCCEEDED",
        createdAt: new Date(),
        message: null,
      };

      const result = donationDTOSchema.parse(validDonation);
      expect(result).toEqual(validDonation);
    });

    it("should accept all status values", () => {
      const statuses = ["INIT", "SUCCEEDED", "FAILED"];

      statuses.forEach((status) => {
        const validDonation = {
          id: "clkv6tv5l0001l608w5i10wdp",
          from: null,
          to: {
            id: "clkv6tv5l0001l608w5i10wdq",
            handle: "author",
            displayName: "Rule Author",
            avatarUrl: null,
          },
          rule: null,
          amountCents: 500,
          currency: "USD",
          status,
          createdAt: new Date(),
          message: null,
        };

        const result = donationDTOSchema.parse(validDonation);
        expect(result.status).toBe(status);
      });
    });

    it("should reject invalid status", () => {
      expect(() =>
        donationDTOSchema.parse({
          id: "clkv6tv5l0001l608w5i10wdp",
          from: null,
          to: {
            id: "clkv6tv5l0001l608w5i10wdq",
            handle: "author",
            displayName: "Rule Author",
            avatarUrl: null,
          },
          rule: null,
          amountCents: 500,
          currency: "USD",
          status: "INVALID_STATUS",
          createdAt: new Date(),
          message: null,
        })
      ).toThrow();
    });

    it("should accept negative amount", () => {
      const result = donationDTOSchema.parse({
        id: "clkv6tv5l0001l608w5i10wdp",
        from: null,
        to: {
          id: "clkv6tv5l0001l608w5i10wdq",
          handle: "author",
          displayName: "Rule Author",
          avatarUrl: null,
        },
        rule: null,
        amountCents: -100,
        currency: "USD",
        status: "SUCCEEDED",
        createdAt: new Date(),
        message: null,
      });
      expect(result.amountCents).toBe(-100);
    });
  });

  describe("authorDonationStatsDTOSchema", () => {
    it("should accept valid author donation stats", () => {
      const validStats = {
        totalCentsAllTime: 50000,
        totalCentsWindow: 10000,
        countWindow: 25,
        topRules: [
          {
            ruleId: "clkv6tv5l0001l608w5i10wde",
            slug: "popular-rule",
            title: "Popular Rule",
            totalCents: 5000,
            count: 10,
          },
        ],
        byDay: [
          {
            date: "2023-12-01",
            cents: 1000,
            count: 2,
          },
        ],
        recentDonors: [
          {
            id: "clkv6tv5l0001l608w5i10wdi",
            handle: "donor",
            displayName: "Generous Donor",
            avatarUrl: null,
            totalCents: 2000,
            lastDonationAt: new Date(),
          },
        ],
      };

      const result = authorDonationStatsDTOSchema.parse(validStats);
      expect(result).toEqual(validStats);
    });

    it("should accept empty arrays", () => {
      const validStats = {
        totalCentsAllTime: 0,
        totalCentsWindow: 0,
        countWindow: 0,
        topRules: [],
        byDay: [],
        recentDonors: [],
      };

      const result = authorDonationStatsDTOSchema.parse(validStats);
      expect(result).toEqual(validStats);
    });

    it("should accept negative values", () => {
      const result = authorDonationStatsDTOSchema.parse({
        totalCentsAllTime: -1,
        totalCentsWindow: 0,
        countWindow: 0,
        topRules: [],
        byDay: [],
        recentDonors: [],
      });
      expect(result.totalCentsAllTime).toBe(-1);
    });
  });

  describe("searchResultDTOSchema", () => {
    it("should accept valid search result", () => {
      const validResult = {
        id: "clkv6tv5l0001l608w5i10wdc",
        slug: "test-rule",
        title: "Test Rule",
        summary: "A test rule for validation",
        author: {
          id: "clkv6tv5l0001l608w5i10wdb",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: null,
        },
        tags: ["javascript", "ai"],
        primaryModel: "GPT-4",
        status: "PUBLISHED",
        score: 0.85,
        ftsRank: 0.9,
        trending: 0.75,
        snippetHtml: "<mark>Test</mark> rule content",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = searchResultDTOSchema.parse(validResult);
      expect(result).toEqual(validResult);
    });

    it("should accept result with null optional fields", () => {
      const validResult = {
        id: "clkv6tv5l0001l608w5i10wdc",
        slug: "test-rule",
        title: "Test Rule",
        summary: null,
        author: {
          id: "clkv6tv5l0001l608w5i10wdb",
          handle: "johndoe",
          displayName: "John Doe",
          avatarUrl: null,
        },
        tags: [],
        primaryModel: null,
        status: "DRAFT",
        score: 0.5,
        ftsRank: 0.6,
        trending: 0.4,
        snippetHtml: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = searchResultDTOSchema.parse(validResult);
      expect(result).toEqual(validResult);
    });
  });

  describe("searchSuggestionDTOSchema", () => {
    it("should accept valid search suggestion", () => {
      const validSuggestion = {
        id: "clkv6tv5l0001l608w5i10wdc",
        slug: "test-rule",
        title: "Test Rule",
        similarity: 0.95,
      };

      const result = searchSuggestionDTOSchema.parse(validSuggestion);
      expect(result).toEqual(validSuggestion);
    });

    it("should accept zero similarity", () => {
      const validSuggestion = {
        id: "clkv6tv5l0001l608w5i10wdc",
        slug: "test-rule",
        title: "Test Rule",
        similarity: 0,
      };

      const result = searchSuggestionDTOSchema.parse(validSuggestion);
      expect(result).toEqual(validSuggestion);
    });
  });

  describe("searchFacetDTOSchema", () => {
    it("should accept valid search facet", () => {
      const validFacet = {
        name: "tags",
        value: "javascript",
        count: 42,
        selected: true,
      };

      const result = searchFacetDTOSchema.parse(validFacet);
      expect(result).toEqual(validFacet);
    });

    it("should accept facet without selected field", () => {
      const validFacet = {
        name: "status",
        value: "published",
        count: 100,
      };

      const result = searchFacetDTOSchema.parse(validFacet);
      expect(result).toEqual(validFacet);
    });

    it("should accept negative count", () => {
      const result = searchFacetDTOSchema.parse({
        name: "tags",
        value: "javascript",
        count: -1,
      });
      expect(result.count).toBe(-1);
    });
  });

  describe("Type Exports", () => {
    it("should export all DTO types", () => {
      // This test ensures all types are properly exported
      const authorDTO: AuthorDTO = {
        id: "test",
        handle: "test",
        displayName: "Test",
        avatarUrl: null,
        role: "USER",
      };

      const tagDTO: TagDTO = {
        id: "test",
        slug: "test",
        name: "Test",
      };

      expect(authorDTO).toBeDefined();
      expect(tagDTO).toBeDefined();
    });
  });

  describe("Edge Cases and Integration", () => {
    it("should handle complex nested structures", () => {
      const complexRuleDetail = {
        id: "clkv6tv5l0001l608w5i10wdc",
        slug: "complex-rule",
        title: "Complex Rule",
        summary: "A complex rule with all features",
        contentType: "PROMPT",
        status: "PUBLISHED",
        primaryModel: "GPT-4",
        tags: [
          {
            id: "clkv6tv5l0001l608w5i10wds",
            slug: "javascript",
            name: "JavaScript",
            count: 100,
          },
          {
            id: "clkv6tv5l0001l608w5i10wdt",
            slug: "artificial-intelligence",
            name: "AI",
            count: 200,
          },
        ],
        score: 95.5,
        author: {
          id: "clkv6tv5l0001l608w5i10wdb",
          handle: "expert",
          displayName: "Expert User",
          avatarUrl: "https://example.com/avatar.jpg",
          role: "USER",
          isVerified: true,
        },
        currentVersion: {
          id: "clkv6tv5l0001l608w5i10wdf",
          version: "2.1.0",
          testedOn: {
            models: ["GPT-4"],
            stacks: ["javascript"],
          },
          createdAt: new Date(),
        },
        metrics: {
          views7: 1000,
          copies7: 250,
          saves7: 150,
          forks7: 50,
          score: 95.5,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        body: "Complex rule body with detailed instructions",
        resourceLinks: [
          {
            url: "https://docs.example.com",
            label: "Documentation",
            kind: "DOCS",
          },
          {
            url: "https://github.com/example/repo",
            label: "Source Code",
            kind: "GITHUB",
          },
        ],
        versionsCount: 5,
        commentsCount: 25,
        votesCount: 100,
        favoritesCount: 30,
        watchersCount: 45,
        userVote: "up",
        userFavorited: true,
        userWatching: true,
      };

      const result = ruleDetailDTOSchema.parse(complexRuleDetail);
      expect(result).toEqual(complexRuleDetail);
    });

    it("should handle deeply nested comments", () => {
      const deeplyNestedComment = {
        id: "clkv6tv5l0001l608w5i10wdd",
        ruleId: "clkv6tv5l0001l608w5i10wde",
        parentId: null,
        author: {
          id: "clkv6tv5l0001l608w5i10wdb",
          handle: "commenter1",
          displayName: "First Commenter",
          avatarUrl: null,
          role: "USER",
        },
        bodyHtml: "<p>Top level comment</p>",
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        edited: false,
        depth: 0,
        children: [
          {
            id: "clkv6tv5l0001l608w5i10wdl",
            ruleId: "clkv6tv5l0001l608w5i10wde",
            parentId: "comment_1",
            author: {
              id: "clkv6tv5l0001l608w5i10wdm",
              handle: "commenter2",
              displayName: "Second Commenter",
              avatarUrl: null,
              role: "USER",
            },
            bodyHtml: "<p>First level reply</p>",
            isDeleted: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            edited: false,
            depth: 1,
            children: [
              {
                id: "clkv6tv5l0001l608w5i10wdw",
                ruleId: "clkv6tv5l0001l608w5i10wde",
                parentId: "comment_2",
                author: {
                  id: "clkv6tv5l0001l608w5i10wdx",
                  handle: "commenter3",
                  displayName: "Third Commenter",
                  avatarUrl: null,
                  role: "USER",
                },
                bodyHtml: "<p>Second level reply</p>",
                isDeleted: false,
                createdAt: new Date(),
                updatedAt: new Date(),
                edited: false,
                depth: 2,
              },
            ],
          },
        ],
      };

      const result = commentDTOSchema.parse(deeplyNestedComment);
      expect(result).toEqual(deeplyNestedComment);
    });

    it("should handle boundary values", () => {
      // Test minimum positive values
      const minValues = {
        rank: 1,
        ruleId: "r",
        ruleSlug: "r",
        title: "R",
        author: {
          id: "a",
          handle: "a",
          displayName: "A",
          avatarUrl: null,
        },
        score: 0,
        copies: 0,
        views: 0,
      };

      const result = leaderboardEntryDTOSchema.parse(minValues);
      expect(result).toEqual(minValues);
    });

    it("should handle large numbers", () => {
      const largeNumbers = {
        views: {
          total: 999999999,
          last7Days: 1000000,
          last30Days: 5000000,
        },
        copies: {
          total: 999999999,
          last7Days: 100000,
          last30Days: 500000,
        },
        saves: {
          total: 999999999,
          last7Days: 50000,
          last30Days: 250000,
        },
        forks: {
          total: 999999999,
          last7Days: 10000,
          last30Days: 50000,
        },
        score: 999999.99,
        trend: "up",
      };

      const result = metricsSummaryDTOSchema.parse(largeNumbers);
      expect(result).toEqual(largeNumbers);
    });
  });
});
