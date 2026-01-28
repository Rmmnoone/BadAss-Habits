// ==========================
// Version 5 — src/utils/push.ts
// - v4 + fixes TS6133: `changed` was declared but never read
//   * Removes the unused local and computes changed inline
// - Keeps token lifecycle logic the same
// - Keeps callable sendTestPush helper (auth required)
// ==========================
import { getMessaging, getToken, deleteToken, isSupported } from "firebase/messaging";
import { httpsCallable } from "firebase/functions";
import { app, db, functions } from "../firebase/client";
import { upsertPushToken, removePushToken } from "../firebase/pushTokens";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

const LS_PREFIX = "bah:lastPushToken";

function lsKey(uid: string) {
  return `${LS_PREFIX}:${uid}`;
}

function readLastToken(uid: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(lsKey(uid));
  } catch {
    return null;
  }
}

function writeLastToken(uid: string, token: string | null) {
  try {
    if (typeof window === "undefined") return;
    const k = lsKey(uid);
    if (!token) localStorage.removeItem(k);
    else localStorage.setItem(k, token);
  } catch {
    // ignore
  }
}

async function getActiveServiceWorkerRegistration() {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;

  const reg = await navigator.serviceWorker.ready.catch(() => null);
  return reg;
}

type EnablePushResult =
  | { ok: true; token: string; changed: boolean; created: boolean }
  | {
      ok: false;
      reason:
        | "no-window"
        | "messaging-not-supported"
        | "notifications-not-supported"
        | "permission-not-granted"
        | "missing-vapid-key"
        | "no-service-worker"
        | "no-token";
    };

export async function enablePushForUser(uid: string): Promise<EnablePushResult> {
  if (!uid) throw new Error("Missing uid");

  if (typeof window === "undefined") {
    return { ok: false, reason: "no-window" };
  }

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    return { ok: false, reason: "messaging-not-supported" };
  }

  if (!("Notification" in window)) {
    return { ok: false, reason: "notifications-not-supported" };
  }

  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    return { ok: false, reason: "permission-not-granted" };
  }

  if (!VAPID_KEY) {
    return { ok: false, reason: "missing-vapid-key" };
  }

  const swReg = await getActiveServiceWorkerRegistration();
  if (!swReg) {
    return { ok: false, reason: "no-service-worker" };
  }

  const messaging = getMessaging(app);

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: swReg,
  });

  if (!token) {
    return { ok: false, reason: "no-token" };
  }

  const prev = readLastToken(uid);

  // If token rotated, remove old doc best-effort
  if (prev && prev !== token) {
    try {
      await removePushToken(db, uid, prev);
    } catch {
      // ignore
    }
  }

  // Save only when new or changed (or missing local record)
  if (!prev || prev !== token) {
    const { created } = await upsertPushToken(db, uid, token);
    writeLastToken(uid, token);

    return {
      ok: true,
      token,
      changed: Boolean(prev && prev !== token),
      created,
    };
  }

  // Token same as last time; nothing to write
  return { ok: true, token, changed: false, created: false };
}

type DisablePushResult =
  | { ok: true }
  | { ok: false; reason: "no-window" | "messaging-not-supported" | "no-service-worker" };

export async function disablePushForUser(uid: string): Promise<DisablePushResult> {
  if (!uid) throw new Error("Missing uid");

  if (typeof window === "undefined") {
    return { ok: false, reason: "no-window" };
  }

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    writeLastToken(uid, null);
    return { ok: false, reason: "messaging-not-supported" };
  }

  const last = readLastToken(uid);

  if (last) {
    try {
      await removePushToken(db, uid, last);
    } catch {
      // ignore
    }
  }

  try {
    const swReg = await getActiveServiceWorkerRegistration();
    if (!swReg) {
      writeLastToken(uid, null);
      return { ok: false, reason: "no-service-worker" };
    }

    const messaging = getMessaging(app);
    await deleteToken(messaging);
  } catch {
    // ignore
  }

  writeLastToken(uid, null);
  return { ok: true };
}

type TestPushResult =
  | {
      ok: true;
      success: number;
      failure: number;
      invalid: string[];
      logId: string;
      dateKey: string;
      atHM: string;
      tz: string;
    }
  | { ok: false; reason: string };

export async function sendTestPush(): Promise<TestPushResult> {
  try {
    const fn = httpsCallable(functions, "sendTestPush");
    const res: any = await fn({});
    const data = res?.data ?? {};
    if (data?.ok) return data as any;
    return { ok: false, reason: "Unexpected response from server." };
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : "Test push failed.";
    return { ok: false, reason: msg };
  }
}

// ==========================
// End of Version 5 — src/utils/push.ts
// ==========================
