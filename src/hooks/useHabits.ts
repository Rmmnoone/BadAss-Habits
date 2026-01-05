// ==========================
// Version 1 — src/hooks/useHabits.ts
// - Realtime listener for user's habits
// - Returns active + archived habits
// ==========================
import { useEffect, useMemo, useState } from "react";
import { onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase/client";
import { habitsCollection } from "../firebase/habits";
import type { Habit } from "../types/habit";

export function useHabits(uid?: string | null) {
  const [active, setActive] = useState<Habit[]>([]);
  const [archived, setArchived] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);

  const enabled = useMemo(() => Boolean(uid), [uid]);

  useEffect(() => {
    if (!enabled || !uid) {
      setActive([]);
      setArchived([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const col = habitsCollection(db, uid);

    const qActive = query(col, where("isArchived", "==", false), orderBy("createdAt", "desc"));
    const qArchived = query(col, where("isArchived", "==", true), orderBy("updatedAt", "desc"));

    const unsub1 = onSnapshot(
      qActive,
      (snap) => {
        setActive(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }))
        );
        setLoading(false);
      },
      () => setLoading(false)
    );

    const unsub2 = onSnapshot(
      qArchived,
      (snap) => {
        setArchived(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          }))
        );
      },
      () => {}
    );

    return () => {
      unsub1();
      unsub2();
    };
  }, [enabled, uid]);

  return { active, archived, loading };
}

// ==========================
// End of Version 1 — src/hooks/useHabits.ts
// ==========================
