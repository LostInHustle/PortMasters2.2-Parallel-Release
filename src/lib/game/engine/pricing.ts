// =====================================================================
// Every "what does this cost" question the game asks: freight, VAT,
// income tax, the price of a market card, the wage of an artisan, and the
// Broker's cut on a favor.
//
// Everything here is a pure function of state plus its arguments. Nothing
// in this file writes to GameState, pushes a log line, or draws from the
// RNG, which is what makes it the safest part of the engine to reason
// about and the natural first real subsystem to stand on its own.
//
// The explain* functions are deliberate duplicates of their calc*
// counterparts rather than the calc* functions delegating to them. That
// keeps the balance critical math, ported verbatim from the original
// single player build, from ever having to change shape to accommodate a
// tooltip. The cost of that choice is that a balance change has to be made
// in two places; the benefit is that a tooltip bug can never become a
// pricing bug.
// =====================================================================
import {
  BOONS,
  COMMODITIES,
  PRODUCT_PRICES,
  RECIPES,
  RESOURCES,
  WAGES,
} from "../constants";
import type { GameState, ResourceCard } from "../types";
import { brokersFavorPayoutCap } from "./ages";
import { hasModule } from "./core";

type PriceStep = { label: string; delta: number };
export type PriceBreakdown = {
  base: number;
  steps: PriceStep[];
  final: number;
};

export type ExpectedPrice = {
  min: number;
  max: number;
  isProduct: boolean;
  modifiers: string[];
};

// At most one boon's modifiers are ever active at a time (selecting a new
// one replaces state.modifierFlags wholesale, see applyBoon), so finding
// whichever boon owns a given modifier key reliably names the source of a
// price adjustment for the breakdowns below.
function boonNameForModifierKey(key: string): string {
  return BOONS.find((b) => key in b.modifiers)?.name ?? "Active boon";
}

// ========== Transport ==========
export function calcTransportCost(
  state: GameState,
  totalItems: number,
  hasSilk = false,
): number {
  let base = totalItems * 2;
  let discount = state.shipLevel * 5;
  if (state.modifierFlags.transport_flat_discount)
    discount += state.modifierFlags.transport_flat_discount;
  let cost = Math.max(5, base - discount);
  if (hasSilk && state.modifierFlags.transport_silk_discount)
    cost = Math.max(
      5,
      Math.floor(cost * state.modifierFlags.transport_silk_discount),
    );
  if (hasModule(state, "bulk_hauler")) cost = Math.max(0, cost - totalItems);
  if (hasModule(state, "overdrive_engine")) cost = Math.max(0, cost - 5);
  if (hasModule(state, "silk_monopoly") && hasSilk) cost = 0;
  return Math.max(0, cost);
}

// A separate, display only mirror of calcTransportCost above. Kept as its
// own function rather than having calcTransportCost delegate to it, so the
// balance critical "preserved verbatim" math above never has to change to
// accommodate a tooltip.
export function explainTransportCost(
  state: GameState,
  totalItems: number,
  hasSilk = false,
): PriceBreakdown {
  const steps: PriceStep[] = [];
  const base = totalItems * 2;
  let cost = base;

  const shipDiscount = state.shipLevel * 5;
  if (shipDiscount > 0) {
    const next = Math.max(5, cost - shipDiscount);
    steps.push({
      label: `Ship Level ${state.shipLevel} discount`,
      delta: next - cost,
    });
    cost = next;
  }
  if (state.modifierFlags.transport_flat_discount) {
    const next = Math.max(
      5,
      cost - state.modifierFlags.transport_flat_discount,
    );
    steps.push({
      label: `${boonNameForModifierKey("transport_flat_discount")} (down ${state.modifierFlags.transport_flat_discount}g)`,
      delta: next - cost,
    });
    cost = next;
  }
  if (hasSilk && state.modifierFlags.transport_silk_discount) {
    const next = Math.max(
      5,
      Math.floor(cost * state.modifierFlags.transport_silk_discount),
    );
    steps.push({
      label: `${boonNameForModifierKey("transport_silk_discount")} on Silk goods`,
      delta: next - cost,
    });
    cost = next;
  }
  if (hasModule(state, "bulk_hauler")) {
    const next = Math.max(0, cost - totalItems);
    steps.push({ label: "Bulk Hauler Rigging module", delta: next - cost });
    cost = next;
  }
  if (hasModule(state, "overdrive_engine")) {
    const next = Math.max(0, cost - 5);
    steps.push({ label: "Overdrive Engine module", delta: next - cost });
    cost = next;
  }
  if (hasModule(state, "silk_monopoly") && hasSilk) {
    steps.push({
      label: "Silk Road Monopoly module (Silk freight waived)",
      delta: -cost,
    });
    cost = 0;
  }
  return { base, steps, final: Math.max(0, cost) };
}

