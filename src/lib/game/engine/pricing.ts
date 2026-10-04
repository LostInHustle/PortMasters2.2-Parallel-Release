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
//
// The card price is the one exception, and the header would be lying if it
// did not say so: explainCardPrice is the real thing, and getCardFinalCost
// reads the final step off it. The two were never independent. A card's
// price is short enough that the breakdown *is* the calculation, so
// splitting them would mean copying the whole body to buy a separation
// that had already gone, and a second copy is where a drift would start.
// =====================================================================
import { cardByFlag, cardName, cardText, carriesTag } from "../cards";
import { WAGES } from "../constants/crew";
import {
  COMMODITIES,
  PRODUCT_PRICES,
  RECIPES,
  RESOURCES,
} from "../constants/goods";
import { SHIP_DISCOUNT_PER_LEVEL } from "../constants/ships";
import type { Tag } from "../constants/tags";
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

// One owner per modifier key, which is what makes finding whichever card
// writes a given key a reliable way to name the source of a price
// adjustment for the breakdowns below. That used to be true because only
// one boon's flags were ever active at a time (selecting a new one
// replaced state.modifierFlags wholesale, see applyBoon); held boons
// made several flags ride together, and the pool's own validator is what
// keeps this reader honest through that: no two cards write the same key,
// so the first match is still the only match (see the one owner per key
// clause in ../cards).
//
// [F2: the card record, and the mode weighting field] The name comes off the
// card record rather than off a second walk of the boon table, which is what
// keeps a retune from moving the card and leaving its own breakdown lines
// saying the old name. It reads the card's own text rather than a copy kept
// here, so the label a captain reads on the card and the label the tooltip
// prints for it are one string.
function boonNameForModifierKey(key: string): string {
  const card = cardByFlag(key);
  return card === null ? "Active boon" : cardText(card).name;
}

// ========== Transport ==========
export function calcTransportCost(
  state: GameState,
  totalItems: number,
  hasWoven = false,
): number {
  let base = totalItems * 2;
  let discount = state.shipLevel * SHIP_DISCOUNT_PER_LEVEL;
  if (state.modifierFlags.transport_flat_discount)
    discount += state.modifierFlags.transport_flat_discount;
  let cost = Math.max(5, base - discount);
  if (hasWoven && state.modifierFlags.transport_silk_discount)
    cost = Math.max(
      5,
      Math.floor(cost * state.modifierFlags.transport_silk_discount),
    );
  // [F6: charters at leg four] The Bulk Charter, the Quartermaster pair's
  // first rule: gold off per lot rather than off the bill. Read after the
  // two round flags and before the modules, the order its display mirror
  // below takes too, and floored at zero rather than at the five the base
  // charge floors at, the same reading the modules under it take: a
  // charter that makes a light run's freight free is doing what its text
  // says, and the fall to zero is a power a card above Classic's ceiling
  // is allowed to carry.
  if (state.modifierFlags.transport_per_lot_discount)
    cost = Math.max(
      0,
      cost -
        Math.floor(totalItems * state.modifierFlags.transport_per_lot_discount),
    );
  if (hasModule(state, "bulk_hauler")) cost = Math.max(0, cost - totalItems);
  if (hasModule(state, "overdrive_engine")) cost = Math.max(0, cost - 5);
  if (hasModule(state, "silk_monopoly") && hasWoven) cost = 0;
  return Math.max(0, cost);
}

