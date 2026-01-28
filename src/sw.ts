// ==========================
// Version 5 — src/sw.ts
// - Fixes TS build errors:
//   * Avoids NotificationAction type (not in some TS DOM libs)
//   * Uses a safe cast for renotify/requireInteraction/tag/actions
// - Still honors FCM data options: tag, renotify, requireInteraction
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

function pickPayload(payload: RawPayload) {
  // FCM often wraps as { data: { ... } }
  const d = payload?.data ?? payload ?? {};

  const title = String(d.title ?? payload?.title ?? "BadAss Habits");
  const body = String(d.body ?? payload?.body ?? "");
  const url = String(d.url ?? payload?.fcmOptions?.link ?? "/");

  const tag = String(d.tag ?? "");
  const renotify = asBool(d.renotify);
  const requireInteraction = asBool(d.requireInteraction);

  // keep as unknown[] to avoid DOM typing issues
  const actions: any[] = [];

  return { title, body, url, tag, renotify, requireInteraction, actions };
}

self.addEventListener("push", (event) => {
  const show = async () => {
    let payload: any = {};
    try {
      payload = event?.data ? event.data.json() : {};
    } catch {
      try {
        const raw = event?.data ? await event.data.text() : "";
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = {};
      }
    }

    // eslint-disable-next-line no-console
    console.log("[SW] push received", payload);

    const { title, body, url, tag, renotify, requireInteraction, actions } = pickPayload(payload);

    // Some TS DOM libs don't include renotify/requireInteraction/tag/actions
    // Runtime supports them, so we cast to any for build.
    const opts: any = {
      body,
      data: { url },
      icon: "/pwa-192.png",
      badge: "/pwa-192.png",

      tag: tag || undefined,
      renotify: tag ? renotify : false,
      requireInteraction: Boolean(requireInteraction),

      actions: actions.length ? actions : undefined,
    };

    await self.registration.showNotification(title, opts);
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
// End of Version 5 — src/sw.ts
// ==========================
