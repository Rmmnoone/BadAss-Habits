// ==========================
// Version 2 — src/hooks/useHabits.ts
// - Adds DEBUG logs for snapshot lifecycle + query errors
// - Adds a "raw collection" listener to prove documents exist at users/{uid}/habits
// - Logs index-required errors (most common cause of empty UI with no errors)
// ==========================
import { useEffect, useMemo, useState } from "react";
import {
  onSnapshot,
  orderBy,
  query,
  where,
  type FirestoreError,
} from "firebase/firestore";
import { db } from "../firebase/client";
import { habitsCollection } from "../firebase/habits";
import type { Habit } from "../types/habit";

const DEBUG = true;

function log(...args: any[]) {
  if (!DEBUG) return;
  console.log("[useHabits]", ...args);
}
function warn(...args: any[]) {
  if (!DEBUG) return;
  console.warn("[useHabits]", ...args);
}
function errlog(...args: any[]) {
  if (!DEBUG) return;
  console.error("[useHabits]", ...args);
}

function explainFirestoreError(e: FirestoreError) {
  // Common: FAILED_PRECONDITION + "requires an index"
  const msg = e?.message || "";
  const code = (e as any)?.code;

  if (code === "failed-precondition" || msg.toLowerCase().includes("requires an index")) {
    warn(
      "This looks like a missing Firestore composite index.\n" +
        "Go to: Firestore Database → Indexes → Composite → Add index\n" +
        "Common ones needed:\n" +
        "  - users/{uid}/habits where isArchived==false orderBy createdAt desc\n" +
        "  - users/{uid}/habits where isArchived==true  orderBy updatedAt desc\n" +
        "Also check the console error text—Firebase often includes a direct link to create the index."
    );
  }
}

export function useHabits(uid?: string | null) {
  const [active, setActive] = useState<Habit[]>([]);
  const [archived, setArchived] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);

  const enabled = useMemo(() => Boolean(uid), [uid]);

  useEffect(() => {
    if (!enabled || !uid) {
      log("disabled (no uid). Resetting state.");
      setActive([]);
      setArchived([]);
      setLoading(false);
      return;
    }

    log("enabled. uid =", uid);
    setLoading(true);

    const col = habitsCollection(db, uid);

    // --- DEBUG PROBE: raw listener to prove docs exist at this path ---
    const unsubRaw = onSnapshot(
      col,
      (snap) => {
        log(
          "RAW snapshot:",
          { size: snap.size, empty: snap.empty },
          snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        );
      },
      (e: FirestoreError) => {
        errlog("RAW snapshot error:", e);
        explainFirestoreError(e);
      }
    );

    // --- Real queries ---
    // These two queries commonly require composite indexes.
    const qActive = query(col, where("isArchived", "==", false), orderBy("createdAt", "desc"));
    const qArchived = query(col, where("isArchived", "==", true), orderBy("updatedAt", "desc"));

    log("Subscribing qActive + qArchived…");

    const unsub1 = onSnapshot(
      qActive,
      (snap) => {
        const next = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        log("ACTIVE snapshot:", { size: snap.size, empty: snap.empty }, next.map((h) => h.name));
        setActive(next);
        setLoading(false);
      },
      (e: FirestoreError) => {
        errlog("ACTIVE snapshot error:", e);
        explainFirestoreError(e);
        setLoading(false);
      }
    );

    const unsub2 = onSnapshot(
      qArchived,
      (snap) => {
        const next = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
        log("ARCHIVED snapshot:", { size: snap.size, empty: snap.empty }, next.map((h) => h.name));
        setArchived(next);
      },
      (e: FirestoreError) => {
        errlog("ARCHIVED snapshot error:", e);
        explainFirestoreError(e);
      }
    );

    return () => {
      log("cleanup unsubscribing (raw/active/archived)");
      unsubRaw();
      unsub1();
      unsub2();
    };
  }, [enabled, uid]);

  return { active, archived, loading };
}

// ==========================
// End of Version 2 — src/hooks/useHabits.ts
// ==========================
