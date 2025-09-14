/**
 * Anomaly detection system for abuse prevention
 */

import { calculateEntropy } from "./crypto";

export interface AnomalyScore {
  overall: number;
  components: {
    burst: number;
    duplication: number;
    entropy: number;
    velocity: number;
  };
  metadata: {
    eventsPerMin: number;
    baseline: number;
    duplicateRatio: number;
    uaEntropy: number;
    velocityScore: number;
  };
}

export interface AnomalyDetector {
  analyze(events: AnomalyEvent[]): AnomalyScore;
  updateBaseline(key: string, value: number): void;
  getBaseline(key: string): number;
}

export interface AnomalyEvent {
  timestamp: number;
  type: string;
  userId?: string;
  ipHash: string;
  uaHash: string;
  ruleId?: string;
  metadata?: Record<string, any>;
}

/**
 * Simple anomaly detector with configurable thresholds
 */
export class SimpleAnomalyDetector implements AnomalyDetector {
  private baselines = new Map<string, number>();
  private weights: {
    burst: number;
    duplication: number;
    entropy: number;
    velocity: number;
  };

  constructor(
    weights = { burst: 0.4, duplication: 0.3, entropy: 0.1, velocity: 0.2 }
  ) {
    this.weights = weights;
  }

  analyze(events: AnomalyEvent[]): AnomalyScore {
    if (events.length === 0) {
      return {
        overall: 0,
        components: { burst: 0, duplication: 0, entropy: 0, velocity: 0 },
        metadata: {
          eventsPerMin: 0,
          baseline: 0,
          duplicateRatio: 0,
          uaEntropy: 0,
          velocityScore: 0,
        },
      };
    }

    // Calculate time window (last minute)
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;
    const recentEvents = events.filter((e) => e.timestamp > oneMinuteAgo);

    // Burst detection
    const eventsPerMin = recentEvents.length;
    const baseline = this.getBaseline("global") || 5; // Default baseline
    const burstScore = this.calculateBurstScore(eventsPerMin, baseline);

    // Duplication detection
    const duplicateRatio = this.calculateDuplicationScore(recentEvents);

    // Entropy analysis (User-Agent diversity)
    const uaEntropy = this.calculateUAEntropy(recentEvents);
    const entropyScore = Math.max(0, 1 - uaEntropy / 4); // Normalize to 0-1

    // Velocity analysis (acceleration of events)
    const velocityScore = this.calculateVelocityScore(events);

    // Composite score
    const overall = Math.min(
      1,
      Math.max(
        0,
        this.weights.burst * burstScore +
          this.weights.duplication * duplicateRatio +
          this.weights.entropy * entropyScore +
          this.weights.velocity * velocityScore
      )
    );

    return {
      overall,
      components: {
        burst: burstScore,
        duplication: duplicateRatio,
        entropy: entropyScore,
        velocity: velocityScore,
      },
      metadata: {
        eventsPerMin,
        baseline,
        duplicateRatio,
        uaEntropy,
        velocityScore,
      },
    };
  }

  updateBaseline(key: string, value: number): void {
    const current = this.baselines.get(key) || 0;
    // Exponential moving average
    const alpha = 0.1;
    const updated = alpha * value + (1 - alpha) * current;
    this.baselines.set(key, updated);
  }

  getBaseline(key: string): number {
    return this.baselines.get(key) || 0;
  }

  private calculateBurstScore(eventsPerMin: number, baseline: number): number {
    if (baseline === 0) return eventsPerMin > 10 ? 1 : 0;

    const ratio = eventsPerMin / baseline;

    // Score increases exponentially after 3x baseline
    if (ratio <= 1) return 0;
    if (ratio <= 3) return (ratio - 1) / 2; // Linear increase to 1.0 at 3x

    // Exponential increase beyond 3x
    return Math.min(1, 1 + Math.log(ratio / 3) / Math.log(10));
  }

  private calculateDuplicationScore(events: AnomalyEvent[]): number {
    if (events.length === 0) return 0;

    // Group events by type and target
    const groups = new Map<string, number>();

    for (const event of events) {
      const key = `${event.type}:${event.ruleId || "global"}:${event.ipHash}`;
      groups.set(key, (groups.get(key) || 0) + 1);
    }

    // Calculate duplicate ratio
    let duplicates = 0;
    for (const count of groups.values()) {
      if (count > 1) {
        duplicates += count - 1; // Count extras as duplicates
      }
    }

    return Math.min(1, duplicates / events.length);
  }

