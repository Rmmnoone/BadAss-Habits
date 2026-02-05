// ==========================
// Version 3 — src/hooks/useReminderScheduler.ts
// - v2 + prevents duplicate notifications:
//   * Supports disableLocal flag (Dashboard can disable local if FCM is enabled)
// - Optional timezone support for future (local fallback can respect selected TZ)
// - Keeps sessionStorage anti-repeat per day/habit
// ==========================

import { useEffect, useMemo, useState } from "react";
import type { TodayItem } from "./useToday";

function timeToMinutes(t: string): number {
  const [hh, mm] = (t || "09:00").split(":");
  const h = Math.max(0, Math.min(23, Number(hh) || 0));
  const m = Math.max(0, Math.min(59, Number(mm) || 0));
  return h * 60 + m;
}

function nowMinutesLocal(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

// HH:mm in a given IANA TZ (safe; returns null if not supported)
function hmNowInTz(tz?: string | null): string | null {
  if (!tz) return null;
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const v = fmt.format(new Date());
    const m = v.match(/^(\d{2})[:.](\d{2})$/);
    if (!m) return null;
    return `${m[1]}:${m[2]}`;
  } catch {
    return null;
  }
}

function hmToMinutesSafe(hm: string): number {
  const m = hm.match(/^(\d{2}):(\d{2})$/);
  if (!m) return Number.POSITIVE_INFINITY;
  return Number(m[1]) * 60 + Number(m[2]);
}

function safeNotify(title: string, body: string) {
  try {
    // Keeping minimal; we intentionally DO NOT add tag/renotify here because
    // local notifications are now a fallback (FCM handles the real UX).
    new Notification(title, { body });
  } catch {
    // ignore
  }
}

export function useReminderScheduler(args: {
  enabled: boolean;
  dateKey: string;
  dueItems: TodayItem[];
  disableLocal?: boolean;     // NEW: set true to stop local notifications (prevents duplicates)
  timezone?: string | null;   // OPTIONAL: if provided, local fallback checks time in this TZ
}) {
  const { enabled, dateKey, dueItems, disableLocal = false, timezone = null } = args;

  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window === "undefined") return "default";
    return "Notification" in window ? Notification.permission : "denied";
  });

  const candidates = useMemo(() => {
    // only habits that have reminders enabled AND are due AND not done
    return dueItems.filter((h) => h.reminderEnabled && h.due && !h.done);
  }, [dueItems]);

  // Keep permission state updated (in case user enables it via button / browser UI)
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;

    setPermission(Notification.permission);

    const id = window.setInterval(() => {
      setPermission(Notification.permission);
    }, 3_000);

    return () => window.clearInterval(id);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (disableLocal) return; // ✅ prevent duplicates when FCM is active
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (permission !== "granted") return;
    if (candidates.length === 0) return;

    const tick = () => {
      // If timezone provided, compare in that TZ; else use device local time.
      const hmNow = hmNowInTz(timezone);
      const mNow = hmNow ? hmToMinutesSafe(hmNow) : nowMinutesLocal();

      for (const h of candidates) {
        const mTarget = timeToMinutes(h.reminderTime);

        // MVP rule: fire when minute matches
        if (mNow !== mTarget) continue;

        const key = `reminderFired:${dateKey}:${h.id}`;
        if (sessionStorage.getItem(key) === "1") continue;

        sessionStorage.setItem(key, "1");
        safeNotify("BadAss Habits", `⏰ ${h.name}`);
      }
    };

    const id = window.setInterval(tick, 20_000);
    tick();

    return () => window.clearInterval(id);
  }, [enabled, disableLocal, permission, candidates, dateKey, timezone]);

  return { permission };
}

// ==========================
// End of Version 3 — src/hooks/useReminderScheduler.ts
// ==========================
