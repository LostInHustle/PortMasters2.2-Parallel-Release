// Market board generation. Draws use a seeded RNG per captain, harbor and
// voyage epoch, so a board is reproducible across reloads but personal to a
// captain. Keep the generators pure: pools are arguments, not state.
import { cardLead } from "../cards";
import { ICONS } from "../constants/brand";
import {
  joined,
  line,
  type LedgerLine,
  type LedgerValue,
} from "@/lib/game/ledger";
import {
  COMMODITIES,
  PRODUCT_PRICES,
  RECIPES,
  RESOURCES,
  RESOURCE_WEIGHTS,
} from "../constants/goods";
import { silkRoadCharterOpensOn, marketCountsFor } from "../difficulty";
import { bazaarRumorsOn } from "../flags";
import { lockingPathFor } from "../paths";
import { cargoRoom } from "../larder";
import {
  unlockedPorts,
  unlockedProducts,
  unlockedResourceDraw,
  unlockedResources,
} from "../pools";
import { portShiftMultiplier, type PortShift } from "../maroon";
import { createRng, pick, randInt, type Rng } from "../rng";
import type { GameContext, GameState, OrderCard, ResourceCard } from "../types";
import { addOwnedAmount } from "./core";
import { getCardFinalCost } from "./pricing";

// Goods and ports unlocked this round. Passed in so draws stay pure.
type MarketPools = {
  resources: string[];
  products: string[];
  ports: string[];
  draw: { items: string[]; probs: number[] };
};

export function poolsFor(state: GameState): MarketPools {
  const { difficulty, currentRound } = state;
  return {
    resources: unlockedResources(difficulty, currentRound),
    products: unlockedProducts(difficulty, currentRound),
    ports: unlockedPorts(difficulty, currentRound),
    draw: unlockedResourceDraw(difficulty, currentRound),
  };
}

// quantityOverride is used by the Brokers' Favor; portOverride pins the port
// for a Broker's Whisper. Both are absent for ordinary draws.
export function genRawOrder(
  rng: Rng,
  pools: MarketPools,
  filter: string | null = null,
  quantityOverride?: number,
  portOverride?: string,
): Omit<OrderCard, "id"> {
  const num = randInt(rng, 1, 3);
  const resources: { type: string; required: number }[] = [];
  const available = [...pools.resources];
  const port = portOverride ?? pick(rng, pools.ports);
  let total = 0;
  if (pools.resources.includes(filter ?? "")) {
    const req = quantityOverride ?? randInt(rng, 2, 5);
    total += req;
    resources.push({ type: filter as string, required: req });
  } else {
    for (let i = 0; i < num; i++) {
      if (!available.length) break;
      const r = pick(rng, available);
      available.splice(available.indexOf(r), 1);
      const req = randInt(rng, 2, 5);
      total += req;
      resources.push({ type: r, required: req });
    }
  }
  const base = resources.reduce((s, r) => s + r.required * 5, 0);
  return {
    demandPort: port,
    resources,
    reward: base + randInt(rng, 10, 25),
    totalItems: total,
    isProductOrder: false,
  };
}

export function genProductOrder(
  rng: Rng,
  pools: MarketPools,
  filter: string | null = null,
  quantityOverride?: number,
  portOverride?: string,
): Omit<OrderCard, "id"> {
  const product =
    filter && pools.products.includes(filter)
      ? filter
      : pick(rng, pools.products);
  const req = quantityOverride ?? randInt(rng, 1, 3);
  const port = portOverride ?? pick(rng, pools.ports);
  const basePrice = randInt(
    rng,
    PRODUCT_PRICES[product][0],
    PRODUCT_PRICES[product][1],
  );
  return {
    demandPort: port,
    resources: [{ type: product, required: req }],
    reward: basePrice * req,
    totalItems: req,
    isProductOrder: true,
  };
}

