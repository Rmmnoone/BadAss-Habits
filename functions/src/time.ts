// ==========================
// Version 2 — functions/src/time.ts
// - Makes all helpers return strict, non-null types (TS strict friendly)
//   * safeTz(): always returns a valid IANA timezone string (fallback Europe/London)
//   * dateKeyNow(): always returns "YYYY-MM-DD" (never null)
//   * nowInTz(): always returns a Luxon DateTime in a valid zone
//   * hmNow(): always returns "HH:mm"
//   * weekdayNow(): always returns 1..7
// - Reason: Luxon toISODate() is typed as string | null
//   so we coerce with a safe fallback.
// ==========================

import { DateTime } from "luxon";

export function safeTz(tz?: string | null): string {
  const fallback = "Europe/London";
  if (!tz) return fallback;

  const dt = DateTime.now().setZone(tz);
  return dt.isValid ? tz : fallback;
}

export function nowInTz(tz: string): DateTime {
  // Ensure we never propagate an invalid zone
  const z = safeTz(tz);
  return DateTime.now().setZone(z);
}

export function hmNow(tz: string): string {
  return nowInTz(tz).toFormat("HH:mm");
}

export function weekdayNow(tz: string): number {
  // Monday=1..Sunday=7
  return nowInTz(tz).weekday;
}

export function dateKeyNow(tz: string): string {
  // YYYY-MM-DD in that timezone
  // Luxon types this as string | null, so we coerce safely.
  return nowInTz(tz).toISODate() ?? "1970-01-01";
}

// ==========================
// End of Version 2 — functions/src/time.ts
// ==========================
