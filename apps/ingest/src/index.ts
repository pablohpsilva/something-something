import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";

type Bindings = {
  CACHE: KVNamespace;
  DATABASE_URL: string;
  CRON_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Middleware
app.use("*", logger());
app.use("*", prettyJSON());
app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", "https://your-domain.com"],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  })
);

// Health check
app.get("/", (c) => {
  return c.json({
    message: "Ingest API is running",
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT || "development",
  });
});

// API routes
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Placeholder for data ingestion
app.post("/ingest", async (c) => {
  try {
    const body = await c.req.json();

    // TODO: Implement data validation and processing
    console.log("Received data:", body);

    // TODO: Store in database via @repo/db
    // TODO: Apply rate limiting via @repo/utils

    return c.json({
      success: true,
      message: "Data ingested successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Ingestion error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to ingest data",
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

// Cron endpoint
app.post("/cron", async (c) => {
  const authHeader = c.req.header("Authorization");
  const cronSecret = c.env.CRON_SECRET;

  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    // TODO: Implement cron job logic
    console.log("Running cron job");

    return c.json({
      success: true,
      message: "Cron job executed successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return c.json(
      {
        success: false,
        error: "Cron job failed",
        timestamp: new Date().toISOString(),
      },
      500
    );
  }
});

export default app;