// Pure function of rng only. Reading mutable intel here would change how
// many rng calls the draw consumes and shift every later order.
export function genMixedOrder(
  rng: Rng,
  pools: MarketPools,
): Omit<OrderCard, "id"> {
  return rng() < 0.5 ? genRawOrder(rng, pools) : genProductOrder(rng, pools);
}

// The good decides the path through lockingPathFor; only goods from unlocked
// pools that some path claims are candidates. The good is drawn with
// replacement like ordinary orders, because the path label is derived from it.
// Null when none remain.
export function genPathOrder(
  rng: Rng,
  pools: MarketPools,
): Omit<OrderCard, "id"> | null {
  const candidates = [...pools.resources, ...pools.products].filter(
    (good) => lockingPathFor(good) !== null,
  );
  if (candidates.length === 0) return null;
  const good = pick(rng, candidates);
  const order = (RESOURCES as readonly string[]).includes(good)
    ? genRawOrder(rng, pools, good)
    : genProductOrder(rng, pools, good);
  return { ...order, isPathOrder: true };
}

function genProductPurchaseCard(
  rng: Rng,
  pools: MarketPools,
): Omit<ResourceCard, "id"> {
  const product = pick(rng, pools.products);
  const qty = randInt(rng, 1, 2);
  const port = pick(rng, pools.ports);
  const recipe = RECIPES[product];
  let matCost = 0;
  const materialList: { type: string; amount: number }[] = [];
  for (const [m, a] of Object.entries(recipe.materials)) {
    const avg = (COMMODITIES[m].basePrice[0] + COMMODITIES[m].basePrice[1]) / 2;
    matCost += avg * a;
    // The card holds the recipe, not a rendered list: the goods are named
    // when the board is read, so their names follow the reader's language.
    materialList.push({ type: m, amount: a });
  }
  // Price is material cost times a 1.4 to 1.8 markup, clamped to the
  // product's table range.
  const markup = 1.4 + rng() * 0.4;
  let unitPrice = Math.floor(matCost * markup);
  const [min, max] = PRODUCT_PRICES[product];
  unitPrice = Math.max(min, Math.min(unitPrice, max));
  return {
    port,
    resources: [
      {
        type: product,
        quantity: qty,
        price: unitPrice,
        materialCost: matCost,
        materialList,
      },
    ],
    totalCost: unitPrice * qty,
    isProductCard: true,
  };
}

// pulse is a per good multiplier, shift is a PortShift, and rumor is a per
// good lean. All three are passed in to keep the draw pure. They adjust raw
// goods only; product cards are priced from their recipe.
function genResourceCard(
  rng: Rng,
  pools: MarketPools,
  pulse: Record<string, number> = {},
  shift: PortShift | null = null,
  rumor: Record<string, number> = {},
): Omit<ResourceCard, "id"> {
  if (rng() < 0.3) return genProductPurchaseCard(rng, pools);
  const num = randInt(rng, 1, 3);
  const resources: { type: string; quantity: number; price: number }[] = [];
  const available = [...pools.draw.items];
  const probs = [...pools.draw.probs];
  const port = pick(rng, pools.ports);
  const lean = portShiftMultiplier(shift, port);
  for (let i = 0; i < num; i++) {
    if (!available.length) break;
    const r = rng();
    let acc = 0;
    let chosen = available[0];
    for (let j = 0; j < available.length; j++) {
      acc += probs[j];
      if (r <= acc) {
        chosen = available[j];
        break;
      }
    }
    const idx = available.indexOf(chosen);
    available.splice(idx, 1);
    probs.splice(idx, 1);
    const qty = randInt(rng, 1, 3);
    const [min, max] = COMMODITIES[chosen].basePrice;
    const base = randInt(rng, min, max);
    let price = COMMODITIES[chosen].ports.includes(port) ? base - 1 : base + 1;
    // Sum the three adjustments and round once. Applying any of them in a second
    // pass would price the same card differently depending on order. The pulse
    // and rumor are fractions; the shift is a multiplier.
    const nudge = (pulse[chosen] ?? 0) + (rumor[chosen] ?? 0);
    if (nudge || lean !== 1) {
      price = Math.max(1, Math.round(price * (1 + nudge) * lean));
    }
    resources.push({ type: chosen, quantity: qty, price });
  }
  const total = resources.reduce((s, r) => s + r.quantity * r.price, 0);
  return { port, resources, totalCost: total, isProductCard: false };
}

