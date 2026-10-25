"use client";

import { PrivateEntry } from "@/types/realtime/private-entry";
import { Button } from "@/components/ui/button";
import type { PublicUser } from "@/lib/api";
import type { usePhaseSync } from "@/lib/use-phase-sync";
import type { useBarter } from "@/lib/use-barter";
import type { useEscortContracts } from "@/lib/use-escort-contracts";
import type { useRefitContracts } from "@/lib/use-refit-contracts";
import type { useModuleTrades } from "@/lib/use-module-trades";
import type { useBazaarRumors } from "@/lib/use-bazaar-rumors";
import type { useAid } from "@/lib/use-aid";
import type { useBacking } from "@/lib/use-backing";
import type { useAudit } from "@/lib/use-audit";
import type { useBoonLedger } from "@/lib/use-boon-ledger";
import type { useMaroon } from "@/lib/use-maroon";
import type { useRoomRoster } from "@/lib/use-room-roster";
import type { usePathDraft } from "@/lib/use-path-draft";
import type { VoyageLog } from "@/lib/use-voyage-log";
import type { GameState, GameContext } from "@/lib/game/types";
import { t } from "@/lib/game/i18n";
import { cn } from "@/lib/utils";
import type { LedgerAct } from "@/lib/game/ledger";
import { ReadyBar } from "../ReadyBar";
import { usePhaseClock } from "@/lib/use-phase-clock";

type PhaseSync = ReturnType<typeof usePhaseSync>;
export type Barter = ReturnType<typeof useBarter>;
// The escort market's board, threaded the
// same way the barter board is and for the same reason: the sockets live in
// the harbor and no phase panel is handed one. Exported because the Parley
// screen's market panel takes it as its own prop.
export type Escort = ReturnType<typeof useEscortContracts>;
// The bench's board, threaded the same way and for the
// same reason. Exported because the port screen's bench panel takes it as
// its own prop, which is the one difference between the two markets at this
// layer: the escort's market is a whole phase screen's, and this one is a
// station of the Market.
export type Refit = ReturnType<typeof useRefitContracts>;
// The module market's board, threaded the same way and for the same reason.
// Exported because the Parley screen's market panel takes it as its own
// prop, which is where this one sits: the market the design puts at the
// table, beside the exchange, the protection market and the rumor desk.
export type ModuleTrades = ReturnType<typeof useModuleTrades>;
// The bazaar's board, threaded the same way
// and for the same reason. Exported because the Parley screen's desk panel
// takes it as its own prop, which is where this one sits: the market the
// design puts at the table, beside the exchange and the protection market.
export type Bazaar = ReturnType<typeof useBazaarRumors>;
type Aid = ReturnType<typeof useAid>;
type Backing = ReturnType<typeof useBacking>;
// Exported because the two vote panels that take them as props
// (AuditPanel, MaroonPanel) name them rather than redeclaring the alias
// locally.
export type Audit = ReturnType<typeof useAudit>;
export type Maroon = ReturnType<typeof useMaroon>;
type Boons = ReturnType<typeof useBoonLedger>;
type Roster = ReturnType<typeof useRoomRoster>;
// The deal's own board, threaded like every market
// above and for the same reason: the socket lives in the harbor and no phase
// panel is handed one. The hand it holds is this captain's own, which is
// what makes it the one board here that is drawn on exactly one seat: the
// draft's screen is where the cards are, and every other screen draws
// nothing of it (see PathDraft in ./PathDraft).
type Draft = ReturnType<typeof usePathDraft>;

