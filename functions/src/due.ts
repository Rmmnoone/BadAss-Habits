// ==========================
// Version 5 — functions/src/due.ts
// - Fixes TS strict error when safeTz() returns string | null
//   * Introduces tzOrUtc(): always returns a string (fallback "UTC")
//   * Ensures habitTz is always string before passing to helpers
// - Keeps Version 4 behavior:
//   * createdAt minDateKey guard (per habit timezone)
//   * daily/weekly schedule due logic (1=Mon..7=Sun)
//   * exact reminder validation ("HH:mm")
//   * compatibility export: isDueToday()
// ==========================

import { DateTime } from "luxon";
import { safeTz, weekdayNow, dateKeyNow } from "./time";

function tzOrUtc(input: any): string {
  return safeTz(input) || "UTC";
}

function minDateKeyFromCreatedAt(habit: any, tz: string): string | null {
  const dt: Date | null =
    habit?.createdAt && typeof habit.createdAt.toDate === "function"
      ? habit.createdAt.toDate()
      : null;

  if (!dt) return null;

  // Convert createdAt to the habit timezone day key
  return DateTime.fromJSDate(dt).setZone(tz).toISODate(); // YYYY-MM-DD
}

/**
 * Core due function used by the scheduler.
 * - weekday1to7: 1=Mon..7=Sun (in the SAME timezone as dateKey)
 * - dateKey: "YYYY-MM-DD" (in the SAME timezone as weekday1to7)
 * - tz: habit timezone (nullable allowed; normalized via tzOrUtc)
 */
export function isDueOnDateKey(
  habit: any,
  weekday1to7: number,
  dateKey: string,
  tz?: string | null
): boolean {
  const habitTz = tzOrUtc(tz ?? habit?.timezone ?? null);

  // Guard: not due before createdAt day
  const minKey = minDateKeyFromCreatedAt(habit, habitTz);
  if (minKey && dateKey < minKey) return false;

  const type = habit?.schedule?.type ?? "daily";
  if (type === "daily") return true;

  const days: number[] = habit?.schedule?.daysOfWeek ?? [];
  return Array.isArray(days) && days.includes(weekday1to7);
}

/**
 * Compatibility helper for older index.ts:
 * "Is this habit due today?" given a weekday number.
 *
 * IMPORTANT:
 * - We compute "today" (dateKey + weekday) in the habit timezone (or provided tz),
 *   so the createdAt guard is also evaluated correctly.
 */
export function isDueToday(habit: any, weekday1to7: number, tz?: string | null): boolean {
  const habitTz = tzOrUtc(tz ?? habit?.timezone ?? null);

  const todayKey = dateKeyNow(habitTz) ?? "1970-01-01"; // YYYY-MM-DD in habitTz
  const todayWeekday = weekdayNow(habitTz);            // 1..7 in habitTz

  return isDueOnDateKey(habit, todayWeekday, todayKey, habitTz);
}

function isValidHHMM(s: any): boolean {
  if (typeof s !== "string") return false;
  // 00:00 .. 23:59
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(s);
}

export function hasExactReminder(habit: any): boolean {
  return Boolean(habit?.reminders?.enabled) && isValidHHMM(habit?.reminders?.time);
}

// ==========================
// End of Version 5 — functions/src/due.ts
// ==========================
