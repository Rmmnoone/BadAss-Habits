// ==========================
// Version 10 — src/components/AuthLayout.tsx
// - v9 + centered auth header stack (logo, link, tagline)
// - Uses shared <Scene/> for consistent background
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
        <div className="mb-4 flex flex-col items-center text-center">
          <div className="min-w-0">
            <img
              src="/logo-badasshabits.png"
              alt="BadAss Habits"
              className="mx-auto w-auto max-w-full object-contain
                         drop-shadow-[0_14px_28px_rgba(190,242,100,0.18)]"
            />
          </div>

          {topRightLink ? (
            <Link
              to={topRightLink.to}
              className="mt-3 text-xs font-medium text-white/70 hover:text-white underline-offset-4 hover:underline"
            >
              {topRightLink.label}
            </Link>
          ) : (
            <span />
          )}

          <div
            className="mt-3 inline-flex items-center rounded-full border border-lime-300/20
                       bg-lime-400/10 px-3 py-1 text-[10px] font-semibold uppercase
                       tracking-[0.24em] text-lime-200/90 backdrop-blur-2xl"
          >
            Track. Build. Repeat.
          </div>
        </div>

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
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">{title}</h1>
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
// End of Version 10 — src/components/AuthLayout.tsx
// ==========================