// Raw resources only; product purchase cards do not feed the harbor pulse.
export function tallyPurchasesByResource(
  state: GameState,
): Record<string, number> {
  return tallyCardPurchases(state, state.purchasedCards);
}

// Shared by the full report and the standing orders delta, so both count the
// same goods from the same implementation.
export function tallyCardPurchases(
  state: GameState,
  cardIds: readonly number[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of cardIds) {
    const card = state.resourceCards.find((c) => c.id === id);
    if (!card || card.isProductCard) continue;
    for (const r of card.resources) {
      if (!(r.type in RESOURCE_WEIGHTS)) continue;
      out[r.type] = (out[r.type] || 0) + (r.quantity ?? 0);
    }
  }
  return out;
}

// Stamped before startMarket draws this round's board.
function applyHarborPulse(state: GameState, pulse: Record<string, number>) {
  state.harborPulse = pulse;
}

// Null is meaningful: a round with no call must clear the previous round's shift.
export function applyPortShift(state: GameState, shift: PortShift | null) {
  state.portShift = shift;
}

// Empty object is meaningful: silence clears the previous round's lean.
function applyBazaarLean(state: GameState, lean: Record<string, number>) {
  state.bazaarLean = lean;
}

// Absent fields are left alone for backward compatibility; present empty
// values clear pulse and lean, and null clears the shift.
export type MarketLeans = {
  harborPulse?: Record<string, number>;
  portShift?: PortShift | null;
  bazaarLean?: Record<string, number>;
};

export function applyMarketLeans(state: GameState, leans: MarketLeans): void {
  if (leans.harborPulse) applyHarborPulse(state, leans.harborPulse);
  if (leans.portShift !== undefined) {
    applyPortShift(state, leans.portShift);
  }
  if (leans.bazaarLean) applyBazaarLean(state, leans.bazaarLean);
}

// One way flip that adds one cargo lot per round. A fresh voyage resets it;
// log only when it first triggers.
export function applyTidewatchSurge(state: GameState, logs: LedgerLine[]) {
  if (state.tidewatchSurge) return;
  state.tidewatchSurge = true;
  logs.push(
    line(
      "🌊 Tidewatch Alert: the harbor takes notice of a bustling crew! One more cargo lot joins the Port Purchase board, every round, for the rest of this voyage.",
    ),
  );
}

