import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SimpleAnomalyDetector,
  AnomalyEventCollector,
  getGlobalDetector,
  getGlobalCollector,
  analyzeAnomaly,
  type AnomalyEvent,
  type AnomalyScore,
} from "./anomaly";

// Mock crypto module for calculateEntropy dependency
vi.mock("./crypto", () => ({
  calculateEntropy: vi.fn((str: string) => {
    // Simple mock implementation for testing
    if (!str) return 0;
    if (str === "test") return 2.0;
    if (str === "uniform") return 3.5;
    return 1.5;
  }),
}));

describe("SimpleAnomalyDetector", () => {
  let detector: SimpleAnomalyDetector;

  beforeEach(() => {
    detector = new SimpleAnomalyDetector();
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should use default weights", () => {
      const detector = new SimpleAnomalyDetector();
      expect(detector).toBeDefined();
    });

    it("should accept custom weights", () => {
      const customWeights = {
        burst: 0.5,
        duplication: 0.3,
        entropy: 0.1,
        velocity: 0.1,
      };
      const detector = new SimpleAnomalyDetector(customWeights);
      expect(detector).toBeDefined();
    });
  });

  describe("analyze", () => {
    it("should return zero score for empty events", () => {
      const result = detector.analyze([]);

      expect(result.overall).toBe(0);
      expect(result.components).toEqual({
        burst: 0,
        duplication: 0,
        entropy: 0,
        velocity: 0,
      });
      expect(result.metadata.eventsPerMin).toBe(0);
    });

    it("should analyze single event", () => {
      const now = Date.now();
      const events: AnomalyEvent[] = [
        {
          timestamp: now,
          type: "VIEW",
          ipHash: "hash1",
          uaHash: "ua1",
          ruleId: "rule1",
        },
      ];

      const result = detector.analyze(events);

      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(1);
      expect(result.components.burst).toBeGreaterThanOrEqual(0);
      expect(result.components.duplication).toBe(0); // Single event has no duplicates
      expect(result.metadata.eventsPerMin).toBe(1);
    });

    it("should detect burst activity", () => {
      const now = Date.now();
      const events: AnomalyEvent[] = [];

      // Create 15 events in the last minute (above default baseline of 5)
      for (let i = 0; i < 15; i++) {
        events.push({
          timestamp: now - i * 1000, // 1 second apart
          type: "VIEW",
          ipHash: `hash${i}`,
          uaHash: `ua${i}`,
          ruleId: "rule1",
        });
      }

      const result = detector.analyze(events);

      expect(result.components.burst).toBeGreaterThan(0);
      expect(result.metadata.eventsPerMin).toBe(15);
      expect(result.metadata.baseline).toBe(5); // Default baseline
    });

    it("should detect duplication", () => {
      const now = Date.now();
      const events: AnomalyEvent[] = [
        // Same IP, same rule, same type - duplicates
        {
          timestamp: now - 1000,
          type: "VIEW",
          ipHash: "hash1",
          uaHash: "ua1",
          ruleId: "rule1",
        },
        {
          timestamp: now - 2000,
          type: "VIEW",
          ipHash: "hash1",
          uaHash: "ua1",
          ruleId: "rule1",
        },
        {
          timestamp: now - 3000,
          type: "VIEW",
          ipHash: "hash1",
          uaHash: "ua2",
          ruleId: "rule1",
        },
      ];

      const result = detector.analyze(events);

      expect(result.components.duplication).toBeGreaterThan(0);
      expect(result.metadata.duplicateRatio).toBeGreaterThan(0);
    });

    it("should analyze entropy for single UA", () => {
      const now = Date.now();
      const events: AnomalyEvent[] = [
        {
          timestamp: now - 1000,
          type: "VIEW",
          ipHash: "hash1",
          uaHash: "test", // Will return entropy of 2.0 from mock
          ruleId: "rule1",
        },
        {
          timestamp: now - 2000,
          type: "VIEW",
          ipHash: "hash2",
          uaHash: "test", // Same UA
          ruleId: "rule1",
        },
      ];

      const result = detector.analyze(events);

      expect(result.components.entropy).toBeGreaterThanOrEqual(0);
      expect(result.metadata.uaEntropy).toBe(2.0); // From mock
    });

    it("should analyze entropy for multiple UAs", () => {
      const now = Date.now();
      const events: AnomalyEvent[] = [
        {
          timestamp: now - 1000,
          type: "VIEW",
          ipHash: "hash1",
          uaHash: "ua1",
          ruleId: "rule1",
        },
        {
          timestamp: now - 2000,
          type: "VIEW",
          ipHash: "hash2",
          uaHash: "ua2",
          ruleId: "rule1",
        },
      ];

      const result = detector.analyze(events);

      expect(result.components.entropy).toBeGreaterThanOrEqual(0);
      expect(result.metadata.uaEntropy).toBe(1); // Perfect distribution of 2 UAs
    });

    it("should detect velocity changes", () => {
      const now = Date.now();
      const events: AnomalyEvent[] = [
        {
          timestamp: now - 10000, // 10 seconds ago
          type: "VIEW",
          ipHash: "hash1",
          uaHash: "ua1",
          ruleId: "rule1",
        },
        {
          timestamp: now - 5000, // 5 seconds ago (5s interval)
          type: "VIEW",
          ipHash: "hash1",
          uaHash: "ua1",
          ruleId: "rule1",
        },
        {
          timestamp: now - 2000, // 2 seconds ago (3s interval - accelerating)
          type: "VIEW",
          ipHash: "hash1",
          uaHash: "ua1",
          ruleId: "rule1",
        },
      ];

      const result = detector.analyze(events);

      expect(result.components.velocity).toBeGreaterThan(0);
      expect(result.metadata.velocityScore).toBeGreaterThan(0);
    });

    it("should filter events to recent window", () => {
      const now = Date.now();
      const events: AnomalyEvent[] = [
        // Old event (outside 1-minute window)
        {
          timestamp: now - 120_000, // 2 minutes ago
          type: "VIEW",
          ipHash: "hash1",
          uaHash: "ua1",
          ruleId: "rule1",
        },
        // Recent event (within window)
        {
          timestamp: now - 30_000, // 30 seconds ago
          type: "VIEW",
          ipHash: "hash1",
          uaHash: "ua1",
          ruleId: "rule1",
        },
      ];

      const result = detector.analyze(events);

      expect(result.metadata.eventsPerMin).toBe(1); // Only recent event counted
    });
  });

  describe("updateBaseline", () => {
    it("should update baseline with exponential moving average", () => {
      detector.updateBaseline("test", 10);
      expect(detector.getBaseline("test")).toBe(1); // 0.1 * 10 + 0.9 * 0

      detector.updateBaseline("test", 20);
      expect(detector.getBaseline("test")).toBe(2.9); // 0.1 * 20 + 0.9 * 1
    });
  });

  describe("getBaseline", () => {
    it("should return 0 for non-existent key", () => {
      expect(detector.getBaseline("nonexistent")).toBe(0);
    });

    it("should return stored baseline", () => {
      detector.updateBaseline("test", 15);
      expect(detector.getBaseline("test")).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("should handle zero baseline in burst calculation", () => {
      const now = Date.now();
      const events: AnomalyEvent[] = Array.from({ length: 12 }, (_, i) => ({
        timestamp: now - i * 1000,
        type: "VIEW",
        ipHash: `hash${i}`,
        uaHash: `ua${i}`,
        ruleId: "rule1",
      }));

      // Force baseline to 0
      detector.updateBaseline("global", 0);

      const result = detector.analyze(events);

      expect(result.components.burst).toBeGreaterThan(0); // Should still detect burst
    });

    it("should handle events with missing optional fields", () => {
      const now = Date.now();
      const events: AnomalyEvent[] = [
        {
          timestamp: now,
          type: "VIEW",
          ipHash: "hash1",
          uaHash: "ua1",
          // No ruleId or userId
        },
      ];

      const result = detector.analyze(events);

      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(1);
    });
  });
});

