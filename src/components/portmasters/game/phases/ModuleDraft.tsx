"use client";

import { Button } from "@/components/ui/button";
import {
  cancelModuleDraft,
  handleModuleSelect,
  swapModuleChoices,
} from "@/lib/game/engine";
import {
  DraftCard,
  DraftGrid,
  DraftSwapButton,
  PhaseHeading,
  type PhasePanelProps,
} from "./PhaseShared";

/**
 * The module draft: the three modules this round is offering, the once a
 * round swap, and the way back out to the shipyard without picking one.
 * The cards are the same draft cards the boon draft deals, in the module
 * hue.
 */
export function ModuleDraft({
  game,
  act,
}: Pick<PhasePanelProps, "game" | "act">) {
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
            {picks.map((m, i) => (
              <DraftCard
                key={m.id}
                tone="border-module-draft/20"
                icon={m.icon}
                name={m.name}
                desc={m.desc}
                actionLabel={
                  game.equippedModules.length < game.shipLevel
                    ? "✅ Install"
                    : "🔄 Swap"
                }
                actionClassName="pm-grad-module-draft"
                onSelect={() => act((g, l) => handleModuleSelect(g, i, l))}
              />
            ))}
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
