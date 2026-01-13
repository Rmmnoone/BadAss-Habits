// ==========================
// Version 1 — src/utils/eligibility.ts
// - Single source of truth for:
//   * dateFromKey (DST-safe)
//   * due logic (daily/weekly)
//   * active/eligible logic (pre-start + schedule)
// - Used by Dashboard insights + HabitDetails (month + list)
// ==========================

import { weekday1to7 } from "./dateKey";

export type DayEligibilityReason = "OK" | "PRE_START" | "NOT_SCHEDULED";

export type DayEligibility = {
  dateKey: string;
  weekday: number; // 1=Mon..7=Sun
  isAfterStart: boolean;
  isScheduled: boolean;
  isActive: boolean; // user can toggle (MVP: future allowed)
  countsAsDue: boolean; // should be included in due stats
  reason: DayEligibilityReason;
};

/** Create a Date for a YYYY-MM-DD key in a DST-safe way */
export function dateFromKey(dateKey: string): Date {
  return new Date(dateKey + "T12:00:00");
}

/** Determine if habit is scheduled on a given weekday (1=Mon..7=Sun) */
export function isScheduledOnWeekday(habit: any, weekday: number): boolean {
  const type = habit?.schedule?.type ?? "daily";
  if (type === "daily") return true;

  const days: number[] = habit?.schedule?.daysOfWeek ?? [];
  return days.includes(weekday);
}

/**
 * Returns the unified eligibility for a habit on a given dateKey.
 * - minDateKey: earliest day habit is considered active (usually habit.createdAt)
 * - Future dates are allowed (pre-check) per your MVP rule.
 */
export function getDayEligibility(args: {
  habit: any;
  dateKey: string;
  minDateKey?: string | null;
}): DayEligibility {
  const { habit, dateKey, minDateKey } = args;

  const d = dateFromKey(dateKey);
  const weekday = weekday1to7(d);

  const isAfterStart = !minDateKey || dateKey >= minDateKey;
  const isScheduled = isScheduledOnWeekday(habit, weekday);

  // Active = user can toggle (MVP allows future dates, so no future lock)
  const isActive = Boolean(isAfterStart && isScheduled);

  // countsAsDue = only days that are part of the schedule window
  const countsAsDue = Boolean(isAfterStart && isScheduled);

  let reason: DayEligibilityReason = "OK";
  if (!isAfterStart) reason = "PRE_START";
  else if (!isScheduled) reason = "NOT_SCHEDULED";

  return {
    dateKey,
    weekday,
    isAfterStart,
    isScheduled,
    isActive,
    countsAsDue,
    reason,
  };
}

/** Convenience: due logic on a dateKey */
export function isDueOnDateKey(args: {
  habit: any;
  dateKey: string;
  minDateKey?: string | null;
}): boolean {
  return getDayEligibility(args).countsAsDue;
}

// ==========================
// End of Version 1 — src/utils/eligibility.ts
// ==========================
