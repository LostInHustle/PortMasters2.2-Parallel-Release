// =====================================================================
// Market, the port board: what a captain may buy this round, what it
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
// private because Orders (./orders) draws the trade board with the same
// generators. They were file private before the split purely because
// everything lived in one file.
// =====================================================================
import { cardLead } from "../cards";
import { ICONS } from "../constants/brand";
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
// The hold's room, read from ./larder rather than from ./hold because the
// quarter a hungry crew takes off the cargo is a rule about hunger and
// lives with the rest of that rule. See cargoRoom there.
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

// [ONLINE] These use a seeded RNG so the market is stable for one
// captain across a reload rather than redrawn on every mount. Each
// captain's seed carries their own id, so no two of them see the same
// charter.
// quantityOverride is only ever set by callBrokersFavor, letting a captain
// choose exactly how much of a filtered good the guaranteed order asks for
// instead of leaving it to the usual randInt roll below.
//
// portOverride is the intel guarantee's own (see startOrders): a Broker's
// Whisper names a harbour as well as a good, and the order it promises has
// to pay at the harbour it named, so the caller that pins the good pins the
// port too rather than leaving it to the usual pick below. Both overrides
// are read the way the filter is, as absent for every other caller, so the
// six ordinary orders and the paths' own errands keep the draw they had.
// What the market may draw from this round: whatever the room's tier has
// unlocked by now (see ./pools). Passed in rather than read from module scope
// so these generators stay pure functions of (rng, pools) and a captain's
// seeded draw depends only on the seed and the charter, never on mutable state.
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

// Deliberately a pure function of rng only. It used to also take `state`
// so it could fold a captain's own revealed Broker's Whisper intel
// straight into whichever order slot it was generating at the time, which
// meant the number of rng() calls this consumed depended on
// that captain's own purchase history. orderRng below is a fixed
// deterministic stream (seeded per captain and per voyage, see the file
// header), so letting the draw depend on mutable intel state made a
// captain's own orders non reproducible: regenerating the draw after a
// reload, with different intel state, silently shifted every order after
// the one the intel touched. See startOrders for where the intel guarantee
// happens now: entirely after, and independent of, this draw.
export function genMixedOrder(
  rng: Rng,
  pools: MarketPools,
): Omit<OrderCard, "id"> {
  return rng() < 0.5 ? genRawOrder(rng, pools) : genProductOrder(rng, pools);
}

// [D2: the nine slot order board] The manifest's pathbound errand: one good,
// named by the draw, priced by whichever generator the good's own kind uses,
// so a pathbound card is a manifest order like any other and differs only in
// that it waits on a path. The good is what decides which path that is (see
// lockingPathFor), so nothing about the path is written here and nothing
// about it needs to be: this function knows no crest and no name.
//
// Drawn from the pooled goods that some path's own order pool claims, which
// is what keeps a locked card a card its path could really fill: the pool is
// the table that path's trade lives in. Drawn from the round's unlocked
// pools rather than from the pool lists themselves, so a pathbound card can
// never demand a good the charter has not opened yet, and drawn with
// replacement, the way the six ordinary orders are: a card is a draw and its
// label is derived, so asking the draw for three different crests would make
// the label an input to it rather than a reading of it.
//
// Null where the round has unlocked nothing any path claims, which no tier
// reaches today (the founding trade alone is three commodities and three
// garments) and which the caller reads as a slot left empty rather than as a
// broken board.
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
//
// [H7: Maroon and the Harbormaster] shift is the other hand on the same
// price, and the two are passed rather than read off the state for the
// reason the header above gives: a captain's draw is a pure function of
// the seed and the charter, so which captain is selling at that port has
// nothing to do with what anything costs. The shift lands on raw goods
// only, which is the same clause the pulse follows and for its own
// reason: a port lean is a hand on that port's market for goods it
// trades, and a finished product's card is priced from its recipe rather
// than from the port it is standing in.
//
// [D5: Aroma: the Bazaar Rumor] rumor is the third hand, keyed by good
// rather than by port, and it is the one of the three that arrives
// already summed: the bazaar's lean is one number per good, worked out
// from the room's rows by rumorLean in ./bazaar and shipped to every
// client on the advance. It is a parameter here for the reason the other
// two are, and it is defaulted for the reason they are: a caller that
// knows nothing about rumors prices the market it has always priced.
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
    // One rounding for all three hands rather than one each, so a port
    // the harbor leaned into and the Harbormaster leaned against is
    // priced the way the net of the two says and not the way either
    // alone rounds. `?? 0` because an absent key is not a nudge of zero
    // until this line makes it one.
    //
    // [D5: Aroma: the Bazaar Rumor] The bazaar's third hand is summed
    // here rather than applied as a second pass, which is the whole of
    // what keeps this one rounding: a rumor folded in after the
    // rounding would be a second rounding, and two markets that
    // differed only in which of the two hands was applied first would
    // price the same card two ways. It is a fraction where the pulse is
    // a percentage and the shift is a multiplier, and the three are one
    // expression because they are one price: the harbor's appetite,
    // the Harbormaster's call and the bazaar's rumor are three
    // accounts of what this good is worth at this port this leg, and a
    // captain is shown the price all three of them make.
    const nudge = (pulse[chosen] ?? 0) + (rumor[chosen] ?? 0);
    if (nudge || lean !== 1) {
      price = Math.max(1, Math.round(price * (1 + nudge) * lean));
    }
    resources.push({ type: chosen, quantity: qty, price });
  }
  const total = resources.reduce((s, r) => s + r.quantity * r.price, 0);
  return { port, resources, totalCost: total, isProductCard: false };
}

