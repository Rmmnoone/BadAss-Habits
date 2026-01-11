// ==========================
// Version 2 — src/hooks/useReminderScheduler.ts
// - Zero-cost reminders while app is open
// - Does NOT auto-request notification permission anymore
//   * permission request should be triggered by a user gesture (Dashboard button)
// - Checks every 20s and fires at reminder minute if due + not done
// - Prevents repeat fires using sessionStorage per day
// ==========================
import { useEffect, useMemo, useState } from "react";
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
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (permission !== "granted") return;
    if (candidates.length === 0) return;

    const tick = () => {
      const mNow = nowMinutes();

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
  }, [enabled, permission, candidates, dateKey]);

  return { permission };
}

// ==========================
// End of Version 2 — src/hooks/useReminderScheduler.ts
// ==========================