describe("AnomalyEventCollector", () => {
  let collector: AnomalyEventCollector;

  beforeEach(() => {
    collector = new AnomalyEventCollector();
  });

  describe("addEvent", () => {
    it("should add event to key", () => {
      const event: AnomalyEvent = {
        timestamp: Date.now(),
        type: "VIEW",
        ipHash: "hash1",
        uaHash: "ua1",
      };

      collector.addEvent("test-key", event);
      const events = collector.getEvents("test-key");

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(event);
    });

    it("should filter old events", () => {
      const now = Date.now();
      const oldEvent: AnomalyEvent = {
        timestamp: now - 25 * 60 * 60 * 1000, // 25 hours ago
        type: "VIEW",
        ipHash: "hash1",
        uaHash: "ua1",
      };
      const newEvent: AnomalyEvent = {
        timestamp: now,
        type: "VIEW",
        ipHash: "hash2",
        uaHash: "ua2",
      };

      collector.addEvent("test-key", oldEvent);
      collector.addEvent("test-key", newEvent);

      const events = collector.getEvents("test-key");
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(newEvent);
    });

    it("should limit total events per key", () => {
      const now = Date.now();

      // Add 1200 events (more than maxEventsPerKey of 1000)
      for (let i = 0; i < 1200; i++) {
        const event: AnomalyEvent = {
          timestamp: now - i * 1000,
          type: "VIEW",
          ipHash: `hash${i}`,
          uaHash: `ua${i}`,
        };
        collector.addEvent("test-key", event);
      }

      const events = collector.getEvents("test-key");
      expect(events).toHaveLength(1000); // Limited to maxEventsPerKey
    });
  });

  describe("getEvents", () => {
    it("should return empty array for non-existent key", () => {
      const events = collector.getEvents("nonexistent");
      expect(events).toEqual([]);
    });

    it("should filter by maxAge", () => {
      const now = Date.now();
      const oldEvent: AnomalyEvent = {
        timestamp: now - 2 * 60 * 1000, // 2 minutes ago
        type: "VIEW",
        ipHash: "hash1",
        uaHash: "ua1",
      };
      const newEvent: AnomalyEvent = {
        timestamp: now - 30 * 1000, // 30 seconds ago
        type: "VIEW",
        ipHash: "hash2",
        uaHash: "ua2",
      };

      collector.addEvent("test-key", oldEvent);
      collector.addEvent("test-key", newEvent);

      const recentEvents = collector.getEvents("test-key", 60 * 1000); // Last minute
      expect(recentEvents).toHaveLength(1);
      expect(recentEvents[0]).toEqual(newEvent);
    });

    it("should return copy of events array", () => {
      const event: AnomalyEvent = {
        timestamp: Date.now(),
        type: "VIEW",
        ipHash: "hash1",
        uaHash: "ua1",
      };

      collector.addEvent("test-key", event);
      const events1 = collector.getEvents("test-key");
      const events2 = collector.getEvents("test-key");

      expect(events1).not.toBe(events2); // Different array instances
      expect(events1).toEqual(events2); // Same content
    });
  });

  describe("analyzeKey", () => {
    it("should analyze events using provided detector", () => {
      const detector = new SimpleAnomalyDetector();
      const event: AnomalyEvent = {
        timestamp: Date.now(),
        type: "VIEW",
        ipHash: "hash1",
        uaHash: "ua1",
      };

      collector.addEvent("test-key", event);
      const result = collector.analyzeKey("test-key", detector);

      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(1);
    });
  });

  describe("cleanup", () => {
    it("should remove expired events", () => {
      const now = Date.now();
      const oldEvent: AnomalyEvent = {
        timestamp: now - 25 * 60 * 60 * 1000, // 25 hours ago
        type: "VIEW",
        ipHash: "hash1",
        uaHash: "ua1",
      };

      collector.addEvent("test-key", oldEvent);
      collector.cleanup();

      const events = collector.getEvents("test-key");
      expect(events).toEqual([]);
    });

    it("should remove empty keys", () => {
      const now = Date.now();
      const oldEvent: AnomalyEvent = {
        timestamp: now - 25 * 60 * 60 * 1000,
        type: "VIEW",
        ipHash: "hash1",
        uaHash: "ua1",
      };

      collector.addEvent("test-key", oldEvent);
      collector.cleanup();

      const stats = collector.getStats();
      expect(stats.totalKeys).toBe(0);
    });
  });

  describe("getStats", () => {
    it("should return stats for empty collector", () => {
      const stats = collector.getStats();

      expect(stats.totalKeys).toBe(0);
      expect(stats.totalEvents).toBe(0);
      expect(stats.memoryUsageBytes).toBe(0);
    });

    it("should calculate stats correctly", () => {
      const event: AnomalyEvent = {
        timestamp: Date.now(),
        type: "VIEW",
        ipHash: "hash1",
        uaHash: "ua1",
      };

      collector.addEvent("test-key-1", event);
      collector.addEvent("test-key-2", event);

      const stats = collector.getStats();

      expect(stats.totalKeys).toBe(2);
      expect(stats.totalEvents).toBe(2);
      expect(stats.memoryUsageBytes).toBeGreaterThan(0);
    });
  });
});