// [MANIFEST 01: The Harbor Pulse] What this captain bought this Market,
// summed by raw resource only (Hemp, Silk, Tea), the same set genResourceCard
// prices. Finished product purchase cards (genProductPurchaseCard) don't
// count, the pulse is about the harbor leaning into a raw good, not about who
// bought a finished Sachet. Read once, right before completeMarket clears
// purchasedCards/resourceCards, and relayed to the server (see
// src/lib/use-phase-sync.ts) so it can fold this captain's draw into the
// room wide tally the next round's pulse is built from.
export function tallyPurchasesByResource(
  state: GameState,
): Record<string, number> {
  return tallyCardPurchases(state, state.purchasedCards);
}

// The same sum over a named set of cards rather than over everything the
// captain has bought. One implementation behind both readings, because
// the second caller is a delta: a market a captain's standing orders
// played reports the lots those orders bought, on top of the report that
// already carried whatever they had bought by hand (see
// workStandingOrders in ./standing and the relay in
// src/lib/use-phase-sync.ts). Written out twice, the two would eventually
// price a lot differently and the harbor's pulse would quietly lean on a
// number that was not the goods.
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

// [MANIFEST 01: The Harbor Pulse] Stamps the room wide pulse the server
// computed for this round onto local state, so genResourceCard picks it up
// the moment startMarket runs below. A plain setter kept as its own function,
// the same convention purchaseIntel/receiveLoan/etc already follow, called
// by applyMarketLeans below in the same act() dispatch as every other socket
// driven state change.
function applyHarborPulse(state: GameState, pulse: Record<string, number>) {
  state.harborPulse = pulse;
}

// [H7: Maroon and the Harbormaster] Stamps the Harbormaster's hand onto
// local state, on the same broadcast the pulse above rides and in the same
// act, so the market that is about to be drawn is already leaning when
// genResourceCard runs.
//
// Null is a real value here and not an omission: the power is called once
// a leg or not at all, so the leg a Harbormaster said nothing in has to
// clear the one they called last leg rather than leave it leaning. The
// server sends the answer for every market it opens (see maybeAdvance in
// src/server/realtime/checkpoint.ts), which is what makes that possible.
export function applyPortShift(state: GameState, shift: PortShift | null) {
  state.portShift = shift;
}

