// ==========================
// Version 5 — src/pages/History.tsx
// - Phase 5.3: Heatmap visual overhaul to match the approved design (single month only)
// - Removes next-month preview entirely
// - Adds premium "glass + vignette + inner border" styling inside the Heatmap card
// - Strong neon glow for done/intense days (pink/fuchsia bloom)
// - Keeps BOTH modes:
//   * Overall: intensity by (done / due) across ALL active habits for that day
//   * Single habit: only that habit; non-due days are disabled
// - Still read-only (no toggling here)
// - Keeps existing cards: Overall + Per-habit streaks + Daily breakdown
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

type HeatMode = "overall" | "habit";

type Cell = {
  key: string; // YYYY-MM-DD
  weekday: number; // 1..7 (Mon..Sun)
  due: number; // overall: due count; habit: 1/0
  done: number; // overall: done count; habit: 1/0
  disabled: boolean; // due=0 or not-due (habit mode)
  intensity: 0 | 1 | 2 | 3 | 4; // visual bucket
  label: string; // tooltip
};

function intensityFromRate(rate: number): 0 | 1 | 2 | 3 | 4 {
  if (rate <= 0) return 0;
  if (rate <= 0.25) return 1;
  if (rate <= 0.5) return 2;
  if (rate <= 0.75) return 3;
  return 4;
}

function monthLabel(d: Date) {
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0);
}
function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** Convert JS getDay (0=Sun..6=Sat) to 1=Mon..7=Sun */
function weekday1to7FromJsDay(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}

/** Month calendar slots: 6 rows x 7 cols */
type CalSlot = {
  date: Date;
  inMonth: boolean;
  key: string; // YYYY-MM-DD
};

function buildMonthSlots(monthDate: Date): CalSlot[] {
  const m0 = startOfMonth(monthDate);
  const dim = daysInMonth(m0);

  const firstWeekday = weekday1to7FromJsDay(m0.getDay()); // 1..7
  const leading = firstWeekday - 1; // 0..6

  const slots: CalSlot[] = [];

  // leading days from previous month
  for (let i = leading; i > 0; i--) {
    const d = new Date(m0);
    d.setDate(1 - i);
    slots.push({ date: d, inMonth: false, key: dateKeyFromDate(d) });
  }

  // days in month
  for (let day = 1; day <= dim; day++) {
    const d = new Date(m0);
    d.setDate(day);
    slots.push({ date: d, inMonth: true, key: dateKeyFromDate(d) });
  }

  // trailing to complete 6x7 = 42 slots
  while (slots.length < 42) {
    const last = slots[slots.length - 1]!.date;
    const d = new Date(last);
    d.setDate(last.getDate() + 1);
    slots.push({ date: d, inMonth: false, key: dateKeyFromDate(d) });
  }

  return slots;
}

function HeatLegendNeon() {
  // Small dot legend like the design (not boxes)
  const dot = (cls: string) => (
    <span className={`h-2.5 w-2.5 rounded-full border border-white/12 ${cls}`} />
  );

  return (
    <div className="flex items-center gap-2 text-[11px] text-white/55">
      <span className="mr-1">Less</span>
      {dot("bg-white/[0.04]")}
      {dot("bg-fuchsia-500/10")}
      {dot("bg-fuchsia-500/20")}
      {dot("bg-fuchsia-500/35")}
      {dot("bg-fuchsia-500/55")}
      <span className="ml-1">More</span>
    </div>
  );
}

function HeatDot({
  cell,
  outOfMonth,
}: {
  cell: Cell | null; // null => no data in window
  outOfMonth?: boolean;
}) {
  // We always show the dot. "Disabled" affects opacity and glow only.
  const disabled = cell ? cell.disabled : true;
  const intensity = cell ? cell.intensity : (0 as 0);

  // Base circle size (bigger = closer to the mock)
  const base =
    "h-11 w-11 sm:h-12 sm:w-12 rounded-full border flex items-center justify-center select-none transition";

  // Fill buckets (kept in your neon theme)
  const fillByIntensity: Record<0 | 1 | 2 | 3 | 4, string> = {
    0: "bg-white/[0.035]",
    1: "bg-fuchsia-500/10",
    2: "bg-fuchsia-500/18",
    3: "bg-fuchsia-500/32",
    4: "bg-fuchsia-500/55",
  };

  // Strong glow for high intensity (match the design)
  const glowByIntensity: Record<0 | 1 | 2 | 3 | 4, string> = {
    0: "",
    1: "shadow-[0_0_18px_rgba(236,72,153,0.10)]",
    2: "shadow-[0_0_26px_rgba(236,72,153,0.20)]",
    3: "shadow-[0_0_40px_rgba(236,72,153,0.35)]",
    4: "shadow-[0_0_70px_rgba(236,72,153,0.70)]",
  };

  // Add a subtle ring for the brightest dots (makes it feel “alive”)
  const ringByIntensity: Record<0 | 1 | 2 | 3 | 4, string> = {
    0: "",
    1: "",
    2: "",
    3: "ring-1 ring-fuchsia-200/10",
    4: "ring-2 ring-fuchsia-200/18",
  };

  // Outer glow gradient overlay (only if not disabled)
  const innerSheen =
    !disabled && intensity >= 3
      ? "before:content-[''] before:absolute before:inset-0 before:rounded-full before:bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.28),transparent_55%)] before:opacity-60"
      : "";

  const border = disabled ? "border-white/10" : "border-white/14";
  const fill = fillByIntensity[intensity];
  const glow = glowByIntensity[intensity];
  const ring = ringByIntensity[intensity];

  // Visibility rules
  const opacity =
    (outOfMonth ? "opacity-45" : "opacity-100") +
    (disabled ? " opacity-45" : "");

  return (
    <div
      title={cell?.label ?? ""}
      className={`relative ${base} ${border} ${fill} ${glow} ${ring} ${opacity}
                  ${!disabled ? "hover:bg-fuchsia-500/45" : ""}`}
    >
      <div className={`absolute inset-0 rounded-full ${innerSheen}`} />
    </div>
  );
}

