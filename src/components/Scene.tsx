// ==========================
// Version 1 — src/components/Scene.tsx
// - Shared BadAss Habits background: canvas + glows + texture lines + layered SVG waves + noise grid
// - Centralizes the "Dashboard/Habits" scene so pages don't duplicate background code
// ==========================
import React from "react";

type SceneProps = {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
};

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
          <linearGradient id="sceneWaveWhite" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="0.45" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="1" stopColor="rgba(255,255,255,0.35)" />
          </linearGradient>
          <filter id="sceneSoften" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.35" />
          </filter>
        </defs>

        {Array.from({ length: 10 }).map((_, i) => {
          const y = 120 + i * 70;
          return (
            <path
              key={`scene-w1-${i}`}
              d={`M -40 ${y}
                  C 200 ${y - 40}, 420 ${y + 40}, 640 ${y}
                  S 1080 ${y - 40}, 1480 ${y}`}
              fill="none"
              stroke="url(#sceneWaveWhite)"
              strokeWidth="1"
              opacity={0.55 - i * 0.03}
              filter="url(#sceneSoften)"
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
          <linearGradient id="sceneWaveNeon" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="rgba(236,72,153,0.55)" />
            <stop offset="0.5" stopColor="rgba(99,102,241,0.55)" />
            <stop offset="1" stopColor="rgba(168,85,247,0.55)" />
          </linearGradient>
          <filter id="sceneGlow" x="-30%" y="-30%" width="160%" height="160%">
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
              key={`scene-w2-${i}`}
              d={`M -60 ${y}
                  C 220 ${y - 55}, 480 ${y + 55}, 720 ${y}
                  S 1180 ${y - 55}, 1500 ${y}`}
              fill="none"
              stroke="url(#sceneWaveNeon)"
              strokeWidth="1.2"
              opacity={0.24 - i * 0.02}
              filter="url(#sceneGlow)"
            />
          );
        })}
      </svg>
    </div>
  );
}

export default function Scene({
  children,
  className = "min-h-screen relative overflow-hidden",
  contentClassName = "relative",
}: SceneProps) {
  return (
    <div className={className}>
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

      <div className={contentClassName}>{children}</div>
    </div>
  );
}

// ==========================
// End of Version 1 — src/components/Scene.tsx
// ==========================
