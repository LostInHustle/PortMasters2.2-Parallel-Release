"use client";

import { cardName, cardText } from "@/lib/game/cards";
import { MODULES } from "@/lib/game/constants/drafts";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";

/**
 * Module interaction rules. Each rule names a set of module IDs and the
 * interaction they produce, and the analyzer checks whether every ID in a
 * rule is equipped. Adding an interaction is one entry here.
 *
 * These are the only hand written part of the analyzer, because an
 * interaction is exactly the thing neither module's own catalogue entry
 * can state: each is a claim about what two of them do together. The
 * names inside those claims are not hand written: they are asked of the
 * records through cardName, so a card renamed for its captain is renamed
 * here the same afternoon. Four labels had drifted before that was true,
 * calling the Tax Evasion Ledger, the Bulk Hauler Rigging and the
 * Maritime Bureau Token by shorter forms and the Ocean Interpreter by
 * the words of its own id.
 *
 * Every rule pairs hull cards. A boon cannot be a participant: the
 * equipped set this analyzer reads holds what is installed on the ship,
 * and a boon writes the round's flags instead, so the rule that paired
 * the Persian Dome Compass with the Deep Sea Escort Pact could never
 * fire and is gone. The pairing is real in play; this panel simply
 * cannot see the boon half of it.
 */
const MODULE_SYNERGY_RULES: {
  ids: string[];
  label: string;
  tone: "gain" | "intel" | "warn";
}[] = [
  {
    ids: ["smugglers_hold", "tax_evasion"],
    label: `Double Tax Strategy: ${cardName("smugglers_hold")} reduces purchase costs and ${cardName("tax_evasion")} halves both VAT and income tax. A powerful financial combo.`,
    tone: "gain",
  },
  {
    ids: ["bulk_hauler", "silk_monopoly"],
    label: `Freight Mastery: ${cardName("bulk_hauler")} reduces transport per item and ${cardName("silk_monopoly")} can zero it out on any order carrying woven goods. Shipping costs almost nothing.`,
    tone: "gain",
  },
  {
    ids: ["artisans_workshop", "salvage_crane"],
    label: `Production Engine: ${cardName("artisans_workshop")} boosts worker output and ${cardName("salvage_crane")} refunds the freight on some orders. More goods, more Gold back.`,
    tone: "gain",
  },
  {
    ids: ["brokers_network", "ocean_relay"],
    label: `Intel Network: ${cardName("brokers_network")} drops a rumor to 2 Gold and reveals two, and ${cardName("ocean_relay")} adds a third free. Maximum market intelligence.`,
    tone: "intel",
  },
  {
    ids: ["overdrive_engine", "bulk_hauler"],
    label: `Penalty Stack: ${cardName("overdrive_engine")} adds maintenance and ${cardName("bulk_hauler")} raises upgrade cost. Consider swapping one if funds are tight.`,
    tone: "warn",
  },
  {
    ids: ["kiln_cellar", "bureau_token"],
    label: `Charter Combo: ${cardName("kiln_cellar")} discounts every bulk good, and ${cardName("bureau_token")} adds 10% to the rewards on orders for the charter's own goods. Buy cheap, sell high.`,
    tone: "gain",
  },
  {
    ids: ["foreign_quarter_pass", "fleet_of_treasures"],
    label: `Exotic Trade: ${cardName("foreign_quarter_pass")} discounts every luxury good, and ${cardName("fleet_of_treasures")} takes three Gold a unit off freight on the same trade. Tier 2 goods at tier 0 prices.`,
    tone: "gain",
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
export function ModuleSynergyAnalyzer({
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
            {activeBonuses.map((card) => {
              const text = cardText(card);
              return (
                <span
                  key={card.id}
                  className="inline-flex items-center gap-1 rounded-full bg-gain/5 px-2 py-0.5 text-[10px] text-gain"
                >
                  {card.icon} {text.name}: {text.desc}
                </span>
              );
            })}
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