function MonthCalendar({
  monthDate,
  cellsByKey,
}: {
  monthDate: Date;
  cellsByKey: Map<string, Cell>;
}) {
  const slots = useMemo(() => buildMonthSlots(monthDate), [monthDate]);

  return (
    <div>
      {/* Month header (big like the mock) */}
      <div className="mb-4">
        <div className="text-2xl sm:text-3xl font-semibold tracking-tight text-white/90">
          {monthLabel(monthDate)}
        </div>
      </div>

      {/* Weekday row */}
      <div className="grid grid-cols-7 gap-2 sm:gap-3 mb-2">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((w) => (
          <div key={w} className="text-[12px] text-white/45 text-center">
            {w}
          </div>
        ))}
      </div>

      {/* Dots grid */}
      <div className="grid grid-cols-7 gap-2 sm:gap-3">
        {slots.map((s) => {
          const cell = cellsByKey.get(s.key) ?? null;

          // If the slot is outside month, still show it faded like the design
          const outOfMonth = !s.inMonth;

          const dayText =
            cell && !cell.disabled ? "text-white/92" : "text-white/45";

          return (
            <div key={s.key} className="flex items-center justify-center">
              <div className="relative">
                <HeatDot cell={cell} outOfMonth={outOfMonth} />
                <div
                  className={`pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold ${dayText}`}
                >
                  {s.date.getDate()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function History() {
  const { user, logout } = useAuth();
  const uid = user?.uid ?? null;

  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);

  // Heatmap controls
  const [heatMode, setHeatMode] = useState<HeatMode>("overall");
  const [selectedHabitId, setSelectedHabitId] = useState<string>("");

  // Clamp history to "account creation day" so we don't show pre-registration days.
  const minDateKey = useMemo(() => userCreationDateKey(user), [user]);

  const { active: activeHabits, loading: habitsLoading } = useHabits(uid);

  const { dateKeysDesc, doneMap, loading: historyLoading } = useHistory(uid, rangeDays, minDateKey);

  const weekdayByKey = useMemo(() => weekdayMapForKeys(dateKeysDesc), [dateKeysDesc]);

  // Ensure selectedHabitId always points to a real active habit when in habit mode
  React.useEffect(() => {
    if (heatMode !== "habit") return;
    if (!activeHabits?.length) return;

    const exists = (activeHabits as any[]).some((h) => h.id === selectedHabitId);
    if (!exists) setSelectedHabitId((activeHabits as any[])[0]?.id ?? "");
  }, [heatMode, activeHabits, selectedHabitId]);

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

  const heatCellsDesc: Cell[] = useMemo(() => {
    if (!dateKeysDesc.length) return [];

    const habits = (activeHabits as any[]) ?? [];

    function isDoneDayHabit(dateKey: string, habitId: string) {
      const set = doneMap.get(dateKey);
      return Boolean(set && set.has(habitId));
    }

    if (heatMode === "overall") {
      return dateKeysDesc.map((k) => {
        const weekday = weekdayByKey.get(k) ?? 1;

        let due = 0;
        let done = 0;

        for (const h of habits) {
          if (!isDueOnWeekday(h, weekday)) continue;
          due++;
          if (isDoneDayHabit(k, h.id)) done++;
        }

        const disabled = due === 0;
        const rate = due === 0 ? 0 : done / due;
        const intensity = disabled ? 0 : intensityFromRate(rate);

        const label = disabled
          ? `${k} • No habits due`
          : `${k} • Done ${done}/${due} (${Math.round(rate * 100)}%)`;

        return {
          key: k,
          weekday,
          due,
          done,
          disabled,
          intensity: disabled ? 0 : intensity,
          label,
        };
      });
    }

    const habit = habits.find((h) => h.id === selectedHabitId);
    return dateKeysDesc.map((k) => {
      const weekday = weekdayByKey.get(k) ?? 1;

      if (!habit) {
        return {
          key: k,
          weekday,
          due: 0,
          done: 0,
          disabled: true,
          intensity: 0,
          label: `${k} • Loading habit…`,
        };
      }

      const due = isDueOnWeekday(habit, weekday) ? 1 : 0;
      const done = due === 1 && isDoneDayHabit(k, habit.id) ? 1 : 0;
      const disabled = due === 0;

      // Habit mode: only “done” glows
      const intensity = disabled ? 0 : (done ? 4 : 0);

      const label = disabled ? `${k} • Not due` : `${k} • ${done ? "Completed" : "Not completed"}`;

      return {
        key: k,
        weekday,
        due,
        done,
        disabled,
        intensity: disabled ? 0 : intensity,
        label,
      };
    });
  }, [dateKeysDesc, activeHabits, doneMap, heatMode, selectedHabitId, weekdayByKey]);

  const heatCellsByKey = useMemo(() => {
    const map = new Map<string, Cell>();
    for (const c of heatCellsDesc) map.set(c.key, c);
    return map;
  }, [heatCellsDesc]);

  // Single month shown = month containing the most recent key in the window (usually today)
  const monthDate = useMemo(() => {
    const topKey = dateKeysDesc?.[0];
    if (!topKey) return startOfMonth(new Date());
    const d = new Date(topKey + "T12:00:00");
    return startOfMonth(d);
  }, [dateKeysDesc]);

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
        <div className="mb-4 flex items-center gap-2 flex-wrap">
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

        {/* Heatmap */}
        <div className="mb-4 sm:mb-5">
          <DarkCard
            title="Heatmap"
            subtitle="A quick visual of your consistency (read-only)"
            right={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHeatMode("overall")}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold backdrop-blur-2xl transition
                    ${
                      heatMode === "overall"
                        ? "border-white/30 bg-white/[0.10] text-white ring-2 ring-white/25"
                        : "border-white/14 bg-white/[0.05] text-white/70 hover:bg-white/[0.10] hover:text-white/85"
                    }`}
                >
                  Overall
                </button>
                <button
                  type="button"
                  onClick={() => setHeatMode("habit")}
                  className={`rounded-xl border px-3 py-2 text-xs font-semibold backdrop-blur-2xl transition
                    ${
                      heatMode === "habit"
                        ? "border-white/0 bg-white/[0.10] text-white ring-2 ring-white/25"
                        : "border-white/14 bg-white/[0.05] text-white/70 hover:bg-white/[0.10] hover:text-white/85"
                    }`}
                >
                  Single habit
                </button>
              </div>
            }
          >
            {/* Premium inner panel to match the mock */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20">
              {/* Vignette + neon haze */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_25%_10%,rgba(236,72,153,0.14),transparent_45%),radial-gradient(1100px_circle_at_80%_35%,rgba(99,102,241,0.12),transparent_45%),radial-gradient(900px_circle_at_50%_110%,rgba(168,85,247,0.10),transparent_50%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),transparent_25%,transparent_70%,rgba(0,0,0,0.45))]" />
                <div className="absolute inset-0 [box-shadow:inset_0_0_0_1px_rgba(255,255,255,0.06)] rounded-2xl" />
              </div>

              <div className="relative p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
                  {heatMode === "habit" ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-xs text-white/60">Habit:</div>
                      <select
                        value={selectedHabitId}
                        onChange={(e) => setSelectedHabitId(e.target.value)}
                        className="rounded-xl border border-white/14 bg-white/[0.08] px-3 py-2 text-xs text-white
                               outline-none focus:border-white/22 focus:ring-4 focus:ring-white/10"
                      >
                        {(activeHabits as any[]).map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name}
                          </option>
                        ))}
                      </select>
                      <div className="text-[11px] text-white/45">(Non-due days are dimmed)</div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="text-sm text-white/70">
                        Intensity is based on your <span className="text-white/85 font-semibold">done/due</span>{" "}
                        ratio each day.
                      </div>
                      <div className="text-xs text-white/45">Each circle = one day.</div>
                    </div>
                  )}

                  <HeatLegendNeon />
                </div>

                {loading ? (
                  <div className="text-sm text-white/70">Loading…</div>
                ) : heatCellsDesc.length === 0 ? (
                  <div className="text-sm text-white/70">No days to show.</div>
                ) : (
                  <>
                    <MonthCalendar monthDate={monthDate} cellsByKey={heatCellsByKey} />

                    <div className="mt-6 border-t border-white/10 pt-4 text-[11px] text-white/45">
                      Tip: Use <span className="text-white/70">Habit Details</span> to edit past/future days.
                      History is a read-only overview.
                    </div>
                  </>
                )}
              </div>
            </div>
          </DarkCard>
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
                Streaks count only <span className="text-white/70">due</span> days (weekly schedules included).
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
                          Rate: <span className="text-white/75">{pct(stats.completionRate)}</span> • Due:{" "}
                          <span className="text-white/75">{stats.dueCount}</span> • Done:{" "}
                          <span className="text-white/75">{stats.doneCount}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="rounded-xl border border-white/14 bg-white/[0.06] px-3 py-2 text-xs text-white/80">
                          Current: <span className="text-white font-semibold">{stats.currentStreak}</span>
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
// End of Version 5 — src/pages/History.tsx
// ==========================
