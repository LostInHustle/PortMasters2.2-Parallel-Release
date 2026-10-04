"use client";

import { Button } from "@/components/ui/button";
import { cardText } from "@/lib/game/cards";
import {
  cancelModuleDraft,
  handleModuleSelect,
  moduleSlotsOpen,
  swapModuleChoices,
} from "@/lib/game/engine";
import {
  DraftCard,
  DraftGrid,
  DraftSwapButton,
  PhaseClockBar,
  PhaseHeading,
  type PhasePanelProps,
} from "./PhaseShared";

/**
 * The module draft: the three modules this round is offering, the once a
 * round swap, and the way back out to the shipyard without picking one.
 * The cards are the same draft cards the boon draft deals, in the module
 * hue.
 *
 * The room's bar is drawn under the header because this screen is a seat
 * the ready check waits on: a captain inside the draft is standing at
 * Dusk, and the table holds for them until they finish or the seat's clock
 * runs out. The bar is what says so, with the countdown and the captains
 * still deciding, so nobody reading a module card is the last to know the
 * table is ready to move.
 */
export function ModuleDraft({
  game,
  act,
  phaseSync,
  members,
}: Pick<PhasePanelProps, "game" | "act" | "phaseSync" | "members">) {
  const picks = game._draftChoices ?? [];
  const canSwap = !game.moduleSwapUsed;
  return (
    <div className="max-w-4xl mx-auto text-center">
      <PhaseHeading layout="mb-1" tone="text-module-draft" brush>
        🔧 Module Drafting
      </PhaseHeading>
      <p className="text-sm text-muted-foreground mb-4">
        Choose a module to install or swap.
      </p>
      <PhaseClockBar phaseSync={phaseSync} members={members} className="mb-4" />
      {picks.length === 0 ? (
        <div className="text-center text-muted-foreground text-sm py-8">
          No module choices are on offer right now. A fresh set is rolled each
          round.
        </div>
      ) : (
        <>
          <DraftSwapButton
            disabled={!canSwap}
            onClick={() => act((g, l) => swapModuleChoices(g, l))}
          >
            {game.moduleSwapUsed
              ? "✅ Choices Swapped This Round"
              : "🎲 Swap Choices (1 use/round)"}
          </DraftSwapButton>
          <DraftGrid>
            {picks.map((card, i) => {
              const text = cardText(card);
              return (
                <DraftCard
                  key={card.id}
                  tone="border-module-draft/20"
                  icon={card.icon}
                  name={text.name}
                  desc={text.desc}
                  actionLabel={
                    moduleSlotsOpen(game) > 0 ? "✅ Install" : "🔄 Swap"
                  }
                  actionClassName="pm-grad-module-draft"
                  onSelect={() => act((g, l) => handleModuleSelect(g, i, l))}
                />
              );
            })}
          </DraftGrid>
        </>
      )}
      <div className="mt-5">
        <Button
          variant="secondary"
          className="rounded-xl"
          onClick={() => act((g, _l) => cancelModuleDraft(g))}
        >
          ⬅️ Back to Shipyard
        </Button>
      </div>
    </div>
  );
}
