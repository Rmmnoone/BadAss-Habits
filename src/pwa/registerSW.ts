// ==========================
// Version 3 — src/pwa/registerSW.ts
// - Registers the PWA service worker (vite-plugin-pwa)
// - Safe no-op in unsupported environments
// - Returns update function (optional future “refresh available” UI)
// ==========================
import { registerSW } from "virtual:pwa-register";

export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const updateSW = registerSW({
    immediate: true,
    onRegistered(swUrl, reg) {
      // eslint-disable-next-line no-console
      console.log("[PWA] SW registered", { swUrl, reg });
    },
    onRegisterError(error) {
      // eslint-disable-next-line no-console
      console.log("[PWA] SW register error", error);
    },
    onNeedRefresh() {
      // eslint-disable-next-line no-console
      console.log("[PWA] New content available; refresh to update.");
    },
    onOfflineReady() {
      // eslint-disable-next-line no-console
      console.log("[PWA] App ready to work offline.");
    },
  });

  return updateSW;
}

// ==========================
// End of Version 3 — src/pwa/registerSW.ts
// ==========================
