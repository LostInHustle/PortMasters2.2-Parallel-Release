"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Ship,
  Compass,
  Shuffle,
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
import {
  ModalClose,
  ModalOverlay,
  ModalSheet,
} from "@/components/ui/modal-overlay";
import {
  BOON_SWAP_COST,
  CARDS_PER_OFFER,
  EMERGENCY_LOAN_GOLD,
} from "@/lib/game/constants/drafts";
import { BROKERS_FAVOR_UNLOCK_LEVEL } from "@/lib/game/constants/world";
import { INTEL_COST } from "@/lib/game/engine";
import { modeConfig, type GameMode } from "@/lib/game/mode";
import { openingPhase } from "@/lib/game/checkpoint";
import { pathFactText, pathGuide } from "@/lib/game/paths";
import { UNLOCKS, UNLOCK_ORDER } from "@/lib/unlock";
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
 *
 * It takes the mode rather than assuming one, because it is the first
 * manual a captain opens and the lobby is where they choose between the
 * modes: a manual that answered every question with the founding voyage's
 * rules was teaching half the harbor the wrong game before they set sail.
 * What it says about a mode comes out of the record, so the page a
 * captain reads here and the pages they read in the room cannot disagree.
 */

type Step = {
  icon: typeof Ship;
  title: string;
  gradient: string;
  body: string;
  // A list under the body, for a page whose content is a set of rules
  // rather than a paragraph. Two pages use it today: the mode's own page,
  // which prints the differences the mode record lists, and the paths
  // page, which prints one row per path. Written as an array of sentences
  // rather than as one long paragraph so that a reader can count what a
  // mode changes, which is the question they came with.
  points?: readonly string[];
  tip: string;
  // [H9: the unlock code] The manual's own appendix, printed on the step it
  // belongs to rather than in a panel of its own. It is prose from the
  // world rather than advice about a phase, so it reads as a notice under
  // the tip, and it is written with the phrase rather than without it: the
  // plan seeds the phrase on a page of the manual, and this is the manual a
  // captain can actually open. Built from the table so a second sealed
  // harbor adds a sentence here rather than a second copy of this one.
  aside?: string;
};

const STEPS: Step[] = [
  {
    icon: Ship,
    title: "Gather in the Harbor",
    gradient: "pm-grad-harbor",
    body: "Captains gather in a shared harbor. The host picks a difficulty and sets sail. Everyone then plays the same voyage in lockstep: nobody advances a phase until every still active captain has readied up.",
    tip: "You can start a Solo Practice Voyage alone to learn the ropes without waiting for a second captain.",
  },
  {
    icon: ChevronRight,
    title: "Draft a Boon",
    gradient: "pm-grad-dawn",
    body: `Each round opens with a boon draft. Pick one of ${CARDS_PER_OFFER} boons that bend the rules for the coming round: cheaper purchases, faster production, a tax shelter, or an emergency loan of ${EMERGENCY_LOAN_GOLD} Gold.`,
    tip: `You can swap your boon choices once per round for ${BOON_SWAP_COST} Gold if none of the three fit your strategy.`,
  },
  {
    icon: Package,
    title: "Buy at Port",
    gradient: "pm-grad-market",
    body: `Market is the port. Buy raw materials like Hemp, Silk, and Tea from the port merchant. Prices vary per captain and per round. You can also pay ${INTEL_COST} Gold for a Broker's Rumor that guarantees a matching order appears when Orders opens.`,
    tip: "The harbor remembers what everyone bought. A good the room leans into gets pricier next round, while one nobody touches softens.",
  },
  {
    icon: Handshake,
    title: "Barter with Captains",
    gradient: "pm-grad-parley",
    body: "At the Parley you can trade goods and Gold directly with the other captains, whether your voyage runs it before the orders or after them. Post an offer of what you have and what you want, or accept an offer someone else posted. Offered goods are escrowed the moment you post.",
    tip: "You can target a specific captain with a Direct Barter Offer if you want to trade with only them. The Markets station of the Parley holds the escort market, the module market and the bazaar window.",
  },
  {
    icon: TrendingUp,
    title: "Fill Trade Orders",
    gradient: "pm-grad-orders",
    body: "Orders deals the trade manifest. Each entry asks for a set of goods and pays Gold and Reputation. Finished product orders pay more but require artisans to craft them first. The Emperor may also issue a Mandate, a high value order identical for every captain.",
    tip: "Raw material orders are the safe early play. Finished product orders are where the real Reputation lives.",
  },
  {
    icon: Skull,
    title: "Survive Settlement",
    gradient: "pm-grad-resolve",
    // What a failed seat means is the mode's own rule, stated on the
    // mode's page rather than repeated here: the founding mode's ending
    // would be wrong for a Gambit captain, whose voyage carries on.
    body: "Resolve is where the round's bills land. First, pirates may find you and take every Gold coin on hand. Hire an escort to sail safe, or risk it. Then pay wages and ship maintenance, and check the Round End Obligations panel before you spend anything.",
    tip: "Ask the harbor for a loan before assuming the voyage is over. Any captain can lend, and a third captain can back the loan as a safety net.",
  },
  {
    icon: Hammer,
    title: "Upgrade at the Shipyard",
    gradient: "pm-grad-dusk",
    body: "Dusk is the shipyard. Upgrade your ship (opens a new module slot and reduces transport costs) or draft and rig a module. Modules are permanent ship upgrades: a Smuggler's Hold, a Broker's Network, a Salvage Crane, and more.",
    tip: "Do not skip the Shipyard. The transport discount from a higher ship level pays for itself within two rounds.",
  },
  {
    icon: Coins,
    title: "Build Your Legacy",
    gradient: "pm-grad-renown",
    body: `Every voyage's final Reputation becomes Renown XP, multiplied by the difficulty tier. Renown levels grant titles, a small starting Gold bonus, and at level ${BROKERS_FAVOR_UNLOCK_LEVEL} unlock the Broker's Favor. The captain with the highest Reputation in a voyage is crowned Sea Master.`,
    tip: "Check in daily for a seven day cycle of Renown XP rewards. It is not a streak, so a missed day never resets your progress.",
    // The last page, because the harbor's one locked door is about a
    // captain's record rather than about a phase, and this is the page
    // where the record is explained.
    aside: UNLOCK_ORDER.map((id) => UNLOCKS[id].manual).join(" "),
  },
];

