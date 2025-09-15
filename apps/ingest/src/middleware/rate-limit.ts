import type { Context, Next } from "hono";
import { limit, type BucketKey } from "@repo/utils/rate-limit";
import { AbuseConfig, getRateLimit } from "@repo/config/abuse";
import { hashIp, hashUA, extractIp, extractUA } from "@repo/utils/crypto";
import { logger } from "../logger";

/**
 * Rate limiting middleware for Hono ingest service
 */
export async function rateLimitIngest(c: Context, next: Next) {
  try {
    // Extract IP and User-Agent
    const headers = Object.fromEntries((c.req.raw.headers as any).entries());
    const ip = extractIp(headers);
    const ua = extractUA(headers);

    // Create privacy-preserving hashes
    const ipHash = hashIp(ip, AbuseConfig.salts.ip);
    const uaHash = hashUA(ua, AbuseConfig.salts.ua);

    // Build rate limit key
    const bucketKey: BucketKey = {
      bucket: "eventsPerIpPerMin",
      ipHash,
      uaHash,
    };

    // Get rate limit configuration
    const config = getRateLimit("eventsPerIpPerMin");

    // Check rate limit
    const result = await limit(bucketKey, config);

    if (!result.ok) {
      // Set Retry-After header
      const retryAfterSeconds = Math.ceil(result.retryAfterMs / 1000);
      c.header("Retry-After", retryAfterSeconds.toString());
      c.header("X-RateLimit-Limit", config.limit.toString());
      c.header("X-RateLimit-Remaining", "0");
      c.header(
        "X-RateLimit-Reset",
        new Date(Date.now() + result.resetMs).toISOString()
      );

      // Log rate limit violation
      logger.warn("Rate limit exceeded", {
        ipHash: ipHash.substring(0, 8), // Partial hash for logging
        bucket: "eventsPerIpPerMin",
        retryAfterMs: result.retryAfterMs,
        path: c.req.path,
        method: c.req.method,
      });

      return c.json(
        {
          error: "too_many_requests",
          message: `Rate limit exceeded. Try again in ${retryAfterSeconds} seconds.`,
          retryAfter: retryAfterSeconds,
        },
        429
      );
    }

    // Add rate limit headers for successful requests
    c.header("X-RateLimit-Limit", config.limit.toString());
    c.header("X-RateLimit-Remaining", result.remaining.toString());
    c.header(
      "X-RateLimit-Reset",
      new Date(Date.now() + result.resetMs).toISOString()
    );

    // Store rate limit info in context for potential use
    c.set("rateLimit", {
      remaining: result.remaining,
      resetMs: result.resetMs,
      ipHash,
    });

    await next();
  } catch (error) {
    logger.error("Rate limit middleware error", { error });
    // Fail open - allow request to proceed
    await next();
  }
}

/**
 * Enhanced rate limiting for specific endpoints
 */
export function createEndpointRateLimit(
  bucketName: keyof typeof AbuseConfig.limits
) {
  return async (c: Context, next: Next) => {
    try {
      const headers = Object.fromEntries((c.req.raw.headers as any).entries());
      const ip = extractIp(headers);
      const ua = extractUA(headers);

      const ipHash = hashIp(ip, AbuseConfig.salts.ip);
      const uaHash = hashUA(ua, AbuseConfig.salts.ua);

      const bucketKey: BucketKey = {
        bucket: bucketName,
        ipHash,
        uaHash,
      };

      const config = getRateLimit(bucketName);
      const result = await limit(bucketKey, config);

      if (!result.ok) {
        const retryAfterSeconds = Math.ceil(result.retryAfterMs / 1000);
        c.header("Retry-After", retryAfterSeconds.toString());

        logger.warn("Endpoint rate limit exceeded", {
          ipHash: ipHash.substring(0, 8),
          bucket: bucketName,
          endpoint: c.req.path,
          retryAfterMs: result.retryAfterMs,
        });

        return c.json(
          {
            error: "endpoint_rate_limit_exceeded",
            message: `Too many requests to ${c.req.path}. Try again in ${retryAfterSeconds} seconds.`,
            retryAfter: retryAfterSeconds,
          },
          429
        );
      }

      c.header("X-RateLimit-Limit", config.limit.toString());
      c.header("X-RateLimit-Remaining", result.remaining.toString());

      await next();
    } catch (error) {
      logger.error("Endpoint rate limit error", {
        error,
        endpoint: c.req.path,
      });
      await next();
    }
  };
}

/**
 * Authenticated rate limiting (requires user context)
 */
export async function rateLimitAuthenticated(
  c: Context,
  next: Next,
  bucketName: keyof typeof AbuseConfig.limits
) {
  try {
    // Get user from context (set by auth middleware)
    const userId = c.get("userId");

    if (!userId) {
      logger.warn("Authenticated rate limit called without user context");
      await next();
      return;
    }

    const headers = Object.fromEntries((c.req.raw.headers as any).entries());
    const ip = extractIp(headers);
    const ua = extractUA(headers);

    const ipHash = hashIp(ip, AbuseConfig.salts.ip);
    const uaHash = hashUA(ua, AbuseConfig.salts.ua);

    const bucketKey: BucketKey = {
      bucket: bucketName,
      userId,
      ipHash,
      uaHash,
    };

    const config = getRateLimit(bucketName);
    const result = await limit(bucketKey, config);

    if (!result.ok) {
      const retryAfterSeconds = Math.ceil(result.retryAfterMs / 1000);
      c.header("Retry-After", retryAfterSeconds.toString());

      logger.warn("Authenticated rate limit exceeded", {
        userId,
        ipHash: ipHash.substring(0, 8),
        bucket: bucketName,
        retryAfterMs: result.retryAfterMs,
      });

      return c.json(
        {
          error: "authenticated_rate_limit_exceeded",
          message: `Rate limit exceeded for user operations. Try again in ${retryAfterSeconds} seconds.`,
          retryAfter: retryAfterSeconds,
        },
        429
      );
    }

    c.header("X-RateLimit-Limit", config.limit.toString());
    c.header("X-RateLimit-Remaining", result.remaining.toString());

    await next();
  } catch (error) {
    logger.error("Authenticated rate limit error", { error });
    await next();
  }
}

/**
 * Burst detection middleware
 */
export async function burstProtection(c: Context, next: Next) {
  try {
    const headers = Object.fromEntries((c.req.raw.headers as any).entries());
    const ip = extractIp(headers);
    const ipHash = hashIp(ip, AbuseConfig.salts.ip);

    // Check for burst activity (high frequency in short window)
    const burstKey: BucketKey = {
      bucket: "burst_protection",
      ipHash,
    };

    // Allow 20 requests per 10 seconds
    const burstResult = await limit(burstKey, {
      limit: 20,
      windowMs: 10_000,
    });

    if (!burstResult.ok) {
      logger.warn("Burst protection triggered", {
        ipHash: ipHash.substring(0, 8),
        path: c.req.path,
        retryAfterMs: burstResult.retryAfterMs,
      });

      c.header(
        "Retry-After",
        Math.ceil(burstResult.retryAfterMs / 1000).toString()
      );

      return c.json(
        {
          error: "burst_detected",
          message: "Too many requests in a short time. Please slow down.",
          retryAfter: Math.ceil(burstResult.retryAfterMs / 1000),
        },
        429
      );
    }

    await next();
  } catch (error) {
    logger.error("Burst protection error", { error });
    await next();
  }
}
