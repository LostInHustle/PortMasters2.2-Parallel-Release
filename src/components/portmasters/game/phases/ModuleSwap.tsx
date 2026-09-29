"use client";

import { Button } from "@/components/ui/button";
import { finalizeModuleSwap } from "@/lib/game/engine";
import { Term } from "../../Term";
import { PhaseHeading, type PhasePanelProps } from "./PhaseShared";

/**
 * The swap: which module aboard the newly drafted one replaces. Every
 * fitted module is offered, and the captain may also step back to the
 * picker without spending the choice.
 */
export function ModuleSwap({
  game,
  act,
}: Pick<PhasePanelProps, "game" | "act">) {
  const newMod = game._newModule;
  return (
    <div className="max-w-2xl mx-auto text-center">
      <PhaseHeading layout="mb-1" tone="text-module-swap" brush>
        🔄 Select Module to Replace
      </PhaseHeading>
      {newMod && (
        <p className="text-sm text-muted-foreground mb-4">
          New: {newMod.icon} {newMod.name}: {newMod.desc}
        </p>
      )}
      <div className="rounded-xl border border-module-swap/15 bg-module-swap/[0.03] p-4 my-4 space-y-2 text-left">
        {game.equippedModules.map((m, i) => (
          <div
            key={m.id}
            className="flex justify-between items-center bg-background/60 rounded-md p-2.5 border border-black/5 dark:border-white/10"
          >
            <div>
              <strong>
                {m.icon} <Term term={m.name}>{m.name}</Term>
              </strong>
              <div className="text-[11px] text-muted-foreground">{m.desc}</div>
            </div>
            <Button
              size="sm"
              variant="destructive"
              className="rounded-lg"
              onClick={() => act((g, l) => finalizeModuleSwap(g, i, l))}
            >
              🗑️ Replace
            </Button>
          </div>
        ))}
      </div>
      <Button
        variant="secondary"
        className="rounded-xl"
        // Back to Draft from ModuleSwap is a different transition than the
        // ModuleDraft "Back to Shipyard" button below: this one keeps the
        // already drafted pool and the picked _newModule, just lands the
        // captain back on the picker so they can reconsider. cancelModuleDraft
        // would throw both away and bounce all the way to the Shipyard, so
        // this is the one place we still set the phase directly. There is no
        // engine helper for "back to draft but keep the choice" because that
        // state is already valid: phase = "module_draft" with _draftChoices
        // and _newModule intact is exactly what startModuleDrafting produces.
        onClick={() =>
          act((g, _l) => {
            g.phase = "module_draft";
          })
        }
      >
        ⬅️ Back to Draft
      </Button>
    </div>
  );
}
