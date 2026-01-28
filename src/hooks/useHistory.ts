// ==========================
// Version 2 — src/hooks/useHistory.ts
// - Adds minDateKey clamp so history never shows days before user existed
// - Filters dateKeys BEFORE Firestore reads (saves requests)
// - Keeps same return shape
// ==========================
import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase/client";
import { getDoneMapForRange } from "../firebase/checkins";
import { lastNDaysKeys } from "../utils/dateKey";

/**
 * minDateKey: YYYY-MM-DD (inclusive). Any keys older than this are removed.
 */
export function useHistory(uid?: string | null, days: number = 30, minDateKey?: string | null) {
  const [loading, setLoading] = useState(true);
  const [doneMap, setDoneMap] = useState<Map<string, Set<string>>>(new Map());

  const dateKeysDescRaw = useMemo(() => lastNDaysKeys(days), [days]);

  const dateKeysDesc = useMemo(() => {
    if (!minDateKey) return dateKeysDescRaw;
    // Since keys are YYYY-MM-DD, lexicographic compare works.
    return dateKeysDescRaw.filter((k) => k >= minDateKey);
  }, [dateKeysDescRaw, minDateKey]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!uid) {
        setDoneMap(new Map());
        setLoading(false);
        return;
      }

      // If range becomes empty after clamp, return empty gracefully
      if (dateKeysDesc.length === 0) {
        setDoneMap(new Map());
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const map = await getDoneMapForRange(db, uid, dateKeysDesc);
        if (!cancelled) setDoneMap(map);
      } catch (_e) {
        if (!cancelled) setDoneMap(new Map());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [uid, dateKeysDesc]);

  return { dateKeysDesc, doneMap, loading };
}

// ==========================
// End of Version 2 — src/hooks/useHistory.ts
// ==========================
