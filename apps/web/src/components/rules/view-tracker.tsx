"use client";

import { useEffect } from "react";
import { useViewDeduplication } from "@/lib/metrics/read";
import { recordViewAction } from "@/lib/metrics/actions";

interface ViewTrackerProps {
  ruleId: string;
  ruleVersionId?: string;
}

/**
 * Client component that tracks rule views with deduplication
 * This should be rendered once per rule page
 */
export function ViewTracker({ ruleId, ruleVersionId }: ViewTrackerProps) {
  const { shouldRecordView, markAsViewed } = useViewDeduplication(ruleId);

  useEffect(() => {
    if (shouldRecordView) {
      // Mark as viewed immediately to prevent duplicate calls
      markAsViewed();

      // Record the view event (fire-and-forget)
      recordViewAction(ruleId, ruleVersionId).catch((error) => {
        console.warn("Failed to record view event:", error);
      });
    }
  }, [ruleId, ruleVersionId, shouldRecordView, markAsViewed]);

  // This component doesn't render anything
  return null;
}
