"use client";

import { cardName, cardText } from "@/lib/game/cards";
import { MODULES } from "@/lib/game/constants/drafts";
import { t } from "@/lib/game/i18n";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { HuePanel } from "./PhaseShared";
import { PanelLabel } from "../../shared";

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
 * here the same afternoon. A hand written label drifts, calling the Tax
 * Evasion Ledger, the Bulk Hauler Rigging and the Maritime Bureau Token
 * by shorter forms and the Ocean Interpreter by the words of its own id.
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
  // The sentence this pair prints, in the pack's own spelling: the two
  // module names ride as tokens ({smugglersHoldName} and friends), so
  // the read can happen at the print rather than freezing at module
  // scope.
  label: string;
  // Fills the tokens the label names: the two records this rule pairs,
  // asked through the name reader the print site hands in, so a card
  // renamed for its captain is renamed here the same afternoon.
  params?: (name: (id: string) => string) => Record<string, string>;
  tone: "gain" | "intel" | "warn";
}[] = [
  {
    ids: ["smugglers_hold", "tax_evasion"],
    label:
      "Double Tax Strategy: {smugglersHoldName} reduces purchase costs and {taxEvasionName} halves both VAT and income tax. A powerful financial combo.",
    params: (name) => ({
      smugglersHoldName: name("smugglers_hold"),
      taxEvasionName: name("tax_evasion"),
    }),
    tone: "gain",
  },
  {
    ids: ["bulk_hauler", "silk_monopoly"],
    label:
      "Freight Mastery: {bulkHauler} reduces the Freight you pay per item and {silkMonopoly} can zero it out on any order carrying woven goods. Freight costs almost nothing.",
    params: (name) => ({
      bulkHauler: name("bulk_hauler"),
      silkMonopoly: name("silk_monopoly"),
    }),
    tone: "gain",
  },
  {
    ids: ["artisans_workshop", "salvage_crane"],
    label:
      "Production Engine: {artisansWorkshopName} boosts artisan output and {salvageCraneName} refunds the freight on some orders. More goods, more Gold back.",
    params: (name) => ({
      artisansWorkshopName: name("artisans_workshop"),
      salvageCraneName: name("salvage_crane"),
    }),
    tone: "gain",
  },
  {
    ids: ["brokers_network", "ocean_relay"],
    label:
      "Whisper Network: {brokersNetworkName} discounts every whisper, and {oceanRelayName} adds one more at no cost. Maximum market intelligence.",
    params: (name) => ({
      brokersNetworkName: name("brokers_network"),
      oceanRelayName: name("ocean_relay"),
    }),
    tone: "intel",
  },
  {
    ids: ["overdrive_engine", "bulk_hauler"],
    label:
      "Penalty Stack: {overdriveEngineName} adds maintenance and {bulkHaulerName} raises upgrade cost. Consider swapping one if Gold is tight.",
    params: (name) => ({
      overdriveEngineName: name("overdrive_engine"),
      bulkHaulerName: name("bulk_hauler"),
    }),
    tone: "warn",
  },
  {
    ids: ["kiln_cellar", "bureau_token"],
    label:
      "Charter Combo: {kilnCellarName} discounts every bulk good, and {bureauTokenName} pays more on orders for the charter's own goods. Buy cheap, sell high.",
    params: (name) => ({
      kilnCellarName: name("kiln_cellar"),
      bureauTokenName: name("bureau_token"),
    }),
    tone: "gain",
  },
  {
    ids: ["foreign_quarter_pass", "fleet_of_treasures"],
    label:
      "Exotic Trade: {foreignQuarterName} discounts every luxury good, and {fleetOfTreasuresName} takes Gold off freight on the same trade. Tier 2 goods at tier 0 prices.",
    params: (name) => ({
      foreignQuarterName: name("foreign_quarter_pass"),
      fleetOfTreasuresName: name("fleet_of_treasures"),
    }),
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
 * rather than a second copy of it. A copy kept here drifts: it wears
 * whatever icons and clauses it was written with, so the analysis could
 * show a captain a module's purchase discount with none of its income tax,
 * or a refund promise the catalogue does not make.
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
    <HuePanel tone="modules" className="p-3.5 mb-4">
      <PanelLabel tone="text-muted-foreground" className="mb-2">
        {t("Module Synergy Analysis")}
      </PanelLabel>
      {/* Active bonuses */}
      {activeBonuses.length > 0 && (
        <div className="mb-2">
          <div className="text-[9px] text-muted-foreground mb-1">
            {t("Active Bonuses")}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeBonuses.map((card) => {
              const text = cardText(card);
              return (
                <span
                  key={card.id}
                  className="inline-flex items-center gap-1 rounded-full bg-gain/5 px-2 py-0.5 text-[10px] text-gain"
                >
                  {card.icon} {text.name}
                  {t(": ")}
                  {text.desc}
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
            {t("Module Interactions")}
          </div>
          {synergies.map((s, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-[10px] leading-relaxed",
                SYNERGY_TONES[s.tone],
              )}
            >
              {/* The sentence reads here, at the print, with the two
                  names the rule pairs filled from the records. */}
              {t(s.label, s.params?.(cardName))}
            </div>
          ))}
        </div>
      )}
      {synergies.length === 0 && activeBonuses.length > 0 && (
        <div className="text-[10px] text-muted-foreground">
          {t("No special interactions detected between equipped modules.")}
        </div>
      )}
    </HuePanel>
  );
}
