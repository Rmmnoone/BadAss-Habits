// ==========================
// Version 2 — src/pages/History.tsx
// - Phase 5: History & Streaks page
// - Range selector: 7 / 30 / 90
// - Shows overall completion + per-habit streaks
// - Shows per-day due vs done list
// - Reuses Scene + glass/dark card visual style
// - FIX: Clamps history to the user's registration day (no pre-account days)
//   * Uses Firebase Auth user.metadata.creationTime -> minDateKey (YYYY-MM-DD)
// ==========================
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Scene from "../components/Scene";
import { useAuth } from "../auth/AuthProvider";
import { useHabits } from "../hooks/useHabits";
import { useHistory } from "../hooks/useHistory";
import {
  computeHabitWindowStats,
  computeOverallWindowStats,
  weekdayMapForKeys,
  isDueOnWeekday,
} from "../utils/history";

function initials(email?: string | null) {
  if (!email) return "U";
  const name = email.split("@")[0] || "user";
  const parts = name.split(/[._-]/g).filter(Boolean);
  const a = parts[0]?.[0] ?? "U";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

/** YYYY-MM-DD in local time for a provided date */
function dateKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Best-effort user creation date key (local YYYY-MM-DD).
 * If metadata is missing (rare), returns null (no clamp).
 */
function userCreationDateKey(user: any): string | null {
  const ct: string | undefined = user?.metadata?.creationTime;
  if (!ct) return null;
  const d = new Date(ct);
  if (Number.isNaN(d.getTime())) return null;
  return dateKeyFromDate(d);
}

function DarkCard({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative group rounded-2xl">
      <div
        className="pointer-events-none absolute -inset-[1px] rounded-2xl opacity-70 blur
                   bg-[radial-gradient(1200px_circle_at_20%_0%,rgba(236,72,153,0.20),transparent_45%),radial-gradient(1200px_circle_at_90%_30%,rgba(99,102,241,0.20),transparent_45%),radial-gradient(1000px_circle_at_40%_110%,rgba(168,85,247,0.18),transparent_45%)]"
      />

      <div
        className="relative rounded-2xl border border-white/14
                   bg-gradient-to-b from-white/[0.10] to-white/[0.04]
                   backdrop-blur-2xl
                   shadow-[0_44px_110px_-70px_rgba(0,0,0,0.98)]
                   overflow-hidden"
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),transparent_35%,transparent_70%,rgba(0,0,0,0.22))]" />
          <div className="absolute -top-24 -left-24 h-56 w-56 rounded-full bg-white/12 blur-2xl" />
          <div className="absolute -bottom-28 -right-28 h-64 w-64 rounded-full bg-black/30 blur-2xl" />
        </div>

        <div className="relative p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-semibold tracking-tight text-white">
                {title}
              </h2>
              {subtitle ? <p className="mt-1 text-sm text-white/70">{subtitle}</p> : null}
            </div>
            {right ? <div className="shrink-0">{right}</div> : null}
          </div>

          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

function pct(rate: number | null) {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}

