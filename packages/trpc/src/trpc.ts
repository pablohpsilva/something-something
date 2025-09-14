import { initTRPC, TRPCError } from "@trpc/server";
import { prisma, type User } from "@repo/db";
import superjson from "superjson";
import { z } from "zod";

// Rate limiting store (in-memory for now, could be Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export interface Context {
  prisma: typeof prisma;
  user: User | null;
  reqIpHash: string;
  uaHash: string;
  reqIpHeader: string;
  reqUAHeader: string;
  now: Date;
}

export function createContext(opts: {
  user?: User | null;
  reqIpHash?: string;
  uaHash?: string;
  reqIpHeader?: string;
  reqUAHeader?: string;
}): Context {
  return {
    prisma,
    user: opts.user || null,
    reqIpHash: opts.reqIpHash || "unknown",
    uaHash: opts.uaHash || "unknown",
    reqIpHeader: opts.reqIpHeader || "0.0.0.0",
    reqUAHeader: opts.reqUAHeader || "",
    now: new Date(),
  };
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof z.ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const createTRPCRouter = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure;

// Middleware to require authentication
export const requireAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // Now guaranteed to be non-null
    },
  });
});

// Middleware to require specific role
export const requireRole = (role: "MOD" | "ADMIN") =>
  t.middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    const hasPermission =
      role === "ADMIN"
        ? ctx.user.role === "ADMIN"
        : ctx.user.role === "MOD" || ctx.user.role === "ADMIN";

    if (!hasPermission) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `${role} role required`,
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  });

// Rate limiting middleware
export const rateLimit = (bucket: string, limit: number, windowMs: number) =>
  t.middleware(({ ctx, next }) => {
    const key = `${bucket}:${ctx.user?.id || ctx.reqIpHash}`;
    const now = Date.now();
    const existing = rateLimitStore.get(key);

    if (existing && now < existing.resetTime) {
      if (existing.count >= limit) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Rate limit exceeded. Try again in ${Math.ceil(
            (existing.resetTime - now) / 1000
          )} seconds`,
        });
      }
      existing.count++;
    } else {
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
    }

    return next();
  });

// Audit logging middleware
export const audit = (
  action: string,
  entity?: { type: string; id: string },
  diff?: unknown
) =>
  t.middleware(async ({ ctx, next }) => {
    const result = await next();

    // Fire-and-forget audit log
    ctx.prisma.auditLog
      .create({
        data: {
          actorUserId: ctx.user?.id || null,
          action,
          entityType: entity?.type || "unknown",
          entityId: entity?.id || "unknown",
          diff: diff ? (diff as any) : null,
          ipHash: ctx.reqIpHash,
          createdAt: ctx.now,
        },
      })
      .catch((error) => {
        console.error("Failed to write audit log:", error);
      });

    return result;
  });

// Ownership check middleware
export const requireOwnership = (getResourceUserId: (input: any) => string) =>
  t.middleware(async ({ ctx, input, next }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    const resourceUserId = getResourceUserId(input);

    // Allow if user owns the resource or is a moderator/admin
    const canAccess =
      ctx.user.id === resourceUserId ||
      ctx.user.role === "MOD" ||
      ctx.user.role === "ADMIN";

    if (!canAccess) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You don't have permission to access this resource",
      });
    }

    return next();
  });

// Protected procedures with common middleware combinations
export const protectedProcedure = publicProcedure.use(requireAuth);
export const modProcedure = publicProcedure.use(requireRole("MOD"));
export const adminProcedure = publicProcedure.use(requireRole("ADMIN"));

// Rate-limited procedures
export const rateLimitedProcedure = protectedProcedure.use(
  rateLimit("general", 10, 60 * 1000) // 10 requests per minute
);

export const strictRateLimitedProcedure = protectedProcedure.use(
  rateLimit("strict", 6, 60 * 1000) // 6 requests per minute
);

export const voteRateLimitedProcedure = protectedProcedure.use(
  rateLimit("vote", 20, 60 * 1000) // 20 votes per minute
);

export const eventRateLimitedProcedure = publicProcedure.use(
  rateLimit("event", 60, 60 * 1000) // 60 events per minute (includes unauth)
);

// Factory function for creating rate-limited procedures
export const createRateLimitedProcedure = (
  baseProcedure: typeof publicProcedure | typeof protectedProcedure,
  bucket: string,
  options: { requireAuth?: boolean; weight?: number } = {}
) => {
  const { requireAuth: requireAuthOption = true, weight = 1 } = options;
  const procedure = requireAuthOption ? protectedProcedure : publicProcedure;
  return procedure.use(rateLimit(bucket, 10 * weight, 60 * 1000));
};

// Helper to check if user can edit a resource
export async function canUserEdit(
  ctx: Context,
  resourceUserId: string
): Promise<boolean> {
  if (!ctx.user) return false;
  return (
    ctx.user.id === resourceUserId ||
    ctx.user.role === "MOD" ||
    ctx.user.role === "ADMIN"
  );
}

// Helper to get rule ownership
export async function getRuleOwnership(
  ctx: Context,
  ruleId: string
): Promise<{ rule: any; canEdit: boolean }> {
  const rule = await ctx.prisma.rule.findUnique({
    where: { id: ruleId },
    select: {
      id: true,
      createdByUserId: true,
      status: true,
      deletedAt: true,
    },
  });

  if (!rule || rule.deletedAt) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Rule not found",
    });
  }

  const canEdit = await canUserEdit(ctx, rule.createdByUserId);

  return { rule, canEdit };
}

export { t };
