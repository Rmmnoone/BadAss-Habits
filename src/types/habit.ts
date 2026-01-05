// ==========================
// Version 1 — src/types/habit.ts
// - Habit types for Firestore documents
// ==========================
import type { Timestamp } from "firebase/firestore";

export type Habit = {
  id: string;
  name: string;
  isArchived: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

// Firestore write shape (no id)
export type HabitDoc = Omit<Habit, "id">;

// ==========================
// End of Version 1 — src/types/habit.ts
// ==========================
