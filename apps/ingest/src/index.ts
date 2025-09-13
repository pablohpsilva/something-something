import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getEnv } from "./env";
import { logger } from "./logger";
import { errorHandler, requestLogger } from "./middleware/error";
import { rateLimitIngest, burstProtection } from "./middleware/rate-limit";
import { circuitBreakerGuard } from "./middleware/circuit-breaker";

// Import routes
import { health } from "./routes/health";
import { ingestEvents } from "./routes/ingest-events";
import { stripeWebhook } from "./routes/stripe-webhook";
import { ingestCrawl } from "./routes/ingest-crawl";
import { cronRollup } from "./routes/cron-rollup";
import { adminAbuse } from "./routes/admin-abuse";

// Create main Hono app
const app = new Hono();

// Global middleware
app.use("*", requestLogger);
app.use("*", errorHandler);

// CORS - only allow for health endpoint
app.use(
  "/health",
  cors({
    origin: "*",
    allowMethods: ["GET"],
  })
);

// Deny CORS for all other endpoints (server-to-server only)
app.use("*", async (c, next) => {
  // Skip CORS for health endpoint (already handled above)
  if (c.req.path === "/health") {
    await next();
    return;
  }

  // For all other endpoints, deny browser requests
  const origin = c.req.header("origin");
  if (origin) {
    return c.json({ error: "CORS not allowed" }, 403);
  }

  await next();
});

// Mount routes with anti-abuse protection
app.route("/health", health);

// Protected ingest routes with rate limiting and circuit breaker
app.use("/ingest/*", circuitBreakerGuard);
app.use("/ingest/*", rateLimitIngest);
app.use("/ingest/*", burstProtection);

app.route("/ingest/events", ingestEvents);
app.route("/ingest/stripe/webhook", stripeWebhook);
app.route("/ingest/crawl", ingestCrawl);

// Cron routes (internal only, no rate limiting)
app.route("/cron/rollup", cronRollup);

// Admin routes (internal only, no rate limiting)
app.route("/admin/abuse", adminAbuse);

// Root endpoint
app.get("/", (c) => {
  return c.json({
    service: "ingest",
    version: process.env.npm_package_version || "unknown",
    endpoints: [
      "GET /health",
      "POST /ingest/events",
      "POST /ingest/stripe/webhook",
      "POST /ingest/crawl",
      "POST /cron/rollup",
      "POST /cron/rollup/rebuild-search",
    ],
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: "endpoint not found" }, 404);
});

// Start server
function startServer() {
  const env = getEnv();

  logger.info("Starting ingest service", {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    logLevel: env.LOG_LEVEL,
  });

  const server = serve({
    fetch: app.fetch,
    port: env.PORT,
  });

  // Graceful shutdown
  process.on("SIGINT", () => {
    logger.info("Received SIGINT, shutting down gracefully");
    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
  });

  process.on("SIGTERM", () => {
    logger.info("Received SIGTERM, shutting down gracefully");
    server.close(() => {
      logger.info("Server closed");
      process.exit(0);
    });
  });

  logger.info(`🚀 Ingest service running on http://localhost:${env.PORT}`);
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

export { app, startServer };
