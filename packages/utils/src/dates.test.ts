import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  toISOString,
  fromISOString,
  getCurrentTimestamp,
  getCurrentTimestampMs,
  addTime,
  subtractTime,
  isInPast,
  isInFuture,
  isToday,
  isYesterday,
  isTomorrow,
  getDateDifference,
  formatRelativeTime,
  formatDate,
  formatTime,
  formatDateTime,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "./dates";

describe("Date utilities", () => {
  let fixedDate: Date;

  beforeEach(() => {
    // Use a fixed date for consistent testing
    fixedDate = new Date("2023-06-15T12:30:45.123Z"); // Thursday, June 15, 2023
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("toISOString", () => {
    it("should convert date to ISO string", () => {
      const date = new Date("2023-06-15T12:30:45.123Z");
      const result = toISOString(date);

      expect(result).toBe("2023-06-15T12:30:45.123Z");
    });

    it("should handle different dates", () => {
      const date1 = new Date("2023-01-01T00:00:00.000Z");
      const date2 = new Date("2023-12-31T23:59:59.999Z");

      expect(toISOString(date1)).toBe("2023-01-01T00:00:00.000Z");
      expect(toISOString(date2)).toBe("2023-12-31T23:59:59.999Z");
    });
  });

  describe("fromISOString", () => {
    it("should parse ISO string to date", () => {
      const isoString = "2023-06-15T12:30:45.123Z";
      const result = fromISOString(isoString);

      expect(result).toBeInstanceOf(Date);
      expect(result.getTime()).toBe(
        new Date("2023-06-15T12:30:45.123Z").getTime()
      );
    });

    it("should handle different ISO formats", () => {
      const result1 = fromISOString("2023-06-15T12:30:45Z");
      const result2 = fromISOString("2023-06-15T12:30:45.123Z");

      expect(result1).toBeInstanceOf(Date);
      expect(result2).toBeInstanceOf(Date);
      expect(result2.getTime()).toBeGreaterThan(result1.getTime());
    });

    it("should be inverse of toISOString", () => {
      const originalDate = new Date("2023-06-15T12:30:45.123Z");
      const isoString = toISOString(originalDate);
      const parsedDate = fromISOString(isoString);

      expect(parsedDate.getTime()).toBe(originalDate.getTime());
    });
  });

  describe("getCurrentTimestamp", () => {
    it("should return current timestamp in seconds", () => {
      const timestamp = getCurrentTimestamp();
      const expectedTimestamp = Math.floor(fixedDate.getTime() / 1000);

      expect(timestamp).toBe(expectedTimestamp);
    });

    it("should return integer", () => {
      const timestamp = getCurrentTimestamp();
      expect(Number.isInteger(timestamp)).toBe(true);
    });
  });

  describe("getCurrentTimestampMs", () => {
    it("should return current timestamp in milliseconds", () => {
      const timestamp = getCurrentTimestampMs();

      expect(timestamp).toBe(fixedDate.getTime());
    });

    it("should be 1000x larger than seconds timestamp", () => {
      const timestampMs = getCurrentTimestampMs();
      const timestampS = getCurrentTimestamp();

      expect(timestampMs).toBe(timestampS * 1000);
    });
  });

  describe("addTime", () => {
    it("should add seconds", () => {
      const date = new Date("2023-06-15T12:30:45Z");
      const result = addTime(date, 30, "seconds");

      expect(result.getTime()).toBe(date.getTime() + 30 * 1000);
    });

    it("should add minutes", () => {
      const date = new Date("2023-06-15T12:30:45Z");
      const result = addTime(date, 15, "minutes");

      expect(result.getTime()).toBe(date.getTime() + 15 * 60 * 1000);
    });

    it("should add hours", () => {
      const date = new Date("2023-06-15T12:30:45Z");
      const result = addTime(date, 3, "hours");

      expect(result.getTime()).toBe(date.getTime() + 3 * 60 * 60 * 1000);
    });

    it("should add days", () => {
      const date = new Date("2023-06-15T12:30:45Z");
      const result = addTime(date, 2, "days");

      expect(result.getDate()).toBe(date.getDate() + 2);
    });

    it("should add weeks", () => {
      const date = new Date("2023-06-15T12:30:45Z");
      const result = addTime(date, 1, "weeks");

      expect(result.getDate()).toBe(date.getDate() + 7);
    });

    it("should not modify original date", () => {
      const date = new Date("2023-06-15T12:30:45Z");
      const originalTime = date.getTime();

      addTime(date, 1, "days");

      expect(date.getTime()).toBe(originalTime);
    });

    it("should handle negative amounts", () => {
      const date = new Date("2023-06-15T12:30:45Z");
      const result = addTime(date, -1, "days");

      expect(result.getDate()).toBe(date.getDate() - 1);
    });

    it("should handle month boundaries", () => {
      const date = new Date("2023-06-30T12:30:45Z");
      const result = addTime(date, 1, "days");

      expect(result.getMonth()).toBe(6); // July (0-indexed)
      expect(result.getDate()).toBe(1);
    });
  });

  describe("subtractTime", () => {
    it("should subtract time correctly", () => {
      const date = new Date("2023-06-15T12:30:45Z");
      const result = subtractTime(date, 1, "days");

      expect(result.getDate()).toBe(date.getDate() - 1);
    });

    it("should be equivalent to addTime with negative amount", () => {
      const date = new Date("2023-06-15T12:30:45Z");
      const result1 = subtractTime(date, 5, "hours");
      const result2 = addTime(date, -5, "hours");

      expect(result1.getTime()).toBe(result2.getTime());
    });

    it("should handle all time units", () => {
      const date = new Date("2023-06-15T12:30:45Z");

      const seconds = subtractTime(date, 30, "seconds");
      const minutes = subtractTime(date, 15, "minutes");
      const hours = subtractTime(date, 3, "hours");
      const days = subtractTime(date, 2, "days");
      const weeks = subtractTime(date, 1, "weeks");

      expect(seconds.getTime()).toBeLessThan(date.getTime());
      expect(minutes.getTime()).toBeLessThan(date.getTime());
      expect(hours.getTime()).toBeLessThan(date.getTime());
      expect(days.getTime()).toBeLessThan(date.getTime());
      expect(weeks.getTime()).toBeLessThan(date.getTime());
    });
  });

  describe("isInPast", () => {
    it("should return true for past dates", () => {
      const pastDate = new Date(fixedDate.getTime() - 1000);
      expect(isInPast(pastDate)).toBe(true);
    });

    it("should return false for future dates", () => {
      const futureDate = new Date(fixedDate.getTime() + 1000);
      expect(isInPast(futureDate)).toBe(false);
    });

    it("should return false for current time", () => {
      expect(isInPast(fixedDate)).toBe(false);
    });
  });

  describe("isInFuture", () => {
    it("should return true for future dates", () => {
      const futureDate = new Date(fixedDate.getTime() + 1000);
      expect(isInFuture(futureDate)).toBe(true);
    });

    it("should return false for past dates", () => {
      const pastDate = new Date(fixedDate.getTime() - 1000);
      expect(isInFuture(pastDate)).toBe(false);
    });

    it("should return false for current time", () => {
      expect(isInFuture(fixedDate)).toBe(false);
    });
  });

  describe("isToday", () => {
    it("should return true for dates on the same day", () => {
      const sameDay = new Date("2023-06-15T08:00:00Z"); // Different time, same day
      expect(isToday(sameDay)).toBe(true);
    });

    it("should return false for yesterday", () => {
      const yesterday = new Date("2023-06-14T12:30:45Z");
      expect(isToday(yesterday)).toBe(false);
    });

    it("should return false for tomorrow", () => {
      const tomorrow = new Date("2023-06-16T12:30:45Z");
      expect(isToday(tomorrow)).toBe(false);
    });

    it("should return true for current time", () => {
      expect(isToday(fixedDate)).toBe(true);
    });
  });

  describe("isYesterday", () => {
    it("should return true for yesterday", () => {
      const yesterday = new Date("2023-06-14T12:30:45Z");
      expect(isYesterday(yesterday)).toBe(true);
    });

    it("should return false for today", () => {
      expect(isYesterday(fixedDate)).toBe(false);
    });

    it("should return false for two days ago", () => {
      const twoDaysAgo = new Date("2023-06-13T12:30:45Z");
      expect(isYesterday(twoDaysAgo)).toBe(false);
    });

    it("should handle month boundaries", () => {
      vi.setSystemTime(new Date("2023-07-01T12:30:45Z")); // July 1st
      const lastDayOfJune = new Date("2023-06-30T12:30:45Z");

      expect(isYesterday(lastDayOfJune)).toBe(true);
    });
  });

  describe("isTomorrow", () => {
    it("should return true for tomorrow", () => {
      const tomorrow = new Date("2023-06-16T12:30:45Z");
      expect(isTomorrow(tomorrow)).toBe(true);
    });

    it("should return false for today", () => {
      expect(isTomorrow(fixedDate)).toBe(false);
    });

    it("should return false for day after tomorrow", () => {
      const dayAfter = new Date("2023-06-17T12:30:45Z");
      expect(isTomorrow(dayAfter)).toBe(false);
    });

    it("should handle month boundaries", () => {
      vi.setSystemTime(new Date("2023-06-30T12:30:45Z")); // June 30th
      const firstDayOfJuly = new Date("2023-07-01T12:30:45Z");

      expect(isTomorrow(firstDayOfJuly)).toBe(true);
    });
  });

  describe("getDateDifference", () => {
    it("should calculate difference in seconds", () => {
      const date1 = new Date("2023-06-15T12:30:45Z");
      const date2 = new Date("2023-06-15T12:31:15Z"); // 30 seconds later

      expect(getDateDifference(date1, date2, "seconds")).toBe(30);
      expect(getDateDifference(date2, date1, "seconds")).toBe(30); // Absolute difference
    });

    it("should calculate difference in minutes", () => {
      const date1 = new Date("2023-06-15T12:30:45Z");
      const date2 = new Date("2023-06-15T12:45:45Z"); // 15 minutes later

      expect(getDateDifference(date1, date2, "minutes")).toBe(15);
    });

    it("should calculate difference in hours", () => {
      const date1 = new Date("2023-06-15T12:30:45Z");
      const date2 = new Date("2023-06-15T15:30:45Z"); // 3 hours later

      expect(getDateDifference(date1, date2, "hours")).toBe(3);
    });

    it("should calculate difference in days", () => {
      const date1 = new Date("2023-06-15T12:30:45Z");
      const date2 = new Date("2023-06-18T12:30:45Z"); // 3 days later

      expect(getDateDifference(date1, date2, "days")).toBe(3);
    });

    it("should handle fractional differences (floor)", () => {
      const date1 = new Date("2023-06-15T12:30:45Z");
      const date2 = new Date("2023-06-15T13:15:45Z"); // 45 minutes later

      expect(getDateDifference(date1, date2, "hours")).toBe(0); // Floors to 0
    });

    it("should return 0 for same dates", () => {
      const date = new Date("2023-06-15T12:30:45Z");

      expect(getDateDifference(date, date, "seconds")).toBe(0);
    });
  });

  describe("formatRelativeTime", () => {
    beforeEach(() => {
      // Set fixed time for consistent relative formatting
      vi.setSystemTime(new Date("2023-06-15T12:30:45Z"));
    });

    it("should format seconds ago", () => {
      const date = new Date("2023-06-15T12:30:15Z"); // 30 seconds ago
      expect(formatRelativeTime(date)).toBe("30 seconds ago");
    });

    it("should format minutes ago", () => {
      const date = new Date("2023-06-15T12:15:45Z"); // 15 minutes ago
      expect(formatRelativeTime(date)).toBe("15 minutes ago");
    });

    it("should format hours ago", () => {
      const date = new Date("2023-06-15T09:30:45Z"); // 3 hours ago
      expect(formatRelativeTime(date)).toBe("3 hours ago");
    });

    it("should format days ago", () => {
      const date = new Date("2023-06-13T12:30:45Z"); // 2 days ago
      expect(formatRelativeTime(date)).toBe("2 days ago");
    });

    it("should format future time", () => {
      const date = new Date("2023-06-15T15:30:45Z"); // 3 hours from now
      expect(formatRelativeTime(date)).toBe("in 3 hours from now");
    });

    it("should handle singular vs plural", () => {
      const oneSecondAgo = new Date("2023-06-15T12:30:44Z");
      const twoSecondsAgo = new Date("2023-06-15T12:30:43Z");

      expect(formatRelativeTime(oneSecondAgo)).toBe("1 second ago");
      expect(formatRelativeTime(twoSecondsAgo)).toBe("2 seconds ago");
    });

    it("should format weeks, months, and years", () => {
      const oneWeekAgo = new Date("2023-06-08T12:30:45Z");
      const oneMonthAgo = new Date("2023-05-15T12:30:45Z");
      const oneYearAgo = new Date("2022-06-15T12:30:45Z");

      expect(formatRelativeTime(oneWeekAgo)).toBe("1 week ago");
      expect(formatRelativeTime(oneMonthAgo)).toBe("1 month ago");
      expect(formatRelativeTime(oneYearAgo)).toBe("1 year ago");
    });
  });

  describe("formatDate", () => {
    it("should format date with different styles", () => {
      const date = new Date("2023-06-15T12:30:45Z");

      const short = formatDate(date, "short");
      const medium = formatDate(date, "medium");
      const long = formatDate(date, "long");
      const full = formatDate(date, "full");

      expect(short).toBeTruthy();
      expect(medium).toBeTruthy();
      expect(long).toBeTruthy();
      expect(full).toBeTruthy();

      // Should be different lengths (generally)
      expect(full.length).toBeGreaterThan(short.length);
    });

    it("should use medium as default", () => {
      const date = new Date("2023-06-15T12:30:45Z");

      const defaultFormat = formatDate(date);
      const mediumFormat = formatDate(date, "medium");

      expect(defaultFormat).toBe(mediumFormat);
    });
  });

  describe("formatTime", () => {
    it("should format time with different styles", () => {
      const date = new Date("2023-06-15T12:30:45Z");

      const short = formatTime(date, "short");
      const medium = formatTime(date, "medium");
      const long = formatTime(date, "long");

      expect(short).toBeTruthy();
      expect(medium).toBeTruthy();
      expect(long).toBeTruthy();
    });

    it("should use short as default", () => {
      const date = new Date("2023-06-15T12:30:45Z");

      const defaultFormat = formatTime(date);
      const shortFormat = formatTime(date, "short");

      expect(defaultFormat).toBe(shortFormat);
    });
  });

  describe("formatDateTime", () => {
    it("should combine date and time formatting", () => {
      const date = new Date("2023-06-15T12:30:45Z");

      const formatted = formatDateTime(date);
      const dateFormatted = formatDate(date, "medium");
      const timeFormatted = formatTime(date, "short");

      expect(formatted).toBe(`${dateFormatted} ${timeFormatted}`);
    });

    it("should use custom formats", () => {
      const date = new Date("2023-06-15T12:30:45Z");

      const formatted = formatDateTime(date, "long", "medium");
      const dateFormatted = formatDate(date, "long");
      const timeFormatted = formatTime(date, "medium");

      expect(formatted).toBe(`${dateFormatted} ${timeFormatted}`);
    });
  });

  describe("startOfDay", () => {
    it("should return start of day", () => {
      const date = new Date("2023-06-15T12:30:45.123Z");
      const result = startOfDay(date);

      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
      expect(result.getDate()).toBe(date.getDate());
    });

    it("should not modify original date", () => {
      const date = new Date("2023-06-15T12:30:45.123Z");
      const originalTime = date.getTime();

      startOfDay(date);

      expect(date.getTime()).toBe(originalTime);
    });
  });

  describe("endOfDay", () => {
    it("should return end of day", () => {
      const date = new Date("2023-06-15T12:30:45.123Z");
      const result = endOfDay(date);

      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
      expect(result.getDate()).toBe(date.getDate());
    });

    it("should not modify original date", () => {
      const date = new Date("2023-06-15T12:30:45.123Z");
      const originalTime = date.getTime();

      endOfDay(date);

      expect(date.getTime()).toBe(originalTime);
    });
  });

  describe("startOfWeek", () => {
    it("should return start of week (Sunday)", () => {
      const thursday = new Date("2023-06-15T12:30:45Z"); // Thursday
      const result = startOfWeek(thursday);

      expect(result.getDay()).toBe(0); // Sunday
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getDate()).toBe(11); // June 11, 2023 was a Sunday
    });

    it("should handle Sunday (already start of week)", () => {
      const sunday = new Date("2023-06-11T12:30:45Z"); // Sunday
      const result = startOfWeek(sunday);

      expect(result.getDay()).toBe(0);
      expect(result.getDate()).toBe(11);
    });

    it("should handle Saturday (end of week)", () => {
      const saturday = new Date("2023-06-17T12:30:45Z"); // Saturday
      const result = startOfWeek(saturday);

      expect(result.getDay()).toBe(0);
      expect(result.getDate()).toBe(11); // Previous Sunday
    });
  });

  describe("endOfWeek", () => {
    it("should return end of week (Saturday)", () => {
      const thursday = new Date("2023-06-15T12:30:45Z"); // Thursday
      const result = endOfWeek(thursday);

      expect(result.getDay()).toBe(6); // Saturday
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getDate()).toBe(17); // June 17, 2023 was a Saturday
    });

    it("should handle Saturday (already end of week)", () => {
      const saturday = new Date("2023-06-17T12:30:45Z"); // Saturday
      const result = endOfWeek(saturday);

      expect(result.getDay()).toBe(6);
      expect(result.getDate()).toBe(17);
    });
  });

  describe("startOfMonth", () => {
    it("should return start of month", () => {
      const date = new Date("2023-06-15T12:30:45Z");
      const result = startOfMonth(date);

      expect(result.getDate()).toBe(1);
      expect(result.getMonth()).toBe(5); // June (0-indexed)
      expect(result.getFullYear()).toBe(2023);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
    });

    it("should handle first day of month", () => {
      const date = new Date("2023-06-01T12:30:45Z");
      const result = startOfMonth(date);

      expect(result.getDate()).toBe(1);
      expect(result.getHours()).toBe(0);
    });

    it("should handle last day of month", () => {
      const date = new Date("2023-06-30T12:30:45Z");
      const result = startOfMonth(date);

      expect(result.getDate()).toBe(1);
      expect(result.getMonth()).toBe(5); // June
    });
  });

  describe("endOfMonth", () => {
    it("should return end of month", () => {
      const date = new Date("2023-06-15T12:30:45Z");
      const result = endOfMonth(date);

      expect(result.getDate()).toBe(30); // June has 30 days
      expect(result.getMonth()).toBe(5); // June (0-indexed)
      expect(result.getFullYear()).toBe(2023);
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
    });

    it("should handle February in leap year", () => {
      const date = new Date("2024-02-15T12:30:45Z"); // 2024 is a leap year
      const result = endOfMonth(date);

      expect(result.getDate()).toBe(29); // February has 29 days in leap year
      expect(result.getMonth()).toBe(1); // February
    });

    it("should handle February in non-leap year", () => {
      const date = new Date("2023-02-15T12:30:45Z"); // 2023 is not a leap year
      const result = endOfMonth(date);

      expect(result.getDate()).toBe(28); // February has 28 days in non-leap year
      expect(result.getMonth()).toBe(1); // February
    });

    it("should handle December", () => {
      const date = new Date("2023-12-15T12:30:45Z");
      const result = endOfMonth(date);

      expect(result.getDate()).toBe(31); // December has 31 days
      expect(result.getMonth()).toBe(11); // December
    });
  });

  describe("Edge cases and integration", () => {
    it("should handle timezone conversions consistently", () => {
      const utcDate = new Date("2023-06-15T12:30:45.123Z");
      const isoString = toISOString(utcDate);
      const parsedDate = fromISOString(isoString);

      expect(parsedDate.getTime()).toBe(utcDate.getTime());
    });

    it("should handle year boundaries", () => {
      const newYearsEve = new Date("2023-12-31T23:59:59Z");
      const newYear = addTime(newYearsEve, 1, "seconds");

      expect(newYear.getFullYear()).toBe(2024);
      expect(newYear.getMonth()).toBe(0); // January
      expect(newYear.getDate()).toBe(1);
    });

    it("should handle daylight saving time transitions", () => {
      // Note: This depends on the system timezone, but we test the basic functionality
      const beforeDST = new Date("2023-03-11T12:00:00Z");
      const afterDST = addTime(beforeDST, 24, "hours");

      expect(getDateDifference(beforeDST, afterDST, "days")).toBe(1);
    });

    it("should maintain date precision through operations", () => {
      const originalDate = new Date("2023-06-15T12:30:45.123Z");
      const modified = addTime(originalDate, 1, "days");
      const restored = subtractTime(modified, 1, "days");

      expect(restored.getTime()).toBe(originalDate.getTime());
    });
  });
});
