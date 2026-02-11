// ==========================
// Version 4 — src/pages/Admin.tsx
// - v3 + Mobile polish:
//   * Header buttons stack on mobile
//   * Raw claims collapsible (default hidden)
//   * User rows: compact on mobile (chips hidden on mobile)
//   * Inspect actions: Grant/Revoke side-by-side on mobile
//   * Mobile-friendly panel max heights
// ==========================

import React, { useEffect, useMemo, useState } from "react";
import {
  adminListUsers,
  adminReminderLogs,
  adminUserSummary,
  adminWhoAmI,
  adminSetAdmin,
  type AdminUserRow,
  type AdminReminderLogRow,
} from "../firebase/admin";
import { useAuth } from "../auth/AuthProvider";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-xl shadow-[0_30px_90px_-70px_rgba(0,0,0,0.95)]">
      {children}
    </div>
  );
}

export default function Admin() {
  const { refreshClaims } = useAuth();

  const [usersErr, setUsersErr] = useState<string | null>(null);

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);

  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);

  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logs, setLogs] = useState<AdminReminderLogRow[]>([]);

  // WhoAmI state
  const [whoLoading, setWhoLoading] = useState(false);
  const [who, setWho] = useState<{ uid: string; claims: Record<string, any> } | null>(null);
  const [whoMsg, setWhoMsg] = useState<string | null>(null);
  const [showRawClaims, setShowRawClaims] = useState(false);

  // Set admin state
  const [setAdminBusy, setSetAdminBusy] = useState(false);
  const [setAdminMsg, setSetAdminMsg] = useState<string | null>(null);

  const selected = useMemo(
    () => users.find((u) => u.uid === selectedUid) ?? null,
    [users, selectedUid]
  );

  async function loadUsers(initial = false) {
    setLoadingUsers(true);
    setUsersErr(null);
    try {
      const res = await adminListUsers(25, initial ? null : nextToken);
      setUsers((prev) => (initial ? res.users : [...prev, ...res.users]));
      setNextToken(res.nextPageToken ?? null);
    } catch (e: any) {
      setUsersErr(String(e?.message ?? e));
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadSummary(uid: string) {
    const s = await adminUserSummary(uid);
    setSummary(s);
  }

  async function loadLogs(uid?: string | null) {
    setLoadingLogs(true);
    try {
      const res = await adminReminderLogs({ uid: uid ?? undefined, limit: 80 });
      setLogs(res.logs ?? []);
    } finally {
      setLoadingLogs(false);
    }
  }

  async function runWhoAmI() {
    setWhoLoading(true);
    setWhoMsg(null);
    try {
      const res = await adminWhoAmI();
      setWho(res);
      setWhoMsg(null);
    } catch (e: any) {
      setWho(null);
      setWhoMsg(String(e?.message ?? e));
    } finally {
      setWhoLoading(false);
    }
  }

  async function toggleAdminForSelected(makeAdmin: boolean) {
    if (!selectedUid) return;

    setSetAdminBusy(true);
    setSetAdminMsg(null);
    try {
      await adminSetAdmin({ uid: selectedUid, admin: makeAdmin });

      setSetAdminMsg(
        makeAdmin
          ? "✅ Admin granted. The target user must refresh token (logout/login or refresh claims) to receive it."
          : "✅ Admin revoked. The target user must refresh token (logout/login or refresh claims) to lose it."
      );

      // If the selected user is you, refresh claims now so the UI stays consistent
      try {
        await refreshClaims();
      } catch {
        // ignore
      }
    } catch (e: any) {
      setSetAdminMsg(`❌ Failed: ${String(e?.message ?? e)}`);
    } finally {
      setSetAdminBusy(false);
    }
  }

  useEffect(() => {
    loadUsers(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedUid) {
      setSummary(null);
      setLogs([]);
      setSetAdminMsg(null);
      return;
    }
    loadSummary(selectedUid);
    loadLogs(selectedUid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUid]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#05061A] via-[#070625] to-[#040413] text-white">
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-2xl font-semibold tracking-tight">Admin</div>
            <div className="mt-1 text-sm text-white/60">Internal diagnostics • admin-only</div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
            <button
              onClick={() => runWhoAmI()}
              className="w-full sm:w-auto rounded-xl border border-white/12 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/[0.12] disabled:opacity-40"
              disabled={whoLoading}
              title="Server-side check of your token claims"
            >
              {whoLoading ? "Checking…" : "Who am I?"}
            </button>

            <button
              onClick={() => refreshClaims()}
              className="w-full sm:w-auto rounded-xl border border-white/12 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/[0.12]"
              title="Refresh ID token claims (use after granting/revoking admin)"
            >
              Refresh claims
            </button>
          </div>
        </div>

        {/* WhoAmI panel */}
        <div className="mt-4">
          <Card>
            <div className="p-5">
              <div className="text-sm font-semibold">Your admin status</div>
              <div className="mt-1 text-xs text-white/55">
                This is the server’s view of your ID token claims. If you just changed claims, click “Refresh claims” then “Who am I?” again.
              </div>

              <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                {whoMsg ? (
                  <div className="text-xs text-white/70 whitespace-pre-wrap">❌ {whoMsg}</div>
                ) : who ? (
                  <>
                    <div className="text-xs text-white/70">
                      uid: <span className="text-white/90 break-all">{who.uid}</span>
                    </div>

                    <div className="mt-1 text-xs text-white/70">
                      claims.admin:{" "}
                      <span
                        className={`font-semibold ${
                          who.claims?.admin === true ? "text-emerald-300" : "text-rose-300"
                        }`}
                      >
                        {String(who.claims?.admin === true)}
                      </span>
                    </div>

                    <div className="mt-3">
                      <button
                        onClick={() => setShowRawClaims((v) => !v)}
                        className="rounded-lg border border-white/12 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-white/80 hover:bg-white/[0.10]"
                      >
                        {showRawClaims ? "Hide raw claims" : "Show raw claims"}
                      </button>

                      {showRawClaims ? (
                        <div className="mt-2 text-[11px] text-white/45 break-all">
                          raw claims: {JSON.stringify(who.claims ?? {}, null, 0)}
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-white/70">Click “Who am I?” to load claims.</div>
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Users */}
          <Card>
            <div className="p-5 border-b border-white/10">
              <div className="text-sm font-semibold">Users</div>
              <div className="mt-1 text-xs text-white/55">Click a user to inspect.</div>

              {usersErr ? (
                <div className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 whitespace-pre-wrap">
                  ❌ {usersErr}
                </div>
              ) : null}
            </div>

            <div className="max-h-[60vh] sm:max-h-[520px] overflow-auto">
              {loadingUsers && users.length === 0 ? (
                <div className="p-5 text-sm text-white/70">Loading…</div>
              ) : users.length === 0 ? (
                <div className="p-5 text-sm text-white/70">No users found.</div>
              ) : (
                <ul className="divide-y divide-white/10">
                  {users.map((u) => {
                    const active = u.uid === selectedUid;

                    return (
                      <li key={u.uid}>
                        <button
                          onClick={() => setSelectedUid(u.uid)}
                          className={`w-full text-left px-4 sm:px-5 py-4 hover:bg-white/[0.06] ${
                            active ? "bg-white/[0.08]" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold">{u.email ?? "(no email)"}</div>
                              <div className="mt-1 truncate text-xs text-white/55">{u.uid}</div>

                              {/* Mobile compact meta */}
                              <div className="mt-2 space-y-1 sm:hidden">
                                <div className="text-[11px] text-white/55">created: {u.createdAt ?? "—"}</div>
                                <div className="text-[11px] text-white/55">last sign-in: {u.lastSignInTime ?? "—"}</div>
                              </div>
                            </div>

                            {u.disabled ? (
                              <span className="shrink-0 rounded-full border border-white/12 bg-white/[0.06] px-2 py-1 text-[11px] text-white/70">
                                disabled
                              </span>
                            ) : null}
                          </div>

                          {/* Desktop chips */}
                          <div className="mt-2 hidden sm:flex flex-wrap gap-2 text-[11px] text-white/55">
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">
                              created: {u.createdAt ?? "—"}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1">
                              last sign-in: {u.lastSignInTime ?? "—"}
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="p-5 border-t border-white/10 flex items-center justify-between">
              <div className="text-xs text-white/55">{users.length} loaded</div>
              <button
                disabled={loadingUsers || !nextToken}
                onClick={() => loadUsers(false)}
                className="rounded-xl border border-white/12 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white/90 hover:bg-white/[0.12] disabled:opacity-40"
              >
                Load more
              </button>
            </div>
          </Card>

          {/* Inspect */}
          <Card>
            <div className="p-5 border-b border-white/10">
              <div className="text-sm font-semibold">Inspect</div>
              <div className="mt-1 text-xs text-white/55">User summary + reminder logs</div>
            </div>

            <div className="p-5">
              {!selected ? (
                <div className="text-sm text-white/70">Select a user from the list above.</div>
              ) : (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{selected.email ?? "(no email)"}</div>
                      <div className="mt-1 text-xs text-white/55 break-all">{selected.uid}</div>
                    </div>

                    {/* Actions: side-by-side on mobile */}
                    <div className="flex w-full gap-2 sm:w-auto sm:flex-col sm:gap-2">
                      <button
                        onClick={() => toggleAdminForSelected(true)}
                        disabled={setAdminBusy}
                        className="w-1/2 sm:w-auto rounded-xl border border-white/12 bg-white/[0.10] px-3 py-2 text-xs font-semibold text-white/90 hover:bg-white/[0.14] disabled:opacity-40"
                        title="Grant admin claim to this uid"
                      >
                        Grant admin
                      </button>
                      <button
                        onClick={() => toggleAdminForSelected(false)}
                        disabled={setAdminBusy}
                        className="w-1/2 sm:w-auto rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/[0.10] disabled:opacity-40"
                        title="Revoke admin claim from this uid"
                      >
                        Revoke admin
                      </button>
                    </div>
                  </div>

                  {setAdminMsg ? (
                    <div className="mt-3 text-xs text-white/70 whitespace-pre-wrap">{setAdminMsg}</div>
                  ) : (
                    <div className="mt-3 text-[11px] text-white/45">
                      Note: claims changes require the target user to refresh their ID token (logout/login or refresh claims).
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                      <div className="text-[11px] text-white/55">Habits</div>
                      <div className="mt-1 text-lg font-semibold">{summary?.habitsCount ?? "—"}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                      <div className="text-[11px] text-white/55">Push tokens</div>
                      <div className="mt-1 text-lg font-semibold">{summary?.pushTokensCount ?? "—"}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                      <div className="text-[11px] text-white/55">Reminder logs</div>
                      <div className="mt-1 text-lg font-semibold">{summary?.reminderLogsCount ?? "—"}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                      <div className="text-[11px] text-white/55">Latest reminder</div>
                      <div className="mt-1 text-sm font-semibold">{summary?.latestReminderSentAt ?? "—"}</div>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between">
                    <div className="text-sm font-semibold">Latest logs</div>
                    <button
                      onClick={() => loadLogs(selected.uid)}
                      className="rounded-xl border border-white/12 bg-white/[0.08] px-3 py-1.5 text-xs font-semibold text-white/90 hover:bg-white/[0.12] disabled:opacity-40"
                      disabled={loadingLogs}
                    >
                      Refresh logs
                    </button>
                  </div>

                  <div className="mt-3 max-h-[40vh] sm:max-h-[320px] overflow-auto rounded-xl border border-white/10">
                    {loadingLogs ? (
                      <div className="p-4 text-sm text-white/70">Loading…</div>
                    ) : logs.length === 0 ? (
                      <div className="p-4 text-sm text-white/70">No logs.</div>
                    ) : (
                      <ul className="divide-y divide-white/10">
                        {logs.map((l) => (
                          <li key={l.logId} className="p-4">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-semibold">
                                {l.type ?? "—"} • {l.dateKey ?? "—"} {l.atHM ?? ""}
                              </div>
                              <div className="text-xs text-white/55">{l.tz ?? ""}</div>
                            </div>

                            <div className="mt-1 text-xs text-white/55">
                              sentAt: {l.sentAt ?? "—"} • success: {l.success ?? 0} • failure: {l.failure ?? 0}
                            </div>

                            {l.habitId ? (
                              <div className="mt-1 text-xs text-white/55">
                                habit: {l.habitName ?? "—"} ({l.habitId})
                              </div>
                            ) : null}

                            <div className="mt-1 text-[11px] text-white/45">{l.logId}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-white/10 p-5 text-xs text-white/55">
              Tip: Don’t add Firestore-wide admin read rules. Keep admin reads behind callable functions 😎
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ==========================
// End of Version 4 — src/pages/Admin.tsx
// ==========================
