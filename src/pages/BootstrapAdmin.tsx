// ==========================
// Version 1 — src/pages/BootstrapAdmin.tsx
// - Temporary page to set the current logged-in user as admin (one-time)
// - Calls adminBootstrapSelf({code}) then refreshClaims()
// ==========================

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminBootstrapSelf } from "../firebase/admin";
import { useAuth } from "../auth/AuthProvider";

export default function BootstrapAdmin() {
  const nav = useNavigate();
  const { refreshClaims } = useAuth();

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      await adminBootstrapSelf({ code: code.trim() });
      await refreshClaims();
      setMsg("✅ Admin claim set. Redirecting to /admin ...");
      setTimeout(() => nav("/admin"), 600);
    } catch (e: any) {
      const m = String(e?.message ?? e);
      setMsg(`❌ Failed: ${m}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#05061A] via-[#070625] to-[#040413] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-white/12 bg-white/[0.06] backdrop-blur-xl p-6">
        <div className="text-xl font-semibold tracking-tight">Bootstrap Admin</div>
        <div className="mt-2 text-sm text-white/60">
          Temporary page. Use once to make your current user admin.
        </div>

        <div className="mt-5">
          <label className="text-xs text-white/60">Bootstrap code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste ADMIN_BOOTSTRAP_CODE"
            className="mt-2 w-full rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2 text-sm outline-none focus:border-white/25"
          />
        </div>

        <button
          onClick={run}
          disabled={busy || !code.trim()}
          className="mt-4 w-full rounded-xl border border-white/12 bg-white/[0.10] px-4 py-2 text-sm font-semibold hover:bg-white/[0.14] disabled:opacity-40"
        >
          {busy ? "Working…" : "Make me admin"}
        </button>

        {msg ? <div className="mt-4 text-xs text-white/70 whitespace-pre-wrap">{msg}</div> : null}

        <div className="mt-4 text-[11px] text-white/45">
          After you become admin, we’ll remove this route/page and delete the secret.
        </div>
      </div>
    </div>
  );
}

// ==========================
// End of Version 1 — src/pages/BootstrapAdmin.tsx
// ==========================