  private calculateUAEntropy(events: AnomalyEvent[]): number {
    if (events.length === 0) return 0;

    // Collect unique UA hashes
    const uaHashes = [...new Set(events.map((e) => e.uaHash))];

    if (uaHashes.length === 1) {
      // All events from same UA - calculate entropy of the hash itself
      return calculateEntropy(uaHashes[0] || "");
    }

    // Multiple UAs - calculate distribution entropy
    const counts = new Map<string, number>();
    for (const event of events) {
      counts.set(event.uaHash, (counts.get(event.uaHash) || 0) + 1);
    }

    let entropy = 0;
    const total = events.length;

    for (const count of counts.values()) {
      const probability = count / total;
      entropy -= probability * Math.log2(probability);
    }

    return entropy;
  }

  private calculateVelocityScore(events: AnomalyEvent[]): number {
    if (events.length < 3) return 0;

    // Sort events by timestamp
    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

    // Calculate intervals between events
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(
        (sorted[i]?.timestamp || 0) - (sorted[i - 1]?.timestamp || 0)
      );
    }

    // Look for acceleration (decreasing intervals)
    let accelerationScore = 0;
    for (let i = 1; i < intervals.length; i++) {
      const prev = intervals[i - 1] || 0;
      const curr = intervals[i] || 0;

      if (curr < prev) {
        // Events are accelerating
        const acceleration = (prev - curr) / prev;
        accelerationScore += acceleration;
      }
    }

    // Normalize by number of intervals
    return Math.min(1, accelerationScore / intervals.length);
  }
}

/**
 * Anomaly event collector for building event histories
 */
export class AnomalyEventCollector {
  private events = new Map<string, AnomalyEvent[]>();
  private maxEventsPerKey = 1000;
  private maxAge = 24 * 60 * 60 * 1000; // 24 hours

  addEvent(key: string, event: AnomalyEvent): void {
    let eventList = this.events.get(key) || [];

    // Add new event
    eventList.push(event);

    // Remove old events
    const cutoff = Date.now() - this.maxAge;
    eventList = eventList.filter((e) => e.timestamp > cutoff);

    // Limit total events
    if (eventList.length > this.maxEventsPerKey) {
      eventList = eventList.slice(-this.maxEventsPerKey);
    }

    this.events.set(key, eventList);
  }

  getEvents(key: string, maxAge?: number): AnomalyEvent[] {
    const eventList = this.events.get(key) || [];

    if (maxAge) {
      const cutoff = Date.now() - maxAge;
      return eventList.filter((e) => e.timestamp > cutoff);
    }

    return [...eventList];
  }

  analyzeKey(key: string, detector: AnomalyDetector): AnomalyScore {
    const events = this.getEvents(key);
    return detector.analyze(events);
  }

  cleanup(): void {
    const cutoff = Date.now() - this.maxAge;

    for (const [key, events] of this.events.entries()) {
      const filtered = events.filter((e) => e.timestamp > cutoff);

      if (filtered.length === 0) {
        this.events.delete(key);
      } else {
        this.events.set(key, filtered);
      }
    }
  }

  getStats(): {
    totalKeys: number;
    totalEvents: number;
    memoryUsageBytes: number;
  } {
    let totalEvents = 0;
    let memoryUsageBytes = 0;

    for (const [key, events] of this.events.entries()) {
      totalEvents += events.length;

      // Rough memory calculation
      memoryUsageBytes += key.length * 2;
      memoryUsageBytes += events.length * 200; // Rough estimate per event
    }

    return {
      totalKeys: this.events.size,
      totalEvents,
      memoryUsageBytes,
    };
  }
}

// Global instances
let globalDetector: SimpleAnomalyDetector | null = null;
let globalCollector: AnomalyEventCollector | null = null;

export function getGlobalDetector(): SimpleAnomalyDetector {
  if (!globalDetector) {
    globalDetector = new SimpleAnomalyDetector();
  }
  return globalDetector;
}

export function getGlobalCollector(): AnomalyEventCollector {
  if (!globalCollector) {
    globalCollector = new AnomalyEventCollector();
  }
  return globalCollector;
}

/**
 * High-level anomaly analysis function
 */
export function analyzeAnomaly(
  key: string,
  event: AnomalyEvent,
  options: {
    detector?: AnomalyDetector;
    collector?: AnomalyEventCollector;
  } = {}
): AnomalyScore {
  const detector = options.detector ?? getGlobalDetector();
  const collector = options.collector ?? getGlobalCollector();

  // Add event to history
  collector.addEvent(key, event);

  // Analyze current state
  return collector.analyzeKey(key, detector);
}
