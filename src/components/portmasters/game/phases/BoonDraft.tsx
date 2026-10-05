"use client";

import { cardText } from "@/lib/game/cards";
import { lockInBoon, swapBoonChoices } from "@/lib/game/engine";
import { BOON_SWAP_COST } from "@/lib/game/constants/drafts";
import { OpenBoons } from "../OpenBoons";
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
  boons,
  members,
  me,
}: Pick<
  PhasePanelProps,
  "game" | "ctx" | "act" | "phaseSync" | "boons" | "members" | "me"
>) {
  const picks = game.boonChoices;
  // Once a captain locks in a boon, swap the picker for the same "x/y
  // ready" readout everyone else gets, rather than leaving a now
  // meaningless set of cards on screen.
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
        {/* [F5: public offers] The ledger follows a captain who has
            locked in, because the wait is exactly when the table's other
            picks are worth reading: the room is still choosing, and what
            each seat kept is the news. */}
        <OpenBoons
          game={game}
          me={me}
          members={members}
          entries={boons.entries}
          className="mt-6 text-left"
        />
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
        {picks.map((card) => {
          const text = cardText(card);
          return (
            <DraftCard
              key={card.id}
              tone="border-dawn/15"
              icon={card.icon}
              name={text.name}
              nameClassName="text-foreground"
              desc={text.desc}
              actionLabel="🔒 Lock In Boon"
              actionClassName="pm-grad-dawn"
              onSelect={() =>
                phaseSync.markChoiceReady((g, l) =>
                  lockInBoon(g, ctx, card.id, l),
                )
              }
            />
          );
        })}
      </DraftGrid>
      {/* [F5: public offers] And the ledger under the cards, live as the
          table locks in: a captain choosing stares at the same board the
          rest of the room is reading, which is the plan's teach the pool
          by watching clause. It draws nothing until a first pick lands. */}
      <OpenBoons
        game={game}
        me={me}
        members={members}
        entries={boons.entries}
        className="mt-5 text-left"
      />
    </div>
  );
}
