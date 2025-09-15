import { createTRPCClient, httpBatchLink } from "@trpc/client"
import type { AppRouter } from "./routers"

/**
 * Create a tRPC client for use in the browser or server-side
 */
export function createTRPCClientConfig(baseUrl: string) {
  return {
    links: [
      httpBatchLink({
        url: `${baseUrl}/api/trpc`,
        // Add headers, authentication, etc. here
        headers() {
          return {
            // Add common headers
          }
        },
      }),
    ],
  }
}

/**
 * Vanilla tRPC client (for use outside of React)
 */
export function createVanillaTRPCClient(baseUrl: string) {
  return createTRPCClient<AppRouter>(createTRPCClientConfig(baseUrl))
}
