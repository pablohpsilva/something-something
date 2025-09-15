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

      const result = await badgeService.checkEarlyAdopterBadge("user123");

      expect(result).toBe(false);
      expect(prisma.user.count).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lte: undefined,
          },
        },
      });
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