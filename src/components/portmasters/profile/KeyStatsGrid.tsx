"use client";

import { Anchor, Crown, Gem, Trophy } from "lucide-react";
import { t } from "@/lib/game/i18n";
import { FigureTile } from "./FigureTile";

export function KeyStatsGrid({
  totalVoyages,
  seaMasterCrowns,
  bestReputation,
  renownXP,
}: {
  totalVoyages: number;
  seaMasterCrowns: number;
  bestReputation: number;
  renownXP: number;
}) {
  // The four labels are read where they are handed over, not where they
  // print: the tile is furniture and fills whatever it is given, and the
  // words here are this profile's own four readings, each with a row.
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <FigureTile
        icon={Anchor}
        label={t("Voyages")}
        value={totalVoyages}
        tone="sea"
        size="large"
      />
      <FigureTile
        icon={Crown}
        label={t("Sea Master")}
        value={seaMasterCrowns}
        tone="gold"
        size="large"
      />
      <FigureTile
        icon={Trophy}
        label={t("Best Rep")}
        value={bestReputation}
        tone="due"
        size="large"
      />
      <FigureTile
        icon={Gem}
        label={t("Renown XP")}
        value={renownXP}
        tone="intel"
        size="large"
      />
    </div>
  );
}
