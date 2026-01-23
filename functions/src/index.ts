// ==========================
// Version 6 — functions/src/index.ts
// - Uses fcm.ts v4 options (NO logic changes):
//   * Digest: urgency=low, ttlSeconds=6h
//   * Exact:  urgency=high, ttlSeconds=20m + optional "Open" action
// - Keeps Version 5 behavior:
//   * Nicer copy + deep links
//   * Idempotency + safety logs
// ==========================

import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { hmNow, safeTz, weekdayNow, dateKeyNow } from "./time";
import { hasExactReminder, isDueToday } from "./due";
import { sendToTokens } from "./fcm";

admin.initializeApp();
const db = getFirestore();

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

      try {
        const user = userDoc.data() || {};
        const userTz = safeTz(user.timezone);

        const nowHM_userTz = hmNow(userTz);
        const weekday_userTz = weekdayNow(userTz);
        const dateKey_userTz = dateKeyNow(userTz);

        const habitsSnap = await db
          .collection("users")
          .doc(uid)
          .collection("habits")
          .where("isArchived", "==", false)
          .get();

        if (habitsSnap.empty) {
          console.log("[tick][user][skip:no-habits]", { uid, tz: userTz, nowHM: nowHM_userTz });
          continue;
        }

        const habits = habitsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

        const dueToday_userTz = habits.filter((h) => isDueToday(h, weekday_userTz));

        if (dueToday_userTz.length === 0) {
          console.log("[tick][user][skip:no-due]", {
            uid,
            tz: userTz,
            nowHM: nowHM_userTz,
            habits: habits.length,
            due: 0,
          });
          continue;
        }

        const tokensSnap = await db.collection("users").doc(uid).collection("pushTokens").get();
        const tokens = tokensSnap.docs.map((d) => (d.data() as any)?.token).filter(Boolean);

        if (!tokens.length) {
          console.log("[tick][user][skip:no-tokens]", {
            uid,
            tz: userTz,
            nowHM: nowHM_userTz,
            due: dueToday_userTz.length,
          });
          continue;
        }

        const exactCandidates = habits.filter((h) => hasExactReminder(h)).length;

        console.log("[tick][user]", {
          uid,
          tz: userTz,
          nowHM: nowHM_userTz,
          dateKey: dateKey_userTz,
          habits: habits.length,
          due: dueToday_userTz.length,
          tokenCount: tokens.length,
          exactCandidates,
        });

        // A) Daily digest @ 16:00
        if (nowHM_userTz === "16:00") {
          const logId = `digest_${dateKey_userTz}_1600`;
          const alreadySent = await wasSent(uid, logId);

          if (!alreadySent) {
            const title = "BadAss Habits";
            const body =
              dueToday_userTz.length === 1
                ? "You have 1 habit due today."
                : `You have ${dueToday_userTz.length} habits due today.`;

            const r = await sendToTokens(tokens, title, body, "/", {
              tag: logId,
              renotify: false,
              requireInteraction: false,
              urgency: "low",
              ttlSeconds: 6 * 60 * 60, // 6 hours
              actions: [{ action: "open", title: "Open" }],
            });

            await cleanupInvalidTokens(uid, r.invalid);

            await markSent(uid, logId, {
              type: "digest",
              dateKey: dateKey_userTz,
              atHM: "16:00",
              dueCount: dueToday_userTz.length,
              tz: userTz,
              success: r.success,
              failure: r.failure,
            });

            console.log("[digest]", { uid, nowHM_userTz, due: dueToday_userTz.length, ...r });
          } else {
            console.log("[digest][skip]", { uid, dateKey: dateKey_userTz, nowHM_userTz });
          }
        } else {
          console.log("[digest][skip:not-time]", { uid, nowHM_userTz, tz: userTz });
        }

        // B) Exact reminders per habit
        for (const h of habits) {
          if (!hasExactReminder(h)) continue;

          const habitTz = safeTz(h.timezone ?? userTz);
          const habitWeekday = weekdayNow(habitTz);
          const habitDateKey = dateKeyNow(habitTz);

          if (!isDueToday(h, habitWeekday)) continue;

          const habitNowHM = hmNow(habitTz);
          const reminderHM = String(h?.reminders?.time ?? "");

          if (habitNowHM !== reminderHM) continue;

          const logId = `exact_${h.id}_${habitDateKey}_${reminderHM}`;
          const alreadySent = await wasSent(uid, logId);
          if (alreadySent) {
            console.log("[exact][skip]", { uid, habitId: h.id, habitDateKey, reminderHM, tz: habitTz });
            continue;
          }

          // Nicer notification copy + deep link
          const title = String(h?.name ?? "BadAss Habits");
          const body = "Due now • Tap to check in";
          const link = `/habits/${h.id}`;

          const r = await sendToTokens(tokens, title, body, link, {
            tag: `exact_${h.id}`,
            renotify: false,
            requireInteraction: true,
            urgency: "high",
            ttlSeconds: 20 * 60, // 20 minutes
            actions: [{ action: "open", title: "Open" }],
          });

          await cleanupInvalidTokens(uid, r.invalid);

          await markSent(uid, logId, {
            type: "exact",
            habitId: h.id,
            habitName: h.name,
            dateKey: habitDateKey,
            atHM: reminderHM,
            tz: habitTz,
            success: r.success,
            failure: r.failure,
          });

          console.log("[exact]", { uid, habitId: h.id, habitNowHM, tz: habitTz, ...r });
        }
      } catch (err: any) {
        console.log("[tickReminders][user-error]", uid, err?.message ?? err);
      }
    }
  }
);

function reminderLogDoc(uid: string, logId: string) {
  return db.collection("users").doc(uid).collection("reminderLogs").doc(logId);
}

async function wasSent(uid: string, logId: string): Promise<boolean> {
  const snap = await reminderLogDoc(uid, logId).get();
  return snap.exists;
}

async function markSent(uid: string, logId: string, meta: Record<string, any>) {
  await reminderLogDoc(uid, logId).set(
    {
      ...meta,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      logId,
    },
    { merge: true }
  );
}

async function cleanupInvalidTokens(uid: string, invalidTokens: string[]) {
  if (!invalidTokens.length) return;

  const batch = db.batch();
  for (const t of invalidTokens) {
    batch.delete(db.collection("users").doc(uid).collection("pushTokens").doc(t));
  }
  await batch.commit();
}

// ==========================
// End of Version 6 — functions/src/index.ts
// ==========================
