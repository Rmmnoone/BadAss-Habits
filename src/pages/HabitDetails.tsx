// ==========================
// Version 6 — src/pages/HabitDetails.tsx
// - v5 + Schedule & Reminder management inside HabitDetails (command center)
//   * Reuses ScheduleModal UI (embedded in this file)
//   * Reads schedule via useHabitSchedule(uid, habitId) (canonical subdoc)
//   * Saves via setHabitSchedule(db, uid, habitId, ...)
//   * Shows current schedule/reminder summary + Edit button
// - Keeps shared eligibility logic from utils/eligibility (no duplication)
// - UI style matches existing glass/dark cards
// ==========================

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Scene from "../components/Scene";
import { useAuth } from "../auth/AuthProvider";
import { useHabits } from "../hooks/useHabits";
import { useHabitSchedule } from "../hooks/useHabitSchedule";
import { db } from "../firebase/client";
import { clearCheckin, getDoneMapForRange, setCheckin } from "../firebase/checkins";
import { setHabitSchedule, type HabitScheduleType, type HabitReminder } from "../firebase/schedules";
import { dateKeyFromDate, lastNDaysKeys, weekday1to7 } from "../utils/dateKey";
import { getDayEligibility } from "../utils/eligibility";

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

  const firstWeekday = weekday1to7(first);
  const leadingBlanks = firstWeekday - 1;

  const days: { date: Date; dayNum: number; dateKey: string }[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i, 12, 0, 0);
    days.push({ date: d, dayNum: i, dateKey: dateKeyFromDate(d) });
  }

  return { label: monthName(first), leadingBlanks, days };
}

// ===== Schedule helpers (local) =====
function weekdayLabel(n: number) {
  const map = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return map[n - 1] ?? "?";
}

function scheduleSummary(type: HabitScheduleType, days?: number[]) {
  if (type === "daily") return "Daily";
  const d = (days ?? []).slice().sort((a, b) => a - b).map(weekdayLabel);
  return d.length ? `Weekly: ${d.join(", ")}` : "Weekly: (pick days)";
}

function isValidHHMM(s: any): boolean {
  if (typeof s !== "string") return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(s);
}

function safeHHMM(s: any, fallback = "09:00"): string {
  const v = typeof s === "string" ? s : "";
  return isValidHHMM(v) ? v : fallback;
}

function reminderPill(reminders?: any) {
  const enabled = Boolean(reminders?.enabled);
  const time = typeof reminders?.time === "string" ? reminders.time : "";

  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/55">
        <span aria-hidden>⏰</span> Off
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/18 bg-white/[0.07] px-2.5 py-1 text-[11px] text-white/80">
      <span aria-hidden>⏰</span> {time || "On"}
    </span>
  );
}