// ========== Taxes ==========
export function calcVAT(
  state: GameState,
  product: string,
  sellingPrice: number,
): number {
  const recipe = RECIPES[product];
  let matCost = 0;
  for (const [m, a] of Object.entries(recipe.materials)) {
    matCost +=
      ((COMMODITIES[m].basePrice[0] + COMMODITIES[m].basePrice[1]) / 2) * a;
  }
  const workerCost = WAGES[recipe.worker_type];
  const taxable = sellingPrice - matCost - workerCost;
  if (taxable > 0) {
    let vat = Math.floor(taxable * 0.05);
    if (state.modifierFlags.vat_discount)
      vat = Math.floor(vat * (1 - state.modifierFlags.vat_discount));
    if (hasModule(state, "tax_evasion")) vat = Math.floor(vat * 0.5);
    return vat;
  }
  return 0;
}

// Display only mirror of calcVAT above, same reasoning as
// explainTransportCost: the tooltip gets its own copy of the math instead
// of touching the function the actual sale relies on.
export function explainVAT(
  state: GameState,
  product: string,
  sellingPrice: number,
): PriceBreakdown {
  const recipe = RECIPES[product];
  let matCost = 0;
  for (const [m, a] of Object.entries(recipe.materials)) {
    matCost +=
      ((COMMODITIES[m].basePrice[0] + COMMODITIES[m].basePrice[1]) / 2) * a;
  }
  const workerCost = WAGES[recipe.worker_type];
  const taxable = sellingPrice - matCost - workerCost;
  const steps: PriceStep[] = [
    { label: "Average material cost", delta: -matCost },
    {
      label: `${recipe.worker_type === "weaver" ? "Weaver" : recipe.worker_type === "master" ? "Master Weaver" : "Sachet Maker"} wage`,
      delta: -workerCost,
    },
  ];
  if (taxable <= 0) return { base: sellingPrice, steps, final: 0 };
  let vat = Math.floor(taxable * 0.05);
  steps.push({ label: "5% VAT on the margin", delta: -vat });
  if (state.modifierFlags.vat_discount) {
    const next = Math.floor(vat * (1 - state.modifierFlags.vat_discount));
    steps.push({
      label: `${boonNameForModifierKey("vat_discount")} (down ${Math.round(state.modifierFlags.vat_discount * 100)}%)`,
      delta: next - vat,
    });
    vat = next;
  }
  if (hasModule(state, "tax_evasion")) {
    const next = Math.floor(vat * 0.5);
    steps.push({
      label: "Tax Evasion Ledger module (down 50%)",
      delta: next - vat,
    });
    vat = next;
  }
  return { base: sellingPrice, steps, final: vat };
}

export function calcIncomeTax(state: GameState, preTax: number): number {
  if (preTax <= 0) return 0;
  const rate = state.modifierFlags.income_tax_override || 0.1;
  let tax = Math.floor(preTax * rate);
  if (hasModule(state, "smugglers_hold")) tax = Math.floor(tax * 1.2);
  if (hasModule(state, "tax_evasion")) tax = Math.floor(tax * 0.5);
  return tax;
}

// ========== Market card pricing ==========
// The two per unit charter module discounts: which goods each one covers,
// and how many Gold it takes off each unit. Named here because two places
// apply them, the card charge below and the hover preview in
// explainExpectedPrice, and keeping the goods and the amounts in one place
// is what stops the two from drifting apart again. They had: the preview
// applied neither, so a captain holding the Kiln Cellar saw a Porcelain
// Clay price two Gold a unit above what the card went on to charge.
const KILN_CELLAR_GOODS = ["Porcelain Clay", "Copper Ore"];
const KILN_CELLAR_PER_UNIT = 2;
const FOREIGN_QUARTER_GOODS = ["Spices", "Pearls"];
const FOREIGN_QUARTER_PER_UNIT = 3;

