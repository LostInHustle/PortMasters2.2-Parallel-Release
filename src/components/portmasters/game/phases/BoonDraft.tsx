"use client";

import { lockInBoon, swapBoonChoices } from "@/lib/game/engine";
import { BOON_SWAP_COST } from "@/lib/game/constants/drafts";
import {
  CancelReadyButton,
  DraftCard,
  DraftGrid,
  DraftSwapButton,
  PhaseClockBar,
  PhaseHeading,
  type PhasePanelProps,
} from "./PhaseShared";

export function BoonDraft({
  game,
  ctx,
  act,
  phaseSync,
  members,
}: Pick<PhasePanelProps, "game" | "ctx" | "act" | "phaseSync" | "members">) {
  const picks = game.boonChoices;
  // This is the screen the user specifically called out for a visible
  // ready indicator: once a captain locks in a boon, swap the picker for
  // the same "x/y ready" readout everyone else gets, rather than leaving
  // a now meaningless set of cards on screen.
  if (phaseSync.waiting) {
    return (
      <div className="max-w-md mx-auto text-center py-10">
        <PhaseHeading layout="mb-1" tone="text-dawn">
          🧭 Boon Locked In
        </PhaseHeading>
        <p className="text-sm text-muted-foreground mb-5">
          The voyage begins once every captain has chosen.
        </p>
        <PhaseClockBar
          phaseSync={phaseSync}
          members={members}
          className="mb-5"
        />
        <CancelReadyButton phaseSync={phaseSync}>
          ↩️ Choose a different Boon
        </CancelReadyButton>
      </div>
    );
  }
  const canSwap = !game.boonSwapUsed && game.money >= BOON_SWAP_COST;
  return (
    <div className="max-w-4xl mx-auto text-center py-2">
      <PhaseHeading layout="mb-1" tone="text-dawn">
        🧭 The Navigator's Compass
      </PhaseHeading>
      <p className="text-sm text-muted-foreground mb-2">
        Draft a Boon to synergize with your strategy
      </p>
      <PhaseClockBar phaseSync={phaseSync} members={members} className="mb-3" />
      <DraftSwapButton
        disabled={!canSwap}
        onClick={() => act((g, l) => swapBoonChoices(g, l))}
      >
        {game.boonSwapUsed
          ? "✅ Boons Swapped This Round"
          : `🔄 Swap Boons (${BOON_SWAP_COST}💰, 1 use/round)`}
      </DraftSwapButton>
      <DraftGrid>
        {picks.map((b) => (
          <DraftCard
            key={b.id}
            tone="border-dawn/15"
            icon={b.icon}
            name={b.name}
            nameClassName="text-foreground"
            desc={b.desc}
            actionLabel="🔒 Lock In Boon"
            actionClassName="pm-grad-dawn"
            onSelect={() =>
              phaseSync.markReady((g, l) => lockInBoon(g, ctx, b.id, l))
            }
          />
        ))}
      </DraftGrid>
    </div>
  );
}
