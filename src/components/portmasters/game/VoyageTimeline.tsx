"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { lapPhases } from "@/lib/game/checkpoint";
import { isLegPhase, phaseFace } from "@/lib/game/phases";
import type { GameMode } from "@/lib/game/mode";
import type { LegPhase, Phase } from "@/lib/game/types";

/**
 * Voyage Progress Timeline. A compact horizontal strip showing the
 * phases of a round and which one is active right now.
 *
 * The phases cycle, and where they cycle TO is not written here. The
 * order is the room's mode (see src/lib/game/mode.ts), the same lap the
 * ready check and the engine walk, because the two modes run these same
 * phases in a different order. This strip used to hold its own copy of
 * the order, which is the one place a second copy would have been
 * invisible: a captain mid round on the experimental leg would have
 * seen the rail point at the phase they had already finished, and
 * nothing in the engine would have been wrong. Only the picture of it
 * would have been.
 *
 * The names and glyphs come from the phase's own face for the same
 * reason ([B1]: this file used to hold a label table, the dispatcher
 * held a gradient table, and a mode's briefing chart held a third). What
 * is left here is the drawing.
 *
 * Personal sub states (module_draft, module_swap) and terminals
 * (bankruptcy, endgame) are folded into their parent step for the
 * timeline display, since they never become room checkpoints.
 */

// Which step of the rail a captain is standing on.
//
// A phase of the leg is its own step. The shipyard's two sub states are work
// done inside Dusk, which is why they fold there rather than drawing a step
// of their own for something the room is not waiting on. The pier is not a
// step of the leg at all, and the two terminals have left the leg behind:
// both answer null, which the rail draws as "no step is lit" (and, for the
// terminals, as the closing banner instead of the strip).
function railStep(phase: Phase): LegPhase | null {
  if (isLegPhase(phase)) return phase;
  switch (phase) {
    case "module_draft":
    case "module_swap":
      return "dusk";
    default:
      return null;
  }
}

export function VoyageTimeline({
  currentRound,
  maxRounds,
  phase,
  mode,
  className,
}: {
  currentRound: number;
  maxRounds: number;
  phase: Phase;
  mode: GameMode;
  className?: string;
}) {
  // The lap, minus the pier: the rail draws the steps of the leg, and the
  // harbor is where a voyage waits rather than a step anybody takes. Read
  // off the leg flag on each phase's face rather than off a second list of
  // exclusions, so a phase that stops being leg work stops being drawn.
  const steps = lapPhases(mode)
    .filter((phase) => isLegPhase(phase))
    .map((phase) => ({ phase, ...phaseFace(phase) }));
  const currentKey = railStep(phase);
  const currentIndex = steps.findIndex((p) => p.phase === currentKey);
  // The two phases that end the voyage, named rather than folded: the rail
  // reads "no step is lit" for the pier as well, and the pier is not a
  // voyage ending. Terminal-ness belongs to the phase, not to the rail.
  const isTerminal = phase === "bankruptcy" || phase === "endgame";
  // The closing banner wears the terminal phase's own face, drawn above
  // rather than on a step, since a terminal phase has no step to sit on.
  const terminalFace = phaseFace(phase);
  const voyageProgress = Math.min(100, (currentRound / maxRounds) * 100);

  return (
    <div className={cn("space-y-2", className)}>
      {/* Voyage progress bar */}
      <div>
        <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Voyage Progress</span>
          <span>
            Round {currentRound} of {maxRounds}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-celadon via-jade to-gold"
            initial={{ width: 0 }}
            animate={{ width: `${voyageProgress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Phase timeline */}
      {!isTerminal && (
        <div className="flex items-stretch gap-1">
          {steps.map((p, i) => {
            const isCurrent = i === currentIndex;
            const isPast = currentIndex >= 0 && i < currentIndex;
            const isUpcoming = currentIndex >= 0 && i > currentIndex;
            return (
              // min-w-0 on both the column and the tile, so a lap with more
              // steps than there is rail narrows the steps rather than
              // pushing the last one out of the panel. The name below each
              // tile is the first thing to give way, and it gives way by
              // truncating rather than by shrinking: 8px was the size this
              // label had to be to fit seven steps in a rail this wide, and
              // 8px is a size nobody reads. The full name is on the title
              // above, the glyph stays legible at any width, and a step
              // whose name is cut is still a step a captain can count.
              <div
                key={p.phase}
                className="flex min-w-0 flex-1 flex-col items-center gap-0.5"
              >
                <motion.div
                  className={cn(
                    "flex h-8 w-full min-w-0 items-center justify-center rounded-md transition-all",
                    isCurrent && "pm-grad-voyage shadow-sm",
                    isPast && "bg-celadon/5 text-celadon dark:text-celadon",
                    isUpcoming &&
                      "bg-black/5 text-muted-foreground dark:bg-white/5",
                  )}
                  animate={isCurrent ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                  transition={{
                    duration: 2,
                    repeat: isCurrent ? Infinity : 0,
                    ease: "easeInOut",
                  }}
                  title={p.label}
                >
                  <span className="text-sm">{p.icon}</span>
                </motion.div>
                <span
                  className={cn(
                    "w-full truncate text-center text-[10px] leading-none transition-colors",
                    isCurrent
                      ? "font-bold text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {p.short}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Terminal state */}
      {isTerminal && (
        <div
          className={cn(
            "flex items-center justify-center rounded-lg py-1.5 text-xs font-semibold",
            phase === "bankruptcy" ? "bg-alarm/5 text-alarm" : "pm-grad-voyage",
          )}
        >
          {terminalFace.icon} {terminalFace.label}
        </div>
      )}
    </div>
  );
}
