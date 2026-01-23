// ==========================
// Version 4 — functions/src/fcm.ts
// - Builds on Version 3 (NO breaking changes)
// - Adds optional webpush headers for better delivery semantics:
//   * urgency: "very-low" | "low" | "normal" | "high"
//   * ttlSeconds: number  (maps to webpush TTL header)
// - Adds optional notification actions (future UX polish)
// - Adds typed return (SendResult)
// - Keeps your real public icon filenames:
//   * icon:  /pwa-192.png
//   * badge: /pwa-192.png
// ==========================

import * as admin from "firebase-admin";

export type SendResult = {
  success: number;
  failure: number;
  invalid: string[];
};

type WebUrgency = "very-low" | "low" | "normal" | "high";

type SendOpts = {
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
  renotify?: boolean;
  icon?: string;
  badge?: string;

  // Web push delivery tuning (optional)
  urgency?: WebUrgency; // default: "normal"
  ttlSeconds?: number;  // if set, adds "TTL" header

  // Optional actions (supported by many browsers, ignored by others)
  actions?: Array<{ action: string; title: string; icon?: string }>;
};

export async function sendToTokens(
  tokens: string[],
  title: string,
  body: string,
  url = "/",
  opts: SendOpts = {}
): Promise<SendResult> {
  if (!tokens.length) return { success: 0, failure: 0, invalid: [] };

  const finalUrl = opts.url ?? url;

  const icon = opts.icon ?? "/pwa-192.png";
  const badge = opts.badge ?? "/pwa-192.png";

  const headers: Record<string, string> = {
    Urgency: opts.urgency ?? "normal",
  };
  if (typeof opts.ttlSeconds === "number" && Number.isFinite(opts.ttlSeconds) && opts.ttlSeconds > 0) {
    headers.TTL = String(Math.floor(opts.ttlSeconds));
  }

  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: { url: finalUrl },

    webpush: {
      headers,
      fcmOptions: {
        link: finalUrl,
      },
      notification: {
        title,
        body,
        icon,
        badge,
        tag: opts.tag,
        renotify: opts.renotify ?? false,
        requireInteraction: opts.requireInteraction ?? false,
        actions: opts.actions,
      },
    },
  });

  const invalid: string[] = [];
  res.responses.forEach((r, i) => {
    if (r.success) return;
    const code = (r.error as any)?.code as string | undefined;
    if (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token"
    ) {
      invalid.push(tokens[i]!);
    }
  });

  return { success: res.successCount, failure: res.failureCount, invalid };
}

// ==========================
// End of Version 4 — functions/src/fcm.ts
// ==========================
