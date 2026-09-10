"use client";

import { motion } from "framer-motion";
import {
  BookOpen,
  X,
  Ship,
  Handshake,
  Wrench,
  Package,
  Skull,
  Hammer,
  Coins,
  TrendingUp,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { cn } from "@/lib/utils";

/**
 * How to Play guide. A standalone, difficulty agnostic introduction to
 * the game's loop, accessible from the Lobby so a new captain can learn
 * the rules before ever setting sail.
 *
 * The original game has tutorialSteps and guideText locked behind the
 * game room (they need a difficulty to render the tuned numbers). This
 * component is a higher level, visual first read that covers the shape
 * of a voyage without requiring a room.
 */

type Step = {
  icon: typeof Ship;
  title: string;
  gradient: string;
  body: string;
  tip: string;
};

const STEPS: Step[] = [
  {
    icon: Ship,
    title: "Gather in the Harbor",
    gradient: "pm-grad-primary",
    body: "Captains gather in a shared harbor. The host picks a difficulty and sets sail. Everyone then plays the same voyage in lockstep: nobody advances a phase until every still active captain has readied up.",
    tip: "You can start a Solo Practice Voyage alone to learn the ropes without waiting for a second captain.",
  },
  {
    icon: ChevronRight,
    title: "Draft a Boon",
    gradient: "pm-grad-gold",
    body: "Each round opens with a boon draft. Pick one of three boons that bend the rules for the coming round: cheaper purchases, faster production, a tax shelter, or an emergency loan of 40 Gold.",
    tip: "You can swap your boon choices once per round for 10 Gold if none of the three fit your strategy.",
  },
  {
    icon: Package,
    title: "Buy at Port",
    gradient: "pm-grad-jade",
    body: "Phase 1 is the port market. Buy raw materials like Hemp, Silk, and Tea from the port merchant. Prices vary per captain and per round. You can also pay 5 Gold for a Broker's Rumor that guarantees a matching order appears in Phase 2.",
    tip: "The harbor remembers what everyone bought. A good the room leans into gets pricier next round, while one nobody touches softens.",
  },
  {
    icon: Handshake,
    title: "Barter with Captains",
    gradient: "pm-grad-indigo",
    body: "After buying, you can trade goods and Gold directly with the other captains. Post an offer of what you have and what you want, or accept an offer someone else posted. Offered goods are escrowed the moment you post.",
    tip: "You can target a specific captain with a Direct Barter Offer if you want to trade with only them.",
  },
  {
    icon: Wrench,
    title: "Put Artisans to Work",
    gradient: "pm-grad-amber",
    body: "Hire weavers, potters, coppersmiths, and other artisans, then assign each a product to craft. Production does not happen instantly: the goods land at the start of Phase 3 next round, not this round.",
    tip: "Hire artisans only when you can sustain at least two rounds of wages. A worker who goes unpaid strikes and sinks your voyage.",
  },
  {
    icon: TrendingUp,
    title: "Fill Trade Orders",
    gradient: "pm-grad-primary",
    body: "Phase 2 deals trade orders. Each asks for a set of goods and pays Gold and Reputation. Finished product orders pay more but require artisans to craft them first. The Emperor may also issue a Mandate, a high value order identical for every captain.",
    tip: "Raw material orders are the safe early play. Finished product orders are where the real Reputation lives.",
  },
  {
    icon: Skull,
    title: "Survive Settlement",
    gradient: "pm-grad-vermilion",
    body: "Phase 3 is where voyages end. First, pirates may find you and take every Gold coin on hand. Hire an escort to sail safe, or risk it. Then pay wages and ship maintenance. If you cannot cover the bills, you go bankrupt.",
    tip: "Ask the harbor for a loan before assuming the voyage is over. Any captain can lend, and a third captain can back the loan as a safety net.",
  },
  {
    icon: Hammer,
    title: "Upgrade at the Shipyard",
    gradient: "pm-grad-gold",
    body: "Phase 4 lets you upgrade your ship (opens a new module slot and reduces transport costs) or draft and rig a module. Modules are permanent ship upgrades: a Smuggler's Hold, a Broker's Network, a Salvage Crane, and more.",
    tip: "Do not skip the Shipyard. The transport discount from a higher ship level pays for itself within two rounds.",
  },
  {
    icon: Coins,
    title: "Build Your Legacy",
    gradient: "pm-grad-violet",
    body: "Every voyage's final Reputation becomes Renown XP, multiplied by the difficulty tier. Renown levels grant titles, a small starting Gold bonus, and at level 5 unlock the Broker's Favor. The captain with the highest Reputation in a voyage is crowned Sea Master.",
    tip: "Check in daily for a seven day cycle of Renown XP rewards. It is not a streak, so a missed day never resets your progress.",
  },
];

export function HowToPlayModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  if (!open) return null;
  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <ModalOverlay onClose={() => onOpenChange(false)}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="pm-glass-strong pm-crackle relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl"
      >
        {/* Header */}
        <div className="relative shrink-0 overflow-hidden border-b border-border/40 p-5">
          <div className="pm-seigaiha absolute inset-0 opacity-30 pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="pm-grad-indigo flex h-9 w-9 items-center justify-center rounded-xl text-white">
                <BookOpen className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold pm-text-sea">
                  How to Play
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  Step {step + 1} of {STEPS.length}: {current.title}
                </p>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="pm-pressable rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Close guide"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-black/5 dark:bg-white/5">
          <motion.div
            className="h-full bg-gradient-to-r from-celadon to-jade"
            initial={false}
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 pm-scroll">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl text-white",
                  current.gradient,
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-bold pm-text-sea">
                {current.title}
              </h3>
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">
              {current.body}
            </p>
            <div className="rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 p-3">
              <p className="text-xs text-amber-900 dark:text-amber-100">
                <span className="font-semibold">Tip: </span>
                {current.tip}
              </p>
            </div>
          </motion.div>
        </div>

        {/* Step dots: pinned below the scroll area, above the navigation,
            so they are always centred regardless of content height. */}
        <div className="flex items-center justify-center gap-1.5 py-2 border-t border-border/20">
          {STEPS.map((s, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step
                  ? "w-5 bg-celadon"
                  : "w-1.5 bg-black/15 dark:bg-white/20 hover:bg-black/25 dark:hover:bg-white/30",
              )}
              aria-label={`Go to step ${i + 1}: ${s.title}`}
            />
          ))}
        </div>

        {/* Navigation: three column grid so the page indicator is
            always perfectly centred regardless of button widths. */}
        <div className="grid grid-cols-3 items-center border-t border-border/40 p-4">
          <div className="justify-self-start">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="pm-pressable rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black/5 dark:hover:bg-white/10"
            >
              Back
            </button>
          </div>
          <span className="justify-self-center text-xs text-muted-foreground tabular-nums">
            {step + 1} / {STEPS.length}
          </span>
          <div className="justify-self-end">
            {step < STEPS.length - 1 ? (
              <button
                onClick={() =>
                  setStep((s) => Math.min(STEPS.length - 1, s + 1))
                }
                className="pm-pressable pm-grad-primary rounded-xl px-4 py-2 text-sm font-medium text-white"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={() => onOpenChange(false)}
                className="pm-pressable pm-grad-jade rounded-xl px-4 py-2 text-sm font-medium text-white"
              >
                Set Sail
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </ModalOverlay>
  );
}
