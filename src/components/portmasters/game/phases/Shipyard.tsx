"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cardText } from "@/lib/game/cards";
import {
  leavePhase,
  moduleDraftPossible,
  moduleSlotsOpen,
  startModuleDrafting,
  upgradeShip,
} from "@/lib/game/engine";
import { HELD_POWER_CAP } from "@/lib/game/constants/cards";
import {
  SHIP_DISCOUNT_PER_LEVEL,
  MAX_SHIP_LEVEL,
} from "@/lib/game/constants/ships";
import { heldPower } from "@/lib/game/held-cards";
import { cn } from "@/lib/utils";
import { Term } from "../../Term";
import { FoldRow } from "../FoldRow";
import { PanelNote } from "./PhasePanels";
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
  const [rigOpen, setRigOpen] = useState(false);
  const canUpgrade = game.shipLevel < MAX_SHIP_LEVEL;
  const upgCost = canUpgrade
    ? game.shipUpgradeCost[game.shipLevel] + game.shipUpgradePenalty
    : 0;
  const affordable = game.money >= upgCost;
  // [F7: the power budget] The draft's door reads the roll's own
  // predicate, so a hull the cap has shut is told before the click rather
  // than dealt an empty table: the button disables and the line below it
  // says which of the two reasons it is, the same way every other
  // disabled control on this panel is explained beside itself.
  const draftDealable = moduleDraftPossible(game);
  const canDraft = game.shipLevel > 0 && draftDealable;
  // The level guard rides along because a hull below its first upgrade has
  // no slots to fill rather than full ones, and the label below says
  // "Slots Full" only about a hull that has some. The open count itself is
  // moduleSlotsOpen's answer, floored, so the label agrees with the draft
  // screen for a hull a trade pushed one over its slots (see ./engine/core).
  const slotsFull = canDraft && moduleSlotsOpen(game) === 0;
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
        {/* [F7: the power budget] The hull's weight on one line, beside
            the slots it fills: the number every gate in the cap speaks
            in, read where the hull's composition is already the subject,
            so a refused pick at the table has something to point at. */}
        <div className="text-sm text-dusk mt-1.5">
          ⚡ Hull Power: {heldPower(game)} / {HELD_POWER_CAP}
        </div>
        {game.equippedModules.length === 0 && (
          <PanelNote className="mt-2 text-xs">
            No modules installed. Upgrade ship to unlock slots!
          </PanelNote>
        )}
      </div>
      {/* The fit folds (W4): the gist names what is aboard and what it
          weighs, and the full descriptions and the synergy analyzer wait
          behind the one chevron, the same fold the market's readings wear
          (see FoldRow). Printing every module's description inline under
          the hull's figures is a wall of small print on a screen whose
          decision is two buttons. */}
      {game.equippedModules.length > 0 && (
        <FoldRow
          tone="dusk"
          icon="🔌"
          title="Modules Aboard"
          gist={`${game.equippedModules.length} installed, power ${heldPower(game)} of ${HELD_POWER_CAP}.`}
          open={rigOpen}
          onToggle={() => setRigOpen((v) => !v)}
          className="mb-3.5"
        >
          <div className="space-y-1">
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
          {/* Module Synergy Analyzer */}
          {game.equippedModules.length >= 2 && (
            <div className="mt-2">
              <ModuleSynergyAnalyzer modules={game.equippedModules} />
            </div>
          )}
        </FoldRow>
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
          {game.shipLevel > 0 && !draftDealable && (
            <PanelNote className="text-center text-[11px]">
              Every module the yard could deal would pass this hull&apos;s{" "}
              {HELD_POWER_CAP} power. Selling one at the Parley table makes
              room.
            </PanelNote>
          )}
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
