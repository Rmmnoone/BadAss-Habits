// ==========================
// Version 2 — functions/src/admin.ts
// - Admin-only callable endpoints (custom claim: admin === true)
// - Provides:
//   * adminListUsers (paginated)
//   * adminUserSummary (counts)
//   * adminReminderLogs (latest logs)
//   * adminWhoAmI (returns uid + token claims)
//   * adminSetAdmin (grant/revoke admin claim for a target uid)
// - Bootstrap removed (adminBootstrapSelf deleted)
// ==========================

import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

function assertAuthed(req: any): string {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in required.");
  return uid;
}

function assertAdmin(req: any) {
  const claims = req.auth?.token || {};
  if (claims.admin !== true) throw new HttpsError("permission-denied", "Admin only.");
}

function toIsoOrNull(d: any): string | null {
  try {
    if (!d) return null;
    if (typeof d.toDate === "function") return d.toDate().toISOString();
    if (d instanceof Date) return d.toISOString();
    if (typeof d === "string") return d;
    return null;
  } catch {
    return null;
  }
}

// ---------------------
// Admin: who am I?
// ---------------------
export const adminWhoAmI = onCall({ region: "europe-west2" }, async (req) => {
  const uid = assertAuthed(req);
  assertAdmin(req);

  // NOTE: token claims are what the server sees for this request.
  // If you just changed claims, refresh the client token then try again.
  return { uid, claims: req.auth?.token ?? {} };
});

// ---------------------
// Admin: grant/revoke admin
// ---------------------
export const adminSetAdmin = onCall({ region: "europe-west2" }, async (req) => {
  const callerUid = assertAuthed(req);
  assertAdmin(req);

  const targetUid = String(req.data?.uid ?? "");
  const makeAdmin = req.data?.admin === true;

  if (!targetUid) throw new HttpsError("invalid-argument", "uid is required.");

  // Prevent accidentally removing your own admin
  if (targetUid === callerUid && makeAdmin === false) {
    throw new HttpsError("failed-precondition", "You cannot remove admin from yourself.");
  }

  // Merge with existing claims (don’t wipe other future flags)
  const user = await admin.auth().getUser(targetUid);
  const existing = (user.customClaims || {}) as Record<string, any>;
  const nextClaims = { ...existing, admin: makeAdmin };

  await admin.auth().setCustomUserClaims(targetUid, nextClaims);

  return { ok: true };
});

// ---------------------
// Admin: list users
// ---------------------
export const adminListUsers = onCall({ region: "europe-west2" }, async (req) => {
  assertAuthed(req);
  assertAdmin(req);

  const limit = Math.max(1, Math.min(100, Number(req.data?.limit ?? 25)));
  const pageToken = req.data?.pageToken ? String(req.data.pageToken) : undefined;

  const res = await admin.auth().listUsers(limit, pageToken);

  const users = res.users.map((u) => ({
    uid: u.uid,
    email: u.email ?? null,
    disabled: u.disabled ?? false,
    createdAt: u.metadata?.creationTime ?? null,
    lastSignInTime: u.metadata?.lastSignInTime ?? null,
  }));

  return { users, nextPageToken: res.pageToken ?? null };
});

// ---------------------
// Admin: per-user summary
// ---------------------
export const adminUserSummary = onCall({ region: "europe-west2" }, async (req) => {
  assertAuthed(req);
  assertAdmin(req);

  const uid = String(req.data?.uid ?? "");
  if (!uid) throw new HttpsError("invalid-argument", "uid is required.");

  const habitsRef = db.collection("users").doc(uid).collection("habits");
  const tokensRef = db.collection("users").doc(uid).collection("pushTokens");
  const logsRef = db.collection("users").doc(uid).collection("reminderLogs");

  const [habitsAgg, tokensAgg, logsAgg] = await Promise.all([
    (habitsRef as any).count().get(),
    (tokensRef as any).count().get(),
    (logsRef as any).count().get(),
  ]);

  const latestLogSnap = await logsRef.orderBy("sentAt", "desc").limit(1).get();
  const latestReminderSentAt =
    latestLogSnap.empty ? null : toIsoOrNull(latestLogSnap.docs[0].data()?.sentAt);

  return {
    uid,
    habitsCount: Number(habitsAgg?.data()?.count ?? 0),
    pushTokensCount: Number(tokensAgg?.data()?.count ?? 0),
    reminderLogsCount: Number(logsAgg?.data()?.count ?? 0),
    latestReminderSentAt,
  };
});

// ---------------------
// Admin: reminder logs
// ---------------------
export const adminReminderLogs = onCall({ region: "europe-west2" }, async (req) => {
  assertAuthed(req);
  assertAdmin(req);

  const uid = req.data?.uid ? String(req.data.uid) : null;
  const limit = Math.max(1, Math.min(200, Number(req.data?.limit ?? 50)));

  let q: FirebaseFirestore.Query = db.collectionGroup("reminderLogs");

  if (uid) {
    q = db.collection("users").doc(uid).collection("reminderLogs");
  }

  const snap = await q.orderBy("sentAt", "desc").limit(limit).get();

  const logs = snap.docs.map((d) => {
    const data = d.data() as any;

    const pathParts = d.ref.path.split("/");
    const derivedUid = pathParts[1] || uid || "";

    return {
      uid: derivedUid,
      logId: d.id,
      type: data.type ?? null,
      dateKey: data.dateKey ?? null,
      atHM: data.atHM ?? null,
      tz: data.tz ?? null,
      sentAt: toIsoOrNull(data.sentAt),
      habitId: data.habitId ?? null,
      habitName: data.habitName ?? null,
      success: Number(data.success ?? 0),
      failure: Number(data.failure ?? 0),
    };
  });

  return { logs };
});

// ==========================
// End of Version 2 — functions/src/admin.ts
// ==========================
