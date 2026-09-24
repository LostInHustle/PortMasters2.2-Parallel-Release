"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  cancelModuleDraft,
  finalizeModuleSwap,
  handleModuleSelect,
  skipUpgrade,
  startModuleDrafting,
  swapModuleChoices,
  upgradeShip,
} from "@/lib/game/engine";
import {
  MAX_SHIP_LEVEL,
  MODULES,
  SHIP_DISCOUNT_PER_LEVEL,
} from "@/lib/game/constants";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { Term } from "../../Term";
import { ReadyBar } from "../ReadyBar";
import type { PhasePanelProps } from "./PhaseShared";

export function Shipyard({
  game,
  act,
  phaseSync,
  members,
}: Pick<PhasePanelProps, "game" | "act" | "phaseSync" | "members">) {
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
      <div className="text-2xl font-bold text-center mb-4 font-display text-shipyard pm-brush">
        🚢 Shipyard &amp; Module Rigging
      </div>
      <div className="rounded-xl border-2 border-shipyard/20 bg-shipyard/[0.04] p-5 my-4">
        <div className="text-base font-bold text-shipyard">
          🚢 Ship Level: {game.shipLevel} | ⚓ Discount:{" "}
          {game.shipLevel * SHIP_DISCOUNT_PER_LEVEL} Gold
        </div>
        <div className="text-sm text-shipyard mt-1.5">
          🔌 Module Slots: {game.equippedModules.length} / {game.shipLevel}
        </div>
        {game.equippedModules.length ? (
          <div className="mt-3 space-y-1">
            {game.equippedModules.map((m) => (
              <div key={m.id} className="text-xs">
                {m.icon}{" "}
                <strong>
                  <Term term={m.name}>{m.name}</Term>
                </strong>
                : {m.desc}
              </div>
            ))}
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
        <div className="text-center space-y-3">
          <div className="text-sm font-medium text-warn">
            ⏳ Waiting for the rest of the crew…
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
            ↩️ Not ready yet
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {canUpgrade && (
            <Button
              size="lg"
              variant={affordable ? "default" : "secondary"}
              className={cn("rounded-xl", affordable && "pm-grad-shipyard")}
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
            onClick={() => phaseSync.markReady((g, l) => skipUpgrade(g, l))}
          >
            ⏭️ Continue Voyage
          </Button>
        </div>
      )}
    </div>
  );
}

export function ModuleDraft({
  game,
  act,
}: Pick<PhasePanelProps, "game" | "act">) {
  const picks = game._draftChoices ?? [];
  const canSwap = !game.moduleSwapUsed;
  return (
    <div className="max-w-4xl mx-auto text-center">
      <div className="text-2xl font-bold mb-1 font-display text-module-draft pm-brush">
        🔧 Module Drafting
      </div>
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
          <div className="flex justify-center mb-4">
            <Button
              size="sm"
              variant="secondary"
              className="rounded-lg"
              disabled={!canSwap}
              onClick={() => act((g, l) => swapModuleChoices(g, l))}
            >
              {game.moduleSwapUsed
                ? "✅ Choices Swapped This Round"
                : "🎲 Swap Choices (1 use/round)"}
            </Button>
          </div>
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.06 } },
            }}
          >
            {picks.map((m, i) => (
              <motion.div
                key={m.id}
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.22, ease: "easeOut" },
                  },
                }}
                whileHover={{ y: -6 }}
                className="pm-glass rounded-2xl p-5 flex flex-col items-center text-center border border-module-draft/20"
              >
                <div className="text-5xl mb-2">{m.icon}</div>
                <div className="font-semibold mb-2">
                  <Term term={m.name}>{m.name}</Term>
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed flex-1 mb-4">
                  {m.desc}
                </div>
                <Button
                  className="pm-grad-module-draft font-semibold rounded-xl w-full"
                  onClick={() => act((g, l) => handleModuleSelect(g, i, l))}
                >
                  {game.equippedModules.length < game.shipLevel
                    ? "✅ Install"
                    : "🔄 Swap"}
                </Button>
              </motion.div>
            ))}
          </motion.div>
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