// The same math as getCardFinalCost, but reported as a step by step
// breakdown so the buying phase tooltip can show exactly where a price
// came from: base cost, then whatever boon or module touched it.
export function explainCardPrice(
  state: GameState,
  card: ResourceCard,
): PriceBreakdown {
  const steps: PriceStep[] = [];
  let cost = card.totalCost;

  if (state.modifierFlags.purchase_discount) {
    const next = Math.floor(cost * (1 - state.modifierFlags.purchase_discount));
    steps.push({
      label: `${boonNameForModifierKey("purchase_discount")} (down ${Math.round(state.modifierFlags.purchase_discount * 100)}%)`,
      delta: next - cost,
    });
    cost = next;
  }
  if (state.modifierFlags.hemp_price_reduction) {
    const hempReduction = state.modifierFlags.hemp_price_reduction;
    const reduction = card.resources.reduce(
      (sum, r) => (r.type === "Hemp" ? sum + r.quantity! * hempReduction : sum),
      0,
    );
    if (reduction > 0) {
      steps.push({
        label: `${boonNameForModifierKey("hemp_price_reduction")} (down ${hempReduction}g per Hemp)`,
        delta: -reduction,
      });
      cost -= reduction;
    }
  }
  if (hasModule(state, "kiln_cellar")) {
    const reduction = card.resources.reduce(
      (sum, r) =>
        KILN_CELLAR_GOODS.includes(r.type)
          ? sum + (r.quantity ?? 0) * KILN_CELLAR_PER_UNIT
          : sum,
      0,
    );
    if (reduction > 0) {
      steps.push({
        label: `Kiln Cellar module (down ${KILN_CELLAR_PER_UNIT}g per unit)`,
        delta: -reduction,
      });
      cost -= reduction;
    }
  }
  if (hasModule(state, "foreign_quarter_pass")) {
    const reduction = card.resources.reduce(
      (sum, r) =>
        FOREIGN_QUARTER_GOODS.includes(r.type)
          ? sum + (r.quantity ?? 0) * FOREIGN_QUARTER_PER_UNIT
          : sum,
      0,
    );
    if (reduction > 0) {
      steps.push({
        label: `Foreign Quarter Pass module (down ${FOREIGN_QUARTER_PER_UNIT}g per unit)`,
        delta: -reduction,
      });
      cost -= reduction;
    }
  }
  if (hasModule(state, "smugglers_hold")) {
    const next = Math.floor(cost * 0.85);
    steps.push({
      label: "Smuggler's Hold module (down 15%)",
      delta: next - cost,
    });
    cost = next;
  }

  const final = Math.max(0, cost);
  if (final !== cost)
    steps.push({ label: "Floor at 0 Gold", delta: final - cost });
  return { base: card.totalCost, steps, final };
}

export function getCardFinalCost(state: GameState, card: ResourceCard): number {
  return explainCardPrice(state, card).final;
}

// A general "what does this typically cost" estimate for a raw material
// or product, independent of any specific market card. Used for the
// hover preview during the buying phase (Phase 1) so a captain can size
// up the whole market, including goods that didn't happen to roll onto
// one of this round's market cards. Ports nudge a raw
// material's roll by
// 1 Gold up or down depending on whether the port specializes in it
// (see genResourceCard), which is why the range carries a margin note
// instead of trying to fold that into the numbers themselves.
export function explainExpectedPrice(
  state: GameState,
  itemType: string,
): ExpectedPrice {
  const isResource = (RESOURCES as readonly string[]).includes(itemType);
  let [min, max] = isResource
    ? COMMODITIES[itemType].basePrice
    : PRODUCT_PRICES[itemType];
  const modifiers: string[] = [];

  if (isResource) {
    if (state.modifierFlags.purchase_discount) {
      const factor = 1 - state.modifierFlags.purchase_discount;
      min = Math.floor(min * factor);
      max = Math.floor(max * factor);
      modifiers.push(
        `${boonNameForModifierKey("purchase_discount")} (down ${Math.round(state.modifierFlags.purchase_discount * 100)}%)`,
      );
    }
    if (itemType === "Hemp" && state.modifierFlags.hemp_price_reduction) {
      min = Math.max(0, min - state.modifierFlags.hemp_price_reduction);
      max = Math.max(0, max - state.modifierFlags.hemp_price_reduction);
      modifiers.push(
        `${boonNameForModifierKey("hemp_price_reduction")} (down ${state.modifierFlags.hemp_price_reduction}g per unit)`,
      );
    }
    // The two per unit charter module discounts. Flat Gold off a single
    // unit, so they come off the range the same way the Hemp boon above
    // does rather than scaling it. Applied in the order the card charge
    // applies them (see explainCardPrice), since a percentage taken before
    // a flat subtraction and one taken after settle on different numbers.
    if (
      hasModule(state, "kiln_cellar") &&
      KILN_CELLAR_GOODS.includes(itemType)
    ) {
      min = Math.max(0, min - KILN_CELLAR_PER_UNIT);
      max = Math.max(0, max - KILN_CELLAR_PER_UNIT);
      modifiers.push(
        `Kiln Cellar module (down ${KILN_CELLAR_PER_UNIT}g per unit)`,
      );
    }
    if (
      hasModule(state, "foreign_quarter_pass") &&
      FOREIGN_QUARTER_GOODS.includes(itemType)
    ) {
      min = Math.max(0, min - FOREIGN_QUARTER_PER_UNIT);
      max = Math.max(0, max - FOREIGN_QUARTER_PER_UNIT);
      modifiers.push(
        `Foreign Quarter Pass module (down ${FOREIGN_QUARTER_PER_UNIT}g per unit)`,
      );
    }
    if (hasModule(state, "smugglers_hold")) {
      min = Math.floor(min * 0.85);
      max = Math.floor(max * 0.85);
      modifiers.push("Smuggler's Hold module (down 15%)");
    }
  }

  return { min, max, isProduct: !isResource, modifiers };
}

