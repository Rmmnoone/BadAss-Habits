// ==========================
// Version 2 — src/hooks/useToday.ts
// - Adds reminder fields for Today items
// - Sorts due items by reminder time (enabled first), then name
// - Still reads schedule/reminders from parent habit doc
// ==========================
import { useEffect, useMemo, useState } from "react";
import { onSnapshot, type FirestoreError } from "firebase/firestore";
import { db } from "../firebase/client";
import { dayHabitsCollection } from "../firebase/checkins";
import { todayKey, weekday1to7 } from "../utils/dateKey";
import { useHabits } from "./useHabits";

export type TodayItem = {
  id: string;
  name: string;
  due: boolean;
  done: boolean;

  // NEW
  reminderEnabled: boolean;
  reminderTime: string; // "HH:mm" (defaults to "09:00")
};

function isDueToday(h: any, weekday: number): boolean {
  const type = h?.schedule?.type ?? "daily";
  if (type === "daily") return true;

  const days: number[] = h?.schedule?.daysOfWeek ?? [];
  return days.includes(weekday);
}

function timeToMinutes(t: string): number {
  const [hh, mm] = (t || "09:00").split(":");
  const h = Math.max(0, Math.min(23, Number(hh) || 0));
  const m = Math.max(0, Math.min(59, Number(mm) || 0));
  return h * 60 + m;
}

export function useToday(uid?: string | null) {
  const { active, loading: habitsLoading } = useHabits(uid);

  const [doneSet, setDoneSet] = useState<Set<string>>(new Set());
  const [loadingCheckins, setLoadingCheckins] = useState(true);

  const dateKey = useMemo(() => todayKey(), []);
  const weekday = useMemo(() => weekday1to7(new Date()), []);

  useEffect(() => {
    if (!uid) {
      setDoneSet(new Set());
      setLoadingCheckins(false);
      return;
    }

    setLoadingCheckins(true);
    const col = dayHabitsCollection(db, uid, dateKey);

    const unsub = onSnapshot(
      col,
      (snap) => {
        const next = new Set<string>();
        snap.docs.forEach((d) => next.add(d.id)); // habitId
        setDoneSet(next);
        setLoadingCheckins(false);
      },
      (_e: FirestoreError) => {
        setLoadingCheckins(false);
      }
    );

    return () => unsub();
  }, [uid, dateKey]);

  const items: TodayItem[] = useMemo(() => {
    return (active as any[]).map((h) => {
      const due = isDueToday(h, weekday);
      const done = doneSet.has(h.id);

      const reminderEnabled = Boolean(h?.reminders?.enabled);
      const reminderTime = String(h?.reminders?.time ?? "09:00");

      return {
        id: h.id,
        name: h.name,
        due,
        done,
        reminderEnabled,
        reminderTime,
      };
    });
  }, [active, weekday, doneSet]);

  const dueItems = useMemo(() => {
    const due = items.filter((x) => x.due);

    // Sort: reminder enabled first, then by time, then name
    return due.sort((a, b) => {
      if (a.reminderEnabled !== b.reminderEnabled) return a.reminderEnabled ? -1 : 1;
      if (a.reminderEnabled && b.reminderEnabled) {
        const ta = timeToMinutes(a.reminderTime);
        const tb = timeToMinutes(b.reminderTime);
        if (ta !== tb) return ta - tb;
      }
      return a.name.localeCompare(b.name);
    });
  }, [items]);

  return {
    dateKey,
    items,
    dueItems,
    loading: habitsLoading || loadingCheckins,
  };
}

// ==========================
// End of Version 2 — src/hooks/useToday.ts
// ==========================
