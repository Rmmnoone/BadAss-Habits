// ==========================
// Version 10 — src/pages/Dashboard.tsx
// - Shows reminder pill in Today list
// - Schedules zero-cost reminders while app is open (Notification API)
//   * calls useReminderScheduler()
// ==========================
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import Scene from "../components/Scene";
import { db } from "../firebase/client";
import { clearCheckin, setCheckin, getDoneMapForRange } from "../firebase/checkins";
import { useToday } from "../hooks/useToday";
import { useHabits } from "../hooks/useHabits";
import { weekday1to7 } from "../utils/dateKey";
import { useReminderScheduler } from "../hooks/useReminderScheduler";

function initials(email?: string | null) {
  if (!email) return "U";
  const name = email.split("@")[0] || "user";
  const parts = name.split(/[._-]/g).filter(Boolean);
  const a = parts[0]?.[0] ?? "U";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
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

/** YYYY-MM-DD in local time for a provided date */
function dateKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function lastNDaysKeys(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    out.push(dateKeyFromDate(d));
  }
  return out; // [today, yesterday, ...]
}

/** Determine if habit is due on a given weekday (1=Mon..7=Sun) */
function isDueOnWeekday(h: any, weekday: number): boolean {
  const type = h?.schedule?.type ?? "daily";
  if (type === "daily") return true;
  const days: number[] = h?.schedule?.daysOfWeek ?? [];
  return days.includes(weekday);
}

