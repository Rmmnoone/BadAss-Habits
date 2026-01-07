// ==========================
// Version 1 — src/pages/HabitDetails.tsx
// - Habit Details page (Option A)
// - Allows backfilling check-ins for past days (NO future days shown)
// - Dates go back to habit createdAt (best-effort) with 7/30/90/All range options
// - Uses Firestore check-ins: users/{uid}/days/{dateKey}/habits/{habitId}
// ==========================
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Scene from "../components/Scene";
import { useAuth } from "../auth/AuthProvider";
import { useHabits } from "../hooks/useHabits";
import { db } from "../firebase/client";
import { clearCheckin, getDoneMapForRange, setCheckin } from "../firebase/checkins";
import { dateKeyFromDate, lastNDaysKeys } from "../utils/history";

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

type RangeChoice = 7 | 30 | 90 | "all";

function daysBetweenInclusive(fromKey: string, toKey: string) {
  // fromKey/toKey: YYYY-MM-DD
  const from = new Date(fromKey + "T12:00:00");
  const to = new Date(toKey + "T12:00:00");
  const ms = to.getTime() - from.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  return Math.max(0, days) + 1;
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
    // Best-effort: use habit.createdAt as the earliest day we show.
    const ts = (habit as any)?.createdAt;
    const d: Date | null =
      ts && typeof ts.toDate === "function" ? ts.toDate() : null;

    if (!d) return null;
    return dateKeyFromDate(d);
  }, [habit]);

  const todayKey = useMemo(() => dateKeyFromDate(new Date()), []);

  const [range, setRange] = useState<RangeChoice>(30);

  const dateKeysDesc = useMemo(() => {
    if (!minDateKey) {
      // fallback: behave like normal range (7/30/90)
      const n = range === "all" ? 90 : range;
      return lastNDaysKeys(n);
    }

    if (range === "all") {
      const n = daysBetweenInclusive(minDateKey, todayKey);
      // MVP safety cap to prevent crazy reads if someone keeps a habit for years.
      // If you want true "all", set CAP to something huge or remove it.
      const CAP = 730; // ~2 years
      const finalN = Math.min(n, CAP);
      return lastNDaysKeys(finalN).filter((k) => k >= minDateKey);
    }

    return lastNDaysKeys(range).filter((k) => k >= minDateKey);
  }, [range, minDateKey, todayKey]);

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

      if (dateKeysDesc.length === 0) {
        setDoneMap(new Map());
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const map = await getDoneMapForRange(db, uid, dateKeysDesc);
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
  }, [uid, habitId, dateKeysDesc]);

  async function onLogout() {
    await logout();
    nav("/login");
  }

  function isDone(dateKey: string) {
    const set = doneMap.get(dateKey);
    return Boolean(set && set.has(habitId!));
  }

  async function toggle(dateKey: string) {
    if (!uid || !habitId) return;
    if (togglingKey) return; // avoid double-click spam

    setTogglingKey(dateKey);

    // optimistic UI update
    setDoneMap((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(dateKey) ?? []);
      if (set.has(habitId)) set.delete(habitId);
      else set.add(habitId);
      next.set(dateKey, set);
      return next;
    });

    try {
      if (isDone(dateKey)) {
        // NOTE: isDone reads from current state, which we just updated optimistically.
        // So we invert the logic by checking again from the *previous* intent:
        // easiest: call Firestore based on what it was before optimistic update.
        // We'll compute it from the optimistic "after" state:
        // If after is done => we just marked it done => setCheckin.
        await setCheckin(db, uid, dateKey, habitId);
      } else {
        await clearCheckin(db, uid, dateKey, habitId);
      }
    } catch (e) {
      // revert by reloading the range (safest)
      try {
        const map = await getDoneMapForRange(db, uid, dateKeysDesc);
        setDoneMap(map);
      } catch {
        // keep whatever we had
      }
    } finally {
      setTogglingKey(null);
    }
  }

  // Fix the toggle logic bug: we used isDone() AFTER optimistic update.
  // We'll compute a stable "wasDone" per row at render time and pass it in.
  async function toggleWithWasDone(dateKey: string, wasDone: boolean) {
    if (!uid || !habitId) return;
    if (togglingKey) return;

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
      try {
        const map = await getDoneMapForRange(db, uid, dateKeysDesc);
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
    ? "Mark past days as done. Future days are locked."
    : "Loading habit…";

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
                <div className="mt-1 text-[11px] text-white/40">
                  Earliest day: {minDateKey}
                </div>
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

        {/* Range selector */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          {[7, 30, 90].map((n) => {
            const active = range === n;
            return (
              <button
                key={n}
                onClick={() => setRange(n as any)}
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

          {range === "all" ? (
            <div className="text-xs text-white/45">
              Note: MVP currently caps “All” at ~2 years to avoid heavy reads.
            </div>
          ) : null}
        </div>

        <DarkCard
          title="Backfill days"
          subtitle="Toggle a day as Done/Not done. Future days never appear here."
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

                return (
                  <div
                    key={k}
                    className="rounded-xl border border-white/14 bg-white/[0.07] p-4 backdrop-blur-2xl
                               shadow-[0_18px_55px_-50px_rgba(0,0,0,0.98)]
                               flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">{k}</div>
                      <div className="text-xs text-white/55">
                        {wasDone ? "Done ✅" : "Not done"}
                      </div>
                    </div>

                    <button
                      disabled={busy}
                      onClick={() => toggleWithWasDone(k, wasDone)}
                      className={`rounded-xl border px-4 py-2 text-sm font-semibold backdrop-blur-2xl transition
                        ${
                          wasDone
                            ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/14"
                            : "border-white/14 bg-white/[0.06] text-white/85 hover:bg-white/[0.10]"
                        } ${busy ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      {busy ? "Saving…" : wasDone ? "Mark not done" : "Mark done"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 text-[11px] text-white/45">
            Under the hood: each toggle writes/deletes{" "}
            <span className="text-white/70">users/{`{uid}`}/days/{`{dateKey}`}/habits/{`{habitId}`}</span>.
          </div>
        </DarkCard>
      </div>
    </Scene>
  );
}

// ==========================
// End of Version 1 — src/pages/HabitDetails.tsx
// ==========================
