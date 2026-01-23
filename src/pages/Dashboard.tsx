// ==========================
// Version 17 — src/pages/Dashboard.tsx
// - v16 + Reminder clarity on Dashboard (UI-only, NO logic changes):
//   * Replaces misleading “only works while app is open” copy (push is now live)
//   * Adds "Reminders" helper text: exact reminders + 16:00 digest rule
//   * Adds Next reminder (earliest HH:MM among due habits with reminders enabled)
//   * Improves Reminder pill: shows ⏰ Off optionally, keeps existing ⏰ time
//   * Updates placeholder Insights list to reflect current reality
// ==========================
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import Scene from "../components/Scene";
import { db } from "../firebase/client";
import { clearCheckin, setCheckin, getDoneMapForRange } from "../firebase/checkins";
import { useToday } from "../hooks/useToday";
import { useHabits } from "../hooks/useHabits";
import { lastNDaysKeys } from "../utils/dateKey";
import { isDueOnDateKey } from "../utils/eligibility";
import { useReminderScheduler } from "../hooks/useReminderScheduler";
import { enablePushForUser } from "../utils/push";

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

function ReminderPill({ time, off }: { time?: string; off?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/14 bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-white/75">
      <span className="opacity-80">⏰</span> {off ? "Off" : time}
    </span>
  );
}

function StreakPill({ n }: { n: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-white/14 bg-white/[0.06] px-2.5 py-1 text-[11px] font-semibold text-white/75"
      title="Current streak (due days only)"
    >
      <span className="opacity-80">🔥</span> {n}
    </span>
  );
}

function permissionLabel(p: NotificationPermission | "unsupported") {
  if (p === "granted") return "ON";
  if (p === "denied") return "BLOCKED";
  if (p === "default") return "OFF";
  return "UNSUPPORTED";
}

function permissionHelp(p: NotificationPermission | "unsupported") {
  if (p === "granted") return "Enabled. Push reminders can arrive even when the app is closed.";
  if (p === "default") return "Click to enable.";
  if (p === "denied")
    return "Blocked by browser. You must re-enable in Chrome Site settings (Notifications).";
  return "Notifications not supported here.";
}

function isValidHHMM(s: any): boolean {
  if (typeof s !== "string") return false;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(s);
}

function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return Number.POSITIVE_INFINITY;
  return h * 60 + m;
}

type PushUiState =
  | { status: "idle"; msg?: string }
  | { status: "working"; msg: string }
  | { status: "enabled"; msg: string }
  | { status: "error"; msg: string };

