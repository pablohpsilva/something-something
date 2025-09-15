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
 * Points to our backend server instead of Next.js API routes
 */
function getBaseUrl() {
  if (typeof window !== "undefined") {
    // Browser should use the backend server URL
    return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
  }

  // SSR should use absolute URL to backend
  if (process.env.BACKEND_URL) {
    return process.env.BACKEND_URL;
  }

  // Default to localhost backend for development
  return "http://localhost:4000";
}

/**
 * Create a tRPC client with proper configuration
 * Includes superjson for data transformation and batching for performance
 */
export function createTRPCClientInstance() {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${getBaseUrl()}/trpc`,
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
