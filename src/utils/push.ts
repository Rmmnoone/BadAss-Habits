// ==========================
// Version 3 — src/utils/push.ts
// - v2 + token lifecycle management
//   * Saves token only when changed
//   * Removes old token doc when token rotates
//   * Stores last token in localStorage per uid
//   * Adds disablePushForUser(uid) for logout cleanup (no permission prompts)
//   * Best-effort deletes FCM token via deleteToken()
// ==========================
import { getMessaging, getToken, deleteToken, isSupported } from "firebase/messaging";
import { app, db } from "../firebase/client";
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

  // Wait for SW to be ready (PWA install / dev)
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

  // Permission must come from a user action (button click)
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    return { ok: false, reason: "permission-not-granted" };
  }

  if (!VAPID_KEY) {
    return { ok: false, reason: "missing-vapid-key" };
  }

  // Must have a SW reg for background notifications
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
  const changed = Boolean(prev && prev !== token);

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
    return { ok: true, token, changed: true, created };
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
    // Still clear local token record
    writeLastToken(uid, null);
    return { ok: false, reason: "messaging-not-supported" };
  }

  // Don’t prompt for permission here. If user previously granted, we can clean up.
  const last = readLastToken(uid);

  // Remove Firestore doc for last known token
  if (last) {
    try {
      await removePushToken(db, uid, last);
    } catch {
      // ignore
    }
  }

  // Best-effort delete the FCM token in browser (unsubscribe)
  try {
    const swReg = await getActiveServiceWorkerRegistration();
    if (!swReg) {
      writeLastToken(uid, null);
      return { ok: false, reason: "no-service-worker" };
    }

    const messaging = getMessaging(app);
    await deleteToken(messaging); // best-effort; may fail in some environments
  } catch {
    // ignore
  }

  // Clear local token record regardless
  writeLastToken(uid, null);
  return { ok: true };
}

// ==========================
// End of Version 3 — src/utils/push.ts
// ==========================