export function purchaseCard(
  state: GameState,
  cardId: number,
  logs: LedgerLine[],
) {
  const card = state.resourceCards.find((c) => c.id === cardId);
  if (!card) return;
  if (state.purchasedCards.includes(card.id)) return;
  const cost = getCardFinalCost(state, card);
  if (state.money < cost) {
    logs.push(
      line("❌ Not enough Gold! Need {cost}, Have {state.money}", {
        cost,
        "state.money": state.money,
      }),
    );
    return;
  }
  // A lot is all or nothing, since the card's price is the lot's price. Check
  // the purse first so the original refusal stays first.
  const units = card.resources.reduce((n, r) => n + (r.quantity ?? 0), 0);
  const room = cargoRoom(state);
  if (units > room) {
    logs.push(
      line(
        "❌ No room in the hold for that lot: it takes {units} {slotWord} and {room} {beWord} free.",
        {
          units,
          slotWord: units === 1 ? "slot" : "slots",
          room,
          beWord: room === 1 ? "is" : "are",
        },
      ),
    );
    return;
  }
  state.money -= cost;
  state.roundCosts += cost;
  state.totalCosts += cost;
  for (const r of card.resources)
    // Use addOwnedAmount so a missing inventory key cannot store NaN.
    addOwnedAmount(state, r.type, r.quantity ?? 0);
  state.purchasedCards.push(card.id);
  state.purchaseCount++;
  if (card.isProductCard) {
    // A saved product card may have no goods line; fall back to the plain
    // receipt rather than throwing.
    const r = card.resources[0];
    if (r) {
      logs.push(
        line(
          "🛒 Bought Product at {card.port}: {icon}{type}×{quantity} (@{price} Gold/item, Mat Cost {matCost} Gold), Total {cost} Gold",
          {
            "card.port": line(card.port),
            icon: ICONS[r.type],
            type: line(r.type),
            quantity: r.quantity ?? 0,
            price: r.price ?? 0,
            matCost: r.materialCost ?? 0,
            cost,
          },
        ),
      );
    } else {
      logs.push(
        line("🛒 Bought Product at {card.port}, Total {cost} Gold", {
          "card.port": line(card.port),
          cost,
        }),
      );
    }
    // The receipt shows list price, so state any discount beside the total.
    if (cost < card.totalCost)
      logs.push(
        line("   ✨ Boon Discount Applied! Saved {saved} Gold", {
          saved: card.totalCost - cost,
        }),
      );
    logs.push(
      line(
        "💡 Tip: VAT applies when selling finished products",
        undefined,
        "   ",
      ),
    );
  } else {
    // Join the goods at the read so the list follows the reader's language and
    // separator.
    const txt = joined(
      card.resources.map((r) =>
        line("{goodIcon}{r.type}×{r.quantity}({r.price} Gold/item)", {
          goodIcon: ICONS[r.type],
          "r.type": line(r.type),
          "r.quantity": r.quantity ?? 0,
          "r.price": r.price ?? 0,
        }),
      ),
      () => " + ",
    );
    logs.push(
      line("🛒 Bought at {card.port}: {txt}, Total {cost} Gold", {
        "card.port": line(card.port),
        txt,
        cost,
      }),
    );
    if (cost < card.totalCost)
      logs.push(
        line("   ✨ Boon Discount Applied! Saved {saved} Gold", {
          saved: card.totalCost - cost,
        }),
      );
  }
  logs.push(
    line("📊 Purchased {state.purchaseCount} cargo lots", {
      "state.purchaseCount": state.purchaseCount,
    }),
  );
}

// Both intel callers draw from the same pool with the same rules, and the
// sentence belongs to the caller. The caller guards an empty pool. This
// mutates marketDemandTags.
export function revealRumor(
  state: GameState,
  logs: LedgerLine[],
  sentence: string,
  params: Record<string, LedgerValue> = {},
): void {
  const tags = state.marketDemandTags;
  const idx = Math.floor(Math.random() * tags.length);
  const item = tags.splice(idx, 1)[0];
  const openPorts = unlockedPorts(state.difficulty, state.currentRound);
  const port = openPorts[Math.floor(Math.random() * openPorts.length)];
  state.revealedIntel.push({ item, port });
  logs.push(
    line(sentence, {
      ...params,
      port: line(port),
      item: line(item),
    }),
  );
}

