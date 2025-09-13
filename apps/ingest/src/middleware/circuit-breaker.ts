import type { Context, Next } from "hono";
import { AbuseConfig } from "@repo/config/abuse";
import { hashIp, extractIp } from "@repo/utils/crypto";
import { logger } from "../logger";

interface CircuitState {
  requestTimes: number[]; // Timestamps of recent requests
  bannedUntil?: number; // Timestamp when ban expires
  failureCount: number; // Number of consecutive failures
  lastFailure?: number; // Timestamp of last failure
}

/**
 * Circuit breaker implementation for IP-based protection
 */
export class CircuitBreaker {
  private circuits = new Map<string, CircuitState>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Cleanup old entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60_000);
  }

  /**
   * Check if circuit is open (blocked) for given IP
   */
  isOpen(ipHash: string): boolean {
    const circuit = this.circuits.get(ipHash);
    if (!circuit) return false;

    const now = Date.now();

    // Check if ban has expired
    if (circuit.bannedUntil && now >= circuit.bannedUntil) {
      // Reset circuit state
      circuit.bannedUntil = undefined;
      circuit.failureCount = 0;
      circuit.requestTimes = [];
      return false;
    }

    return !!circuit.bannedUntil;
  }

  /**
   * Record a request and check if circuit should open
   */
  recordRequest(ipHash: string): { allowed: boolean; banDuration?: number } {
    const now = Date.now();
    const windowMs = AbuseConfig.circuitBreaker.windowSeconds * 1000;
    
    let circuit = this.circuits.get(ipHash);
    if (!circuit) {
      circuit = {
        requestTimes: [],
        failureCount: 0,
      };
      this.circuits.set(ipHash, circuit);
    }

    // Check if already banned
    if (this.isOpen(ipHash)) {
      return { allowed: false };
    }

    // Add current request time
    circuit.requestTimes.push(now);

    // Remove old requests outside the window
    circuit.requestTimes = circuit.requestTimes.filter(
      time => now - time <= windowMs
    );

    // Calculate QPS
    const qps = circuit.requestTimes.length / AbuseConfig.circuitBreaker.windowSeconds;

    // Check if QPS exceeds threshold
    if (qps > AbuseConfig.circuitBreaker.ipQpsMax) {
      const banDuration = AbuseConfig.circuitBreaker.banSeconds * 1000;
      circuit.bannedUntil = now + banDuration;
      circuit.failureCount++;

      logger.warn("Circuit breaker opened", {
        ipHash: ipHash.substring(0, 8),
        qps: qps.toFixed(2),
        threshold: AbuseConfig.circuitBreaker.ipQpsMax,
        banDurationMs: banDuration,
        failureCount: circuit.failureCount,
      });

      return { 
        allowed: false, 
        banDuration: Math.ceil(banDuration / 1000) 
      };
    }

    return { allowed: true };
  }

  /**
   * Record a successful response (for half-open state recovery)
   */
  recordSuccess(ipHash: string): void {
    const circuit = this.circuits.get(ipHash);
    if (circuit) {
      circuit.failureCount = Math.max(0, circuit.failureCount - 1);
    }
  }

  /**
   * Record a failed response
   */
  recordFailure(ipHash: string): void {
    const circuit = this.circuits.get(ipHash);
    if (circuit) {
      circuit.failureCount++;
      circuit.lastFailure = Date.now();
    }
  }

  /**
   * Get circuit statistics
   */
  getStats(): {
    totalCircuits: number;
    openCircuits: number;
    bannedIPs: number;
  } {
    const now = Date.now();
    let openCircuits = 0;
    let bannedIPs = 0;

    for (const circuit of this.circuits.values()) {
      if (circuit.bannedUntil && now < circuit.bannedUntil) {
        openCircuits++;
        bannedIPs++;
      }
    }

    return {
      totalCircuits: this.circuits.size,
      openCircuits,
      bannedIPs,
    };
  }

  /**
   * Cleanup expired circuits
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [ipHash, circuit] of this.circuits.entries()) {
      // Remove circuits that haven't been active for 24 hours
      const lastActivity = Math.max(
        circuit.requestTimes[circuit.requestTimes.length - 1] || 0,
        circuit.lastFailure || 0,
        circuit.bannedUntil || 0
      );

      if (now - lastActivity > maxAge) {
        this.circuits.delete(ipHash);
      }
    }
  }

  /**
   * Manually unban an IP (admin function)
   */
  unban(ipHash: string): boolean {
    const circuit = this.circuits.get(ipHash);
    if (circuit && circuit.bannedUntil) {
      circuit.bannedUntil = undefined;
      circuit.failureCount = 0;
      return true;
    }
    return false;
  }

  /**
   * Get banned IPs (for monitoring)
   */
  getBannedIPs(): Array<{ ipHash: string; bannedUntil: number; failureCount: number }> {
    const now = Date.now();
    const banned: Array<{ ipHash: string; bannedUntil: number; failureCount: number }> = [];

    for (const [ipHash, circuit] of this.circuits.entries()) {
      if (circuit.bannedUntil && now < circuit.bannedUntil) {
        banned.push({
          ipHash: ipHash.substring(0, 8), // Partial hash for privacy
          bannedUntil: circuit.bannedUntil,
          failureCount: circuit.failureCount,
        });
      }
    }

    return banned.sort((a, b) => b.bannedUntil - a.bannedUntil);
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.circuits.clear();
  }
}

