// ==========================
// Version 3 — functions/src/time.ts
// - v2 + Quiet Hours helpers:
//   * isValidHHMM()
//   * hmToMinutes()
//   * isWithinQuietHours(nowHM, startHM, endHM) supports wrap-around windows (e.g. 22:00→07:00)
// ==========================

import { DateTime } from "luxon";

export function safeTz(tz?: string | null): string {
  const fallback = "Europe/London";
  if (!tz) return fallback;

  const dt = DateTime.now().setZone(tz);
  return dt.isValid ? tz : fallback;
}

export function nowInTz(tz: string): DateTime {
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
  return nowInTz(tz).toISODate() ?? "1970-01-01";
}

// ---------- Quiet Hours helpers ----------

export function isValidHHMM(s: any): boolean {
  if (typeof s !== "string") return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(s);
}

export function hmToMinutes(hm: string): number {
  if (!isValidHHMM(hm)) return Number.POSITIVE_INFINITY;
  const [h, m] = hm.split(":").map((x) => Number(x));
  return h * 60 + m;
}

/**
 * Returns true if `nowHM` is inside the quiet window [start, end),
 * supporting wrap-around windows like 22:00→07:00.
 *
 * Examples:
 * - start 22:00, end 07:00: quiet if now >= 22:00 OR now < 07:00
 * - start 09:00, end 17:00: quiet if 09:00 <= now < 17:00
 */
export function isWithinQuietHours(nowHM: string, startHM: string, endHM: string): boolean {
  if (!isValidHHMM(nowHM) || !isValidHHMM(startHM) || !isValidHHMM(endHM)) return false;

  const now = hmToMinutes(nowHM);
  const start = hmToMinutes(startHM);
  const end = hmToMinutes(endHM);

  // If start==end, treat as disabled window (0 minutes quiet)
  if (start === end) return false;

  // Non-wrapping window
  if (start < end) {
    return now >= start && now < end;
  }

  // Wrapping window (e.g. 22:00→07:00)
  return now >= start || now < end;
}

// ==========================
// End of Version 3 — functions/src/time.ts
// ==========================
