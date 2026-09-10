"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { CaptainLegacySummary } from "@/lib/game/legacy";
import type { VoyageResult } from "@/types/realtime";
import { Welcome } from "./phases/Welcome";
import { BoonDraft } from "./phases/BoonDraft";
import { Purchase } from "./phases/Purchase";
import { BarterPhase } from "./phases/BarterPhase";
import { WorkerMgmt } from "./phases/WorkerMgmt";
import { Orders } from "./phases/Orders";
import { Settlement } from "./phases/Settlement";
import { Shipyard, ModuleDraft, ModuleSwap } from "./phases/Shipyard";
import { Bankruptcy } from "./phases/Bankruptcy";
import { Endgame } from "./phases/Endgame";
import type { PhasePanelProps } from "./phases/PhaseShared";

/**
 * The dispatcher for every phase screen. Each phase used to be a nested
 * function component declared directly in this file (a 2500+ line single
 * file holding all twenty of them); they are now one module per phase
 * under ./phases, each still a module level export for the same reason
 * they were pulled out of GamePhasePanel's own body in the first place:
 * a stable component identity across renders, so React re renders a phase
 * in place on every game state update instead of unmounting and
 * remounting the whole subtree (which used to reset local useState mid
 * interaction, see PhaseShared.tsx's ReadyFooter comment for the
 * original incident).
 *
 * The motion wrapper keeps the original sync transition: a fresh
 * `${phase}:${currentRound}` key swaps the subtree in one tick, so a
 * phase change reads as one cross fade rather than a stack of
 * overlapping panels.
 *
 * The dispatcher takes the shared `PhasePanelProps` shape, plus three
 * optional extras that not every caller wires up: `onTutorialOpen`
 * (used by the Welcome screen's New Player Tutorial button),
 * `onSaveChronicle` (used by the Endgame screen's chronicle opt in
 * checkbox), and `voyageResult` (the harbor wide standings payload the
 * server emits on voyage:complete, also consumed by Endgame). Each is
 * optional so a caller that hasn't wired them in still compiles and
 * renders a sensible default.
 */

// The shared props every phase panel takes, re exported so any caller
// that needs the shape (the dispatcher itself, the GameRoom that builds
// it, a storybook fixture) imports it from the canonical home in
// PhaseShared.
export type { PhasePanelProps } from "./phases/PhaseShared";

type Props = PhasePanelProps & {
  onTutorialOpen?: () => void;
  onSaveChronicle?: () => void;
  voyageResult?: VoyageResult | null;
  // Endgame also accepts myLegacy and onRestart as optional, but the
  // dispatcher deliberately does not take them as its own props; if a
  // caller needs them wired through, the Endgame panel can be rendered
  // directly with those props. Keeping the dispatcher's surface narrow
  // matches the original spec: only onTutorialOpen, onSaveChronicle,
  // and voyageResult are added on top of PhasePanelProps here.
  myLegacy?: CaptainLegacySummary | null;
  onRestart?: () => void;
};

export function GamePhasePanel(props: Props) {
  const { game } = props;
  const phaseKey = String(game.phase);
  // A phase specific accent gradient strip at the top of the panel.
  // Each phase gets its own colour so the transition between phases is
  // visually distinct even before the content swaps in.
  const accentGradient = PHASE_ACCENTS[phaseKey] ?? "pm-grad-primary";
  return (
    <div className="pm-glass relative overflow-hidden rounded-2xl p-4 sm:p-5 min-h-[520px]">
      {/* Phase accent strip */}
      <motion.div
        className={`absolute inset-x-0 top-0 h-1 ${accentGradient}`}
        layoutId="phaseAccent"
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
      <AnimatePresence mode="sync">
        <motion.div
          key={`${phaseKey}:${game.currentRound}`}
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1.0] }}
        >
          <ActivePhase {...props} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// The accent gradient for each phase. Chosen to match the phase's mood:
// welcome is celadon (calm harbor), boon draft is gold (opportunity),
// purchase is jade (growth), barter is indigo (exchange), worker
// management is amber (craft), orders is primary (commerce),
// settlement is vermilion (danger), shipyard is gold (upgrade),
// bankruptcy is vermilion (loss), endgame is violet (legacy).
const PHASE_ACCENTS: Record<string, string> = {
  "0": "pm-grad-primary",
  "5": "pm-grad-gold",
  "1": "pm-grad-jade",
  barter: "pm-grad-indigo",
  worker_mgmt: "pm-grad-amber",
  "2": "pm-grad-primary",
  "3": "pm-grad-vermilion",
  "4": "pm-grad-gold",
  module_draft: "pm-grad-gold",
  module_swap: "pm-grad-amber",
  bankruptcy: "pm-grad-vermilion",
  endgame: "pm-grad-violet",
};

// The single switch that maps a phase value to its panel. Pulled out of
// GamePhasePanel so the AnimatePresence subtree above stays one element
// deep, which is what lets mode="sync" actually cross fade between two
// phase trees rather than nesting them.
//
// Each case destructures only the subset of props that panel needs, the
// same pattern the original GamePhasePanel used: explicit prop picking
// keeps the contract between dispatcher and panel documented at the
// call site, so adding a new prop to a panel is a one line change here
// rather than a silent re build of the panel's whole prop surface.
function ActivePhase(props: Props) {
  const {
    game,
    ctx,
    act,
    phaseSync,
    barter,
    aid,
    backing,
    me,
    members,
    room,
    colorFor,
    onRumorBoardOpen,
    onTutorialOpen,
    onSaveChronicle,
    voyageResult,
    myLegacy,
    onRestart,
    roster,
  } = props;
  const p = game.phase;

  switch (p) {
    case 0:
      return (
        <Welcome
          game={game}
          phaseSync={phaseSync}
          members={members}
          me={me}
          room={room}
          onTutorialOpen={onTutorialOpen}
        />
      );
    case 5:
      return (
        <BoonDraft
          game={game}
          ctx={ctx}
          act={act}
          phaseSync={phaseSync}
          members={members}
        />
      );
    case 1:
      return (
        <Purchase
          game={game}
          act={act}
          phaseSync={phaseSync}
          members={members}
          colorFor={colorFor}
          onRumorBoardOpen={onRumorBoardOpen}
        />
      );
    case "barter":
      return (
        <BarterPhase
          game={game}
          act={act}
          barter={barter}
          me={me}
          phaseSync={phaseSync}
          members={members}
          colorFor={colorFor}
        />
      );
    case "worker_mgmt":
      return (
        <WorkerMgmt
          game={game}
          ctx={ctx}
          act={act}
          phaseSync={phaseSync}
          members={members}
          colorFor={colorFor}
        />
      );
    case 2:
      return (
        <Orders
          game={game}
          act={act}
          ctx={ctx}
          phaseSync={phaseSync}
          members={members}
          colorFor={colorFor}
        />
      );
    case 3:
      return (
        <Settlement
          game={game}
          act={act}
          aid={aid}
          backing={backing}
          me={me}
          phaseSync={phaseSync}
          members={members}
        />
      );
    case 4:
      return (
        <Shipyard
          game={game}
          act={act}
          phaseSync={phaseSync}
          members={members}
        />
      );
    case "module_draft":
      return <ModuleDraft game={game} act={act} />;
    case "module_swap":
      return <ModuleSwap game={game} act={act} />;
    case "bankruptcy":
      return (
        <Bankruptcy
          game={game}
          members={members}
          backing={backing}
          me={me}
          room={room}
          roster={roster}
        />
      );
    case "endgame":
      return (
        <Endgame
          game={game}
          phaseSync={phaseSync}
          me={me}
          room={room}
          voyageResult={voyageResult}
          myLegacy={myLegacy}
          onRestart={onRestart}
          onSaveChronicle={onSaveChronicle}
        />
      );
    default:
      // Defensive: every Phase value is mapped above, so this branch is
      // only reached if a future phase was added to the union without a
      // matching case here. The placeholder copy is intentionally
      // generic so a stranger phase still renders something legible
      // rather than a blank pane.
      return (
        <div className="flex min-h-[480px] flex-col items-center justify-center text-center px-6">
          <div className="pm-grad-primary mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg">
            <span className="font-display text-xl text-white">水</span>
          </div>
          <h2 className="font-display text-2xl pm-text-sea mb-1.5 pm-brush">
            Round {game.currentRound}
          </h2>
          <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
            The harbor master is fetching the tide tables.
          </p>
        </div>
      );
  }
}