// [D5: Aroma: the Bazaar Rumor] Stamps the bazaar's lean onto local
// state, on the same advance the two hands above ride, so the market about
// to be drawn is already leaned when genResourceCard runs. It is a third
// setter rather than a widening of one of the other two because the three
// are three different facts: the pulse is the room's own buying, the shift
// is one captain's call at one port, and the lean is one good moved by
// whoever spoke at the bazaar.
//
// An empty object is a real value here and not an omission, the same
// reading applyPortShift takes of null: the bazaar is silent on most legs,
// so the leg nothing was published has to clear whatever was published
// last leg rather than leave it leaning. The server sends the answer for
// every market it opens, which is what makes that possible.
// Not exported: applyMarketLeans above is the one reader of a lean, and
// the barrel carried this name without an importer behind it until the
// cleanup cycle retired it.
function applyBazaarLean(state: GameState, lean: Record<string, number>) {
  state.bazaarLean = lean;
}

// [D5: Aroma: the Bazaar Rumor] The three hands the advance carries, read
// as one payload rather than as three guesses at the frame's shape.
//
// The client used to reach into the frame itself, twice, for the pulse
// alone (`if (data.harborPulse) act(...)` written at each of the two sites
// an advance can arrive at), and the port shift was never read at either
// of them: the Harbormaster's call was announced to the table and never
// priced, because a field nothing reads is a field nothing notices going
// missing. This shape is what makes the difference visible. Every hand the
// frame can carry is named here, the one function below is the only reader
// of any of them, and a hand added to the frame without a line here is a
// hand the engine never applies, which the suite can now hold.
//
// Every field is optional and each is read for presence rather than for
// truth, because the three clear themselves differently: the pulse and the
// lean clear with an empty object, and the shift clears with null, which is
// a value rather than an absence (see applyPortShift).
export type MarketLeans = {
  harborPulse?: Record<string, number>;
  portShift?: PortShift | null;
  bazaarLean?: Record<string, number>;
};

/**
 * Applies whichever of the market's three hands this frame carried, and
 * nothing for the ones it did not.
 *
 * The absent case is the backward compatible one and it is deliberate: a
 * frame from a server that predates a hand leaves that hand's state alone
 * rather than clearing it, which is the reading every other field on this
 * wire takes. A frame that carries the field is the server telling this
 * client what the market it is about to draw is leaned by, and an empty
 * object in that position is the server saying nothing is.
 */
export function applyMarketLeans(state: GameState, leans: MarketLeans): void {
  if (leans.harborPulse) applyHarborPulse(state, leans.harborPulse);
  if (leans.portShift !== undefined) {
    applyPortShift(state, leans.portShift);
  }
  if (leans.bazaarLean) applyBazaarLean(state, leans.bazaarLean);
}

