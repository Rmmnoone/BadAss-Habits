import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import Scene from "../components/Scene";
import { UserAvatar, getUserHeaderName, isGoogleUser } from "../components/UserIdentity";
import { useAuth } from "../auth/AuthProvider";
import { db } from "../firebase/client";
import { setUserNames } from "../firebase/users";
import { useHabits } from "../hooks/useHabits";

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

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className="text-xs text-white/55">{label}</div>
      <div className="text-sm font-medium text-white/88 text-right">{value}</div>
    </div>
  );
}

function ChangePasswordModal({
  open,
  saving,
  currentPassword,
  nextPassword,
  confirmPassword,
  ui,
  onClose,
  onCurrentPasswordChange,
  onNextPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
}: {
  open: boolean;
  saving: boolean;
  currentPassword: string;
  nextPassword: string;
  confirmPassword: string;
  ui: string | null;
  onClose: () => void;
  onCurrentPasswordChange: (value: string) => void;
  onNextPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: () => void;
}) {
  if (!open) return null;

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
              <div className="text-sm font-semibold text-white">Change Password</div>
              <div className="mt-1 text-xs text-white/60">
                Confirm your current password, then choose a new one.
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
            <label className="flex flex-col gap-2">
              <span className="text-xs text-white/60">Current password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => onCurrentPasswordChange(e.target.value)}
                className="h-11 rounded-xl border border-white/14 bg-white/[0.08] px-4 text-sm text-white outline-none
                           placeholder:text-white/35 focus:border-white/22 focus:ring-4 focus:ring-white/10"
                placeholder="Current password"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs text-white/60">New password</span>
              <input
                type="password"
                value={nextPassword}
                onChange={(e) => onNextPasswordChange(e.target.value)}
                className="h-11 rounded-xl border border-white/14 bg-white/[0.08] px-4 text-sm text-white outline-none
                           placeholder:text-white/35 focus:border-white/22 focus:ring-4 focus:ring-white/10"
                placeholder="At least 6 characters"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs text-white/60">Confirm new password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => onConfirmPasswordChange(e.target.value)}
                className="h-11 rounded-xl border border-white/14 bg-white/[0.08] px-4 text-sm text-white outline-none
                           placeholder:text-white/35 focus:border-white/22 focus:ring-4 focus:ring-white/10"
                placeholder="Repeat new password"
              />
            </label>

            {ui ? <div className="text-[11px] text-white/60">{ui}</div> : null}

            <button
              type="button"
              onClick={onSubmit}
              disabled={saving}
              className="w-full rounded-xl border border-white/14 bg-white/[0.10] px-4 py-3 text-sm font-semibold text-white
                         hover:bg-white/[0.14] disabled:opacity-50 disabled:hover:bg-white/[0.10]
                         shadow-[0_28px_80px_-60px_rgba(0,0,0,0.98)]"
            >
              {saving ? "Updating…" : "Update password"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function splitName(displayName?: string | null) {
  const clean = String(displayName ?? "").trim();
  if (!clean) return { firstName: "—", surname: "—" };
  const [first, ...rest] = clean.split(/\s+/g);
  return {
    firstName: first || "—",
    surname: rest.length ? rest.join(" ") : "—",
  };
}

function providerLabel(providerId?: string) {
  if (providerId === "google.com") return "Google";
  if (providerId === "password") return "Email / Password";
  return providerId || "Unknown";
}

type UserSettings = {
  firstName?: string;
  lastName?: string;
  timezone?: string;
  remindersEnabled?: boolean;
  quietHours?: {
    enabled?: boolean;
    start?: string;
    end?: string;
  };
};

export default function Profile() {
  const { user, logout, emailVerified, refreshUser } = useAuth();
  const uid = user?.uid ?? null;
  const { active, archived, loading: habitsLoading } = useHabits(uid);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [firstNameInput, setFirstNameInput] = useState("");
  const [surnameInput, setSurnameInput] = useState("");
  const [savingNames, setSavingNames] = useState(false);
  const [nameUi, setNameUi] = useState<string | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordUi, setPasswordUi] = useState<string | null>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!mobileMenuOpen) return;
      const el = menuRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      setMobileMenuOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [mobileMenuOpen]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!uid) {
        setSettings(null);
        setSettingsLoading(false);
        return;
      }

      setSettingsLoading(true);
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (cancelled) return;
        setSettings(snap.exists() ? (snap.data() as UserSettings) : null);
      } finally {
        if (!cancelled) setSettingsLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const fallbackName = useMemo(() => splitName(user?.displayName), [user?.displayName]);
  const firstName = settings?.firstName?.trim() || fallbackName.firstName;
  const surname = settings?.lastName?.trim() || fallbackName.surname;
  const primaryProvider = user?.providerData?.[0]?.providerId ?? undefined;
  const provider = providerLabel(primaryProvider);
  const canEditNames = Boolean(user && !isGoogleUser(user));
  const quietSummary = settings?.quietHours?.enabled
    ? `${settings?.quietHours?.start || "22:00"} – ${settings?.quietHours?.end || "07:00"}`
    : "Off";

  useEffect(() => {
    setFirstNameInput(firstName === "—" ? "" : firstName);
    setSurnameInput(surname === "—" ? "" : surname);
  }, [firstName, surname]);

  const namesDirty = firstNameInput.trim() !== (firstName === "—" ? "" : firstName) || surnameInput.trim() !== (surname === "—" ? "" : surname);
  const canSaveNames = canEditNames && !savingNames && firstNameInput.trim().length >= 2 && surnameInput.trim().length >= 2 && namesDirty;

  async function onSaveNames() {
    if (!uid || !user || !canSaveNames) return;

    setSavingNames(true);
    setNameUi(null);
    try {
      const nextDisplayName = `${firstNameInput.trim()} ${surnameInput.trim()}`.trim();
      await updateProfile(user, { displayName: nextDisplayName });
      await setUserNames(db, uid, {
        firstName: firstNameInput,
        lastName: surnameInput,
        email: user.email,
      });
      await refreshUser();
      setSettings((prev) => ({
        ...(prev ?? {}),
        firstName: firstNameInput.trim(),
        lastName: surnameInput.trim(),
      }));
      setNameUi("Name updated.");
    } catch {
      setNameUi("Could not update your name right now.");
    } finally {
      setSavingNames(false);
    }
  }

  async function onChangePassword() {
    if (!user || !user.email || isGoogleUser(user)) return;

    setPasswordUi(null);

    if (!currentPassword || !nextPassword || !confirmPassword) {
      setPasswordUi("Fill in all password fields.");
      return;
    }

    if (nextPassword.length < 6) {
      setPasswordUi("New password must be at least 6 characters.");
      return;
    }

    if (nextPassword !== confirmPassword) {
      setPasswordUi("New password and confirmation do not match.");
      return;
    }

    setSavingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, nextPassword);
      setPasswordUi("Password updated.");
      setCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
      window.setTimeout(() => {
        setPasswordModalOpen(false);
        setPasswordUi(null);
      }, 800);
    } catch (e: any) {
      const code = String(e?.code ?? "");
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setPasswordUi("Current password is incorrect.");
      } else if (code === "auth/too-many-requests") {
        setPasswordUi("Too many attempts. Try again later.");
      } else {
        setPasswordUi("Could not update password right now.");
      }
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <Scene className="min-h-screen relative overflow-hidden" contentClassName="relative p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar user={user} />

            <div className="min-w-0">
              <div className="mb-1 inline-flex items-center gap-3 rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 text-[11px] text-white/80 backdrop-blur-2xl">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                BadAss Habits
              </div>

              <div className="text-sm font-semibold text-white">Profile</div>
              <div className="text-xs text-white/60 truncate">
                {user?.displayName ? getUserHeaderName(user) : user?.email}
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <Link
              to="/"
              className="rounded-xl border border-white/14 bg-gradient-to-b from-white/[0.12] to-white/[0.05]
               backdrop-blur-2xl px-4 py-2 text-sm font-semibold text-white/90
               hover:from-white/[0.16] hover:to-white/[0.07] transition"
            >
              Dashboard
            </Link>

            <Link
              to="/habits"
              className="rounded-xl border border-white/14 bg-gradient-to-b from-white/[0.12] to-white/[0.05]
               backdrop-blur-2xl px-4 py-2 text-sm font-semibold text-white/90
               hover:from-white/[0.16] hover:to-white/[0.07] transition"
            >
              Habits
            </Link>

            <Link
              to="/history"
              className="rounded-xl border border-white/14 bg-gradient-to-b from-white/[0.12] to-white/[0.05]
               backdrop-blur-2xl px-4 py-2 text-sm font-semibold text-white/90
               hover:from-white/[0.16] hover:to-white/[0.07] transition"
            >
              History
            </Link>

            <button
              onClick={logout}
              className="rounded-xl border border-white/14 bg-gradient-to-b from-white/[0.12] to-white/[0.05]
               backdrop-blur-2xl px-4 py-2 text-sm font-semibold text-white/90
               hover:from-white/[0.16] hover:to-white/[0.07] transition"
            >
              Logout
            </button>
          </div>

          <div ref={menuRef} className="sm:hidden relative">
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="h-10 w-10 rounded-xl border border-white/14 bg-white/[0.10]
               flex items-center justify-center text-white text-lg"
              aria-label="Open menu"
            >
              ☰
            </button>

            {mobileMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-40 rounded-xl border border-white/14
                 bg-[#0b0c24]/90 backdrop-blur-xl shadow-xl z-50"
              >
                <Link
                  to="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 text-sm text-white/90 hover:bg-white/[0.08]"
                >
                  Dashboard
                </Link>
                <Link
                  to="/habits"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 text-sm text-white/90 hover:bg-white/[0.08]"
                >
                  Habits
                </Link>
                <Link
                  to="/history"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-3 text-sm text-white/90 hover:bg-white/[0.08]"
                >
                  History
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="w-full text-left px-4 py-3 text-sm text-white/90 hover:bg-white/[0.08]"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          <div className="lg:col-span-2">
            <DarkCard
              title="Personal Info"
              subtitle={
                canEditNames
                  ? "Email/password users can update first name and surname here."
                  : "Basic account details. Google-managed identity fields stay read-only."
              }
              right={
                <span className="inline-flex items-center rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 text-xs text-white/75 backdrop-blur-2xl">
                  {canEditNames ? "Editable" : "Read only"}
                </span>
              }
            >
              <div className="space-y-3">
                {canEditNames ? (
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="flex flex-col gap-2">
                        <span className="text-xs text-white/55">First name</span>
                        <input
                          value={firstNameInput}
                          onChange={(e) => {
                            setFirstNameInput(e.target.value);
                            setNameUi(null);
                          }}
                          className="h-11 rounded-xl border border-white/14 bg-white/[0.08] px-4 text-sm text-white outline-none
                                     placeholder:text-white/35 focus:border-white/22 focus:ring-4 focus:ring-white/10"
                          placeholder="First name"
                        />
                      </label>

                      <label className="flex flex-col gap-2">
                        <span className="text-xs text-white/55">Surname</span>
                        <input
                          value={surnameInput}
                          onChange={(e) => {
                            setSurnameInput(e.target.value);
                            setNameUi(null);
                          }}
                          className="h-11 rounded-xl border border-white/14 bg-white/[0.08] px-4 text-sm text-white outline-none
                                     placeholder:text-white/35 focus:border-white/22 focus:ring-4 focus:ring-white/10"
                          placeholder="Surname"
                        />
                      </label>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="text-[11px] text-white/45">These fields update your account name only. Email stays unchanged.</div>
                      <button
                        type="button"
                        onClick={onSaveNames}
                        disabled={!canSaveNames}
                        className="rounded-xl border border-white/14 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white/90
                                   hover:bg-white/[0.12] disabled:opacity-50 disabled:hover:bg-white/[0.08]"
                      >
                        {savingNames ? "Saving…" : "Save name"}
                      </button>
                    </div>

                    {nameUi ? <div className="mt-2 text-[11px] text-white/60">{nameUi}</div> : null}
                  </div>
                ) : (
                  <>
                    <InfoRow label="First name" value={firstName} />
                    <InfoRow label="Surname" value={surname} />
                  </>
                )}

                <InfoRow label="Email" value={user?.email ?? "—"} />
                <InfoRow label="Provider" value={provider} />
                {!isGoogleUser(user) ? (
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-xs text-white/55">Password</div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-white/88">••••••••</span>
                        <button
                          type="button"
                          onClick={() => {
                            setPasswordUi(null);
                            setPasswordModalOpen(true);
                          }}
                          className="rounded-lg border border-white/14 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/[0.10]"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 text-[11px] text-white/55">
                      For security, password changes are handled in a protected popup card.
                    </div>
                  </div>
                ) : null}
              </div>
            </DarkCard>
          </div>

          <div className="lg:col-span-1">
            <DarkCard title="Overview" subtitle="Quick snapshot of your account.">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Active habits", value: habitsLoading ? "…" : String(active.length) },
                  { label: "Archived", value: habitsLoading ? "…" : String(archived.length) },
                  { label: "Verified", value: emailVerified ? "Yes" : "No" },
                  { label: "Provider", value: isGoogleUser(user) ? "Google" : "Email" },
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
            </DarkCard>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mt-4 sm:mt-5">
          <DarkCard title="Account" subtitle="Verification and sign-in details from Firebase Authentication.">
            <div className="space-y-3">
              <InfoRow label="Email verification" value={emailVerified ? "Verified" : "Pending"} />
              <InfoRow label="Created" value={formatDateTime(user?.metadata.creationTime)} />
              <InfoRow label="Last sign-in" value={formatDateTime(user?.metadata.lastSignInTime)} />
              <InfoRow label="User ID" value={<span className="break-all">{uid ?? "—"}</span>} />
            </div>
          </DarkCard>

          <DarkCard title="Preferences" subtitle="Current app-level settings stored on your profile.">
            {settingsLoading ? (
              <div className="text-sm text-white/70">Loading…</div>
            ) : (
              <div className="space-y-3">
                <InfoRow label="Timezone" value={settings?.timezone ?? "—"} />
                <InfoRow label="Reminders" value={settings?.remindersEnabled === false ? "Off" : "On"} />
                <InfoRow label="Quiet hours" value={quietSummary} />
                <InfoRow label="Profile photo" value={isGoogleUser(user) && user?.photoURL ? "Google account" : "Not set"} />
              </div>
            )}
          </DarkCard>
        </div>

        <div className="mt-4 sm:mt-5">
          <DarkCard title="Quick Links" subtitle="Jump back into the parts of the app you use most.">
            <div className="flex flex-wrap gap-3">
              <Link
                to="/"
                className="rounded-xl border border-white/14 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white/90
                           hover:bg-white/[0.12] shadow-[0_18px_55px_-45px_rgba(0,0,0,0.98)]"
              >
                Go to Dashboard
              </Link>
              <Link
                to="/habits"
                className="rounded-xl border border-white/14 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white/90
                           hover:bg-white/[0.12] shadow-[0_18px_55px_-45px_rgba(0,0,0,0.98)]"
              >
                Open Habits
              </Link>
              <Link
                to="/history"
                className="rounded-xl border border-white/14 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white/90
                           hover:bg-white/[0.12] shadow-[0_18px_55px_-45px_rgba(0,0,0,0.98)]"
              >
                View History
              </Link>
            </div>

            <div className="mt-4 text-[11px] text-white/45">
              Note: Google profile name and photo come directly from your Google account. Email/password users can update first name and surname here, but email remains read-only.
            </div>
          </DarkCard>
        </div>
      </div>

      <ChangePasswordModal
        open={passwordModalOpen}
        saving={savingPassword}
        currentPassword={currentPassword}
        nextPassword={nextPassword}
        confirmPassword={confirmPassword}
        ui={passwordUi}
        onClose={() => {
          if (savingPassword) return;
          setPasswordModalOpen(false);
          setPasswordUi(null);
          setCurrentPassword("");
          setNextPassword("");
          setConfirmPassword("");
        }}
        onCurrentPasswordChange={setCurrentPassword}
        onNextPasswordChange={setNextPassword}
        onConfirmPasswordChange={setConfirmPassword}
        onSubmit={onChangePassword}
      />
    </Scene>
  );
}
