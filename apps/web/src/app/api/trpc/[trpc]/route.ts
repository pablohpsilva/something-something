import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContext } from "@repo/trpc";
import { getCurrentUserServer } from "@/lib/auth";

// Force Node.js runtime for Prisma compatibility
export const runtime = "nodejs";

const handler = async (req: Request) => {
  // Get user from authentication
  const user = await getCurrentUserServer();

  // Extract IP and User-Agent for rate limiting and audit logs
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const userAgent = req.headers.get("user-agent");

  const clientIp = forwarded?.split(",")[0] || realIp || "unknown";

  // Create simple hashes for privacy
  const ipHash = Buffer.from(clientIp).toString("base64").substring(0, 32);
  const uaHash = userAgent
    ? Buffer.from(userAgent).toString("base64").substring(0, 32)
    : "unknown";

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () =>
      createContext({
        user,
        reqIpHash: ipHash,
        uaHash: uaHash,
      }),
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(
              `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`
            );
          }
        : undefined,
  });
};

export { handler as GET, handler as POST };
