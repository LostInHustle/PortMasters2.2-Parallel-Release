"use client";

import { Users } from "lucide-react";
import { listJoiner, t } from "@/lib/game/i18n";
import { flatWorkerRoster, type GameState } from "@/lib/game/types";
import { FigureTile, PanelTotal, SummaryHeading } from "./PhaseShared";

/**
 * Crew Management Summary. Shows worker productivity stats at voyage
 * end: the crew still aboard, how many reached skilled status, total
 * items produced, and the wages paid. The first
 * tile says "Crew Aboard" rather than "Artisans Hired" because the two
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
  const totalWages = game.wagesPaid;
  const lost = game.crewLost ?? [];

  // Estimate total items produced from worker producedCount
  const totalProduced = allWorkers.reduce(
    (s, w) => s + (w.producedCount ?? 0),
    0,
  );

  if (crewAboard === 0) return null;

  // The hands the voyage took, each named with the round it happened on. The
  // join is the language's own, so a Mandarin list separates the way its
  // sentences do.
  const lostList = lost
    .map((loss) =>
      t("{loss.name} (round {loss.round})", {
        "loss.name": loss.name,
        "loss.round": loss.round,
      }),
    )
    .join(listJoiner());

  return (
    <div className="rounded-xl border border-due/20 bg-due/[0.03] px-4 py-3 my-3 text-left">
      <SummaryHeading tone="text-due">
        <Users className="h-3.5 w-3.5" />
        {t("Crew Summary")}
      </SummaryHeading>
      <div className="grid grid-cols-3 gap-2">
        <FigureTile
          size="figure"
          value={crewAboard}
          valueClassName="text-due"
          label={t("Crew Aboard")}
        />
        <FigureTile
          size="figure"
          value={skilledCount}
          valueClassName="text-gain"
          label={t("Skilled")}
        />
        <FigureTile
          size="figure"
          value={totalProduced}
          valueClassName="text-sea"
          label={t("Items Made")}
        />
      </div>
      <PanelTotal
        tone="border-due/10"
        className="mt-2"
        label={
          <span className="text-[11px] text-muted-foreground">
            {t("Total Wages Paid")}
          </span>
        }
      >
        <span className="text-[11px] font-bold text-due">
          {t("{contract.fee} Gold", { "contract.fee": totalWages })}
        </span>
      </PanelTotal>
      {lost.length > 0 && (
        <div className="mt-1.5 flex items-baseline justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground shrink-0">
            {t("⚰️ Lost over the voyage")}
          </span>
          <span className="font-bold text-alarm text-right">{lostList}</span>
        </div>
      )}
    </div>
  );
}
