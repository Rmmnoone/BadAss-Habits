// ==========================
// Version 2 — src/firebase/habits.ts
// - Habit CRUD helpers for Firestore
// - Paths: users/{uid}/habits/{habitId}
// - Adds default schedule fields on create (backward-compatible)
// ==========================
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import type { HabitDoc } from "../types/habit";

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
function defaultHabitDoc(name: string): HabitDoc {
  return {
    name,
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
    createdAt: serverTimestamp() as any,
    updatedAt: serverTimestamp() as any,
  };
}

export async function createHabit(db: Firestore, uid: string, name: string) {
  const col = habitsCollection(db, uid);
  await addDoc(col, defaultHabitDoc(name));
}

export async function renameHabit(db: Firestore, uid: string, habitId: string, name: string) {
  const ref = doc(db, "users", uid, "habits", habitId);
  await updateDoc(ref, {
    name,
    updatedAt: serverTimestamp(),
  });
}

export async function archiveHabit(db: Firestore, uid: string, habitId: string) {
  const ref = doc(db, "users", uid, "habits", habitId);
  await updateDoc(ref, {
    isArchived: true,
    updatedAt: serverTimestamp(),
  });
}

export async function unarchiveHabit(db: Firestore, uid: string, habitId: string) {
  const ref = doc(db, "users", uid, "habits", habitId);
  await updateDoc(ref, {
    isArchived: false,
    updatedAt: serverTimestamp(),
  });
}

// ==========================
// End of Version 2 — src/firebase/habits.ts
// ==========================