export function startMarket(
  state: GameState,
  ctx: GameContext,
  logs: LedgerLine[],
) {
  state.phase = "market";
  state.purchaseCount = 0;
  state.purchasedCards = [];
  state.marketDemandTags = [];
  // Deterministic intel pool: captain, voyage and round.
  const intelRng = createRng(
    `${ctx.seedBase}:V${state.voyageEpoch}:R${state.currentRound}:intel`,
  );
  const marketPools = poolsFor(state);
  const allItems = [...marketPools.resources, ...marketPools.products];
  // Up to five unique demand tags from this round's unlocked goods.
  for (let i = 0; i < 5; i++) {
    const tag = pick(intelRng, allItems as readonly string[]);
    if (!state.marketDemandTags.includes(tag)) state.marketDemandTags.push(tag);
  }
  state.revealedIntel = [];
  // Farsight's rumors come after the demand pool is rolled and do not consume
  // the paid Broker's Whisper.
  const freeIntel = state.modifierFlags.free_intel ?? 0;
  for (let i = 0; i < freeIntel; i++) {
    if (!state.marketDemandTags.length) break;
    revealRumor(
      state,
      logs,
      "{farsightLead}: 'Word from {port}: High demand for {item}!' (free)",
      { farsightLead: (locale) => cardLead("farsight", locale) },
    );
  }
  logs.push(
    line("\n⚓=== Round {state.currentRound} · Market: Port Purchase ===", {
      "state.currentRound": state.currentRound,
    }),
  );
  logs.push(
    line("💰 Current Gold: {state.money}", {
      "state.money": state.money,
    }),
  );
  // Deterministic port market: captain, voyage and round.
  const marketRng = createRng(
    `${ctx.seedBase}:V${state.voyageEpoch}:R${state.currentRound}:market`,
  );
  state.resourceCards = [];
  const tierPurchaseCount = marketCountsFor(
    state.difficulty,
    state.currentRound,
  ).purchase;
  // The charter banner uses the tier's own count, not the Tidewatch or House
  // additions below.
  if (silkRoadCharterOpensOn(state.difficulty, state.currentRound)) {
    logs.push(
      line(
        "🗺️ The Silk Road Charter opens a new tier! The harbor grows busier: {tierPurchaseCount} cargo lots and as many buyers from this voyage on.",
        { tierPurchaseCount },
      ),
    );
  }
  // Tidewatch and the Vermilion Gate pledge add lots on top of the tier count.
  // Tidewatch is additive, never a substitute, and is announced only when it
  // triggers, so this loop just adds the quiet extra lot.
  const houseLot = state.housePerks.vermilionExtraCard ? 1 : 0;
  const purchaseCount =
    tierPurchaseCount + (state.tidewatchSurge ? 1 : 0) + houseLot;
  // Ignore bazaarLean when the mode has rumors off, including on loaded saves.
  const rumorLean = bazaarRumorsOn(state.mode) ? state.bazaarLean : {};
  for (let i = 0; i < purchaseCount; i++) {
    state.resourceCards.push({
      id: i,
      ...genResourceCard(
        marketRng,
        marketPools,
        state.harborPulse,
        state.portShift,
        rumorLean,
      ),
    });
  }
}

export function completeMarket(state: GameState, logs: LedgerLine[]) {
  if (state.purchaseCount === 0) logs.push(line("⏭️ Purchasing skipped"));
  else
    logs.push(
      line("✅ Purchasing ended, bought {state.purchaseCount} cargo lots", {
        "state.purchaseCount": state.purchaseCount,
      }),
    );
  // Record the average paid price per good for the purchase sparkline. One
  // decimal is enough for the chart. Only goods with quantity greater than zero
  // contribute.
  const pricesByGood: Record<string, { total: number; qty: number }> = {};
  for (const cardId of state.purchasedCards) {
    const card = state.resourceCards.find((c) => c.id === cardId);
    if (!card) continue;
    for (const r of card.resources) {
      const key = r.type;
      const price = r.price ?? 0;
      const qty = r.quantity ?? 0;
      if (!pricesByGood[key]) pricesByGood[key] = { total: 0, qty: 0 };
      pricesByGood[key].total += price * qty;
      pricesByGood[key].qty += qty;
    }
  }
  for (const [good, { total, qty }] of Object.entries(pricesByGood)) {
    if (qty <= 0) continue;
    const avg = Math.round((total / qty) * 10) / 10;
    if (!state.priceHistory[good]) state.priceHistory[good] = [];
    state.priceHistory[good].push(avg);
  }
}