/**
 * The mode's own page, which every mode has and only some of them fill.
 *
 * It states the two things a captain needs before the first round and
 * cannot get from the phase pages: what this voyage is, in the mode's own
 * words, and what happens to a seat whose books fail. The list under it is
 * the record's array of differences, which is empty for the founding
 * voyage, and a mode with an empty list is a mode that is what the others
 * differ from rather than a mode with nothing to say.
 *
 * The tip is the sentence the list cannot carry, and it is the one the
 * tutorial's mode page ends on too: a captain who has sailed Classic
 * already knows how to play. That is the answer to the second half of
 * their question, and it is the half a list of rules never answers.
 */
function voyagePage(mode: GameMode): Step {
  const play = modeConfig(mode);
  return {
    icon: Compass,
    title: `${play.badge}: The Voyage You Are Sailing`,
    gradient: "pm-grad-guide",
    body: `${play.tagline} ${play.failureRule}`,
    points: play.differences,
    tip: play.differences.length
      ? "Everything else is the voyage you would sail in Classic, so the rest of this manual reads the same for both."
      : "This is the voyage every other mode is measured against, and the one the rest of these pages describe.",
  };
}

/**
 * The artisan page, whose advice ends on the voyage's own stake rather
 * than on the manual's summary of both stakes.
 *
 * The page reads the mode the way the mode's own page above does, and
 * it is the close of the deferral W1 recorded: the tip used to compare
 * the two modes' consequences in words of the manual's own ("ends the
 * voyage in Classic and leaves a mark in Ocean Gambit"), a second
 * telling of a rule the mode record already owns, printed a page after
 * the record's own telling of it at the top of the same manual. The
 * last sentence is the record's now (see play.failureRule), so the
 * sentence a captain reads here, on the voyage page and in the room's
 * tutorial is one sentence rather than three paraphrases of one rule.
 */
function artisanPage(mode: GameMode): Step {
  const play = modeConfig(mode);
  return {
    icon: Wrench,
    title: "Put Artisans to Work",
    gradient: "pm-grad-market",
    // Artisan management is the port stop's second half (see the legacy
    // phase table in @/lib/game/phases, where the worker bench folds into
    // Market), which is why this page follows Buy at Port.
    body: "Hire weavers, potters, coppersmiths, and other artisans, then assign each a product to craft. Production does not happen instantly: a task assigned now delivers at this round's Resolve, after Orders has already closed.",
    tip: `Hire artisans only when you can sustain at least two rounds of wages. ${play.failureRule}`,
  };
}

/**
 * The paths page: the deal a dealing voyage opens with, and the five cards
 * it can hand a captain.
 *
 * ONB-1's manual half, and it is built from the record rather than
 * written: every entry under the body is a guide row from pathGuide, the
 * same rows the tutorial's path page and the draft's cards print, so a
 * path retuned in @/lib/game/paths changes all three together. The page is
 * drawn only for a mode whose lap opens at the draft (the fold the Welcome
 * screen and the tutorial read too), which keeps the founding voyage's
 * manual the length it has always been rather than adding a page about a
 * deal that mode never makes.
 *
 * The body states the rule the rows cannot (what a path decides about a
 * seat), and the tip is the sentence a new captain needs before the first
 * deal: weigh the numbers, because the flavour sentence is a promise and
 * the numbers are the promise kept.
 */
