// =====================================================================
// Phase 1, the port market: what a captain may buy this round, what it
// costs them, and the deterministic draw that decides the board.
//
// The generators here are the reason this file matters. They run on a
// seeded RNG (see ../rng) keyed to the captain, the room and the voyage
// epoch, so every captain gets their own market that is reproducible
// across a reload but different from everyone else's. That only holds
// while the draw depends on nothing but the seed and the charter, which
// is why the pools are passed in as an argument rather than read from
// mutable state, and why genMixedOrder is deliberately a pure function of
// the RNG alone.
//
// genRawOrder, genProductOrder and genMixedOrder are exported rather than
// private because Phase 2 (./orders) draws the trade board with the same
// generators. They were file private before the split purely because
// everything lived in one file.
// =====================================================================
import {
  COMMODITIES,
  ICONS,
  PRODUCT_PRICES,
  RECIPES,
  RESOURCE_WEIGHTS,
} from "../constants";
import { charterOpensOn, marketCountsFor } from "../difficulty";
import {
  unlockedPorts,
  unlockedProducts,
  unlockedResourceDraw,
  unlockedResources,
} from "../pools";
import { createRng, pick, randInt, weightedPick, type Rng } from "../rng";
import type { GameContext, GameState, OrderCard, ResourceCard } from "../types";
import { addOwnedAmount } from "./core";
import { getCardFinalCost } from "./pricing";

// [ONLINE] These use a seeded RNG so the market is identical for every
// captain in the same room on the same voyage.
// quantityOverride is only ever set by callBrokersFavor, letting a captain
// choose exactly how much of a filtered good the guaranteed order asks for
// instead of leaving it to the usual randInt roll below.
// What the market may draw from this round: whatever the room's tier has
// unlocked by now (see ./pools). Passed in rather than read from module scope
// so these generators stay pure functions of (rng, pools) and a captain's
// seeded draw depends only on the seed and the charter, never on mutable state.
export type MarketPools = {
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

export function genRawOrder(
  rng: Rng,
  pools: MarketPools,
  filter: string | null = null,
  quantityOverride?: number,
): Omit<OrderCard, "id"> {
  const num = randInt(rng, 1, 3);
  const resources: { type: string; required: number }[] = [];
  const available = [...pools.resources];
  const port = pick(rng, pools.ports);
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
): Omit<OrderCard, "id"> {
  const product =
    filter && pools.products.includes(filter)
      ? filter
      : pick(rng, pools.products);
  const req = quantityOverride ?? randInt(rng, 1, 3);
  const port = pick(rng, pools.ports);
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

// Deliberately a pure function of rng only. It used to also take `state`
// so it could fold a captain's own revealed Broker's Whisper intel
// straight into whichever order slot it was generating at the time, which
// meant the number of rng() calls this consumed depended on
// that captain's own purchase history. orderRng below is a fixed
// deterministic stream (seeded per captain and per voyage, see the file
// header), so letting the draw depend on mutable intel state made a
// captain's own orders non reproducible: regenerating the draw after a
// reload, with different intel state, silently shifted every order after
// the one the intel touched. See startPhase2 for where the intel guarantee
// happens now: entirely after, and independent of, this draw.
export function genMixedOrder(
  rng: Rng,
  pools: MarketPools,
): Omit<OrderCard, "id"> {
  return rng() < 0.5 ? genRawOrder(rng, pools) : genProductOrder(rng, pools);
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
  const details: string[] = [];
  for (const [m, a] of Object.entries(recipe.materials)) {
    const avg = (COMMODITIES[m].basePrice[0] + COMMODITIES[m].basePrice[1]) / 2;
    matCost += avg * a;
    details.push(`${m}×${a}`);
  }
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
        materialDetails: details.join(" + "),
      },
    ],
    totalCost: unitPrice * qty,
    isProductCard: true,
  };
}

