// ==========================
// Version 7 — src/sw.ts
// - Removes temporary notification delivery diagnostics
// - Keeps Workbox InjectManifest precache
// ==========================

/// <reference lib="webworker" />

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<any>;
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

type RawPayload = any;

function asBool(v: any): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true";
  return false;
}

function safeString(v: any, fallback = ""): string {
  if (v == null) return fallback;
  try {
    const s = String(v);
    return s;
  } catch {
    return fallback;
  }
}

function pickPayload(payload: RawPayload, rawText?: string) {
  // FCM often wraps as { data: { ... } }
  const d = payload?.data ?? payload ?? {};

  const title = safeString(d.title ?? payload?.title, "BadAss Habits");
  let body = safeString(d.body ?? payload?.body, "");

  // If DevTools "Push" was used (plain text), show it so we can confirm visually
  if (!body && rawText) body = rawText;

  // If still empty, put a visible default so "nothing happened" is not ambiguous
  if (!body) body = "Reminder received (no body provided).";

  const url = safeString(d.url ?? payload?.fcmOptions?.link, "/");

  const tag = safeString(d.tag, "");
  const renotify = asBool(d.renotify);
  const requireInteraction = asBool(d.requireInteraction);

  // keep as unknown[] to avoid DOM typing issues
  const actions: any[] = [];

  return { title, body, url, tag, renotify, requireInteraction, actions };
}

self.addEventListener("push", (event) => {
  const show = async () => {
    let payload: any = {};
    let rawText = "";

    // Parse payload (json -> text -> empty)
    try {
      payload = event?.data ? event.data.json() : {};
    } catch {
      try {
        rawText = event?.data ? await event.data.text() : "";
        payload = rawText ? JSON.parse(rawText) : {};
      } catch {
        payload = {};
      }
    }

    const { title, body, url, tag, renotify, requireInteraction, actions } = pickPayload(payload, rawText);

    const opts: any = {
      body,
      data: { url },

      // Icons must exist at root in prod, or at least not 404 to HTML.
      // If these are missing, you'll still usually get a notification,
      // but we keep them as-is.
      icon: "/pwa-512.png",
      badge: "/pwa-192.png",

      tag: tag || undefined,
      renotify: tag ? renotify : false,
      requireInteraction: Boolean(requireInteraction),

      actions: actions.length ? actions : undefined,
    };

    try {
      await self.registration.showNotification(title, opts);
    } catch {}
  };

  event.waitUntil(show());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification?.data as any)?.url ?? "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        try {
          if ("focus" in client) {
            const w = client as WindowClient;
            await w.focus();
            if ("navigate" in w) {
              await w.navigate(url);
            }
            return;
          }
        } catch {
          // ignore
        }
      }

      await self.clients.openWindow(url);
    })()
  );
});

// ==========================
// End of Version 7 — src/sw.ts
// ==========================
