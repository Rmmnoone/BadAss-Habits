// ==========================
// Version 6 — src/pages/Dashboard.tsx
// - Branding: adds "BadAss Habits" pill in header
// - Adds more visible wave lines using layered SVG waves
// - Fixes JSX array mapping in "Next up" (wraps array in { })
// - Keeps navy/purple dark canvas + glass/3D cards (same style system)
// ==========================
import React from "react";
import { useAuth } from "../auth/AuthProvider";

function initials(email?: string | null) {
  if (!email) return "U";
  const name = email.split("@")[0] || "user";
  const parts = name.split(/[._-]/g).filter(Boolean);
  const a = parts[0]?.[0] ?? "U";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

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
              <h2 className="text-base sm:text-lg font-semibold tracking-tight text-white">
                {title}
              </h2>
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
          <linearGradient id="waveWhite" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="0.45" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.35)" />
          </linearGradient>
          <filter id="soften" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.35" />
          </filter>
        </defs>

        {Array.from({ length: 10 }).map((_, i) => {
          const y = 120 + i * 70;
          return (
            <path
              key={`w1-${i}`}
              d={`M -40 ${y}
                  C 200 ${y - 40}, 420 ${y + 40}, 640 ${y}
                  S 1080 ${y - 40}, 1480 ${y}`}
              fill="none"
              stroke="url(#waveWhite)"
              strokeWidth="1"
              opacity={0.55 - i * 0.03}
              filter="url(#soften)"
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
          <linearGradient id="waveNeon" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(236,72,153,0.55)" />
            <stop offset="0.5" stopColor="rgba(99,102,241,0.55)" />
            <stop offset="1" stopColor="rgba(168,85,247,0.55)" />
          </linearGradient>
          <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
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
              key={`w2-${i}`}
              d={`M -60 ${y}
                  C 220 ${y - 55}, 480 ${y + 55}, 720 ${y}
                  S 1180 ${y - 55}, 1500 ${y}`}
              fill="none"
              stroke="url(#waveNeon)"
              strokeWidth="1.2"
              opacity={0.24 - i * 0.02}
              filter="url(#glow)"
            />
          );
        })}
      </svg>
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#05061A] via-[#070625] to-[#040413]" />

      <div className="absolute -top-36 -left-40 h-[520px] w-[520px] rounded-full bg-pink-500/28 blur-[90px]" />
      <div className="absolute top-10 -right-44 h-[620px] w-[620px] rounded-full bg-indigo-500/28 blur-[100px]" />
      <div className="absolute -bottom-52 left-1/3 h-[640px] w-[640px] rounded-full bg-purple-500/25 blur-[110px]" />

      {/* Your grid/line texture */}
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

      {/* NEW visible waves */}
      <WaveLayer />

      <div className="absolute inset-0 opacity-[0.06] bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.55)_1px,transparent_0)] [background-size:22px_22px]" />

      <div className="relative p-4 sm:p-6">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-2xl border border-white/14
                           bg-gradient-to-b from-white/[0.14] to-white/[0.06]
                           backdrop-blur-2xl
                           flex items-center justify-center text-sm font-semibold text-white/92
                           shadow-[0_24px_70px_-55px_rgba(0,0,0,0.98)]"
              >
                {initials(user?.email)}
              </div>

              <div>
                <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 text-[11px] text-white/80 backdrop-blur-2xl">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  BadAss Habits
                </div>

                <div className="text-sm font-semibold text-white">Dashboard</div>
                <div className="text-xs text-white/60">
                  Signed in as{" "}
                  <span className="font-medium text-white/80">{user?.email}</span>
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              className="rounded-xl border border-white/14
                         bg-gradient-to-b from-white/[0.12] to-white/[0.05]
                         backdrop-blur-2xl px-4 py-2 text-sm font-semibold text-white/90
                         hover:from-white/[0.16] hover:to-white/[0.07] transition
                         shadow-[0_28px_80px_-60px_rgba(0,0,0,0.98)]"
            >
              Logout
            </button>
          </div>

          {/* Top grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
            <div className="lg:col-span-2">
              <DarkCard
                title="Today"
                subtitle="Your habits for today will appear here."
                right={
                  <span className="inline-flex items-center rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 text-xs text-white/75 backdrop-blur-2xl">
                    Coming next
                  </span>
                }
              >
                <div className="rounded-xl border border-dashed border-white/16 bg-black/10 px-4 py-5">
                  <p className="text-sm text-white/70">
                    Once we build Habit CRUD, this section will show today’s list with quick
                    check-ins.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 text-xs text-white/78 backdrop-blur-2xl">
                      ✅ Check-in toggle
                    </span>
                    <span className="rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 text-xs text-white/78 backdrop-blur-2xl">
                      🕒 Due times
                    </span>
                    <span className="rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 text-xs text-white/78 backdrop-blur-2xl">
                      🔥 Streak indicator
                    </span>
                  </div>
                </div>
              </DarkCard>
            </div>

            <div className="lg:col-span-1">
              <DarkCard title="Quick stats" subtitle="A simple snapshot (placeholder)">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Active habits", value: "—" },
                    { label: "Today done", value: "—" },
                    { label: "Best streak", value: "—" },
                    { label: "Consistency", value: "—" },
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

          {/* Lower grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mt-4 sm:mt-5">
            <DarkCard
              title="Insights"
              subtitle="Streaks, trends, and history will live here."
              right={
                <span className="inline-flex items-center rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 text-xs text-white/75 backdrop-blur-2xl">
                  Analysis
                </span>
              }
            >
              <div className="rounded-xl border border-dashed border-white/16 bg-black/10 px-4 py-5">
                <p className="text-sm text-white/70">
                  After we build check-ins and history, you’ll see:
                </p>
                <ul className="mt-3 space-y-2 text-sm text-white/70">
                  <li className="flex gap-2">
                    <span className="text-white/50">•</span>
                    <span>Current streak + longest streak per habit</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-white/50">•</span>
                    <span>Completion rate over 7 / 30 / 90 days</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-white/50">•</span>
                    <span>Full habit history (calendar/heatmap later)</span>
                  </li>
                </ul>
              </div>
            </DarkCard>

            <DarkCard
              title="Next up"
              subtitle="Roadmap for the next build steps."
              right={
                <span className="inline-flex items-center rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 text-xs text-white/75 backdrop-blur-2xl">
                  MVP
                </span>
              }
            >
              <div className="space-y-3">
                {[
                  { title: "1) Habit CRUD", desc: "Create, edit, archive habits." },
                  {
                    title: "2) Schedules per habit",
                    desc: "Daily/weekly/interval/custom + per-habit reminders.",
                  },
                  {
                    title: "3) Check-ins + streaks",
                    desc: "Daily tracking + history + analysis.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-xl border border-white/14 bg-white/[0.07] p-4 backdrop-blur-2xl
                               shadow-[0_22px_70px_-55px_rgba(0,0,0,0.98)]"
                  >
                    <div className="text-sm font-semibold text-white">{item.title}</div>
                    <div className="mt-1 text-sm text-white/60">{item.desc}</div>
                  </div>
                ))}
              </div>
            </DarkCard>
          </div>

          <div className="mt-6 text-center text-xs text-white/45">
            Tip: Install the app on your phone for the best reminder experience.
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================
// End of Version 6 — src/pages/Dashboard.tsx
// ==========================
