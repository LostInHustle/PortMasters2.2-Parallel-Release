"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Phase } from "@/lib/game/types";

/**
 * Voyage Progress Timeline. A compact horizontal strip showing the
 * eight checkpoint phases of a round and which one is active right now.
 *
 * The phases cycle: Boon Draft, Purchase, Barter, Workers, Orders,
 * Settlement, Shipyard, then back to Boon Draft. The timeline shows
 * the current round's position in that cycle, plus the overall voyage
 * progress (which round of how many).
 *
 * Personal sub states (module_draft, module_swap) and terminals
 * (bankruptcy, endgame) are folded into their parent phase for the
 * timeline display, since they never become room checkpoints.
 */

const PHASES: { key: string; label: string; icon: string; short: string }[] = [
  { key: "5", label: "Boon Draft", icon: "🧭", short: "Boon" },
  { key: "1", label: "Purchase", icon: "📦", short: "Buy" },
  { key: "barter", label: "Barter", icon: "🤝", short: "Barter" },
  { key: "worker_mgmt", label: "Artisans", icon: "👥", short: "Work" },
  { key: "2", label: "Orders", icon: "📜", short: "Orders" },
  { key: "3", label: "Settlement", icon: "💸", short: "Settle" },
  { key: "4", label: "Shipyard", icon: "🚢", short: "Yard" },
];

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
  className,
}: {
  currentRound: number;
  maxRounds: number;
  phase: Phase;
  className?: string;
}) {
  const currentKey = normalizePhase(phase);
  const currentIndex = PHASES.findIndex((p) => p.key === currentKey);
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
          {PHASES.map((p, i) => {
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
                    isCurrent && "pm-grad-primary text-white shadow-sm",
                    isPast && "bg-celadon/20 text-celadon dark:text-celadon/80",
                    isUpcoming &&
                      "bg-black/5 text-muted-foreground/50 dark:bg-white/5",
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
                      : "text-muted-foreground/60",
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
            phase === "bankruptcy"
              ? "bg-rose-500/15 text-rose-600 dark:text-rose-300"
              : "pm-grad-violet text-white",
          )}
        >
          {phase === "bankruptcy" ? "💥 Bankrupt" : "🏆 Voyage Complete"}
        </div>
      )}
    </div>
  );
}
