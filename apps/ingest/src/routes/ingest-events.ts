import { Hono } from "hono";
import { requireAppToken } from "../middleware/auth";
import { eventsRateLimit } from "../middleware/ratelimit";
import { eventsInputSchema } from "../schemas/events";
import { recordEvents } from "../services/events";
import { logger } from "../logger";
import { prisma } from "../prisma";

const ingestEvents = new Hono();

ingestEvents.post("/", requireAppToken, eventsRateLimit(), async (c) => {
  const body = await c.req.json();

  // Validate input
  const input = eventsInputSchema.parse(body);

  // Extract request headers for hashing
  const headers = Object.fromEntries(
    Object.entries(c.req.header()).map(([key, value]) => [
      key.toLowerCase(),
      Array.isArray(value) ? value[0] : value,
    ])
  );

  // Record events
  const result = await recordEvents(input.events, headers);

  // Create audit log entry (fire-and-forget)
  prisma.auditLog
    .create({
      data: {
        action: "ingest.events",
        targetType: "event_batch",
        targetId: `batch-${Date.now()}`,
        metadata: {
          count: input.events.length,
          accepted: result.accepted,
          deduped: result.deduped,
          sampleTypes: [...new Set(input.events.map((e) => e.type))],
          ipHash:
            headers["x-forwarded-for"] || headers["x-real-ip"] || "unknown",
        },
      },
    })
    .catch((error) => {
      logger.error("Failed to create audit log", { error });
    });

  return c.json({ accepted: result.accepted }, 202);
});

export { ingestEvents };
