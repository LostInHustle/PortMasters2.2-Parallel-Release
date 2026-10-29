// Every "what does this cost" question in the game: freight, VAT, income
// tax, market card prices, artisan wages, and the Broker's cut on a favor.
//
// Everything here is a pure function of state and arguments: nothing writes
// to GameState, pushes a log line, or draws from the RNG. The explain*
// readers walk the same price stacks the calc* charges walk, so a tooltip
// cannot describe arithmetic the settlement does not run.
import { cardByFlag, cardName, cardText, carriesTag } from "../cards";
import { t } from "@/lib/game/i18n";
import { WAGES, workerType } from "../constants/crew";
import {
  COMMODITIES,
  MARKET_GOODS,
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

// One owner per modifier key (see the one owner per key rule in ../cards),
// so the first matching card is the only match. The name comes off the card
// record, which keeps the card label and the tooltip label one string.
function boonNameForModifierKey(key: string): string {
  const card = cardByFlag(key);
  // The fallback is read where it is used, since the tooltip decides the
  // language.
  return card === null ? t("Active boon") : cardText(card).name;
}

// A price stack is a list of rungs, each carrying a running number to the
// next. The charge walks the list for its number and the explainer walks the
// same list for its lines, so one list cannot describe one price two ways.
type StackRung = {
  // The tooltip wording. A thunk because the charge never reads it and some
  // labels cost a card lookup. It receives the movement this rung made, so
  // a label can report the Gold actually lost rather than a nominal figure.
  label: (delta: number) => string;
  // Whether the rung applies. A rung out of play moves and prints nothing.
  inPlay: boolean;
  // The number carried out of this rung.
  next: (running: number) => number;
  // The movement the tooltip reports. Defaults to the difference between
  // next and running; the VAT rungs that take from the sale price rather
  // than from the tax override it.
  delta?: (running: number, next: number) => number;
};

// The one walk both readers make. The charge asks for the number; the
// explainer hands the walk a collector and receives the lines.
function walkStack(
  rungs: StackRung[],
  start: number,
  collect?: (step: PriceStep) => void,
): number {
  let running = start;
  for (const rung of rungs) {
    if (!rung.inPlay) continue;
    const next = rung.next(running);
    if (collect !== undefined) {
      const delta = rung.delta ? rung.delta(running, next) : next - running;
      collect({ label: rung.label(delta), delta });
    }
    running = next;
  }
  return running;
}

// The freight stack: harbor minimum, hull and round discounts, the woven
// cut, the charter's per item cut, the three modules, and the luxury rule
// last. The order is the arithmetic's order and the tooltip's.
function freightStack(
  state: GameState,
  totalItems: number,
  wovenUnits: number,
  luxuryUnits: number,
  wovenLuxuryUnits = 0,
): { base: number; rungs: StackRung[] } {
  const base = totalItems * 2;
  const shipDiscount = state.shipLevel * SHIP_DISCOUNT_PER_LEVEL;
  const flatDiscount = state.modifierFlags.transport_flat_discount ?? 0;
  const perItemDiscount = state.modifierFlags.transport_per_lot_discount ?? 0;
  const hasWoven = wovenUnits > 0;
  // Units carrying both classes. Silk is woven and luxury, so a rung that
  // already halved or waived its freight must not take it again under the
  // other tag. Counts of each class cannot say how many were the same
  // units, so the manifest hands in the overlap.
  const bothUnits = Math.max(
    0,
    Math.min(wovenLuxuryUnits, wovenUnits, luxuryUnits),
  );
  const wovenOnly = Math.max(0, wovenUnits - bothUnits);
  const luxuryOnly = Math.max(0, luxuryUnits - bothUnits);
  const plainUnits = Math.max(
    0,
    totalItems - wovenOnly - luxuryOnly - bothUnits,
  );
  // Each unit starts with an equal share of the running bill. A tag rung
  // takes its class's share and records what is left of that class, so a
  // later tag reads a share that already knows what the first took. Without
  // that record, Silk waived as woven would be waived again as luxury and
  // the second waiver would land on the cargo beside it. The share rounds
  // up, so a tag that promises free freight does not leave one unit paying.
  const weights = { wovenOnly, luxuryOnly, both: bothUnits, plain: plainUnits };
  const totalWeight = (): number =>
    weights.wovenOnly + weights.luxuryOnly + weights.both + weights.plain;
  const shareOf = (cost: number, units: number): number => {
    const total = totalWeight();
    return total > 0 ? Math.ceil((cost * units) / total) : 0;
  };
  return {
    base,
    rungs: [
      // The harbor's minimum is its own rung so the breakdown can show it.
      // It is in play only while the run is under the minimum.
      {
        label: () => t("Minimum freight"),
        inPlay: base < 5,
        next: (cost) => Math.max(5, cost),
      },
      // The hull's discount and the round's flat cut both floor at the
      // harbor minimum, so a light run never dips below five.
      {
        label: () =>
          t("Ship Level {state.shipLevel} discount", {
            "state.shipLevel": state.shipLevel,
          }),
        inPlay: shipDiscount > 0,
        next: (cost) => Math.max(5, cost - shipDiscount),
      },
      {
        // Print the Gold this rung took, not the flag's nominal four: at
        // the harbor minimum the bill can lose less.
        label: (delta) =>
          t("{boonName} (down {down} Gold)", {
            boonName: boonNameForModifierKey("transport_flat_discount"),
            down: Math.max(0, -delta),
          }),
        inPlay: Boolean(state.modifierFlags.transport_flat_discount),
        next: (cost) => Math.max(5, cost - flatDiscount),
      },
      {
        label: () =>
          t("{boonName} on woven goods", {
            boonName: boonNameForModifierKey("transport_silk_discount"),
          }),
        inPlay:
          hasWoven && Boolean(state.modifierFlags.transport_silk_discount),
        // Half of the woven lines' share, not half of the whole bill, so a
        // single Silk line cannot halve the cargo beside it. The harbor
        // minimum still holds.
        next: (cost) => {
          const share = shareOf(cost, weights.wovenOnly + weights.both);
          const removed = Math.ceil(share / 2);
          weights.wovenOnly /= 2;
          weights.both /= 2;
          return Math.max(5, cost - removed);
        },
      },
      // The Bulk Charter takes Gold off per item rather than off the bill.
      // Its flag key still says "per lot" from the build that named it, but
      // the arithmetic has always been per item, so the label says item.
      // Floored at zero rather than five, like the modules below.
      {
        label: () =>
          t("{boonName} (down {perItem} Gold per item)", {
            boonName: boonNameForModifierKey("transport_per_lot_discount"),
            perItem: perItemDiscount,
          }),
        inPlay: Boolean(state.modifierFlags.transport_per_lot_discount),
        next: (cost) =>
          Math.max(0, cost - Math.floor(totalItems * perItemDiscount)),
      },
      {
        label: () =>
          t("{cardName} module", { cardName: cardName("bulk_hauler") }),
        inPlay: hasModule(state, "bulk_hauler"),
        next: (cost) => Math.max(0, cost - totalItems),
      },
      {
        label: () =>
          t("{cardName} module", { cardName: cardName("overdrive_engine") }),
        inPlay: hasModule(state, "overdrive_engine"),
        next: (cost) => Math.max(0, cost - 5),
      },
      {
        label: () =>
          t("{cardName} module (woven freight waived)", {
            cardName: cardName("silk_monopoly"),
          }),
        inPlay: hasModule(state, "silk_monopoly") && hasWoven,
        // The woven lines' share, not the whole bill. No harbor minimum
        // here because the card promises the goods travel free. The weights
        // record what earlier rungs took, so a Silk line already halved by
        // Weaver's Winds is not waived twice.
        next: (cost) => {
          const share = shareOf(cost, weights.wovenOnly + weights.both);
          weights.wovenOnly = 0;
          weights.both = 0;
          return Math.max(0, cost - share);
        },
      },
      // Fleet of Treasures: the luxury tag's freight rule, taken after the
      // modules above so it discounts freight they already brought down.
      // The count arrives from the caller because this stack takes numbers,
      // not a manifest (see fleetOfTreasuresUnits below).
      {
        label: () =>
          t("{cardName} module", { cardName: cardName("fleet_of_treasures") }),
        // A caller may hand in the manifest's luxury count, but a hull
        // without the module waives nothing. Production callers already
        // count through fleetOfTreasuresUnits, which returns zero.
        inPlay: hasModule(state, "fleet_of_treasures") && luxuryUnits > 0,
        // The luxury lines' share, not three Gold a unit off the whole
        // bill. Base freight is two Gold a unit, so a nominal three would
        // zero a pure luxury run and spend the excess on other cargo. A
        // Silk line already waived as woven carries no weight here.
        next: (cost) => {
          const share = shareOf(cost, weights.luxuryOnly + weights.both);
          weights.luxuryOnly = 0;
          weights.both = 0;
          return Math.max(0, cost - share);
        },
      },
    ],
  };
}

// The stack's last clamp. Every rung that can go below zero already floors
// there, so this guards the arithmetic rather than stating a rule and
// prints no breakdown line. Both readers call it, so they end on one number.
function freightFloor(cost: number): number {
  return Math.max(0, cost);
}

// What a run's freight costs. The settlement and every board quote one walk.
export function calcTransportCost(
  state: GameState,
  totalItems: number,
  wovenUnits = 0,
  luxuryUnits = 0,
  wovenLuxuryUnits = 0,
): number {
  const { base, rungs } = freightStack(
    state,
    totalItems,
    wovenUnits,
    luxuryUnits,
    wovenLuxuryUnits,
  );
  return freightFloor(walkStack(rungs, base));
}

// The same walk, rendered as lines: the base, each rung that was in play
// with what it moved, then the total.
export function explainTransportCost(
  state: GameState,
  totalItems: number,
  wovenUnits = 0,
  luxuryUnits = 0,
  wovenLuxuryUnits = 0,
): PriceBreakdown {
  const { base, rungs } = freightStack(
    state,
    totalItems,
    wovenUnits,
    luxuryUnits,
    wovenLuxuryUnits,
  );
  const steps: PriceStep[] = [];
  const final = freightFloor(
    walkStack(rungs, base, (step) => {
      steps.push(step);
    }),
  );
  return { base, steps, final };
}

// How many units on an order the Fleet of Treasures covers: the luxury
// tagged lines' counts, only while the module is equipped, so no call site
// can quote the discount off a hull that lacks it. The settlement, the
// board's freight line and the planner all count through here.
export function fleetOfTreasuresUnits(
  state: GameState,
  resources: readonly { type: string; required?: number }[],
): number {
  if (!hasModule(state, "fleet_of_treasures")) return 0;
  return resources
    .filter((r) => carriesTag("good", r.type, "luxury"))
    .reduce((sum, r) => sum + (r.required ?? 0), 0);
}

/**
 * How many units on a manifest carry a tag. The freight rules need the
 * count, not a yes or no: a boolean let one Silk line halve a whole run. The
 * count is read off the same tag vocabulary the cards speak.
 */
export function cargoUnitsWithTag(
  resources: readonly { type: string; required?: number }[],
  tag: Tag,
): number {
  return resources.reduce(
    (sum, r) =>
      carriesTag("good", r.type, tag) ? sum + (r.required ?? 0) : sum,
    0,
  );
}

/**
 * How many units on a manifest carry both tags. Silk is woven and luxury,
 * so the two waivers are promises about the same bolt and the second must
 * not take it again from the cargo beside it.
 */
export function cargoUnitsWithAllTags(
  resources: readonly { type: string; required?: number }[],
  first: Tag,
  second: Tag,
): number {
  return resources.reduce(
    (sum, r) =>
      carriesTag("good", r.type, first) && carriesTag("good", r.type, second)
        ? sum + (r.required ?? 0)
        : sum,
    0,
  );
}

// The VAT stack: material cost, artisan wage, tax on the margin, then the
// round discounts and the module's halving, folded in one after another.
//
// The stack carries the tax. It starts at nothing, the two cost rungs only
// report, and the tax on the margin sets it. A sale that does not clear its
// cost owes nothing, which is why the discounts are in play only once the
// margin has taxed something.
function vatStack(
  state: GameState,
  product: string,
  sellingPrice: number,
): StackRung[] {
  const recipe = RECIPES[product];
  let matCost = 0;
  for (const [m, a] of Object.entries(recipe.materials)) {
    matCost +=
      ((COMMODITIES[m].basePrice[0] + COMMODITIES[m].basePrice[1]) / 2) * a;
  }
  // The wage actually paid, not the list price: the Workshop surcharge, a
  // hiring discount and the Golden Lotus pledge all move the real cost, and
  // the margin must use the figure payroll charges.
  const workerCost = getHireCost(state, recipe.worker_type);
  const taxable = sellingPrice - matCost - workerCost;
  const vatDiscount = state.modifierFlags.vat_discount ?? 0;
  const harborCredit = state.modifierFlags.harbor_credit ?? 0;
  return [
    {
      label: () => t("Average material cost"),
      inPlay: true,
      next: (tax) => tax,
      delta: () => -matCost,
    },
    {
      // The artisan's name is here because the tooltip prints it in this
      // label, read off the same roster the workshop hires from so a good
      // made by a Coppersmith is never labeled with another trade.
      label: () =>
        t("{workerLabel} wage", {
          workerLabel: t(
            workerType(recipe.worker_type)?.label ?? recipe.worker_type,
          ),
        }),
      inPlay: true,
      next: (tax) => tax,
      delta: () => -workerCost,
    },
    {
      label: () =>
        t("{vatPct}% VAT on the margin", {
          vatPct: Math.round(VAT_RATE * 100),
        }),
      inPlay: taxable > 0,
      next: () => Math.floor(taxable * VAT_RATE),
      delta: (_tax, tax) => -tax,
    },
    {
      label: () =>
        t("{boonName} (down {pct}%)", {
          boonName: boonNameForModifierKey("vat_discount"),
          pct: Math.round(vatDiscount * 100),
        }),
      inPlay: taxable > 0 && Boolean(state.modifierFlags.vat_discount),
      next: (tax) => Math.floor(tax * (1 - vatDiscount)),
    },
    {
      // Harbor Credit: VAT a quarter lower, multiplied in after the
      // round's own discount, so a captain holding both pays the product of
      // the two. Multiplication commutes, so the order is a declaration.
      label: () =>
        t("{boonName} (down {pct}%)", {
          boonName: boonNameForModifierKey("harbor_credit"),
          pct: Math.round(harborCredit * 100),
        }),
      inPlay: taxable > 0 && Boolean(state.modifierFlags.harbor_credit),
      next: (tax) => Math.floor(tax * (1 - harborCredit)),
    },
    {
      // The rung reads the same factor the charge folds (TAX_EVASION_FACTOR),
      // so the sentence a captain reads and the tax they pay cannot drift.
      label: () =>
        t("{cardName} module (down {pct}%)", {
          cardName: cardName("tax_evasion"),
          pct: Math.round((1 - TAX_EVASION_FACTOR) * 100),
        }),
      inPlay: taxable > 0 && hasModule(state, "tax_evasion"),
      next: (tax) => Math.floor(tax * TAX_EVASION_FACTOR),
    },
  ];
}

// The tax a finished good sale pays, as the stack above reads it. One walk,
// not two: this is the final figure of the same breakdown the tooltip
// prints, so the charge a sale pays and the last line a captain reads are
// the same arithmetic rather than two implementations of it.
export function calcVAT(
  state: GameState,
  product: string,
  sellingPrice: number,
): number {
  return explainVAT(state, product, sellingPrice).final;
}

// The same walk, rendered as lines: material cost, wage, tax on the margin,
// and every discount folded into it. calcVAT above reads only its final
// figure, so the breakdown and the charge cannot come from two walks.
export function explainVAT(
  state: GameState,
  product: string,
  sellingPrice: number,
): PriceBreakdown {
  const steps: PriceStep[] = [];
  const final = walkStack(vatStack(state, product, sellingPrice), 0, (step) => {
    steps.push(step);
  });
  return { base: sellingPrice, steps, final };
}

// The base income tax rate. Tax Shelter is the one boon that overrides it.
export const INCOME_TAX_RATE = 0.1;

// The tax on the margin of a finished good sale.
export const VAT_RATE = 0.05;

// The two module factors the tax reads, named once so the charge and the
// rate print fold the same pair.
const SMUGGLERS_HOLD_TAX_FACTOR = 1.2;
const TAX_EVASION_FACTOR = 0.5;

// The factors in force, in the order the charge folds them, read by both
// the charge and the rate.
function incomeTaxFactors(state: GameState): number[] {
  const factors: number[] = [];
  if (hasModule(state, "smugglers_hold"))
    factors.push(SMUGGLERS_HOLD_TAX_FACTOR);
  if (hasModule(state, "tax_evasion")) factors.push(TAX_EVASION_FACTOR);
  return factors;
}

export function calcIncomeTax(state: GameState, preTax: number): number {
  if (preTax <= 0) return 0;
  const rate = state.modifierFlags.income_tax_override || INCOME_TAX_RATE;
  let tax = Math.floor(preTax * rate);
  // The charge floors after each multiply, which is where the coins come
  // from; the rate below does not floor.
  for (const factor of incomeTaxFactors(state)) tax = Math.floor(tax * factor);
  return tax;
}

// The rate as charged, for the income tax receipt (see the Resolve step in
// ./lifecycle). It folds the module factors on the rate rather than reading
// them back out of the charge, because the charge floors after each
// multiply and a rate written back from two floors would match neither the
// base nor the coins.
export function incomeTaxRate(state: GameState): number {
  return incomeTaxRateWithOverride(
    state,
    state.modifierFlags.income_tax_override,
  );
}

// The rate a different override would charge, with the same module factors
// folded in. The advisor compares today's rate with the card's, and both
// sides must carry the captain's modules rather than the bare base.
export function incomeTaxRateWithOverride(
  state: GameState,
  override: number | undefined,
): number {
  let rate = override || INCOME_TAX_RATE;
  // Only the charge rounds what it takes; the rate does not floor.
  for (const factor of incomeTaxFactors(state)) rate *= factor;
  return rate;
}

/**
 * A rate as a printed percentage: at most one decimal, no trailing zero.
 *
 * The module factors make the rate fractional (a Tax Shelter under Tax
 * Evasion is two and a half percent), so rounding to a whole number would
 * overstate the charge. The single decimal covers every rate the pool can
 * build and still prints a future rate sensibly.
 */
export function formatTaxRate(rate: number): string {
  return Number((rate * 100).toFixed(1)).toString();
}

// The purchase reductions, as one ordered stack. The charge walks it from
// the card's total; the hover preview walks it from each end of a good's
// range at quantity one. The order is part of the rule: the round's
// percentage, the charter's percentage, the three flat per unit reductions,
// then the Smuggler's Hold's percentage, because a percentage before a flat
// subtraction settles on a different number.
//
// KILN_CELLAR_TAG keeps its persisted spelling: a save carries the key and
// the ledger reads it, so renaming it is a migration, not a copy change.
// Here it means every market good, not the bulk tag.
const KILN_CELLAR_TAG: Tag = "bulk";
const KILN_CELLAR_PER_UNIT = 2;
const FOREIGN_QUARTER_TAG: Tag = "luxury";
const FOREIGN_QUARTER_PER_UNIT = 3;

type PurchaseLine = { type: string; quantity?: number };

// The catalogue as a set, since the stack runs on every hover and press.
const MARKET_GOOD_SET: ReadonlySet<string> = new Set(MARKET_GOODS);

// How many units of a purchase a rung covers. A null tag means every raw
// material and product; the two modules name their own tag. The catalogue
// is the gate, so a new good joins the discount with its own record.
function purchaseUnits(
  lines: readonly PurchaseLine[],
  tag: Tag | null,
): number {
  return lines.reduce((sum, line) => {
    if (!MARKET_GOOD_SET.has(line.type)) return sum;
    if (tag !== null && !carriesTag("good", line.type, tag)) return sum;
    return sum + (line.quantity ?? 0);
  }, 0);
}

function purchaseStack(
  state: GameState,
  lines: readonly PurchaseLine[],
): StackRung[] {
  const purchaseDiscount = state.modifierFlags.purchase_discount ?? 0;
  const voyagePurchaseDiscount =
    state.modifierFlags.voyage_purchase_discount ?? 0;
  const goodsReduction = state.modifierFlags.hemp_price_reduction ?? 0;
  const allUnits = purchaseUnits(lines, null);
  const bulkUnits = purchaseUnits(lines, KILN_CELLAR_TAG);
  const luxuryUnits = purchaseUnits(lines, FOREIGN_QUARTER_TAG);
  return [
    {
      label: () =>
        t("{boonName} (down {pct}%)", {
          boonName: boonNameForModifierKey("purchase_discount"),
          pct: Math.round(purchaseDiscount * 100),
        }),
      inPlay: purchaseDiscount > 0,
      next: (cost) => Math.floor(cost * (1 - purchaseDiscount)),
    },
    // The Long Ledger: port purchases a tenth cheaper, multiplied in right
    // after the round's discount, so a captain holding both pays the
    // product of the two.
    {
      label: () =>
        t("{boonName} (down {pct}%)", {
          boonName: boonNameForModifierKey("voyage_purchase_discount"),
          pct: Math.round(voyagePurchaseDiscount * 100),
        }),
      inPlay: voyagePurchaseDiscount > 0,
      next: (cost) => Math.floor(cost * (1 - voyagePurchaseDiscount)),
    },
    // The Bulk Monopoly: two Gold off every raw material and product, per
    // unit. It shares the flat shape with the modules below, so a good
    // covered by several takes their sum.
    {
      label: () =>
        t("{hempBoon} (down {hempReduction} Gold per unit)", {
          hempBoon: boonNameForModifierKey("hemp_price_reduction"),
          hempReduction: goodsReduction,
        }),
      inPlay: goodsReduction > 0 && allUnits > 0,
      next: (cost) => Math.max(0, cost - allUnits * goodsReduction),
    },
    {
      label: () =>
        t(
          "{kilnCellarName} module (down {KILN_CELLAR_PER_UNIT} Gold per unit)",
          {
            kilnCellarName: cardName("kiln_cellar"),
            KILN_CELLAR_PER_UNIT,
          },
        ),
      inPlay: hasModule(state, "kiln_cellar") && bulkUnits > 0,
      next: (cost) => Math.max(0, cost - bulkUnits * KILN_CELLAR_PER_UNIT),
    },
    {
      label: () =>
        t("{cardName} module (down {perUnit} Gold per unit)", {
          cardName: cardName("foreign_quarter_pass"),
          perUnit: FOREIGN_QUARTER_PER_UNIT,
        }),
      inPlay: hasModule(state, "foreign_quarter_pass") && luxuryUnits > 0,
      next: (cost) =>
        Math.max(0, cost - luxuryUnits * FOREIGN_QUARTER_PER_UNIT),
    },
    {
      label: () =>
        t("{smugglersHoldName} module (down 15%)", {
          smugglersHoldName: cardName("smugglers_hold"),
        }),
      inPlay: hasModule(state, "smugglers_hold"),
      next: (cost) => Math.floor(cost * 0.85),
    },
  ];
}

// What a market card actually costs, as a step by step breakdown for the
// Market tooltip. getCardFinalCost reads the final step off this, so there
// is only one card price.
export function explainCardPrice(
  state: GameState,
  card: ResourceCard,
): PriceBreakdown {
  const steps: PriceStep[] = [];
  const final = Math.max(
    0,
    walkStack(purchaseStack(state, card.resources), card.totalCost, (step) => {
      steps.push(step);
    }),
  );
  return { base: card.totalCost, steps, final };
}

export function getCardFinalCost(state: GameState, card: ResourceCard): number {
  return explainCardPrice(state, card).final;
}

/**
 * What one line of a market card settles at, per unit, after every rung of
 * the purchase stack.
 *
 * The stack charges one total for the card, so a line's own `price` is the
 * harbor's list, not what the captain pays. The allocation follows each
 * line's share of the card's base value, because percentage rungs scale the
 * whole card and flat rungs were already counted per unit in that base.
 *
 * Returns an exact fraction; screens round at the print and the standing
 * order gate compares by cross multiplication.
 */
export function cardLineUnitPrice(
  state: GameState,
  card: ResourceCard,
  lineIndex: number,
): number {
  const line = card.resources[lineIndex];
  if (line === undefined) return 0;
  const base = line.price ?? 0;
  if (card.totalCost <= 0) return base;
  return (base * getCardFinalCost(state, card)) / card.totalCost;
}

/**
 * Whether a line's settled price is at or under a captain's written
 * ceiling. Cross multiplied against the proportional allocation, so a
 * fractional price is never rounded up over the ceiling.
 */
export function cardLineFitsCeiling(
  state: GameState,
  card: ResourceCard,
  lineIndex: number,
  ceiling: number,
): boolean {
  const line = card.resources[lineIndex];
  if (line === undefined) return true;
  const base = line.price ?? 0;
  if (card.totalCost <= 0) return base <= ceiling;
  return base * getCardFinalCost(state, card) <= ceiling * card.totalCost;
}

// The typical price range for a tradable good. A raw material carries its
// range on its COMMODITIES entry, a finished good in PRODUCT_PRICES, and
// nothing carries both, so one lookup answers for either.
//
// Returns undefined for an unknown item rather than inventing a range, so
// callers that need a divisor can choose their own fallback where the
// division happens.
export function basePriceRange(item: string): [number, number] | undefined {
  return COMMODITIES[item]?.basePrice ?? PRODUCT_PRICES[item];
}

// Where a price sits inside its range, as a 0 to 1 fraction, with outside
// values pinned to the nearer end. The range is passed in resolved, so the
// caller still chooses the fallback for a good with no range.
export function priceRatio(
  unitPrice: number,
  [min, max]: [number, number],
): number {
  return Math.max(0, Math.min(1, (unitPrice - min) / (max - min || 1)));
}

// A typical cost estimate independent of any market card, used by the
// Market hover preview for goods that did not roll onto a card this round.
// Ports nudge a raw material's roll by 1 Gold when they specialize in it
// (see genResourceCard), so the range carries a margin note instead.
export function explainExpectedPrice(
  state: GameState,
  itemType: string,
): ExpectedPrice {
  const isResource = (RESOURCES as readonly string[]).includes(itemType);
  const [minBase, maxBase] = basePriceRange(itemType) ?? [0, 100];
  // One walk per end of the range at quantity one, so the preview applies
  // the same rungs as the card charge. The first walk collects labels; the
  // second only carries the number.
  const rungs = purchaseStack(state, [{ type: itemType, quantity: 1 }]);
  const modifiers: string[] = [];
  const min = Math.max(
    0,
    walkStack(rungs, minBase, (step) => {
      modifiers.push(step.label);
    }),
  );
  const max = Math.max(0, walkStack(rungs, maxBase));

  return { min, max, isProduct: !isResource, modifiers };
}

// What a harbor bill costs after the voyage's dues reduction. The Quiet
// Account is the one writer of voyage_dues_discount, and both halves of the
// Dues read this helper, so the charter cannot discount one bill and leave
// the other. Floored after the multiply, like the other percentages here.
export function discountedDue(state: GameState, amount: number): number {
  const discount = state.modifierFlags.voyage_dues_discount ?? 0;
  return discount > 0 ? Math.floor(amount * (1 - discount)) : amount;
}

// The per worker, per round wage for a type with every active modifier.
// There is no separate hiring fee; this is what Resolve actually charges,
// so every display and charge of a wage reads from here rather than
// deriving the formula again.
export function getHireCost(state: GameState, type: string): number {
  let wage = WAGES[type];
  if (state.modifierFlags.hire_discount)
    wage = Math.floor(wage * (1 - state.modifierFlags.hire_discount));
  if (hasModule(state, "artisans_workshop")) wage = Math.floor(wage * 1.2);
  // Golden Lotus's pledge takes a fifth off every wage, applied last so it
  // discounts the wage actually due rather than the list price.
  if (state.housePerks.goldenWageDiscount) wage = Math.floor(wage * 0.8);
  return wage;
}

// The Gold a captain pays for one Broker's Whisper in Market, derived from
// the equipped module rather than stored on GameState, so the price cannot
// drift from the hull. Callers should use getIntelCost, not a state field.
//
// The two prices are named because the guide quotes the first; the
// discounted price is read only by the function below.
export const INTEL_COST = 5;
const INTEL_COST_WITH_NETWORK = 2;

export function getIntelCost(state: GameState): number {
  return hasModule(state, "brokers_network")
    ? INTEL_COST_WITH_NETWORK
    : INTEL_COST;
}

// The Broker's cut on a Broker's Favor order, a saturating curve rather
// than a flat rate. Net payout climbs almost one for one at first and bends
// toward the Age's cap without reaching it, which caps what one favor pays
// regardless of quantity. See brokersFavorPayoutCap.
export function brokersFavorCommission(reward: number): number {
  // Read from the Age in force, so the Broker's Age lets a favor pay more,
  // and read here so every caller quotes the same number.
  const cap = brokersFavorPayoutCap();
  const net = cap * (1 - Math.exp(-reward / cap));
  return Math.max(0, reward - Math.floor(net));
}
