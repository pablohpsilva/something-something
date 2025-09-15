import { TRPCError } from "@trpc/server";
import { middleware } from "../trpc";
import { limit, type BucketKey } from "@repo/utils/rate-limit";
import { AbuseConfig, type RateLimitBucket, getRateLimit } from "@repo/config";
import { hashIp, hashUA, extractIp, extractUA } from "@repo/utils/crypto";
import { AuditLog } from "../services/audit-log";

/**
 * Rate limiting middleware for tRPC procedures
 */
export function withRateLimit(bucketName: RateLimitBucket) {
  return middleware(async ({ ctx, next, path, type }) => {
    try {
      // Extract request information
      const headers = getRequestHeaders(ctx);
      const ip = extractIp(headers);
      const ua = extractUA(headers);

      // Create privacy-preserving hashes
      const ipHash = hashIp(ip, AbuseConfig.salts.ip);
      const uaHash = hashUA(ua, AbuseConfig.salts.ua);

      // Build rate limit key
      const bucketKey: BucketKey = {
        bucket: bucketName,
        userId: ctx.user?.id,
        ipHash,
        uaHash,
      };

      // Get rate limit configuration
      const config = getRateLimit(bucketName);

      // Check rate limit
      const result = await limit(bucketKey, config);

      if (!result.ok) {
        // Log rate limit violation
        if (AbuseConfig.audit.logRateLimits) {
          await logRateLimitViolation(ctx, {
            bucket: bucketName,
            path,
            type,
            userId: ctx.user?.id,
            ipHash,
            uaHash,
            retryAfterMs: result.retryAfterMs,
          });
        }

        // Throw rate limit error
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Rate limit exceeded for ${bucketName}. Try again in ${Math.ceil(
            result.retryAfterMs / 1000
          )} seconds.`,
          cause: {
            bucket: bucketName,
            retryAfterMs: result.retryAfterMs,
            resetMs: result.resetMs,
          },
        });
      }

      // Add rate limit info to context for potential use in procedures
      const enhancedCtx = {
        ...ctx,
        rateLimit: {
          bucket: bucketName,
          remaining: result.remaining,
          resetMs: result.resetMs,
        },
      };

      return next({ ctx: enhancedCtx });
    } catch (error) {
      // Re-throw tRPC errors as-is
      if (error instanceof TRPCError) {
        throw error;
      }

      // Log unexpected errors
      console.error("Rate limit middleware error:", error);

      // Allow request to proceed on middleware errors (fail-open)
      return next();
    }
  });
}

/**
 * Enhanced rate limiting with IP-only fallback for unauthenticated users
 */
export function withIPRateLimit(
  bucketName: RateLimitBucket,
  options: {
    requireAuth?: boolean;
    weight?: number;
  } = {}
) {
  return middleware(async ({ ctx, next, path, type }) => {
    try {
      const { requireAuth = false, weight = 1 } = options;

      // Check authentication requirement
      if (requireAuth && !ctx.user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Authentication required",
        });
      }

      // Extract request information
      const headers = getRequestHeaders(ctx);
      const ip = extractIp(headers);
      const ua = extractUA(headers);

      const ipHash = hashIp(ip, AbuseConfig.salts.ip);
      const uaHash = hashUA(ua, AbuseConfig.salts.ua);

      // Build rate limit key (IP-based for unauthenticated users)
      const bucketKey: BucketKey = {
        bucket: bucketName,
        userId: ctx.user?.id,
        ipHash,
        uaHash: ctx.user ? uaHash : undefined, // Only use UA for authenticated users
      };

      const config = getRateLimit(bucketName);
      const result = await limit(bucketKey, { ...config, weight });

      if (!result.ok) {
        if (AbuseConfig.audit.logRateLimits) {
          await logRateLimitViolation(ctx, {
            bucket: bucketName,
            path,
            type,
            userId: ctx.user?.id,
            ipHash,
            uaHash,
            retryAfterMs: result.retryAfterMs,
            weight,
          });
        }

        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Rate limit exceeded. Try again in ${Math.ceil(
            result.retryAfterMs / 1000
          )} seconds.`,
          cause: {
            bucket: bucketName,
            retryAfterMs: result.retryAfterMs,
            resetMs: result.resetMs,
          },
        });
      }

      const enhancedCtx = {
        ...ctx,
        rateLimit: {
          bucket: bucketName,
          remaining: result.remaining,
          resetMs: result.resetMs,
        },
      };

      return next({ ctx: enhancedCtx });
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      console.error("IP rate limit middleware error:", error);
      return next();
    }
  });
}

/**
 * Burst protection middleware for high-frequency operations
 */
