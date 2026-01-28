// ==========================
// Version 3 — src/utils/history.ts
// - Fixes TS build (noUnusedLocals):
//   * weekdayMapForKeys now returns real weekday numbers (1=Mon..7=Sun)
// - Keeps streak + rate calculations over a window
// - Uses utils/dateKey.ts + utils/eligibility.ts (no duplicate helpers)
// - Optional minDateKey support (pre-start days won't count as due)
// ==========================

import { dateKeyFromDate, lastNDaysKeys } from "./dateKey";
import { dateFromKey, isDueOnDateKey } from "./eligibility";

/** Returns [oldest ... newest] */
export function lastNDaysKeysAsc(n: number): string[] {
  return lastNDaysKeys(n).slice().reverse();
}

/**
 * Build weekday map for date keys.
 * Returns 1..7 (Mon..Sun) for each YYYY-MM-DD key.
 * Uses DST-safe dateFromKey() to avoid edge cases.
 */
export function weekdayMapForKeys(keys: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const k of keys) {
    const d = dateFromKey(k);
    const js = d.getDay(); // Sun=0..Sat=6
    const weekday1to7 = js === 0 ? 7 : js; // Mon=1..Sun=7
    map.set(k, weekday1to7);
  }
  return map;
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
 * MVP helper: derive minDateKey from habit.createdAt when present.
 * If missing, returns null and we treat all days as eligible.
 */
export function minDateKeyFromHabit(habit: any): string | null {
  const ts = habit?.createdAt;
  const d: Date | null = ts && typeof ts.toDate === "function" ? ts.toDate() : null;
  return d ? dateKeyFromDate(d) : null;
}

/**
 * Calculate stats for one habit over a window.
 * keysDesc: [today, yesterday, ...] (DESC)
 * If minDateKey is supplied, pre-start days won't count as due.
 */
export function computeHabitWindowStats(args: {
  habit: any; // must have .id + .schedule (+ optional createdAt)
  keysDesc: string[];
  doneMap: Map<string, Set<string>>;
  minDateKey?: string | null;
}): HabitWindowStats {
  const { habit, keysDesc, doneMap } = args;
  const habitId = habit.id as string;

  const minDateKey = args.minDateKey ?? minDateKeyFromHabit(habit);

  let dueCount = 0;
  let doneCount = 0;

  for (const k of keysDesc) {
    const due = isDueOnDateKey({ habit, dateKey: k, minDateKey });
    if (!due) continue;
    dueCount++;
    if (isDone(doneMap, k, habitId)) doneCount++;
  }

  const completionRate = dueCount === 0 ? null : doneCount / dueCount;

  // current streak (walk back from today, only due days count; first missed due day breaks)
  let currentStreak = 0;
  for (const k of keysDesc) {
    const due = isDueOnDateKey({ habit, dateKey: k, minDateKey });
    if (!due) continue;

    if (isDone(doneMap, k, habitId)) currentStreak++;
    else break;
  }

  // best streak within window (scan ASC; consecutive due days done)
  const keysAsc = keysDesc.slice().reverse();
  let bestStreak = 0;
  let run = 0;

  for (const k of keysAsc) {
    const due = isDueOnDateKey({ habit, dateKey: k, minDateKey });

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
  doneMap: Map<string, Set<string>>;
  /**
   * Optional: supply a minDateKey per habit id
   * (if not supplied, we derive from habit.createdAt)
   */
  minDateKeyByHabitId?: Map<string, string | null>;
}) {
  const { habits, keysDesc, doneMap, minDateKeyByHabitId } = args;

  let due = 0;
  let done = 0;

  for (const h of habits) {
    const minDateKey = minDateKeyByHabitId?.get(h.id) ?? minDateKeyFromHabit(h) ?? null;

    for (const k of keysDesc) {
      if (!isDueOnDateKey({ habit: h, dateKey: k, minDateKey })) continue;
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
// End of Version 3 — src/utils/history.ts
// ==========================
