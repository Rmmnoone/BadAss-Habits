// ==========================
// Version 1 — src/pages/VerifyEmail.tsx
// - Email verification gate for password-auth users
// - Allows resend + refresh after clicking email link
// ==========================
import { useState } from "react";
import { Navigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { useAuth } from "../auth/AuthProvider";

export default function VerifyEmail() {
  const { user, loading, needsEmailVerification, sendVerificationEmail, refreshUser, logout } = useAuth();
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm opacity-70">Loading…</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!needsEmailVerification) return <Navigate to="/" replace />;

  async function onResend() {
    setError(null);
    setMessage(null);
    setSending(true);
    try {
      await sendVerificationEmail();
      setMessage("Verification email sent. Check your inbox and spam folder.");
    } catch (e: any) {
      setError(e?.message ? String(e.message) : "Could not send verification email.");
    } finally {
      setSending(false);
    }
  }

  async function onRefresh() {
    setError(null);
    setMessage(null);
    setRefreshing(true);
    try {
      await refreshUser();
      setMessage("Account status refreshed.");
    } catch (e: any) {
      setError(e?.message ? String(e.message) : "Could not refresh account status.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <AuthLayout
      title="Verify your email"
      subtitle="Open the link we sent you, then come back here and refresh."
      topRightLink={{ to: "/login", label: "Back to login" }}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-white/14 bg-white/[0.06] px-4 py-4 text-sm text-white/80">
          Signed in as <span className="font-semibold text-white">{user.email}</span>
        </div>

        <div className="rounded-xl border border-amber-300/25 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
          Email verification is required before you can use the app with email/password sign-in.
        </div>

        {message ? (
          <div className="rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={onResend}
          disabled={sending || refreshing}
          className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white
                     bg-white/[0.08] hover:bg-white/[0.12] disabled:opacity-60
                     border border-white/14 backdrop-blur-2xl
                     shadow-[0_22px_70px_-55px_rgba(0,0,0,0.98)]"
        >
          {sending ? "Sending…" : "Resend verification email"}
        </button>

        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing || sending}
          className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white
                     bg-white/10 hover:bg-white/14 disabled:opacity-60 disabled:hover:bg-white/10
                     border border-white/14 backdrop-blur-2xl
                     shadow-[0_22px_70px_-55px_rgba(0,0,0,0.98)]"
        >
          {refreshing ? "Refreshing…" : "I verified, refresh now"}
        </button>

        <button
          type="button"
          onClick={logout}
          className="w-full text-xs font-medium text-white/65 hover:text-white"
        >
          Sign out
        </button>
      </div>
    </AuthLayout>
  );
}

// ==========================
// End of Version 1 — src/pages/VerifyEmail.tsx
// ==========================
