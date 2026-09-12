"use client";

import { Button } from "@/components/ui/button";
import type { PublicUser } from "@/lib/api";
import type { usePhaseSync } from "@/lib/use-phase-sync";
import type { useBarter } from "@/lib/use-barter";
import type { useAid } from "@/lib/use-aid";
import type { useBacking } from "@/lib/use-backing";
import type { useConvoy } from "@/lib/use-convoy";
import type { useRoomRoster } from "@/lib/use-room-roster";
import type { GameState, GameContext } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { ReadyBar } from "../ReadyBar";

type PhaseSync = ReturnType<typeof usePhaseSync>;
export type Barter = ReturnType<typeof useBarter>;
type Aid = ReturnType<typeof useAid>;
type Backing = ReturnType<typeof useBacking>;
export type Convoy = ReturnType<typeof useConvoy>;
export type Roster = ReturnType<typeof useRoomRoster>;

export type PhasePanelProps = {
  game: GameState;
  act: (fn: (g: GameState, logs: string[]) => void) => void;
  ctx: GameContext;
  phaseSync: PhaseSync;
  barter: Barter;
  aid: Aid;
  backing: Backing;
  convoy: Convoy;
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
  idleLabel: string;
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