export function withBurstProtection(
  bucketName: RateLimitBucket,
  options: {
    burstLimit: number;
    burstWindowMs: number;
    sustainedLimit: number;
    sustainedWindowMs: number;
  } = {
    burstLimit: 10,
    burstWindowMs: 10_000, // 10 seconds
    sustainedLimit: 100,
    sustainedWindowMs: 60_000, // 1 minute
  }
) {
  return middleware(async ({ ctx, next, path, type }) => {
    try {
      const headers = getRequestHeaders(ctx);
      const ip = extractIp(headers);
      const ua = extractUA(headers);

      const ipHash = hashIp(ip, AbuseConfig.salts.ip);
      const uaHash = hashUA(ua, AbuseConfig.salts.ua);

      // Check burst limit (short window)
      const burstKey: BucketKey = {
        bucket: `${bucketName}:burst`,
        userId: ctx.user?.id,
        ipHash,
        uaHash,
      };

      const burstResult = await limit(burstKey, {
        limit: options.burstLimit,
        windowMs: options.burstWindowMs,
      });

      if (!burstResult.ok) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Burst limit exceeded. Slow down and try again in ${Math.ceil(
            burstResult.retryAfterMs / 1000
          )} seconds.`,
          cause: {
            bucket: `${bucketName}:burst`,
            retryAfterMs: burstResult.retryAfterMs,
          },
        });
      }

      // Check sustained limit (longer window)
      const sustainedKey: BucketKey = {
        bucket: `${bucketName}:sustained`,
        userId: ctx.user?.id,
        ipHash,
        uaHash,
      };

      const sustainedResult = await limit(sustainedKey, {
        limit: options.sustainedLimit,
        windowMs: options.sustainedWindowMs,
      });

      if (!sustainedResult.ok) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Sustained rate limit exceeded. Try again in ${Math.ceil(
            sustainedResult.retryAfterMs / 1000
          )} seconds.`,
          cause: {
            bucket: `${bucketName}:sustained`,
            retryAfterMs: sustainedResult.retryAfterMs,
          },
        });
      }

      return next();
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      console.error("Burst protection middleware error:", error);
      return next();
    }
  });
}

/**
 * Shadow ban middleware
 */
export function withShadowBanCheck() {
  return middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      return next();
    }

    // Check if user is shadow banned
    if (
      AbuseConfig.shadowBan.enabled &&
      AbuseConfig.shadowBan.userIds.includes(ctx.user.id)
    ) {
      // Log shadow ban attempt
      await AuditLog.log({
        action: "abuse.shadowban_attempt",
        actorId: ctx.user.id,
        targetId: ctx.user.id,
        targetType: "User",
        metadata: { shadowBanned: true },
      });

      // For shadow banned users, we don't throw an error
      // Instead, we mark the context so procedures can handle it
      const enhancedCtx = {
        ...ctx,
        shadowBanned: true,
      };

      return next({ ctx: enhancedCtx });
    }

    return next();
  });
}

/**
 * Extract request headers from various tRPC contexts
 */
function getRequestHeaders(
  ctx: unknown
): Record<string, string | string[] | undefined> {
  // Next.js App Router / Pages Router / Standalone server
  if (ctx.req?.headers) {
    return ctx.req.headers;
  }

  // Fallback - try to extract from various possible locations
  const headers: Record<string, string | undefined> = {};

  // Common header extraction patterns
  if (ctx.req) {
    headers["x-forwarded-for"] =
      ctx.req.ip || ctx.req.connection?.remoteAddress;
    headers["user-agent"] =
      ctx.req.get?.("user-agent") || ctx.req.headers?.["user-agent"];
  }

  return headers;
}

/**
 * Log rate limit violation to audit log
 */
async function logRateLimitViolation(
  ctx: unknown,
  details: {
    bucket: string;
    path: string;
    type: string;
    userId?: string;
    ipHash: string;
    uaHash: string;
    retryAfterMs: number;
    weight?: number;
  }
): Promise<void> {
  try {
    await AuditLog.log({
      action: "abuse.ratelimit",
      targetType: "RateLimit",
      actorId: details.userId,
      targetId: details.bucket,
      metadata: {
        bucket: details.bucket,
        path: details.path,
        type: details.type,
        retryAfterMs: details.retryAfterMs,
        weight: details.weight,
        ipHash: details.ipHash,
        uaHash: details.uaHash,
      },
    });
  } catch (error) {
    console.error("Failed to log rate limit violation:", error);
  }
}

/**
 * Helper to create rate limited procedures with consistent configuration
 */
export function createRateLimitedProcedure(
  baseProcedure: any,
  bucketName: RateLimitBucket,
  options: {
    requireAuth?: boolean;
    weight?: number;
    burstProtection?: boolean;
  } = {}
): any {
  let procedure = baseProcedure;

  // Add shadow ban check if user might be authenticated
  if (options.requireAuth !== false) {
    procedure = procedure.use(withShadowBanCheck());
  }

  // Add burst protection if requested
  if (options.burstProtection) {
    procedure = procedure.use(withBurstProtection(bucketName));
  }

  // Add main rate limiting
  if (options.requireAuth) {
    procedure = procedure.use(withRateLimit(bucketName));
  } else {
    procedure = procedure.use(
      withIPRateLimit(bucketName, {
        requireAuth: options.requireAuth,
        weight: options.weight,
      })
    );
  }

  return procedure;
}
