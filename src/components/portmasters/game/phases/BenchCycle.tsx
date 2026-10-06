"use client";

import { lapPhases } from "@/lib/game/checkpoint";
import { isLegPhase, phaseFace } from "@/lib/game/phases";
import type { GameState, LegPhase } from "@/lib/game/types";
import { cn } from "@/lib/utils";

// What the round does with what this bench sets going, in the words this
// panel uses for it. One note per phase of the leg rather than one per tile,
// because the strip below draws whichever phases this voyage still has in
// front of it and both modes dock here: a map written for one mode's four
// would leave the fifth a tile a captain has to guess at.
//
// These are not the phase's face. A face says what a phase is called; this
// says what the phase does to a hold, and it belongs to the bench that
// promised the work rather than to the phase.
const CYCLE_NOTE: Record<LegPhase, string> = {
  dawn: "Draft a boon",
  market: "Assign tasks, consume materials",
  orders: "Trade orders",
  parley: "Barter with the harbor",
  resolve: "Goods produced, wages paid",
  dusk: "Shipyard and modules",
};

/**
 * The production cycle strip: one tile per phase the round still has in
 * front of it, and the sentence that says when the work lands. It reads the
 * room's own lap rather than a list of its own, because the two modes run
 * the round in different orders.
 */
export function BenchCycle({
  game,
  duePhase,
}: {
  game: GameState;
  duePhase: string;
}) {
  // The rest of this voyage's round, from this phase to the one that closes
  // it, off the room's own lap (see src/lib/game/checkpoint.ts and
  // src/lib/game/mode.ts). The two modes run Market, Orders and Parley in
  // different orders, so a strip written out here would walk one mode
  // through the other mode's round.
  const lap = lapPhases(game.mode).filter(isLegPhase);
  const seat = lap.indexOf("market");
  const cycle = seat === -1 ? lap : lap.slice(seat);
  return (
    <div className="rounded-xl bg-market/[0.06] border border-market/20 p-3.5 mb-4 text-xs">
      <strong>⏱️ Production Cycle: What Happens When</strong>
      {/* One tile per phase the round still has in front of it, each
          wearing the colour of the phase it names, so the strip is a map
          of this voyage's round rather than four unrelated swatches in
          one mode's order. */}
      <div className="flex gap-1.5 mt-2 text-center">
        {cycle.map((p, i) => {
          const face = phaseFace(p);
          return (
            <div
              key={p}
              className={cn(
                "flex-1 rounded-md py-1.5",
                face.gradient,
                i === 0 && "ring-1 ring-foreground/25",
              )}
            >
              <div>{i === 0 ? "📋 Now" : `${face.icon} ${face.label}`}</div>
              <div className="text-[9px] opacity-90">{CYCLE_NOTE[p]}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-gain">
        💡 Materials consumed <strong>now</strong>. Finished goods and wage
        deductions happen at <strong>{duePhase}</strong>, not instantly.
      </div>
    </div>
  );
}
