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
export async function getRequestIpAndUA(): Promise<{
  ip: string;
  userAgent: string;
}> {
  const headersList = await headers();

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
  const { ip, userAgent } = await getRequestIpAndUA();
  const auth = await getOptionalAuth();

  // Create context object matching the expected structure
  const ctx = {
    user: auth || null,
    reqIpHeader: ip,
    reqUAHeader: userAgent,
    reqIpHash: Buffer.from(ip).toString("base64").substring(0, 32),
    uaHash: Buffer.from(userAgent).toString("base64").substring(0, 32),
  };

  return createServerCaller(ctx);
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
  const { ip, userAgent } = await getRequestIpAndUA();
  const auth = await getOptionalAuth();

  return {
    ip,
    userAgent,
    userId: auth?.userId || null,
  };
}
