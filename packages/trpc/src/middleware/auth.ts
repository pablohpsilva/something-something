import { TRPCError } from "@trpc/server";
import { middleware } from "../trpc";
import type { Context } from "../trpc";

/**
 * Authentication middleware that checks if user is authenticated
 */
export const authMiddleware = middleware(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user: ctx.user,
    },
  });
});

/**
 * Role-based authorization middleware
 */
export const roleMiddleware = (requiredRole: "USER" | "MOD" | "ADMIN") =>
  middleware(async ({ ctx, next }) => {
    if (!ctx.session || !ctx.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to access this resource",
      });
    }

    const userRole = ctx.user.role as string;

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
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `You need ${requiredRole} role or higher to access this resource`,
      });
    }

    return next({
      ctx: {
        ...ctx,
        session: ctx.session,
        user: ctx.user,
      },
    });
  });

/**
 * Admin-only middleware
 */
export const adminMiddleware = roleMiddleware("ADMIN");

/**
 * Moderator-only middleware (allows both MOD and ADMIN)
 */
export const modMiddleware = roleMiddleware("MOD");
