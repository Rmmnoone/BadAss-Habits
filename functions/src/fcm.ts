// ==========================
// Version 5 — functions/src/fcm.ts
// - ✅ Data-only payload (SW always controls display)
// - Keeps webpush headers (urgency/TTL) + link
// - Returns invalid tokens list (same as before)
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

  urgency?: WebUrgency;
  ttlSeconds?: number;

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

  const headers: Record<string, string> = {
    Urgency: opts.urgency ?? "normal",
  };
  if (
    typeof opts.ttlSeconds === "number" &&
    Number.isFinite(opts.ttlSeconds) &&
    opts.ttlSeconds > 0
  ) {
    headers.TTL = String(Math.floor(opts.ttlSeconds));
  }

  // ✅ DATA-ONLY (must be strings)
  const data: Record<string, string> = {
    title: String(title ?? ""),
    body: String(body ?? ""),
    url: String(finalUrl ?? "/"),
    tag: String(opts.tag ?? ""),
    renotify: String(Boolean(opts.renotify ?? false)),
    requireInteraction: String(Boolean(opts.requireInteraction ?? false)),
  };

  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    data,
    webpush: {
      headers,
      fcmOptions: {
        link: finalUrl,
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
// End of Version 5 — functions/src/fcm.ts
// ==========================
