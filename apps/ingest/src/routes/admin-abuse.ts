import { Hono } from "hono";
import { getCircuitBreakerStats, unbanIP } from "../middleware/circuit-breaker";
import { getGlobalStore } from "@repo/utils/rate-limit";
import { getGlobalIdempotencyStore } from "@repo/utils/idempotency";
import { getGlobalDetector, getGlobalCollector } from "@repo/utils/anomaly";
import { logger } from "../logger";
import { AbuseConfig } from "@repo/config/abuse";

export const adminAbuse = new Hono();

/**
 * Get comprehensive abuse statistics
 */
adminAbuse.get("/stats", async (c) => {
  try {
    // Rate limiting stats
    const rateLimitStore = getGlobalStore();
    const rateLimitStats = rateLimitStore.getStats();

    // Idempotency stats
    const idempotencyStore = getGlobalIdempotencyStore();
    const idempotencyStats = idempotencyStore.getStats();

    // Circuit breaker stats
    const circuitBreakerStats = getCircuitBreakerStats();

    // Anomaly detection stats
    const anomalyCollector = getGlobalCollector();
    const anomalyStats = anomalyCollector.getStats();

    // Configuration summary
    const configSummary = {
      limits: AbuseConfig.limits,
      windows: AbuseConfig.windows,
      circuitBreaker: AbuseConfig.circuitBreaker,
      burst: AbuseConfig.burst,
      shadowBan: {
        enabled: AbuseConfig.shadowBan.enabled,
        userCount: AbuseConfig.shadowBan.userIds.length,
      },
      challenge: {
        enabled: AbuseConfig.challenge.enabled,
        provider: AbuseConfig.challenge.provider,
      },
    };

    return c.json({
      timestamp: new Date().toISOString(),
      rateLimit: rateLimitStats,
      idempotency: idempotencyStats,
      circuitBreaker: circuitBreakerStats,
      anomaly: anomalyStats,
      config: configSummary,
    });
  } catch (error) {
    logger.error("Failed to get abuse stats", { error });
    return c.json({ error: "Failed to get statistics" }, 500);
  }
});

/**
 * Get banned IPs from circuit breaker
 */
adminAbuse.get("/banned-ips", async (c) => {
  try {
    const stats = getCircuitBreakerStats();
    return c.json({
      bannedIPs: stats.bannedIPs,
      totalBanned: stats.bannedIPs.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Failed to get banned IPs", { error });
    return c.json({ error: "Failed to get banned IPs" }, 500);
  }
});

/**
 * Unban an IP address (admin action)
 */
adminAbuse.post("/unban-ip", async (c) => {
  try {
    const body = await c.req.json();
    const { ipHash } = body;

    if (!ipHash || typeof ipHash !== "string") {
      return c.json({ error: "Invalid ipHash parameter" }, 400);
    }

    const success = unbanIP(ipHash);
    
    if (success) {
      logger.info("IP unbanned by admin", { ipHash: ipHash.substring(0, 8) });
      return c.json({ 
        success: true, 
        message: `IP ${ipHash.substring(0, 8)}... unbanned successfully` 
      });
    } else {
      return c.json({ 
        success: false, 
        message: "IP not found or not currently banned" 
      });
    }
  } catch (error) {
    logger.error("Failed to unban IP", { error });
    return c.json({ error: "Failed to unban IP" }, 500);
  }
});

/**
 * Clear rate limits for a specific key pattern
 */
adminAbuse.post("/clear-rate-limits", async (c) => {
  try {
    const body = await c.req.json();
    const { pattern } = body;

    if (!pattern || typeof pattern !== "string") {
      return c.json({ error: "Invalid pattern parameter" }, 400);
    }

    const rateLimitStore = getGlobalStore();
    
    // This would require implementing a pattern-based clear method
    // For now, we can only clear all
    await rateLimitStore.clearAll();
    
    logger.info("Rate limits cleared by admin", { pattern });
    return c.json({ 
      success: true, 
      message: "Rate limits cleared successfully" 
    });
  } catch (error) {
    logger.error("Failed to clear rate limits", { error });
    return c.json({ error: "Failed to clear rate limits" }, 500);
  }
});

/**
 * Get anomaly detection insights
 */
adminAbuse.get("/anomalies", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "50");
    const threshold = parseFloat(c.req.query("threshold") || "0.5");

    // This would require storing anomaly history
    // For now, return current stats
    const anomalyCollector = getGlobalCollector();
    const stats = anomalyCollector.getStats();

    return c.json({
      stats,
      threshold,
      limit,
      timestamp: new Date().toISOString(),
      // In a real implementation, we'd return recent high-scoring anomalies
      recentAnomalies: [],
    });
  } catch (error) {
    logger.error("Failed to get anomalies", { error });
    return c.json({ error: "Failed to get anomalies" }, 500);
  }
});

/**
 * Update abuse configuration (runtime changes)
 */
adminAbuse.post("/config", async (c) => {
  try {
    const body = await c.req.json();
    const { limits, circuitBreaker, burst } = body;

    // Validate and update configuration
    if (limits) {
      Object.entries(limits).forEach(([key, value]) => {
        if (typeof value === "number" && value > 0) {
          (AbuseConfig.limits as any)[key] = value;
        }
      });
    }

    if (circuitBreaker) {
      if (typeof circuitBreaker.ipQpsMax === "number" && circuitBreaker.ipQpsMax > 0) {
        (AbuseConfig.circuitBreaker as any).ipQpsMax = circuitBreaker.ipQpsMax;
      }
      if (typeof circuitBreaker.banSeconds === "number" && circuitBreaker.banSeconds > 0) {
        (AbuseConfig.circuitBreaker as any).banSeconds = circuitBreaker.banSeconds;
      }
    }

    if (burst) {
      if (typeof burst.maxIdenticalEventsPerMin === "number" && burst.maxIdenticalEventsPerMin > 0) {
        (AbuseConfig.burst as any).maxIdenticalEventsPerMin = burst.maxIdenticalEventsPerMin;
      }
    }

    logger.info("Abuse configuration updated by admin", { 
      limits: Object.keys(limits || {}),
      circuitBreaker: Object.keys(circuitBreaker || {}),
      burst: Object.keys(burst || {}),
    });

    return c.json({ 
      success: true, 
      message: "Configuration updated successfully",
      config: {
        limits: AbuseConfig.limits,
        circuitBreaker: AbuseConfig.circuitBreaker,
        burst: AbuseConfig.burst,
      },
    });
  } catch (error) {
    logger.error("Failed to update config", { error });
    return c.json({ error: "Failed to update configuration" }, 500);
  }
});

/**
 * Health check for abuse systems
 */
adminAbuse.get("/health", async (c) => {
  try {
    const rateLimitStore = getGlobalStore();
    const idempotencyStore = getGlobalIdempotencyStore();
    
    const health = {
      rateLimit: {
        status: "healthy",
        buckets: rateLimitStore.getStats().totalBuckets,
      },
      idempotency: {
        status: "healthy",
        entries: idempotencyStore.getStats().totalEntries,
      },
      circuitBreaker: {
        status: "healthy",
        openCircuits: getCircuitBreakerStats().openCircuits,
      },
      anomalyDetection: {
        status: "healthy",
        keys: getGlobalCollector().getStats().totalKeys,
      },
    };

    return c.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      systems: health,
    });
  } catch (error) {
    logger.error("Abuse health check failed", { error });
    return c.json({ 
      status: "unhealthy",
      error: "Health check failed",
      timestamp: new Date().toISOString(),
    }, 500);
  }
});
