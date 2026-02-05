// ==========================
// Version 3 — src/firebase/admin.ts
// - Client wrappers for admin callable functions
// - Uses shared exported `functions` from src/firebase/client.ts
// - Region: europe-west2
// - Removes bootstrap (adminBootstrapSelf) since it was deleted server-side
// - Adds:
//   * adminWhoAmI()   -> verify current user's claims
//   * adminSetAdmin() -> grant/revoke admin to a target uid (admin-only)
// ==========================

import { httpsCallable } from "firebase/functions";
import { functions } from "./client";

export type AdminUserRow = {
  uid: string;
  email: string | null;
  createdAt?: string | null;
  lastSignInTime?: string | null;
  disabled?: boolean;
};

export type AdminUserSummary = {
  uid: string;
  habitsCount: number;
  pushTokensCount: number;
  reminderLogsCount: number;
  latestReminderSentAt: string | null;
};

export type AdminReminderLogRow = {
  uid: string;
  logId: string;
  type?: string;
  dateKey?: string;
  atHM?: string;
  tz?: string;
  sentAt?: string | null;
  habitId?: string;
  habitName?: string;
  success?: number;
  failure?: number;
};

export async function adminListUsers(limit = 25, pageToken?: string | null) {
  const fn = httpsCallable(functions, "adminListUsers");
  const res = await fn({ limit, pageToken: pageToken ?? null });
  return res.data as { users: AdminUserRow[]; nextPageToken: string | null };
}

export async function adminUserSummary(uid: string) {
  const fn = httpsCallable(functions, "adminUserSummary");
  const res = await fn({ uid });
  return res.data as AdminUserSummary;
}

export async function adminReminderLogs(params: { uid?: string; limit?: number }) {
  const fn = httpsCallable(functions, "adminReminderLogs");
  const res = await fn({ uid: params.uid ?? null, limit: params.limit ?? 50 });
  return res.data as { logs: AdminReminderLogRow[] };
}

export async function adminWhoAmI() {
  const fn = httpsCallable(functions, "adminWhoAmI");
  const res = await fn({});
  return res.data as { uid: string; claims: Record<string, any> };
}

export async function adminSetAdmin(params: { uid: string; admin: boolean }) {
  const fn = httpsCallable(functions, "adminSetAdmin");
  const res = await fn({ uid: params.uid, admin: params.admin });
  return res.data as { ok: boolean };
}

// ==========================
// End of Version 3 — src/firebase/admin.ts
// ==========================