// A separate, display only mirror of calcTransportCost above. Kept as its
// own function rather than having calcTransportCost delegate to it, so the
// balance critical "preserved verbatim" math above never has to change to
// accommodate a tooltip.
export function explainTransportCost(
  state: GameState,
  totalItems: number,
  hasWoven = false,
): PriceBreakdown {
  const steps: PriceStep[] = [];
  const base = totalItems * 2;
  let cost = base;

  const shipDiscount = state.shipLevel * SHIP_DISCOUNT_PER_LEVEL;
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
  if (hasWoven && state.modifierFlags.transport_silk_discount) {
    const next = Math.max(
      5,
      Math.floor(cost * state.modifierFlags.transport_silk_discount),
    );
    steps.push({
      label: `${boonNameForModifierKey("transport_silk_discount")} on woven goods`,
      delta: next - cost,
    });
    cost = next;
  }
  // [F6: charters at leg four] The Bulk Charter's own line, in the place
  // the arithmetic above takes it, so the tooltip and the charge cannot
  // come to describe one run two ways.
  if (state.modifierFlags.transport_per_lot_discount) {
    const perLot = state.modifierFlags.transport_per_lot_discount;
    const next = Math.max(0, cost - Math.floor(totalItems * perLot));
    steps.push({
      label: `${boonNameForModifierKey("transport_per_lot_discount")} (down ${perLot}g per lot)`,
      delta: next - cost,
    });
    cost = next;
  }
  if (hasModule(state, "bulk_hauler")) {
    const next = Math.max(0, cost - totalItems);
    steps.push({
      label: `${cardName("bulk_hauler")} module`,
      delta: next - cost,
    });
    cost = next;
  }
  if (hasModule(state, "overdrive_engine")) {
    const next = Math.max(0, cost - 5);
    steps.push({
      label: `${cardName("overdrive_engine")} module`,
      delta: next - cost,
    });
    cost = next;
  }
  if (hasModule(state, "silk_monopoly") && hasWoven) {
    steps.push({
      label: `${cardName("silk_monopoly")} module (woven freight waived)`,
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
    let vat = Math.floor(taxable * VAT_RATE);
    if (state.modifierFlags.vat_discount)
      vat = Math.floor(vat * (1 - state.modifierFlags.vat_discount));
    // [F4: boons at milestone moments] Harbor Credit, the boon a crossed
    // rung deals: the dues a quarter lower, taken as the same
    // multiplication the round's own discount takes and landing after it
    // rather than beside it, so a captain holding both pays the product
    // of the two. The order is a declaration rather than a rule, the way
    // applyBoon's merge is: the two flags multiply and multiplication
    // commutes.
    if (state.modifierFlags.harbor_credit)
      vat = Math.floor(vat * (1 - state.modifierFlags.harbor_credit));
    // [F6: charters at leg four] The Quiet Account, the other half of the
    // Aroma pair: the harbor dues halved, taken as the same
    // multiplication Harbor Credit takes and landing after it rather
    // than beside it, so a captain holding both pays the product of the
    // two, floored at each step the way every multiplication above it is.
    if (state.modifierFlags.voyage_dues_discount)
      vat = Math.floor(vat * (1 - state.modifierFlags.voyage_dues_discount));
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
  let vat = Math.floor(taxable * VAT_RATE);
  steps.push({
    label: `${Math.round(VAT_RATE * 100)}% VAT on the margin`,
    delta: -vat,
  });
  if (state.modifierFlags.vat_discount) {
    const next = Math.floor(vat * (1 - state.modifierFlags.vat_discount));
    steps.push({
      label: `${boonNameForModifierKey("vat_discount")} (down ${Math.round(state.modifierFlags.vat_discount * 100)}%)`,
      delta: next - vat,
    });
    vat = next;
  }
  // [F4: boons at milestone moments] Harbor Credit's own line, beside the
  // round discount's and in the same order the arithmetic takes the two
  // (see calcVAT above), so the tooltip and the charge cannot come to
  // describe one sale two ways.
  if (state.modifierFlags.harbor_credit) {
    const next = Math.floor(vat * (1 - state.modifierFlags.harbor_credit));
    steps.push({
      label: `${boonNameForModifierKey("harbor_credit")} (down ${Math.round(state.modifierFlags.harbor_credit * 100)}%)`,
      delta: next - vat,
    });
    vat = next;
  }
  // [F6: charters at leg four] The Quiet Account's own line, beside
  // Harbor Credit's and in the same order the arithmetic takes the two
  // (see calcVAT above), so the tooltip and the charge cannot come to
  // describe one sale two ways.
  if (state.modifierFlags.voyage_dues_discount) {
    const next = Math.floor(
      vat * (1 - state.modifierFlags.voyage_dues_discount),
    );
    steps.push({
      label: `${boonNameForModifierKey("voyage_dues_discount")} (down ${Math.round(state.modifierFlags.voyage_dues_discount * 100)}%)`,
      delta: next - vat,
    });
    vat = next;
  }
  if (hasModule(state, "tax_evasion")) {
    const next = Math.floor(vat * 0.5);
    steps.push({
      label: `${cardName("tax_evasion")} module (down 50%)`,
      delta: next - vat,
    });
    vat = next;
  }
  return { base: sellingPrice, steps, final: vat };
}

// The rate a voyage pays until something dials it, and the only thing
// that dials it today is the Tax Shelter boon (see tax_shelter). Named
// because the Welcome screen quotes the same figure to a new captain,
// and two copies of it had already been written.
export const INCOME_TAX_RATE = 0.1;

// The tax on the margin of a finished good sale. Written out four times
// before this existed, and the tooltip was one of them, which is the copy
// a captain reads while deciding whether to sell.
export const VAT_RATE = 0.05;

export function calcIncomeTax(state: GameState, preTax: number): number {
  if (preTax <= 0) return 0;
  const rate = state.modifierFlags.income_tax_override || INCOME_TAX_RATE;
  let tax = Math.floor(preTax * rate);
  if (hasModule(state, "smugglers_hold")) tax = Math.floor(tax * 1.2);
  if (hasModule(state, "tax_evasion")) tax = Math.floor(tax * 0.5);
  return tax;
}

// ========== Market card pricing ==========
// The two per unit module discounts: the tag each one covers, and how many
// Gold it takes off each unit. Named here because two places apply them, the
// card charge below and the hover preview in explainExpectedPrice, and
// keeping the tag and the amount in one place is what stops the two from
// drifting apart again. They had: the preview applied neither, so a captain
// holding the Kiln Cellar saw a Porcelain Clay price two Gold a unit above
// what the card went on to charge.
//
// [F2: the card record, and the mode weighting field] They read tags now
// rather than naming goods (the Kiln Cellar its two, the Foreign Quarter
// Pass its own two), which is the shape the epic exists to end: with a tag
// in the line the card's copy and the card's arithmetic agree, and a good
// added to the catalogue under one of these tags joins the discount the same
// afternoon. One consequence is worth stating where the numbers are: the
// Bulk Monopoly boon reads the same tag the Kiln Cellar does, and the two
// could not overlap before, when each named goods the other did not. A
// captain holding both now takes four Gold off a bulk unit. That is the
// trade the card's own new text promises, and it is a pair for the
// combination instrument F7 describes rather than a reason to keep two
// disjoint item lists here.
const KILN_CELLAR_TAG: Tag = "bulk";
const KILN_CELLAR_PER_UNIT = 2;
const FOREIGN_QUARTER_TAG: Tag = "luxury";
const FOREIGN_QUARTER_PER_UNIT = 3;

// What a market card actually costs, reported as a step by step breakdown
// so the Market tooltip can show exactly where a price came from:
// base cost, then whatever boon or module touched it. getCardFinalCost
// below reads the final step, so this is the only price of a card there is
// rather than a second opinion of one.
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
  // [F6: charters at leg four] The Long Ledger, the Aroma pair's first
  // money rule: port purchases a tenth cheaper, taken as the same
  // multiplication the round's own discount takes and landing right
  // after it rather than beside it, so a captain holding both pays the
  // product of the two. This is the charge's copy of the rule; the
  // preview mirror below folds the same read into its range.
  if (state.modifierFlags.voyage_purchase_discount) {
    const next = Math.floor(
      cost * (1 - state.modifierFlags.voyage_purchase_discount),
    );
    steps.push({
      label: `${boonNameForModifierKey("voyage_purchase_discount")} (down ${Math.round(state.modifierFlags.voyage_purchase_discount * 100)}%)`,
      delta: next - cost,
    });
    cost = next;
  }
  if (state.modifierFlags.hemp_price_reduction) {
    const hempReduction = state.modifierFlags.hemp_price_reduction;
    // The card is the Bulk Monopoly and reads the bulk tag. The flag's own
    // name is a persisted handle (a save carries it, and the ledger reads it
    // by this key), so it keeps the spelling it has always had rather than
    // moving with the card's caption: a persisted name is a migration, not a
    // copy change (see the same note in ./paths.ts).
    const reduction = card.resources.reduce(
      (sum, r) =>
        carriesTag("good", r.type, "bulk")
          ? sum + (r.quantity ?? 0) * hempReduction
          : sum,
      0,
    );
    if (reduction > 0) {
      steps.push({
        label: `${boonNameForModifierKey("hemp_price_reduction")} (down ${hempReduction}g per unit)`,
        delta: -reduction,
      });
      cost -= reduction;
    }
  }
  if (hasModule(state, "kiln_cellar")) {
    const reduction = card.resources.reduce(
      (sum, r) =>
        carriesTag("good", r.type, KILN_CELLAR_TAG)
          ? sum + (r.quantity ?? 0) * KILN_CELLAR_PER_UNIT
          : sum,
      0,
    );
    if (reduction > 0) {
      steps.push({
        label: `${cardName("kiln_cellar")} module (down ${KILN_CELLAR_PER_UNIT}g per unit)`,
        delta: -reduction,
      });
      cost -= reduction;
    }
  }
  if (hasModule(state, "foreign_quarter_pass")) {
    const reduction = card.resources.reduce(
      (sum, r) =>
        carriesTag("good", r.type, FOREIGN_QUARTER_TAG)
          ? sum + (r.quantity ?? 0) * FOREIGN_QUARTER_PER_UNIT
          : sum,
      0,
    );
    if (reduction > 0) {
      steps.push({
        label: `${cardName("foreign_quarter_pass")} module (down ${FOREIGN_QUARTER_PER_UNIT}g per unit)`,
        delta: -reduction,
      });
      cost -= reduction;
    }
  }
  if (hasModule(state, "smugglers_hold")) {
    const next = Math.floor(cost * 0.85);
    steps.push({
      label: `${cardName("smugglers_hold")} module (down 15%)`,
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

// The typical price range for any tradable good, resource or product. A
// raw material carries its range on the COMMODITIES entry it already has
// for its ports, a finished good keeps its own in PRODUCT_PRICES, and
// nothing carries both, so one lookup answers for either kind.
//
// Returns undefined rather than a made up range for an item that is
// neither. Callers that only want to annotate a price can then skip an
// unknown good, while the ones that need a number to divide by, like the
// deal scoring, can supply their own fallback and make that choice where
// the division actually happens.
//
// Exists because five screens were each rebuilding it with the same two
// optional chains, three of them with a hand written [0, 100] fallback
// that only some of them wanted and none of them explained.
export function basePriceRange(item: string): [number, number] | undefined {
  return COMMODITIES[item]?.basePrice ?? PRODUCT_PRICES[item];
}

// Where a price sits inside its range, as a 0 to 1 fraction: 0 at the
// floor of the range, 1 at the ceiling, and anything outside pinned to
// the nearer end. Three screens were working this out for themselves,
// two of them to colour a cell and one to score a deal, and each of the
// three wrote the divide by zero guard and the clamp out by hand.
//
// Takes an already resolved range rather than an item name, so the
// caller still chooses its own fallback for a good with no range at all,
// which is the choice basePriceRange deliberately leaves open above.
export function priceRatio(
  unitPrice: number,
  [min, max]: [number, number],
): number {
  return Math.max(0, Math.min(1, (unitPrice - min) / (max - min || 1)));
}

// A general "what does this typically cost" estimate for a raw material
// or product, independent of any specific market card. Used for the
// hover preview during Market so a captain can size up the whole market,
// including goods that didn't happen to roll onto one of this round's
// market cards. Ports nudge a raw material's roll by 1 Gold up or down
// depending on whether the port specializes in it (see genResourceCard),
// which is why the range carries a margin note instead of trying to fold
// that into the numbers themselves.
export function explainExpectedPrice(
  state: GameState,
  itemType: string,
): ExpectedPrice {
  const isResource = (RESOURCES as readonly string[]).includes(itemType);
  let [min, max] = basePriceRange(itemType) ?? [0, 100];
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
    // [F6: charters at leg four] The Long Ledger, folded into the range
    // exactly the way the round's own discount above is and in the same
    // order the card charge takes the two (see explainCardPrice), so the
    // preview and the charge cannot come to describe one purchase two
    // ways.
    if (state.modifierFlags.voyage_purchase_discount) {
      const factor = 1 - state.modifierFlags.voyage_purchase_discount;
      min = Math.floor(min * factor);
      max = Math.floor(max * factor);
      modifiers.push(
        `${boonNameForModifierKey("voyage_purchase_discount")} (down ${Math.round(state.modifierFlags.voyage_purchase_discount * 100)}%)`,
      );
    }
    if (
      carriesTag("good", itemType, "bulk") &&
      state.modifierFlags.hemp_price_reduction
    ) {
      min = Math.max(0, min - state.modifierFlags.hemp_price_reduction);
      max = Math.max(0, max - state.modifierFlags.hemp_price_reduction);
      modifiers.push(
        `${boonNameForModifierKey("hemp_price_reduction")} (down ${state.modifierFlags.hemp_price_reduction}g per unit)`,
      );
    }
    // The two per unit module discounts. Flat Gold off a single unit, so
    // they come off the range the same way the Bulk Monopoly boon above
    // does rather than scaling it. Applied in the order the card charge
    // applies them (see explainCardPrice), since a percentage taken before
    // a flat subtraction and one taken after settle on different numbers.
    if (
      hasModule(state, "kiln_cellar") &&
      carriesTag("good", itemType, KILN_CELLAR_TAG)
    ) {
      min = Math.max(0, min - KILN_CELLAR_PER_UNIT);
      max = Math.max(0, max - KILN_CELLAR_PER_UNIT);
      modifiers.push(
        `${cardName("kiln_cellar")} module (down ${KILN_CELLAR_PER_UNIT}g per unit)`,
      );
    }
    if (
      hasModule(state, "foreign_quarter_pass") &&
      carriesTag("good", itemType, FOREIGN_QUARTER_TAG)
    ) {
      min = Math.max(0, min - FOREIGN_QUARTER_PER_UNIT);
      max = Math.max(0, max - FOREIGN_QUARTER_PER_UNIT);
      modifiers.push(
        `${cardName("foreign_quarter_pass")} module (down ${FOREIGN_QUARTER_PER_UNIT}g per unit)`,
      );
    }
    if (hasModule(state, "smugglers_hold")) {
      min = Math.floor(min * 0.85);
      max = Math.floor(max * 0.85);
      modifiers.push(`${cardName("smugglers_hold")} module (down 15%)`);
    }
  }

  return { min, max, isProduct: !isResource, modifiers };
}

// ========== Wages ==========
// The canonical per worker, per round wage for a given type, given every
// currently active modifier. There is no separate one time "hiring fee"
// in this game (see hireWorker, which never touches state.money);
// the number this returns is what Resolve actually charges for that
// worker, so every place that shows or charges a wage, this function,
// payWages, and the Pending Payroll preview in phases/WorkerMgmt.tsx,
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
  // preview in phases/WorkerMgmt.tsx).
  if (state.housePerks.goldenWageDiscount) wage = Math.floor(wage * 0.8);
  return wage;
}

// ========== Broker intel ==========
// The Gold a captain pays for one Broker's rumor in Market. Used to live
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