describe("Global functions", () => {
  describe("getGlobalDetector", () => {
    it("should return singleton detector", () => {
      const detector1 = getGlobalDetector();
      const detector2 = getGlobalDetector();

      expect(detector1).toBe(detector2);
      expect(detector1).toBeInstanceOf(SimpleAnomalyDetector);
    });
  });

  describe("getGlobalCollector", () => {
    it("should return singleton collector", () => {
      const collector1 = getGlobalCollector();
      const collector2 = getGlobalCollector();

      expect(collector1).toBe(collector2);
      expect(collector1).toBeInstanceOf(AnomalyEventCollector);
    });
  });

  describe("analyzeAnomaly", () => {
    it("should use global instances by default", () => {
      const event: AnomalyEvent = {
        timestamp: Date.now(),
        type: "VIEW",
        ipHash: "hash1",
        uaHash: "ua1",
      };

      const result = analyzeAnomaly("test-key", event);

      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(1);
    });

    it("should use provided detector and collector", () => {
      const detector = new SimpleAnomalyDetector();
      const collector = new AnomalyEventCollector();
      const event: AnomalyEvent = {
        timestamp: Date.now(),
        type: "VIEW",
        ipHash: "hash1",
        uaHash: "ua1",
      };

      const result = analyzeAnomaly("test-key", event, { detector, collector });

      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(1);
    });

    it("should add event to collector", () => {
      const collector = new AnomalyEventCollector();
      const event: AnomalyEvent = {
        timestamp: Date.now(),
        type: "VIEW",
        ipHash: "hash1",
        uaHash: "ua1",
      };

      analyzeAnomaly("test-key", event, { collector });

      const events = collector.getEvents("test-key");
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(event);
    });
  });
});

