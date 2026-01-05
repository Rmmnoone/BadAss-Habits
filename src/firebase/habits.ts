// ==========================
// Version 1 — src/firebase/habits.ts
// - Habit CRUD helpers for Firestore
// - Paths: users/{uid}/habits/{habitId}
// ==========================
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  type Firestore,
} from "firebase/firestore";

export function habitsCollection(db: Firestore, uid: string) {
  return collection(db, "users", uid, "habits");
}

export async function createHabit(db: Firestore, uid: string, name: string) {
  const col = habitsCollection(db, uid);
  await addDoc(col, {
    name,
    isArchived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
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
// End of Version 1 — src/firebase/habits.ts
// ==========================
