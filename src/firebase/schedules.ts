// ==========================
// Version 3 — src/firebase/schedules.ts
// - Extends schedule to include reminder settings (enabled + time)
// - Still writes schedule doc: users/{uid}/habits/{habitId}/schedule/main
// - Denormalizes into parent habit doc for fast reads:
//   * schedule.type, schedule.daysOfWeek
//   * reminders.enabled, reminders.time
//   * (keeps schedule.times as a 1-item array for backward-compat)
// ==========================
import {
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";

export type HabitScheduleType = "daily" | "weekly";

export type HabitReminder = {
  enabled: boolean;
  time: string; // "HH:MM" local time
};

export type HabitSchedule = {
  type: HabitScheduleType;
  daysOfWeek?: number[]; // 1=Mon ... 7=Sun (only for weekly)
  reminder?: HabitReminder; // NEW (stored in schedule subdoc)
  updatedAt?: any;
};

export function scheduleDoc(db: Firestore, uid: string, habitId: string) {
  return doc(db, "users", uid, "habits", habitId, "schedule", "main");
}

function habitDoc(db: Firestore, uid: string, habitId: string) {
  return doc(db, "users", uid, "habits", habitId);
}

export async function setHabitSchedule(
  db: Firestore,
  uid: string,
  habitId: string,
  schedule: {
    type: HabitScheduleType;
    daysOfWeek?: number[];
    reminder?: HabitReminder;
  }
) {
  const ref = scheduleDoc(db, uid, habitId);

  const reminder: HabitReminder | undefined = schedule.reminder
    ? {
        enabled: Boolean(schedule.reminder.enabled),
        time: schedule.reminder.time || "09:00",
      }
    : undefined;

  // Normalize: if daily, don't keep daysOfWeek
  const payload: HabitSchedule = {
    type: schedule.type,
    ...(schedule.type === "weekly" ? { daysOfWeek: schedule.daysOfWeek ?? [] } : {}),
    ...(reminder ? { reminder } : {}),
    updatedAt: serverTimestamp(),
  };

  // 1) Keep subcollection doc
  await setDoc(ref, payload, { merge: true });

  // 2) Denormalize into parent habit doc
  const hRef = habitDoc(db, uid, habitId);

  // We keep reminders in the parent habit doc because your habit schema already has:
  // reminders: { enabled, time }
  // And we keep schedule.times as a backward-compatible 1-item array.
  const reminderEnabled = reminder?.enabled ?? false;
  const reminderTime = reminder?.time ?? "09:00";

  await updateDoc(hRef, {
    "schedule.type": payload.type,
    "schedule.daysOfWeek": payload.type === "weekly" ? (payload.daysOfWeek ?? []) : [],
    "schedule.times": [reminderTime], // backward-compat (your createHabit sets schedule.times)
    "reminders.enabled": reminderEnabled,
    "reminders.time": reminderTime,
    updatedAt: serverTimestamp(),
  });
}

// ==========================
// End of Version 3 — src/firebase/schedules.ts
// ==========================
