// ==========================
// Version 5 — src/App.tsx
// - Adds Habit Details route: /habits/:habitId
// - Keeps existing routes + NotFound styling
// ==========================
import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";

import { AuthProvider } from "./auth/AuthProvider";
import ProtectedRoute from "./auth/ProtectedRoute";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Habits from "./pages/Habits";
import History from "./pages/History";
import HabitDetails from "./pages/HabitDetails";

function WaveLayer() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* White wave set */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.22]"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="nfWaveWhite" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="0.45" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.35)" />
          </linearGradient>
          <filter id="nfSoften" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.35" />
          </filter>
        </defs>

        {Array.from({ length: 10 }).map((_, i) => {
          const y = 120 + i * 70;
          return (
            <path
              key={`nf-w1-${i}`}
              d={`M -40 ${y}
                  C 200 ${y - 40}, 420 ${y + 40}, 640 ${y}
                  S 1080 ${y - 40}, 1480 ${y}`}
              fill="none"
              stroke="url(#nfWaveWhite)"
              strokeWidth="1"
              opacity={0.55 - i * 0.03}
              filter="url(#nfSoften)"
            />
          );
        })}
      </svg>

      {/* Neon wave set */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.18] mix-blend-screen"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="nfWaveNeon" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(236,72,153,0.55)" />
            <stop offset="0.5" stopColor="rgba(99,102,241,0.55)" />
            <stop offset="1" stopColor="rgba(168,85,247,0.55)" />
          </linearGradient>
          <filter id="nfGlow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="0.9" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {Array.from({ length: 7 }).map((_, i) => {
          const y = 170 + i * 95;
          return (
            <path
              key={`nf-w2-${i}`}
              d={`M -60 ${y}
                  C 220 ${y - 55}, 480 ${y + 55}, 720 ${y}
                  S 1180 ${y - 55}, 1500 ${y}`}
              fill="none"
              stroke="url(#nfWaveNeon)"
              strokeWidth="1.2"
              opacity={0.24 - i * 0.02}
              filter="url(#nfGlow)"
            />
          );
        })}
      </svg>
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Canvas */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#05061A] via-[#070625] to-[#040413]" />

      {/* Glows */}
      <div className="absolute -top-36 -left-40 h-[520px] w-[520px] rounded-full bg-pink-500/28 blur-[90px]" />
      <div className="absolute top-10 -right-44 h-[620px] w-[620px] rounded-full bg-indigo-500/28 blur-[100px]" />
      <div className="absolute -bottom-52 left-1/3 h-[640px] w-[640px] rounded-full bg-purple-500/25 blur-[110px]" />

      {/* Texture lines */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.60]">
        <div
          className="
            absolute inset-0
            [background:
              radial-gradient(1200px_circle_at_20%_0%,rgba(236,72,153,0.12),transparent_45%),
              radial-gradient(1200px_circle_at_90%_25%,rgba(99,102,241,0.12),transparent_45%),
              radial-gradient(1000px_circle_at_45%_110%,rgba(168,85,247,0.12),transparent_45%),
              repeating-linear-gradient(
                165deg,
                rgba(255,255,255,0.16) 0px,
                rgba(255,255,255,0.16) 1px,
                transparent 1px,
                transparent 22px
              ),
              repeating-linear-gradient(
                12deg,
                rgba(255,255,255,0.08) 0px,
                rgba(255,255,255,0.08) 1px,
                transparent 1px,
                transparent 28px
              )
            ]
            blur-[0.15px]
          "
        />
      </div>

      {/* Visible waves */}
      <WaveLayer />

      {/* Fine noise grid */}
      <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.55)_1px,transparent_0)] [background-size:22px_22px]" />

      <div className="relative min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* App pill */}
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 text-[11px] text-white/80 backdrop-blur-2xl">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            BadAss Habits
          </div>

          {/* Glass card */}
          <div className="relative rounded-2xl overflow-hidden">
            <div
              className="pointer-events-none absolute -inset-[1px] rounded-2xl opacity-70 blur
                         bg-[radial-gradient(1200px_circle_at_20%_0%,rgba(236,72,153,0.20),transparent_45%),radial-gradient(1200px_circle_at_90%_30%,rgba(99,102,241,0.20),transparent_45%),radial-gradient(1000px_circle_at_40%_110%,rgba(168,85,247,0.18),transparent_45%)]"
            />

            <div
              className="relative rounded-2xl border border-white/14
                         bg-gradient-to-b from-white/[0.10] to-white/[0.04]
                         backdrop-blur-2xl
                         shadow-[0_44px_110px_-70px_rgba(0,0,0,0.98)]"
            >
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),transparent_35%,transparent_70%,rgba(0,0,0,0.22))]" />
                <div className="absolute -top-24 -left-24 h-56 w-56 rounded-full bg-white/12 blur-2xl" />
                <div className="absolute -bottom-28 -right-28 h-64 w-64 rounded-full bg-black/30 blur-2xl" />
              </div>

              <div className="relative p-6 sm:p-7 text-center">
                <div className="text-white text-4xl font-semibold tracking-tight">404</div>
                <div className="mt-2 text-white/75 text-sm">Page not found</div>

                <div className="mt-6 flex items-center justify-center gap-2">
                  <Link
                    to="/"
                    className="inline-flex items-center rounded-xl border border-white/14 bg-white/[0.10] px-4 py-2 text-sm font-semibold text-white
                               hover:bg-white/[0.14]
                               shadow-[0_28px_80px_-60px_rgba(0,0,0,0.98)]"
                  >
                    Back to Dashboard
                  </Link>

                  <Link
                    to="/habits"
                    className="inline-flex items-center rounded-xl border border-white/14 bg-white/[0.08] px-4 py-2 text-sm font-semibold text-white/90
                               hover:bg-white/[0.12]"
                  >
                    Go to Habits
                  </Link>
                </div>

                <div className="mt-5 text-xs text-white/45">
                  If you typed the URL manually, double-check the spelling.
                </div>
              </div>

              <div className="border-t border-white/12 px-6 sm:px-7 py-4 text-xs text-white/55 text-center">
                <span className="text-white/70">Tip:</span> Keep going — streaks come next 😎
              </div>
            </div>
          </div>
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

          <Route
            path="/habits/:habitId"
            element={
              <ProtectedRoute>
                <HabitDetails />
              </ProtectedRoute>
            }
          />

          <Route
            path="/history"
            element={
              <ProtectedRoute>
                <History />
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
// End of Version 5 — src/App.tsx
// ==========================