// ========== Wages ==========
// The canonical per worker, per round wage for a given type, given every
// currently active modifier. There is no separate one time "hiring fee"
// in this game (see hireWorker, which never touches state.money);
// the number this returns is what Phase 3 actually charges for that
// worker, so every place that shows or charges a wage, this function,
// payWages, and the Pending Payroll preview in WorkerMgmt (GamePhasePanel.tsx),
// must all read from here rather than re deriving the formula themselves.
// Root cause of the Master's Apprentice bug: payWages and that preview
// used to hardcode WAGES[type] with only the Artisan's Workshop
// surcharge, so hire_discount silently never reduced the actual wage
// payment even though the hiring screen's own price looked discounted.
export function getHireCost(state: GameState, type: string): number {
  let wage = WAGES[type];
  if (state.modifierFlags.hire_discount)
    wage = Math.floor(wage * (1 - state.modifierFlags.hire_discount));
  if (hasModule(state, "artisans_workshop")) wage = Math.floor(wage * 1.2);
  // Golden Lotus's pledge takes a fifth off every wage. Applied last, so it
  // discounts the wage actually due rather than the list price, and read
  // here so hiring, payroll, severance and every interface preview quote
  // the same figure (see payWages, fireWorker, and the Pending Payroll
  // preview in GamePhasePanel).
  if (state.housePerks.goldenWageDiscount) wage = Math.floor(wage * 0.8);
  return wage;
}

// ========== Broker intel ==========
// The Gold a captain pays for one Broker's rumor in Phase 1. Used to live
// directly on GameState as `intelCost`, set to 5 by createInitialGameState
// and toggled to 2 by the Broker's Network module's equip/unequip hooks in
// ./boons.ts. Derived here now instead, so the cost can never drift out of
// sync with whether the module is actually equipped: the field is gone from
// the state, and the answer is read straight off hasModule, the same way
// the rest of this file derives a price from any other module flag.
//
// Callers (purchaseIntel in ./orders.ts and the Broker UI in GamePhasePanel)
// should call this rather than reading state.intelCost, which no longer
// exists. Reading it once per purchase keeps the Brokers Network module's
// discount live the instant it is equipped, with no separate state write
// needed to keep the field current.
export function getIntelCost(state: GameState): number {
  return hasModule(state, "brokers_network") ? 2 : 5;
}

// ========== Broker's Favor ==========
// The Broker's cut on a Broker's Favor order, a saturating curve rather
// than a flat rate. Net payout climbs almost one for one with reward at
// first (a small order keeps the feel of a low flat rate) but bends hard as
// reward grows, approaching the cap in force without ever reaching it. That
// gives callBrokersFavor a hard ceiling on what a single favor can pay out
// regardless of how large a quantity a captain asks for, instead of needing
// to cap the quantity itself. The cap is the Age's, not a fixed constant:
// see brokersFavorPayoutCap.
export function brokersFavorCommission(reward: number): number {
  // The cap comes from the Age in force, not straight off the constant, so
  // the Broker's Age genuinely lets one favor pay out more than usual (see
  // brokersFavorPayoutCap). Reading it here rather than at the call sites
  // keeps the Orders panel, the action suggester's net figure and the
  // payout itself all quoting the same number.
  const cap = brokersFavorPayoutCap();
  const net = cap * (1 - Math.exp(-reward / cap));
  return Math.max(0, reward - Math.floor(net));
}
