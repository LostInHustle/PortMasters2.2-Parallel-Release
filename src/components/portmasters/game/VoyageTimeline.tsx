"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { lapPhases } from "@/lib/game/checkpoint";
import type { GameMode } from "@/lib/game/mode";
import type { Phase } from "@/lib/game/types";

/**
 * Voyage Progress Timeline. A compact horizontal strip showing the
 * checkpoint phases of a round and which one is active right now.
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
 * Personal sub states (module_draft, module_swap) and terminals
 * (bankruptcy, endgame) are folded into their parent phase for the
 * timeline display, since they never become room checkpoints.
 */

// What each checkpoint phase is called. Only the names live here now; the
// order they are drawn in comes from the mode's lap. A phase the lap lists
// but this table does not is one the rail leaves out, which is how the
// harbor stays off it: waiting to set sail is not a step a captain takes.
const PHASE_LABELS: Record<
  string,
  { label: string; icon: string; short: string }
> = {
  "5": { label: "Boon Draft", icon: "🧭", short: "Boon" },
  "1": { label: "Purchase", icon: "📦", short: "Buy" },
  barter: { label: "Barter", icon: "🤝", short: "Barter" },
  worker_mgmt: { label: "Artisans", icon: "👥", short: "Work" },
  "2": { label: "Orders", icon: "📜", short: "Orders" },
  "3": { label: "Settlement", icon: "💸", short: "Settle" },
  "4": { label: "Shipyard", icon: "🚢", short: "Yard" },
};

function normalizePhase(phase: Phase): string {
  switch (phase) {
    case 0:
      return "5"; // welcome folds into boon draft
    case "module_draft":
    case "module_swap":
      return "4"; // shipyard sub states fold into shipyard
    case "bankruptcy":
    case "endgame":
      return "end"; // terminal
    default:
      return String(phase);
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
  // The lap, minus whatever has no face in the table above. Reading the rule
  // off the table rather than off a second list of exclusions is what keeps
  // the harbor off the rail without naming it twice.
  const steps = lapPhases(mode)
    .filter((key) => PHASE_LABELS[key] !== undefined)
    .map((key) => ({ key, ...PHASE_LABELS[key] }));
  const currentKey = normalizePhase(phase);
  const currentIndex = steps.findIndex((p) => p.key === currentKey);
  const isTerminal = currentKey === "end";
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
        <div className="flex items-center gap-0.5">
          {steps.map((p, i) => {
            const isCurrent = i === currentIndex;
            const isPast = currentIndex >= 0 && i < currentIndex;
            const isUpcoming = currentIndex >= 0 && i > currentIndex;
            return (
              <div
                key={p.key}
                className="flex flex-1 flex-col items-center gap-0.5"
              >
                <motion.div
                  className={cn(
                    "flex h-7 w-full items-center justify-center rounded-md text-[10px] font-medium transition-all",
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
                  <span className="text-[11px]">{p.icon}</span>
                </motion.div>
                <span
                  className={cn(
                    "text-[8px] leading-none transition-colors",
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
          {phase === "bankruptcy" ? "💥 Bankrupt" : "🏆 Voyage Complete"}
        </div>
      )}
    </div>
  );
}
