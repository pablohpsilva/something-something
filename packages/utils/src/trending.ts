export interface TrendingMetrics {
  views: number;
  votes: number;
  comments: number;
  copies: number;
  saves: number;
  forks: number;
  createdAt: Date;
}

/**
 * Weights for different engagement types
 * Higher values indicate more valuable engagement
 */
const ENGAGEMENT_WEIGHTS = {
  views: 1,
  votes: 3,
  comments: 2,
  copies: 4,
  saves: 2,
  forks: 6, // Increased from 5 to make 20 forks > 100 views
} as const;

/**
 * Time decay configuration
 * Controls how quickly content loses trending relevance over time
 */
const TIME_DECAY = {
  // Half-life in hours (how long it takes for score to decay by 50%)
  halfLifeHours: 48,
  // Minimum decay factor to prevent content from completely disappearing
  minDecayFactor: 0.01,
} as const;

/**
 * Calculate trending score for content based on engagement metrics and time
 *
 * Formula: (weighted_engagement_sum) * time_decay_factor
 *
 * Time decay uses exponential decay with configurable half-life
 */
export function calculateTrendingScore(metrics: TrendingMetrics): number {
  // Calculate base engagement score
  const engagementScore =
    metrics.views * ENGAGEMENT_WEIGHTS.views +
    metrics.votes * ENGAGEMENT_WEIGHTS.votes +
    metrics.comments * ENGAGEMENT_WEIGHTS.comments +
    metrics.copies * ENGAGEMENT_WEIGHTS.copies +
    metrics.saves * ENGAGEMENT_WEIGHTS.saves +
    metrics.forks * ENGAGEMENT_WEIGHTS.forks;

  // If no engagement, return 0
  if (engagementScore === 0) {
    return 0;
  }

  // Calculate time decay factor
  const now = new Date();
  const ageInHours = Math.max(
    0,
    (now.getTime() - metrics.createdAt.getTime()) / (1000 * 60 * 60)
  );

  // Exponential decay: factor = 0.5^(age / half_life)
  const decayFactor = Math.max(
    TIME_DECAY.minDecayFactor,
    Math.pow(0.5, ageInHours / TIME_DECAY.halfLifeHours)
  );

  // Calculate final trending score
  const trendingScore = engagementScore * decayFactor;

  return Math.round(trendingScore * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate trending scores for multiple items and return sorted by score
 */
export function rankByTrendingScore<T extends { metrics: TrendingMetrics }>(
  items: T[]
): (T & { trendingScore: number })[] {
  return items
    .map((item) => ({
      ...item,
      trendingScore: calculateTrendingScore(item.metrics),
    }))
    .sort((a, b) => b.trendingScore - a.trendingScore);
}

/**
 * Get trending score category for display purposes
 */
export function getTrendingCategory(
  score: number
): "hot" | "trending" | "rising" | "normal" {
  if (score >= 1000) return "hot";
  if (score >= 500) return "trending";
  if (score >= 100) return "rising";
  return "normal";
}

/**
 * Calculate trending velocity (rate of score change over time)
 * Useful for detecting rapidly growing content
 */
export function calculateTrendingVelocity(
  currentMetrics: TrendingMetrics,
  previousMetrics: TrendingMetrics,
  timeDiffHours: number
): number {
  const currentScore = calculateTrendingScore(currentMetrics);
  const previousScore = calculateTrendingScore(previousMetrics);

  if (timeDiffHours === 0) return 0;

  return (currentScore - previousScore) / timeDiffHours;
}