export type PhasePanelProps = {
  game: GameState;
  act: LedgerAct;
  ctx: GameContext;
  phaseSync: PhaseSync;
  barter: Barter;
  // The market a Convoy captain sells
  // protection from, opened at the Parley table beside the exchange. It is
  // threaded like the board above and draws nothing at all in a build with
  // the switch off, which is the only condition under which any phase pays
  // it no attention: a captain who holds no path of their own still reads
  // the market, because buying cover is what everyone else at the table is
  // there for.
  escort: Escort;
  // The bench a Loom captain sells repair work from,
  // opened at the port station of the Market phase. Threaded like the
  // market above and drawn in exactly the same circumstances: a captain who
  // holds no path of their own still reads it, because buying a refit is
  // what the bench is for, and a build with the switch off draws nothing at
  // all of it.
  refit: Refit;
  // The market a captain lists a hull's module from, opened at
  // the Parley table beside the protection market. Threaded like the two
  // markets above and drawn in the same circumstances: a captain with an
  // empty hull still reads the board, because buying a module is what the
  // market is for, and a build with the switch off draws nothing at all
  // of it.
  modules: ModuleTrades;
  // The desk an Aroma captain speaks from at
  // the Parley table, and the board the whole fleet reads there. Threaded
  // like the two markets above and drawn in the same circumstances: a
  // captain who holds no path of their own still reads the board, because
  // knowing who spoke is the half of this feature that makes a price move
  // attributable, and a build with the switch off draws none of it.
  bazaar: Bazaar;
  aid: Aid;
  backing: Backing;
  // The Manifest Audit, threaded like the hooks above rather than called
  // inside the one phase that reads it, because the finding outlives the
  // phase it was made in and the harbor level strip reads the same state.
  audit: Audit;
  // The fleet's ledger, threaded the same way and for
  // the same reason: the picks are made at Dawn and read at Parley, so
  // the state cannot belong to either phase's own hook. The panels draw
  // nothing at all of it in a Classic harbor, and the hook itself is
  // inert there (see @/lib/use-boon-ledger).
  boons: Boons;
  // The heavier vote, threaded the same
  // way and for the same reason: the vote is called at the Parley table,
  // and the result it leaves behind is read by the harbor. The roster comes
  // with it rather than being called again, because the card has to know
  // which captains the harbor may still name, and the harbor already has an
  // answer to that on this screen.
  maroon: Maroon;
  // The harbor's own log. Threaded rather than read
  // inside the Dusk panel because the socket lives in the harbor and no
  // phase panel is handed one, but the request for the voyage's lines is
  // not made here: the hook waits to be asked, and the Dusk screen is what
  // asks, so a captain who never stands there costs the server no frame.
  voyageLog: VoyageLog;
  // The other half of the same pair, which the harbor already holds: the
  // private channel's entries are this captain's own and are drawn under
  // the controls at every phase, so the Dusk screen reads the copy the
  // harbor made rather than subscribing to the channel a second time.
  privateLog: PrivateEntry[];
  me: PublicUser;
  members: PublicUser[];
  room: { id: string; code: string; name: string; hostId: string };
  colorFor?: (item: string) => string | undefined;
  onRumorBoardOpen?: () => void;
  // The live roster statuses for spectator mode. Optional because most
  // phases do not need it; Bankruptcy and Endgame use it to show a live
  // standings board of the captains still sailing.
  roster?: Roster;
  // The harbor's deal, as this captain meets it. The
  // one board here that the harbor does not share: what it holds is this
  // captain's own hand while the draft runs, the count of the table still
  // choosing, and the path it settled on. Required, because the seat it is
  // drawn on is a seat of every dealing Gambit lap rather than a screen
  // that might be open (see the PathDraft case in ../GamePhasePanel).
  draft: Draft;
};

// The two boards of the Market (the port's purchase board and the
// manifest's order board) take exactly this much of the phase panel: the
// game, the act, and the cargo color reader. Named once so the two board
// signatures cannot drift apart.
export type MarketBoardProps = Pick<PhasePanelProps, "game" | "act"> & {
  colorFor: (item: string) => string | undefined;
};

/**
 * The harbor's clock, drawn on a
 * screen a captain has not acted on yet: the tally, the countdown, and the
 * bar that runs down beside it.
 *
 * One widget rather than a countdown of its own, and one place rather than
 * one per screen, because the screens that show it (a phase's footer, the
 * shipyard, the shipyard's two sub screens, and the port board) all show
 * the same published pair of numbers. A screen that drew its own would be a
 * second answer to "how long is left" the moment the two drifted, and the
 * drift would only be visible to whichever captain happened to be standing
 * there.
 *
 * It draws nothing at all when there is nothing to draw: ReadyBar returns
 * null for a harbor with no ready state, and a screen with no clock in hand
 * (the pier, a server with the clock switched off, a panel that drew before
 * the first frame arrived) passes none, so every one of those reads as the
 * absence it is rather than as a countdown of zero.
 */
