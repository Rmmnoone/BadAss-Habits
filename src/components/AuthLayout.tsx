// ==========================
// Version 3 — src/components/AuthLayout.tsx
// - Branding update: "BadAss Habits" (replaces "Habit Tracker")
// - Keeps dark theme + wave lines + glass/3D card
// ==========================
import React from "react";
import { Link } from "react-router-dom";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  topRightLink?: { to: string; label: string };
};

export default function AuthLayout({ title, subtitle, children, topRightLink }: Props) {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Dark canvas */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#05061A] via-[#070625] to-[#040413]" />

      {/* Sharper glow blobs */}
      <div className="absolute -top-36 -left-40 h-[520px] w-[520px] rounded-full bg-pink-500/28 blur-[90px]" />
      <div className="absolute top-10 -right-44 h-[620px] w-[620px] rounded-full bg-indigo-500/28 blur-[100px]" />
      <div className="absolute -bottom-52 left-1/3 h-[640px] w-[640px] rounded-full bg-purple-500/25 blur-[110px]" />

      {/* Visible wave lines */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.55]">
        <div
          className="
            absolute inset-0
            [background:
              radial-gradient(1200px_circle_at_20%_0%,rgba(236,72,153,0.12),transparent_45%),
              radial-gradient(1200px_circle_at_90%_25%,rgba(99,102,241,0.12),transparent_45%),
              radial-gradient(1000px_circle_at_45%_110%,rgba(168,85,247,0.12),transparent_45%),
              repeating-linear-gradient(
                165deg,
                rgba(255,255,255,0.14) 0px,
                rgba(255,255,255,0.14) 1px,
                transparent 1px,
                transparent 22px
              ),
              repeating-linear-gradient(
                12deg,
                rgba(255,255,255,0.06) 0px,
                rgba(255,255,255,0.06) 1px,
                transparent 1px,
                transparent 28px
              )
            ]
            blur-[0.2px]
          "
        />
      </div>

      {/* Fine noise grid */}
      <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.55)_1px,transparent_0)] [background-size:22px_22px]" />

      <div className="relative min-h-screen flex items-center justify-center p-4">
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
      </div>
    </div>
  );
}

// ==========================
// End of Version 3 — src/components/AuthLayout.tsx
// ==========================