export default function History() {
  const { user, logout } = useAuth();
  const uid = user?.uid ?? null;

  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);

  // Clamp history to "account creation day" so we don't show pre-registration days.
  const minDateKey = useMemo(() => userCreationDateKey(user), [user]);

  const { active: activeHabits, loading: habitsLoading } = useHabits(uid);

  // NOTE: useHistory.ts must be Version 2 with signature: (uid, days, minDateKey?)
  const { dateKeysDesc, doneMap, loading: historyLoading } = useHistory(uid, rangeDays, minDateKey);

  const weekdayByKey = useMemo(() => weekdayMapForKeys(dateKeysDesc), [dateKeysDesc]);

  const overall = useMemo(() => {
    if (!activeHabits?.length)
      return { dueCount: 0, doneCount: 0, completionRate: null as number | null };
    return computeOverallWindowStats({
      habits: activeHabits as any[],
      keysDesc: dateKeysDesc,
      weekdayByKey,
      doneMap,
    });
  }, [activeHabits, dateKeysDesc, weekdayByKey, doneMap]);

  const perHabitStats = useMemo(() => {
    if (!activeHabits?.length) return [];
    return (activeHabits as any[]).map((h) => {
      const stats = computeHabitWindowStats({
        habit: h,
        keysDesc: dateKeysDesc,
        weekdayByKey,
        doneMap,
      });
      return { habit: h, stats };
    });
  }, [activeHabits, dateKeysDesc, weekdayByKey, doneMap]);

  const perDayRows = useMemo(() => {
    if (!activeHabits?.length) return [];
    const habits = activeHabits as any[];

    return dateKeysDesc.map((k) => {
      const weekday = weekdayByKey.get(k) ?? 1;

      let due = 0;
      let done = 0;

      for (const h of habits) {
        if (!isDueOnWeekday(h, weekday)) continue;
        due++;
        const set = doneMap.get(k);
        if (set && set.has(h.id)) done++;
      }

      return { dateKey: k, due, done };
    });
  }, [activeHabits, dateKeysDesc, weekdayByKey, doneMap]);

  const loading = habitsLoading || historyLoading;

  return (
    <Scene className="min-h-screen relative overflow-hidden" contentClassName="relative p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-2xl border border-white/14
                         bg-gradient-to-b from-white/[0.14] to-white/[0.06]
                         backdrop-blur-2xl
                         flex items-center justify-center text-sm font-semibold text-white/92
                         shadow-[0_24px_70px_-55px_rgba(0,0,0,0.98)]"
            >
              {initials(user?.email)}
            </div>

            <div>
              <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 text-[11px] text-white/80 backdrop-blur-2xl">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                BadAss Habits
              </div>

              <div className="text-sm font-semibold text-white">History</div>
              <div className="text-xs text-white/60">Track consistency and streaks over time.</div>

              {minDateKey ? (
                <div className="mt-1 text-[11px] text-white/40">
                  Showing data since <span className="text-white/65">{minDateKey}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="rounded-xl border border-white/14
                         bg-gradient-to-b from-white/[0.12] to-white/[0.05]
                         backdrop-blur-2xl px-4 py-2 text-sm font-semibold text-white/90
                         hover:from-white/[0.16] hover:to-white/[0.07] transition
                         shadow-[0_28px_80px_-60px_rgba(0,0,0,0.98)]"
            >
              Dashboard
            </Link>

            <Link
              to="/habits"
              className="rounded-xl border border-white/14
                         bg-gradient-to-b from-white/[0.12] to-white/[0.05]
                         backdrop-blur-2xl px-4 py-2 text-sm font-semibold text-white/90
                         hover:from-white/[0.16] hover:to-white/[0.07] transition
                         shadow-[0_28px_80px_-60px_rgba(0,0,0,0.98)]"
            >
              Habits
            </Link>

            <button
              onClick={logout}
              className="rounded-xl border border-white/14
                         bg-gradient-to-b from-white/[0.12] to-white/[0.05]
                         backdrop-blur-2xl px-4 py-2 text-sm font-semibold text-white/90
                         hover:from-white/[0.16] hover:to-white/[0.07] transition
                         shadow-[0_28px_80px_-60px_rgba(0,0,0,0.98)]"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Range selector */}
        <div className="mb-4 flex items-center gap-2">
          {[7, 30, 90].map((n) => {
            const active = rangeDays === n;
            return (
              <button
                key={n}
                onClick={() => setRangeDays(n as any)}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold backdrop-blur-2xl transition
                  ${
                    active
                      ? "border-white/30 bg-gradient-to-b from-white/[0.22] to-white/[0.10] text-white ring-2 ring-white/35 shadow-[0_18px_55px_-35px_rgba(255,255,255,0.35)]"
                      : "border-white/14 bg-white/[0.05] text-white/70 hover:bg-white/[0.10] hover:text-white/85"
                  }`}
              >
                {active ? `✓ Last ${n} days` : `Last ${n} days`}
              </button>
            );
          })}
        </div>

        {/* Top grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          <div className="lg:col-span-1">
            <DarkCard title="Overall" subtitle={`Across all active habits • ${rangeDays} days`}>
              {loading ? (
                <div className="text-sm text-white/70">Loading…</div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Due", value: String(overall.dueCount) },
                    { label: "Done", value: String(overall.doneCount) },
                    { label: "Rate", value: pct(overall.completionRate) },
                    { label: "Habits", value: String(activeHabits.length) },
                  ].map((x) => (
                    <div
                      key={x.label}
                      className="rounded-xl border border-white/14 bg-white/[0.07] p-4 backdrop-blur-2xl
                                 shadow-[0_20px_60px_-50px_rgba(0,0,0,0.98)]"
                    >
                      <div className="text-xs text-white/60">{x.label}</div>
                      <div className="mt-1 text-2xl font-semibold text-white">{x.value}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 text-[11px] text-white/45">
                Streaks count only <span className="text-white/70">due</span> days (weekly schedules
                included).
              </div>
            </DarkCard>
          </div>

          <div className="lg:col-span-2">
            <DarkCard title="Per-habit streaks" subtitle="Current streak + best streak (within window)">
              {loading ? (
                <div className="text-sm text-white/70">Loading…</div>
              ) : perHabitStats.length === 0 ? (
                <div className="text-sm text-white/70">No active habits yet.</div>
              ) : (
                <div className="space-y-2">
                  {perHabitStats.map(({ habit, stats }) => (
                    <div
                      key={habit.id}
                      className="rounded-xl border border-white/14 bg-white/[0.07] p-4 backdrop-blur-2xl
                                 shadow-[0_20px_60px_-50px_rgba(0,0,0,0.98)]
                                 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{habit.name}</div>
                        <div className="mt-1 text-xs text-white/55">
                          Rate: <span className="text-white/75">{pct(stats.completionRate)}</span>{" "}
                          • Due: <span className="text-white/75">{stats.dueCount}</span> • Done:{" "}
                          <span className="text-white/75">{stats.doneCount}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="rounded-xl border border-white/14 bg-white/[0.06] px-3 py-2 text-xs text-white/80">
                          Current:{" "}
                          <span className="text-white font-semibold">{stats.currentStreak}</span>
                        </div>
                        <div className="rounded-xl border border-white/14 bg-white/[0.06] px-3 py-2 text-xs text-white/80">
                          Best: <span className="text-white font-semibold">{stats.bestStreak}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DarkCard>
          </div>
        </div>

        {/* Daily rows */}
        <div className="mt-4 sm:mt-5">
          <DarkCard title="Daily breakdown" subtitle="Due vs done per day (newest first)">
            {loading ? (
              <div className="text-sm text-white/70">Loading…</div>
            ) : (
              <div className="space-y-2">
                {perDayRows.map((r) => (
                  <div
                    key={r.dateKey}
                    className="rounded-xl border border-white/14 bg-white/[0.07] p-4 backdrop-blur-2xl
                               shadow-[0_18px_55px_-50px_rgba(0,0,0,0.98)]
                               flex items-center justify-between gap-3"
                  >
                    <div className="text-sm font-semibold text-white">{r.dateKey}</div>
                    <div className="text-xs text-white/70">
                      Done <span className="text-white font-semibold">{r.done}</span> /{" "}
                      <span className="text-white font-semibold">{r.due}</span>{" "}
                      {r.due === 0 ? "" : `(${Math.round((r.done / r.due) * 100)}%)`}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 text-[11px] text-white/45">
              MVP note: Reads 1 Firestore subcollection per day in the window (7/30/90).
            </div>
          </DarkCard>
        </div>

        <div className="mt-6 text-center text-xs text-white/45">
          Tip: Notifications come after Phase 5 (PWA install + reminders).
        </div>
      </div>
    </Scene>
  );
}

// ==========================
// End of Version 2 — src/pages/History.tsx
// ==========================
