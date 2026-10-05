"use client";

import { VoyageResult, VoyageReveal } from "@/types/realtime/voyage";
import { motion, AnimatePresence } from "framer-motion";
import type { CaptainLegacySummary } from "@/lib/game/legacy";
import { phaseFace } from "@/lib/game/phases";
import { Welcome } from "./phases/Welcome";
import { BoonDraft } from "./phases/BoonDraft";
import { CharterDraft } from "./phases/CharterDraft";
import { MilestoneDraft } from "./phases/MilestoneDraft";
import { Market } from "./phases/Market";
import { Parley } from "./phases/Parley";
import { Orders } from "./phases/Orders";
import { PathDraft } from "./phases/PathDraft";
import { Settlement } from "./phases/Settlement";
import { Shipyard, ModuleDraft, ModuleSwap } from "./phases/Shipyard";
import { VoyageLogPanel } from "./VoyageLogPanel";
import { gambitSystemsOn } from "@/lib/game/mode";
import { Bankruptcy } from "./phases/Bankruptcy";
import { Endgame } from "./phases/Endgame";
import type { PhasePanelProps } from "./phases/PhaseShared";

/**
 * The dispatcher for every phase screen. Every phase is its own module
 * under ./phases and a module level export, so a stable component
 * identity holds across renders and React re renders a phase in place on
 * every game state update instead of unmounting and remounting the whole
 * subtree, which would reset local useState mid interaction (see the
 * ReadyFooter comment in PhaseShared.tsx for the failure this avoids).
 *
 * The motion wrapper runs one sync transition: a fresh
 * `${phase}:${currentRound}` key swaps the subtree in one tick, so a
 * phase change reads as one cross fade rather than a stack of
 * overlapping panels.
 *
 * The dispatcher takes the shared `PhasePanelProps` shape, plus the
 * optional extras its own `Props` type adds for the overlays and
 * payloads not every caller wires up, among them `onTutorialOpen`
 * (used by the Welcome screen's New Player Tutorial button) and
 * `voyageResult` (the harbor wide standings payload the server emits on
 * voyage:complete, also consumed by Endgame). Each is optional so a
 * caller that hasn't wired one in still compiles and renders a sensible
 * default.
 */

// Everything a phase panel takes lives in PhaseShared, and every panel
// imports it from there. This type adds the things the dispatcher alone
// decides: which overlay is open, whether the voyage has concluded, and
// the Endgame extras it forwards rather than renders itself. The reveal
// arrives the same way the standings do, from the parent rather than from
// a hook, because the frame carrying it is the conclusion's own and both
// halves of it are read off the same handler.
type Props = PhasePanelProps & {
  onTutorialOpen?: () => void;
  voyageResult?: VoyageResult | null;
  reveal?: VoyageReveal | null;
  myLegacy?: CaptainLegacySummary | null;
  onRestart?: () => void;
};

