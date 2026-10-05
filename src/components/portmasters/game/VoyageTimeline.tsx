"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { lapPhases } from "@/lib/game/checkpoint";
import { isLegPhase, phaseFace } from "@/lib/game/phases";
import { leftTheVoyage } from "@/lib/seatMarks";
import type { GameMode } from "@/lib/game/mode";
import type { LegPhase, Phase } from "@/lib/game/types";

/**
 * The phase strip of the rail: the steps of the leg, with the one the
 * room is standing on lit.
 *
 * The phases cycle, and where they cycle TO is not written here. The
 * order is the room's mode (see src/lib/game/mode.ts), the same lap the
 * ready check and the engine walk, because the two modes run these same
 * phases in a different order. A copy of the order kept here instead
 * would be invisible in the one place it matters: a captain mid round
 * on the experimental leg would see the rail point at the phase they
 * had already finished while nothing in the engine was wrong, only the
 * picture of it.
 *
 * How far the voyage has run is written once, on the pinned VoyageHeader
 * above this strip, as a ring and a number, so the strip itself draws
 * the steps alone.
 *
 * The names and glyphs come from the phase's own face rather than from a
 * table here ([B1]: one face per phase, so the rail, the dispatcher and
 * a mode's briefing chart cannot disagree about what a phase is called
 * or drawn as). What is left here is the drawing.
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
  phase,
  mode,
  className,
}: {
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
  // The two phases that end the voyage, read through the shared reader
  // (see leftTheVoyage in @/lib/seatMarks) rather than spelled here: the
  // rail reads "no step is lit" for the pier as well, and the pier is not
  // a voyage ending. Terminal-ness belongs to the phase, not to the rail.
  const isTerminal = leftTheVoyage({ phase });
  // The closing banner wears the terminal phase's own face, drawn above
  // rather than on a step, since a terminal phase has no step to sit on.
  const terminalFace = phaseFace(phase);

  return (
    <div className={cn("space-y-2", className)}>
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
