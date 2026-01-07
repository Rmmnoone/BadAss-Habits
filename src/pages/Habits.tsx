// ==========================
// Version 8 — src/pages/Habits.tsx
// - Adds per-habit Reminder time (zero-cost setting only)
//   * Schedule modal: toggle Reminder + pick time (HH:MM)
//   * Saves into schedule/main + denormalizes into habit doc (reminders.*)
// - Improves habit list summary using denormalized schedule + reminders
// - Keeps Version 7 behavior intact
// ==========================
import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { db } from "../firebase/client";
import { archiveHabit, createHabit, renameHabit, unarchiveHabit } from "../firebase/habits";
import { useHabits } from "../hooks/useHabits";
import Scene from "../components/Scene";

import { setHabitSchedule, type HabitScheduleType, type HabitReminder } from "../firebase/schedules";
import { useHabitSchedule } from "../hooks/useHabitSchedule";

function initials(email?: string | null) {
  if (!email) return "U";
  const name = email.split("@")[0] || "user";
  const parts = name.split(/[._-]/g).filter(Boolean);
  const a = parts[0]?.[0] ?? "U";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

function GlassCard({
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

function weekdayLabel(n: number) {
  const map = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return map[n - 1] ?? "?";
}

function scheduleSummary(type: HabitScheduleType, days?: number[]) {
  if (type === "daily") return "Daily";
  const d = (days ?? []).slice().sort((a, b) => a - b).map(weekdayLabel);
  return d.length ? `Weekly: ${d.join(", ")}` : "Weekly: (pick days)";
}

function reminderSummary(reminders?: any) {
  if (!reminders?.enabled) return "Off";
  return reminders?.time ? `On • ${reminders.time}` : "On";
}

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
  initialReminderTime: string; // "HH:MM"
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
  const [remTime, setRemTime] = useState<string>(initialReminderTime || "09:00");

  React.useEffect(() => {
    if (!open) return;
    console.log("[ScheduleModal] open for:", habitName, {
      initialType,
      initialDays,
      initialReminderEnabled,
      initialReminderTime,
    });

    setType(initialType);
    setDays(initialDays);

    setRemEnabled(Boolean(initialReminderEnabled));
    setRemTime(initialReminderTime || "09:00");
  }, [open, habitName, initialType, initialDays, initialReminderEnabled, initialReminderTime]);

  const canSave = useMemo(() => {
    if (saving) return false;
    if (type === "weekly" && days.length === 0) return false;
    if (remEnabled && !remTime) return false;
    return true;
  }, [type, days, saving, remEnabled, remTime]);

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
                <button
                  type="button"
                  onClick={() => setType("daily")}
                  className={freqButtonClass(type === "daily")}
                >
                  {type === "daily" ? "✓ Daily" : "Daily"}
                </button>

                <button
                  type="button"
                  onClick={() => setType("weekly")}
                  className={freqButtonClass(type === "weekly")}
                >
                  {type === "weekly" ? "✓ Weekly" : "Weekly"}
                </button>
              </div>

              <div className="mt-2 text-xs text-white/45">Daily = every day. Weekly = choose days.</div>
            </div>

            {/* Days */}
            <div
              className={`rounded-xl border border-white/14 bg-white/[0.05] p-4 ${
                daysDisabled ? "opacity-75" : ""
              }`}
            >
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
                    Zero-cost setting. (Optional next step: local notifications in PWA.)
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setRemEnabled((x) => !x)}
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
                  onChange={(e) => setRemTime(e.target.value)}
                  className="w-full rounded-xl border border-white/14 bg-white/[0.08] px-4 py-3 text-sm text-white outline-none
                             placeholder:text-white/35
                             focus:border-white/22 focus:ring-4 focus:ring-white/10
                             disabled:cursor-not-allowed"
                />
                <div className="mt-2 text-xs text-white/45">
                  Stored as <span className="text-white/70">HH:MM</span> in your local time.
                </div>
              </div>
            </div>

            {/* Save */}
            <button
              type="button"
              disabled={!canSave}
              onClick={() => {
                console.log("[ScheduleModal] save clicked:", {
                  type,
                  daysOfWeek: days,
                  reminder: { enabled: remEnabled, time: remTime || "09:00" },
                });
                onSave({
                  type,
                  daysOfWeek: days,
                  reminder: { enabled: remEnabled, time: remTime || "09:00" },
                });
              }}
              className="w-full rounded-xl border border-white/14 bg-white/[0.10] px-4 py-3 text-sm font-semibold text-white
                         hover:bg-white/[0.14] disabled:opacity-50 disabled:hover:bg-white/[0.10]
                         shadow-[0_28px_80px_-60px_rgba(0,0,0,0.98)]"
            >
              {saving ? "Saving…" : "Save schedule"}
            </button>

            <div className="text-xs text-white/45 text-center">
              Next: show reminder pills on Dashboard + (optional) PWA local notifications.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Habits() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const uid = user?.uid ?? null;
  const { active, archived, loading } = useHabits(uid);

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [scheduleHabitId, setScheduleHabitId] = useState<string | null>(null);
  const [scheduleHabitName, setScheduleHabitName] = useState<string>("");
  const [savingSchedule, setSavingSchedule] = useState(false);

  const canCreate = useMemo(() => name.trim().length >= 2 && !saving, [name, saving]);

  const { schedule, loading: scheduleLoading } = useHabitSchedule(uid, scheduleHabitId);

  function openSchedule(habitId: string, habitName: string) {
    console.log("[Habits] openSchedule:", { habitId, habitName });
    setScheduleHabitId(habitId);
    setScheduleHabitName(habitName);
  }

  function closeSchedule() {
    console.log("[Habits] closeSchedule");
    setScheduleHabitId(null);
    setScheduleHabitName("");
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();

    if (!uid) return;

    setError(null);
    setSaving(true);
    try {
      await createHabit(db, uid, name.trim());
      setName("");
    } catch (err: any) {
      setError(`Could not create habit. ${err?.message ? `(${err.message})` : "Try again."}`);
    } finally {
      setSaving(false);
    }
  }

  async function onRename(habitId: string, currentName: string) {
    if (!uid) return;
    const next = window.prompt("Rename habit:", currentName);
    if (!next || next.trim().length < 2) return;
    await renameHabit(db, uid, habitId, next.trim());
  }

  async function onArchive(habitId: string) {
    if (!uid) return;
    await archiveHabit(db, uid, habitId);
  }

  async function onUnarchive(habitId: string) {
    if (!uid) return;
    await unarchiveHabit(db, uid, habitId);
  }

  async function onLogout() {
    await logout();
    nav("/login");
  }

  async function saveSchedule(next: { type: HabitScheduleType; daysOfWeek: number[]; reminder: HabitReminder }) {
    if (!uid || !scheduleHabitId) return;

    setSavingSchedule(true);
    try {
      await setHabitSchedule(db, uid, scheduleHabitId, next);
      closeSchedule();
    } finally {
      setSavingSchedule(false);
    }
  }

  return (
    <Scene className="min-h-screen relative overflow-hidden" contentClassName="relative p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-2xl border border-white/14
                         bg-gradient-to-b from-white/[0.14] to-white/[0.06]
                         backdrop-blur-2xl
                         flex items-center justify-center text-sm font-semibold text-white/92
                         shadow-[0_24px_70px_-55px_rgba(0,0,0,0.98)]"
              title={user?.email ?? "User"}
            >
              {initials(user?.email)}
            </div>

            <div>
              <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 text-[11px] text-white/80 backdrop-blur-2xl">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                BadAss Habits
              </div>

              <div className="text-sm font-semibold text-white">Habits</div>
              <div className="text-xs text-white/60">Manage your habits (create, rename, schedule, archive).</div>

              <div className="mt-1 text-[11px] text-white/40">
                debug: uid={uid ? uid.slice(0, 6) + "…" : "null"} • loading={String(loading)} • active={active.length}
              </div>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          <GlassCard
            title="Create habit"
            subtitle="Add a habit you want to track daily/weekly."
            right={
              <span className="inline-flex items-center rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 text-xs text-white/75 backdrop-blur-2xl">
                MVP
              </span>
            }
          >
            <form onSubmit={onCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-white/70 mb-2">Habit name</label>
                <input
                  className="w-full rounded-xl border border-white/14 bg-white/[0.08] px-4 py-3 text-sm text-white outline-none
                             placeholder:text-white/35
                             focus:border-white/22 focus:ring-4 focus:ring-white/10"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Gym, Reading, Meditation"
                />
                <div className="mt-2 text-xs text-white/45">Tip: keep it short. You can rename later.</div>
              </div>

              {error ? (
                <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={!canCreate}
                className="w-full rounded-xl border border-white/14 bg-white/[0.10] px-4 py-3 text-sm font-semibold text-white
                           hover:bg-white/[0.14] disabled:opacity-50 disabled:hover:bg-white/[0.10]
                           shadow-[0_28px_80px_-60px_rgba(0,0,0,0.98)]"
              >
                {saving ? "Creating…" : "Create habit"}
              </button>
            </form>
          </GlassCard>

          <GlassCard title="Your habits" subtitle="View, rename, schedule, or archive.">
            {loading ? (
              <div className="text-sm text-white/70">Loading…</div>
            ) : (
              <div className="space-y-3">
                {active.length === 0 ? (
                  <div className="text-sm text-white/65">No habits yet. Create your first one.</div>
                ) : (
                  active.map((h: any) => {
                    const sType: HabitScheduleType = h?.schedule?.type ?? "daily";
                    const sDays: number[] = h?.schedule?.daysOfWeek ?? [];
                    const sched = scheduleSummary(sType, sDays);
                    const rem = reminderSummary(h?.reminders);

                    return (
                      <div
                        key={h.id}
                        className="rounded-xl border border-white/14 bg-white/[0.07] p-4 backdrop-blur-2xl
                                   shadow-[0_22px_70px_-55px_rgba(0,0,0,0.98)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              to={`/habits/${h.id}`}
                              className="text-sm font-semibold text-white truncate hover:underline underline-offset-4"
                              title="Open habit details"
                            >
                              {h.name}
                            </Link>
                            <div className="mt-1 text-xs text-white/60">Active</div>

                            <div className="mt-2 text-xs text-white/45">
                              Schedule: <span className="text-white/70">{sched}</span>
                              <span className="mx-2 text-white/30">•</span>
                              Reminder: <span className="text-white/70">{rem}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Link
                              to={`/habits/${h.id}`}
                              className="rounded-lg border border-white/14 bg-white/[0.10] px-3 py-2 text-xs font-semibold text-white/90 hover:bg-white/[0.14]"
                            >
                              View
                            </Link>
                            <button
                              onClick={() => openSchedule(h.id, h.name)}
                              className="rounded-lg border border-white/14 bg-white/[0.08] px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/[0.12]"
                            >
                              Schedule
                            </button>
                            <button
                              onClick={() => onRename(h.id, h.name)}
                              className="rounded-lg border border-white/14 bg-white/[0.08] px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/[0.12]"
                            >
                              Rename
                            </button>
                            <button
                              onClick={() => onArchive(h.id)}
                              className="rounded-lg border border-white/14 bg-white/[0.08] px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/[0.12]"
                            >
                              Archive
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {archived.length > 0 ? (
                  <div className="pt-2">
                    <div className="text-xs font-semibold text-white/70 mb-2">Archived</div>
                    <div className="space-y-2">
                      {archived.map((h: any) => (
                        <div
                          key={h.id}
                          className="rounded-xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-2xl
                                     shadow-[0_18px_60px_-55px_rgba(0,0,0,0.98)]
                                     flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <Link
                              to={`/habits/${h.id}`}
                              className="text-sm font-semibold text-white/80 truncate hover:underline underline-offset-4"
                              title="Open habit details"
                            >
                              {h.name}
                            </Link>
                            <div className="text-xs text-white/50">Archived</div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Link
                              to={`/habits/${h.id}`}
                              className="rounded-lg border border-white/14 bg-white/[0.08] px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/[0.12]"
                            >
                              View
                            </Link>
                            <button
                              onClick={() => onUnarchive(h.id)}
                              className="rounded-lg border border-white/14 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/[0.10]"
                            >
                              Restore
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </GlassCard>
        </div>

        <div className="mt-6 text-center text-xs text-white/45">
          Tip: Use “View” to backfill past days. Future days are locked.
        </div>
      </div>

      {/* The modal reads initial reminder settings from schedule/main when possible.
          If not present yet, it falls back to safe defaults. */}
      <ScheduleModal
        open={Boolean(scheduleHabitId)}
        onClose={closeSchedule}
        habitName={scheduleHabitName || "Habit"}
        initialType={scheduleLoading ? "daily" : ((schedule as any)?.type ?? "daily")}
        initialDays={scheduleLoading ? [1, 2, 3, 4, 5] : ((schedule as any)?.daysOfWeek ?? [1, 2, 3, 4, 5])}
        initialReminderEnabled={
          scheduleLoading
            ? false
            : Boolean(((schedule as any)?.reminder?.enabled ?? (schedule as any)?.reminders?.enabled ?? false))
        }
        initialReminderTime={
          scheduleLoading
            ? "09:00"
            : String(((schedule as any)?.reminder?.time ?? (schedule as any)?.reminders?.time ?? "09:00"))
        }
        onSave={saveSchedule}
        saving={savingSchedule}
      />
    </Scene>
  );
}

// ==========================
// End of Version 8 — src/pages/Habits.tsx
// ==========================
