/**
 * Date and time utilities
 */

/**
 * Format date to ISO string
 */
export function toISOString(date: Date): string {
  return date.toISOString();
}

/**
 * Parse ISO string to Date
 */
export function fromISOString(isoString: string): Date {
  return new Date(isoString);
}

/**
 * Get current timestamp in seconds
 */
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Get current timestamp in milliseconds
 */
export function getCurrentTimestampMs(): number {
  return Date.now();
}

/**
 * Add time to date
 */
export function addTime(
  date: Date,
  amount: number,
  unit: "seconds" | "minutes" | "hours" | "days" | "weeks"
): Date {
  const newDate = new Date(date);

  switch (unit) {
    case "seconds":
      newDate.setSeconds(newDate.getSeconds() + amount);
      break;
    case "minutes":
      newDate.setMinutes(newDate.getMinutes() + amount);
      break;
    case "hours":
      newDate.setHours(newDate.getHours() + amount);
      break;
    case "days":
      newDate.setDate(newDate.getDate() + amount);
      break;
    case "weeks":
      newDate.setDate(newDate.getDate() + amount * 7);
      break;
  }

  return newDate;
}

/**
 * Subtract time from date
 */
export function subtractTime(
  date: Date,
  amount: number,
  unit: "seconds" | "minutes" | "hours" | "days" | "weeks"
): Date {
  return addTime(date, -amount, unit);
}

/**
 * Check if date is in the past
 */
export function isInPast(date: Date): boolean {
  return date < new Date();
}

/**
 * Check if date is in the future
 */
export function isInFuture(date: Date): boolean {
  return date > new Date();
}

/**
 * Check if date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

/**
 * Check if date is yesterday
 */
export function isYesterday(date: Date): boolean {
  const yesterday = subtractTime(new Date(), 1, "days");
  return date.toDateString() === yesterday.toDateString();
}

/**
 * Check if date is tomorrow
 */
export function isTomorrow(date: Date): boolean {
  const tomorrow = addTime(new Date(), 1, "days");
  return date.toDateString() === tomorrow.toDateString();
}

/**
 * Get difference between two dates
 */
export function getDateDifference(
  date1: Date,
  date2: Date,
  unit: "seconds" | "minutes" | "hours" | "days"
): number {
  const diffMs = Math.abs(date1.getTime() - date2.getTime());

  switch (unit) {
    case "seconds":
      return Math.floor(diffMs / 1000);
    case "minutes":
      return Math.floor(diffMs / (1000 * 60));
    case "hours":
      return Math.floor(diffMs / (1000 * 60 * 60));
    case "days":
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }
}

/**
 * Format date as relative time (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const absDiffMs = Math.abs(diffMs);

  const seconds = Math.floor(absDiffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  const isPast = diffMs < 0;
  const suffix = isPast ? "ago" : "from now";
  const prefix = isPast ? "" : "in ";

  if (years > 0) {
    return `${prefix}${years} year${years > 1 ? "s" : ""} ${suffix}`;
  } else if (months > 0) {
    return `${prefix}${months} month${months > 1 ? "s" : ""} ${suffix}`;
  } else if (weeks > 0) {
    return `${prefix}${weeks} week${weeks > 1 ? "s" : ""} ${suffix}`;
  } else if (days > 0) {
    return `${prefix}${days} day${days > 1 ? "s" : ""} ${suffix}`;
  } else if (hours > 0) {
    return `${prefix}${hours} hour${hours > 1 ? "s" : ""} ${suffix}`;
  } else if (minutes > 0) {
    return `${prefix}${minutes} minute${minutes > 1 ? "s" : ""} ${suffix}`;
  } else {
    return `${prefix}${seconds} second${seconds > 1 ? "s" : ""} ${suffix}`;
  }
}

/**
 * Format date in a human-readable format
 */
export function formatDate(
  date: Date,
  format: "short" | "medium" | "long" | "full" = "medium"
): string {
  const options: Intl.DateTimeFormatOptions = {};

  switch (format) {
    case "short":
      options.dateStyle = "short";
      break;
    case "medium":
      options.dateStyle = "medium";
      break;
    case "long":
      options.dateStyle = "long";
      break;
    case "full":
      options.dateStyle = "full";
      break;
  }

  return date.toLocaleDateString(undefined, options);
}

/**
 * Format time in a human-readable format
 */
export function formatTime(
  date: Date,
  format: "short" | "medium" | "long" = "short"
): string {
  const options: Intl.DateTimeFormatOptions = {};

  switch (format) {
    case "short":
      options.timeStyle = "short";
      break;
    case "medium":
      options.timeStyle = "medium";
      break;
    case "long":
      options.timeStyle = "long";
      break;
  }

  return date.toLocaleTimeString(undefined, options);
}

/**
 * Format date and time together
 */
export function formatDateTime(
  date: Date,
  dateFormat: "short" | "medium" | "long" = "medium",
  timeFormat: "short" | "medium" | "long" = "short"
): string {
  return `${formatDate(date, dateFormat)} ${formatTime(date, timeFormat)}`;
}

/**
 * Get start of day
 */
export function startOfDay(date: Date): Date {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
}

/**
 * Get end of day
 */
export function endOfDay(date: Date): Date {
  const newDate = new Date(date);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
}

/**
 * Get start of week (Sunday)
 */
export function startOfWeek(date: Date): Date {
  const newDate = new Date(date);
  const day = newDate.getDay();
  const diff = newDate.getDate() - day;
  newDate.setDate(diff);
  return startOfDay(newDate);
}

/**
 * Get end of week (Saturday)
 */
export function endOfWeek(date: Date): Date {
  const newDate = new Date(date);
  const day = newDate.getDay();
  const diff = newDate.getDate() - day + 6;
  newDate.setDate(diff);
  return endOfDay(newDate);
}

/**
 * Get start of month
 */
export function startOfMonth(date: Date): Date {
  const newDate = new Date(date);
  newDate.setDate(1);
  return startOfDay(newDate);
}

/**
 * Get end of month
 */
export function endOfMonth(date: Date): Date {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + 1, 0);
  return endOfDay(newDate);
}
