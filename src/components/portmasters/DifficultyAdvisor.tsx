"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, CheckCircle2, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  DIFFICULTIES,
  mandateRounds,
  type Difficulty,
  type DifficultyConfig,
} from "@/lib/game/difficulty";

/**
 * Voyage Difficulty Advisor. Suggests which difficulty tier to pick
 * based on the captain's Renown level, past voyage count, best score,
 * and solvent streak. The advisor is advisory only, the captain can
 * still pick any tier.
 *
 * The recommendation reads four bands, each one wider than the last:
 *
 * Renown 1 to 2 with fewer than 3 voyages is pointed at Fair Winds.
 * Renown 3 to 4 with 3 voyages or more and a best score of 50 or more is
 * pointed at Fair Winds or Open Waters.
 * Renown 5 or more with 5 voyages or more, a best score of 100 or more and
 * a solvent streak of 2 or more is pointed at Open Waters.
 * Renown 8 or more with 10 voyages or more, a best score of 200 or more and
 * a solvent streak of 3 or more is pointed at Monsoon.
 */

// The three tiers, read off the one table that defines them rather than
// repeated in the advice below. Every name and number in those sentences
// comes from here, so a balance pass can never leave the advisor pitching
// a voyage the game no longer runs.
const fairWinds = DIFFICULTIES.fair_winds;
const openWaters = DIFFICULTIES.open_waters;
const monsoon = DIFFICULTIES.monsoon;

// A tier's mandate rounds as prose: "4, 8, and 12".
function listRounds(cfg: DifficultyConfig): string {
  const rounds = mandateRounds(cfg);
  if (rounds.length === 0) return "none";
  if (rounds.length === 1) return String(rounds[0]);
  return `${rounds.slice(0, -1).join(", ")}, and ${rounds[rounds.length - 1]}`;
}

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
    reason = `You have the experience and the streak for the ${monsoon.name}. ${monsoon.rounds} rounds, ${monsoon.renownXpMultiplier}x Renown, and two difficulty scoped Merits await: Storm Sovereign and Eye of the Storm.`;
  } else if (renownLevel >= 5 && voyagesCompleted >= 5 && bestScore >= 100) {
    recommended = "open_waters";
    reason = `Your Renown and voyage count suggest you are ready for ${openWaters.name}. ${openWaters.rounds} rounds, ${openWaters.renownXpMultiplier}x Renown, and Imperial Mandates on rounds ${listRounds(openWaters)}.`;
  } else {
    recommended = "fair_winds";
    reason = `${fairWinds.name} is the right starting point. ${fairWinds.rounds} rounds, gentle pirate odds, and no mandates. Learn the loop before taking on heavier waters.`;
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
            ? "border-gain/20 bg-gain/[0.04]"
            : advice.caution
              ? "border-warn/20 bg-warn/[0.04]"
              : "border-intel/15 bg-intel/[0.03]",
        )}
      >
        <div className="flex items-start gap-1.5">
          {advice.match ? (
            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-gain" />
          ) : advice.caution ? (
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-warn" />
          ) : (
            <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-intel" />
          )}
          <div className="flex-1 min-w-0">
            {!advice.match && (
              <p className="font-medium text-foreground">
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