export function ModuleSwap({
  game,
  act,
}: Pick<PhasePanelProps, "game" | "act">) {
  const newMod = game._newModule;
  return (
    <div className="max-w-2xl mx-auto text-center">
      <div className="text-2xl font-bold mb-1 font-display text-module-swap pm-brush">
        🔄 Select Module to Replace
      </div>
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

/**
 * Module interaction rules. Each rule names a set of module IDs and the
 * interaction they produce, and the analyzer checks whether every ID in a
 * rule is equipped. Adding an interaction is one entry here.
 *
 * These are the only hand written part of the analyzer, because an
 * interaction is exactly the thing neither module's own catalogue entry
 * can state: each is a claim about what two of them do together.
 */
const MODULE_SYNERGY_RULES: {
  ids: string[];
  label: string;
  tone: "gain" | "intel" | "warn";
}[] = [
  {
    ids: ["smugglers_hold", "tax_evasion"],
    label:
      "Double Tax Strategy: Smuggler's Hold reduces purchase costs and Tax Evasion halves both VAT and income tax. A powerful financial combo.",
    tone: "gain",
  },
  {
    ids: ["bulk_hauler", "silk_monopoly"],
    label:
      "Freight Mastery: Bulk Hauler reduces transport per item and Silk Road Monopoly can zero it out for Silk routes. Shipping costs almost nothing.",
    tone: "gain",
  },
  {
    ids: ["artisans_workshop", "salvage_crane"],
    label:
      "Production Engine: Artisan's Workshop boosts worker output and Salvage Crane refunds the freight on most orders. More goods, more Gold back.",
    tone: "gain",
  },
  {
    ids: ["brokers_network", "ocean_relay"],
    label:
      "Intel Network: Broker's Network drops a rumor to 2 Gold and reveals two, and Ocean Relay adds a third free. Maximum market intelligence.",
    tone: "intel",
  },
  {
    ids: ["overdrive_engine", "bulk_hauler"],
    label:
      "Penalty Stack: Overdrive Engine adds maintenance and Bulk Hauler raises upgrade cost. Consider swapping one if funds are tight.",
    tone: "warn",
  },
  {
    ids: ["kiln_cellar", "bureau_token"],
    label:
      "Charter Combo: Kiln Cellar discounts Porcelain Clay and Copper Ore, and Bureau Token adds 10% to their order rewards. Buy cheap, sell high.",
    tone: "gain",
  },
  {
    ids: ["foreign_quarter_pass", "fleet_of_treasures"],
    label:
      "Exotic Trade: Foreign Quarter Pass discounts Spices and Pearls, and Fleet of Treasures discounts freight on Foreign Balm and Pearl String. Tier 2 goods at tier 0 prices.",
    tone: "gain",
  },
  {
    ids: ["persian_dome_compass", "deep_sea_escort_pact"],
    label:
      "Safe Passage: Persian Dome Compass reduces pirate risk by 30% and the Deep Sea Escort Pact boon halves it further. Stack for near immunity.",
    tone: "intel",
  },
];

// One wash per tone, read by name. Module level rather than rebuilt on
// every render, since nothing about it depends on the game.
const SYNERGY_TONES: Record<"gain" | "intel" | "warn", string> = {
  gain: "border-gain/20 bg-gain/[0.04] text-gain",
  intel: "border-intel/20 bg-intel/[0.04] text-intel",
  warn: "border-warn/20 bg-warn/[0.04] text-warn",
};

/**
 * Module Synergy Analyzer. Shows how equipped modules interact: which
 * bonuses are active, which modules complement each other, and which
 * carry penalties. Only rendered with two or more equipped, since a
 * single module has no interaction to analyze.
 *
 * The active bonus list reads each equipped module's own catalogue entry
 * rather than a second copy of it. The copy that used to live here had
 * drifted badly: ten of the fourteen modules wore the wrong icon, and
 * every penalty clause had been left off, so the analysis showed a
 * captain the Smuggler's Hold's purchase discount with none of its income
 * tax and a Salvage Crane that "refunds 30% per completed order" when it
 * is a 30% chance of refunding the freight alone.
 */
function ModuleSynergyAnalyzer({
  modules,
}: {
  modules: GameState["equippedModules"];
}) {
  const ids = new Set(modules.map((m) => m.id));

  // Data driven synergy detection: check each rule against the equipped set
  const synergies = MODULE_SYNERGY_RULES.filter((rule) =>
    rule.ids.every((id) => ids.has(id)),
  );

  // Every equipped module, in catalogue order.
  const activeBonuses = MODULES.filter((m) => ids.has(m.id));

  return (
    <div className="rounded-xl border border-modules/15 bg-modules/[0.02] p-3.5 mb-4">
      <div className="text-[10px] font-semibold tracking-wide text-muted-foreground mb-2">
        Module Synergy Analysis
      </div>
      {/* Active bonuses */}
      {activeBonuses.length > 0 && (
        <div className="mb-2">
          <div className="text-[9px] text-muted-foreground mb-1">
            Active Bonuses
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeBonuses.map((b, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-gain/5 px-2 py-0.5 text-[10px] text-gain"
              >
                {b.icon} {b.name}: {b.desc}
              </span>
            ))}
          </div>
        </div>
      )}
      {/* Synergy combos */}
      {synergies.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[9px] text-muted-foreground">
            Module Interactions
          </div>
          {synergies.map((s, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-[10px] leading-relaxed",
                SYNERGY_TONES[s.tone],
              )}
            >
              {s.label}
            </div>
          ))}
        </div>
      )}
      {synergies.length === 0 && activeBonuses.length > 0 && (
        <div className="text-[10px] text-muted-foreground">
          No special interactions detected between equipped modules.
        </div>
      )}
    </div>
  );
}
