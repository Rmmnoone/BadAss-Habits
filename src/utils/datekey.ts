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

// ---------- Timezone-aware helpers (MVP) ----------

/** YYYY-MM-DD for "now" in a given IANA timezone (e.g. Europe/London) */
export function todayKeyInTz(tz: string): string {
  return dateKeyFromDateInTz(new Date(), tz);
}

/** YYYY-MM-DD for a provided Date in a given IANA timezone */
export function dateKeyFromDateInTz(d: Date, tz: string): string {
  // Use formatToParts so we don't depend on locale formatting.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";

  return `${y}-${m}-${day}`;
}


// ==========================
// End of Version 2 — src/utils/dateKey.ts
// ==========================
