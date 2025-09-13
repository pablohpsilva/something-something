import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BadgeService } from '../badges'
import type { Badge, User, UserBadge } from '@repo/db'

// Mock Prisma
const mockPrisma = {
  badge: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  userBadge: {
    findUnique: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
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
}

vi.mock('@repo/db/client', () => ({
  prisma: mockPrisma,
}))

describe('BadgeService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkEarlyAdopterBadge', () => {
    it('should award early adopter badge to users who joined within first 100', async () => {
      const mockUsers = [
        { id: 'user1', createdAt: new Date('2024-01-01') },
        { id: 'user2', createdAt: new Date('2024-01-02') },
      ] as User[]

      const mockBadge = {
        id: 'badge1',
        slug: 'early-adopter',
        name: 'Early Adopter',
      } as Badge

      mockPrisma.badge.findUnique.mockResolvedValue(mockBadge)
      mockPrisma.user.findMany.mockResolvedValue(mockUsers)
      mockPrisma.userBadge.findUnique.mockResolvedValue(null)
      mockPrisma.userBadge.create.mockResolvedValue({
        userId: 'user1',
        badgeId: 'badge1',
      })

      const service = new BadgeService()
      const result = await service.checkEarlyAdopterBadge('user1')

      expect(result).toBeTruthy()
      expect(mockPrisma.userBadge.create).toHaveBeenCalledWith({
        data: {
          userId: 'user1',
          badgeId: 'badge1',
          awardedAt: expect.any(Date),
        },
      })
    })

    it('should not award badge if user already has it', async () => {
      const mockBadge = {
        id: 'badge1',
        slug: 'early-adopter',
        name: 'Early Adopter',
      } as Badge

      const existingUserBadge = {
        userId: 'user1',
        badgeId: 'badge1',
      } as UserBadge

      mockPrisma.badge.findUnique.mockResolvedValue(mockBadge)
      mockPrisma.userBadge.findUnique.mockResolvedValue(existingUserBadge)

      const service = new BadgeService()
      const result = await service.checkEarlyAdopterBadge('user1')

      expect(result).toBeFalsy()
      expect(mockPrisma.userBadge.create).not.toHaveBeenCalled()
    })
  })

  describe('checkProlificAuthorBadge', () => {
    it('should award badge when user has 10+ published rules', async () => {
      const mockBadge = {
        id: 'badge2',
        slug: 'prolific-author',
        name: 'Prolific Author',
      } as Badge

      mockPrisma.badge.findUnique.mockResolvedValue(mockBadge)
      mockPrisma.rule.count.mockResolvedValue(12)
      mockPrisma.userBadge.findUnique.mockResolvedValue(null)
      mockPrisma.userBadge.create.mockResolvedValue({
        userId: 'user1',
        badgeId: 'badge2',
      })

      const service = new BadgeService()
      const result = await service.checkProlificAuthorBadge('user1')

      expect(result).toBeTruthy()
      expect(mockPrisma.rule.count).toHaveBeenCalledWith({
        where: {
          createdByUserId: 'user1',
          status: 'PUBLISHED',
        },
      })
    })

    it('should not award badge when user has less than 10 rules', async () => {
      const mockBadge = {
        id: 'badge2',
        slug: 'prolific-author',
        name: 'Prolific Author',
      } as Badge

      mockPrisma.badge.findUnique.mockResolvedValue(mockBadge)
      mockPrisma.rule.count.mockResolvedValue(5)

      const service = new BadgeService()
      const result = await service.checkProlificAuthorBadge('user1')

      expect(result).toBeFalsy()
      expect(mockPrisma.userBadge.create).not.toHaveBeenCalled()
    })
  })

  describe('checkCommunityChampionBadge', () => {
    it('should award badge for high engagement metrics', async () => {
      const mockBadge = {
        id: 'badge3',
        slug: 'community-champion',
        name: 'Community Champion',
      } as Badge

      mockPrisma.badge.findUnique.mockResolvedValue(mockBadge)
      mockPrisma.vote.count.mockResolvedValue(150) // votes given
      mockPrisma.comment.count.mockResolvedValue(80) // comments made
      mockPrisma.userBadge.findUnique.mockResolvedValue(null)
      mockPrisma.userBadge.create.mockResolvedValue({
        userId: 'user1',
        badgeId: 'badge3',
      })

      const service = new BadgeService()
      const result = await service.checkCommunityChampionBadge('user1')

      expect(result).toBeTruthy()
    })
  })

  describe('checkGenerousDonorBadge', () => {
    it('should award badge for donations over $100', async () => {
      const mockBadge = {
        id: 'badge4',
        slug: 'generous-donor',
        name: 'Generous Donor',
      } as Badge

      mockPrisma.badge.findUnique.mockResolvedValue(mockBadge)
      mockPrisma.donation.aggregate.mockResolvedValue({
        _sum: { amountCents: 15000 }, // $150
      })
      mockPrisma.userBadge.findUnique.mockResolvedValue(null)
      mockPrisma.userBadge.create.mockResolvedValue({
        userId: 'user1',
        badgeId: 'badge4',
      })

      const service = new BadgeService()
      const result = await service.checkGenerousDonorBadge('user1')

      expect(result).toBeTruthy()
    })
  })
})