function ReminderPill({ time }: { time: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/14 bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-white/75">
      <span className="opacity-80">⏰</span> {time}
    </span>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const uid = user?.uid ?? null;

  // Today list (already filters due today)
  const { dateKey, dueItems, items, loading } = useToday(uid);

  // We also need the full active habit docs (to read schedule for past-day due logic)
  const { active: activeHabits, loading: habitsLoading } = useHabits(uid);

  const [busyId, setBusyId] = useState<string | null>(null);

  // ===== MVP insights state =====
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [bestCurrentStreak, setBestCurrentStreak] = useState<number | null>(null);
  const [consistency7d, setConsistency7d] = useState<string>("—");
  // =============================

  // Enable zero-cost reminders while app is open
  useReminderScheduler({
    enabled: Boolean(uid),
    dateKey,
    dueItems,
  });

  // Existing simple stats (today snapshot)
  const stats = useMemo(() => {
    const activeHabitsCount = items.length;
    const dueCount = dueItems.length;
    const doneCount = dueItems.filter((x) => x.done).length;
    const todayConsistency = dueCount === 0 ? "—" : `${Math.round((doneCount / dueCount) * 100)}%`;
    return { activeHabitsCount, dueCount, doneCount, todayConsistency };
  }, [items, dueItems]);

  async function toggle(habitId: string, nextDone: boolean) {
    if (!uid) return;
    setBusyId(habitId);
    try {
      if (nextDone) await setCheckin(db, uid, dateKey, habitId);
      else await clearCheckin(db, uid, dateKey, habitId);
    } finally {
      setBusyId(null);
    }
  }

  // ===== Compute streak + 7d consistency =====
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!uid) {
        setBestCurrentStreak(null);
        setConsistency7d("—");
        return;
      }
      if (habitsLoading) return;

      if (!activeHabits || activeHabits.length === 0) {
        setBestCurrentStreak(0);
        setConsistency7d("—");
        return;
      }

      setInsightsLoading(true);

      try {
        const keys7 = lastNDaysKeys(7);
        const keys60 = lastNDaysKeys(60);

        const doneMap60 = await getDoneMapForRange(db, uid, keys60);
        const doneMap7 = new Map<string, Set<string>>();
        keys7.forEach((k) => doneMap7.set(k, doneMap60.get(k) ?? new Set()));

        if (cancelled) return;

        let due7 = 0;
        let done7 = 0;

        const weekdayByKey = new Map<string, number>();
        for (const k of keys7) {
          const d = new Date(k + "T12:00:00");
          weekdayByKey.set(k, weekday1to7(d));
        }

        for (const h of activeHabits as any[]) {
          for (const k of keys7) {
            const weekday = weekdayByKey.get(k)!;
            const due = isDueOnWeekday(h, weekday);
            if (!due) continue;
            due7++;
            const doneSet = doneMap7.get(k) ?? new Set<string>();
            if (doneSet.has(h.id)) done7++;
          }
        }

        const consistency = due7 === 0 ? "—" : `${Math.round((done7 / due7) * 100)}%`;
        setConsistency7d(consistency);

        let best = 0;

        const weekdayByKey60 = new Map<string, number>();
        for (const k of keys60) {
          const d = new Date(k + "T12:00:00");
          weekdayByKey60.set(k, weekday1to7(d));
        }

        for (const h of activeHabits as any[]) {
          let streak = 0;

          for (const k of keys60) {
            const weekday = weekdayByKey60.get(k)!;
            const due = isDueOnWeekday(h, weekday);

            if (!due) continue;

            const doneSet = doneMap60.get(k) ?? new Set<string>();
            const done = doneSet.has(h.id);

            if (done) streak++;
            else break;
          }

          if (streak > best) best = streak;
        }

        setBestCurrentStreak(best);
      } catch {
        if (!cancelled) {
          setBestCurrentStreak(null);
          setConsistency7d("—");
        }
      } finally {
        if (!cancelled) setInsightsLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [uid, habitsLoading, activeHabits]);
  // ===========================================

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

              <div className="text-sm font-semibold text-white">Dashboard</div>
              <div className="text-xs text-white/60">
                Signed in as <span className="font-medium text-white/80">{user?.email}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
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

            <Link
              to="/history"
              className="rounded-xl border border-white/14
               bg-gradient-to-b from-white/[0.12] to-white/[0.05]
               backdrop-blur-2xl px-4 py-2 text-sm font-semibold text-white/90
               hover:from-white/[0.16] hover:to-white/[0.07] transition
               shadow-[0_28px_80px_-60px_rgba(0,0,0,0.98)]"
            >
              History
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

        {/* Top grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          <div className="lg:col-span-2">
            <DarkCard
              title="Today"
              subtitle={`Due habits for ${dateKey}`}
              right={
                <span className="inline-flex items-center rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 text-xs text-white/75 backdrop-blur-2xl">
                  MVP
                </span>
              }
            >
              {loading ? (
                <div className="text-sm text-white/70">Loading…</div>
              ) : dueItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/16 bg-black/10 px-4 py-5">
                  <p className="text-sm text-white/70">No habits due today.</p>
                  <p className="mt-2 text-xs text-white/50">
                    If you haven’t set schedules yet, go to Habits → Schedule.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {dueItems.map((h) => {
                    const isBusy = busyId === h.id;
                    return (
                      <div
                        key={h.id}
                        className="rounded-xl border border-white/14 bg-white/[0.07] p-4 backdrop-blur-2xl
                                   shadow-[0_20px_60px_-50px_rgba(0,0,0,0.98)]
                                   flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-white truncate">{h.name}</div>
                            {h.reminderEnabled ? <ReminderPill time={h.reminderTime} /> : null}
                          </div>
                          <div className="mt-1 text-xs text-white/55">
                            {h.done ? "Done ✅" : "Not done yet"}
                          </div>
                        </div>

                        <button
                          disabled={isBusy}
                          onClick={() => toggle(h.id, !h.done)}
                          className={`rounded-xl border px-4 py-2 text-xs font-semibold transition
                            ${
                              h.done
                                ? "border-white/18 bg-white/[0.06] text-white/80 hover:bg-white/[0.10]"
                                : "border-white/22 bg-white/[0.12] text-white hover:bg-white/[0.16]"
                            }
                            disabled:opacity-50`}
                        >
                          {isBusy ? "Saving…" : h.done ? "Undo" : "Mark done"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 text-xs text-white/45">
                Tip: If you allow notifications, the app will nudge you at the reminder time while it’s open.
              </div>
            </DarkCard>
          </div>

          <div className="lg:col-span-1">
            <DarkCard title="Quick stats" subtitle="Snapshot (Today + last 7 days)">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Active habits", value: String(stats.activeHabitsCount) },
                  { label: "Due today", value: String(stats.dueCount) },
                  { label: "Today done", value: String(stats.doneCount) },
                  { label: "7d consistency", value: insightsLoading ? "…" : consistency7d },
                  { label: "Best streak", value: insightsLoading ? "…" : (bestCurrentStreak == null ? "—" : String(bestCurrentStreak)) },
                  { label: "Today rate", value: stats.todayConsistency },
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

              <div className="mt-3 text-[11px] text-white/45">
                Note: streaks are computed from the last 60 days (MVP).
              </div>
            </DarkCard>
          </div>
        </div>

        {/* Lower grid (keep placeholders) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mt-4 sm:mt-5">
          <DarkCard
            title="Insights"
            subtitle="Streaks, trends, and history will live here."
            right={
              <span className="inline-flex items-center rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 text-xs text-white/75 backdrop-blur-2xl">
                Analysis
              </span>
            }
          >
            <div className="rounded-xl border border-dashed border-white/16 bg-black/10 px-4 py-5">
              <p className="text-sm text-white/70">Next we’ll add:</p>
              <ul className="mt-3 space-y-2 text-sm text-white/70">
                <li className="flex gap-2">
                  <span className="text-white/50">•</span>
                  <span>Per-habit streak display inside Today list</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-white/50">•</span>
                  <span>History view (7/30 days)</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-white/50">•</span>
                  <span>Longest streak (true) + goals</span>
                </li>
              </ul>
            </div>
          </DarkCard>

          <DarkCard
            title="Next up"
            subtitle="Roadmap for the next build steps."
            right={
              <span className="inline-flex items-center rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 text-xs text-white/75 backdrop-blur-2xl">
                MVP
              </span>
            }
          >
            <div className="space-y-3">
              {[
                { title: "1) Habit CRUD", desc: "Create, edit, archive habits." },
                { title: "2) Schedules per habit", desc: "Daily/weekly + reminders." },
                { title: "3) Check-ins + streaks", desc: "Daily tracking + history + analysis." },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-white/14 bg-white/[0.07] p-4 backdrop-blur-2xl
                             shadow-[0_22px_70px_-55px_rgba(0,0,0,0.98)]"
                >
                  <div className="text-sm font-semibold text-white">{item.title}</div>
                  <div className="mt-1 text-sm text-white/60">{item.desc}</div>
                </div>
              ))}
            </div>
          </DarkCard>
        </div>

        <div className="mt-6 text-center text-xs text-white/45">
          Tip: Install the app on your phone for the best reminder experience.
        </div>
      </div>
    </Scene>
  );
}

// ==========================
// End of Version 10 — src/pages/Dashboard.tsx
// ==========================
