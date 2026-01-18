import * as admin from "firebase-admin";

export async function sendToTokens(tokens: string[], title: string, body: string, url = "/") {
  if (!tokens.length) return { success: 0, failure: 0, invalid: [] as string[] };

  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: { url },
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
