// ==========================
// Version 4 — src/pwa/registerSW.ts
// - Adds local module typing compatibility for "virtual:pwa-register"
// - Fixes TS7006 (no implicit any) by typing callback params
// - Behavior unchanged
// ==========================
import { registerSW } from "virtual:pwa-register";

export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const updateSW = registerSW({
    immediate: true,
    onRegistered(swUrl: string, reg: ServiceWorkerRegistration | undefined) {
      console.log("[PWA] SW registered", { swUrl, reg });
    },
    onRegisterError(error: unknown) {
      console.log("[PWA] SW register error", error);
    },
    onNeedRefresh() {
      console.log("[PWA] New content available; refresh to update.");
    },
    onOfflineReady() {
      console.log("[PWA] App ready to work offline.");
    },
  });

  return updateSW;
}

// ==========================
// End of Version 4 — src/pwa/registerSW.ts
// ==========================
