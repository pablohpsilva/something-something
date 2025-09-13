/**
 * Formatting utilities for dates, numbers, and text
 */

/**
 * Format a date relative to now (e.g., "2 hours ago", "3 days ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const target = new Date(date);
  const diffMs = now.getTime() - target.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSeconds < 60) {
    return "just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else if (diffWeeks < 4) {
    return `${diffWeeks}w ago`;
  } else if (diffMonths < 12) {
    return `${diffMonths}mo ago`;
  } else {
    return `${diffYears}y ago`;
  }
}

/**
 * Format a date as a readable string (e.g., "Jan 15, 2024")
 */
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

/**
 * Format a date with time (e.g., "Jan 15, 2024 at 3:30 PM")
 */
export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

/**
 * Format a number with appropriate suffixes (e.g., 1.2K, 3.4M)
 */
export function formatNumber(num: number): string {
  if (num < 1000) {
    return num.toString();
  } else if (num < 1000000) {
    return `${(num / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  } else if (num < 1000000000) {
    return `${(num / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  } else {
    return `${(num / 1000000000).toFixed(1).replace(/\.0$/, "")}B`;
  }
}

/**
 * Format a number as a percentage
 */
export function formatPercentage(num: number, decimals = 1): string {
  return `${(num * 100).toFixed(decimals)}%`;
}

/**
 * Format currency (cents to dollars)
 */
export function formatCurrency(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

/**
 * Pluralize a word based on count
 */
export function pluralize(
  count: number,
  singular: string,
  plural?: string
): string {
  if (count === 1) return singular;
  return plural || `${singular}s`;
}

/**
 * Format a score with appropriate styling
 */
export function formatScore(score: number): string {
  if (score === 0) return "0";
  if (score > 0) return `+${formatNumber(score)}`;
  return formatNumber(score);
}

/**
 * Format version string (ensure it starts with 'v')
 */
export function formatVersion(version: string): string {
  return version.startsWith("v") ? version : `v${version}`;
}

/**
 * Format file size in bytes to human readable
 */
export function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