export function GamePhasePanel(props: Props) {
  const { game } = props;
  // The phase's own accent, read from its face in @/lib/game/phases, which
  // is the one table that describes a phase: the gradient is not written
  // down again here, so a phase renamed in the engine cannot leave a stale
  // key beside a panel wearing the wrong colour.
  const accentGradient = phaseFace(game.phase).gradient;
  // The floor under the stage is a share of the viewport rather than a
  // flat one: the floor exists so a short phase does not
  // leave a postage stamp of a card over a column of buttons while the
  // page is the thing doing the scrolling, and what reads as a stage
  // scales with the window it stands on, the same reasoning the rails
  // follow. On a wide window the stage owns its own scroll and the panel
  // fills it instead: the card lands flush with the two rails beside it
  // rather than floating at whatever height its content happened to
  // reach, and everything under it waits its turn in the stage's own
  // scroll rather than pushing the rails around.
  return (
    <div className="pm-glass relative overflow-hidden rounded-2xl p-4 sm:p-5 min-h-[clamp(380px,58dvh,560px)] lg:min-h-full">
      {/* Phase accent strip */}
      <motion.div
        className={`absolute inset-x-0 top-0 h-1 ${accentGradient}`}
        layoutId="phaseAccent"
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
      {/* [F6: charters at leg four] The charter overlay, drawn on the
          same slot as the milestone draft and for the same reasons: it
          sits outside the AnimatePresence so the answer does not cross
          fade with a board swap, and it draws nothing at all unless the
          moment is pending (see charterPending). It is mounted before
          the milestone draft rather than after it so that when the two
          stand at once the milestone paints above: the milestone is the
          rarer event and it is answered under the terms it was armed
          with, while the charter's window never closes and can wait for
          the next frame. */}
      <CharterDraft game={game} act={props.act} />
      {/* [F4: boons at milestone moments] The milestone overlay, drawn
          ahead of whichever board the phase is showing. It sits outside
          the AnimatePresence below on purpose: the board beneath it still
          swaps as the fleet moves on, and the moment a captain is
          answering must not cross fade with it. It draws nothing at all
          unless a moment is waiting (see milestonePending), so the
          ordinary screen is the line that follows. */}
      <MilestoneDraft game={game} act={props.act} />
      <AnimatePresence mode="sync">
        <motion.div
          key={`${game.phase}:${game.currentRound}`}
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

/* The accent strip along the top of the panel, one colour per phase.
   The colours live in the phase's own face (see @/lib/game/phases) and
   in src/app/palette.css behind them, so what is left here is the
   lookup: this file writes no gradient table of its own.

   Two pairs do share a hue, and neither pair can ever be on screen
   together: bankruptcy wears Dawn's hue because a voyage that ends there
   never reaches another boon draft, and endgame wears the Module Draft
   hue because a crowned voyage has drafted its last module. Those two
   pairings are checked, not just asserted: see the palette check. */

// The single switch that maps a phase value to its panel. Pulled out of
// GamePhasePanel so the AnimatePresence subtree above stays one element
// deep, which is what lets mode="sync" actually cross fade between two
// phase trees rather than nesting them.
//
// Each case destructures only the subset of props that panel needs:
// explicit prop picking keeps the contract between dispatcher and panel
// documented at the call site, so adding a new prop to a panel is a one
// line change here rather than a silent re build of the panel's whole
// prop surface.
function ActivePhase(props: Props) {
  const {
    game,
    ctx,
    act,
    phaseSync,
    barter,
    aid,
    escort,
    refit,
    modules,
    bazaar,
    backing,
    audit,
    boons,
    maroon,
    voyageLog,
    privateLog,
    me,
    members,
    room,
    colorFor,
    onRumorBoardOpen,
    onTutorialOpen,
    voyageResult,
    reveal,
    myLegacy,
    onRestart,
    roster,
    draft,
  } = props;
  const p = game.phase;

  switch (p) {
    case "harbor":
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
    case "path_draft":
      // [W2: the path draft] The deal's own screen, at the seat a dealing
      // Gambit departure opens at. It is a whole stage rather than a strip
      // above the board, because cards dealt as a band across the table
      // have a captain reading their first market behind them. The panel
      // takes the deal's own board and nothing else; the wait inside it is
      // the room's count rather than a button, so there is no ready footer
      // here to draw (see canLeavePhase, which refuses this seat).
      return <PathDraft draft={draft} />;
    case "dawn":
      return (
        <BoonDraft
          game={game}
          ctx={ctx}
          act={act}
          phaseSync={phaseSync}
          // [F5: public offers] The draft's own screen reads the fleet's
          // ledger under the three cards: the picks are made here, so the
          // table's latest keeps are what a captain stares at while
          // choosing, which is the plan's teach by watching clause.
          boons={boons}
          members={members}
          me={me}
        />
      );
    case "market":
      return (
        <Market
          game={game}
          ctx={ctx}
          act={act}
          phaseSync={phaseSync}
          me={me}
          members={members}
          colorFor={colorFor}
          // [D4: Loom: the Refit] The bench is a station of this phase, so
          // the port board is what draws it. The escort market above is a
          // whole screen's because it opens at the Parley table, which has
          // one panel; the Market has two stations and this one is the
          // port's.
          refit={refit}
          onRumorBoardOpen={onRumorBoardOpen}
        />
      );
    case "parley":
      return (
        <Parley
          game={game}
          ctx={ctx}
          act={act}
          barter={barter}
          escort={escort}
          // [F3: modules in the shipyard ladder, and trading them between
          // captains] The module market, a whole screen's like the two
          // markets around it rather than a station of a phase's, because
          // it opens where they do: at the Parley table.
          modules={modules}
          // [D5: Aroma: the Bazaar Rumor] The desk, which is a whole
          // screen's like the escort market above it rather than a station
          // of a phase's, because it opens where that market does: at the
          // Parley table.
          bazaar={bazaar}
          audit={audit}
          // [F5: public offers] The fleet's ledger under the two votes:
          // the plan's evaluation surface, where the table argues about
          // what each captain passed on.
          boons={boons}
          maroon={maroon}
          me={me}
          phaseSync={phaseSync}
          members={members}
          colorFor={colorFor}
          roster={roster}
        />
      );
    case "orders":
      return (
        <Orders
          game={game}
          ctx={ctx}
          act={act}
          phaseSync={phaseSync}
          members={members}
          colorFor={colorFor}
        />
      );
    case "resolve":
      return (
        <Settlement
          game={game}
          ctx={ctx}
          act={act}
          aid={aid}
          backing={backing}
          me={me}
          phaseSync={phaseSync}
          members={members}
        />
      );
    case "dusk":
      return (
        // [B4: the log surfaces] Dusk carries both logs under the yard.
        // They are one screen because they answer one question, which is
        // what happened while this captain was not looking, and the
        // shipyard is where a leg ends and a captain has the time to read
        // it. The wrapper is a plain block rather than a card: the panel
        // is already inside the phase frame, and a card in a card reads as
        // a mistake.
        //
        // The pair is drawn only for a mode that keeps a log. The server
        // opens none for a Classic harbor (see openVoyageLog's one guarded
        // call), so both columns would be empty here, and an empty frame
        // under the yard is a feature a captain can see and cannot use:
        // the founding mode's Dusk is the yard and nothing else, which is
        // what it was before the log existed.
        <div className="space-y-4">
          <Shipyard
            game={game}
            ctx={ctx}
            act={act}
            phaseSync={phaseSync}
            members={members}
          />
          {gambitSystemsOn(game.mode) && (
            <VoyageLogPanel log={voyageLog} privateLog={privateLog} />
          )}
        </div>
      );
    case "module_draft":
      return (
        <ModuleDraft
          game={game}
          act={act}
          phaseSync={phaseSync}
          members={members}
        />
      );
    case "module_swap":
      return (
        <ModuleSwap
          game={game}
          act={act}
          phaseSync={phaseSync}
          members={members}
        />
      );
    case "bankruptcy":
      return (
        <Bankruptcy
          game={game}
          members={members}
          backing={backing}
          me={me}
          roster={roster}
          // The host's restart travels with the panel for the same reason
          // it travels to Endgame: the room owns the one handler, and the
          // two screens a finished voyage can end on offer the same call.
          room={room}
          onRestart={onRestart}
        />
      );
    case "endgame":
      return (
        <Endgame
          game={game}
          me={me}
          room={room}
          voyageResult={voyageResult}
          reveal={reveal}
          myLegacy={myLegacy}
          onRestart={onRestart}
        />
      );
    default:
      // Defensive: every Phase value is mapped above, so this branch is
      // only reached if a future phase was added to the union without a
      // matching case here. The placeholder copy is intentionally
      // generic so a stranger phase still renders something legible
      // rather than a blank pane. Its floor rides just under the stage
      // floor above so the branch never pushes the card taller than the
      // stage itself intends to stand.
      return (
        <div className="flex min-h-[clamp(320px,52dvh,480px)] flex-col items-center justify-center text-center px-6">
          <div className="pm-grad-brand mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg">
            <span className="font-display text-xl">水</span>
          </div>
          <h2 className="font-display text-2xl text-brand mb-1.5 pm-brush">
            Round {game.currentRound}
          </h2>
          <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
            The Harbormaster is fetching the tide tables.
          </p>
        </div>
      );
  }
}
