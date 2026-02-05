// ==========================
// Version 1 — src/components/ui/Segment.tsx
// - Shared segmented filter buttons (All/Exact/Digest, Overall/Habit, ranges)
// - Prevents style drift
// ==========================

//import React from "react";

type SegmentKey = string;

export default function Segment({
  items,
  value,
  onChange,
  size = "sm",
}: {
  items: { key: SegmentKey; label: string }[];
  value: SegmentKey;
  onChange: (k: SegmentKey) => void;
  size?: "xs" | "sm";
}) {
  const pad = size === "xs" ? "px-3 py-2 text-xs" : "px-4 py-2 text-sm";
  const radius = "rounded-xl";

  return (
    <div className="flex items-center gap-2">
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className={`${radius} border ${pad} font-semibold backdrop-blur-2xl transition
              ${
                active
                  ? "border-white/30 bg-white/[0.10] text-white ring-2 ring-white/25"
                  : "border-white/14 bg-white/[0.05] text-white/70 hover:bg-white/[0.10] hover:text-white/85"
              }`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

// ==========================
// End of Version 1 — src/components/ui/Segment.tsx
// ==========================
