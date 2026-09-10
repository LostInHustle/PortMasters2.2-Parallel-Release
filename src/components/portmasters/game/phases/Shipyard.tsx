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
  const canUpgrade = game.shipLevel < 3;
  const upgCost = canUpgrade
    ? game.shipUpgradeCost[game.shipLevel] + game.shipUpgradePenalty
    : 0;
  const affordable = game.money >= upgCost;
  const canDraft = game.shipLevel > 0;
  const slotsFull =
    game.equippedModules.length >= game.shipLevel && game.shipLevel > 0;
  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-2xl font-bold text-center mb-4 font-display pm-text-sea pm-brush">
        🚢 Shipyard &amp; Module Rigging
      </div>
      <div className="rounded-xl border-2 border-teal-500/20 bg-teal-500/[0.04] p-5 my-4">
        <div className="text-base font-bold text-teal-700 dark:text-teal-300">
          🚢 Ship Level: {game.shipLevel} | ⚓ Discount: {game.shipLevel * 5}{" "}
          Gold
        </div>
        <div className="text-sm text-teal-600 dark:text-teal-400 mt-1.5">
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
        <ModuleSynergyAnalyzer modules={game.equippedModules} game={game} />
      )}
      {phaseSync.waiting ? (
        <div className="text-center space-y-3">
          <div className="text-sm font-medium text-amber-700 dark:text-amber-300">
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
              className={cn(
                "rounded-xl",
                affordable && "pm-grad-primary text-white",
              )}
              disabled={!affordable}
              onClick={() => act((g, l) => upgradeShip(g, l))}
            >
              ⚓ Upgrade Ship (Lvl {game.shipLevel + 1}), Cost {upgCost} Gold |
              +1 Slot, +5 Discount
            </Button>
          )}
          <Button
            size="lg"
            variant={canDraft ? "default" : "secondary"}
            className={cn(
              "rounded-xl",
              canDraft && "pm-grad-gold text-amber-950",
            )}
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
            className="pm-grad-jade text-white rounded-xl"
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
  const canSwap = !game.moduleSwapUsed && picks.length > 0;
  return (
    <div className="max-w-4xl mx-auto text-center">
      <div className="text-2xl font-bold mb-1 font-display pm-text-gold pm-brush">
        🔧 Module Drafting
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Choose a module to install or swap.
      </p>
      {picks.length === 0 ? (
        <div className="text-center text-muted-foreground text-sm py-8">
          You&apos;ve already drafted your module choices for this voyage. New
          options arrive next voyage.
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
                ? "✅ Choices Swapped This Voyage"
                : "🎲 Swap Choices (1 use/voyage)"}
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
                className="pm-glass rounded-2xl p-5 flex flex-col items-center text-center border border-teal-500/20"
              >
                <div className="text-5xl mb-2">{m.icon}</div>
                <div className="font-semibold mb-2">
                  <Term term={m.name}>{m.name}</Term>
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed flex-1 mb-4">
                  {m.desc}
                </div>
                <Button
                  className="pm-grad-gold text-amber-950 font-semibold rounded-xl w-full"
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
      <div className="text-2xl font-bold mb-1 font-display pm-text-gold pm-brush">
        🔄 Select Module to Replace
      </div>
      {newMod && (
        <p className="text-sm text-muted-foreground mb-4">
          New: {newMod.icon} {newMod.name}: {newMod.desc}
        </p>
      )}
      <div className="rounded-xl border border-teal-500/15 bg-teal-500/[0.03] p-4 my-4 space-y-2 text-left">
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
 * Module Synergy Analyzer. Shows how equipped modules interact:
 * which bonuses are active, which modules complement each other, and
 * which carry penalties. Only renders when 2 or more modules are
 * equipped, since a single module has no synergy to analyze.
 */
/**
 * Data driven module synergy rules. Each rule maps a set of module IDs
 * to a synergy description and tone. The analyzer iterates over these
 * rules and checks whether all required IDs are present in the
 * equipped set. Adding a new synergy is a one line addition here.
 */
const MODULE_SYNERGY_RULES: {
  ids: string[];
  label: string;
  tone: "emerald" | "indigo" | "amber";
}[] = [
  {
    ids: ["smugglers_hold", "tax_evasion"],
    label:
      "Double Tax Strategy: Smuggler's Hold reduces purchase costs and Tax Evasion halves both VAT and income tax. A powerful financial combo.",
    tone: "emerald",
  },
  {
    ids: ["bulk_hauler", "silk_monopoly"],
    label:
      "Freight Mastery: Bulk Hauler reduces transport per item and Silk Road Monopoly can zero it out for Silk routes. Shipping costs almost nothing.",
    tone: "emerald",
  },
  {
    ids: ["artisans_workshop", "salvage_crane"],
    label:
      "Production Engine: Artisan's Workshop boosts worker output and Salvage Crane refunds on every order. More goods, more Gold back.",
    tone: "emerald",
  },
  {
    ids: ["brokers_network", "ocean_relay"],
    label:
      "Intel Network: Broker's Network halves rumor cost and Ocean Relay adds a free rumor per purchase. Maximum market intelligence.",
    tone: "indigo",
  },
  {
    ids: ["overdrive_engine", "bulk_hauler"],
    label:
      "Penalty Stack: Overdrive Engine adds maintenance and Bulk Hauler raises upgrade cost. Consider swapping one if funds are tight.",
    tone: "amber",
  },
  {
    ids: ["kiln_cellar", "bureau_token"],
    label:
      "Charter Combo: Kiln Cellar discounts Porcelain Clay and Copper Ore, and Bureau Token adds 10% to their order rewards. Buy cheap, sell high.",
    tone: "emerald",
  },
  {
    ids: ["foreign_quarter_pass", "fleet_of_treasures"],
    label:
      "Exotic Trade: Foreign Quarter Pass discounts Spices and Pearls, and Fleet of Treasures discounts their transport. Tier 2 goods at tier 0 prices.",
    tone: "emerald",
  },
  {
    ids: ["persian_dome_compass", "deep_sea_escort_pact"],
    label:
      "Safe Passage: Persian Dome Compass reduces pirate risk by 30% and the Deep Sea Escort Pact boon halves it further. Stack for near immunity.",
    tone: "indigo",
  },
];

/**
 * Data driven active bonus rules. Each rule maps a module ID to a
 * human readable bonus description. The analyzer checks whether each
 * module is equipped and lists its bonus.
 */
const MODULE_BONUS_RULES: { id: string; icon: string; text: string }[] = [
  { id: "smugglers_hold", icon: "📦", text: "Purchase costs down 15%" },
  { id: "tax_evasion", icon: "🧾", text: "VAT and income tax halved" },
  {
    id: "silk_monopoly",
    icon: "🧵",
    text: "Silk route transport zeroed, +20% reward",
  },
  {
    id: "brokers_network",
    icon: "🔮",
    text: "Rumors cost 2 Gold instead of 5",
  },
  { id: "salvage_crane", icon: "🏗️", text: "30% refund per completed order" },
  {
    id: "artisans_workshop",
    icon: "🔨",
    text: "Workers produce +1 item per task",
  },
  { id: "bulk_hauler", icon: "📦", text: "Transport cost down per item" },
  {
    id: "overdrive_engine",
    icon: "⚙️",
    text: "Transport flat discount 5 Gold",
  },
  { id: "bureau_token", icon: "🎫", text: "Charter goods orders +10%" },
  {
    id: "kiln_cellar",
    icon: "🏺",
    text: "Porcelain Clay and Copper Ore 2 Gold less",
  },
  { id: "ocean_relay", icon: "🌊", text: "One extra rumor per purchase" },
  {
    id: "foreign_quarter_pass",
    icon: "🪪",
    text: "Spices and Pearls 3 Gold less per unit",
  },
  { id: "persian_dome_compass", icon: "🧭", text: "Pirate risk down 30%" },
  {
    id: "fleet_of_treasures",
    icon: "⛵",
    text: "Tier 2 product transport discounted",
  },
];

function ModuleSynergyAnalyzer({
  modules,
  game,
}: {
  modules: GameState["equippedModules"];
  game: GameState;
}) {
  const ids = new Set(modules.map((m) => m.id));

  // Data driven synergy detection: check each rule against the equipped set
  const synergies = MODULE_SYNERGY_RULES.filter((rule) =>
    rule.ids.every((id) => ids.has(id)),
  );

  // Data driven active bonuses: list every equipped module's bonus
  const activeBonuses = MODULE_BONUS_RULES.filter((rule) => ids.has(rule.id));

  const toneClasses: Record<string, string> = {
    emerald:
      "border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-700 dark:text-emerald-300",
    indigo:
      "border-indigo-500/20 bg-indigo-500/[0.04] text-indigo-700 dark:text-indigo-300",
    amber:
      "border-amber-500/20 bg-amber-500/[0.04] text-amber-700 dark:text-amber-300",
  };

  return (
    <div className="rounded-xl border border-teal-500/15 bg-teal-500/[0.02] p-3.5 mb-4">
      <div className="text-[10px] font-semibold tracking-wide text-muted-foreground/80 mb-2">
        Module Synergy Analysis
      </div>
      {/* Active bonuses */}
      {activeBonuses.length > 0 && (
        <div className="mb-2">
          <div className="text-[9px] text-muted-foreground/60 mb-1">
            Active Bonuses
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeBonuses.map((b, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300"
              >
                {b.icon} {b.text}
              </span>
            ))}
          </div>
        </div>
      )}
      {/* Synergy combos */}
      {synergies.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[9px] text-muted-foreground/60">
            Module Interactions
          </div>
          {synergies.map((s, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-[10px] leading-relaxed",
                toneClasses[s.tone] ?? toneClasses.emerald,
              )}
            >
              {s.label}
            </div>
          ))}
        </div>
      )}
      {synergies.length === 0 && activeBonuses.length > 0 && (
        <div className="text-[10px] text-muted-foreground/50">
          No special interactions detected between equipped modules.
        </div>
      )}
    </div>
  );
}
