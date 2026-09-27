"use client";

import { Button } from "@/components/ui/button";
import type { PublicUser } from "@/lib/api";
import type { usePhaseSync } from "@/lib/use-phase-sync";
import type { useBarter } from "@/lib/use-barter";
import type { useAid } from "@/lib/use-aid";
import type { useBacking } from "@/lib/use-backing";
import type { useAudit } from "@/lib/use-audit";
import type { useMaroon } from "@/lib/use-maroon";
import type { useRoomRoster } from "@/lib/use-room-roster";
import type { GameState, GameContext } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { ReadyBar } from "../ReadyBar";

type PhaseSync = ReturnType<typeof usePhaseSync>;
export type Barter = ReturnType<typeof useBarter>;
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
        <ReadyBar
          ready={phaseSync.ready}
          members={members}
          className="justify-center"
        />
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
    <div className="mt-5 text-center">
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
