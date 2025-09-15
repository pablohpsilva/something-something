import { initTRPC, TRPCError } from "@trpc/server";
import { prisma, type User, auth, type Session, type AuthUser } from "@repo/db";
import superjson from "superjson";
import { z } from "zod";

// Rate limiting store (in-memory for now, could be Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export interface Context {
  prisma: typeof prisma;
  user: User | null;
  session: Session | null;
  authUser: AuthUser | null;
  reqIpHash: string;
  uaHash: string;
  reqIpHeader: string;
  reqUAHeader: string;
  now: Date;
}

export function createContext(opts: {
  user?: User | null;
  session?: Session | null;
  authUser?: AuthUser | null;
  reqIpHash?: string;
  uaHash?: string;
  reqIpHeader?: string;
  reqUAHeader?: string;
}): Context {
  return {
    prisma,
    user: opts.user || null,
    session: opts.session || null,
    authUser: opts.authUser || null,
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
  if (!ctx.session || !ctx.authUser) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      authUser: ctx.authUser,
    },
  });
});

// Middleware to require specific role
export const requireRole = (role: "MOD" | "ADMIN") =>
  t.middleware(({ ctx, next }) => {
    if (!ctx.session || !ctx.authUser) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to access this resource",
      });
    }

    const userRole = (ctx.authUser as any)?.role as string;

    // Define role hierarchy: ADMIN > MOD > USER
    const roleHierarchy = {
      USER: 0,
      MOD: 1,
      ADMIN: 2,
    };

    const userLevel =
      roleHierarchy[userRole as keyof typeof roleHierarchy] ?? -1;
    const requiredLevel = roleHierarchy[role];

    if (userLevel < requiredLevel) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `You need ${role} role or higher to access this resource`,
      });
    }

    return next({
      ctx: {
        ...ctx,
        session: ctx.session,
        authUser: ctx.authUser,
      },
    });
  });

// Rate limiting middleware
export const rateLimit = (bucket: string, limit: number, windowMs: number) =>
  t.middleware(({ ctx, next }) => {
    const key = `${bucket}:${
      (ctx.authUser as any)?.id || ctx.user?.id || ctx.reqIpHash
    }`;
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
          actorId: (ctx.authUser as any)?.id || ctx.user?.id || null,
          action,
          targetType: entity?.type || "unknown",
          targetId: entity?.id || "unknown",
          metadata: diff ? (diff as any) : undefined,
        },
      })
      .catch((error) => {
        console.error("Failed to write audit log:", error);
      });

    return result;
  });

// Ownership check middleware
export const requireOwnership = (
  getResourceUserId: (input: unknown) => string
) =>
  t.middleware(async ({ ctx, input, next }) => {
    if (!ctx.authUser) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    const resourceUserId = getResourceUserId(input);
    const user = ctx.authUser; // TypeScript now knows this is not null

    // Allow if user owns the resource or is a moderator/admin
    const canAccess =
      (user as any).id === resourceUserId ||
      (user as any).role === "MOD" ||
      (user as any).role === "ADMIN";

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
  _baseProcedure: typeof publicProcedure | typeof protectedProcedure,
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
  if (!ctx.authUser) return false;
  return (
    (ctx.authUser as any).id === resourceUserId ||
    (ctx.authUser as any).role === "MOD" ||
    (ctx.authUser as any).role === "ADMIN"
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