// ===== ScheduleModal (reused UI, embedded) =====
function ScheduleModal({
  open,
  onClose,
  habitName,
  initialType,
  initialDays,
  initialReminderEnabled,
  initialReminderTime,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  habitName: string;
  initialType: HabitScheduleType;
  initialDays: number[];
  initialReminderEnabled: boolean;
  initialReminderTime: string; // "HH:mm"
  onSave: (next: {
    type: HabitScheduleType;
    daysOfWeek: number[];
    reminder: HabitReminder;
  }) => Promise<void>;
  saving: boolean;
}) {
  const [type, setType] = useState<HabitScheduleType>(initialType);
  const [days, setDays] = useState<number[]>(initialDays);

  const [remEnabled, setRemEnabled] = useState<boolean>(initialReminderEnabled);

  // time input can emit partial values in some browsers; keep lastValidTime to recover on blur
  const [remTime, setRemTime] = useState<string>(safeHHMM(initialReminderTime, "09:00"));
  const [lastValidTime, setLastValidTime] = useState<string>(safeHHMM(initialReminderTime, "09:00"));

  React.useEffect(() => {
    if (!open) return;

    setType(initialType);
    setDays(initialDays);

    const seed = safeHHMM(initialReminderTime, "09:00");
    setRemEnabled(Boolean(initialReminderEnabled));
    setRemTime(seed);
    setLastValidTime(seed);
  }, [open, habitName, initialType, initialDays, initialReminderEnabled, initialReminderTime]);

  const reminderInvalid = useMemo(() => {
    if (!remEnabled) return false;
    return !isValidHHMM(remTime);
  }, [remEnabled, remTime]);

  const canSave = useMemo(() => {
    if (saving) return false;
    if (type === "weekly" && days.length === 0) return false;
    if (remEnabled && reminderInvalid) return false;
    return true;
  }, [type, days, saving, remEnabled, reminderInvalid]);

  function toggleDay(n: number) {
    setDays((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }

  if (!open) return null;

  function freqButtonClass(active: boolean) {
    return `rounded-xl border px-4 py-2 text-sm font-semibold backdrop-blur-2xl transition
      ${
        active
          ? "border-white/30 bg-gradient-to-b from-white/[0.22] to-white/[0.10] text-white ring-2 ring-white/35 shadow-[0_18px_55px_-35px_rgba(255,255,255,0.35)] scale-[1.02]"
          : "border-white/14 bg-white/[0.05] text-white/70 hover:bg-white/[0.10] hover:text-white/85"
      }`;
  }

  function dayChipClass(active: boolean, disabled: boolean) {
    if (disabled) {
      return `rounded-full border px-3 py-1.5 text-xs font-semibold transition
        border-white/10 bg-white/[0.03] text-white/35 cursor-not-allowed`;
    }

    return `rounded-full border px-3 py-1.5 text-xs font-semibold transition
      ${
        active
          ? "border-white/30 bg-gradient-to-b from-white/[0.22] to-white/[0.10] text-white ring-2 ring-white/30 shadow-[0_18px_55px_-40px_rgba(255,255,255,0.28)]"
          : "border-white/12 bg-white/[0.04] text-white/65 hover:bg-white/[0.10] hover:text-white/85"
      }`;
  }

  const daysDisabled = type === "daily";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />

      <div className="relative w-full max-w-lg rounded-2xl border border-white/14 bg-white/[0.08] backdrop-blur-2xl shadow-[0_44px_110px_-70px_rgba(0,0,0,0.98)] overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),transparent_40%,rgba(0,0,0,0.25))]" />
        </div>

        <div className="relative p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Schedule</div>
              <div className="mt-1 text-xs text-white/60">
                {habitName} • {scheduleSummary(type, days)} • ⏰ {remEnabled ? remTime : "Off"}
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-white/14 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/[0.10]"
            >
              Close
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {/* Frequency */}
            <div className="rounded-xl border border-white/14 bg-white/[0.05] p-4">
              <div className="text-xs font-semibold text-white/75 mb-3">Frequency</div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setType("daily")} className={freqButtonClass(type === "daily")}>
                  {type === "daily" ? "✓ Daily" : "Daily"}
                </button>

                <button type="button" onClick={() => setType("weekly")} className={freqButtonClass(type === "weekly")}>
                  {type === "weekly" ? "✓ Weekly" : "Weekly"}
                </button>
              </div>

              <div className="mt-2 text-xs text-white/45">Daily = every day. Weekly = choose days.</div>
            </div>

            {/* Days */}
            <div className={`rounded-xl border border-white/14 bg-white/[0.05] p-4 ${daysDisabled ? "opacity-75" : ""}`}>
              <div className="text-xs font-semibold text-white/75 mb-3">Days of week</div>

              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => {
                  const activeDay = days.includes(n);
                  const label = weekdayLabel(n);

                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={daysDisabled}
                      onClick={() => toggleDay(n)}
                      className={dayChipClass(activeDay, daysDisabled)}
                      title={daysDisabled ? "Switch to Weekly to select days" : undefined}
                    >
                      {activeDay && !daysDisabled ? "✓ " : ""}
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 text-xs text-white/45">
                {type === "weekly" ? "Pick at least one day." : "Switch to Weekly to enable day selection."}
              </div>
            </div>

            {/* Reminder */}
            <div className="rounded-xl border border-white/14 bg-white/[0.05] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-white/75">Reminder</div>
                  <div className="mt-1 text-xs text-white/45">
                    If Push is enabled, we send <span className="text-white/70">Exact reminders</span> at this time (when due).
                    <span className="text-white/60"> • </span>
                    Daily digest runs at <span className="text-white/70">16:00</span> if you have ≥1 due habit.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setRemEnabled((x) => !x);
                    // if toggling ON while current value is invalid, restore last valid immediately
                    setRemTime((cur) => (isValidHHMM(cur) ? cur : lastValidTime || "09:00"));
                  }}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold backdrop-blur-2xl transition
                    ${
                      remEnabled
                        ? "border-white/30 bg-gradient-to-b from-white/[0.22] to-white/[0.10] text-white ring-2 ring-white/30"
                        : "border-white/14 bg-white/[0.05] text-white/70 hover:bg-white/[0.10] hover:text-white/85"
                    }`}
                >
                  {remEnabled ? "✓ On" : "Off"}
                </button>
              </div>

              <div className={`mt-3 ${remEnabled ? "" : "opacity-50"}`}>
                <label className="block text-xs font-medium text-white/70 mb-2">Time</label>
                <input
                  type="time"
                  disabled={!remEnabled}
                  value={remTime}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRemTime(v);
                    if (isValidHHMM(v)) setLastValidTime(v);
                  }}
                  onBlur={() => {
                    // Snap back to last valid if user leaves the field with an invalid partial value
                    if (!remEnabled) return;
                    if (!isValidHHMM(remTime)) setRemTime(lastValidTime || "09:00");
                  }}
                  className="w-full rounded-xl border border-white/14 bg-white/[0.08] px-4 py-3 text-sm text-white outline-none
                             placeholder:text-white/35
                             focus:border-white/22 focus:ring-4 focus:ring-white/10
                             disabled:cursor-not-allowed"
                />
                <div className="mt-2 text-xs text-white/45">
                  Stored as <span className="text-white/70">HH:mm</span> in your local time.
                </div>

                {remEnabled && reminderInvalid ? (
                  <div className="mt-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
                    Invalid time. Please choose a valid <span className="font-semibold">HH:mm</span> (e.g. 09:00).
                  </div>
                ) : null}
              </div>
            </div>

            {/* Save */}
            <button
              type="button"
              disabled={!canSave}
              onClick={() => {
                const safeTime = safeHHMM(remTime, lastValidTime || "09:00");
                onSave({
                  type,
                  daysOfWeek: days,
                  reminder: { enabled: remEnabled, time: safeTime },
                });
              }}
              className="w-full rounded-xl border border-white/14 bg-white/[0.10] px-4 py-3 text-sm font-semibold text-white
                         hover:bg-white/[0.14] disabled:opacity-50 disabled:hover:bg-white/[0.10]
                         shadow-[0_28px_80px_-60px_rgba(0,0,0,0.98)]"
            >
              {saving ? "Saving…" : "Save schedule"}
            </button>

            <div className="text-xs text-white/45 text-center">
              Tip: Weekly schedules affect which days count as <span className="text-white/70">due</span>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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

  const dateKeysDesc = useMemo(() => {
    if (!minDateKey) {
      const n = range === "all" ? 90 : range;
      return lastNDaysKeys(n);
    }

    if (range === "all") {
      const n = daysBetweenInclusive(minDateKey, todayKey);
      const CAP = 730;
      const finalN = Math.min(n, CAP);
      return lastNDaysKeys(finalN).filter((k) => k >= minDateKey);
    }

    return lastNDaysKeys(range).filter((k) => k >= minDateKey);
  }, [range, minDateKey, todayKey]);

  const month = useMemo(() => getCurrentMonthDays(), []);
  const monthKeys = useMemo(() => month.days.map((x) => x.dateKey), [month.days]);

  const keysToLoad = useMemo(() => {
    const set = new Set<string>();
    for (const k of dateKeysDesc) set.add(k);
    for (const k of monthKeys) set.add(k);
    return Array.from(set);
  }, [dateKeysDesc, monthKeys]);

  const [loading, setLoading] = useState(true);
  const [doneMap, setDoneMap] = useState<Map<string, Set<string>>>(new Map());
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  // Schedule modal state
  const [schedOpen, setSchedOpen] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);

  // canonical schedule read (subdoc)
  const { schedule, loading: scheduleLoading } = useHabitSchedule(uid, habitId || null);

  // Best-effort schedule values:
  // prefer canonical subdoc; fallback to denormalized habit doc (for safety)
  const effectiveType: HabitScheduleType = useMemo(() => {
    const t = (schedule as any)?.type ?? (habit as any)?.schedule?.type ?? "daily";
    return t === "weekly" ? "weekly" : "daily";
  }, [schedule, habit]);

  const effectiveDays: number[] = useMemo(() => {
    const days = (schedule as any)?.daysOfWeek ?? (habit as any)?.schedule?.daysOfWeek ?? [];
    return Array.isArray(days) ? days : [];
  }, [schedule, habit]);

  const effectiveReminderEnabled: boolean = useMemo(() => {
    const v =
      (schedule as any)?.reminder?.enabled ??
      (habit as any)?.reminders?.enabled ??
      false;
    return Boolean(v);
  }, [schedule, habit]);

  const effectiveReminderTime: string = useMemo(() => {
    const v =
      (schedule as any)?.reminder?.time ??
      (habit as any)?.reminders?.time ??
      "09:00";
    return safeHHMM(v, "09:00");
  }, [schedule, habit]);

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

  function dayStatus(dateKey: string) {
    if (!habit) {
      return { isActive: false, reason: "PRE_START" as const };
    }
    const e = getDayEligibility({ habit, dateKey, minDateKey });
    return e;
  }

  async function toggleWithWasDone(dateKey: string, wasDone: boolean) {
    if (!uid || !habitId) return;
    if (togglingKey) return;

    const e = dayStatus(dateKey);
    if (!e.isActive) return;

    setTogglingKey(dateKey);

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
        const map = await getDoneMapForRange(db, uid, keysToLoad);
        setDoneMap(map);
      } catch {
        // ignore
      }
    } finally {
      setTogglingKey(null);
    }
  }

  async function saveSchedule(next: { type: HabitScheduleType; daysOfWeek: number[]; reminder: HabitReminder }) {
    if (!uid || !habitId) return;

    setSavingSchedule(true);
    try {
      await setHabitSchedule(db, uid, habitId, next);
      setSchedOpen(false);
    } finally {
      setSavingSchedule(false);
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

        {/* NEW: Schedule & Reminder */}
        <div className="mb-4">
          <DarkCard
            title="Schedule & reminder"
            subtitle="Controls which days count as due, and when (optional) reminders fire."
            right={
              <button
                type="button"
                onClick={() => setSchedOpen(true)}
                className="rounded-xl border border-white/14 bg-white/[0.08] px-4 py-2 text-xs font-semibold text-white/85 hover:bg-white/[0.12] transition"
                disabled={habitsLoading || !habitId}
              >
                Edit
              </button>
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
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/70">
                  {scheduleLoading ? "Schedule: loading…" : `Schedule: ${scheduleSummary(effectiveType, effectiveDays)}`}
                </span>

                {effectiveType === "weekly" ? (
                  <span className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/55">
                    Due only on selected weekdays
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/55">
                    Due every day
                  </span>
                )}

                {reminderPill({ enabled: effectiveReminderEnabled, time: effectiveReminderTime })}

                <div className="w-full mt-2 text-[11px] text-white/45">
                  Note: Changing schedule affects <span className="text-white/70">History</span> rates/streaks because only “due” days count.
                </div>
              </div>
            )}
          </DarkCard>
        </div>

        {/* Month view */}
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
              <div className="grid grid-cols-7 gap-2 mb-2">
                {weekdayLabels.map((w) => (
                  <div key={w} className="text-[11px] font-semibold text-white/55 text-center">
                    {w}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: month.leadingBlanks }).map((_, idx) => (
                  <div
                    key={`blank-${idx}`}
                    className="h-11 rounded-xl border border-white/8 bg-white/[0.02]"
                  />
                ))}

                {month.days.map((cell) => {
                  const e = dayStatus(cell.dateKey);
                  const activeCell = e.isActive;
                  const checked = isDone(cell.dateKey);
                  const busy = togglingKey === cell.dateKey;

                  const base =
                    "h-11 rounded-xl border backdrop-blur-2xl transition flex items-center justify-center";
                  const style = !activeCell
                    ? "border-white/8 bg-white/[0.03] text-white/30 cursor-not-allowed"
                    : checked
                    ? "border-emerald-300/35 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/18"
                    : "border-white/14 bg-white/[0.06] text-white/85 hover:bg-white/[0.10]";

                  const title =
                    !activeCell
                      ? e.reason === "PRE_START"
                        ? "Before habit started"
                        : "Not scheduled on this day"
                      : cell.dateKey;

                  return (
                    <button
                      key={cell.dateKey}
                      type="button"
                      disabled={!activeCell || busy}
                      onClick={() => toggleWithWasDone(cell.dateKey, checked)}
                      className={`${base} ${style} ${busy ? "opacity-60 cursor-not-allowed" : ""}`}
                      title={title}
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

        {/* Descending list */}
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

                const e = dayStatus(k);
                const activeRow = e.isActive;
                const disabledRow = busy || !activeRow;

                const subtitleText = !activeRow
                  ? wasDone
                    ? "Not scheduled (was marked before)"
                    : e.reason === "PRE_START"
                    ? "Before habit started"
                    : "Not scheduled"
                  : wasDone
                  ? "Completed"
                  : "Not completed";

                const title =
                  !activeRow
                    ? e.reason === "PRE_START"
                      ? "Before habit started"
                      : "Not scheduled on this day"
                    : k;

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
                    title={title}
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

      {/* Schedule modal */}
      <ScheduleModal
        open={schedOpen}
        onClose={() => setSchedOpen(false)}
        habitName={headerTitle || "Habit"}
        initialType={effectiveType}
        initialDays={effectiveDays}
        initialReminderEnabled={effectiveReminderEnabled}
        initialReminderTime={effectiveReminderTime}
        onSave={saveSchedule}
        saving={savingSchedule}
      />
    </Scene>
  );
}

// ==========================
// End of Version 6 — src/pages/HabitDetails.tsx
// ==========================