// Global circuit breaker instance
let globalCircuitBreaker: CircuitBreaker | null = null;

function getGlobalCircuitBreaker(): CircuitBreaker {
  if (!globalCircuitBreaker) {
    globalCircuitBreaker = new CircuitBreaker();
  }
  return globalCircuitBreaker;
}

/**
 * Circuit breaker middleware for Hono
 */
export async function circuitBreakerGuard(c: Context, next: Next) {
  try {
    const headers = Object.fromEntries(c.req.raw.headers.entries());
    const ip = extractIp(headers);
    const ipHash = hashIp(ip, AbuseConfig.salts.ip);
    
    const circuitBreaker = getGlobalCircuitBreaker();

    // Check if circuit is open
    if (circuitBreaker.isOpen(ipHash)) {
      logger.warn("Circuit breaker blocked request", {
        ipHash: ipHash.substring(0, 8),
        path: c.req.path,
        method: c.req.method,
      });

      c.header("Retry-After", AbuseConfig.circuitBreaker.banSeconds.toString());
      
      return c.json({
        error: "circuit_open",
        message: "Too many requests. Circuit breaker is open.",
        retryAfter: AbuseConfig.circuitBreaker.banSeconds,
      }, 429);
    }

    // Record the request
    const result = circuitBreaker.recordRequest(ipHash);
    
    if (!result.allowed) {
      c.header("Retry-After", (result.banDuration || AbuseConfig.circuitBreaker.banSeconds).toString());
      
      return c.json({
        error: "circuit_opened",
        message: "Request rate too high. Circuit breaker opened.",
        retryAfter: result.banDuration || AbuseConfig.circuitBreaker.banSeconds,
      }, 429);
    }

    // Store circuit breaker in context for response handling
    c.set("circuitBreaker", circuitBreaker);
    c.set("ipHash", ipHash);

    try {
      await next();
      
      // Record success if response is ok
      const status = c.res.status;
      if (status >= 200 && status < 400) {
        circuitBreaker.recordSuccess(ipHash);
      } else if (status >= 500) {
        // Record server errors as failures
        circuitBreaker.recordFailure(ipHash);
      }
    } catch (error) {
      // Record exceptions as failures
      circuitBreaker.recordFailure(ipHash);
      throw error;
    }
  } catch (error) {
    logger.error("Circuit breaker middleware error", { error });
    // Fail open - allow request to proceed
    await next();
  }
}

/**
 * Get circuit breaker statistics (for monitoring endpoints)
 */
export function getCircuitBreakerStats() {
  const circuitBreaker = getGlobalCircuitBreaker();
  return {
    ...circuitBreaker.getStats(),
    bannedIPs: circuitBreaker.getBannedIPs(),
    config: {
      ipQpsMax: AbuseConfig.circuitBreaker.ipQpsMax,
      banSeconds: AbuseConfig.circuitBreaker.banSeconds,
      windowSeconds: AbuseConfig.circuitBreaker.windowSeconds,
    },
  };
}

/**
 * Admin function to unban an IP
 */
export function unbanIP(ipHash: string): boolean {
  const circuitBreaker = getGlobalCircuitBreaker();
  return circuitBreaker.unban(ipHash);
}

/**
 * Adaptive circuit breaker that adjusts thresholds based on system load
 */
export class AdaptiveCircuitBreaker extends CircuitBreaker {
  private systemLoad = 0;
  private loadHistory: number[] = [];

  updateSystemLoad(load: number): void {
    this.systemLoad = load;
    this.loadHistory.push(load);
    
    // Keep only last 10 measurements
    if (this.loadHistory.length > 10) {
      this.loadHistory.shift();
    }
  }

  recordRequest(ipHash: string): { allowed: boolean; banDuration?: number } {
    // Adjust threshold based on system load
    const baseThreshold = AbuseConfig.circuitBreaker.ipQpsMax;
    const loadMultiplier = Math.max(0.1, 1 - (this.systemLoad / 100));
    const adjustedThreshold = baseThreshold * loadMultiplier;

    // Temporarily override config for this check
    const originalThreshold = AbuseConfig.circuitBreaker.ipQpsMax;
    (AbuseConfig.circuitBreaker as any).ipQpsMax = adjustedThreshold;
    
    const result = super.recordRequest(ipHash);
    
    // Restore original threshold
    (AbuseConfig.circuitBreaker as any).ipQpsMax = originalThreshold;
    
    return result;
  }

  getAdaptiveStats() {
    return {
      ...this.getStats(),
      systemLoad: this.systemLoad,
      loadHistory: [...this.loadHistory],
      adjustedThreshold: AbuseConfig.circuitBreaker.ipQpsMax * Math.max(0.1, 1 - (this.systemLoad / 100)),
    };
  }
}
