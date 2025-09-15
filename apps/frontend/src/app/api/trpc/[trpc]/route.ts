import { appRouter, createTRPCContext } from "@repo/trpc";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";

/**
 * Configure basic CORS headers for the API
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Handle tRPC requests using the fetch adapter
 */
const handler = async (req: NextRequest) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      return createTRPCContext({
        headers: Object.fromEntries(req.headers.entries()),
      });
    },
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(
              `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`
            );
            console.error("Full error:", error);
            console.error("Stack trace:", error.stack);
          }
        : undefined,
  });
};

/**
 * Export handlers for all HTTP methods
 */
export { handler as GET, handler as POST };

/**
 * Handle preflight requests
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}
