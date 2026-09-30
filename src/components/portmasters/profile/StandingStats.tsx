"use client";

import { Crown, Waves } from "lucide-react";

export function StandingStats({
  solventStreak,
  crownRate,
}: {
  solventStreak: number;
  crownRate: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="pm-glass rounded-2xl p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Waves className="h-4 w-4" /> Solvent Streak
        </div>
        <div className="mt-1 font-display text-3xl font-bold text-profile">
          {solventStreak}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Consecutive voyages without bankruptcy
        </p>
      </div>
      <div className="pm-glass rounded-2xl p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Crown className="h-4 w-4" /> Crown Rate
        </div>
        <div className="mt-1 font-display text-3xl font-bold text-gold-ink">
          {Math.round(crownRate * 100)}%
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Share of voyages won as Sea Master
        </p>
      </div>
    </div>
  );
}
