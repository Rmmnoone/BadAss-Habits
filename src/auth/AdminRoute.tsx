// ==========================
// Version 1 — src/auth/AdminRoute.tsx
// - Admin-only route guard (requires custom claim: { admin: true })
// - Uses AuthProvider's isAdmin flag
// ==========================

import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm opacity-70">Loading…</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
}

// ==========================
// End of Version 1 — src/auth/AdminRoute.tsx
// ==========================
