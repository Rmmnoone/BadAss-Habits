// ==========================
// Version 1 — src/utils/dateKey.ts
// - Creates YYYY-MM-DD date key in local time
// ==========================
export function todayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// JS getDay(): 0=Sun..6=Sat. We want 1=Mon..7=Sun
export function weekday1to7(date = new Date()): number {
  const js = date.getDay();
  return js === 0 ? 7 : js;
}

// ==========================
// End of Version 1 — src/utils/dateKey.ts
// ==========================
