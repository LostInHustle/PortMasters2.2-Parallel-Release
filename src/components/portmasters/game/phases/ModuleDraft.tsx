"use client";

import { Button } from "@/components/ui/button";
import { cardText } from "@/lib/game/cards";
import {
  cancelModuleDraft,
  handleModuleSelect,
  moduleSlotsOpen,
  moduleSwapPossible,
  swapModuleChoices,
} from "@/lib/game/engine";
import { powerBudgetAllows } from "@/lib/game/held-cards";
import { t } from "@/lib/game/i18n";
import { PanelNote } from "./PhasePanels";
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
 * The harbor's bar is drawn under the header because this screen is a seat
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
  // The swap's button reads the swap's own predicate, the way the
  // shipyard's door reads the draft's (see moduleSwapPossible): a press
  // that can fill all three seats is offered even when the fitting pool has
  // no unseen card, because the same cards seated in new places still change
  // every choice on the table. Only a yard that cannot fill a batch is
  // disabled, and the line below says why.
  const swapDealable = moduleSwapPossible(game);
  const canSwap = !game.moduleSwapUsed && swapDealable;
  return (
    <div className="max-w-4xl mx-auto text-center">
      <PhaseHeading layout="mb-1" tone="text-module-draft" brush>
        {t("🔧 Module Drafting")}
      </PhaseHeading>
      <p className="text-sm text-muted-foreground mb-4">
        {t("Choose a module to install or swap.")}
      </p>
      <PhaseClockBar phaseSync={phaseSync} members={members} className="mb-4" />
      {picks.length === 0 ? (
        <div className="text-center text-muted-foreground text-sm py-8">
          {t(
            "No module choices are on offer right now. A fresh set is rolled each round.",
          )}
        </div>
      ) : (
        <>
          <DraftSwapButton
            disabled={!canSwap}
            onClick={() => act((g, l) => swapModuleChoices(g, l))}
          >
            {game.moduleSwapUsed
              ? t("✅ Choices Swapped This Round")
              : t("🎲 Swap Choices (1 use/round)")}
          </DraftSwapButton>
          {!game.moduleSwapUsed && !swapDealable && (
            <PanelNote className="text-center text-[11px] mb-3">
              {t(
                "Nothing new to deal: every module the yard could offer this hull is either on this table already or aboard. Take one of these, or come back next round.",
              )}
            </PanelNote>
          )}
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
                    moduleSlotsOpen(game) > 0 && powerBudgetAllows(game, card)
                      ? t("✅ Install")
                      : t("🔄 Swap")
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
          {t("⬅️ Back to Shipyard")}
        </Button>
      </div>
    </div>
  );
}
