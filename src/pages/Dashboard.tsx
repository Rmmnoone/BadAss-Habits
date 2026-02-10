// ==========================
// Version 25 — src/pages/Dashboard.tsx
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
import { ensureUserDoc, setUserRemindersEnabled, setUserQuietHours, setUserTimezone } from "../firebase/users";
import {
  collection,
  getCountFromServer,
  getDoc,
  doc,
  query,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";

//
const tileClass =
  "rounded-xl border border-white/14 bg-white/[0.07] p-4 backdrop-blur-2xl shadow-[0_20px_60px_-50px_rgba(0,0,0,0.98)]";

const toneTileClass =
  "rounded-xl border p-4 backdrop-blur-2xl shadow-[0_20px_60px_-50px_rgba(0,0,0,0.98)]";

//

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
            <div className="min-w-0">
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

function ReminderPill({ time, off }: { time?: string; off?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/14 bg-white/[0.07] px-2.5 py-1 text-[11px] font-semibold text-white/75">
      <span className="opacity-80">⏰</span> {off ? "Off" : time}
    </span>
  );
}

function StreakPill({ n }: { n: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-white/14 bg-white/[0.07] px-2.5 py-1 text-[11px] font-semibold text-white/75"
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
  if (p === "denied") return "Blocked by browser. You must re-enable in Chrome Site settings (Notifications).";
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

// Supports wrap-around windows (e.g. 22:00 → 07:00)
function isWithinQuietHours(nowHM: string, startHM: string, endHM: string): boolean {
  if (!isValidHHMM(nowHM) || !isValidHHMM(startHM) || !isValidHHMM(endHM)) return false;

  const now = hmToMinutes(nowHM);
  const start = hmToMinutes(startHM);
  const end = hmToMinutes(endHM);

  if (start === end) return false;

  if (start < end) return now >= start && now < end;
  return now >= start || now < end;
}

// Validate IANA TZ with Intl
function isValidIanaTz(tz: string): boolean {
  if (!tz || typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

// HH:mm in a given IANA TZ (safe; returns null if not supported)
function hmNowInTz(tz?: string | null): string | null {
  if (!tz) return null;
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const v = fmt.format(new Date());
    const m = v.match(/^(\d{2})[:.](\d{2})$/);
    if (!m) return null;
    return `${m[1]}:${m[2]}`;
  } catch {
    return null;
  }
}

type PushUiState =
  | { status: "idle"; msg?: string }
  | { status: "working"; msg: string }
  | { status: "enabled"; msg: string }
  | { status: "error"; msg: string };

type GlobalUiState =
  | { status: "idle"; msg?: string }
  | { status: "working"; msg: string }
  | { status: "saved"; msg: string }
  | { status: "error"; msg: string };

type LastLogState =
  | { status: "idle" }
  | { status: "working" }
  | { status: "ok"; text: string }
  | { status: "error"; text: string };

type QuietUiState =
  | { status: "idle"; msg?: string }
  | { status: "working"; msg: string }
  | { status: "saved"; msg: string }
  | { status: "error"; msg: string };

type TzUiState =
  | { status: "idle"; msg?: string }
  | { status: "working"; msg: string }
  | { status: "saved"; msg: string }
  | { status: "error"; msg: string };

type EffectivePushKind =
  | "READY"
  | "OFF"
  | "QUIET_ACTIVE"
  | "NEEDS_PERMISSION"
  | "BLOCKED"
  | "NO_TOKEN"
  | "NO_SW"
  | "INSECURE"
  | "UNSUPPORTED";

function buildPushStatus(args: {
  globalEnabled: boolean;
  quietEnabled: boolean;
  quietActive: boolean;
  quietStart: string;
  quietEnd: string;
  notifSupported: boolean;
  secureContext: boolean;
  notifStatus: NotificationPermission | "unsupported";
  tokenCount: number | null;
  swControlled: boolean;
}): {
  kind: EffectivePushKind;
  headline: string;
  action: string;
  tone: "good" | "warn" | "bad";
} {
  const {
    globalEnabled,
    quietEnabled,
    quietActive,
    quietStart,
    quietEnd,
    notifSupported,
    secureContext,
    notifStatus,
    tokenCount,
    swControlled,
  } = args;

  if (!globalEnabled) {
    return { kind: "OFF", headline: "❌ Reminders are OFF", action: "Turn Global reminders ON.", tone: "bad" };
  }

  if (quietEnabled && quietActive) {
    return {
      kind: "QUIET_ACTIVE",
      headline: "⏳ Quiet hours are active",
      action: `Reminders are paused until ${quietEnd} (window ${quietStart}–${quietEnd}).`,
      tone: "warn",
    };
  }

  if (!notifSupported || notifStatus === "unsupported") {
    return {
      kind: "UNSUPPORTED",
      headline: "❌ Push not supported here",
      action: "Try Chrome on desktop or Android (or install the PWA).",
      tone: "bad",
    };
  }

  if (!secureContext) {
    return {
      kind: "INSECURE",
      headline: "❌ Push requires HTTPS",
      action: "Open the app on HTTPS (or localhost).",
      tone: "bad",
    };
  }

  if (notifStatus === "denied") {
    return {
      kind: "BLOCKED",
      headline: "❌ Notifications are BLOCKED",
      action: "Chrome: 🔒 → Site settings → Notifications → Allow.",
      tone: "bad",
    };
  }

  if (notifStatus === "default") {
    return {
      kind: "NEEDS_PERMISSION",
      headline: "⚠️ Notifications are OFF on this device",
      action: "Click “Enable notifications”.",
      tone: "warn",
    };
  }

  if (tokenCount === null) {
    return {
      kind: "NO_TOKEN",
      headline: "⚠️ Checking device registration…",
      action: "If this doesn’t resolve, click “Enable notifications” again.",
      tone: "warn",
    };
  }

  if (tokenCount <= 0) {
    return {
      kind: "NO_TOKEN",
      headline: "⚠️ Device not registered (no token)",
      action: "Click “Enable notifications” to register this device.",
      tone: "warn",
    };
  }

  if (!swControlled) {
    return {
      kind: "NO_SW",
      headline: "⚠️ Service worker not controlling the page",
      action: "Reload once. If installed as PWA, close and reopen it.",
      tone: "warn",
    };
  }

  return {
    kind: "READY",
    headline: "✅ Reminders are ON and working",
    action: "You’ll receive exact reminders even when the app is closed.",
    tone: "good",
  };
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const uid = user?.uid ?? null;

  const loc = useLocation();
  const debugOn = useMemo(() => new URLSearchParams(loc.search).get("debug") === "1", [loc.search]);

    const [userTz, setUserTz] = useState<string>("Europe/London");
  const { dateKey, dueItems, items, loading } = useToday(uid, userTz);
  const { active: activeHabits, loading: habitsLoading } = useHabits(uid);

  const [busyId, setBusyId] = useState<string | null>(null);

  const [insightsLoading, setInsightsLoading] = useState(false);
  const [bestCurrentStreak, setBestCurrentStreak] = useState<number | null>(null);
  const [consistency7d, setConsistency7d] = useState<string>("—");
  const [streakByHabitId, setStreakByHabitId] = useState<Record<string, number>>({});

  const notifSupported = typeof window !== "undefined" && "Notification" in window;
  const secureContext = typeof window !== "undefined" ? window.isSecureContext : false;

  const [tokenSnap, setTokenSnap] = useState<{ count: number | null; status: "idle" | "working" | "ok" | "error" }>(
    { count: null, status: "idle" }
  );


  const { permission } = useReminderScheduler({
    enabled: Boolean(uid),
    dateKey,
    dueItems,
    disableLocal: (tokenSnap.count ?? 0) > 0,
    timezone: userTz,
  });

  const notifStatus: NotificationPermission | "unsupported" = notifSupported
    ? (permission ?? Notification.permission)
    : "unsupported";

  const [pushUi, setPushUi] = useState<PushUiState>({ status: "idle" });

  const [globalEnabled, setGlobalEnabled] = useState<boolean>(true);
  const [globalUi, setGlobalUi] = useState<GlobalUiState>({ status: "idle" });

  const [lastLog, setLastLog] = useState<LastLogState>({ status: "idle" });

  const [quietEnabled, setQuietEnabled] = useState<boolean>(false);
  const [quietStart, setQuietStart] = useState<string>("22:00");
  const [quietEnd, setQuietEnd] = useState<string>("07:00");
  const [quietUi, setQuietUi] = useState<QuietUiState>({ status: "idle" });
  const [quietDirty, setQuietDirty] = useState<boolean>(false);

  const deviceTz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London";
    } catch {
      return "Europe/London";
    }
  }, []);

  const tzQuickList = useMemo(() => {
    const base = [
      deviceTz,
      "Europe/London",
      "UTC",
      "Europe/Paris",
      "Europe/Berlin",
      "Europe/Rome",
      "Europe/Madrid",
      "Europe/Istanbul",
      "Asia/Tehran",
      "Asia/Dubai",
      "Asia/Kolkata",
      "Asia/Tokyo",
      "America/New_York",
      "America/Los_Angeles",
      "Australia/Sydney",
    ];
    return Array.from(new Set(base)).filter(Boolean);
  }, [deviceTz]);

  const [tzMode, setTzMode] = useState<"quick" | "custom">("quick");
  const [tzSelect, setTzSelect] = useState<string>(deviceTz);
  const [tzCustom, setTzCustom] = useState<string>("");
  const [tzDirty, setTzDirty] = useState<boolean>(false);
  const [tzUi, setTzUi] = useState<TzUiState>({ status: "idle" });

  const [debugSnap, setDebugSnap] = useState<Record<string, any>>({});

  const nowHMUser = useMemo(() => {
    const hm = hmNowInTz(userTz);
    if (hm) return hm;
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }, [userTz]);

  const quietActiveNow = useMemo(() => {
    if (!quietEnabled) return false;
    if (!isValidHHMM(quietStart) || !isValidHHMM(quietEnd)) return false;
    return isWithinQuietHours(nowHMUser, quietStart, quietEnd);
  }, [quietEnabled, quietStart, quietEnd, nowHMUser]);

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
      globalRemindersEnabled: globalEnabled,
      tokenCount: tokenSnap.count,
      lastReminderLog:
        lastLog.status === "ok" ? lastLog.text : lastLog.status === "error" ? lastLog.text : lastLog.status,
      userTz,
      deviceTz,
      tzMode,
      tzSelect,
      tzCustom,
      tzDirty,
      nowHMUser,
      quietEnabled,
      quietStart,
      quietEnd,
      quietActiveNow,
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

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!uid) return;

      try {
        await ensureUserDoc(db, uid, user?.email ?? null);

        const snap = await getDoc(doc(db, "users", uid));
        if (cancelled) return;

        const data: any = snap.exists() ? snap.data() : {};

        const tz = typeof data?.timezone === "string" && data.timezone ? data.timezone : deviceTz;
        setUserTz(tz);

        if (tzQuickList.includes(tz)) {
          setTzMode("quick");
          setTzSelect(tz);
          setTzCustom("");
        } else {
          setTzMode("custom");
          setTzSelect(deviceTz);
          setTzCustom(tz);
        }
        setTzDirty(false);
        setTzUi({ status: "idle" });

        const enabled = data?.remindersEnabled;
        setGlobalEnabled(enabled === false ? false : true);

        const q = data?.quietHours ?? {};
        const qEnabled = q?.enabled === true;
        const qStart = isValidHHMM(q?.start) ? String(q.start) : "22:00";
        const qEnd = isValidHHMM(q?.end) ? String(q.end) : "07:00";

        setQuietEnabled(qEnabled);
        setQuietStart(qStart);
        setQuietEnd(qEnd);
        setQuietDirty(false);
      } catch (e) {
        console.log("[Dashboard] ensure/load user doc error:", e);
        if (!cancelled) {
          setGlobalEnabled(true);
          setUserTz(deviceTz);
          setTzMode("quick");
          setTzSelect(deviceTz);
          setTzCustom("");
          setTzDirty(false);
          setTzUi({ status: "idle" });

          setQuietEnabled(false);
          setQuietStart("22:00");
          setQuietEnd("07:00");
          setQuietDirty(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [uid, user?.email, deviceTz, tzQuickList]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!uid) {
        setTokenSnap({ count: null, status: "idle" });
        return;
      }

      setTokenSnap((s) => ({ ...s, status: "working" }));
      try {
        const colRef = collection(db, "users", uid, "pushTokens");
        const agg = await getCountFromServer(colRef);
        if (cancelled) return;

        const n = agg.data().count ?? 0;
        setTokenSnap({ count: n, status: "ok" });
      } catch (e) {
        console.log("[Dashboard] token snapshot error:", e);
        if (!cancelled) setTokenSnap({ count: null, status: "error" });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  async function refreshLastLog(targetUid: string) {
    setLastLog({ status: "working" });
    try {
      const colRef = collection(db, "users", targetUid, "reminderLogs");
      const qy = query(colRef, orderBy("sentAt", "desc"), limit(1));
      const snap = await getDocs(qy);

      if (snap.empty) {
        setLastLog({ status: "ok", text: "No logs yet." });
        return;
      }

      const d: any = snap.docs[0].data() || {};
      const type = String(d.type ?? "unknown");
      const dateKey = String(d.dateKey ?? "—");
      const atHM = String(d.atHM ?? "—");
      const tz = String(d.tz ?? "—");

      setLastLog({ status: "ok", text: `Last sent: ${type} • ${dateKey} ${atHM} (${tz})` });
    } catch (e: any) {
      setLastLog({ status: "error", text: e?.message ? String(e.message) : "Could not load logs." });
    }
  }

  useEffect(() => {
    if (!uid) {
      setLastLog({ status: "idle" });
      return;
    }
    refreshLastLog(uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  async function enableNotificationsClick() {
    console.log("[Dashboard] EnableNotifications clicked");
    console.log("[Dashboard] before:", readDebugSnapshot());

    if (!notifSupported) {
      setPushUi({ status: "error", msg: "Notifications API unsupported in this browser." });
      return;
    }
    if (!secureContext) {
      setPushUi({ status: "error", msg: "Push notifications require HTTPS (or localhost)." });
      return;
    }
    if (!uid) return;

    setPushUi({ status: "working", msg: "Enabling push…" });

    try {
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

        try {
          const colRef = collection(db, "users", uid, "pushTokens");
          const agg = await getCountFromServer(colRef);
          const n = agg.data().count ?? 0;
          setTokenSnap({ count: n, status: "ok" });
        } catch {
          // ignore
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

  async function toggleGlobalReminders(next: boolean) {
    if (!uid) return;

    setGlobalUi({ status: "working", msg: "Saving…" });

    try {
      await setUserRemindersEnabled(db, uid, next);
      setGlobalEnabled(next);
      setGlobalUi({
        status: "saved",
        msg: next ? "Global reminders ON ✅" : "Global reminders OFF ✅ (no notifications will be sent)",
      });
    } catch (e: any) {
      console.log("[Dashboard] set remindersEnabled error:", e);
      setGlobalUi({ status: "error", msg: e?.message ? String(e.message) : "Could not update reminder setting." });
    }
  }

  async function saveQuietHours() {
    if (!uid) return;

    setQuietUi({ status: "working", msg: "Saving…" });

    const start = isValidHHMM(quietStart) ? quietStart : "22:00";
    const end = isValidHHMM(quietEnd) ? quietEnd : "07:00";

    try {
      await setUserQuietHours(db, uid, {
        enabled: Boolean(quietEnabled),
        start,
        end,
      } as any);

      setQuietStart(start);
      setQuietEnd(end);
      setQuietDirty(false);

      setQuietUi({
        status: "saved",
        msg: quietEnabled ? `Quiet hours ON ✅ (${start}–${end})` : "Quiet hours OFF ✅",
      });
    } catch (e: any) {
      console.log("[Dashboard] set quietHours error:", e);
      setQuietUi({ status: "error", msg: e?.message ? String(e.message) : "Could not update quiet hours." });
    }
  }

  async function saveTimezone() {
    if (!uid) return;

    setTzUi({ status: "working", msg: "Saving…" });

    const candidate = tzMode === "custom" ? tzCustom.trim() : tzSelect.trim();

    if (!isValidIanaTz(candidate)) {
      setTzUi({ status: "error", msg: "Invalid timezone. Use a valid IANA name like Europe/London." });
      return;
    }

    try {
      await setUserTimezone(db, uid, candidate);
      setUserTz(candidate);
      setTzDirty(false);
      setTzUi({ status: "saved", msg: `Timezone saved ✅ (${candidate})` });
    } catch (e: any) {
      console.log("[Dashboard] set timezone error:", e);
      setTzUi({ status: "error", msg: e?.message ? String(e.message) : "Could not update timezone." });
    }
  }

  const stats = useMemo(() => {
    const activeHabitsCount = items.length;
    const dueCount = dueItems.length;
    const doneCount = dueItems.filter((x) => x.done).length;
    const todayConsistency = dueCount === 0 ? "—" : `${Math.round((doneCount / dueCount) * 100)}%`;
    return { activeHabitsCount, dueCount, doneCount, todayConsistency };
  }, [items, dueItems]);

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

  const pushButtonDisabled =
    !notifSupported || pushUi.status === "working" || notifStatus === "denied" || !uid;

 // const tokenYesNo = useMemo(() => {
   // if (tokenSnap.status === "working") return "…";
    //if (tokenSnap.status === "error" || tokenSnap.count === null) return "—";
   // return tokenSnap.count > 0 ? "Yes" : "No";
 // }, [tokenSnap]);

  const effectivePush = useMemo(() => {
    return buildPushStatus({
      globalEnabled,
      quietEnabled,
      quietActive: quietActiveNow,
      quietStart,
      quietEnd,
      notifSupported,
      secureContext,
      notifStatus,
      tokenCount: tokenSnap.count,
      swControlled: typeof window !== "undefined" ? Boolean(navigator.serviceWorker?.controller) : false,
    });
  }, [
    globalEnabled,
    quietEnabled,
    quietActiveNow,
    quietStart,
    quietEnd,
    notifSupported,
    secureContext,
    notifStatus,
    tokenSnap.count,
  ]);

  const effectiveToneClass =
    effectivePush.tone === "good"
      ? "border-emerald-300/25 bg-emerald-500/10"
      : effectivePush.tone === "warn"
      ? "border-amber-300/25 bg-amber-500/10"
      : "border-rose-300/25 bg-rose-500/10";

  const effectiveHeadlineClass =
    effectivePush.tone === "good"
      ? "text-emerald-200"
      : effectivePush.tone === "warn"
      ? "text-amber-200"
      : "text-rose-200";


  // --------------------------
  // Today UI summary helpers
  // --------------------------
  const todayDueCount = dueItems.length;
  const todayDoneCount = dueItems.filter((x: any) => x.done).length;
  const todayLeftCount = Math.max(0, todayDueCount - todayDoneCount);
  const todayRatePct = todayDueCount === 0 ? 0 : Math.round((todayDoneCount / todayDueCount) * 100);

      
  return (
    <Scene className="min-h-screen relative overflow-hidden" contentClassName="relative p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="h-10 w-10 rounded-2xl border border-white/14
                         bg-gradient-to-b from-white/[0.14] to-white/[0.06]
                         backdrop-blur-2xl
                         flex items-center justify-center text-sm font-semibold text-white/92
                         shadow-[0_24px_70px_-55px_rgba(0,0,0,0.98)]"
            >
              {initials(user?.email)}
            </div>

            <div className="min-w-0">
              <div className="mb-1 inline-flex items-center gap-3 rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 text-[11px] text-white/80 backdrop-blur-2xl">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                BadAss Habits
              </div>

              <div className="text-sm font-semibold text-white">Dashboard</div>
              <div className="text-xs text-white/60 truncate">
                Signed in as <span className="font-medium text-white/80">{user?.email}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
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
            >
              {/* Today summary (UI only) */}
              {!loading && todayDueCount > 0 && (
                <>
                  <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
                    <span className="rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 text-white/80">
                      Due <span className="font-semibold">{todayDueCount}</span>
                    </span>

                    <span className="rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 text-white/80">
                      Done <span className="font-semibold">{todayDoneCount}</span>
                    </span>

                    <span className="rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 text-white/80">
                      Left <span className="font-semibold">{todayLeftCount}</span>
                    </span>

                    <span className="rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 text-white/80">
                      Rate <span className="font-semibold">{todayRatePct}%</span>
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-4">
                    <div className="h-2 w-full overflow-hidden rounded-full border border-white/14 bg-black/20">
                      <div
                        className="h-full bg-white/35"
                        style={{ width: `${todayRatePct}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[11px] text-white/45">
                      {todayDoneCount} of {todayDueCount} done
                    </div>
                  </div>
                </>
              )}


              {loading ? (
                <div className="text-sm text-white/70">
                  Loading…</div>
              ) : dueItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/16 bg-black/10 px-4 py-5">
                  <p className="text-sm text-white/70">No habits due today.</p>
                  <p className="mt-2 text-xs text-white/50">If you haven’t set schedules yet, go to Habits → Schedule.</p>
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
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="text-sm font-semibold text-white truncate">{h.name}</div>

                            {remOn ? <ReminderPill time={remTime} /> : <ReminderPill off />}

                            <StreakPill n={streak} />
                          </div>

                          <div className="mt-1 flex items-center gap-2 text-xs">
                            <span
                              className={
                              h.done
                               ? "inline-flex items-center gap-1 rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2 py-0.5 text-emerald-200"
                                : "inline-flex items-center gap-1 rounded-full border border-white/14 bg-white/[0.06] px-2 py-0.5 text-white/65"
                             }
                            >
                            {h.done ? "Done" : "Not done"}
                            </span>
                              {h.done ? <span className="text-white/45">✅</span> : null}
                            </div>
                          </div>

                        <button
                          disabled={isBusy}
                          onClick={() => toggle(h.id, !h.done)}
                          className={`rounded-xl border px-4 py-2 text-xs font-semibold transition
                            ${
                              h.done
                                ? "border-white/18 bg-white/[0.07] text-white/80 hover:bg-white/[0.10]"
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
                    value: insightsLoading ? "…" : bestCurrentStreak == null ? "—" : String(bestCurrentStreak),
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

              <div className="mt-3 text-[11px] text-white/45">Note: streaks are computed from the last 60 days.</div>
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
                <li className="flex gap-3">
                  <span className="text-white/50">•</span>
                  <span>Longest streak (true, lifetime) + goals</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-white/50">•</span>
                  <span>“Missed due days” + recovery suggestions</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-white/50">•</span>
                  <span>Weekly trend + habit ranking</span>
                </li>
              </ul>
            </div>
          </DarkCard>

          <DarkCard
            title="Next up"
            subtitle="Roadmap for the next build steps."
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

        <div className="mt-10 text-center text-xs text-white/90">
          Tip: Install the app on your phone for the best reminder experience.
        </div>

        <div className="mt-10 text-center text-xs text-white/90">
          
        </div>

        {/* TOP: Notifications */}
        <DarkCard
          title="Notifications"

        >
          {/* Status pills */}
          <div className="flex items-center gap-2 flex-wrap">

          </div>

          {/* Primary action buttons */}
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              type="button"
              onClick={() => toggleGlobalReminders(!globalEnabled)}
              disabled={!uid || globalUi.status === "working" || pushUi.status === "working"}
              className={`relative inline-flex h-9 w-44 items-center rounded-full border transition
                ${
                  globalEnabled
                    ? "border-white/20 bg-white/[0.16]"
                    : "border-white/14 bg-white/[0.08] hover:bg-white/[0.12]"
                }
                disabled:opacity-60`}
              aria-label="Toggle global reminders"
              title="Turns ALL notifications on/off (exact reminders + daily digest)"
            >
              <span
                className={`absolute left-1 top-1 h-7 w-7 rounded-full transition
                  ${globalEnabled ? "translate-x-[120px] bg-white/80" : "translate-x-0 bg-white/55"}`}
              />
              <span className="w-full text-center text-[11px] font-semibold text-white/80">
                {globalUi.status === "working" ? "Saving…" : globalEnabled ? "Reminders ON" : "Reminders OFF"}
              </span>
            </button>

            <button
              type="button"
              onClick={enableNotificationsClick}
              disabled={pushButtonDisabled}
              className={`relative inline-flex h-9 w-44 items-center rounded-full border transition
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
                  ${notifStatus === "granted" ? "translate-x-[120px] bg-white/80" : "translate-x-0 bg-white/55"}`}
              />
              <span className="w-full text-center text-[11px] font-semibold text-white/80">
                {pushUi.status === "working" ? "…" : `Push ${permissionLabel(notifStatus)}`}
              </span>
            </button>
          </div>

          {/* Timezone controls */}
          <div className={`mt-3 ${tileClass}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white/80">Timezone</div>
                <div className="mt-1 text-[11px] text-white/55">
                  Used for digest time, exact reminders, and quiet hours. Device timezone:{" "}
                  <span className="text-white/75">{deviceTz}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setTzMode("quick");
                  setTzSelect(deviceTz);
                  setTzCustom("");
                  setTzDirty(true);
                  setTzUi({ status: "idle" });
                }}
                disabled={!uid || tzUi.status === "working"}
                className="rounded-xl border border-white/14 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white/90
                           hover:bg-white/[0.12] disabled:opacity-60 disabled:hover:bg-white/[0.08]
                           shadow-[0_18px_55px_-45px_rgba(0,0,0,0.98)]"
                title="Set timezone to match this device"
              >
                Use device TZ
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setTzMode("quick");
                    setTzDirty(true);
                    setTzUi({ status: "idle" });
                  }}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition
                    ${
                      tzMode === "quick"
                        ? "border-white/22 bg-white/[0.12] text-white"
                        : "border-white/14 bg-white/[0.07] text-white/70 hover:bg-white/[0.10]"
                    }`}
                >
                  Quick list
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTzMode("custom");
                    setTzDirty(true);
                    setTzUi({ status: "idle" });
                  }}
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition
                    ${
                      tzMode === "custom"
                        ? "border-white/22 bg-white/[0.12] text-white"
                        : "border-white/14 bg-white/[0.07] text-white/70 hover:bg-white/[0.10]"
                    }`}
                >
                  Custom
                </button>

                <div className="text-[11px] text-white/55">
                  Now in selected TZ: <span className="text-white/80">{nowHMUser}</span>
                </div>
              </div>

              {tzMode === "quick" ? (
                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-white/60">Timezone</span>
                    <select
                      value={tzSelect}
                      onChange={(e) => {
                        setTzSelect(e.target.value);
                        setTzDirty(true);
                        setTzUi({ status: "idle" });
                      }}
                      className="h-9 w-[320px] max-w-full rounded-xl border border-white/14 bg-white/[0.07] px-3 text-sm text-white/90 outline-none"
                    >
                      {tzQuickList.map((z) => (
                        <option key={z} value={z}>
                          {z}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={saveTimezone}
                    disabled={!uid || tzUi.status === "working" || !tzDirty}
                    className="rounded-xl border border-white/14 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white/90
                               hover:bg-white/[0.12] disabled:opacity-60 disabled:hover:bg-white/[0.08]
                               shadow-[0_18px_55px_-45px_rgba(0,0,0,0.98)]"
                    title={!tzDirty ? "No changes to save" : "Save timezone"}
                  >
                    {tzUi.status === "working" ? "Saving…" : "Save timezone"}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] text-white/60">Custom IANA timezone</span>
                    <input
                      value={tzCustom}
                      onChange={(e) => {
                        setTzCustom(e.target.value);
                        setTzDirty(true);
                        setTzUi({ status: "idle" });
                      }}
                      placeholder="e.g. Europe/London"
                      className="h-9 w-[320px] max-w-full rounded-xl border border-white/14 bg-white/[0.07] px-3 text-sm text-white/90 outline-none"
                    />
                    <div className="text-[11px] text-white/45 mt-1">
                      Tip: must be an IANA name (Region/City), e.g.{" "}
                      <span className="text-white/70">America/New_York</span>
                    </div>
                  </label>

                  <button
                    type="button"
                    onClick={saveTimezone}
                    disabled={!uid || tzUi.status === "working" || !tzDirty}
                    className="rounded-xl border border-white/14 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white/90
                               hover:bg-white/[0.12] disabled:opacity-60 disabled:hover:bg-white/[0.08]
                               shadow-[0_18px_55px_-45px_rgba(0,0,0,0.98)]"
                    title={!tzDirty ? "No changes to save" : "Save timezone"}
                  >
                    {tzUi.status === "working" ? "Saving…" : "Save timezone"}
                  </button>
                </div>
              )}

              {tzUi.status !== "idle" ? (
                <div
                  className={`text-[11px] ${
                    tzUi.status === "saved"
                      ? "text-emerald-300/90"
                      : tzUi.status === "error"
                      ? "text-rose-300/90"
                      : "text-white/55"
                  }`}
                >
                  {tzUi.msg}
                </div>
              ) : null}
            </div>
          </div>

          {/* Quiet Hours controls */}
          <div className={`mt-3 ${tileClass}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white/80">Quiet Hours</div>
                <div className="mt-1 text-[11px] text-white/55">
                  Pauses all reminders (digest + exact) during the window, using your timezone:{" "}
                  <span className="text-white/75">{userTz}</span> • now{" "}
                  <span className="text-white/75">{nowHMUser}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = !quietEnabled;
                  setQuietEnabled(next);
                  setQuietDirty(true);
                  setQuietUi({ status: "idle" });
                }}
                disabled={!uid || quietUi.status === "working"}
                className={`relative inline-flex h-9 w-28 items-center rounded-full border transition
                    ${
                      quietEnabled
                        ? "border-white/20 bg-white/[0.16]"
                        : "border-white/14 bg-white/[0.08] hover:bg-white/[0.12]"
                    }
                    disabled:opacity-60`}
                aria-label="Toggle quiet hours"
                title="Pauses all reminders during the quiet window"
              >
                <span
                  className={`absolute left-1 top-1 h-7 w-7 rounded-full transition
                      ${quietEnabled ? "translate-x-[72px] bg-white/80" : "translate-x-0 bg-white/55"}`}
                />
                <span className="w-full text-center text-[11px] font-semibold text-white/80">
                  {quietEnabled ? "Quiet ON" : "Quiet OFF"}
                </span>
              </button>
            </div>

            <div className="mt-3 flex flex-col sm:flex-row sm:items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-white/60">Start</span>
                <input
                  type="time"
                  value={quietStart}
                  onChange={(e) => {
                    setQuietStart(e.target.value);
                    setQuietDirty(true);
                    setQuietUi({ status: "idle" });
                  }}
                  className="h-9 w-40 rounded-xl border border-white/14 bg-white/[0.07] px-3 text-sm text-white/90 outline-none"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-white/60">End</span>
                <input
                  type="time"
                  value={quietEnd}
                  onChange={(e) => {
                    setQuietEnd(e.target.value);
                    setQuietDirty(true);
                    setQuietUi({ status: "idle" });
                  }}
                  className="h-9 w-40 rounded-xl border border-white/14 bg-white/[0.07] px-3 text-sm text-white/90 outline-none"
                />
              </label>

              <button
                type="button"
                onClick={saveQuietHours}
                disabled={!uid || quietUi.status === "working" || !quietDirty}
                className="rounded-xl border border-white/14 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white/90
                           hover:bg-white/[0.12] disabled:opacity-60 disabled:hover:bg-white/[0.08]
                           shadow-[0_18px_55px_-45px_rgba(0,0,0,0.98)]"
                title={!quietDirty ? "No changes to save" : "Save quiet hours"}
              >
                {quietUi.status === "working" ? "Saving…" : "Save quiet hours"}
              </button>
            </div>

            {quietUi.status !== "idle" ? (
              <div
                className={`mt-2 text-[11px] ${
                  quietUi.status === "saved"
                    ? "text-emerald-300/90"
                    : quietUi.status === "error"
                    ? "text-rose-300/90"
                    : "text-white/55"
                }`}
              >
                {quietUi.msg}
              </div>
            ) : null}

            {quietEnabled && quietActiveNow ? (
              <div className="mt-2 text-[11px] text-amber-200/90">
                Quiet hours are active now — reminders are paused until{" "}
                <span className="text-white/80">{quietEnd}</span>.
              </div>
            ) : null}
          </div>

          {/* Effective push status */}
          <div className={`mt-3 ${toneTileClass} ${effectiveToneClass}`}>
            <div className={`text-sm font-semibold ${effectiveHeadlineClass}`}>{effectivePush.headline}</div>
            <div className="mt-1 text-xs text-white/70">{effectivePush.action}</div>

            <div className="mt-2 text-[11px] text-white/60">
              {lastLog.status === "working"
                ? "Loading last log…"
                : lastLog.status === "ok"
                ? lastLog.text
                : lastLog.status === "error"
                ? `Last log: ${lastLog.text}`
                : null}
            </div>
          </div>

          <div className="mt-2 text-xs text-white/50">
            {permissionHelp(notifStatus)}
            {notifStatus === "denied" ? (
              <span className="text-white/60"> (Chrome: click the 🔒 icon → Site settings → Notifications → Allow)</span>
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

          {/* Inline messages */}
          {globalUi.status !== "idle" ? (
            <div
              className={`mt-2 text-[11px] ${
                globalUi.status === "saved"
                  ? "text-emerald-300/90"
                  : globalUi.status === "error"
                  ? "text-rose-300/90"
                  : "text-white/55"
              }`}
            >
              {globalUi.msg}
            </div>
          ) : null}

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
        </DarkCard>

        {/* Debug panel */}
        {debugOn ? (
          <div className="mt-5 mb-6 rounded-2xl border border-white/14 bg-white/[0.07] p-4 text-xs text-white/75 backdrop-blur-2xl">
            <div className="font-semibold text-white/85">DEBUG</div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(debugSnap).map(([k, v]) => (
                <div key={k} className="rounded-xl border border-white/10 bg-black/10 p-4">
                  <div className="text-white/55">{k}</div>
                  <div className="mt-1 break-all text-white/85">{String(v)}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-white/45">
              Tip: open DevTools Console and search for <span className="text-white/70">[Dashboard]</span>.
            </div>
          </div>
        ) : (
          <div className="mt-5" />
        )}

      </div>
    </Scene>
  );
}

// ==========================
// End of Version 25 — src/pages/Dashboard.tsx
// ==========================
