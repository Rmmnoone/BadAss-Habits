import { DateTime } from "luxon";

export function safeTz(tz?: string | null) {
  const fallback = "Europe/London";
  if (!tz) return fallback;
  const dt = DateTime.now().setZone(tz);
  return dt.isValid ? tz : fallback;
}

export function nowInTz(tz: string) {
  return DateTime.now().setZone(tz);
}

export function hmNow(tz: string) {
  return nowInTz(tz).toFormat("HH:mm");
}

export function weekdayNow(tz: string) {
  // Monday=1..Sunday=7
  return nowInTz(tz).weekday;
}
