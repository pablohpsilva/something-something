import type { Context, Next } from "hono";
import { getEnv } from "../env";
import { logger } from "../logger";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

function getClientKey(c: Context): string {
  // Try to get real IP from headers (for reverse proxy setups)
  const forwarded = c.req.header("x-forwarded-for");
  const realIp = c.req.header("x-real-ip");
  const remoteAddr = forwarded?.split(",")[0] || realIp || "unknown";
  
  // Create a simple hash for privacy
  return Buffer.from(remoteAddr).toString("base64").substring(0, 16);
}

export function withRateLimit(bucket: string, limit: number, windowMs: number) {
  return async (c: Context, next: Next) => {
    const clientKey = getClientKey(c);
    const key = `${bucket}:${clientKey}`;
    const now = Date.now();
    
    const existing = rateLimitStore.get(key);
    
    if (existing && now < existing.resetTime) {
      if (existing.count >= limit) {
        const resetInSeconds = Math.ceil((existing.resetTime - now) / 1000);
        
        logger.warn("Rate limit exceeded", {
          bucket,
          clientKey,
          count: existing.count,
          limit,
          resetInSeconds,
        });
        
        return c.json(
          { 
            error: "rate limit exceeded", 
            retryAfter: resetInSeconds 
          }, 
          429
        );
      }
      existing.count++;
    } else {
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
    }
    
    await next();
  };
}

// Pre-configured rate limiters
export const eventsRateLimit = () => {
  const env = getEnv();
  return withRateLimit("events", env.RATE_LIMIT_EVENTS_PER_IP, env.RATE_LIMIT_WINDOW_MS);
};

export const crawlRateLimit = () => {
  const env = getEnv();
  return withRateLimit("crawl", env.RATE_LIMIT_CRAWL_PER_TOKEN, env.RATE_LIMIT_WINDOW_MS);
};

export const webhookRateLimit = () => {
  return withRateLimit("webhook", 100, 60 * 1000); // 100 per minute for webhooks
};