export default function Dashboard() {
  const { user, logout } = useAuth();
  const uid = user?.uid ?? null;

  const loc = useLocation();
  const debugOn = useMemo(() => new URLSearchParams(loc.search).get("debug") === "1", [loc.search]);

  // Today list (already filters due today)
  const { dateKey, dueItems, items, loading } = useToday(uid);

  // We also need the full active habit docs (to read schedule for past-day due logic)
  const { active: activeHabits, loading: habitsLoading } = useHabits(uid);

  const [busyId, setBusyId] = useState<string | null>(null);

  // ===== MVP insights state =====
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [bestCurrentStreak, setBestCurrentStreak] = useState<number | null>(null);
  const [consistency7d, setConsistency7d] = useState<string>("—");
  // Per-habit current streak map (for Today pills)
  const [streakByHabitId, setStreakByHabitId] = useState<Record<string, number>>({});
  // =============================

  const notifSupported = typeof window !== "undefined" && "Notification" in window;
  const secureContext = typeof window !== "undefined" ? window.isSecureContext : false;

  // (kept) Hook-based permission snapshot (does not drive push; only UI state)
  const { permission } = useReminderScheduler({
    enabled: Boolean(uid),
    dateKey,
    dueItems,
  });

  const notifStatus: NotificationPermission | "unsupported" = notifSupported
    ? (permission ?? Notification.permission)
    : "unsupported";

  // Push enable UI state (FCM)
  const [pushUi, setPushUi] = useState<PushUiState>({ status: "idle" });

  // Local debug state snapshot
  const [debugSnap, setDebugSnap] = useState<Record<string, any>>({});

  function readDebugSnapshot() {
    if (typeof window === "undefined") return {};
    const navAny: any = navigator as any;
    return {
      time: new Date().toISOString(),
      notifSupported,
      notifPermission: notifSupported ? Notification.permission : "unsupported",
      hookPermission: permission ?? null,
      secureContext,
      protocol: window.location?.protocol,
      hostname: window.location?.hostname,
      userAgent: navigator.userAgent,
      visibilityState: document.visibilityState,
      displayModeStandalone:
        (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || false,
      navigatorStandalone: Boolean(navAny.standalone),
      swController: Boolean(navigator.serviceWorker?.controller),
    };
  }

  useEffect(() => {
    if (!debugOn) return;

    console.log("[Dashboard][DEBUG] mounted");
    console.log("[Dashboard][DEBUG] initial snapshot:", readDebugSnapshot());

    const id = window.setInterval(() => {
      const snap = readDebugSnapshot();
      console.log("[Dashboard][DEBUG] poll snapshot:", snap);
      setDebugSnap(snap);
    }, 2000);

    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debugOn]);

  async function enableNotificationsClick() {
    console.log("[Dashboard] EnableNotifications clicked");
    console.log("[Dashboard] before:", readDebugSnapshot());

    if (!notifSupported) {
      setPushUi({ status: "error", msg: "Notifications API unsupported in this browser." });
      return;
    }
    if (!secureContext) {
      setPushUi({
        status: "error",
        msg: "Push notifications require HTTPS (or localhost).",
      });
      return;
    }
    if (!uid) return;

    setPushUi({ status: "working", msg: "Enabling push…" });

    try {
      // Requests permission + gets FCM token + saves to Firestore (if needed)
      const res: any = await enablePushForUser(uid);

      console.log("[Dashboard] enablePushForUser result:", res);
      console.log("[Dashboard] after:", readDebugSnapshot());

      if (res.ok) {
        if (res.changed === false) {
          setPushUi({ status: "enabled", msg: "Push already enabled ✅" });
        } else if (res.created) {
          setPushUi({ status: "enabled", msg: "Push enabled ✅ (token saved)" });
        } else {
          setPushUi({ status: "enabled", msg: "Push enabled ✅ (token updated)" });
        }
      } else {
        const msg =
          res.reason === "permission-not-granted"
            ? "Permission not granted."
            : res.reason === "messaging-not-supported"
            ? "Push messaging not supported on this device/browser."
            : res.reason === "notifications-not-supported"
            ? "Notifications not supported."
            : res.reason === "no-token"
            ? "Could not get a push token."
            : res.reason === "no-service-worker"
            ? "Service worker not ready."
            : res.reason === "missing-vapid-key"
            ? "Missing VITE_FIREBASE_VAPID_KEY."
            : "Push not enabled.";
        setPushUi({ status: "error", msg });
      }
    } catch (e: any) {
      console.log("[Dashboard] enable push error:", e);
      setPushUi({ status: "error", msg: e?.message ? String(e.message) : "Enable push failed." });
    }
  }

  const stats = useMemo(() => {
    const activeHabitsCount = items.length;
    const dueCount = dueItems.length;
    const doneCount = dueItems.filter((x) => x.done).length;
    const todayConsistency = dueCount === 0 ? "—" : `${Math.round((doneCount / dueCount) * 100)}%`;
    return { activeHabitsCount, dueCount, doneCount, todayConsistency };
  }, [items, dueItems]);

  // NEW: Next reminder (earliest HH:MM among today’s due habits with reminders enabled)
  const nextReminderHM = useMemo(() => {
    const times = (dueItems as any[])
      .filter((h) => Boolean(h?.reminderEnabled) && isValidHHMM(h?.reminderTime))
      .map((h) => String(h.reminderTime));

    if (!times.length) return null;

    const sorted = times.slice().sort((a, b) => hmToMinutes(a) - hmToMinutes(b));
    return sorted[0] ?? null;
  }, [dueItems]);

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

  // ===== Compute streak + 7d consistency (+ per-habit streak map) =====
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!uid) {
        setBestCurrentStreak(null);
        setConsistency7d("—");
        setStreakByHabitId({});
        return;
      }
      if (habitsLoading) return;

      if (!activeHabits || activeHabits.length === 0) {
        setBestCurrentStreak(0);
        setConsistency7d("—");
        setStreakByHabitId({});
        return;
      }

      setInsightsLoading(true);

      try {
        const keys7 = lastNDaysKeys(7);
        const keys60 = lastNDaysKeys(60);

        const doneMap60 = await getDoneMapForRange(db, uid, keys60);

        if (cancelled) return;

        // 7d consistency
        let due7 = 0;
        let done7 = 0;

        for (const h of activeHabits as any[]) {
          for (const k of keys7) {
            const due = isDueOnDateKey({ habit: h, dateKey: k, minDateKey: null });
            if (!due) continue;
            due7++;

            const doneSet = doneMap60.get(k) ?? new Set<string>();
            if (doneSet.has(h.id)) done7++;
          }
        }

        const consistency = due7 === 0 ? "—" : `${Math.round((done7 / due7) * 100)}%`;
        setConsistency7d(consistency);

        // Per-habit current streak (walk back from today, due days only)
        const streakMap: Record<string, number> = {};
        let best = 0;

        for (const h of activeHabits as any[]) {
          let streak = 0;

          for (const k of keys60) {
            const due = isDueOnDateKey({ habit: h, dateKey: k, minDateKey: null });
            if (!due) continue;

            const doneSet = doneMap60.get(k) ?? new Set<string>();
            const done = doneSet.has(h.id);

            if (done) streak++;
            else break;
          }

          streakMap[h.id] = streak;
          if (streak > best) best = streak;
        }

        setStreakByHabitId(streakMap);
        setBestCurrentStreak(best);
      } catch (e) {
        console.log("[Dashboard] insights error:", e);
        if (!cancelled) {
          setBestCurrentStreak(null);
          setConsistency7d("—");
          setStreakByHabitId({});
        }
      } finally {
        if (!cancelled) setInsightsLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [uid, habitsLoading, activeHabits, dateKey]);
  // ================================================================

  const pushButtonDisabled =
    !notifSupported || pushUi.status === "working" || notifStatus === "denied" || !uid;

  return (
    <Scene className="min-h-screen relative overflow-hidden" contentClassName="relative p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-4">
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

        {/* Notifications control under avatar (top-left) */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white/75">Notifications</div>
            <div className="mt-1 text-xs text-white/50">
              {permissionHelp(notifStatus)}
              {notifStatus === "denied" ? (
                <span className="text-white/60">
                  {" "}
                  (Chrome: click the 🔒 icon → Site settings → Notifications → Allow)
                </span>
              ) : null}
            </div>

            <div className="mt-2 text-[11px] text-white/45">
              Exact reminders: sent at each habit’s time (if enabled). Daily digest:{" "}
              <span className="text-white/70">16:00</span> (only if you have ≥1 due habit).
              {nextReminderHM ? (
                <span className="text-white/60">
                  {" "}
                  • Next reminder today: <span className="text-white/80">{nextReminderHM}</span>
                </span>
              ) : null}
            </div>

            {pushUi.status !== "idle" ? (
              <div
                className={`mt-2 text-[11px] ${
                  pushUi.status === "enabled"
                    ? "text-emerald-300/90"
                    : pushUi.status === "error"
                    ? "text-rose-300/90"
                    : "text-white/55"
                }`}
              >
                {pushUi.msg}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={enableNotificationsClick}
            disabled={pushButtonDisabled}
            className={`relative inline-flex h-9 w-24 items-center rounded-full border transition
              ${
                notifStatus === "granted"
                  ? "border-white/20 bg-white/[0.16]"
                  : "border-white/14 bg-white/[0.08] hover:bg-white/[0.12]"
              }
              disabled:opacity-60`}
            aria-label="Enable notifications"
            title={!notifSupported ? "Notifications unsupported" : undefined}
          >
            <span
              className={`absolute left-1 top-1 h-7 w-7 rounded-full transition
                ${notifStatus === "granted" ? "translate-x-[56px] bg-white/80" : "translate-x-0 bg-white/55"}`}
            />
            <span className="w-full text-center text-[11px] font-semibold text-white/80">
              {pushUi.status === "working" ? "…" : permissionLabel(notifStatus)}
            </span>
          </button>
        </div>

        {/* Debug panel */}
        {debugOn ? (
          <div className="mb-6 rounded-2xl border border-white/14 bg-white/[0.06] p-4 text-xs text-white/75 backdrop-blur-2xl">
            <div className="font-semibold text-white/85">DEBUG</div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(debugSnap).map(([k, v]) => (
                <div key={k} className="rounded-xl border border-white/10 bg-black/10 p-3">
                  <div className="text-white/55">{k}</div>
                  <div className="mt-1 break-all text-white/85">{String(v)}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-white/45">
              Tip: open DevTools Console and search for <span className="text-white/70">[Dashboard]</span>.
            </div>
          </div>
        ) : null}

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
                  {dueItems.map((h: any) => {
                    const isBusy = busyId === h.id;
                    const streak = streakByHabitId[h.id] ?? 0;

                    const remOn = Boolean(h.reminderEnabled) && isValidHHMM(h.reminderTime);
                    const remTime = String(h.reminderTime ?? "");

                    return (
                      <div
                        key={h.id}
                        className="rounded-xl border border-white/14 bg-white/[0.07] p-4 backdrop-blur-2xl
                                   shadow-[0_20px_60px_-50px_rgba(0,0,0,0.98)]
                                   flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="text-sm font-semibold text-white truncate">{h.name}</div>

                            {remOn ? <ReminderPill time={remTime} /> : <ReminderPill off />}

                            <StreakPill n={streak} />
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
                Tip: If push is ON, reminders can arrive in the background. If push is OFF/BLOCKED, you won’t get nudges.
              </div>
            </DarkCard>
          </div>

          <div className="lg:col-span-1">
            <DarkCard title="Quick stats" subtitle="Snapshot (Today + last 7 days)">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Active habits", value: String(items.length) },
                  { label: "Due today", value: String(dueItems.length) },
                  { label: "Today done", value: String(dueItems.filter((x: any) => x.done).length) },
                  { label: "Next reminder", value: nextReminderHM ?? "—" },
                  { label: "7d consistency", value: insightsLoading ? "…" : consistency7d },
                  {
                    label: "Best streak",
                    value:
                      insightsLoading ? "…" : bestCurrentStreak == null ? "—" : String(bestCurrentStreak),
                  },
                  { label: "Today rate", value: stats.todayConsistency },
                  { label: "Push", value: permissionLabel(notifStatus) },
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
                  <span>Longest streak (true, lifetime) + goals</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-white/50">•</span>
                  <span>“Missed due days” + recovery suggestions</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-white/50">•</span>
                  <span>Weekly trend + habit ranking</span>
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
// End of Version 17 — src/pages/Dashboard.tsx
// ==========================
