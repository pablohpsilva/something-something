/**
 * Client-side utilities for reading and managing metrics
 */

"use client";

import { useState, useEffect } from "react";
import { shouldDedupeView, setViewDedupeCookie } from "@repo/utils/metrics";

export interface MetricsData {
  views7: number;
  copies7: number;
  saves7: number;
  forks7: number;
  votes7: number;
  views30: number;
  copies30: number;
  saves30: number;
  forks30: number;
  votes30: number;
  score: number;
}

export interface OptimisticMetrics {
  copies7?: number;
  saves7?: number;
  forks7?: number;
  votes7?: number;
}

/**
 * Hook for managing optimistic metrics updates
 * @param initialMetrics Initial metrics data
 * @returns Object with current metrics and update functions
 */
export function useOptimisticMetrics(initialMetrics: MetricsData) {
  const [optimisticUpdates, setOptimisticUpdates] = useState<OptimisticMetrics>(
    {}
  );

  const currentMetrics: MetricsData = {
    ...initialMetrics,
    copies7: initialMetrics.copies7 + (optimisticUpdates.copies7 || 0),
    saves7: initialMetrics.saves7 + (optimisticUpdates.saves7 || 0),
    forks7: initialMetrics.forks7 + (optimisticUpdates.forks7 || 0),
    votes7: initialMetrics.votes7 + (optimisticUpdates.votes7 || 0),
  };

  const incrementMetric = (
    metric: keyof OptimisticMetrics,
    delta: number = 1
  ) => {
    setOptimisticUpdates((prev) => ({
      ...prev,
      [metric]: (prev[metric] || 0) + delta,
    }));
  };

  const revertMetric = (metric: keyof OptimisticMetrics, delta: number = 1) => {
    setOptimisticUpdates((prev) => ({
      ...prev,
      [metric]: Math.max(0, (prev[metric] || 0) - delta),
    }));
  };

  const resetOptimistic = () => {
    setOptimisticUpdates({});
  };

  return {
    currentMetrics,
    incrementMetric,
    revertMetric,
    resetOptimistic,
    hasOptimisticUpdates: Object.keys(optimisticUpdates).length > 0,
  };
}

/**
 * Hook for managing view deduplication on the client side
 * @param ruleId Rule ID
 * @returns Object with deduplication status and functions
 */
export function useViewDeduplication(ruleId: string) {
  const [hasViewed, setHasViewed] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Check if view should be deduplicated
    const shouldSkip = shouldDedupeView(ruleId);
    setHasViewed(shouldSkip);
    setIsChecking(false);
  }, [ruleId]);

  const markAsViewed = () => {
    if (!hasViewed) {
      setViewDedupeCookie(ruleId);
      setHasViewed(true);
    }
  };

  return {
    hasViewed,
    isChecking,
    markAsViewed,
    shouldRecordView: !hasViewed && !isChecking,
  };
}

/**
 * Format metrics number for display
 * @param num Number to format
 * @returns Formatted string
 */
export function formatMetricNumber(num: number): string {
  if (num < 1000) {
    return num.toString();
  } else if (num < 1000000) {
    return `${(num / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  } else {
    return `${(num / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  }
}

/**
 * Get metric label for accessibility
 * @param metric Metric type
 * @param count Count value
 * @param period Period (7 or 30 days)
 * @returns Accessibility label
 */
export function getMetricLabel(
  metric: "views" | "copies" | "saves" | "forks" | "votes",
  count: number,
  period: number = 7
): string {
  const metricNames = {
    views: "view",
    copies: "copy",
    saves: "save",
    forks: "fork",
    votes: "vote",
  };

  const singular = metricNames[metric];
  const plural = `${singular}s`;
  const countText = count === 1 ? `1 ${singular}` : `${count} ${plural}`;

  return `${countText} in the last ${period} days`;
}

/**
 * Show a toast notification (simple implementation)
 * @param message Message to show
 * @param type Type of toast
 */
export function showToast(
  message: string,
  type: "success" | "error" | "info" = "info"
): void {
  // Simple toast implementation - in a real app you'd use a proper toast library
  console.log(`[${type.toUpperCase()}] ${message}`);

  // You could integrate with react-hot-toast, sonner, or similar here
  if (typeof window !== "undefined") {
    // Create a simple visual toast
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 6px;
      color: white;
      font-size: 14px;
      z-index: 9999;
      max-width: 300px;
      background: ${
        type === "error"
          ? "#ef4444"
          : type === "success"
          ? "#10b981"
          : "#3b82f6"
      };
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      document.body.removeChild(toast);
    }, 3000);
  }
}
