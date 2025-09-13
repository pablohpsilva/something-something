import { describe, it, expect } from 'vitest'
import { calculateTrendingScore, TrendingMetrics } from '../trending'

describe('Trending Score Algorithm', () => {
  describe('calculateTrendingScore', () => {
    it('should calculate basic trending score correctly', () => {
      const metrics: TrendingMetrics = {
        views: 100,
        votes: 10,
        comments: 5,
        copies: 8,
        saves: 3,
        forks: 2,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      }

      const score = calculateTrendingScore(metrics)
      
      // Expected: (100 * 1 + 10 * 3 + 5 * 2 + 8 * 4 + 3 * 2 + 2 * 5) / decay
      // = (100 + 30 + 10 + 32 + 6 + 10) / decay
      // = 188 / decay
      expect(score).toBeGreaterThan(0)
      expect(typeof score).toBe('number')
    })

    it('should apply time decay correctly', () => {
      const recentMetrics: TrendingMetrics = {
        views: 100,
        votes: 10,
        comments: 5,
        copies: 8,
        saves: 3,
        forks: 2,
        createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      }

      const oldMetrics: TrendingMetrics = {
        views: 100,
        votes: 10,
        comments: 5,
        copies: 8,
        saves: 3,
        forks: 2,
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
      }

      const recentScore = calculateTrendingScore(recentMetrics)
      const oldScore = calculateTrendingScore(oldMetrics)

      expect(recentScore).toBeGreaterThan(oldScore)
    })

    it('should handle zero metrics gracefully', () => {
      const metrics: TrendingMetrics = {
        views: 0,
        votes: 0,
        comments: 0,
        copies: 0,
        saves: 0,
        forks: 0,
        createdAt: new Date(),
      }

      const score = calculateTrendingScore(metrics)
      expect(score).toBe(0)
    })

    it('should weight different actions appropriately', () => {
      const viewsOnly: TrendingMetrics = {
        views: 100,
        votes: 0,
        comments: 0,
        copies: 0,
        saves: 0,
        forks: 0,
        createdAt: new Date(),
      }

      const forksOnly: TrendingMetrics = {
        views: 0,
        votes: 0,
        comments: 0,
        copies: 0,
        saves: 0,
        forks: 20, // 20 forks vs 100 views
        createdAt: new Date(),
      }

      const viewsScore = calculateTrendingScore(viewsOnly)
      const forksScore = calculateTrendingScore(forksOnly)

      // Forks should be weighted more heavily than views
      expect(forksScore).toBeGreaterThan(viewsScore)
    })

    it('should handle very old content with minimal decay', () => {
      const veryOldMetrics: TrendingMetrics = {
        views: 1000,
        votes: 100,
        comments: 50,
        copies: 80,
        saves: 30,
        forks: 20,
        createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
      }

      const score = calculateTrendingScore(veryOldMetrics)
      
      // Should still have some score due to high engagement
      expect(score).toBeGreaterThan(0)
      expect(score).toBeLessThan(100) // But significantly decayed
    })

    it('should be consistent with same inputs', () => {
      const metrics: TrendingMetrics = {
        views: 50,
        votes: 5,
        comments: 3,
        copies: 2,
        saves: 1,
        forks: 1,
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      }

      const score1 = calculateTrendingScore(metrics)
      const score2 = calculateTrendingScore(metrics)

      expect(score1).toBe(score2)
    })

    it('should handle edge case of future dates', () => {
      const futureMetrics: TrendingMetrics = {
        views: 100,
        votes: 10,
        comments: 5,
        copies: 8,
        saves: 3,
        forks: 2,
        createdAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour in future
      }

      const score = calculateTrendingScore(futureMetrics)
      
      // Should handle gracefully, possibly with no decay or minimal decay
      expect(score).toBeGreaterThan(0)
      expect(typeof score).toBe('number')
    })
  })
})
