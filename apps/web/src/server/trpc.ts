import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { cache } from "react";
import { headers } from "next/headers";
import { appRouter, createContext, type AppRouter } from "@repo/trpc";
import { getCurrentUserServer } from "@/lib/auth";
import superjson from "superjson";

// Create server-side caller using the router directly
const createCaller = appRouter.createCaller;

/**
 * Create a server-side tRPC caller with authentication context
 * Use this in Server Components and Server Actions
 */
export const createServerCaller = cache(async () => {
  const user = await getCurrentUserServer();
  const headersList = await headers();

  // Extract IP and User-Agent for rate limiting and audit logs
  const forwarded = headersList.get("x-forwarded-for");
  const realIp = headersList.get("x-real-ip");
  const userAgent = headersList.get("user-agent");

  const clientIp = forwarded?.split(",")[0] || realIp || "unknown";

  // Create a simple hash for IP and User-Agent (for privacy)
  const ipHash = Buffer.from(clientIp).toString("base64").substring(0, 32);
  const uaHash = userAgent
    ? Buffer.from(userAgent).toString("base64").substring(0, 32)
    : "unknown";

  const ctx = createContext({
    user,
    reqIpHash: ipHash,
    uaHash: uaHash,
    reqIpHeader: clientIp,
    reqUAHeader: userAgent || "",
  });

  return createCaller(ctx);
});

/**
 * Create a client-side tRPC client for use in Client Components
 * This should be wrapped with TRPCReactProvider
 */
export const createTRPCClient = () => {
  return createTRPCClient<AppRouter>({
    transformer: superjson,
    links: [
      httpBatchLink({
        url: getBaseUrl() + "/api/trpc",
        headers: async () => {
          const headersList = await headers();
          return {
            // Forward authentication headers
            cookie: headersList.get("cookie") ?? "",
          };
        },
      }),
    ],
  });
};

/**
 * Get the base URL for the application
 */
function getBaseUrl() {
  if (typeof window !== "undefined") {
    // Browser should use relative URL
    return "";
  }

  if (process.env.VERCEL_URL) {
    // SSR should use Vercel URL
    return `https://${process.env.VERCEL_URL}`;
  }

  // Development fallback
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/**
 * Inference helpers for TypeScript
 */
export type ServerCaller = Awaited<ReturnType<typeof createServerCaller>>;

// Export the router type for client usage
export type { AppRouter };
