"use client";

import { VoyageChronicle } from "@/types/realtime/voyage";
import type { CaptainLegacySummary } from "@/lib/game/legacy";
import { KeyStatsGrid } from "./KeyStatsGrid";
import { StandingStats } from "./StandingStats";
import { DifficultyBreakdown } from "./DifficultyBreakdown";
import { MeritsShowcase } from "./MeritsShowcase";
import { VoyageTrends } from "./VoyageTrends";
import { RenownProgression } from "./RenownProgression";

export function StatsTab({
  legacy,
  stats,
  chronicles,
}: {
  legacy: CaptainLegacySummary | null;
  stats: {
    totalVoyages: number;
    crownRate: number;
    solventStreak: number;
  } | null;
  chronicles: VoyageChronicle[];
}) {
  if (!legacy || !stats) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No voyage records yet. Set sail to begin your legacy.
      </div>
    );
  }
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Key stats grid */}
      <KeyStatsGrid
        totalVoyages={stats.totalVoyages}
        seaMasterCrowns={legacy.seaMasterCrowns}
        bestScore={legacy.bestScore}
        renownXP={legacy.renownXP}
      />

      {/* Solvent streak and crown rate */}
      <StandingStats
        solventStreak={stats.solventStreak}
        crownRate={stats.crownRate}
      />

      {/* Per difficulty breakdown */}
      <DifficultyBreakdown statsByDifficulty={legacy.statsByDifficulty} />

      {/* Merits showcase */}
      <MeritsShowcase meritIds={legacy.meritIds ?? []} />

      {/* Recent voyage trends, drawn as sparklines from chronicle data. */}
      {chronicles.length > 0 && <VoyageTrends chronicles={chronicles} />}

      {/* Renown progression */}
      <RenownProgression renownLevel={legacy.renownLevel} />
    </div>
  );
}
