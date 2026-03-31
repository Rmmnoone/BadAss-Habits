// ==========================
// Version 4 — src/firebase/habits.ts
// - Habit CRUD helpers for Firestore
// - Paths: users/{uid}/habits/{habitId}
// - Fixes build error by removing non-HabitDoc fields
// - Keeps server timestamps for canonical ordering
// - Uses Timestamp.now() for updatedAt to avoid UI lag if needed
// ==========================
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  Timestamp,
  type Firestore,
} from "firebase/firestore";
import type { HabitDoc } from "../types/habit";
import { normalizeHabitCategory, type HabitCategory } from "../utils/habitCategory";

export function habitsCollection(db: Firestore, uid: string) {
  return collection(db, "users", uid, "habits");
}

// Best-effort timezone detection; safe fallback
function getTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

// Default schedule: daily at 09:00 (can be changed later in UI)
function defaultHabitDoc(name: string, category: HabitCategory): HabitDoc {
  return {
    name,
    category,
    isArchived: false,
    timezone: getTimezone(),
    schedule: {
      type: "daily",
      times: ["09:00"],
    },
    reminders: {
      enabled: false,
      time: "09:00",
    },

    // Canonical timestamps (server)
    createdAt: serverTimestamp() as any,
    updatedAt: serverTimestamp() as any,
  };
}

export async function createHabit(db: Firestore, uid: string, name: string, category: HabitCategory = "Others") {
  const col = habitsCollection(db, uid);
  await addDoc(col, defaultHabitDoc(name, normalizeHabitCategory(category)));
}

export async function renameHabit(db: Firestore, uid: string, habitId: string, name: string) {
  const ref = doc(db, "users", uid, "habits", habitId);
  await updateDoc(ref, {
    name,
    // keep a local timestamp so UI can reflect quickly if you display it
    updatedAt: Timestamp.now(),
  } as any);
  // If you prefer strict server-only, replace above with:
  // await updateDoc(ref, { name, updatedAt: serverTimestamp() } as any);
}

export async function setHabitCategory(db: Firestore, uid: string, habitId: string, category: HabitCategory) {
  const ref = doc(db, "users", uid, "habits", habitId);
  await updateDoc(ref, {
    category: normalizeHabitCategory(category),
    updatedAt: Timestamp.now(),
  } as any);
}

export async function archiveHabit(db: Firestore, uid: string, habitId: string) {
  const ref = doc(db, "users", uid, "habits", habitId);
  await updateDoc(ref, {
    isArchived: true,
    updatedAt: Timestamp.now(),
  } as any);
}

export async function unarchiveHabit(db: Firestore, uid: string, habitId: string) {
  const ref = doc(db, "users", uid, "habits", habitId);
  await updateDoc(ref, {
    isArchived: false,
    updatedAt: Timestamp.now(),
  } as any);
}

// ==========================
// End of Version 4 — src/firebase/habits.ts
// ==========================
