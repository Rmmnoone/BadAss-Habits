// ==========================
// Version 7 - src/utils/push.ts
// - Keeps push registration across normal logout/login
// - Adds silent restore for already-granted permission
// - Rebinds the saved device token when switching accounts
// - Keeps test-push callable helper
// ==========================
import { getMessaging, getToken, deleteToken, isSupported } from "firebase/messaging";
import { httpsCallable } from "firebase/functions";
import { app, db, functions } from "../firebase/client";
import { upsertPushToken, removePushToken } from "../firebase/pushTokens";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

const LS_TOKEN_KEY = "bah:lastPushToken";
const LS_UID_KEY = "bah:lastPushUid";

function readLastRegistration(): { uid: string | null; token: string | null } {
  try {
    if (typeof window === "undefined") return { uid: null, token: null };
    return {
      uid: localStorage.getItem(LS_UID_KEY),
      token: localStorage.getItem(LS_TOKEN_KEY),
    };
  } catch {
    return { uid: null, token: null };
  }
}

function writeLastRegistration(uid: string | null, token: string | null) {
  try {
    if (typeof window === "undefined") return;

    if (!uid || !token) {
      localStorage.removeItem(LS_UID_KEY);
      localStorage.removeItem(LS_TOKEN_KEY);
      return;
    }

    localStorage.setItem(LS_UID_KEY, uid);
    localStorage.setItem(LS_TOKEN_KEY, token);
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

function getFirebaseOptionsSafe() {
  const opts = (app as any)?.options ?? {};
  return {
    projectId: opts.projectId ? String(opts.projectId) : "",
    appId: opts.appId ? String(opts.appId) : "",
    apiKeyPresent: Boolean(opts.apiKey),
    messagingSenderIdPresent: Boolean(opts.messagingSenderId),
  };
}

function isVapidKeyLikelyValid(k: string) {
  const s = String(k || "").trim();
  return s.length >= 50 && !s.includes(" ") && !s.includes("\n");
}

function errorToReason(e: any): string {
  const code = e?.code ? String(e.code) : "";
  const msg = e?.message ? String(e.message) : "";

  if (code.includes("messaging/permission-blocked") || msg.toLowerCase().includes("permission")) {
    return "permission-blocked";
  }
  if (code.includes("messaging/unsupported-browser")) {
    return "unsupported-browser";
  }
  if (code.includes("messaging/token-subscribe-failed") || msg.toLowerCase().includes("token-subscribe")) {
    return "token-subscribe-failed";
  }
  if (msg.includes("401") || msg.toLowerCase().includes("unauthorized")) {
    return "unauthorized-401";
  }
  return code || msg || "unknown-error";
}

export type EnablePushResult =
  | { ok: true; token: string; changed: boolean; created: boolean }
  | {
      ok: false;
      reason:
        | "no-window"
        | "messaging-not-supported"
        | "notifications-not-supported"
        | "permission-not-granted"
        | "missing-vapid-key"
        | "invalid-vapid-key"
        | "missing-firebase-config"
        | "no-service-worker"
        | "get-token-failed"
        | "no-token";
      detail?: string;
    };

async function resolveTokenForUser(uid: string, requestPermission: boolean): Promise<EnablePushResult> {
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

  const perm = requestPermission ? await Notification.requestPermission() : Notification.permission;
  if (perm !== "granted") {
    return { ok: false, reason: "permission-not-granted" };
  }

  if (!VAPID_KEY) {
    return { ok: false, reason: "missing-vapid-key" };
  }
  if (!isVapidKeyLikelyValid(VAPID_KEY)) {
    return { ok: false, reason: "invalid-vapid-key" };
  }

  const opts = getFirebaseOptionsSafe();
  if (!opts.apiKeyPresent || !opts.appId || !opts.messagingSenderIdPresent || !opts.projectId) {
    console.error("[push] Missing Firebase config at runtime:", {
      ...opts,
      origin: window.location.origin,
    });
    return { ok: false, reason: "missing-firebase-config" };
  }

  const swReg = await getActiveServiceWorkerRegistration();
  if (!swReg) {
    return { ok: false, reason: "no-service-worker" };
  }

  const messaging = getMessaging(app);

  let token = "";
  try {
    token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });
  } catch (e: any) {
    const detail = errorToReason(e);
    console.error("[push] getToken failed:", {
      detail,
      origin: window.location.origin,
      projectId: opts.projectId,
      appIdPresent: Boolean(opts.appId),
      apiKeyPresent: opts.apiKeyPresent,
      senderIdPresent: opts.messagingSenderIdPresent,
    });
    return { ok: false, reason: "get-token-failed", detail };
  }

  if (!token) {
    return { ok: false, reason: "no-token" };
  }

  const prev = readLastRegistration();

  if (prev.uid && prev.token && (prev.uid !== uid || prev.token !== token)) {
    try {
      await removePushToken(db, prev.uid, prev.token);
    } catch {
      // ignore
    }
  }

  if (!prev.uid || !prev.token || prev.uid !== uid || prev.token !== token) {
    const { created } = await upsertPushToken(db, uid, token);
    writeLastRegistration(uid, token);
    return {
      ok: true,
      token,
      changed: Boolean(prev.uid || prev.token),
      created,
    };
  }

  return { ok: true, token, changed: false, created: false };
}

export async function enablePushForUser(uid: string): Promise<EnablePushResult> {
  return resolveTokenForUser(uid, true);
}

export async function restorePushForUser(uid: string): Promise<EnablePushResult> {
  return resolveTokenForUser(uid, false);
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
    writeLastRegistration(null, null);
    return { ok: false, reason: "messaging-not-supported" };
  }

  const last = readLastRegistration();

  if (last.uid === uid && last.token) {
    try {
      await removePushToken(db, uid, last.token);
    } catch {
      // ignore
    }
  }

  try {
    const swReg = await getActiveServiceWorkerRegistration();
    if (!swReg) {
      writeLastRegistration(null, null);
      return { ok: false, reason: "no-service-worker" };
    }

    const messaging = getMessaging(app);
    await deleteToken(messaging);
  } catch {
    // ignore
  }

  writeLastRegistration(null, null);
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
// End of Version 7 - src/utils/push.ts
// ==========================
