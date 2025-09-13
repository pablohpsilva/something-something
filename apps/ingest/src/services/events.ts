import crypto from "crypto";
import { prisma } from "../prisma";
import { logger } from "../logger";
import { getEnv } from "../env";
import type { EventInput, EnrichedEvent } from "../schemas/events";

// In-memory deduplication cache for VIEW events
const viewDedupeCache = new Map<string, number>();

// Clean up old cache entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const windowMs = getEnv().VIEW_DEDUPE_WINDOW_MS;
  
  for (const [key, timestamp] of viewDedupeCache.entries()) {
    if (now - timestamp > windowMs) {
      viewDedupeCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function hashIp(ip: string): string {
  // Use a consistent salt for hashing (in production, use a proper secret)
  const salt = "ingest-ip-salt";
  return crypto.createHash("sha256").update(ip + salt).digest("hex").substring(0, 32);
}

export function hashUA(ua: string): string {
  // Use a consistent salt for hashing
  const salt = "ingest-ua-salt";
  return crypto.createHash("sha256").update(ua + salt).digest("hex").substring(0, 32);
}

export function getRequestHashes(headers: Record<string, string | undefined>): {
  ipHash: string;
  uaHash: string;
} {
  // Extract IP from headers (for reverse proxy setups)
  const forwarded = headers["x-forwarded-for"];
  const realIp = headers["x-real-ip"];
  const ip = forwarded?.split(",")[0] || realIp || "unknown";
  
  // Extract User-Agent
  const ua = headers["user-agent"] || "unknown";
  
  return {
    ipHash: hashIp(ip),
    uaHash: hashUA(ua),
  };
}

function shouldDedupeView(ipHash: string, ruleId: string): boolean {
  if (!ruleId) return false; // Can't dedupe without ruleId
  
  const key = `${ipHash}:${ruleId}`;
  const now = Date.now();
  const lastView = viewDedupeCache.get(key);
  const windowMs = getEnv().VIEW_DEDUPE_WINDOW_MS;
  
  if (lastView && (now - lastView) < windowMs) {
    return true; // Should dedupe
  }
  
  // Update cache
  viewDedupeCache.set(key, now);
  return false; // Don't dedupe
}

export async function recordEvents(
  events: EventInput[],
  requestHeaders: Record<string, string | undefined>
): Promise<{ accepted: number; deduped: number }> {
  const { ipHash, uaHash } = getRequestHashes(requestHeaders);
  const now = new Date();
  
  // Enrich events with metadata
  const enrichedEvents: EnrichedEvent[] = events.map(event => ({
    ...event,
    ipHash,
    uaHash,
    createdAt: event.ts ? new Date(event.ts) : now,
  }));
  
  // Filter out deduplicated VIEW events
  const filteredEvents: EnrichedEvent[] = [];
  let dedupedCount = 0;
  
  for (const event of enrichedEvents) {
    if (event.type === "VIEW" && event.ruleId && shouldDedupeView(ipHash, event.ruleId)) {
      dedupedCount++;
      logger.debug("Deduped VIEW event", { 
        ruleId: event.ruleId, 
        ipHash: ipHash.substring(0, 8) 
      });
    } else {
      filteredEvents.push(event);
    }
  }
  
  if (filteredEvents.length === 0) {
    return { accepted: 0, deduped: dedupedCount };
  }
  
  // Prepare data for database insertion
  const dbEvents = filteredEvents.map(event => ({
    type: event.type,
    userId: event.userId || null,
    ruleId: event.ruleId || null,
    ruleVersionId: event.ruleVersionId || null,
    ipHash: event.ipHash,
    uaHash: event.uaHash,
    createdAt: event.createdAt,
  }));
  
  try {
    // Batch insert events
    const result = await prisma.event.createMany({
      data: dbEvents,
      skipDuplicates: true, // Handle any remaining duplicates at DB level
    });
    
    logger.info("Events recorded", {
      requested: events.length,
      accepted: result.count,
      deduped: dedupedCount,
      types: [...new Set(filteredEvents.map(e => e.type))],
    });
    
    return { 
      accepted: result.count, 
      deduped: dedupedCount 
    };
  } catch (error) {
    logger.error("Failed to record events", { 
      error: error instanceof Error ? error.message : String(error),
      eventCount: filteredEvents.length,
    });
    throw error;
  }
}
