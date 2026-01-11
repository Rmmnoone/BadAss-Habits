// ==========================
// Version 4 — src/pages/HabitDetails.tsx
// - FIX: Bottom "Completions" list now respects schedule + pre-start rules
//   * Uses same isActiveDate() logic as month calendar
//   * Prevents toggling for inactive days (not scheduled / before start)
// - Adds hard guard inside toggleWithWasDone() to block writes for inactive dates
// - If an inactive day was previously marked done, it shows "Not scheduled (was marked before)"
// - Everything else unchanged
// ==========================
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Scene from "../components/Scene";
import { useAuth } from "../auth/AuthProvider";
import { useHabits } from "../hooks/useHabits";
import { db } from "../firebase/client";
import { clearCheckin, getDoneMapForRange, setCheckin } from "../firebase/checkins";
import { dateKeyFromDate, lastNDaysKeys, weekday1to7 } from "../utils/dateKey";

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
              <h2 className="text-base sm:text-lg font-semibold tracking-tight text-white">{title}</h2>
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

type RangeChoice = 7 | 30 | 90 | "all";

function daysBetweenInclusive(fromKey: string, toKey: string) {
  const from = new Date(fromKey + "T12:00:00");
  const to = new Date(toKey + "T12:00:00");
  const ms = to.getTime() - from.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  return Math.max(0, days) + 1;
}

