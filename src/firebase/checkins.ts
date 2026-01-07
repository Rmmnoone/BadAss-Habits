// ==========================
// Version 2 — src/firebase/checkins.ts
// - Daily habit check-ins
// - Path: users/{uid}/days/{dateKey}/habits/{habitId}
// - Adds helpers:
//   - getDoneSetForDay()
//   - getDoneMapForRange()
// ==========================
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  type Firestore,
} from "firebase/firestore";

export function dayHabitsCollection(db: Firestore, uid: string, dateKey: string) {
  return collection(db, "users", uid, "days", dateKey, "habits");
}

export function checkinDoc(db: Firestore, uid: string, dateKey: string, habitId: string) {
  return doc(db, "users", uid, "days", dateKey, "habits", habitId);
}

export async function setCheckin(db: Firestore, uid: string, dateKey: string, habitId: string) {
  const ref = checkinDoc(db, uid, dateKey, habitId);
  await setDoc(ref, { completed: true, completedAt: serverTimestamp() }, { merge: true });
}

export async function clearCheckin(db: Firestore, uid: string, dateKey: string, habitId: string) {
  const ref = checkinDoc(db, uid, dateKey, habitId);
  await deleteDoc(ref);
}

/** Returns the set of habitIds completed on a given day */
export async function getDoneSetForDay(db: Firestore, uid: string, dateKey: string) {
  const snap = await getDocs(dayHabitsCollection(db, uid, dateKey));
  const set = new Set<string>();
  snap.forEach((d) => set.add(d.id)); // habitId
  return set;
}

/**
 * Returns a Map of dateKey -> Set(habitId) for that day.
 * MVP approach: 1 read per day (fine for 7–60 day windows).
 */
export async function getDoneMapForRange(db: Firestore, uid: string, dateKeys: string[]) {
  const map = new Map<string, Set<string>>();
  await Promise.all(
    dateKeys.map(async (k) => {
      const set = await getDoneSetForDay(db, uid, k);
      map.set(k, set);
    })
  );
  return map;
}

// ==========================
// End of Version 2 — src/firebase/checkins.ts
// ==========================
