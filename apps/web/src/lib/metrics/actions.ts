/**
 * Server actions for recording metrics events
 */

"use server";

import { unstable_noStore as noStore } from "next/cache";
import { getMetricsContext } from "@/server/req-context";
import { sendViewEvent, sendActionEvent } from "./event-sender";
import { shouldDedupeView, setViewDedupeCookie } from "@repo/utils/metrics";
import type { EventType } from "@repo/utils/metrics";

/**
 * Record a VIEW event for a rule (fire-and-forget)
 * @param ruleId Rule ID
 * @param ruleVersionId Rule version ID (optional)
 */
export async function recordViewAction(
  ruleId: string,
  ruleVersionId?: string
): Promise<void> {
  noStore(); // Don't cache this action

  try {
    const context = await getMetricsContext();

    // Send to ingest service (fire-and-forget)
    sendViewEvent(ruleId, ruleVersionId, context);
  } catch (error) {
    // Fire-and-forget: log but don't throw
    console.warn("Failed to record VIEW event:", error);
  }
}

/**
 * Record an action event (COPY, SAVE, FORK) with error handling
 * @param eventType Event type
 * @param ruleId Rule ID
 * @param ruleVersionId Rule version ID (optional)
 * @returns Promise that resolves to success status
 */
export async function recordActionEvent(
  eventType: Exclude<EventType, "VIEW">,
  ruleId: string,
  ruleVersionId?: string
): Promise<{ success: boolean; error?: string }> {
  noStore(); // Don't cache this action

  try {
    const context = await getMetricsContext();

    const result = await sendActionEvent(
      eventType,
      ruleId,
      ruleVersionId,
      context
    );

    return result;
  } catch (error) {
    console.error(`Failed to record ${eventType} event:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Record a COPY event
 * @param ruleId Rule ID
 * @param ruleVersionId Rule version ID (optional)
 * @returns Promise that resolves to success status
 */
export async function recordCopyAction(
  ruleId: string,
  ruleVersionId?: string
): Promise<{ success: boolean; error?: string }> {
  return recordActionEvent("COPY", ruleId, ruleVersionId);
}

/**
 * Record a SAVE event
 * @param ruleId Rule ID
 * @param ruleVersionId Rule version ID (optional)
 * @returns Promise that resolves to success status
 */
export async function recordSaveAction(
  ruleId: string,
  ruleVersionId?: string
): Promise<{ success: boolean; error?: string }> {
  return recordActionEvent("SAVE", ruleId, ruleVersionId);
}

/**
 * Record a FORK event
 * @param ruleId Rule ID
 * @param ruleVersionId Rule version ID (optional)
 * @returns Promise that resolves to success status
 */
export async function recordForkAction(
  ruleId: string,
  ruleVersionId?: string
): Promise<{ success: boolean; error?: string }> {
  return recordActionEvent("FORK", ruleId, ruleVersionId);
}

/**
 * Record a VOTE event
 * @param ruleId Rule ID
 * @param ruleVersionId Rule version ID (optional)
 * @returns Promise that resolves to success status
 */
export async function recordVoteAction(
  ruleId: string,
  ruleVersionId?: string
): Promise<{ success: boolean; error?: string }> {
  return recordActionEvent("VOTE", ruleId, ruleVersionId);
}

/**
 * Record a COMMENT event
 * @param ruleId Rule ID
 * @param ruleVersionId Rule version ID (optional)
 * @returns Promise that resolves to success status
 */
export async function recordCommentAction(
  ruleId: string,
  ruleVersionId?: string
): Promise<{ success: boolean; error?: string }> {
  return recordActionEvent("COMMENT", ruleId, ruleVersionId);
}
