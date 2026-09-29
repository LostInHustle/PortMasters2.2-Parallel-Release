"use client";

import { Anchor, Crown, Gem, Trophy } from "lucide-react";
import { StatTile } from "./StatTile";

export function KeyStatsGrid({
  totalVoyages,
  seaMasterCrowns,
  bestScore,
  renownXP,
}: {
  totalVoyages: number;
  seaMasterCrowns: number;
  bestScore: number;
  renownXP: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile icon={Anchor} label="Voyages" value={totalVoyages} tone="sea" />
      <StatTile
        icon={Crown}
        label="Sea Master"
        value={seaMasterCrowns}
        tone="gold"
      />
      <StatTile icon={Trophy} label="Best Rep" value={bestScore} tone="due" />
      <StatTile icon={Gem} label="Renown XP" value={renownXP} tone="intel" />
    </div>
  );
}
