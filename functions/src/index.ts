import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { hmNow, safeTz, weekdayNow } from "./time";
import { hasExactReminder, isDueToday } from "./due";
import { sendToTokens } from "./fcm";

admin.initializeApp();
const db = getFirestore();

/**
 * MVP Scheduler
 * - runs every minute
 * - per user timezone:
 *   A) 16:00 daily digest if due>0
 *   B) exact-time reminder per habit if enabled and due today
 */
export const tickReminders = onSchedule(
  {
    schedule: "every 1 minutes",
    region: "europe-west2",
  },
  async () => {
    const usersSnap = await db.collection("users").get();
    console.log("[tickReminders] users:", usersSnap.size);

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const user = userDoc.data() || {};
      const userTz = safeTz(user.timezone);

      const nowHM = hmNow(userTz);
      const weekday = weekdayNow(userTz);

      // Read active habits
      const habitsSnap = await db
        .collection("users")
        .doc(uid)
        .collection("habits")
        .where("isArchived", "==", false)
        .get();

      if (habitsSnap.empty) continue;

      const habits = habitsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      const dueToday = habits.filter((h) => isDueToday(h, weekday));

      // Requirement: if no due habits today -> no reminders at all (including 4PM)
      if (dueToday.length === 0) continue;

      // Read tokens
      const tokensSnap = await db.collection("users").doc(uid).collection("pushTokens").get();
      const tokens = tokensSnap.docs.map((d) => (d.data() as any)?.token).filter(Boolean);

      if (!tokens.length) continue;

      // A) Daily digest @ 16:00
      if (nowHM === "16:00") {
        const title = "BadAss Habits";
        const body =
          dueToday.length === 1
            ? "You have 1 habit due today."
            : `You have ${dueToday.length} habits due today.`;

        const r = await sendToTokens(tokens, title, body, "/");
        await cleanupInvalidTokens(uid, r.invalid);
        console.log("[digest]", { uid, nowHM, due: dueToday.length, ...r });
      }

      // B) Exact reminders per habit
      for (const h of dueToday) {
        if (!hasExactReminder(h)) continue;

        // Habit time: use habit.timezone if present, else user timezone
        const habitTz = safeTz(h.timezone ?? userTz);
        const habitNowHM = hmNow(habitTz);

        if (habitNowHM !== h.reminders.time) continue;

        const title = "BadAss Habits";
        const body = `Time for: ${h.name}`;

        const r = await sendToTokens(tokens, title, body, "/");
        await cleanupInvalidTokens(uid, r.invalid);
        console.log("[exact]", { uid, habitId: h.id, habitNowHM, tz: habitTz, ...r });
      }
    }
  }
);

async function cleanupInvalidTokens(uid: string, invalidTokens: string[]) {
  if (!invalidTokens.length) return;

  const batch = db.batch();
  for (const t of invalidTokens) {
    batch.delete(db.collection("users").doc(uid).collection("pushTokens").doc(t));
  }
  await batch.commit();
}
