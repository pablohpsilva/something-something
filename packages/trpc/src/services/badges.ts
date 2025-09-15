import { prisma } from "@repo/db/client";
import type { Badge, UserBadge } from "@repo/db";

export class BadgeService {
  /**
   * Check and award Early Adopter badge (first 100 users)
   */
  async checkEarlyAdopterBadge(userId: string): Promise<boolean> {
    const badge = await prisma.badge.findUnique({
      where: { slug: "early-adopter" },
    });

    if (!badge) return false;

    // Check if user already has this badge
    const existingBadge = await prisma.userBadge.findUnique({
      where: {
        userId_badgeId: {
          userId,
          badgeId: badge.id,
        },
      },
    });

    if (existingBadge) return false;

    // Check if user is in first 100
    const userCount = await prisma.user.count({
      where: {
        createdAt: {
          lte: (
            await prisma.user.findUnique({ where: { id: userId } })
          )?.createdAt,
        },
      },
    });

    if (userCount <= 100) {
      await prisma.userBadge.create({
        data: {
          userId,
          badgeId: badge.id,
          awardedAt: new Date(),
        },
      });
      return true;
    }

    return false;
  }

  /**
   * Check and award Prolific Author badge (10+ published rules)
   */
  async checkProlificAuthorBadge(userId: string): Promise<boolean> {
    const badge = await prisma.badge.findUnique({
      where: { slug: "prolific-author" },
    });

    if (!badge) return false;

    // Check if user already has this badge
    const existingBadge = await prisma.userBadge.findUnique({
      where: {
        userId_badgeId: {
          userId,
          badgeId: badge.id,
        },
      },
    });

    if (existingBadge) return false;

    const ruleCount = await prisma.rule.count({
      where: {
        createdByUserId: userId,
        status: "PUBLISHED",
      },
    });

    if (ruleCount >= 10) {
      await prisma.userBadge.create({
        data: {
          userId,
          badgeId: badge.id,
          awardedAt: new Date(),
        },
      });
      return true;
    }

    return false;
  }

  /**
   * Check and award Community Champion badge (high engagement)
   */
  async checkCommunityChampionBadge(userId: string): Promise<boolean> {
    const badge = await prisma.badge.findUnique({
      where: { slug: "community-champion" },
    });

    if (!badge) return false;

    // Check if user already has this badge
    const existingBadge = await prisma.userBadge.findUnique({
      where: {
        userId_badgeId: {
          userId,
          badgeId: badge.id,
        },
      },
    });

    if (existingBadge) return false;

    // Check engagement metrics
    const [votesGiven, commentsMade] = await Promise.all([
      prisma.vote.count({ where: { userId } }),
      prisma.comment.count({ where: { authorUserId: userId } }),
    ]);

    // High engagement threshold: 100+ votes and 50+ comments
    if (votesGiven >= 100 && commentsMade >= 50) {
      await prisma.userBadge.create({
        data: {
          userId,
          badgeId: badge.id,
          awardedAt: new Date(),
        },
      });
      return true;
    }

    return false;
  }

  /**
   * Check and award Generous Donor badge ($100+ donated)
   */
  async checkGenerousDonorBadge(userId: string): Promise<boolean> {
    const badge = await prisma.badge.findUnique({
      where: { slug: "generous-donor" },
    });

    if (!badge) return false;

    // Check if user already has this badge
    const existingBadge = await prisma.userBadge.findUnique({
      where: {
        userId_badgeId: {
          userId,
          badgeId: badge.id,
        },
      },
    });

    if (existingBadge) return false;

    const totalDonated = await prisma.donation.aggregate({
      where: {
        fromUserId: userId,
        status: "SUCCEEDED",
      },
      _sum: {
        amountCents: true,
      },
    });

    const totalCents = totalDonated._sum?.amountCents || 0;
    if (totalCents >= 10000) {
      // $100 in cents
      await prisma.userBadge.create({
        data: {
          userId,
          badgeId: badge.id,
          awardedAt: new Date(),
        },
      });
      return true;
    }

    return false;
  }

  /**
   * Check all badges for a user
   */
  async checkAllBadges(userId: string): Promise<string[]> {
    const awarded: string[] = [];

    const checks = [
      { method: this.checkEarlyAdopterBadge.bind(this), name: "early-adopter" },
      {
        method: this.checkProlificAuthorBadge.bind(this),
        name: "prolific-author",
      },
      {
        method: this.checkCommunityChampionBadge.bind(this),
        name: "community-champion",
      },
      {
        method: this.checkGenerousDonorBadge.bind(this),
        name: "generous-donor",
      },
    ];

    for (const check of checks) {
      try {
        const wasAwarded = await check.method(userId);
        if (wasAwarded) {
          awarded.push(check.name);
        }
      } catch (error) {
        console.error(
          `Error checking badge ${check.name} for user ${userId}:`,
          error
        );
      }
    }

    return awarded;
  }
}
