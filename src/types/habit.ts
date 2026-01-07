// ==========================
// Version 3 — src/types/habit.ts
// - Aligns daysOfWeek to app logic: 1=Mon ... 7=Sun
// - Makes reminders.time consistently "HH:mm" when enabled
// - Keeps backward compatibility for schedule.times etc.
// ==========================
import type { Timestamp } from "firebase/firestore";

export type HabitScheduleType = "daily" | "weekly";

export type HabitReminder = {
  enabled: boolean;
  // "HH:mm" local time
  time: string;
};

export type HabitSchedule = {
  type: HabitScheduleType;

  // Backward-compat (you store a 1-item array)
  times?: string[]; // e.g. ["09:00"]

  // WEEKLY (1=Mon ... 7=Sun)
  daysOfWeek?: number[];
};

export type Habit = {
  id: string;
  name: string;
  isArchived: boolean;

  schedule?: HabitSchedule;

  // IANA TZ
  timezone?: string; // e.g. "Europe/London"

  // Stored in parent habit doc: reminders.enabled + reminders.time
  reminders?: HabitReminder;

  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

// Firestore write shape (no id)
export type HabitDoc = Omit<Habit, "id">;

// ==========================
// End of Version 3 — src/types/habit.ts
// ==========================
