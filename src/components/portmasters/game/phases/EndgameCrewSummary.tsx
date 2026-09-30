"use client";

import { Users } from "lucide-react";
import { flatWorkerRoster, type GameState } from "@/lib/game/types";
import { PanelTotal, StatTile, SummaryHeading } from "./PhaseShared";

/**
 * Crew Management Summary. Shows worker productivity stats at voyage
 * end: the crew still aboard, how many reached skilled status, total
 * items produced, and the wages paid. [C2: crew loss by name] The first
 * tile says "Crew Aboard" rather than "Workers Hired" because the two
 * stopped being the same number the moment a hand could be lost or
 * dismissed, and the line under the tiles is where the names of the lost
 * are read back: the log said each one as it happened, and a summary that
 * let a permanent loss go unmentioned would be the one screen pretending
 * it had not.
 */
export function CrewSummary({ game }: { game: GameState }) {
  const allWorkers = flatWorkerRoster(game);
  // Read as the crew aboard rather than as the hands hired, which is the
  // number the tile under it has always been showing: the two stopped
  // agreeing the moment an artisan could leave the roster, and the name of
  // this one is where that shows.
  const crewAboard = allWorkers.length;
  const skilledCount = allWorkers.filter((w) => w.isSkilled).length;
  const totalWages = game.workerWages;
  const lost = game.crewLost ?? [];

  // Estimate total items produced from worker producedCount
  const totalProduced = allWorkers.reduce(
    (s, w) => s + (w.producedCount ?? 0),
    0,
  );

  if (crewAboard === 0) return null;

  return (
    <div className="rounded-xl border border-due/20 bg-due/[0.03] px-4 py-3 my-3 text-left">
      <SummaryHeading tone="text-due">
        <Users className="h-3.5 w-3.5" />
        Crew Summary
      </SummaryHeading>
      <div className="grid grid-cols-3 gap-2">
        <StatTile
          value={crewAboard}
          valueClassName="text-due"
          label="Crew Aboard"
        />
        <StatTile
          value={skilledCount}
          valueClassName="text-gain"
          label="Skilled"
        />
        <StatTile
          value={totalProduced}
          valueClassName="text-sea"
          label="Items Made"
        />
      </div>
      <PanelTotal
        tone="border-due/10"
        label={<span className="text-muted-foreground">Total Wages Paid</span>}
      >
        <span className="font-bold text-due">{totalWages} Gold</span>
      </PanelTotal>
      {lost.length > 0 && (
        <div className="mt-1.5 flex items-baseline justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground shrink-0">
            ⚰️ Lost over the voyage
          </span>
          <span className="font-bold text-alarm text-right">
            {lost.map((loss) => `${loss.name} (leg ${loss.round})`).join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}
