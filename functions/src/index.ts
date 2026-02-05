// ==========================
// Version 11 — functions/src/index.ts
// - v10 + Phase 3.4 TZ override correctness (MVP):
//   * Treat users/{uid}.timezone as the source of truth for:
//       - due checks
//       - digest timing
//       - exact reminder timing
//       - quiet hours gating
//   * Stops using habit.timezone for scheduler clock (prevents mismatch vs Dashboard TZ override)
// - No schema changes
// ==========================

import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { hmNow, safeTz, weekdayNow, dateKeyNow, isWithinQuietHours, isValidHHMM } from "./time";
import { hasExactReminder, isDueToday } from "./due";
import { sendToTokens } from "./fcm";

admin.initializeApp();
const db = getFirestore();

type QuietHours = {
  enabled?: boolean;
  start?: string; // "HH:mm"
  end?: string;   // "HH:mm"
};

function quietConfig(user: any): { enabled: boolean; start: string; end: string } {
  const q: QuietHours = (user?.quietHours as any) || {};
  const enabled = q.enabled === true;

  const start = isValidHHMM(q.start) ? String(q.start) : "22:00";
  const end = isValidHHMM(q.end) ? String(q.end) : "07:00";

  return { enabled, start, end };
}

// =====================
// Scheduled reminders
// =====================
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

        // Phase 3.1: global reminders kill switch
        const remindersEnabled = user.remindersEnabled !== false;
        if (!remindersEnabled) {
          console.log("[tick][user][skip:global-off]", { uid });
          continue;
        }

        // Phase 3.4: use user timezone as source of truth
        const userTz = safeTz(user.timezone);

        const nowHM_userTz = hmNow(userTz);
        const weekday_userTz = weekdayNow(userTz);
        const dateKey_userTz = dateKeyNow(userTz);

        // Phase 3.3: Quiet Hours (in user timezone)
        const q = quietConfig(user);
        const quietActive = q.enabled && isWithinQuietHours(nowHM_userTz, q.start, q.end);

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

        // IMPORTANT: pass tz so "today" is evaluated in userTz
        const dueToday_userTz = habits.filter((h) => isDueToday(h, weekday_userTz, userTz));

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
          quietEnabled: q.enabled,
          quietStart: q.start,
          quietEnd: q.end,
          quietActive,
        });

        // If quiet is active, skip ALL sends (digest + exact) this minute.
        if (quietActive) {
          console.log("[tick][user][skip:quiet-hours]", {
            uid,
            tz: userTz,
            nowHM: nowHM_userTz,
            start: q.start,
            end: q.end,
          });
          continue;
        }

        // A) Daily digest @ 16:00 (userTz)
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
              quiet: { enabled: q.enabled, start: q.start, end: q.end, active: false },
            });

            console.log("[digest]", { uid, nowHM_userTz, due: dueToday_userTz.length, ...r });
          } else {
            console.log("[digest][skip]", { uid, dateKey: dateKey_userTz, nowHM_userTz });
          }
        } else {
          console.log("[digest][skip:not-time]", { uid, nowHM_userTz, tz: userTz });
        }

        // B) Exact reminders per habit (NOW ALSO userTz for MVP)
        for (const h of habits) {
          if (!hasExactReminder(h)) continue;

          // IMPORTANT: evaluate due in userTz
          const dueInUserTz = isDueToday(h, weekday_userTz, userTz);
          if (!dueInUserTz) continue;

          // IMPORTANT: compare reminder time using userTz clock
          const reminderHM = String(h?.reminders?.time ?? "");
          if (!isValidHHMM(reminderHM)) continue;

          if (nowHM_userTz !== reminderHM) continue;

          const logId = `exact_${h.id}_${dateKey_userTz}_${reminderHM}`;
          const alreadySent = await wasSent(uid, logId);
          if (alreadySent) {
            console.log("[exact][skip]", { uid, habitId: h.id, habitDateKey: dateKey_userTz, reminderHM, tz: userTz });
            continue;
          }

          const title = String(h?.name ?? "BadAss Habits");
          const body = "Due now • Tap to check in";
          const link = `/habits/${h.id}`;

          const r = await sendToTokens(tokens, title, body, link, {
            tag: logId,
            renotify: true,
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
            dateKey: dateKey_userTz,
            atHM: reminderHM,
            tz: userTz,
            success: r.success,
            failure: r.failure,
            quiet: { enabled: q.enabled, start: q.start, end: q.end, active: false },
          });

          console.log("[exact]", { uid, habitId: h.id, nowHM_userTz, tz: userTz, ...r });
        }
      } catch (err: any) {
        console.log("[tickReminders][user-error]", uid, err?.message ?? err);
      }
    }
  }
);

// =====================
// Callable: Test push
// =====================
export const sendTestPush = onCall(
  { region: "europe-west2" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");

    const userSnap = await db.collection("users").doc(uid).get();
    const user = userSnap.data() || {};

    // Phase 3.1: global reminders kill switch (strict)
    const remindersEnabled = user.remindersEnabled !== false;
    if (!remindersEnabled) {
      throw new HttpsError("failed-precondition", "Global reminders are OFF for this user.");
    }

    const userTz = safeTz(user.timezone);
    const nowHM = hmNow(userTz);
    const dateKey = dateKeyNow(userTz);

    // Phase 3.3: quiet hours (strict)
    const q = quietConfig(user);
    const quietActive = q.enabled && isWithinQuietHours(nowHM, q.start, q.end);
    if (quietActive) {
      throw new HttpsError(
        "failed-precondition",
        `Quiet Hours are active (${q.start}–${q.end}). Test push is blocked right now.`
      );
    }

    const tokensSnap = await db.collection("users").doc(uid).collection("pushTokens").get();
    const tokens = tokensSnap.docs.map((d) => (d.data() as any)?.token).filter(Boolean);

    if (!tokens.length) {
      throw new HttpsError("failed-precondition", "No push tokens found for this user.");
    }

    const title = "BadAss Habits";
    const body = `Test notification • ${nowHM}`;
    const url = "/";

    const logId = `test_${dateKey}_${nowHM.replace(":", "")}`;

    const r = await sendToTokens(tokens, title, body, url, {
      tag: logId,
      renotify: true,
      requireInteraction: false,
      urgency: "high",
      ttlSeconds: 5 * 60, // 5 min
      actions: [{ action: "open", title: "Open" }],
    });

    await cleanupInvalidTokens(uid, r.invalid);

    await markSent(uid, logId, {
      type: "test",
      dateKey,
      atHM: nowHM,
      tz: userTz,
      success: r.success,
      failure: r.failure,
      quiet: { enabled: q.enabled, start: q.start, end: q.end, active: false },
    });

    return { ok: true, ...r, logId, dateKey, atHM: nowHM, tz: userTz };
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
// End of Version 11 — functions/src/index.ts
// ==========================