// [MANIFEST 01: The Harbor Pulse] pulse holds a per resource multiplier for
// this round, e.g. { Silk: 0.08 } meaning Silk runs 8% pricier this round
// because the room leaned into it last round. Optional and defaulted to an
// empty object so every existing call site (and every test of the
// preserved verbatim economy) keeps producing identical prices when no
// pulse is in play, which is always true on round 1.
function genResourceCard(
  rng: Rng,
  pools: MarketPools,
  pulse: Record<string, number> = {},
): Omit<ResourceCard, "id"> {
  if (rng() < 0.3) return genProductPurchaseCard(rng, pools);
  const num = randInt(rng, 1, 3);
  const resources: { type: string; quantity: number; price: number }[] = [];
  const available = [...pools.draw.items];
  const probs = [...pools.draw.probs];
  const port = pick(rng, pools.ports);
  for (let i = 0; i < num; i++) {
    if (!available.length) break;
    let r = rng(),
      acc = 0,
      chosen = available[0];
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
    const nudge = pulse[chosen];
    if (nudge) price = Math.max(1, Math.round(price * (1 + nudge)));
    resources.push({ type: chosen, quantity: qty, price });
  }
  const total = resources.reduce((s, r) => s + r.quantity * r.price, 0);
  return { port, resources, totalCost: total, isProductCard: false };
}

// [MANIFEST 01: The Harbor Pulse] What this captain bought this Phase 1,
// summed by raw resource only (Hemp, Silk, Tea), the same set genResourceCard
// prices. Finished product purchase cards (genProductPurchaseCard) don't
// count, the pulse is about the harbor leaning into a raw good, not about who
// bought a finished Sachet. Read once, right before completePhase1 clears
// purchasedCards/resourceCards, and relayed to the server (see
// src/lib/use-phase-sync.ts) so it can fold this captain's draw into the
// room wide tally the next round's pulse is built from.
export function tallyPurchasesByResource(
  state: GameState,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of state.purchasedCards) {
    const card = state.resourceCards.find((c) => c.id === id);
    if (!card || card.isProductCard) continue;
    for (const r of card.resources) {
      if (!(r.type in RESOURCE_WEIGHTS)) continue;
      out[r.type] = (out[r.type] || 0) + (r.quantity ?? 0);
    }
  }
  return out;
}

// [MANIFEST 01: The Harbor Pulse] Stamps the room wide pulse the server
// computed for this round onto local state, so genResourceCard picks it up
// the moment startPhase1 runs below. A plain setter kept as its own function,
// the same convention purchaseIntel/receiveLoan/etc already follow, so the
// client's phase advance handler can call it through the same act() dispatch
// as every other socket driven state change.
export function applyHarborPulse(
  state: GameState,
  pulse: Record<string, number>,
) {
  state.harborPulse = pulse;
}

// [MANIFEST 03: Tidewatch Alerts] Applied on every client in the room the
// instant the server confirms the combined Reputation threshold was crossed
// (see the game:status handler in src/server/realtime.ts). A one direction
// flip: nothing in this codebase ever sets tidewatchSurge back to false
// mid voyage, and a fresh voyage already resets it through
// createInitialGameState. Logged once here, at the moment it happens,
// rather than every round afterward in startPhase1.
export function applyTidewatchSurge(state: GameState, logs: string[]) {
  if (state.tidewatchSurge) return;
  state.tidewatchSurge = true;
  logs.push(
    `🌊 Tidewatch Alert: the harbor takes notice of a bustling crew! One more cargo lot joins the Port Purchase board, every round, for the rest of this voyage.`,
  );
}

export function purchaseCard(state: GameState, cardId: number, logs: string[]) {
  const card = state.resourceCards.find((c) => c.id === cardId);
  if (!card) return;
  if (state.purchasedCards.includes(card.id)) return;
  const cost = getCardFinalCost(state, card);
  if (state.money < cost) {
    logs.push(
      `❌ Insufficient funds! Need ${cost} Gold, Have ${state.money} Gold`,
    );
    return;
  }
  state.money -= cost;
  state.roundCosts += cost;
  state.totalCosts += cost;
  // Routed through addOwnedAmount rather than writing state.inventory
  // directly. This was the one unguarded `+=` in the engine, so buying a good
  // whose key the hold did not yet carry evaluated `undefined + n` and stored
  // NaN, losing the cargo and the Gold that paid for it. Every mutation now
  // goes through the one defensive helper.
  for (const r of card.resources)
    addOwnedAmount(state, r.type, r.quantity ?? 0);
  state.purchasedCards.push(card.id);
  state.purchaseCount++;
  if (card.isProductCard) {
    const r = card.resources[0];
    logs.push(
      `🛒 Bought Product at ${card.port}: ${ICONS[r.type]}${r.type}×${r.quantity} (@${r.price} Gold/item, Mat Cost ${r.materialCost} Gold), Total ${cost} Gold`,
    );
    logs.push("   💡 Tip: VAT applies when selling finished products");
  } else {
    const txt = card.resources
      .map(
        (r) => `${ICONS[r.type]}${r.type}×${r.quantity}(${r.price} Gold/item)`,
      )
      .join(" + ");
    logs.push(`🛒 Bought at ${card.port}: ${txt}, Total ${cost} Gold`);
    if (cost < card.totalCost)
      logs.push(
        `   ✨ Boon Discount Applied! Saved ${card.totalCost - cost} Gold`,
      );
  }
  logs.push(`📊 Purchased ${state.purchaseCount} cargo batches`);
}

