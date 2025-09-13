/**
 * Request context utilities for server-side operations
 */

import { headers } from "next/headers";
import { createServerCaller } from "./trpc";
import { getOptionalAuth } from "@/lib/auth";

/**
 * Extract IP and User-Agent from request headers
 * @returns Object with ip and userAgent strings
 */
export function getRequestIpAndUA(): { ip: string; userAgent: string } {
  const headersList = headers();

  // Try multiple headers for IP (in order of preference)
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    headersList.get("x-vercel-forwarded-for") ||
    headersList.get("cf-connecting-ip") ||
    "0.0.0.0";

  const userAgent = headersList.get("user-agent") || "";

  return { ip, userAgent };
}

/**
 * Create a tRPC caller with request context (IP, UA, user)
 * @returns tRPC caller with full context
 */
export async function getTrpcCallerWithRequestContext() {
  const { ip, userAgent } = getRequestIpAndUA();
  const auth = await getOptionalAuth();

  return createServerCaller({
    user: auth?.user || null,
    reqIpHeader: ip,
    reqUAHeader: userAgent,
  });
}

/**
 * Get request context for metrics
 * @returns Context object for metrics recording
 */
export async function getMetricsContext(): Promise<{
  ip: string;
  userAgent: string;
  userId: string | null;
}> {
  const { ip, userAgent } = getRequestIpAndUA();
  const auth = await getOptionalAuth();

  return {
    ip,
    userAgent,
    userId: auth?.user?.id || null,
  };
}