function pathsPage(mode: GameMode): Step[] {
  if (openingPhase(mode) !== "path_draft") return [];
  return [
    {
      icon: Shuffle,
      title: "Draft Your Path",
      gradient: "pm-grad-path-draft",
      body: "A dealing voyage opens with a card deal rather than a market. Three cards land face down, and at each beat you keep one and pass the rest on: what you hold at the end is your path for the whole voyage. Your path decides your hold, how far your Renown can climb, and which trade orders lock to you.",
      points: pathGuide().map(
        (entry) =>
          `${entry.crest} ${entry.name}: ${entry.signature} ${entry.facts
            .map(pathFactText)
            .join(", ")}.`,
      ),
      tip: "Weigh the numbers under each name rather than the crest. The five paths trade different holds, Renown ceilings and locked order pools, and the one you keep sails with you to the end.",
    },
  ];
}

export function HowToPlayModal({
  open,
  onOpenChange,
  mode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: GameMode;
}) {
  const [step, setStep] = useState(0);
  // The mode's page is second, right after the harbor, because it answers
  // the question a captain arrives with before the pages that answer the
  // questions they have not asked yet. The paths page follows it for a
  // mode that opens at the deal: the deck is the first seat of that
  // voyage, so its page stands before the pages about the seats after it,
  // and a mode that deals no paths draws no page (see pathsPage). The
  // artisan page is drawn from its own function in the slot the step
  // table used to hold (see artisanPage), so the two pages that state a
  // mode's own rules read the record rather than the table.
  const pages = [
    STEPS[0],
    voyagePage(mode),
    ...pathsPage(mode),
    ...STEPS.slice(1, 3),
    artisanPage(mode),
    ...STEPS.slice(3),
  ];
  // The mode can change while this manual is closed, and a shorter list
  // would leave the reader on a page that no longer exists: the index is
  // clamped where it is read rather than reset, so the state stays what the
  // reader left it as and a page they come back to is the page they left.
  const at = Math.min(step, pages.length - 1);
  const current = pages[at];
  const Icon = current.icon;

  // The test sits inside the AnimatePresence rather than above it, so the
  // panel below is still in the tree for the frame its exit animation
  // runs. Returning null up here instead would drop it instantly and make
  // that exit prop dead. SettingsModal and KeyboardShortcutHelp, the two
  // sibling dialogs, are written the same way.
  return (
    <AnimatePresence>
      {open && (
        <ModalOverlay onClose={() => onOpenChange(false)}>
          <ModalSheet maxW="max-w-2xl">
            {/* Header */}
            <div className="relative shrink-0 overflow-hidden border-b border-border/40 p-5">
              <div className="pm-seigaiha absolute inset-0 opacity-30 pointer-events-none" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="pm-grad-guide flex h-9 w-9 items-center justify-center rounded-xl">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold text-guide">
                      How to Play
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                      Step {at + 1} of {pages.length}: {current.title}
                    </p>
                  </div>
                </div>
                <ModalClose
                  label="Close guide"
                  onClick={() => onOpenChange(false)}
                />
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-black/5 dark:bg-white/5">
              <motion.div
                className="h-full bg-gradient-to-r from-celadon to-jade"
                initial={false}
                animate={{ width: `${((at + 1) / pages.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6 pm-scroll">
              <motion.div
                key={at}
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
                  <h3 className="font-display text-lg font-bold text-guide">
                    {current.title}
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-foreground">
                  {current.body}
                </p>
                {/* The rules a mode changes, listed rather than folded
                    into the paragraph above, because a reader asking what
                    is different is counting as much as reading. */}
                {current.points && current.points.length > 0 && (
                  <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground">
                    {current.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                )}
                <div className="rounded-xl bg-warn/[0.07] border border-warn/20 p-3">
                  <p className="text-xs text-warn">
                    <span className="font-semibold">Tip: </span>
                    {current.tip}
                  </p>
                </div>
                {/* The manual's appendix, under the advice rather than
                    inside it: the tip is one voice and the world's own
                    prose is another, and the charter tint is what tells
                    the two apart. */}
                {current.aside && (
                  <div className="rounded-xl bg-charter/[0.07] p-3">
                    <p className="text-xs leading-relaxed text-charter">
                      {current.aside}
                    </p>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Step dots: pinned below the scroll area, above the navigation,
                so they are always centred regardless of content height. */}
            <div className="flex items-center justify-center gap-1.5 py-2 border-t border-border/20">
              {pages.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === at
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
                  disabled={at === 0}
                  className="pm-pressable rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black/5 dark:hover:bg-white/10"
                >
                  Back
                </button>
              </div>
              <span className="justify-self-center text-xs text-muted-foreground tabular-nums">
                {at + 1} / {pages.length}
              </span>
              <div className="justify-self-end">
                {at < pages.length - 1 ? (
                  <button
                    onClick={() =>
                      setStep((s) => Math.min(pages.length - 1, s + 1))
                    }
                    className="pm-pressable pm-grad-guide rounded-xl px-4 py-2 text-sm font-medium"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    onClick={() => onOpenChange(false)}
                    className="pm-pressable pm-grad-guide rounded-xl px-4 py-2 text-sm font-medium"
                  >
                    Set Sail
                  </button>
                )}
              </div>
            </div>
          </ModalSheet>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
