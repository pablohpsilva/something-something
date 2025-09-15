import { TRPCError } from "@trpc/server";
import { middleware } from "../trpc";
import type { Context } from "../trpc";

/**
 * Enhanced authentication middleware with detailed user validation
 */
export const validateAuth = middleware(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.authUser) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required. Please sign in to continue.",
    });
  }

  // Check if user account is active
  if ((ctx.authUser as any).role === "BANNED") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your account has been suspended. Please contact support.",
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

/**
 * Middleware to require specific user role with detailed error messages
 */
export const requireSpecificRole = (requiredRole: "USER" | "MOD" | "ADMIN") =>
  middleware(async ({ ctx, next }) => {
    if (!ctx.session || !ctx.authUser) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required to access this resource.",
      });
    }

    const userRole = (ctx.authUser as any).role as string;

    // Define role hierarchy: ADMIN > MOD > USER
    const roleHierarchy = {
      USER: 0,
      MOD: 1,
      ADMIN: 2,
    };

    const userLevel =
      roleHierarchy[userRole as keyof typeof roleHierarchy] ?? -1;
    const requiredLevel = roleHierarchy[requiredRole];

    if (userLevel < requiredLevel) {
      const roleNames = {
        MOD: "moderator",
        ADMIN: "administrator",
        USER: "user",
      };

      throw new TRPCError({
        code: "FORBIDDEN",
        message: `This action requires ${
          roleNames[requiredRole]
        } privileges. Your current role: ${
          roleNames[userRole as keyof typeof roleNames] || "unknown"
        }.`,
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

/**
 * Middleware to check if user owns a resource or has moderation privileges
 */
export const requireOwnershipOrMod = (
  getResourceUserId: (input: unknown) => string | Promise<string>
) =>
  middleware(async ({ ctx, input, next }) => {
    if (!ctx.authUser) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required to access this resource.",
      });
    }

    const resourceUserId = await getResourceUserId(input);

    // Allow if user owns the resource or is a moderator/admin
    const canAccess =
      (ctx.authUser as any).id === resourceUserId ||
      (ctx.authUser as any).role === "MOD" ||
      (ctx.authUser as any).role === "ADMIN";

    if (!canAccess) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message:
          "You can only access your own resources unless you have moderation privileges.",
      });
    }

    return next();
  });

/**
 * Middleware to check if user is verified/has completed profile
 */
export const requireVerifiedUser = middleware(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.authUser) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required.",
    });
  }

  if (!(ctx.authUser as any).emailVerified) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Please verify your email address to access this feature.",
    });
  }

  return next();
});

/**
 * Middleware for actions that require both authentication and additional verification
 */
export const requireCompleteProfile = middleware(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.authUser) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required.",
    });
  }

  // Check if user has completed basic profile info
  if (!(ctx.authUser as any).handle || !(ctx.authUser as any).displayName) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Please complete your profile setup before using this feature.",
    });
  }

  if (!(ctx.authUser as any).emailVerified) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Please verify your email address to access this feature.",
    });
  }

  return next();
});

/**
 * Helper function to check if current user can edit a resource
 */
export async function canUserEditResource(
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

/**
 * Helper function to get current user with null check
 */
export function getCurrentUser(ctx: Context) {
  if (!ctx.authUser) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required.",
    });
  }
  return ctx.authUser;
}

/**
 * Helper function to get current user ID safely
 */
export function getCurrentUserId(ctx: Context): string {
  const user = getCurrentUser(ctx);
  return (user as any).id;
}
