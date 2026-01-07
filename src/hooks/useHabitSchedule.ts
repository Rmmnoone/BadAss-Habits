// ==========================
// Version 1 — src/hooks/useHabitSchedule.ts
// - Realtime listener for a single habit's schedule (doc: schedule/main)
// ==========================
import { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { db } from "../firebase/client";
import { scheduleDoc, type HabitSchedule } from "../firebase/schedules";

export function useHabitSchedule(uid?: string | null, habitId?: string | null) {
  const [schedule, setSchedule] = useState<HabitSchedule | null>(null);
  const [loading, setLoading] = useState(true);

  const enabled = useMemo(() => Boolean(uid && habitId), [uid, habitId]);

  useEffect(() => {
    if (!enabled || !uid || !habitId) {
      setSchedule(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = scheduleDoc(db, uid, habitId);

    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setSchedule(null);
        } else {
          setSchedule(snap.data() as HabitSchedule);
        }
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [enabled, uid, habitId]);

  return { schedule, loading };
}

// ==========================
// End of Version 1 — src/hooks/useHabitSchedule.ts
// ==========================
