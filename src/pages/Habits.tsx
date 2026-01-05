// ==========================
// Version 1 — src/pages/Habits.tsx
// - Habit CRUD page (create, rename, archive/unarchive)
// - Uses same dark/glass UI language as Dashboard
// ==========================
import React, { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { db } from "../firebase/client";
import { archiveHabit, createHabit, renameHabit, unarchiveHabit } from "../firebase/habits";
import { useHabits } from "../hooks/useHabits";

function GlassCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
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
        </div>
        <div className="relative p-5 sm:p-6">
          <h1 className="text-base sm:text-lg font-semibold tracking-tight text-white">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-white/70">{subtitle}</p> : null}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function Habits() {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const { active, archived, loading } = useHabits(uid);

  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = useMemo(() => name.trim().length >= 2 && !saving, [name, saving]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) return;
    setError(null);
    setSaving(true);
    try {
      await createHabit(db, uid, name.trim());
      setName("");
    } catch (err: any) {
      setError("Could not create habit. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function onRename(habitId: string, currentName: string) {
    if (!uid) return;
    const next = window.prompt("Rename habit:", currentName);
    if (!next || next.trim().length < 2) return;
    await renameHabit(db, uid, habitId, next.trim());
  }

  async function onArchive(habitId: string) {
    if (!uid) return;
    await archiveHabit(db, uid, habitId);
  }

  async function onUnarchive(habitId: string) {
    if (!uid) return;
    await unarchiveHabit(db, uid, habitId);
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[#05061A] via-[#070625] to-[#040413]" />
      <div className="absolute -top-36 -left-40 h-[520px] w-[520px] rounded-full bg-pink-500/28 blur-[90px]" />
      <div className="absolute top-10 -right-44 h-[620px] w-[620px] rounded-full bg-indigo-500/28 blur-[100px]" />
      <div className="absolute -bottom-52 left-1/3 h-[640px] w-[640px] rounded-full bg-purple-500/25 blur-[110px]" />

      <div className="relative p-4 sm:p-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/[0.07] px-3 py-1 text-[11px] text-white/80 backdrop-blur-2xl">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            BadAss Habits
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            <GlassCard title="Create habit" subtitle="Add a habit you want to track daily/weekly (schedule next step).">
              <form onSubmit={onCreate} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-2">Habit name</label>
                  <input
                    className="w-full rounded-xl border border-white/14 bg-white/[0.08] px-4 py-3 text-sm text-white outline-none
                               placeholder:text-white/35
                               focus:border-white/22 focus:ring-4 focus:ring-white/10"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Gym, Reading, Meditation"
                  />
                </div>

                {error ? (
                  <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={!canCreate}
                  className="w-full rounded-xl border border-white/14 bg-white/[0.10] px-4 py-3 text-sm font-semibold text-white
                             hover:bg-white/[0.14] disabled:opacity-50 disabled:hover:bg-white/[0.10]
                             shadow-[0_28px_80px_-60px_rgba(0,0,0,0.98)]"
                >
                  {saving ? "Creating…" : "Create habit"}
                </button>
              </form>
            </GlassCard>

            <GlassCard title="Your habits" subtitle="Rename or archive habits (history later).">
              {loading ? (
                <div className="text-sm text-white/70">Loading…</div>
              ) : (
                <div className="space-y-3">
                  {active.length === 0 ? (
                    <div className="text-sm text-white/65">No habits yet. Create your first one.</div>
                  ) : (
                    active.map((h) => (
                      <div
                        key={h.id}
                        className="rounded-xl border border-white/14 bg-white/[0.07] p-4 backdrop-blur-2xl
                                   shadow-[0_22px_70px_-55px_rgba(0,0,0,0.98)] flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">{h.name}</div>
                          <div className="text-xs text-white/60">Active</div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => onRename(h.id, h.name)}
                            className="rounded-lg border border-white/14 bg-white/[0.08] px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/[0.12]"
                          >
                            Rename
                          </button>
                          <button
                            onClick={() => onArchive(h.id)}
                            className="rounded-lg border border-white/14 bg-white/[0.08] px-3 py-2 text-xs font-semibold text-white/85 hover:bg-white/[0.12]"
                          >
                            Archive
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                  {archived.length > 0 ? (
                    <div className="pt-2">
                      <div className="text-xs font-semibold text-white/70 mb-2">Archived</div>
                      <div className="space-y-2">
                        {archived.map((h) => (
                          <div
                            key={h.id}
                            className="rounded-xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur-2xl flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-white/80 truncate">{h.name}</div>
                              <div className="text-xs text-white/50">Archived</div>
                            </div>

                            <button
                              onClick={() => onUnarchive(h.id)}
                              className="rounded-lg border border-white/14 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/[0.10]"
                            >
                              Restore
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================
// End of Version 1 — src/pages/Habits.tsx
// ==========================
