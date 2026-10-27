"use client";

import { Button } from "@/components/ui/button";
import { cardText } from "@/lib/game/cards";
import { HELD_POWER_CAP } from "@/lib/game/constants/cards";
import { finalizeModuleSwap } from "@/lib/game/engine";
import { powerAfterTaking, powerBudgetAllows } from "@/lib/game/held-cards";
import { t } from "@/lib/game/i18n";
import { Term } from "../../Term";
import {
  PhaseClockBar,
  PhaseHeading,
  type PhasePanelProps,
} from "./PhaseShared";

/**
 * The swap: which module aboard the newly drafted one replaces. Every
 * fitted module is offered, and the captain may also step back to the
 * picker without spending the choice.
 *
 * Each row reads its own slot's arithmetic: the
 * new module landing where that one sat, so replacing a heavy module can
 * be allowed while replacing a light one is not, and the disabled rows
 * say why before the click (the engine refuses the same picks as the
 * floor under this). A card is parked here only when it fits over the
 * heaviest module on the hull, so at least one row always fits, even when
 * the open slot's own arithmetic refused the card on the draft screen.
 *
 * The harbor's bar is drawn under the header for the reason the draft's is:
 * this screen is a seat the ready check waits on, and the captain standing
 * in it is the one who should be able to see the table waiting.
 */
export function ModuleSwap({
  game,
  act,
  phaseSync,
  members,
}: Pick<PhasePanelProps, "game" | "act" | "phaseSync" | "members">) {
  const newMod = game._newModule;
  const newText = newMod ? cardText(newMod) : null;
  return (
    <div className="max-w-2xl mx-auto text-center">
      <PhaseHeading layout="mb-1" tone="text-module-swap" brush>
        {t("🔄 Select Module to Replace")}
      </PhaseHeading>
      {newMod && newText && (
        <p className="text-sm text-muted-foreground mb-4">
          {t("New: {icon} {name}: {desc}", {
            icon: newMod.icon,
            name: newText.name,
            desc: newText.desc,
          })}
        </p>
      )}
      <PhaseClockBar phaseSync={phaseSync} members={members} className="mb-4" />
      <div className="rounded-xl border border-module-swap/15 bg-module-swap/[0.03] p-4 my-4 space-y-2 text-left">
        {/* The rows are the hull's seats, and the press below names the seat
            it means rather than the card: each seat holds a distinct module
            now, because the yard never deals one the hull already carries,
            but the index is what finalizeModuleSwap takes and what the key
            keeps stable across a hull that moves under the picker. */}
        {game.equippedModules.map((card, i) => {
          const text = cardText(card);
          const blocked =
            newMod !== undefined && !powerBudgetAllows(game, newMod, card);
          return (
            <div
              key={`${card.id}:${i}`}
              className="flex justify-between items-center bg-background/60 rounded-md p-2.5 border border-black/5 dark:border-white/10"
            >
              <div>
                <strong>
                  {card.icon} <Term term={text.name}>{text.name}</Term>
                </strong>
                <div className="text-[11px] text-muted-foreground">
                  {text.desc}
                </div>
                {blocked && newMod && (
                  <div className="text-[11px] text-alarm mt-1">
                    {t(
                      "Replacing it would put your hull at {newPower} power, and a hull carries at most {HELD_POWER_CAP}.",
                      {
                        newPower: powerAfterTaking(game, newMod, card),
                        HELD_POWER_CAP,
                      },
                    )}
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant={blocked ? "secondary" : "destructive"}
                className="rounded-lg shrink-0"
                disabled={blocked}
                onClick={() => act((g, l) => finalizeModuleSwap(g, i, l))}
              >
                {t("🗑️ Replace")}
              </Button>
            </div>
          );
        })}
      </div>
      <Button
        variant="secondary"
        className="rounded-xl"
        // Back to Draft from ModuleSwap is a different transition than the
        // ModuleDraft "Back to Shipyard" button below: this one keeps the
        // already drafted pool and the picked _newModule, just lands the
        // captain back on the picker so they can reconsider. cancelModuleDraft
        // would drop the half chosen swap and bounce all the way to the
        // Shipyard, so this is the one place we still set the phase directly.
        // There is no engine helper for "back to draft but keep the choice"
        // because that state is already valid: phase = "module_draft" with
        // _draftChoices and _newModule intact is exactly what
        // startModuleDrafting produces.
        onClick={() =>
          act((g, _l) => {
            g.phase = "module_draft";
          })
        }
      >
        {t("⬅️ Back to Draft")}
      </Button>
    </div>
  );
}
