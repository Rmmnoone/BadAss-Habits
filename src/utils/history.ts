// ==========================
// Version 1 — src/utils/history.ts
// - Date key helpers for ranges (local time)
// - Due logic helpers (daily/weekly)
// - Streak + rate calculations over a window
// - Uses weekday1to7() (Mon=1 … Sun=7) to match current app behavior
// ==========================
import { weekday1to7 } from "./dateKey";

export function dateKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Returns [today, yesterday, ...] in local time */
export function lastNDaysKeys(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(dateKeyFromDate(d));
  }
  return out;
}

/** Returns [oldest ... newest] */
export function lastNDaysKeysAsc(n: number): string[] {
  return lastNDaysKeys(n).slice().reverse();
}

/**
 * Build weekday map for date keys.
 * Uses "T12:00:00" to avoid DST edge cases.
 */
export function weekdayMapForKeys(keys: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const k of keys) {
    const d = new Date(k + "T12:00:00");
    map.set(k, weekday1to7(d));
  }
  return map;
}

/**
 * IMPORTANT:
 * In this project, weekly daysOfWeek is treated as 1=Mon ... 7=Sun (matches schedules.ts + useToday)
 */
export function isDueOnWeekday(habit: any, weekday1to7Value: number): boolean {
  const type = habit?.schedule?.type ?? "daily";
  if (type === "daily") return true;

  const days: number[] = habit?.schedule?.daysOfWeek ?? [];
  return days.includes(weekday1to7Value);
}

export type HabitWindowStats = {
  habitId: string;
  dueCount: number;
  doneCount: number;
  completionRate: number | null; // 0..1 or null when dueCount=0
  currentStreak: number; // consecutive due days done (ending today)
  bestStreak: number; // best within window
};

function isDone(doneMap: Map<string, Set<string>>, dateKey: string, habitId: string) {
  const set = doneMap.get(dateKey);
  return Boolean(set && set.has(habitId));
}

/**
 * Calculate stats for one habit over a window.
 * keysDesc: [today, yesterday, ...] (DESC)
 * weekdayByKey: Map(dateKey -> weekday1to7)
 */
export function computeHabitWindowStats(args: {
  habit: any; // must have .id + .schedule
  keysDesc: string[];
  weekdayByKey: Map<string, number>;
  doneMap: Map<string, Set<string>>;
}): HabitWindowStats {
  const { habit, keysDesc, weekdayByKey, doneMap } = args;
  const habitId = habit.id as string;

  // due/done counts
  let dueCount = 0;
  let doneCount = 0;

  for (const k of keysDesc) {
    const weekday = weekdayByKey.get(k) ?? 1;
    const due = isDueOnWeekday(habit, weekday);
    if (!due) continue;
    dueCount++;
    if (isDone(doneMap, k, habitId)) doneCount++;
  }

  const completionRate = dueCount === 0 ? null : doneCount / dueCount;

  // current streak (walk back from today, only due days count; first missed due day breaks)
  let currentStreak = 0;
  for (const k of keysDesc) {
    const weekday = weekdayByKey.get(k) ?? 1;
    const due = isDueOnWeekday(habit, weekday);
    if (!due) continue;

    if (isDone(doneMap, k, habitId)) currentStreak++;
    else break;
  }

  // best streak within window (scan in ASC order so we can count consecutive due days)
  const keysAsc = keysDesc.slice().reverse();
  let bestStreak = 0;
  let run = 0;

  for (const k of keysAsc) {
    const weekday = weekdayByKey.get(k) ?? 1;
    const due = isDueOnWeekday(habit, weekday);

    if (!due) {
      // not due doesn't break streak (it just doesn't count)
      continue;
    }

    const done = isDone(doneMap, k, habitId);
    if (done) {
      run++;
      if (run > bestStreak) bestStreak = run;
    } else {
      run = 0;
    }
  }

  return {
    habitId,
    dueCount,
    doneCount,
    completionRate,
    currentStreak,
    bestStreak,
  };
}

/** Overall window stats across habits */
export function computeOverallWindowStats(args: {
  habits: any[];
  keysDesc: string[];
  weekdayByKey: Map<string, number>;
  doneMap: Map<string, Set<string>>;
}) {
  const { habits, keysDesc, weekdayByKey, doneMap } = args;

  let due = 0;
  let done = 0;

  for (const h of habits) {
    for (const k of keysDesc) {
      const weekday = weekdayByKey.get(k) ?? 1;
      if (!isDueOnWeekday(h, weekday)) continue;
      due++;
      if (isDone(doneMap, k, h.id)) done++;
    }
  }

  return {
    dueCount: due,
    doneCount: done,
    completionRate: due === 0 ? null : done / due,
  };
}

// ==========================
// End of Version 1 — src/utils/history.ts
// ==========================
