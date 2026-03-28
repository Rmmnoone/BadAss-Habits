// ==========================
// Version 3 — src/hooks/useHabits.ts
// - Removes temporary debug listeners/logging
// - Keeps active + archived subscriptions only
// ==========================
import { useEffect, useMemo, useState } from "react";
import {
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
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

    // --- Real queries ---
    const qActive = query(col, where("isArchived", "==", false), orderBy("createdAt", "desc"));
    const qArchived = query(col, where("isArchived", "==", true), orderBy("updatedAt", "desc"));

    const unsub1 = onSnapshot(
      qActive,
      (snap) => {
        const next = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setActive(next);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    const unsub2 = onSnapshot(
      qArchived,
      (snap) => {
        const next = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        setArchived(next);
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
// End of Version 3 — src/hooks/useHabits.ts
// ==========================
