/**
 * Event sender utilities for communicating with the ingest service
 */

import {
  EventType,
  EVENT_ENDPOINT,
  generateIdempotencyKey,
  simpleHash,
} from "@repo/utils/metrics";

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
 * Send events to the ingest service
 * @param events Array of events to send
 * @param options Request context options
 * @returns Promise that resolves to success status
 */
export async function sendEventsToIngest(
  events: EventData[],
  options: SendEventsOptions
): Promise<{ success: boolean; accepted?: number; error?: string }> {
  const ingestBaseUrl = process.env.INGEST_BASE_URL;
  const ingestAppToken = process.env.INGEST_APP_TOKEN;

  if (!ingestBaseUrl || !ingestAppToken) {
    console.warn("Ingest service not configured, skipping event emission");
    return { success: false, error: "Service not configured" };
  }

  try {
    const url = `${ingestBaseUrl}${EVENT_ENDPOINT}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-token": ingestAppToken,
        "x-forwarded-for": options.ip,
        "user-agent": options.userAgent,
      },
      body: JSON.stringify({ events }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(`Ingest service error: ${response.status} - ${errorText}`);
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const result = await response.json();
    return {
      success: true,
      accepted: result.accepted,
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
