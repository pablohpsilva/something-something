import { Hono } from "hono";
import { requireAppToken } from "../middleware/auth";
import { crawlRateLimit } from "../middleware/ratelimit";
import { crawlInputSchema, crawlResponseSchema } from "../schemas/crawl";
import { upsertCrawlItems } from "../services/crawl";
import { logger } from "../logger";
import { prisma } from "../prisma";

const ingestCrawl = new Hono();

ingestCrawl.post("/", requireAppToken, crawlRateLimit(), async (c) => {
  const body = await c.req.json();

  // Validate input
  const input = crawlInputSchema.parse(body);

  logger.info("Processing crawl request", {
    sourceId: input.sourceId,
    itemCount: input.items.length,
  });

  try {
    // Process crawl items
    const result = await upsertCrawlItems(input.sourceId, input.items);

    // Create audit log entry (fire-and-forget)
    const headers = Object.fromEntries(
      Object.entries(c.req.header()).map(([key, value]) => [
        key.toLowerCase(),
        Array.isArray(value) ? value[0] : value,
      ])
    );

    prisma.auditLog
      .create({
        data: {
          action: "ingest.crawl",
          targetType: "crawl_batch",
          targetId: `${input.sourceId}-${Date.now()}`,
          metadata: {
            sourceId: input.sourceId,
            itemCount: input.items.length,
            upserted: result.upserted,
            errors: result.errors.length,
            ipHash:
              headers["x-forwarded-for"] || headers["x-real-ip"] || "unknown",
          },
        },
      })
      .catch((error) => {
        logger.error("Failed to create audit log", { error });
      });

    // Validate and return response
    const response = crawlResponseSchema.parse({
      upserted: result.upserted,
      skipped: result.skipped,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });

    return c.json(response);
  } catch (error) {
    logger.error("Crawl processing failed", {
      sourceId: input.sourceId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
});

export { ingestCrawl };
