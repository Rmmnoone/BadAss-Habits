// ==========================
// Version 2 — src/utils/dateKey.ts
// - Keeps existing helpers:
//   * todayKey()
//   * weekday1to7()
// - Adds shared helpers used by HabitDetails + history:
//   * dateKeyFromDate()
//   * lastNDaysKeys()
// ==========================

/** YYYY-MM-DD in local time for today */
export function todayKey(): string {
  return dateKeyFromDate(new Date());
}

/** YYYY-MM-DD in local time for a provided date */
export function dateKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** JS getDay(): 0=Sun..6=Sat. We want 1=Mon..7=Sun */
export function weekday1to7(date = new Date()): number {
  const js = date.getDay();
  return js === 0 ? 7 : js;
}

/**
 * Returns last N days as dateKeys in DESC order (today, yesterday, ...)
 * Always based on local time.
 */
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

// ==========================
// End of Version 2 — src/utils/dateKey.ts
// ==========================
