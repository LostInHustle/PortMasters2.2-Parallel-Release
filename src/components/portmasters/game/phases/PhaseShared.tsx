"use client";

import { Button } from "@/components/ui/button";
import type { PublicUser } from "@/lib/api";
import type { usePhaseSync } from "@/lib/use-phase-sync";
import type { useBarter } from "@/lib/use-barter";
import type { useEscortContracts } from "@/lib/use-escort-contracts";
import type { useAid } from "@/lib/use-aid";
import type { useBacking } from "@/lib/use-backing";
import type { useAudit } from "@/lib/use-audit";
import type { useMaroon } from "@/lib/use-maroon";
import type { useRoomRoster } from "@/lib/use-room-roster";
import type { VoyageLog } from "@/lib/use-voyage-log";
import type { PrivateEntry } from "@/types/realtime";
import type { GameState, GameContext } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { ReadyBar } from "../ReadyBar";

type PhaseSync = ReturnType<typeof usePhaseSync>;
export type Barter = ReturnType<typeof useBarter>;
// [D3: Convoy: the Escort Contract] The escort market's board, threaded the
// same way the barter board is and for the same reason: the sockets live in
// the room and no phase panel is handed one. Exported because the Parley
// screen's market panel takes it as its own prop.
export type Escort = ReturnType<typeof useEscortContracts>;
type Aid = ReturnType<typeof useAid>;
type Backing = ReturnType<typeof useBacking>;
type Audit = ReturnType<typeof useAudit>;
type Maroon = ReturnType<typeof useMaroon>;
type Roster = ReturnType<typeof useRoomRoster>;

export type PhasePanelProps = {
  game: GameState;
  act: (fn: (g: GameState, logs: string[]) => void) => void;
  ctx: GameContext;
  phaseSync: PhaseSync;
  barter: Barter;
  // [D3: Convoy: the Escort Contract] The market a Convoy captain sells
  // protection from, opened at the Parley table beside the exchange. It is
  // threaded like the board above and draws nothing at all in a build with
  // the switch off, which is the only condition under which any phase pays
  // it no attention: a captain who holds no path of their own still reads
  // the market, because buying cover is what everyone else at the table is
  // there for.
  escort: Escort;
  aid: Aid;
  backing: Backing;
  // The Manifest Audit, threaded like the hooks above rather than called
  // inside the one phase that reads it, because the finding outlives the
  // phase it was made in and the room level strip reads the same state.
  audit: Audit;
  // [H7: Maroon and the Harbormaster] The heavier vote, threaded the same
  // way and for the same reason: the vote is called at the Parley table,
  // and the result it leaves behind is read by the room. The roster comes
  // with it rather than being called again, because the card has to know
  // which captains the harbor may still name, and the room already has an
  // answer to that on this screen.
  maroon: Maroon;
  // [B4: the log surfaces] The room's own log. Threaded rather than read
  // inside the Dusk panel because the socket lives in the room and no
  // phase panel is handed one, but the request for the voyage's lines is
  // not made here: the hook waits to be asked, and the Dusk screen is what
  // asks, so a captain who never stands there costs the server no frame.
  voyageLog: VoyageLog;
  // The other half of the same pair, which the room already holds: the
  // private channel's entries are this captain's own and are drawn under
  // the controls at every phase, so the Dusk screen reads the copy the
  // room made rather than subscribing to the channel a second time.
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
};

/**
 * [B2: hard timers, the server as timekeeper] The room's clock, drawn on a
 * screen a captain has not acted on yet: the tally, the countdown, and the
 * bar that runs down beside it.
 *
 * One widget rather than a countdown of its own, and one place rather than
 * one per screen, because the three screens that show it (a phase's footer,
 * the shipyard, and the port board) all show the same published pair of
 * numbers. A screen that drew its own would be a second answer to "how long
 * is left" the moment the two drifted, and the drift would only be visible
 * to whichever captain happened to be standing there.
 *
 * It draws nothing at all when there is nothing to draw: ReadyBar returns
 * null for a room with no ready state, and a screen with no clock in hand
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
  return (
    <ReadyBar
      ready={phaseSync.ready}
      members={members}
      clock={phaseSync.phaseClock}
      className={cn("justify-center", className)}
    />
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
      <div className="mt-5 space-y-3 text-center">
        <div className="text-sm font-medium text-warn">
          Waiting for the rest of the crew
        </div>
        <PhaseClockBar phaseSync={phaseSync} members={members} />
        <Button
          variant="secondary"
          className="rounded-xl"
          onClick={phaseSync.cancelReady}
        >
          Not ready yet
        </Button>
      </div>
    );
  }
  return (
    <div className="mt-5 space-y-3 text-center">
      {/* [B2: hard timers, the server as timekeeper] The clock belongs on
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

/**
 * An action on this screen that did not go through: a pledge the purse
 * could not cover, a hire that fell through, an offer the market refused.
 * Smaller than the shared Notice because it sits inside the panel rather
 * than above it, and carrying the warning glyph because the captain should
 * see at a glance that nothing happened.
 *
 * No outer spacing of its own, for the same reason Notice has none: each
 * screen knows what it is sitting next to.
 */
export function PhaseError({
  message,
  onDismiss,
  className,
}: {
  message: string;
  onDismiss: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border border-alarm/25 bg-alarm/5 px-3.5 py-2 text-xs text-alarm",
        className,
      )}
    >
      <span>⚠️ {message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss error">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
