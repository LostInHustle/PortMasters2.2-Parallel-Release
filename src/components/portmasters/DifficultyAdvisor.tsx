"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, CheckCircle2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Difficulty } from "@/lib/game/difficulty";

/**
 * Voyage Difficulty Advisor. Suggests which difficulty tier to pick
 * based on the captain's Renown level, past voyage count, best score,
 * and solvent streak. The advisor is advisory only, the captain can
 * still pick any tier.
 *
 * The recommendation logic:
 * - Renown 1 to 2, fewer than 3 voyages: Fair Winds
 * - Renown 3 to 4, 3+ voyages, best score 50+: Fair Winds or Open Waters
 * - Renown 5+, 5+ voyages, best score 100+, solvent streak 2+: Open Waters
 * - Renown 8+, 10+ voyages, best score 200+, solvent streak 3+: Monsoon
 */

type Advice = {
  recommended: Difficulty;
  reason: string;
  match: boolean;
  caution?: string;
};

function getAdvice(
  selected: Difficulty,
  renownLevel: number,
  voyagesCompleted: number,
  bestScore: number,
  solventStreak: number,
): Advice {
  let recommended: Difficulty = "fair_winds";
  let reason = "";
  let caution: string | undefined;

  if (
    renownLevel >= 8 &&
    voyagesCompleted >= 10 &&
    bestScore >= 200 &&
    solventStreak >= 3
  ) {
    recommended = "monsoon";
    reason =
      "You have the experience and the streak for the Monsoon Season. 16 rounds, 1.6x Renown, and three difficulty scoped Merits await.";
  } else if (renownLevel >= 5 && voyagesCompleted >= 5 && bestScore >= 100) {
    recommended = "open_waters";
    reason =
      "Your Renown and voyage count suggest you are ready for Open Waters. 12 rounds, 1.25x Renown, and Imperial Mandates on rounds 4, 8, and 12.";
  } else {
    recommended = "fair_winds";
    reason =
      "Fair Winds is the right starting point. 8 rounds, gentle pirate odds, and no mandates. Learn the loop before taking on heavier waters.";
  }

  // Cautions for overreaching
  if (selected === "monsoon" && renownLevel < 5) {
    caution =
      "Monsoon Season is very tough for a new captain. Consider Open Waters or Fair Winds until you reach Renown Level 5.";
  } else if (selected === "open_waters" && voyagesCompleted < 3) {
    caution =
      "Open Waters introduces mandates and charter goods. Try a few Fair Winds voyages first to learn the core loop.";
  } else if (selected === "monsoon" && solventStreak === 0) {
    caution =
      "Monsoon has a 28 to 38 percent pirate raid chance. Make sure you can survive a bankruptcy before risking it.";
  }

  return {
    recommended,
    reason,
    match: selected === recommended,
    caution,
  };
}

export function DifficultyAdvisor({
  selectedDifficulty,
  renownLevel,
  voyagesCompleted,
  bestScore,
  solventStreak,
}: {
  selectedDifficulty: Difficulty;
  renownLevel: number;
  voyagesCompleted: number;
  bestScore: number;
  solventStreak: number;
}) {
  const [dismissed, setDismissed] = useState(false);
  const advice = getAdvice(
    selectedDifficulty,
    renownLevel,
    voyagesCompleted,
    bestScore,
    solventStreak,
  );

  if (dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className={cn(
          "mt-2 rounded-lg border px-2.5 py-2 text-[10px] leading-relaxed",
          advice.match
            ? "border-emerald-500/20 bg-emerald-500/[0.04]"
            : advice.caution
              ? "border-amber-500/20 bg-amber-500/[0.04]"
              : "border-indigo-500/15 bg-indigo-500/[0.03]",
        )}
      >
        <div className="flex items-start gap-1.5">
          {advice.match ? (
            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
          ) : advice.caution ? (
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
          ) : (
            <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-indigo-500" />
          )}
          <div className="flex-1 min-w-0">
            {!advice.match && (
              <p className="font-medium text-foreground/80">
                {advice.caution
                  ? "Heads up"
                  : `Consider ${advice.recommended.replace(/_/g, " ")}`}
              </p>
            )}
            <p className="text-muted-foreground">
              {advice.caution ?? advice.reason}
            </p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="pm-pressable shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss advice"
          >
            <span className="text-xs">x</span>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
