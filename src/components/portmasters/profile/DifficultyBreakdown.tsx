"use client";

import type { CaptainLegacySummary } from "@/lib/game/legacy";
import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  type Difficulty,
} from "@/lib/game/difficulty";
import { t } from "@/lib/game/i18n";
import { SectionHeading } from "./SectionHeading";

// The tiers, taken from the difficulty record itself: the list of them is
// the lobby's own order, and each tile wears the name the game gives that
// tier, which is the tier's own name rather than the short badge the
// lobby chip carries. The names stay English here; each is read through
// the pack where the tile prints it. The map parameter is named tier
// rather than t so the reader stays reachable inside it.
const TIERS: {
  id: Difficulty;
  name: string;
  icon: string;
}[] = DIFFICULTY_ORDER.map((id) => ({
  id,
  name: DIFFICULTIES[id].name,
  icon: DIFFICULTIES[id].icon,
}));

export function DifficultyBreakdown({
  statsByDifficulty,
}: {
  statsByDifficulty: CaptainLegacySummary["statsByDifficulty"];
}) {
  return (
    <div>
      <SectionHeading>{t("By Difficulty")}</SectionHeading>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {TIERS.map((tier) => {
          const s = (
            statsByDifficulty as
              | Record<
                  string,
                  { crowns: number; bestReputation: number } | undefined
                >
              | undefined
          )?.[tier.id];
          return (
            <div
              key={tier.id}
              className="pm-glass pm-ink-hover rounded-2xl p-4"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xl">{tier.icon}</span>
                <span className="text-sm font-medium">{t(tier.name)}</span>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("Crowns")}</span>
                  <span className="font-semibold">{s?.crowns ?? 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t("Best Rep")}</span>
                  <span className="font-semibold">
                    {s?.bestReputation ?? 0}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