export function PhaseClockBar({
  phaseSync,
  members,
  className,
}: {
  phaseSync: PhaseSync;
  members: PublicUser[];
  className?: string;
}) {
  // The clock, ticked here rather than in the harbor's own hook. The hook
  // carries the deadline, and the countdown is composed from it by the one
  // panel that draws it, so the second that passes costs this bar a redraw
  // and not the whole harbor one.
  const clock = usePhaseClock(phaseSync.phaseDeadline);
  return (
    <ReadyBar
      ready={phaseSync.ready}
      members={members}
      clock={clock}
      className={cn("justify-center", className)}
    />
  );
}

/**
 * The button that takes a ready vote back. Every waiting screen on the
 * harbor carries one, and the three that do (the phase footer, the
 * shipyard and the boon draft) had grown a copy each of the same variant,
 * the same radius and the same cancel call.
 */
export function CancelReadyButton({
  phaseSync,
  className,
  children,
}: {
  phaseSync: PhaseSync;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="secondary"
      className={cn("rounded-xl", className)}
      onClick={phaseSync.cancelReady}
    >
      {children}
    </Button>
  );
}

/**
 * The body of a screen whose captain has voted and is waiting on the rest
 * of the harbor: the line, the clock, and the way back out of the vote.
 *
 * One component because the three screens that wait (a phase footer, the
 * shipyard, the boon draft) were drawing the same three elements, and the
 * only differences between them ever were a word of the line and a glyph
 * on the button. Those are props; the shape is not.
 *
 * The line is not always the same sentence, so it is passed: the shipyard
 * says it is waiting on the crew with a countdown in front of it, and the
 * boon draft has its own reason to be waiting. The default is the footer's
 * wording, which is the one every other screen uses, and it is read here
 * where it is authored: every caller that passes one hands over a sentence
 * it has already read in this language.
 */
export function PhaseWaiting({
  phaseSync,
  members,
  title = t("Waiting for the rest of the crew"),
  cancelLabel = t("Not ready yet"),
  className,
}: {
  phaseSync: PhaseSync;
  members: PublicUser[];
  title?: string;
  cancelLabel?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(className, "space-y-3 text-center")}>
      <div className="text-sm font-medium text-warn">{title}</div>
      <PhaseClockBar phaseSync={phaseSync} members={members} />
      <CancelReadyButton phaseSync={phaseSync}>{cancelLabel}</CancelReadyButton>
    </div>
  );
}

export function ReadyFooter({
  phaseSync,
  members,
  idleLabel,
  onConfirm,
  idleClassName,
}: {
  phaseSync: PhaseSync;
  members: PublicUser[];
  /**
   * The content of the idle button. A node rather than a string because
   * the Force Pay variant carries an icon; every other screen passes a
   * plain sentence and reads as one.
   */
  idleLabel: React.ReactNode;
  onConfirm: () => void;
  idleClassName?: string;
}) {
  if (phaseSync.waiting) {
    return (
      <PhaseWaiting phaseSync={phaseSync} members={members} className="mt-5" />
    );
  }
  return (
    <div className="mt-5 space-y-3 text-center">
      {/* The clock belongs on
          the screen a captain has not acted on at least as much as on the
          one they are waiting on. */}
      <PhaseClockBar phaseSync={phaseSync} members={members} />
      <Button
        className={cn("rounded-xl px-6", idleClassName)}
        onClick={onConfirm}
      >
        {idleLabel}
      </Button>
    </div>
  );
}

// The fittings the panel bodies are built from and the two card frames the
// boards and the drafts are drawn on live beside this file, and are
// passed on here, which is the path every phase panel imports them from.
// Two module splits rather than one file because a single shared file had
// grown past what any one of its readers was looking for: the chrome a
// screen waits behind stays here, and the pieces a screen is drawn from
// sit in PhasePanels and PhaseCards.
export {
  artisanTint,
  PhaseHeading,
  PanelTitle,
  PanelHeading,
  HuePanel,
  SummaryHeading,
  PanelNote,
  PanelStat,
  PanelTotal,
  FigureTile,
  StationStrip,
  IntelBanner,
  PathDeskRow,
  JustForChip,
} from "./PhasePanels";
export { TradeCard, DraftGrid, DraftCard, DraftSwapButton } from "./PhaseCards";
