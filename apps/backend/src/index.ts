// Load environment variables first
import { config } from "dotenv";
config();

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { trpcServer } from "@hono/trpc-server";
import { appRouter, createTRPCContext } from "@repo/trpc";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { Context } from "hono";

// Create Hono app
const app = new Hono();

// Configure CORS
app.use(
  "/*",
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3030",
      "https://yourdomain.com", // Replace with your actual domain
    ],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  })
);

// Health check endpoint
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "backend-api",
  });
});

// Create tRPC context function for Hono
const createContext = async (opts: FetchCreateContextFnOptions, c: Context) => {
  // Extract headers from Hono context
  const authorization = c.req.header("authorization");
  const forwardedFor =
    c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  const userAgent = c.req.header("user-agent") || "unknown";

  const context = await createTRPCContext({
    headers: {
      authorization: authorization || "",
      "x-forwarded-for": forwardedFor,
      "user-agent": userAgent,
    },
  });

  // Return as plain object to match expected type
  return context as unknown as Record<string, unknown>;
};

// Setup tRPC handler
app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext,
    endpoint: "/trpc",
  })
);

// Root endpoint
app.get("/", (c) => {
  return c.json({
    message: "Backend API Server",
    version: "1.0.0",
    endpoints: {
      health: "/health",
      trpc: "/trpc",
    },
  });
});

// Start server
const port = Number(process.env.PORT) || 4000;

console.log(`🚀 Server running on http://localhost:${port}`);
console.log(`📡 tRPC endpoint: http://localhost:${port}/trpc`);
console.log(`❤️  Health check: http://localhost:${port}/health`);

serve({
  fetch: app.fetch,
  port,
});
