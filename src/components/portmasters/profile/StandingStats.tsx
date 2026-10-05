"use client";

import { Crown, Waves } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The captain's two standing numbers, one tile each. The streak and the
 * rate are the same card with different words in it, so the card below is
 * written once and taken twice rather than two blocks that happen to agree
 * today: this is the defect the sections around it are shaped against.
 */
export function StandingStats({
  solventStreak,
  crownRate,
}: {
  solventStreak: number;
  crownRate: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <StandingTile
        icon={Waves}
        label="Solvent Streak"
        tone="text-profile"
        value={solventStreak}
        caption="Consecutive voyages without bankruptcy"
      />
      <StandingTile
        icon={Crown}
        label="Crown Rate"
        tone="text-gold-ink"
        value={`${Math.round(crownRate * 100)}%`}
        caption="Share of voyages won as Sea Master"
      />
    </div>
  );
}

function StandingTile({
  icon: Icon,
  label,
  tone,
  value,
  caption,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: string;
  value: React.ReactNode;
  caption: string;
}) {
  return (
    <div className="pm-glass rounded-2xl p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className={cn("mt-1 font-display text-3xl font-bold", tone)}>
        {value}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}
