// ==========================
// Version 5 — src/components/AuthLayout.tsx
// - Uses shared <Scene/> for consistent BadAss Habits background
// - Fix: preserves Scene wrapper positioning (relative + overflow-hidden)
// - Keeps glass/3D card + top pill + link
// ==========================
import React from "react";
import { Link } from "react-router-dom";
import Scene from "./Scene";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  topRightLink?: { to: string; label: string };
};

export default function AuthLayout({ title, subtitle, children, topRightLink }: Props) {
  return (
    <Scene
      className="min-h-screen relative overflow-hidden"
      contentClassName="relative min-h-screen flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md">
        {/* Small top row */}
        <div className="flex items-center justify-between mb-4">
          <div
            className="inline-flex items-center gap-2 rounded-full border border-white/14
                       bg-white/[0.07] px-3 py-1 text-xs backdrop-blur-2xl text-white/80"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            BadAss Habits
          </div>

          {topRightLink ? (
            <Link
              to={topRightLink.to}
              className="text-xs font-medium text-white/70 hover:text-white underline-offset-4 hover:underline"
            >
              {topRightLink.label}
            </Link>
          ) : (
            <span />
          )}
        </div>

        {/* Glass / 3D Card */}
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

            <div className="relative p-6 sm:p-7">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                {title}
              </h1>
              {subtitle ? <p className="mt-2 text-sm text-white/70">{subtitle}</p> : null}

              <div className="mt-6">{children}</div>
            </div>

            <div className="border-t border-white/12 px-6 sm:px-7 py-4 text-xs text-white/55">
              <span className="text-white/70">Tip:</span> Install this app on mobile for the best experience.
            </div>
          </div>
        </div>
      </div>
    </Scene>
  );
}

// ==========================
// End of Version 5 — src/components/AuthLayout.tsx
// ==========================
