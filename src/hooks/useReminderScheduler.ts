// ==========================
// Version 1 — src/hooks/useReminderScheduler.ts
// - Zero-cost reminders while app is open
// - Uses Notification API (best-effort):
//   * asks permission once (you can move this to a Settings screen later)
//   * checks every 20s
//   * fires at the habit reminder time if due + not done
//   * prevents repeat fires using sessionStorage per day
// ==========================
import { useEffect, useMemo, useRef, useState } from "react";
import type { TodayItem } from "./useToday";

function timeToMinutes(t: string): number {
  const [hh, mm] = (t || "09:00").split(":");
  const h = Math.max(0, Math.min(23, Number(hh) || 0));
  const m = Math.max(0, Math.min(59, Number(mm) || 0));
  return h * 60 + m;
}

function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function safeNotify(title: string, body: string) {
  try {
    new Notification(title, { body });
  } catch {
    // ignore
  }
}

export function useReminderScheduler(args: {
  enabled: boolean;
  dateKey: string;
  dueItems: TodayItem[];
}) {
  const { enabled, dateKey, dueItems } = args;

  const [permission, setPermission] = useState<NotificationPermission>(() => {
    if (typeof window === "undefined") return "default";
    return "Notification" in window ? Notification.permission : "denied";
  });

  const askedRef = useRef(false);

  const candidates = useMemo(() => {
    // only habits that have reminders enabled AND are due AND not done
    return dueItems.filter((h) => h.reminderEnabled && h.due && !h.done);
  }, [dueItems]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;

    // Ask permission once per session (MVP behavior)
    if (!askedRef.current && Notification.permission === "default") {
      askedRef.current = true;
      Notification.requestPermission().then((p) => setPermission(p));
    } else {
      setPermission(Notification.permission);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (permission !== "granted") return;
    if (candidates.length === 0) return;

    const tick = () => {
      const mNow = nowMinutes();

      for (const h of candidates) {
        const mTarget = timeToMinutes(h.reminderTime);

        // Fire rule (MVP): if current minute matches target minute
        if (mNow !== mTarget) continue;

        const key = `reminderFired:${dateKey}:${h.id}`;
        if (sessionStorage.getItem(key) === "1") continue;

        sessionStorage.setItem(key, "1");
        safeNotify("BadAss Habits", `⏰ ${h.name}`);
      }
    };

    // tick fast enough to catch minute boundaries even if tab is sluggish
    const id = window.setInterval(tick, 20_000);
    tick();

    return () => window.clearInterval(id);
  }, [enabled, permission, candidates, dateKey]);
}

// ==========================
// End of Version 1 — src/hooks/useReminderScheduler.ts
// ==========================