// [MANIFEST 03: Tidewatch Alerts] Applied on every client in the room the
// instant the server confirms the combined Reputation threshold was crossed
// (see the game:status handler in
// src/server/realtime/wiring/status-heartbeat.ts). A one direction flip:
// nothing in this codebase ever sets tidewatchSurge back to false mid
// voyage, and a fresh voyage already resets it through
// createInitialGameState. Logged once here, at the moment it happens,
// rather than every round afterward in startMarket.
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
  // [C4: three foods, spoilage and the split hold] The hold's size, the
  // one place a purchase is turned away for space. A lot is all or
  // nothing: the card's price is the lot's price, so selling half of one
  // would be a different card and a different price rather than a
  // courtesy. The room is read from ./larder, which is where the quarter
  // a hungry crew takes off the cargo lives, and it is read after the
  // purse rather than before it so a captain short of both hears the
  // message they have always heard.
  const units = card.resources.reduce((n, r) => n + (r.quantity ?? 0), 0);
  const room = cargoRoom(state);
  if (units > room) {
    logs.push(
      `❌ No room in the hold for that lot: it takes ${units} ${units === 1 ? "slot" : "slots"} and ${room} ${room === 1 ? "is" : "are"} free.`,
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
    // The line names the card's one goods line, and a save carrying a
    // product card with an empty line is guarded the way the engine's
    // other taxed line reader guards it: the purchase stands and the
    // line falls back to the plain receipt rather than throwing a read
    // off a line that is not there (the bug audit's finding, closed on
    // every reader of the same shape).
    const r = card.resources[0];
    if (r) {
      logs.push(
        `🛒 Bought Product at ${card.port}: ${ICONS[r.type]}${r.type}×${r.quantity} (@${r.price} Gold/item, Mat Cost ${r.materialCost} Gold), Total ${cost} Gold`,
      );
    } else {
      logs.push(`🛒 Bought Product at ${card.port}, Total ${cost} Gold`);
    }
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

// Named for the phase it opens rather than for its old place in the
// numbering, which the leg dropped in [B1]. See its counterpart
// completeMarket below for the other half of the phase.
export function startMarket(
  state: GameState,
  ctx: GameContext,
  logs: string[],
) {
  state.phase = "market";
  state.purchaseCount = 0;
  state.purchasedCards = [];
  state.marketDemandTags = [];
  // [ONLINE] Deterministic intel pool: this captain's seed, this voyage,
  // this round.
  const intelRng = createRng(
    `${ctx.seedBase}:V${state.voyageEpoch}:R${state.currentRound}:intel`,
  );
  const marketPools = poolsFor(state);
  const allItems = [...marketPools.resources, ...marketPools.products];
  for (let i = 0; i < 5; i++) {
    let t = pick(intelRng, allItems as readonly string[]);
    if (!state.marketDemandTags.includes(t)) state.marketDemandTags.push(t);
  }
  state.revealedIntel = [];
  // Farsight hands over its rumors here rather than at boon selection, since
  // the demand pool above is what they are drawn from and it has only just
  // been rolled. Free in every sense: no fee, and it does not consume the
  // captain's paid Broker's Whisper for the round.
  const freeIntel = state.modifierFlags.free_intel ?? 0;
  for (let i = 0; i < freeIntel; i++) {
    if (!state.marketDemandTags.length) break;
    const idx = Math.floor(Math.random() * state.marketDemandTags.length);
    const item = state.marketDemandTags.splice(idx, 1)[0];
    const openPorts = unlockedPorts(state.difficulty, state.currentRound);
    const port = openPorts[Math.floor(Math.random() * openPorts.length)];
    state.revealedIntel.push({ item, port });
    logs.push(
      `${cardLead("farsight")}: 'Word from ${port}: High demand for ${item}!' (free)`,
    );
  }
  logs.push(`\n⚓=== Round ${state.currentRound} · Market: Port Purchase ===`);
  logs.push(`💰 Current Funds: ${state.money} Gold`);
  // [ONLINE] Deterministic port market: this captain's seed, this
  // voyage, this round.
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
  if (silkRoadCharterOpensOn(state.difficulty, state.currentRound)) {
    logs.push(
      `🗺️ The Silk Road Charter opens! The harbor grows busier: ${tierPurchaseCount} cargo lots and as many buyers from this voyage on.`,
    );
  }
  // [MANIFEST 03: Tidewatch Alerts] Purely additive on top of whatever the
  // difficulty tier already rolls, never a substitute for it. Already
  // announced once, the moment the surge itself triggered (see
  // applyTidewatchSurge), so this stays a quiet +1 every round after that
  // rather than repeating the announcement.
  // [MANIFEST: Great Houses] Vermilion Gate's pledge adds one more cargo lot
  // to this captain's board every round, on top of the tier's own count and
  // the room's Tidewatch surge. Read straight off the per voyage flags
  // rather than folded into the tier count above, so the charter banner goes
  // on reporting what the room earned and never takes credit for the House.
  const houseLot = state.housePerks.vermilionExtraCard ? 1 : 0;
  const purchaseCount =
    tierPurchaseCount + (state.tidewatchSurge ? 1 : 0) + houseLot;
  // [D5: Aroma: the Bazaar Rumor] The bazaar's lean is read here, once,
  // and gated by the switch at the point it is applied. With the feature
  // rolled back the field on state is ignored rather than trusted, so a
  // captain who had a rumor standing when the switch went off prices the
  // market they have always priced: the server stops sending a lean on
  // the same turn (see announceAdvance in
  // src/server/realtime/checkpoint.ts), and this is the other end of that
  // pair. A save loaded with a lean in it does not price one either, for
  // the same reason.
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

export function completeMarket(state: GameState, logs: string[]) {
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
  // This used to end by setting state.phase to the bartering board by name,
  // which was one of seven copies of the phase order scattered across the
  // engine's transitions. Where the purchase phase leads is the lap's
  // business now (see nextPhase in ./lifecycle), and in the experimental mode
  // it leads somewhere else entirely.
}
