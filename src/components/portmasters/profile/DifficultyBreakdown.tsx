"use client";

import type { CaptainLegacySummary } from "@/lib/game/legacy";

const TIERS = [
  { id: "fair_winds", name: "Fair Winds", icon: "🌤️" },
  { id: "open_waters", name: "Open Waters", icon: "🌊" },
  { id: "monsoon", name: "Monsoon", icon: "⛈️" },
];

export function DifficultyBreakdown({
  statsByDifficulty,
}: {
  statsByDifficulty: CaptainLegacySummary["statsByDifficulty"];
}) {
  return (
    <div>
      <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        By Difficulty
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {TIERS.map((t) => {
          const s = (
            statsByDifficulty as
              | Record<
                  string,
                  { crowns: number; bestScore: number } | undefined
                >
              | undefined
          )?.[t.id];
          return (
            <div key={t.id} className="pm-glass pm-ink-hover rounded-2xl p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xl">{t.icon}</span>
                <span className="text-sm font-medium">{t.name}</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Crowns</span>
                  <span className="font-semibold">{s?.crowns ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Best Rep</span>
                  <span className="font-semibold">{s?.bestScore ?? 0}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
