// ==========================
// Version 2 — src/App.tsx
// - Converts Tailwind smoke test into real app router
// - Wraps app with AuthProvider
// - Adds ProtectedRoute for authenticated pages
// - Routes:
//   /login (public)
//   /register (public)
//   / (protected -> Dashboard)
//   /habits (protected -> Habits CRUD)
// ==========================
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./auth/AuthProvider";
import ProtectedRoute from "./auth/ProtectedRoute";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Habits from "./pages/Habits";

function NotFound() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#05061A] via-[#070625] to-[#040413]" />
      <div className="relative min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-white text-2xl font-semibold">404</div>
          <div className="mt-2 text-white/70 text-sm">Page not found</div>
          <a
            href="/"
            className="mt-6 inline-flex items-center rounded-xl border border-white/14 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/[0.12]"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/habits"
            element={
              <ProtectedRoute>
                <Habits />
              </ProtectedRoute>
            }
          />

          {/* Convenience redirect */}
          <Route path="/dashboard" element={<Navigate to="/" replace />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

// ==========================
// End of Version 2 — src/App.tsx
// ==========================
