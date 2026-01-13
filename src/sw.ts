// ==========================
// Version 2 — src/sw.ts
// - Adds debug logs for push payload + errors
// - Still shows notification even if payload is empty
// - Click focuses/opens app (same as v1)
// ==========================

/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

function pickNotificationPayload(data: any) {
  const notif = data?.notification ?? data?.data?.notification ?? null;

  const title =
    notif?.title ??
    data?.title ??
    data?.data?.title ??
    "BadAss Habits";

  const body =
    notif?.body ??
    data?.body ??
    data?.data?.body ??
    "";

  const url =
    data?.data?.url ??
    data?.fcmOptions?.link ??
    data?.notification?.click_action ??
    "/";

  return { title, body, url };
}

self.addEventListener("push", (event) => {
  const show = async () => {
    let data: any = null;
    let rawText: string | null = null;

    try {
      if (event?.data) {
        try {
          data = event.data.json();
        } catch {
          rawText = event.data.text();
          // best-effort parse
          try {
            data = JSON.parse(rawText);
          } catch {
            data = { body: rawText };
          }
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log("[SW] push parse error:", e);
      data = null;
    }

    // eslint-disable-next-line no-console
    console.log("[SW] push received", {
      hasData: Boolean(event?.data),
      rawText,
      data,
    });

    const { title, body, url } = pickNotificationPayload(data);

    await self.registration.showNotification(title, {
      body,
      data: { url },
    });
  };

  event?.waitUntil(show());
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
        if ("focus" in client) {
          await client.focus();
          return;
        }
      }

      await self.clients.openWindow(url);
    })()
  );
});

// ==========================
// End of Version 2 — src/sw.ts
// ==========================
