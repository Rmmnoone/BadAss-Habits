// ==========================
// Version 5 — src/pwa/registerSW.ts
// - Keeps SW registration without verbose console diagnostics
// ==========================
import { registerSW } from "virtual:pwa-register";

export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  const updateSW = registerSW({ immediate: true });

  return updateSW;
}

// ==========================
// End of Version 5 — src/pwa/registerSW.ts
// ==========================