describe("Integration tests", () => {
  it("should detect realistic attack pattern", () => {
    const detector = new SimpleAnomalyDetector();
    const collector = new AnomalyEventCollector();
    const now = Date.now();

    // Simulate an attack: many events from same IP, same UA, rapid succession
    const attackEvents: AnomalyEvent[] = Array.from({ length: 20 }, (_, i) => ({
      timestamp: now - i * 500, // 500ms apart
      type: "VIEW",
      ipHash: "attacker-ip",
      uaHash: "attacker-ua",
      ruleId: "target-rule",
    }));

    attackEvents.forEach((event) => {
      collector.addEvent("attack-key", event);
    });

    const result = collector.analyzeKey("attack-key", detector);

    expect(result.overall).toBeGreaterThan(0.5); // High anomaly score
    expect(result.components.burst).toBeGreaterThan(0); // Burst detected
    expect(result.components.duplication).toBeGreaterThan(0); // Duplicates detected
  });

  it("should handle normal user behavior", () => {
    const detector = new SimpleAnomalyDetector();
    const collector = new AnomalyEventCollector();
    const now = Date.now();

    // Simulate normal behavior: few events, different IPs, varied timing
    const normalEvents: AnomalyEvent[] = [
      {
        timestamp: now - 30_000,
        type: "VIEW",
        ipHash: "user1-ip",
        uaHash: "user1-ua",
        ruleId: "rule1",
      },
      {
        timestamp: now - 45_000,
        type: "VIEW",
        ipHash: "user2-ip",
        uaHash: "user2-ua",
        ruleId: "rule2",
      },
    ];

    normalEvents.forEach((event) => {
      collector.addEvent("normal-key", event);
    });

    const result = collector.analyzeKey("normal-key", detector);

    expect(result.overall).toBeLessThan(0.3); // Low anomaly score
  });
});
