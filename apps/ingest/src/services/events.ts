import crypto from "crypto";
import { prisma } from "../prisma";
import { logger } from "../logger";
import { getEnv } from "../env";
import type { EventInput, EnrichedEvent } from "../schemas/events";
import { AbuseConfig } from "@repo/config/abuse";
import { hashIp, hashUA, extractIp, extractUA } from "@repo/utils/crypto";
import { analyzeAnomaly, type AnomalyEvent } from "@repo/utils/anomaly";
import { once } from "@repo/utils/idempotency";

// Enhanced deduplication cache with burst protection
const viewDedupeCache = new Map<string, number>();
const burstCache = new Map<string, { count: number; firstSeen: number }>();

// Clean up old cache entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const viewWindowMs = AbuseConfig.windows.viewDedupMs;
  const burstWindowMs = 60_000; // 1 minute for burst detection
  
  // Clean view dedupe cache
  for (const [key, timestamp] of viewDedupeCache.entries()) {
    if (now - timestamp > viewWindowMs) {
      viewDedupeCache.delete(key);
    }
  }
  
  // Clean burst cache
  for (const [key, data] of burstCache.entries()) {
    if (now - data.firstSeen > burstWindowMs) {
      burstCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Enhanced request hash generation using privacy-preserving methods
 */
export function getRequestHashes(headers: Record<string, string | undefined>): {
  ipHash: string;
  uaHash: string;
} {
  const ip = extractIp(headers);
  const ua = extractUA(headers);
  
  return {
    ipHash: hashIp(ip, AbuseConfig.salts.ip),
    uaHash: hashUA(ua, AbuseConfig.salts.ua),
  };
}

function shouldDedupeView(ipHash: string, ruleId: string): boolean {
  if (!ruleId) return false; // Can't dedupe without ruleId
  
  const key = `${ipHash}:${ruleId}`;
  const now = Date.now();
  const lastView = viewDedupeCache.get(key);
  const windowMs = AbuseConfig.windows.viewDedupMs;
  
  if (lastView && (now - lastView) < windowMs) {
    return true; // Should dedupe
  }
  
  // Update cache
  viewDedupeCache.set(key, now);
  return false; // Don't dedupe
}

/**
 * Determine if an event should be processed based on deduplication rules
 */
function shouldProcessEvent(event: EnrichedEvent, ipHash: string): boolean {
  // Apply VIEW deduplication
  if (event.type === "VIEW" && event.ruleId && shouldDedupeView(ipHash, event.ruleId)) {
    return false;
  }
  
  // Add other event-specific processing rules here
  return true;
}

export async function recordEvents(
  events: EventInput[],
  requestHeaders: Record<string, string | undefined>
): Promise<{ accepted: number; deduped: number; blocked: number; anomalies: number }> {
  const { ipHash, uaHash } = getRequestHashes(requestHeaders);
  const now = new Date();
  
  // Enrich events with metadata
  const enrichedEvents: EnrichedEvent[] = events.map(event => ({
    ...event,
    ipHash,
    uaHash,
    createdAt: event.ts ? new Date(event.ts) : now,
  }));

  // Apply anti-abuse filters
  const filteredEvents: EnrichedEvent[] = [];
  let dedupedCount = 0;
  let blockedCount = 0;
  let anomalyCount = 0;

  // Group events for burst detection
  const eventGroups = new Map<string, EnrichedEvent[]>();
  
  for (const event of enrichedEvents) {
    const groupKey = `${event.type}:${event.ruleId || 'global'}:${ipHash}`;
    if (!eventGroups.has(groupKey)) {
      eventGroups.set(groupKey, []);
    }
    eventGroups.get(groupKey)!.push(event);
  }

  // Process each group with burst protection
  for (const [groupKey, groupEvents] of eventGroups.entries()) {
    const [eventType, ruleId, eventIpHash] = groupKey.split(':');
    
    // Check for burst activity
    const burstKey = `${eventType}:${ruleId}:${eventIpHash}`;
    const burstData = burstCache.get(burstKey);
    const burstWindowMs = 60_000; // 1 minute
    
    if (burstData && (now.getTime() - burstData.firstSeen) < burstWindowMs) {
      burstData.count += groupEvents.length;
      
      // Apply burst limits
      const maxEventsPerMin = AbuseConfig.burst.maxIdenticalEventsPerMin;
      if (burstData.count > maxEventsPerMin) {
        // Keep only the first N events, block the rest
        const allowedCount = Math.max(0, maxEventsPerMin - (burstData.count - groupEvents.length));
        const allowedEvents = groupEvents.slice(0, allowedCount);
        const blockedEvents = groupEvents.slice(allowedCount);
        
        blockedCount += blockedEvents.length;
        
        logger.warn("Burst protection triggered", {
          eventType,
          ruleId: ruleId !== 'global' ? ruleId : undefined,
          ipHash: eventIpHash.substring(0, 8),
          totalEvents: burstData.count,
          blockedEvents: blockedEvents.length,
          allowedEvents: allowedEvents.length,
        });
        
        // Process only allowed events
        for (const event of allowedEvents) {
          if (shouldProcessEvent(event, ipHash)) {
            filteredEvents.push(event);
          } else {
            dedupedCount++;
          }
        }
        continue;
      }
    } else {
      // First burst or expired window
      burstCache.set(burstKey, {
        count: groupEvents.length,
        firstSeen: now.getTime(),
      });
    }

    // Process events normally (no burst detected)
    for (const event of groupEvents) {
      if (shouldProcessEvent(event, ipHash)) {
        filteredEvents.push(event);
      } else {
        dedupedCount++;
      }
    }
  }

  // Anomaly detection
  if (filteredEvents.length > 0) {
    try {
      const anomalyEvents: AnomalyEvent[] = filteredEvents.map(event => ({
        timestamp: event.createdAt.getTime(),
        type: event.type,
        userId: event.userId,
        ipHash,
        uaHash,
        ruleId: event.ruleId,
        metadata: event.metadata,
      }));

      const anomalyKey = `${ipHash}:${uaHash}`;
      const anomalyScore = analyzeAnomaly(anomalyKey, anomalyEvents[0]);

      if (anomalyScore.overall > AbuseConfig.anomaly.thresholds.warning) {
        anomalyCount++;
        
        logger.warn("Anomaly detected", {
          ipHash: ipHash.substring(0, 8),
          uaHash: uaHash.substring(0, 8),
          score: anomalyScore.overall,
          components: anomalyScore.components,
          metadata: anomalyScore.metadata,
        });

        // Log to audit if configured
        if (AbuseConfig.audit.logAnomalies) {
          // This would be logged to AuditLog in a real implementation
          // For now, we just log to console
        }
      }
    } catch (error) {
      logger.error("Anomaly detection failed", { error });
    }
  }
  
  if (filteredEvents.length === 0) {
    return { 
      accepted: 0, 
      deduped: dedupedCount, 
      blocked: blockedCount, 
      anomalies: anomalyCount 
    };
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
      blocked: blockedCount,
      anomalies: anomalyCount,
      types: [...new Set(filteredEvents.map(e => e.type))],
    });
    
    return { 
      accepted: result.count, 
      deduped: dedupedCount,
      blocked: blockedCount,
      anomalies: anomalyCount
    };
  } catch (error) {
    logger.error("Failed to record events", { 
      error: error instanceof Error ? error.message : String(error),
      eventCount: filteredEvents.length,
    });
    throw error;
  }
}