function Checkbox({ checked, disabled }: { checked: boolean; disabled?: boolean }) {
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-lg border
        ${disabled ? "opacity-50" : ""}
        ${checked ? "border-emerald-300/35 bg-emerald-500/15" : "border-white/18 bg-white/[0.05]"}`}
      aria-hidden="true"
    >
      {checked ? <span className="text-emerald-200 text-sm">✓</span> : null}
    </span>
  );
}

function monthName(d: Date) {
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function getCurrentMonthDays() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11

  const first = new Date(year, month, 1, 12, 0, 0);
  const last = new Date(year, month + 1, 0, 12, 0, 0);
  const daysInMonth = last.getDate();

  // weekday1to7: 1=Mon..7=Sun
  const firstWeekday = weekday1to7(first);
  const leadingBlanks = firstWeekday - 1; // Mon => 0 blanks

  const days: { date: Date; dayNum: number; dateKey: string }[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i, 12, 0, 0);
    days.push({ date: d, dayNum: i, dateKey: dateKeyFromDate(d) });
  }

  return { label: monthName(first), leadingBlanks, days };
}

/** Create a Date for a YYYY-MM-DD key in a DST-safe way */
function dateFromKey(dateKey: string) {
  return new Date(dateKey + "T12:00:00");
}

export default function HabitDetails() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { habitId } = useParams<{ habitId: string }>();

  const uid = user?.uid ?? null;
  const { active, archived, loading: habitsLoading } = useHabits(uid);

  const habit = useMemo(() => {
    const all = [...active, ...archived] as any[];
    return all.find((h) => h.id === habitId) ?? null;
  }, [active, archived, habitId]);

  const minDateKey = useMemo(() => {
    const ts = (habit as any)?.createdAt;
    const d: Date | null = ts && typeof ts.toDate === "function" ? ts.toDate() : null;
    if (!d) return null;
    return dateKeyFromDate(d);
  }, [habit]);

  const todayKey = useMemo(() => dateKeyFromDate(new Date()), []);

  const [range, setRange] = useState<RangeChoice>(30);

  // Desc list (today, yesterday, ...)
  const dateKeysDesc = useMemo(() => {
    if (!minDateKey) {
      const n = range === "all" ? 90 : range;
      return lastNDaysKeys(n);
    }

    if (range === "all") {
      const n = daysBetweenInclusive(minDateKey, todayKey);
      const CAP = 730; // MVP safety cap (~2 years)
      const finalN = Math.min(n, CAP);
      return lastNDaysKeys(finalN).filter((k) => k >= minDateKey);
    }

    return lastNDaysKeys(range).filter((k) => k >= minDateKey);
  }, [range, minDateKey, todayKey]);

  // Current month calendar meta
  const month = useMemo(() => getCurrentMonthDays(), []);
  const monthKeys = useMemo(() => month.days.map((x) => x.dateKey), [month.days]);

  // Load checkins for BOTH (range + month) in one go
  const keysToLoad = useMemo(() => {
    const set = new Set<string>();
    for (const k of dateKeysDesc) set.add(k);
    for (const k of monthKeys) set.add(k);
    return Array.from(set);
  }, [dateKeysDesc, monthKeys]);

  const [loading, setLoading] = useState(true);
  const [doneMap, setDoneMap] = useState<Map<string, Set<string>>>(new Map());
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!uid || !habitId) {
        setDoneMap(new Map());
        setLoading(false);
        return;
      }

      if (keysToLoad.length === 0) {
        setDoneMap(new Map());
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const map = await getDoneMapForRange(db, uid, keysToLoad);
        if (!cancelled) setDoneMap(map);
      } catch {
        if (!cancelled) setDoneMap(new Map());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [uid, habitId, keysToLoad]);

  async function onLogout() {
    await logout();
    nav("/login");
  }

  function isDone(dateKey: string) {
    const set = doneMap.get(dateKey);
    return Boolean(set && habitId && set.has(habitId));
  }

  function isScheduledOnDate(d: Date): boolean {
    const type = (habit as any)?.schedule?.type ?? "daily";
    if (type === "daily") return true;

    const days: number[] = (habit as any)?.schedule?.daysOfWeek ?? [];
    const wd = weekday1to7(d); // 1..7
    return days.includes(wd);
  }

  function isActiveDate(dateKey: string, d: Date): boolean {
    // Disabled if before habit start
    if (minDateKey && dateKey < minDateKey) return false;

    // Disabled if weekly and not scheduled on that weekday
    if (!isScheduledOnDate(d)) return false;

    // Per your requirement: future dates ARE allowed (pre-check)
    return true;
  }

  function isActiveKey(dateKey: string): boolean {
    // If habit not loaded, treat as inactive (safe)
    if (!habit) return false;
    return isActiveDate(dateKey, dateFromKey(dateKey));
  }

  async function toggleWithWasDone(dateKey: string, wasDone: boolean) {
    if (!uid || !habitId) return;
    if (togglingKey) return;

    // HARD GUARD: never allow toggling on inactive days (unscheduled / pre-start)
    if (!isActiveKey(dateKey)) return;

    setTogglingKey(dateKey);

    // optimistic
    setDoneMap((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(dateKey) ?? []);
      if (wasDone) set.delete(habitId);
      else set.add(habitId);
      next.set(dateKey, set);
      return next;
    });

    try {
      if (wasDone) await clearCheckin(db, uid, dateKey, habitId);
      else await setCheckin(db, uid, dateKey, habitId);
    } catch {
      // revert by reloading (safest)
      try {
        const map = await getDoneMapForRange(db, uid, keysToLoad);
        setDoneMap(map);
      } catch {
        // ignore
      }
    } finally {
      setTogglingKey(null);
    }
  }

  const headerTitle = habit ? habit.name : "Habit";
  const headerSubtitle = habit
    ? "Use the month view to tick days (future allowed). The list below is descending."
    : "Loading habit…";

  const summary = useMemo(() => {
    if (!habitId) return { doneCount: 0, total: 0, rate: "—" };
    const total = dateKeysDesc.length;
    let doneCount = 0;
    for (const k of dateKeysDesc) if (isDone(k)) doneCount++;
    const rate = total === 0 ? "—" : `${Math.round((doneCount / total) * 100)}%`;
    return { doneCount, total, rate };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habitId, dateKeysDesc, doneMap]);

  const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

              <div className="text-sm font-semibold text-white">{headerTitle}</div>
              <div className="text-xs text-white/60">{headerSubtitle}</div>

              {minDateKey ? (
                <div className="mt-1 text-[11px] text-white/40">Earliest day: {minDateKey}</div>
              ) : null}
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
              to="/"
              className="rounded-xl border border-white/14
                         bg-gradient-to-b from-white/[0.12] to-white/[0.05]
                         backdrop-blur-2xl px-4 py-2 text-sm font-semibold text-white/90
                         hover:from-white/[0.16] hover:to-white/[0.07] transition
                         shadow-[0_28px_80px_-60px_rgba(0,0,0,0.98)]"
            >
              Dashboard
            </Link>

            <button
              onClick={onLogout}
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

        {/* Month view (CURRENT MONTH) */}
        <DarkCard
          title="This month"
          subtitle={`${month.label} • Tap active days to toggle (future allowed)`}
          right={
            <span className="inline-flex items-center rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 text-xs text-white/75 backdrop-blur-2xl">
              Calendar
            </span>
          }
        >
          {habitsLoading || !habitId ? (
            <div className="text-sm text-white/70">Loading…</div>
          ) : !habit ? (
            <div className="text-sm text-white/70">
              Habit not found.{" "}
              <Link to="/habits" className="underline underline-offset-4 text-white/80">
                Go back
              </Link>
              .
            </div>
          ) : loading ? (
            <div className="text-sm text-white/70">Loading month…</div>
          ) : (
            <div>
              {/* Weekday header */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {weekdayLabels.map((w) => (
                  <div key={w} className="text-[11px] font-semibold text-white/55 text-center">
                    {w}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: month.leadingBlanks }).map((_, idx) => (
                  <div
                    key={`blank-${idx}`}
                    className="h-11 rounded-xl border border-white/8 bg-white/[0.02]"
                  />
                ))}

                {month.days.map((cell) => {
                  const activeCell = isActiveDate(cell.dateKey, cell.date);
                  const checked = isDone(cell.dateKey);
                  const busy = togglingKey === cell.dateKey;

                  const base =
                    "h-11 rounded-xl border backdrop-blur-2xl transition flex items-center justify-center";
                  const style = !activeCell
                    ? "border-white/8 bg-white/[0.03] text-white/30 cursor-not-allowed"
                    : checked
                    ? "border-emerald-300/35 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/18"
                    : "border-white/14 bg-white/[0.06] text-white/85 hover:bg-white/[0.10]";

                  return (
                    <button
                      key={cell.dateKey}
                      type="button"
                      disabled={!activeCell || busy}
                      onClick={() => toggleWithWasDone(cell.dateKey, checked)}
                      className={`${base} ${style} ${busy ? "opacity-60 cursor-not-allowed" : ""}`}
                      title={
                        !activeCell
                          ? cell.dateKey < (minDateKey ?? "0000-00-00")
                            ? "Before habit started"
                            : "Not scheduled on this day"
                          : cell.dateKey
                      }
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{cell.dayNum}</span>
                        {checked ? <span className="text-[12px]">✓</span> : null}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-white/50">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400/60" /> Done
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-white/20" /> Active
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-white/8" /> Disabled (pre-start / not scheduled)
                </span>
              </div>
            </div>
          )}
        </DarkCard>

        {/* Range selector */}
        <div className="mt-4 mb-4 flex items-center gap-2 flex-wrap">
          {[7, 30, 90].map((n) => {
            const activeBtn = range === n;
            return (
              <button
                key={n}
                onClick={() => setRange(n as any)}
                className={`rounded-xl border px-4 py-2 text-sm font-semibold backdrop-blur-2xl transition
                  ${
                    activeBtn
                      ? "border-white/30 bg-gradient-to-b from-white/[0.22] to-white/[0.10] text-white ring-2 ring-white/35 shadow-[0_18px_55px_-35px_rgba(255,255,255,0.35)]"
                      : "border-white/14 bg-white/[0.05] text-white/70 hover:bg-white/[0.10] hover:text-white/85"
                  }`}
              >
                {activeBtn ? `✓ Last ${n} days` : `Last ${n} days`}
              </button>
            );
          })}

          <button
            onClick={() => setRange("all")}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold backdrop-blur-2xl transition
              ${
                range === "all"
                  ? "border-white/30 bg-gradient-to-b from-white/[0.22] to-white/[0.10] text-white ring-2 ring-white/35 shadow-[0_18px_55px_-35px_rgba(255,255,255,0.35)]"
                  : "border-white/14 bg-white/[0.05] text-white/70 hover:bg-white/[0.10] hover:text-white/85"
              }`}
          >
            {range === "all" ? "✓ All since created" : "All since created"}
          </button>

          <div className="ml-auto flex items-center gap-2">
            <div className="rounded-xl border border-white/14 bg-white/[0.06] px-3 py-2 text-xs text-white/70">
              Done: <span className="text-white/90 font-semibold">{summary.doneCount}</span> /{" "}
              <span className="text-white/80">{summary.total}</span>
              <span className="mx-2 text-white/30">•</span>
              Rate: <span className="text-white/90 font-semibold">{summary.rate}</span>
            </div>
          </div>

          {range === "all" ? (
            <div className="w-full text-xs text-white/45">
              Note: MVP currently caps “All” at ~2 years to avoid heavy reads.
            </div>
          ) : null}
        </div>

        {/* Descending list (FIXED) */}
        <DarkCard
          title="Completions"
          subtitle="Descending list (today, yesterday, …)"
          right={
            <span className="inline-flex items-center rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 text-xs text-white/75 backdrop-blur-2xl">
              MVP
            </span>
          }
        >
          {habitsLoading || !habitId ? (
            <div className="text-sm text-white/70">Loading…</div>
          ) : !habit ? (
            <div className="text-sm text-white/70">
              Habit not found.{" "}
              <Link to="/habits" className="underline underline-offset-4 text-white/80">
                Go back
              </Link>
              .
            </div>
          ) : loading ? (
            <div className="text-sm text-white/70">Loading days…</div>
          ) : dateKeysDesc.length === 0 ? (
            <div className="text-sm text-white/70">No days to show yet.</div>
          ) : (
            <div className="space-y-2">
              {dateKeysDesc.map((k) => {
                const wasDone = isDone(k);
                const busy = togglingKey === k;

                const activeRow = isActiveKey(k);
                const disabledRow = busy || !activeRow;

                const subtitleText = !activeRow
                  ? wasDone
                    ? "Not scheduled (was marked before)"
                    : "Not scheduled"
                  : wasDone
                  ? "Completed"
                  : "Not completed";

                return (
                  <button
                    key={k}
                    type="button"
                    disabled={disabledRow}
                    onClick={() => toggleWithWasDone(k, wasDone)}
                    className={`w-full text-left rounded-xl border p-4 backdrop-blur-2xl
                               shadow-[0_18px_55px_-50px_rgba(0,0,0,0.98)]
                               flex items-center justify-between gap-3 transition
                               ${
                                 disabledRow
                                   ? "border-white/10 bg-white/[0.04] opacity-55 cursor-not-allowed"
                                   : "border-white/14 bg-white/[0.06] hover:bg-white/[0.09]"
                               }`}
                    title={
                      !activeRow
                        ? k < (minDateKey ?? "0000-00-00")
                          ? "Before habit started"
                          : "Not scheduled on this day"
                        : k
                    }
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{k}</div>
                      <div className="text-xs text-white/55">{subtitleText}</div>
                    </div>

                    <div className="flex items-center gap-3">
                      {busy ? <div className="text-xs text-white/55">Saving…</div> : null}
                      <Checkbox checked={wasDone} disabled={disabledRow} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-3 text-[11px] text-white/45">
            Under the hood: each tap writes/deletes{" "}
            <span className="text-white/70">users/{`{uid}`}/days/{`{dateKey}`}/habits/{`{habitId}`}</span>.
          </div>
        </DarkCard>
      </div>
    </Scene>
  );
}

// ==========================
// End of Version 4 — src/pages/HabitDetails.tsx
// ==========================
