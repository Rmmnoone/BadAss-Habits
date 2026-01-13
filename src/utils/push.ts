// ==========================
// Version 2 — src/utils/push.ts
// - Requests notification permission (must be called from a user gesture)
// - Gets FCM token (VAPID key required)
// - Uses active service worker registration (required for reliable web push)
// - Saves token to Firestore
// ==========================
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { app, db } from "../firebase/client";
import { savePushToken } from "../firebase/pushTokens";

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

async function getActiveServiceWorkerRegistration() {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;

  // Wait for SW to be ready (PWA install / dev)
  const reg = await navigator.serviceWorker.ready.catch(() => null);
  return reg;
}

export async function enablePushForUser(uid: string) {
  if (!uid) throw new Error("Missing uid");

  if (typeof window === "undefined") {
    return { ok: false as const, reason: "no-window" as const };
  }

  const supported = await isSupported().catch(() => false);
  if (!supported) {
    return { ok: false as const, reason: "messaging-not-supported" as const };
  }

  if (!("Notification" in window)) {
    return { ok: false as const, reason: "notifications-not-supported" as const };
  }

  // Permission must come from a user action (button click)
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    return { ok: false as const, reason: "permission-not-granted" as const };
  }

  if (!VAPID_KEY) {
    throw new Error("Missing env: VITE_FIREBASE_VAPID_KEY");
  }

  // Must have a SW reg for background notifications
  const swReg = await getActiveServiceWorkerRegistration();
  if (!swReg) {
    return { ok: false as const, reason: "no-service-worker" as const };
  }

  const messaging = getMessaging(app);

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: swReg,
  });

  if (!token) {
    return { ok: false as const, reason: "no-token" as const };
  }

  await savePushToken(db, uid, token);

  return { ok: true as const, token };
}

// ==========================
// End of Version 2 — src/utils/push.ts
// ==========================
