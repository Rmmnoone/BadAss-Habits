// ==========================
// Version 1 — src/components/ui/StatTile.tsx
// - Shared stat tile used on Dashboard/History
// ==========================

//import React from "react";

export default function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl border border-white/14 bg-white/[0.07] p-4 backdrop-blur-2xl
                 shadow-[0_20px_60px_-50px_rgba(0,0,0,0.98)]"
    >
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

// ==========================
// End of Version 1 — src/components/ui/StatTile.tsx
// ==========================
