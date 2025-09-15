import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  Notifications,
  type NotifyNewVersionParams,
  type NotifyCommentReplyParams,
  type NotifyAuthorPublishedParams,
  type NotifyClaimVerdictParams,
  type NotifyDonationReceivedParams,
} from "./notify";

// Mock the prisma client
vi.mock("@repo/db", () => ({
  prisma: {
    watch: {
      findMany: vi.fn(),
    },
    follow: {
      findMany: vi.fn(),
    },
    notification: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

// Get the mocked prisma instance
const { prisma } = await import("@repo/db");
const mockPrisma = prisma as any;

describe("Notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console.error to avoid noise in test output
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("newVersion", () => {
    const mockParams: NotifyNewVersionParams = {
      ruleId: "rule-123",
      ruleSlug: "test-rule",
      versionId: "version-456",
      version: "2.0.0",
      authorId: "author-789",
      authorHandle: "author",
      authorDisplayName: "Author Name",
    };

    it("should notify all watchers of new version", async () => {
      const mockWatchers = [
        { userId: "user-1" },
        { userId: "user-2" },
        { userId: "user-3" },
      ];

      mockPrisma.watch.findMany.mockResolvedValue(mockWatchers);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 3 });

      const result = await Notifications.newVersion(mockParams);

      expect(result).toBe(3);
      expect(mockPrisma.watch.findMany).toHaveBeenCalledWith({
        where: {
          ruleId: "rule-123",
          userId: { not: "author-789" },
        },
        select: { userId: true },
      });

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          {
            userId: "user-1",
            type: "NEW_VERSION",
            payload: {
              ruleId: "rule-123",
              ruleSlug: "test-rule",
              versionId: "version-456",
              version: "2.0.0",
              author: {
                id: "author-789",
                handle: "author",
                displayName: "Author Name",
              },
            },
          },
          {
            userId: "user-2",
            type: "NEW_VERSION",
            payload: {
              ruleId: "rule-123",
              ruleSlug: "test-rule",
              versionId: "version-456",
              version: "2.0.0",
              author: {
                id: "author-789",
                handle: "author",
                displayName: "Author Name",
              },
            },
          },
          {
            userId: "user-3",
            type: "NEW_VERSION",
            payload: {
              ruleId: "rule-123",
              ruleSlug: "test-rule",
              versionId: "version-456",
              version: "2.0.0",
              author: {
                id: "author-789",
                handle: "author",
                displayName: "Author Name",
              },
            },
          },
        ],
      });
    });

    it("should return 0 when no watchers exist", async () => {
      mockPrisma.watch.findMany.mockResolvedValue([]);

      const result = await Notifications.newVersion(mockParams);

      expect(result).toBe(0);
      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });

    it("should deduplicate watchers", async () => {
      const mockWatchers = [
        { userId: "user-1" },
        { userId: "user-2" },
        { userId: "user-1" }, // Duplicate
        { userId: "user-3" },
        { userId: "user-2" }, // Duplicate
      ];

      mockPrisma.watch.findMany.mockResolvedValue(mockWatchers);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 3 });

      const result = await Notifications.newVersion(mockParams);

      expect(result).toBe(3);
      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: "user-1" }),
          expect.objectContaining({ userId: "user-2" }),
          expect.objectContaining({ userId: "user-3" }),
        ]),
      });

      // Verify no duplicates in the data
      const createManyCall =
        mockPrisma.notification.createMany.mock.calls[0][0];
      const userIds = createManyCall.data.map((item: any) => item.userId);
      expect(userIds).toEqual(["user-1", "user-2", "user-3"]);
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.watch.findMany.mockRejectedValue(new Error("Database error"));

      const result = await Notifications.newVersion(mockParams);

      expect(result).toBe(0);
      expect(console.error).toHaveBeenCalledWith(
        "Failed to create new version notifications:",
        expect.any(Error)
      );
    });

    it("should handle notification creation errors gracefully", async () => {
      mockPrisma.watch.findMany.mockResolvedValue([{ userId: "user-1" }]);
      mockPrisma.notification.createMany.mockRejectedValue(
        new Error("Notification creation failed")
      );

      const result = await Notifications.newVersion(mockParams);

      expect(result).toBe(0);
      expect(console.error).toHaveBeenCalledWith(
        "Failed to create new version notifications:",
        expect.any(Error)
      );
    });
  });

  describe("commentReply", () => {
    const mockParams: NotifyCommentReplyParams = {
      ruleId: "rule-123",
      ruleSlug: "test-rule",
      commentId: "comment-456",
      parentAuthorId: "parent-author-789",
      actorUserId: "actor-101",
      actorHandle: "actor",
      actorDisplayName: "Actor Name",
    };

    it("should notify parent author and watchers", async () => {
      const mockWatchers = [
        { userId: "watcher-1" },
        { userId: "watcher-2" },
        { userId: "parent-author-789" }, // Should be deduplicated
      ];

      mockPrisma.watch.findMany.mockResolvedValue(mockWatchers);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 3 });

      const result = await Notifications.commentReply(mockParams);

      expect(result).toBe(3);
      expect(mockPrisma.watch.findMany).toHaveBeenCalledWith({
        where: {
          ruleId: "rule-123",
          userId: { not: "actor-101" },
        },
        select: { userId: true },
      });

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          {
            userId: "parent-author-789",
            type: "COMMENT_REPLY",
            payload: {
              ruleId: "rule-123",
              ruleSlug: "test-rule",
              commentId: "comment-456",
              parentId: "parent-author-789",
              actor: {
                id: "actor-101",
                handle: "actor",
                displayName: "Actor Name",
              },
            },
          },
          {
            userId: "watcher-1",
            type: "COMMENT_REPLY",
            payload: {
              ruleId: "rule-123",
              ruleSlug: "test-rule",
              commentId: "comment-456",
              parentId: "parent-author-789",
              actor: {
                id: "actor-101",
                handle: "actor",
                displayName: "Actor Name",
              },
            },
          },
          {
            userId: "watcher-2",
            type: "COMMENT_REPLY",
            payload: {
              ruleId: "rule-123",
              ruleSlug: "test-rule",
              commentId: "comment-456",
              parentId: "parent-author-789",
              actor: {
                id: "actor-101",
                handle: "actor",
                displayName: "Actor Name",
              },
            },
          },
        ]),
      });
    });

    it("should not notify parent author if they are the actor", async () => {
      const paramsWithActorAsParent = {
        ...mockParams,
        parentAuthorId: "actor-101", // Same as actorUserId
      };

      mockPrisma.watch.findMany.mockResolvedValue([{ userId: "watcher-1" }]);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });

      const result = await Notifications.commentReply(paramsWithActorAsParent);

      expect(result).toBe(1);

      const createManyCall =
        mockPrisma.notification.createMany.mock.calls[0][0];
      const userIds = createManyCall.data.map((item: any) => item.userId);
      expect(userIds).not.toContain("actor-101");
    });

    it("should handle no parent author", async () => {
      const paramsWithoutParent = {
        ...mockParams,
        parentAuthorId: undefined,
      };

      mockPrisma.watch.findMany.mockResolvedValue([{ userId: "watcher-1" }]);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });

      const result = await Notifications.commentReply(paramsWithoutParent);

      expect(result).toBe(1);
      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          {
            userId: "watcher-1",
            type: "COMMENT_REPLY",
            payload: {
              ruleId: "rule-123",
              ruleSlug: "test-rule",
              commentId: "comment-456",
              parentId: null,
              actor: {
                id: "actor-101",
                handle: "actor",
                displayName: "Actor Name",
              },
            },
          },
        ],
      });
    });

    it("should return 0 when no recipients", async () => {
      const paramsWithActorAsParent = {
        ...mockParams,
        parentAuthorId: "actor-101", // Same as actorUserId
      };

      mockPrisma.watch.findMany.mockResolvedValue([
        { userId: "actor-101" }, // Will be filtered out
      ]);

      const result = await Notifications.commentReply(paramsWithActorAsParent);

      expect(result).toBe(0);
      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });

    it("should exclude actor from watchers", async () => {
      mockPrisma.watch.findMany.mockResolvedValue([
        { userId: "watcher-1" },
        { userId: "actor-101" }, // Should be excluded
        { userId: "watcher-2" },
      ]);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 3 });

      const result = await Notifications.commentReply(mockParams);

      expect(result).toBe(3); // parent + 2 watchers (actor excluded)

      const createManyCall =
        mockPrisma.notification.createMany.mock.calls[0][0];
      const userIds = createManyCall.data.map((item: any) => item.userId);
      expect(userIds).toEqual(["parent-author-789", "watcher-1", "watcher-2"]);
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.watch.findMany.mockRejectedValue(new Error("Database error"));

      const result = await Notifications.commentReply(mockParams);

      expect(result).toBe(0);
      expect(console.error).toHaveBeenCalledWith(
        "Failed to create comment reply notifications:",
        expect.any(Error)
      );
    });
  });

  describe("authorPublished", () => {
    const mockParams: NotifyAuthorPublishedParams = {
      ruleId: "rule-123",
      ruleSlug: "test-rule",
      ruleTitle: "Test Rule Title",
      authorId: "author-789",
      authorHandle: "author",
      authorDisplayName: "Author Name",
    };

    it("should notify all followers", async () => {
      const mockFollowers = [
        { followerUserId: "follower-1" },
        { followerUserId: "follower-2" },
        { followerUserId: "follower-3" },
      ];

      mockPrisma.follow.findMany.mockResolvedValue(mockFollowers);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 3 });

      const result = await Notifications.authorPublished(mockParams);

      expect(result).toBe(3);
      expect(mockPrisma.follow.findMany).toHaveBeenCalledWith({
        where: { authorUserId: "author-789" },
        select: { followerUserId: true },
      });

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          {
            userId: "follower-1",
            type: "AUTHOR_PUBLISHED",
            payload: {
              ruleId: "rule-123",
              ruleSlug: "test-rule",
              ruleTitle: "Test Rule Title",
              author: {
                id: "author-789",
                handle: "author",
                displayName: "Author Name",
              },
            },
          },
          {
            userId: "follower-2",
            type: "AUTHOR_PUBLISHED",
            payload: {
              ruleId: "rule-123",
              ruleSlug: "test-rule",
              ruleTitle: "Test Rule Title",
              author: {
                id: "author-789",
                handle: "author",
                displayName: "Author Name",
              },
            },
          },
          {
            userId: "follower-3",
            type: "AUTHOR_PUBLISHED",
            payload: {
              ruleId: "rule-123",
              ruleSlug: "test-rule",
              ruleTitle: "Test Rule Title",
              author: {
                id: "author-789",
                handle: "author",
                displayName: "Author Name",
              },
            },
          },
        ],
      });
    });

    it("should return 0 when no followers exist", async () => {
      mockPrisma.follow.findMany.mockResolvedValue([]);

      const result = await Notifications.authorPublished(mockParams);

      expect(result).toBe(0);
      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled();
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.follow.findMany.mockRejectedValue(new Error("Database error"));

      const result = await Notifications.authorPublished(mockParams);

      expect(result).toBe(0);
      expect(console.error).toHaveBeenCalledWith(
        "Failed to create author published notifications:",
        expect.any(Error)
      );
    });
  });

  describe("claimVerdict", () => {
    const mockApprovedParams: NotifyClaimVerdictParams = {
      userId: "user-123",
      ruleId: "rule-456",
      ruleSlug: "test-rule",
      ruleTitle: "Test Rule Title",
      verdict: "APPROVED",
      reviewerHandle: "reviewer",
    };

    const mockRejectedParams: NotifyClaimVerdictParams = {
      userId: "user-123",
      ruleId: "rule-456",
      ruleSlug: "test-rule",
      ruleTitle: "Test Rule Title",
      verdict: "REJECTED",
      reviewerHandle: "reviewer",
    };

    it("should create approved claim notification", async () => {
      mockPrisma.notification.create.mockResolvedValue({
        id: "notification-1",
      });

      const result = await Notifications.claimVerdict(mockApprovedParams);

      expect(result).toBe(1);
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: "user-123",
          type: "CLAIM_VERDICT",
          payload: {
            ruleId: "rule-456",
            ruleSlug: "test-rule",
            ruleTitle: "Test Rule Title",
            verdict: "APPROVED",
            reviewer: {
              handle: "reviewer",
            },
          },
        },
      });
    });

    it("should create rejected claim notification", async () => {
      mockPrisma.notification.create.mockResolvedValue({
        id: "notification-1",
      });

      const result = await Notifications.claimVerdict(mockRejectedParams);

      expect(result).toBe(1);
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: "user-123",
          type: "CLAIM_VERDICT",
          payload: {
            ruleId: "rule-456",
            ruleSlug: "test-rule",
            ruleTitle: "Test Rule Title",
            verdict: "REJECTED",
            reviewer: {
              handle: "reviewer",
            },
          },
        },
      });
    });

    it("should handle no reviewer handle", async () => {
      const paramsWithoutReviewer = {
        ...mockApprovedParams,
        reviewerHandle: undefined,
      };

      mockPrisma.notification.create.mockResolvedValue({
        id: "notification-1",
      });

      const result = await Notifications.claimVerdict(paramsWithoutReviewer);

      expect(result).toBe(1);
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: "user-123",
          type: "CLAIM_VERDICT",
          payload: {
            ruleId: "rule-456",
            ruleSlug: "test-rule",
            ruleTitle: "Test Rule Title",
            verdict: "APPROVED",
            reviewer: null,
          },
        },
      });
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.notification.create.mockRejectedValue(
        new Error("Database error")
      );

      const result = await Notifications.claimVerdict(mockApprovedParams);

      expect(result).toBe(0);
      expect(console.error).toHaveBeenCalledWith(
        "Failed to create claim verdict notification:",
        expect.any(Error)
      );
    });
  });

  describe("donationReceived", () => {
    const mockParamsWithUser: NotifyDonationReceivedParams = {
      toUserId: "recipient-123",
      donationId: "donation-456",
      amountCents: 2500,
      currency: "USD",
      fromUserId: "donor-789",
      fromUserHandle: "donor",
      fromUserDisplayName: "Donor Name",
      ruleId: "rule-101",
      ruleSlug: "test-rule",
    };

    const mockParamsAnonymous: NotifyDonationReceivedParams = {
      toUserId: "recipient-123",
      donationId: "donation-456",
      amountCents: 1000,
      currency: "EUR",
    };

    it("should create donation notification with user and rule", async () => {
      mockPrisma.notification.create.mockResolvedValue({
        id: "notification-1",
      });

      const result = await Notifications.donationReceived(mockParamsWithUser);

      expect(result).toBe(1);
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: "recipient-123",
          type: "DONATION_RECEIVED",
          payload: {
            donationId: "donation-456",
            amountCents: 2500,
            currency: "USD",
            fromUser: {
              id: "donor-789",
              handle: "donor",
              displayName: "Donor Name",
            },
            rule: {
              id: "rule-101",
              slug: "test-rule",
            },
          },
        },
      });
    });

    it("should create anonymous donation notification", async () => {
      mockPrisma.notification.create.mockResolvedValue({
        id: "notification-1",
      });

      const result = await Notifications.donationReceived(mockParamsAnonymous);

      expect(result).toBe(1);
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: "recipient-123",
          type: "DONATION_RECEIVED",
          payload: {
            donationId: "donation-456",
            amountCents: 1000,
            currency: "EUR",
            fromUser: null,
            rule: null,
          },
        },
      });
    });

    it("should handle partial user information", async () => {
      const paramsPartialUser = {
        ...mockParamsWithUser,
        fromUserDisplayName: undefined,
      };

      mockPrisma.notification.create.mockResolvedValue({
        id: "notification-1",
      });

      const result = await Notifications.donationReceived(paramsPartialUser);

      expect(result).toBe(1);
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: "recipient-123",
          type: "DONATION_RECEIVED",
          payload: {
            donationId: "donation-456",
            amountCents: 2500,
            currency: "USD",
            fromUser: {
              id: "donor-789",
              handle: "donor",
              displayName: undefined,
            },
            rule: {
              id: "rule-101",
              slug: "test-rule",
            },
          },
        },
      });
    });

    it("should handle database errors gracefully", async () => {
      mockPrisma.notification.create.mockRejectedValue(
        new Error("Database error")
      );

      const result = await Notifications.donationReceived(mockParamsWithUser);

      expect(result).toBe(0);
      expect(console.error).toHaveBeenCalledWith(
        "Failed to create donation received notification:",
        expect.any(Error)
      );
    });
  });

  describe("parseNotificationForUI", () => {
    it("should parse NEW_VERSION notification", () => {
      const notification = {
        id: "notif-1",
        type: "NEW_VERSION" as const,
        payload: {
          version: "2.0.0",
          ruleSlug: "test-rule",
          versionId: "version-123",
          author: {
            id: "author-1",
            handle: "author",
            displayName: "Author Name",
          },
        },
        readAt: null,
        createdAt: new Date(),
      };

      const result = Notifications.parseNotificationForUI(notification);

      expect(result).toEqual({
        title: "New Version Published",
        message: "Version 2.0.0 of test-rule is now available",
        actionUrl: "/rules/test-rule/versions/version-123",
        actor: {
          id: "author-1",
          handle: "author",
          displayName: "Author Name",
          avatarUrl: null,
        },
      });
    });

    it("should parse NEW_VERSION notification without author", () => {
      const notification = {
        id: "notif-1",
        type: "NEW_VERSION" as const,
        payload: {
          version: "2.0.0",
          ruleSlug: "test-rule",
          versionId: "version-123",
          author: null,
        },
        readAt: null,
        createdAt: new Date(),
      };

      const result = Notifications.parseNotificationForUI(notification);

      expect(result).toEqual({
        title: "New Version Published",
        message: "Version 2.0.0 of test-rule is now available",
        actionUrl: "/rules/test-rule/versions/version-123",
        actor: undefined,
      });
    });

    it("should parse COMMENT_REPLY notification", () => {
      const notification = {
        id: "notif-1",
        type: "COMMENT_REPLY" as const,
        payload: {
          ruleSlug: "test-rule",
          commentId: "comment-123",
          actor: {
            id: "actor-1",
            handle: "actor",
            displayName: "Actor Name",
          },
        },
        readAt: null,
        createdAt: new Date(),
      };

      const result = Notifications.parseNotificationForUI(notification);

      expect(result).toEqual({
        title: "New Reply",
        message: "Actor Name replied to a comment on test-rule",
        actionUrl: "/rules/test-rule#comment-comment-123",
        actor: {
          id: "actor-1",
          handle: "actor",
          displayName: "Actor Name",
          avatarUrl: null,
        },
      });
    });

    it("should parse COMMENT_REPLY notification without actor", () => {
      const notification = {
        id: "notif-1",
        type: "COMMENT_REPLY" as const,
        payload: {
          ruleSlug: "test-rule",
          commentId: "comment-123",
          actor: null,
        },
        readAt: null,
        createdAt: new Date(),
      };

      const result = Notifications.parseNotificationForUI(notification);

      expect(result).toEqual({
        title: "New Reply",
        message: "Someone replied to a comment on test-rule",
        actionUrl: "/rules/test-rule#comment-comment-123",
        actor: undefined,
      });
    });

    it("should parse AUTHOR_PUBLISHED notification", () => {
      const notification = {
        id: "notif-1",
        type: "AUTHOR_PUBLISHED" as const,
        payload: {
          ruleSlug: "test-rule",
          ruleTitle: "Test Rule Title",
          author: {
            id: "author-1",
            handle: "author",
            displayName: "Author Name",
          },
        },
        readAt: null,
        createdAt: new Date(),
      };

      const result = Notifications.parseNotificationForUI(notification);

      expect(result).toEqual({
        title: "New Rule Published",
        message: 'Author Name published "Test Rule Title"',
        actionUrl: "/rules/test-rule",
        actor: {
          id: "author-1",
          handle: "author",
          displayName: "Author Name",
          avatarUrl: null,
        },
      });
    });

    it("should parse AUTHOR_PUBLISHED notification without author", () => {
      const notification = {
        id: "notif-1",
        type: "AUTHOR_PUBLISHED" as const,
        payload: {
          ruleSlug: "test-rule",
          ruleTitle: "Test Rule Title",
          author: null,
        },
        readAt: null,
        createdAt: new Date(),
      };

      const result = Notifications.parseNotificationForUI(notification);

      expect(result).toEqual({
        title: "New Rule Published",
        message: 'An author you follow published "Test Rule Title"',
        actionUrl: "/rules/test-rule",
        actor: undefined,
      });
    });

    it("should parse CLAIM_VERDICT notification for approval", () => {
      const notification = {
        id: "notif-1",
        type: "CLAIM_VERDICT" as const,
        payload: {
          ruleSlug: "test-rule",
          ruleTitle: "Test Rule Title",
          verdict: "APPROVED",
        },
        readAt: null,
        createdAt: new Date(),
      };

      const result = Notifications.parseNotificationForUI(notification);

      expect(result).toEqual({
        title: "Claim APPROVED",
        message: 'Your claim on "Test Rule Title" was approved',
        actionUrl: "/rules/test-rule",
      });
    });

    it("should parse CLAIM_VERDICT notification for rejection", () => {
      const notification = {
        id: "notif-1",
        type: "CLAIM_VERDICT" as const,
        payload: {
          ruleSlug: "test-rule",
          ruleTitle: "Test Rule Title",
          verdict: "REJECTED",
        },
        readAt: null,
        createdAt: new Date(),
      };

      const result = Notifications.parseNotificationForUI(notification);

      expect(result).toEqual({
        title: "Claim REJECTED",
        message: 'Your claim on "Test Rule Title" was rejected',
        actionUrl: "/rules/test-rule",
      });
    });

    it("should parse DONATION_RECEIVED notification with user and rule", () => {
      const notification = {
        id: "notif-1",
        type: "DONATION_RECEIVED" as const,
        payload: {
          amountCents: 2500,
          currency: "USD",
          fromUser: {
            id: "donor-1",
            handle: "donor",
            displayName: "Donor Name",
          },
          rule: {
            slug: "test-rule",
          },
        },
        readAt: null,
        createdAt: new Date(),
      };

      const result = Notifications.parseNotificationForUI(notification);

      expect(result).toEqual({
        title: "Donation Received",
        message: "You received USD 25.00 from Donor Name",
        actionUrl: "/rules/test-rule",
        actor: {
          id: "donor-1",
          handle: "donor",
          displayName: "Donor Name",
          avatarUrl: null,
        },
      });
    });

    it("should parse DONATION_RECEIVED notification anonymous", () => {
      const notification = {
        id: "notif-1",
        type: "DONATION_RECEIVED" as const,
        payload: {
          amountCents: 1000,
          currency: "EUR",
          fromUser: null,
          rule: null,
        },
        readAt: null,
        createdAt: new Date(),
      };

      const result = Notifications.parseNotificationForUI(notification);

      expect(result).toEqual({
        title: "Donation Received",
        message: "You received EUR 10.00 from Anonymous",
        actionUrl: "/donations",
        actor: undefined,
      });
    });

    it("should handle unknown notification type", () => {
      const notification = {
        id: "notif-1",
        type: "UNKNOWN_TYPE" as any,
        payload: {},
        readAt: null,
        createdAt: new Date(),
      };

      const result = Notifications.parseNotificationForUI(notification);

      expect(result).toEqual({
        title: "Notification",
        message: "You have a new notification",
      });
    });

    it("should handle decimal amounts correctly", () => {
      const notification = {
        id: "notif-1",
        type: "DONATION_RECEIVED" as const,
        payload: {
          amountCents: 1250, // $12.50
          currency: "USD",
          fromUser: {
            displayName: "Test User",
          },
          rule: null,
        },
        readAt: null,
        createdAt: new Date(),
      };

      const result = Notifications.parseNotificationForUI(notification);

      expect(result.message).toBe("You received USD 12.50 from Test User");
    });

    it("should handle zero amount", () => {
      const notification = {
        id: "notif-1",
        type: "DONATION_RECEIVED" as const,
        payload: {
          amountCents: 0,
          currency: "USD",
          fromUser: null,
          rule: null,
        },
        readAt: null,
        createdAt: new Date(),
      };

      const result = Notifications.parseNotificationForUI(notification);

      expect(result.message).toBe("You received USD 0.00 from Anonymous");
    });
  });
});
