import type { AppRouter } from "@repo/trpc";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import superjson from "superjson";

/**
 * Create tRPC context for SSR-friendly React Query integration
 * This provides type-safe providers and hooks
 */
export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<AppRouter>();

/**
 * Get the tRPC API base URL
 * This should point to your tRPC API endpoint
 */
function getBaseUrl() {
  if (typeof window !== "undefined") {
    // Browser should use relative URL
    return "";
  }

  // SSR should use absolute URL
  if (process.env.VERCEL_URL) {
    // Reference for vercel.com
    return `https://${process.env.VERCEL_URL}`;
  }

  // Assume localhost for development
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/**
 * Create a tRPC client with proper configuration
 * Includes superjson for data transformation and batching for performance
 */
export function createTRPCClientInstance() {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${getBaseUrl()}/api/trpc`,
        // Optional: Add headers for authentication
        headers() {
          return {
            // Add any custom headers here, such as:
            // authorization: getAuthToken(),
          };
        },
        // Transform data using superjson
        transformer: superjson,
      }),
    ],
  });
}

/**
 * Helper type exports for easier usage
 */
export type { AppRouter } from "@repo/trpc";
