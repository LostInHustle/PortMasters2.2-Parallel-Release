"use client";

import { Button } from "@/components/ui/button";
import { cardText } from "@/lib/game/cards";
import {
  leavePhase,
  startModuleDrafting,
  upgradeShip,
} from "@/lib/game/engine";
import {
  SHIP_DISCOUNT_PER_LEVEL,
  MAX_SHIP_LEVEL,
} from "@/lib/game/constants/ships";
import { cn } from "@/lib/utils";
import { Term } from "../../Term";
import {
  PhaseClockBar,
  PhaseHeading,
  PhaseWaiting,
  type PhasePanelProps,
} from "./PhaseShared";
import { ModuleSynergyAnalyzer } from "./ModuleSynergy";

// The draft and the swap are the same two screens whether they are reached
// from the shipyard's own button or drawn by the phase dispatcher, so they
// live beside it and are exported from here, which is where the dispatcher
// has always imported them from.
export { ModuleDraft } from "./ModuleDraft";
export { ModuleSwap } from "./ModuleSwap";

export function Shipyard({
  game,
  ctx,
  act,
  phaseSync,
  members,
}: Pick<PhasePanelProps, "game" | "ctx" | "act" | "phaseSync" | "members">) {
  const canUpgrade = game.shipLevel < MAX_SHIP_LEVEL;
  const upgCost = canUpgrade
    ? game.shipUpgradeCost[game.shipLevel] + game.shipUpgradePenalty
    : 0;
  const affordable = game.money >= upgCost;
  const canDraft = game.shipLevel > 0;
  const slotsFull =
    game.equippedModules.length >= game.shipLevel && game.shipLevel > 0;
  return (
    <div className="max-w-2xl mx-auto">
      <PhaseHeading layout="text-center mb-4" tone="text-dusk" brush>
        🚢 Shipyard &amp; Module Rigging
      </PhaseHeading>
      <div className="rounded-xl border-2 border-dusk/20 bg-dusk/[0.04] p-5 my-4">
        <div className="text-base font-bold text-dusk">
          🚢 Ship Level: {game.shipLevel} | ⚓ Discount:{" "}
          {game.shipLevel * SHIP_DISCOUNT_PER_LEVEL} Gold
        </div>
        <div className="text-sm text-dusk mt-1.5">
          🔌 Module Slots: {game.equippedModules.length} / {game.shipLevel}
        </div>
        {game.equippedModules.length ? (
          <div className="mt-3 space-y-1">
            {game.equippedModules.map((card) => {
              const text = cardText(card);
              return (
                <div key={card.id} className="text-xs">
                  {card.icon}{" "}
                  <strong>
                    <Term term={text.name}>{text.name}</Term>
                  </strong>
                  : {text.desc}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground mt-2">
            No modules installed. Upgrade ship to unlock slots!
          </div>
        )}
      </div>
      {/* Module Synergy Analyzer */}
      {game.equippedModules.length >= 2 && (
        <ModuleSynergyAnalyzer modules={game.equippedModules} />
      )}
      {phaseSync.waiting ? (
        <PhaseWaiting
          phaseSync={phaseSync}
          members={members}
          title="⏳ Waiting for the rest of the crew…"
          cancelLabel="↩️ Not ready yet"
        />
      ) : (
        <div className="flex flex-col gap-2">
          {/* [B2: hard timers, the server as timekeeper] The clock on the
              screen a captain has not acted on, drawn from the same
              published pair the waiting bar above draws. Dusk is a seat of
              the leg like the others, so a captain deciding what to build
              is owed the same countdown as one deciding what to buy. */}
          <PhaseClockBar phaseSync={phaseSync} members={members} />
          {canUpgrade && (
            <Button
              size="lg"
              variant={affordable ? "default" : "secondary"}
              className={cn("rounded-xl", affordable && "pm-grad-dusk")}
              disabled={!affordable}
              onClick={() => act((g, l) => upgradeShip(g, l))}
            >
              ⚓ Upgrade Ship (Lvl {game.shipLevel + 1}), Cost {upgCost} Gold |
              +1 Slot, +{SHIP_DISCOUNT_PER_LEVEL} Discount
            </Button>
          )}
          <Button
            size="lg"
            variant={canDraft ? "default" : "secondary"}
            className={cn("rounded-xl", canDraft && "pm-grad-module-draft")}
            disabled={!canDraft}
            onClick={() =>
              act((g) => {
                startModuleDrafting(g);
              })
            }
          >
            {slotsFull
              ? "🔄 Draft & Swap Module (Slots Full)"
              : "🔧 Draft & Install Module"}
          </Button>
          <Button
            size="lg"
            className="pm-grad-voyage rounded-xl"
            onClick={() => phaseSync.markReady((g, l) => leavePhase(g, ctx, l))}
          >
            ⏭️ Continue Voyage
          </Button>
        </div>
      )}
    </div>
  );
}