export function startPhase1(
  state: GameState,
  ctx: GameContext,
  logs: string[],
) {
  state.phase = 1;
  state.purchaseCount = 0;
  state.purchasedCards = [];
  state.phase2DemandTags = [];
  // [ONLINE] Deterministic intel pool per (room, round).
  const intelRng = createRng(
    `${ctx.seedBase}:V${state.voyageEpoch}:R${state.currentRound}:intel`,
  );
  const marketPools = poolsFor(state);
  const allItems = [...marketPools.resources, ...marketPools.products];
  for (let i = 0; i < 5; i++) {
    let t = pick(intelRng, allItems as readonly string[]);
    if (!state.phase2DemandTags.includes(t)) state.phase2DemandTags.push(t);
  }
  state.revealedIntel = [];
  // Farsight hands over its rumors here rather than at boon selection, since
  // the demand pool above is what they are drawn from and it has only just
  // been rolled. Free in every sense: no fee, and it does not consume the
  // captain's paid Broker's Whisper for the round.
  const freeIntel = state.modifierFlags.free_intel ?? 0;
  for (let i = 0; i < freeIntel; i++) {
    if (!state.phase2DemandTags.length) break;
    const idx = Math.floor(Math.random() * state.phase2DemandTags.length);
    const item = state.phase2DemandTags.splice(idx, 1)[0];
    const openPorts = unlockedPorts(state.difficulty, state.currentRound);
    const port = openPorts[Math.floor(Math.random() * openPorts.length)];
    state.revealedIntel.push({ item, port });
    logs.push(
      `🔮 Farsight: 'Word from ${port}: High demand for ${item}!' (free)`,
    );
  }
  logs.push(`\n⚓=== Round ${state.currentRound} · Phase 1: Port Purchase ===`);
  logs.push(`💰 Current Funds: ${state.money} Gold`);
  // [ONLINE] Deterministic port market per (room, round).
  const marketRng = createRng(
    `${ctx.seedBase}:V${state.voyageEpoch}:R${state.currentRound}:market`,
  );
  state.resourceCards = [];
  // [DIFFICULTY] Card count comes from the room's tier and the current round
  // (see marketCountsFor): flat for Fair Winds, widening on the harder tiers.
  const tierPurchaseCount = marketCountsFor(
    state.difficulty,
    state.currentRound,
  ).purchase;
  // Announce the charter the moment it opens, so the market getting busier
  // reads as an event rather than an unexplained jump in card count. Fair
  // Winds schedules none, so this never fires on the entry tier. Based on
  // the tier's own count, not the Tidewatch bonus below, so the charter
  // banner never takes credit for a card the room itself earned.
  if (charterOpensOn(state.difficulty, state.currentRound)) {
    logs.push(
      `🗺️ The Silk Road Charter opens! The harbor grows busier: ${tierPurchaseCount} cargo lots and as many buyers from this voyage on.`,
    );
  }
  // [MANIFEST 03: Tidewatch Alerts] Purely additive on top of whatever the
  // difficulty tier already rolls, never a substitute for it. Already
  // announced once, the moment the surge itself triggered (see
  // applyTidewatchSurge), so this stays a quiet +1 every round after that
  // rather than repeating the announcement.
  const purchaseCount = tierPurchaseCount + (state.tidewatchSurge ? 1 : 0);
  for (let i = 0; i < purchaseCount; i++) {
    state.resourceCards.push({
      id: i,
      ...genResourceCard(marketRng, marketPools, state.harborPulse),
    });
  }
}

export function completePhase1(state: GameState, logs: string[]) {
  if (state.purchaseCount === 0) logs.push("⏭️ Purchasing skipped");
  else logs.push(`✅ Purchasing ended, bought ${state.purchaseCount} batches`);

  // Record price history: for each good the captain bought this round,
  // compute the average unit price paid and append it to the history
  // array. Used by the Purchase phase sparkline to show price trends.
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

  state.phase = "barter";
}
