import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { BadgeService } from "./badges";

// Mock dependencies
vi.mock("@repo/db/client", () => ({
  prisma: {
    badge: {
      findUnique: vi.fn(),
    },
    userBadge: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: {
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    rule: {
      count: vi.fn(),
    },
    vote: {
      count: vi.fn(),
    },
    comment: {
      count: vi.fn(),
    },
    donation: {
      aggregate: vi.fn(),
    },
  },
}));

import { prisma } from "@repo/db/client";

// Mock data
const mockBadge = {
  id: "badge123",
  slug: "early-adopter",
  name: "Early Adopter",
  description: "One of the first 100 users",
  icon: "star",
  color: "#gold",
  createdAt: new Date("2024-01-01"),
};

const mockUserBadge = {
  id: "userbadge123",
  userId: "user123",
  badgeId: "badge123",
  awardedAt: new Date("2024-01-15"),
};

const mockUser = {
  id: "user123",
  displayName: "Test User",
  handle: "testuser",
  createdAt: new Date("2024-01-10"),
};

describe("BadgeService", () => {
  let badgeService: BadgeService;

  beforeEach(() => {
    badgeService = new BadgeService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("checkEarlyAdopterBadge", () => {
    it("should award badge to early adopter (user count <= 100)", async () => {
      (prisma.badge.findUnique as any).mockResolvedValue(mockBadge);
      (prisma.userBadge.findUnique as any).mockResolvedValue(null);
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.user.count as any).mockResolvedValue(50);
      (prisma.userBadge.create as any).mockResolvedValue(mockUserBadge);

      const result = await badgeService.checkEarlyAdopterBadge("user123");

      expect(result).toBe(true);
      expect(prisma.badge.findUnique).toHaveBeenCalledWith({
        where: { slug: "early-adopter" },
      });
      expect(prisma.userBadge.findUnique).toHaveBeenCalledWith({
        where: {
          userId_badgeId: {
            userId: "user123",
            badgeId: "badge123",
          },
        },
      });
      expect(prisma.user.count).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lte: mockUser.createdAt,
          },
        },
      });
      expect(prisma.userBadge.create).toHaveBeenCalledWith({
        data: {
          userId: "user123",
          badgeId: "badge123",
          awardedAt: expect.any(Date),
        },
      });
    });

    it("should award badge to exactly 100th user", async () => {
      (prisma.badge.findUnique as any).mockResolvedValue(mockBadge);
      (prisma.userBadge.findUnique as any).mockResolvedValue(null);
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.user.count as any).mockResolvedValue(100);
      (prisma.userBadge.create as any).mockResolvedValue(mockUserBadge);

      const result = await badgeService.checkEarlyAdopterBadge("user123");

      expect(result).toBe(true);
      expect(prisma.userBadge.create).toHaveBeenCalled();
    });

    it("should not award badge if badge doesn't exist", async () => {
      (prisma.badge.findUnique as any).mockResolvedValue(null);

      const result = await badgeService.checkEarlyAdopterBadge("user123");

      expect(result).toBe(false);
      expect(prisma.userBadge.findUnique).not.toHaveBeenCalled();
      expect(prisma.userBadge.create).not.toHaveBeenCalled();
    });

    it("should not award badge if user already has it", async () => {
      (prisma.badge.findUnique as any).mockResolvedValue(mockBadge);
      (prisma.userBadge.findUnique as any).mockResolvedValue(mockUserBadge);

      const result = await badgeService.checkEarlyAdopterBadge("user123");

      expect(result).toBe(false);
      expect(prisma.user.count).not.toHaveBeenCalled();
      expect(prisma.userBadge.create).not.toHaveBeenCalled();
    });

    it("should not award badge if user count > 100", async () => {
      (prisma.badge.findUnique as any).mockResolvedValue(mockBadge);
      (prisma.userBadge.findUnique as any).mockResolvedValue(null);
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.user.count as any).mockResolvedValue(150);

      const result = await badgeService.checkEarlyAdopterBadge("user123");

      expect(result).toBe(false);
      expect(prisma.userBadge.create).not.toHaveBeenCalled();
    });

    it("should handle case when user is not found", async () => {
      (prisma.badge.findUnique as any).mockResolvedValue(mockBadge);
      (prisma.userBadge.findUnique as any).mockResolvedValue(null);
      (prisma.user.findUnique as any).mockResolvedValue(null);
      (prisma.user.count as any).mockResolvedValue(50);
      (prisma.userBadge.create as any).mockResolvedValue(mockUserBadge);

      const result = await badgeService.checkEarlyAdopterBadge("user123");

      // Should still award badge if count <= 100, even with null user createdAt
      expect(result).toBe(true);
      expect(prisma.user.count).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lte: undefined,
          },
        },
      });
      expect(prisma.userBadge.create).toHaveBeenCalled();
    });
  });

  describe("checkProlificAuthorBadge", () => {
    it("should award badge for 10+ published rules", async () => {
      const prolificBadge = { ...mockBadge, slug: "prolific-author" };
      (prisma.badge.findUnique as any).mockResolvedValue(prolificBadge);
      (prisma.userBadge.findUnique as any).mockResolvedValue(null);
      (prisma.rule.count as any).mockResolvedValue(15);
      (prisma.userBadge.create as any).mockResolvedValue(mockUserBadge);

      const result = await badgeService.checkProlificAuthorBadge("user123");

      expect(result).toBe(true);
      expect(prisma.badge.findUnique).toHaveBeenCalledWith({
        where: { slug: "prolific-author" },
      });
      expect(prisma.rule.count).toHaveBeenCalledWith({
        where: {
          createdByUserId: "user123",
          status: "PUBLISHED",
        },
      });
      expect(prisma.userBadge.create).toHaveBeenCalled();
    });

    it("should award badge for exactly 10 published rules", async () => {
      const prolificBadge = { ...mockBadge, slug: "prolific-author" };
      (prisma.badge.findUnique as any).mockResolvedValue(prolificBadge);
      (prisma.userBadge.findUnique as any).mockResolvedValue(null);
      (prisma.rule.count as any).mockResolvedValue(10);
      (prisma.userBadge.create as any).mockResolvedValue(mockUserBadge);

      const result = await badgeService.checkProlificAuthorBadge("user123");

      expect(result).toBe(true);
      expect(prisma.userBadge.create).toHaveBeenCalled();
    });

    it("should not award badge if badge doesn't exist", async () => {
      (prisma.badge.findUnique as any).mockResolvedValue(null);

      const result = await badgeService.checkProlificAuthorBadge("user123");

      expect(result).toBe(false);
      expect(prisma.userBadge.create).not.toHaveBeenCalled();
    });

    it("should not award badge if user already has it", async () => {
      const prolificBadge = { ...mockBadge, slug: "prolific-author" };
      (prisma.badge.findUnique as any).mockResolvedValue(prolificBadge);
      (prisma.userBadge.findUnique as any).mockResolvedValue(mockUserBadge);

      const result = await badgeService.checkProlificAuthorBadge("user123");

      expect(result).toBe(false);
      expect(prisma.rule.count).not.toHaveBeenCalled();
      expect(prisma.userBadge.create).not.toHaveBeenCalled();
    });

    it("should not award badge if rule count < 10", async () => {
      const prolificBadge = { ...mockBadge, slug: "prolific-author" };
      (prisma.badge.findUnique as any).mockResolvedValue(prolificBadge);
      (prisma.userBadge.findUnique as any).mockResolvedValue(null);
      (prisma.rule.count as any).mockResolvedValue(5);

      const result = await badgeService.checkProlificAuthorBadge("user123");

      expect(result).toBe(false);
      expect(prisma.userBadge.create).not.toHaveBeenCalled();
    });
  });

  describe("checkCommunityChampionBadge", () => {
    it("should award badge for high engagement (100+ votes, 50+ comments)", async () => {
      const championBadge = { ...mockBadge, slug: "community-champion" };
      (prisma.badge.findUnique as any).mockResolvedValue(championBadge);
      (prisma.userBadge.findUnique as any).mockResolvedValue(null);
      (prisma.vote.count as any).mockResolvedValue(120);
      (prisma.comment.count as any).mockResolvedValue(75);
      (prisma.userBadge.create as any).mockResolvedValue(mockUserBadge);

      const result = await badgeService.checkCommunityChampionBadge("user123");

      expect(result).toBe(true);
      expect(prisma.badge.findUnique).toHaveBeenCalledWith({
        where: { slug: "community-champion" },
      });
      expect(prisma.vote.count).toHaveBeenCalledWith({
        where: { userId: "user123" },
      });
      expect(prisma.comment.count).toHaveBeenCalledWith({
        where: { authorUserId: "user123" },
      });
      expect(prisma.userBadge.create).toHaveBeenCalled();
    });

    it("should not award badge if vote count < 100", async () => {
      const championBadge = { ...mockBadge, slug: "community-champion" };
      (prisma.badge.findUnique as any).mockResolvedValue(championBadge);
      (prisma.userBadge.findUnique as any).mockResolvedValue(null);
      (prisma.vote.count as any).mockResolvedValue(80);
      (prisma.comment.count as any).mockResolvedValue(60);

      const result = await badgeService.checkCommunityChampionBadge("user123");

      expect(result).toBe(false);
      expect(prisma.userBadge.create).not.toHaveBeenCalled();
    });
  });

  describe("checkGenerousDonorBadge", () => {
    it("should award badge for $100+ donated", async () => {
      const donorBadge = { ...mockBadge, slug: "generous-donor" };
      (prisma.badge.findUnique as any).mockResolvedValue(donorBadge);
      (prisma.userBadge.findUnique as any).mockResolvedValue(null);
      (prisma.donation.aggregate as any).mockResolvedValue({
        _sum: { amountCents: 15000 },
      });
      (prisma.userBadge.create as any).mockResolvedValue(mockUserBadge);

      const result = await badgeService.checkGenerousDonorBadge("user123");

      expect(result).toBe(true);
      expect(prisma.donation.aggregate).toHaveBeenCalledWith({
        where: {
          fromUserId: "user123",
          status: "SUCCEEDED",
        },
        _sum: {
          amountCents: true,
        },
      });
    });

    it("should handle null donation result", async () => {
      const donorBadge = { ...mockBadge, slug: "generous-donor" };
      (prisma.badge.findUnique as any).mockResolvedValue(donorBadge);
      (prisma.userBadge.findUnique as any).mockResolvedValue(null);
      (prisma.donation.aggregate as any).mockResolvedValue({
        _sum: { amountCents: null },
      });

      const result = await badgeService.checkGenerousDonorBadge("user123");

      expect(result).toBe(false);
    });
  });

  describe("checkAllBadges", () => {
    it("should check all badges and return awarded ones", async () => {
      const badges = [
        { ...mockBadge, slug: "early-adopter" },
        { ...mockBadge, slug: "prolific-author", id: "badge456" },
        { ...mockBadge, slug: "community-champion", id: "badge789" },
        { ...mockBadge, slug: "generous-donor", id: "badge101" },
      ];

      (prisma.badge.findUnique as any)
        .mockResolvedValueOnce(badges[0])
        .mockResolvedValueOnce(badges[1])
        .mockResolvedValueOnce(badges[2])
        .mockResolvedValueOnce(badges[3]);
      (prisma.userBadge.findUnique as any).mockResolvedValue(null);
      (prisma.user.findUnique as any).mockResolvedValue(mockUser);
      (prisma.user.count as any).mockResolvedValue(50);
      (prisma.rule.count as any).mockResolvedValue(15);
      (prisma.vote.count as any).mockResolvedValue(120);
      (prisma.comment.count as any).mockResolvedValue(75);
      (prisma.donation.aggregate as any).mockResolvedValue({
        _sum: { amountCents: 15000 },
      });
      (prisma.userBadge.create as any).mockResolvedValue(mockUserBadge);

      const result = await badgeService.checkAllBadges("user123");

      expect(result).toEqual([
        "early-adopter",
        "prolific-author",
        "community-champion",
        "generous-donor",
      ]);
      expect(prisma.userBadge.create).toHaveBeenCalledTimes(4);
    });

    it("should handle errors gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      (prisma.badge.findUnique as any).mockRejectedValue(
        new Error("Database error")
      );

      const result = await badgeService.checkAllBadges("user123");

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledTimes(4);

      consoleSpy.mockRestore();
    });
  });
});
