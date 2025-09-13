/**
 * Event sender utilities for communicating with the ingest service
 * Enhanced with anti-abuse deduplication and backoff
 */

import {
  EventType,
  EVENT_ENDPOINT,
  generateIdempotencyKey,
  simpleHash,
} from "@repo/utils/metrics";
import { shouldDedupeView, shouldDedupeAction, generateActionKey } from "../abuse/dedup";
import { withRetry, handleRateLimit, formatWaitTime } from "../abuse/backoff";

interface EventData {
  type: EventType;
  ruleId?: string;
  ruleVersionId?: string;
  userId?: string | null;
  ts?: string;
  idempotencyKey?: string;
}

interface SendEventsOptions {
  ip: string;
  userAgent: string;
  userId: string | null;
}

/**
 * Send events to the ingest service with anti-abuse protection
 * @param events Array of events to send
 * @param options Request context options
 * @returns Promise that resolves to success status
 */
export async function sendEventsToIngest(
  events: EventData[],
  options: SendEventsOptions
): Promise<{ 
  success: boolean; 
  accepted?: number; 
  deduped?: number;
  blocked?: number;
  error?: string;
  retryAfter?: number;
}> {
  const ingestBaseUrl = process.env.INGEST_BASE_URL;
  const ingestAppToken = process.env.INGEST_APP_TOKEN;

  if (!ingestBaseUrl || !ingestAppToken) {
    console.warn("Ingest service not configured, skipping event emission");
    return { success: false, error: "Service not configured" };
  }

  // Apply client-side deduplication
  const filteredEvents: EventData[] = [];
  let dedupedCount = 0;

  for (const event of events) {
    let shouldSkip = false;

    // Dedupe VIEW events using cookies
    if (event.type === "VIEW" && event.ruleId) {
      if (shouldDedupeView(event.ruleId)) {
        dedupedCount++;
        shouldSkip = true;
      }
    }

    // Dedupe other actions using localStorage
    if (!shouldSkip && event.type !== "VIEW") {
      const actionKey = generateActionKey(
        event.type,
        event.ruleId || event.ruleVersionId,
        options.userId || undefined
      );
      
      if (shouldDedupeAction(actionKey)) {
        dedupedCount++;
        shouldSkip = true;
      }
    }

    if (!shouldSkip) {
      filteredEvents.push(event);
    }
  }

  // If all events were deduped, return early
  if (filteredEvents.length === 0) {
    return { 
      success: true, 
      accepted: 0, 
      deduped: dedupedCount 
    };
  }

  // Send events with retry logic
  const operationKey = `ingest:${options.userId || 'anonymous'}`;
  
  try {
    const result = await withRetry(
      async () => {
        const url = `${ingestBaseUrl}${EVENT_ENDPOINT}`;

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-app-token": ingestAppToken,
            "x-forwarded-for": options.ip,
            "user-agent": options.userAgent,
          },
          body: JSON.stringify({ events: filteredEvents }),
        });

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('retry-after');
          const errorData = await response.json().catch(() => ({}));
          
          const error = new Error('Rate limit exceeded');
          (error as any).code = 'TOO_MANY_REQUESTS';
          (error as any).status = 429;
          (error as any).retryAfter = retryAfter ? parseInt(retryAfter) : undefined;
          (error as any).cause = errorData;
          
          throw error;
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        return response.json();
      },
      {
        key: operationKey,
        maxAttempts: 3,
        onRetry: (attempt, error) => {
          console.warn(`Event send retry ${attempt}:`, error.message);
        },
      }
    );

    return {
      success: true,
      accepted: result.accepted || filteredEvents.length,
      deduped: dedupedCount + (result.deduped || 0),
      blocked: result.blocked || 0,
    };
  } catch (error) {
    console.error("Failed to send events to ingest service:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send a single event to the ingest service
 * @param eventType Type of event
 * @param ruleId Rule ID (optional)
 * @param ruleVersionId Rule version ID (optional)
 * @param options Request context options
 * @param generateIdempotency Whether to generate an idempotency key
 * @returns Promise that resolves to success status
 */
export async function sendSingleEvent(
  eventType: EventType,
  ruleId: string | undefined,
  ruleVersionId: string | undefined,
  options: SendEventsOptions,
  generateIdempotency: boolean = false
): Promise<{ success: boolean; accepted?: number; error?: string }> {
  const event: EventData = {
    type: eventType,
    ruleId,
    ruleVersionId,
    userId: options.userId,
    ts: new Date().toISOString(),
  };

  // Generate idempotency key for non-VIEW events or when explicitly requested
  if (generateIdempotency && ruleId) {
    const ipHash = simpleHash(options.ip);
    event.idempotencyKey = generateIdempotencyKey(
      options.userId,
      ipHash,
      ruleId,
      eventType
    );
  }

  return sendEventsToIngest([event], options);
}

/**
 * Send a VIEW event (fire-and-forget, no error throwing)
 * @param ruleId Rule ID
 * @param ruleVersionId Rule version ID (optional)
 * @param options Request context options
 */
export async function sendViewEvent(
  ruleId: string,
  ruleVersionId: string | undefined,
  options: SendEventsOptions
): Promise<void> {
  try {
    await sendSingleEvent("VIEW", ruleId, ruleVersionId, options, false);
  } catch (error) {
    // Fire-and-forget: log but don't throw
    console.warn("Failed to send VIEW event:", error);
  }
}

/**
 * Send an action event (COPY, SAVE, FORK) with error handling
 * @param eventType Event type
 * @param ruleId Rule ID
 * @param ruleVersionId Rule version ID (optional)
 * @param options Request context options
 * @returns Promise that resolves to success status
 */
export async function sendActionEvent(
  eventType: Exclude<EventType, "VIEW">,
  ruleId: string,
  ruleVersionId: string | undefined,
  options: SendEventsOptions
): Promise<{ success: boolean; error?: string }> {
  const result = await sendSingleEvent(
    eventType,
    ruleId,
    ruleVersionId,
    options,
    true // Generate idempotency key
  );

  return {
    success: result.success,
    error: result.error,
  };
}
