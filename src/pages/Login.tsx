// ==========================
// Version 4 — src/pages/Login.tsx
// - v3 + "Continue with Google" button
// - Keeps email/password login
// ==========================
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import AuthLayout from "../components/AuthLayout";

function friendlyFirebaseError(message: string) {
  if (message.includes("auth/invalid-credential")) return "Email or password is incorrect.";
  if (message.includes("auth/too-many-requests")) return "Too many attempts. Try again later.";
  if (message.includes("auth/popup-closed-by-user")) return "Google sign-in was cancelled.";
  if (message.includes("auth/popup-blocked")) return "Popup blocked — continuing with redirect…";
  return "Login failed. Please try again.";
}

export default function Login() {
  const { login, loginWithGoogle } = useAuth();
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      nav("/");
    } catch (err: any) {
      setError(friendlyFirebaseError(err?.message ?? ""));
    } finally {
      setSubmitting(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setGoogleSubmitting(true);
    try {
      await loginWithGoogle();
      // If redirect fallback happens, navigation won't run here (page will redirect).
      nav("/");
    } catch (err: any) {
      setError(friendlyFirebaseError(err?.message ?? ""));
    } finally {
      setGoogleSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to keep your habits synced across devices."
      topRightLink={{ to: "/register", label: "Create account" }}
    >
      <div className="space-y-4">
        <button
          type="button"
          onClick={onGoogle}
          disabled={googleSubmitting || submitting}
          className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white
                     bg-white/[0.08] hover:bg-white/[0.12] disabled:opacity-60
                     border border-white/14 backdrop-blur-2xl
                     shadow-[0_22px_70px_-55px_rgba(0,0,0,0.98)]"
        >
          {googleSubmitting ? "Connecting…" : "Continue with Google"}
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <div className="text-[11px] text-white/45">or</div>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/70 mb-2">Email</label>
            <input
              className="w-full rounded-xl border border-white/14 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none
                         placeholder:text-white/35 backdrop-blur-2xl
                         focus:border-white/25 focus:ring-4 focus:ring-white/10"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-white/70">Password</label>
              <span className="text-xs text-white/45">Forgot password (later)</span>
            </div>
            <input
              className="w-full rounded-xl border border-white/14 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none
                         placeholder:text-white/35 backdrop-blur-2xl
                         focus:border-white/25 focus:ring-4 focus:ring-white/10"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || googleSubmitting}
            className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white
                       bg-white/10 hover:bg-white/14 disabled:opacity-60 disabled:hover:bg-white/10
                       border border-white/14 backdrop-blur-2xl
                       shadow-[0_22px_70px_-55px_rgba(0,0,0,0.98)]"
          >
            {submitting ? "Logging in…" : "Log in"}
          </button>

          <div className="text-center text-xs text-white/55">
            Don’t have an account?{" "}
            <Link to="/register" className="font-medium text-white/80 hover:text-white underline underline-offset-4">
              Register
            </Link>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}

// ==========================
// End of Version 4 — src/pages/Login.tsx
// ==========================
