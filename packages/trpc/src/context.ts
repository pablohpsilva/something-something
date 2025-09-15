// Note: Express types are optional - only needed if using with Express server
interface Request {
  headers: Record<string, string | string[]>;
  socket?: { remoteAddress?: string };
}

interface Response {
  // Express Response interface placeholder
}
import { auth } from "@repo/db/auth";
import { createContext } from "./trpc";
import { prisma } from "@repo/db";
import type { Context } from "./trpc";

/**
 * Create tRPC context for server-side usage with Better-auth
 */
export async function createTRPCContext(opts: {
  req?: Request;
  res?: Response;
  headers?: Record<string, string>;
}) {
  const { req, headers } = opts;

  let session = null;
  let authUser = null;
  let dbUser = null;

  // Get session from request headers (Bearer token or cookies)
  try {
    if (req) {
      // Extract session from request
      const sessionData = await auth.api.getSession({
        headers: new Headers(req.headers as Record<string, string>),
      });

      if (sessionData) {
        session = sessionData.session;
        authUser = sessionData.user;

        // Get the full user from database for backward compatibility
        if (authUser && (authUser as any).id) {
          dbUser = await prisma.user.findUnique({
            where: { id: (authUser as any).id },
          });
        }
      }
    } else if (headers) {
      // For serverless or API routes
      const sessionData = await auth.api.getSession({
        headers: new Headers(headers),
      });

      if (sessionData) {
        session = sessionData.session;
        authUser = sessionData.user;

        if (authUser && (authUser as any).id) {
          dbUser = await prisma.user.findUnique({
            where: { id: (authUser as any).id },
          });
        }
      }
    }
  } catch (error) {
    // Session validation failed, continue as unauthenticated
    console.warn("Failed to validate session:", error);
  }

  // Extract IP and user agent for rate limiting and audit logs
  const reqIpHeader =
    (req?.headers["x-forwarded-for"] as string) ||
    (req?.headers["x-real-ip"] as string) ||
    req?.socket?.remoteAddress ||
    headers?.["x-forwarded-for"] ||
    "0.0.0.0";

  const reqUAHeader =
    (Array.isArray(req?.headers["user-agent"])
      ? req?.headers["user-agent"][0]
      : req?.headers["user-agent"]) ||
    (Array.isArray(headers?.["user-agent"])
      ? headers?.["user-agent"][0]
      : headers?.["user-agent"]) ||
    "";

  // Create hash for rate limiting (simplified for now)
  const reqIpHash = Buffer.from(reqIpHeader).toString("base64").slice(0, 8);
  const uaHash = Buffer.from(reqUAHeader).toString("base64").slice(0, 8);

  return createContext({
    user: dbUser,
    session: session as any, // Better-auth session type
    authUser: authUser as any, // Better-auth user type
    reqIpHash,
    uaHash,
    reqIpHeader,
    reqUAHeader,
  });
}

/**
 * Create context for testing or manual usage
 */
export function createMockContext(overrides?: {
  userId?: string;
  userRole?: "USER" | "MOD" | "ADMIN";
  session?: any;
}) {
  const mockUser = overrides?.userId
    ? {
        id: overrides.userId,
        role: overrides.userRole || "USER",
        email: "test@example.com",
        handle: "testuser",
        displayName: "Test User",
      }
    : null;

  return createContext({
    user: mockUser as any,
    session: overrides?.session || null,
    authUser: mockUser as any,
    reqIpHash: "test-ip",
    uaHash: "test-ua",
    reqIpHeader: "127.0.0.1",
    reqUAHeader: "test-agent",
  });
}

// Re-export Context type for external usage
export type { Context };
