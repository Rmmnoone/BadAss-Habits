// ==========================
// Version 5 — src/firebase/schedules.ts
// - Keeps strict reminder schema normalization
// - Ensures reminder is ALWAYS present in schedule subdoc + habit denorm
// - Normalizes daysOfWeek + clamps values (1..7)
// ==========================
import { doc, serverTimestamp, setDoc, updateDoc, type Firestore } from "firebase/firestore";

export type HabitScheduleType = "daily" | "weekly";

export type HabitReminder = {
  enabled: boolean;
  time: string; // "HH:mm" local time
};

export type HabitSchedule = {
  type: HabitScheduleType;
  daysOfWeek?: number[]; // 1=Mon ... 7=Sun
  reminder?: HabitReminder; // stored in schedule subdoc
  updatedAt?: any;
};

export function scheduleDoc(db: Firestore, uid: string, habitId: string) {
  return doc(db, "users", uid, "habits", habitId, "schedule", "main");
}

function habitDoc(db: Firestore, uid: string, habitId: string) {
  return doc(db, "users", uid, "habits", habitId);
}

function isValidHHMM(s: any): boolean {
  if (typeof s !== "string") return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(s);
}

function normalizeReminder(input: any): HabitReminder {
  const enabled = Boolean(input?.enabled);
  const timeRaw = typeof input?.time === "string" ? input.time : "";
  const time = isValidHHMM(timeRaw) ? timeRaw : "09:00";
  return { enabled, time };
}

function normalizeDaysOfWeek(type: HabitScheduleType, days: any): number[] {
  if (type !== "weekly") return [];
  if (!Array.isArray(days)) return [];
  const cleaned = days
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 7);
  // de-dupe
  return Array.from(new Set(cleaned));
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

  const type: HabitScheduleType = schedule.type ?? "daily";
  const reminder = normalizeReminder(schedule.reminder ?? { enabled: false, time: "09:00" });
  const daysOfWeek = normalizeDaysOfWeek(type, schedule.daysOfWeek);

  // 1) schedule subdoc (canonical schedule config)
  const payload: HabitSchedule = {
    type,
    daysOfWeek: type === "weekly" ? daysOfWeek : [],
    reminder, // always present for predictable reads
    updatedAt: serverTimestamp(),
  };

  await setDoc(ref, payload, { merge: true });

  // 2) denormalize to habit doc (fast reads + backward compat)
  const hRef = habitDoc(db, uid, habitId);

  await updateDoc(hRef, {
    "schedule.type": type,
    "schedule.daysOfWeek": type === "weekly" ? daysOfWeek : [],
    "schedule.times": [reminder.time], // backward-compat (1-item array)
    "reminders.enabled": reminder.enabled,
    "reminders.time": reminder.time,
    updatedAt: serverTimestamp(),
  });
}

// ==========================
// End of Version 5 — src/firebase/schedules.ts
// ==========================
