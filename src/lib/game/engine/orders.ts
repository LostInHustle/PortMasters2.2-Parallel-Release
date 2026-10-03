// =====================================================================
// Orders, the trade manifest: the orders a captain can fill, what
// filling one actually pays, and the two ways an order can be conjured
// outside the ordinary draw (an Imperial Mandate, or calling in the
// Broker's Favor).
//
// completeOrder is the largest function in the engine and is deliberately
// left whole. Its steps are strictly ordered and the order is the
// behaviour: VAT comes off the original reward before any percentage
// bonus is applied to what remains, freight is charged before the Salvage
// Crane can refund it, and the Broker's commission is taken last of all.
// A past bug came from reordering exactly this sequence and paying every
// crane refund out twice, which is why the cost ledger true up in the
// middle carries the comment it does. Splitting it into tidy helpers
// would make that ordering implicit rather than obvious, so it stays as
// one readable top to bottom settlement.
//
// The order generators come from ./market: Market and Orders draw from
// the same seeded deck, so there is exactly one implementation of them.
//
// [D2: the nine slot order board] Three of the cards this module deals wait
// on a path. Nothing about them lives on the card beyond one marker
// (isPathOrder), because which path a card waits on is read from the good it
// demands (see pathOrderOf below), the same way the board derives the crest
// and the lock line it prints.
// =====================================================================
import { cardLead, cargoCarriesTag, carriesTag } from "../cards";
import { ICONS } from "../constants/brand";
import { PRODUCTS, RESOURCES } from "../constants/goods";
import { PATH_ORDER_SLOTS } from "../constants/paths";
import {
  BROKERS_FAVOR_UNLOCK_LEVEL,
  WORD_ON_THE_DOCKS_REWARD,
  WORD_ON_THE_DOCKS_THRESHOLD,
} from "../constants/world";
import { AUDIT_WINDOW } from "../audit";
import {
  MANDATE_TEMPLATES,
  difficultyConfig,
  mandateIndexFor,
  marketCountsFor,
} from "../difficulty";
import { pathOrdersOn } from "../flags";
import { lockingPathFor, pathLockLine, type PathId } from "../paths";
import {
  isCharterGood,
  isTier1CharterProduct,
  isTier2CharterProduct,
  unlockedPorts,
} from "../pools";
import { createRng, type Rng } from "../rng";
import type { GameContext, GameState, OrderCard } from "../types";
import { hasModule } from "./core";
import {
  opportunistLine,
  opportunistMayBorrow,
  opportunistPayout,
} from "./opportunist";
import {
  genMixedOrder,
  genPathOrder,
  genProductOrder,
  genRawOrder,
  poolsFor,
} from "./market";
import {
  brokersFavorCommission,
  calcTransportCost,
  calcVAT,
  getIntelCost,
} from "./pricing";

// The hold's own guard on an order, as one function rather than a loop
// written at every caller. There are two callers now: an order a captain
// presses, and an order a captain's standing orders press for them (see
// [B3] workStandingOrders in ./standing). The second one has to judge the
// board before it acts, and a second copy of this rule is exactly how a
// captain's orders would come to fill an order their own hands could not.
//
// It answers with the good that is short rather than a bare boolean,
// because the refusal below is worth saying out loud and naming the good
// is the whole of what makes it useful. canFillOrder is the same answer
// read as a yes or no, and stays the module's own reading rather than
// being lifted out of it: nothing outside this file needs to know which
// good was short, only whether the hold covers the order.
function orderShortfall(
  state: GameState,
  order: OrderCard,
): OrderCard["resources"][number] | null {
  for (const r of order.resources) {
    if ((state.inventory[r.type] || 0) < (r.required ?? 0)) return r;
  }
  return null;
}

/**
 * Which path posts an order, or null where none does. [D2: the nine slot
 * order board]
 *
 * The answer is read from the good the order demands, never from the card,
 * which is the plan's own instruction for this feature: a card's lock reason
 * is computed from the path configuration rather than written onto the card,
 * so retuning a pool moves the labels with it. It is also what keeps an
 * ordinary order ordinary: a card the draw happened to deal against a pooled
 * good carries no marker and is no path's locked order (see genMixedOrder in
 * ./market, which writes no marker).
 *
 * The switch is read here as well as at the draw, and that is the rollback
 * clause held at both ends: with path orders off, no card is a path's order,
 * so a board dealt while the feature was on plays on as six ordinary orders
 * rather than as a table where three cards stay grey forever.
 */
export function pathOrderOf(order: OrderCard, mode: unknown): PathId | null {
  if (!order.isPathOrder || !pathOrdersOn(mode)) return null;
  return lockingPathFor(order.resources[0]?.type ?? "");
}

/**
 * The path a card waits on for this captain, or null where the card is
 * theirs to fill. The board reads it to grey a card out and print the lock
 * line; the two fill guards below read it to refuse one.
 *
 * A pathless captain is locked out of every pathbound card, and every
 * captain is pathless until D7's draft deals one. The lock teaches by being
 * true rather than by being staged, so it holds for a captain who has not
 * drawn as firmly as for one who drew somebody else's path.
 */
export function lockedBehind(
  state: GameState,
  order: OrderCard,
): PathId | null {
  const path = pathOrderOf(order, state.mode);
  return path === null || path === state.path ? null : path;
}

// The board's guard, read as a yes or no: the hold covers the order and the
// order is not locked behind a path. Both halves live in one function
// because both callers (a captain's press and a standing order's) have to
// ask the same question, and a caller that read only half of it is exactly
// how a standing order would come to fill a card its own captain could not.
//
// [D6: Free Captain: Opportunist] The borrow is a third half, and it is the
// one that is asked rather than assumed: `borrow` names whether the caller
// is spending the Free Captain's once a voyage ability on this card, and it
// defaults to false so every existing caller (a standing order, the
// suggester, a plain press) keeps its reading and no policy surface can
// spend an ability its captain did not choose. The ability itself is asked
// in ./opportunist, which is where the allowance lives; this function only
// says what the board is allowed to offer.
export function canFillOrder(
  state: GameState,
  order: OrderCard,
  borrow = false,
): boolean {
  if (orderShortfall(state, order) !== null) return false;
  const locked = lockedBehind(state, order);
  if (locked === null) return true;
  return borrow && opportunistMayBorrow(state, locked);
}

/**
 * How many orders on this board are this captain's to fill: the board minus
 * the cards locked behind a path they do not hold.
 *
 * [D2] One reader for the leg report's dealt count (see use-leg-report, and
 * the expired orders reading built on it in docs/OCEAN_GAMBIT_AGILE_PLAN.md):
 * a locked card is not an order this captain failed to fill, and counting it
 * as one would charge every captain three expired orders a leg for a feature
 * none of them can touch until the draft that deals a path lands.
 */
export function openOrderCount(state: GameState): number {
  return state.customerCards.filter((o) => lockedBehind(state, o) === null)
    .length;
}

export function completeOrder(
  state: GameState,
  orderId: number,
  logs: string[],
  borrow = false,
) {
  const order = state.customerCards.find((o) => o.id === orderId);
  if (!order) return;
  if (state.completedOrders.includes(order.id)) return;
  // The lock is asked before the hold, and the order of the two matters: a
  // locked card whose goods the captain happens to be carrying is still not
  // theirs to fill, and telling them their inventory is short would be the
  // wrong sentence about the right refusal. The line is pathLockLine's, the
  // same string the board prints on the card, so the ledger and the board
  // cannot come to describe one refusal two ways.
  //
  // [D6: Free Captain: Opportunist] A locked card is fillable by exactly one
  // caller: a Free Captain who passed `borrow` and still has the allowance
  // (see canFillOrder, which is what the board offers this through, and
  // ./opportunist, which owns the allowance). The parameter defaults to
  // false, so a refusal that arrives from anywhere else is the flat one.
  const locked = lockedBehind(state, order);
  if (locked && !(borrow && opportunistMayBorrow(state, locked))) {
    logs.push(`❌ ${pathLockLine(locked)}`);
    return;
  }
  const short = orderShortfall(state, order);
  if (short) {
    logs.push(`❌ Inventory short! Need ${short.type}×${short.required}`);
    return;
  }
  // Silk, and everything made from it, read off the woven tag rather than a
  // list written out here. The list this replaces had gone stale against
  // the recipe table: it named Cotton Clothes, which uses one Silk, and
  // missed Foreign Balm and Pearl String, which use one Silk each too.
  //
  // [F2: the card record, and the mode weighting field] The tag is the
  // vocabulary the two cards that read this now speak: the Woven Monopoly
  // module (which waives the freight) and Weaver's Winds (which halves it)
  // both say woven in their text, so the class of goods they cover is the
  // class the good carries rather than a second list that has to be kept
  // beside them.
  const hasWoven = cargoCarriesTag(order.resources, "woven");
  let transport = calcTransportCost(state, order.totalItems, hasWoven);
  for (const r of order.resources) state.inventory[r.type] -= r.required!;
  let reward = order.reward;
  // [D6: Free Captain: Opportunist] The borrow's penalty lands here, on the
  // face value and before anything else touches the number, so every step
  // below (product VAT, the charter percentages, the Woven Monopoly) scales
  // the reduced payout rather than the card's advertised one. That is the
  // order the plan's own price implies: a captain who borrowed the order is
  // paid the borrowed order's reward, and a percentage bonus read off the
  // unreduced face value would quietly refund part of the penalty.
  //
  // The spend sits at the same line as the payout, which is safe because
  // every guard above has already passed and nothing below can refuse: an
  // order that reaches this point is filled. A reload between the press and
  // the broadcast is covered by the completedOrders guard at the top, so the
  // allowance cannot be spent twice for one fill.
  if (locked) {
    state.opportunistBorrows += 1;
    reward = opportunistPayout(order.reward);
    logs.push(opportunistLine(order.reward, reward));
  }
  let totalVat = 0;
  if (order.isProductOrder) {
    const product = order.resources[0].type;
    const unitVat = calcVAT(
      state,
      product,
      reward / order.resources[0].required!,
    );
    totalVat = unitVat * order.resources[0].required!;
    reward -= totalVat;
    state.vatPaid += totalVat;
    logs.push(`🧾 Product Sales VAT: ${totalVat} Gold`);
  }
  // Fleet of Treasures discount applied before money moves, so the captain
  // is never charged the pre discount freight.
  //
  // [F2] The two goods it named are the luxury tag now, which is the class
  // its own text promises, and the per unit number is the card's: it stays
  // here because a module's payload is the hull's own arithmetic in this
  // build (see CardEffect in ../constants/cards), so F2 moves the card's
  // name and its scope into the record and leaves the numbers it applies to
  // the engine that applies them.
  if (hasModule(state, "fleet_of_treasures")) {
    const luxuryItems = order.resources
      .filter((r) => carriesTag("good", r.type, "luxury"))
      .reduce((s, r) => s + (r.required ?? 0), 0);
    if (luxuryItems > 0) {
      transport = Math.max(0, transport - luxuryItems * 3);
      logs.push(
        `${cardLead("fleet_of_treasures")}: ${luxuryItems * 3}g off freight`,
      );
    }
  }
  state.money -= transport;
  state.roundCosts += transport;
  state.totalCosts += transport;
  const origTransport = transport;
  if (hasModule(state, "silk_monopoly") && hasWoven) {
    reward = Math.floor(reward * 1.2);
    logs.push(`${cardLead("silk_monopoly")}: +20% Reward!`);
  }
  // Charter lane payouts: the Kiln and Forge Guild boon and the Maritime
  // Bureau Token both reward trading the goods a charter opened, so they only
  // look at orders that actually involve them (see isCharterGood).
  //
  // [F2] These three reads are the one place in the engine F1's rule does
  // not reach, and the reason is that they are not about what a good is but
  // about when it arrived: a charter good is a good the voyage's schedule
  // opened, and which wave opened it is the tier's fact rather than the
  // good's. There is no tag for "arrived with the second charter" and there
  // should not be one, because a tag that means a schedule would be the same
  // good tagged differently in two rooms. So the cards name their scope in
  // their text (the first charter's goods, the second charter's) and the
  // scope is read here off the pool the schedule unlocks.
  const hasCharterGood = order.resources.some((r) => isCharterGood(r.type));
  // Each charter boon asks about its own wave, not the charter as a whole.
  // The Bureau Token above keeps the any wave test, which is what its text
  // promises: it names charter goods without naming a tier.
  const hasTier1Good = order.resources.some((r) =>
    isTier1CharterProduct(r.type),
  );
  const hasTier2Good = order.resources.some((r) =>
    isTier2CharterProduct(r.type),
  );
  // Added as `reward + floor(reward * pct)` rather than `floor(reward * (1 +
  // pct))`: the latter loses a coin to floating point on common rates (100 *
  // 1.15 is 114.999... in binary), so a stated 15% quietly paid 14%.
  if (hasTier1Good && state.modifierFlags.charter_order_bonus) {
    const pct = state.modifierFlags.charter_order_bonus;
    reward += Math.floor(reward * pct);
    logs.push(
      `${cardLead("kiln_and_forge_guild")}: +${Math.round(pct * 100)}% Reward!`,
    );
  }
  if (hasCharterGood && hasModule(state, "bureau_token")) {
    reward += Math.floor(reward * 0.1);
    logs.push(`${cardLead("bureau_token")}: +10% Reward!`);
  }
  if (hasTier2Good && state.modifierFlags.exotic_order_bonus) {
    const pct = state.modifierFlags.exotic_order_bonus;
    reward += Math.floor(reward * pct);
    logs.push(
      `${cardLead("exotic_treasures")}: +${Math.round(pct * 100)}% Reward!`,
    );
  }
  if (hasModule(state, "salvage_crane") && Math.random() < 0.3) {
    state.money += transport;
    logs.push(
      `${cardLead("salvage_crane")}: Refunded ${transport} Gold transport!`,
    );
    transport = 0;
  }
  if (hasModule(state, "tax_evasion") && Math.random() < 0.15) {
    state.money -= 20;
    logs.push(`🚨 AUDIT! ${cardLead("tax_evasion")} triggered. Lost 20 Gold!`);
  }
  if (transport !== origTransport) {
    // Only the Salvage Crane above can move `transport`, and it has already
    // handed the Gold back. This trues up the cost ledger so the round's
    // freight total reflects the refund; it used to credit state.money a
    // second time here as well, paying every crane refund out twice.
    const diff = origTransport - transport;
    state.roundCosts -= diff;
    state.totalCosts -= diff;
  }
  // Broker's Favor commission: the Broker takes a cut of the order's
  // reward (see brokersFavorCommission), so the captain's own money,
  // revenue, and score all reflect the amount net of the commission.
  if (order.isBrokerFavor) {
    const commission = brokersFavorCommission(order.reward);
    reward -= commission;
    const pct =
      order.reward > 0 ? Math.round((commission / order.reward) * 100) : 0;
    logs.push(`🤝 Broker's Commission (${pct}%): ${commission} Gold`);
  }
  state.money += reward;
  state.roundRevenue += reward;
  state.totalRevenue += reward;
  state.score += Math.floor(reward - transport);
  state.completedOrders.push(order.id);
  state.orderCount++;
  state.totalOrdersCompleted++;
  // [H6: the Manifest Audit] The line an audit may later read, written here
  // because this is the only moment the facts exist: which order, which
  // goods went into it and what it actually paid are all locals that the
  // settlement above has finished adjusting. The reward recorded is the one
  // that was credited rather than the card's face value, so a manifest line
  // shows what the order was worth to the captain after every modifier,
  // which is the same number the log line below prints.
  //
  // Trimmed on every push rather than only when the audit reads it, so the
  // save itself stays the size the sample expects and a long voyage does
  // not quietly accumulate an archive of every order its captain ever
  // filled.
  state.orderFills.push({
    round: state.currentRound,
    port: order.demandPort,
    items: order.resources.map((r) => ({ type: r.type, qty: r.required! })),
    reward,
  });
  state.orderFills = state.orderFills.slice(-AUDIT_WINDOW);
  const txt = order.resources
    .map((r) => `${ICONS[r.type]}${r.type}×${r.required}`)
    .join(" + ");
  logs.push(`📦 Completed Order at ${order.demandPort}: ${txt}`);
  logs.push(
    `   💰 Reward: ${reward} Gold · ⚓ Freight: ${transport} Gold = 📊 Net Profit: ${reward - transport} Gold`,
  );
  logs.push(`📊 Completed ${state.orderCount} transactions`);
  // [MANIFEST 02: Word on the Docks] Fires exactly once per voyage, the
  // instant this captain's own running total crosses the threshold, whether
  // or not they actually turn out to be first in the room. The React layer
  // (see GameRoom.tsx) relays this as a claim to the server, which is the
  // one place that actually knows whether anyone else beat them to it.
  if (state.totalOrdersCompleted === WORD_ON_THE_DOCKS_THRESHOLD) {
    state._pendingDocksClaim = { total: state.totalOrdersCompleted };
  }
}

// [MANIFEST 02: Word on the Docks] Applied only on the one client the
// server confirmed actually won the race (see the docks:won listener in
// GameRoom.tsx); every other client that also crossed the threshold just
// never receives this call, so a losing claim costs nothing and needs no
// rollback.
export function claimWordOnTheDocksReward(state: GameState, logs: string[]) {
  state.money += WORD_ON_THE_DOCKS_REWARD;
  logs.push(
    `📣 Word on the Docks: you were first to complete ${WORD_ON_THE_DOCKS_THRESHOLD} trade orders this voyage! +${WORD_ON_THE_DOCKS_REWARD} Gold`,
  );
}

// Broker's Favor: the Renown gated, once per voyage skill (see the flag on
// GameState and BROKERS_FAVOR_UNLOCK_LEVEL). Appends one extra standard trade
// order for a chosen quantity of a good this captain is currently holding,
// so a hold full of otherwise unsellable stock still has a guaranteed buyer.
// Like the paid Broker's Whisper guarantee in startOrders, it draws with
// this captain's own Math.random and only appends to their own
// customerCards, so it can never shift the shared, room wide market anyone
// else sees. Quantity is capped at the captain's own hold rather than the
// usual one to three or two to five order range, since
// brokersFavorCommission (see
// completeOrder) is what keeps an oversized ask from paying out too much,
// not a quantity limit.
export function callBrokersFavor(
  state: GameState,
  item: string,
  quantity: number,
  logs: string[],
) {
  if (state.phase !== "orders") return;
  if (state.renownLevel < BROKERS_FAVOR_UNLOCK_LEVEL) {
    logs.push(
      `❌ Broker's Favor unlocks at Renown Level ${BROKERS_FAVOR_UNLOCK_LEVEL}`,
    );
    return;
  }
  if (state.brokersFavorUsed) {
    logs.push("❌ You've already called in a Broker's Favor this voyage");
    return;
  }
  const isRaw = (RESOURCES as readonly string[]).includes(item);
  const isProduct = (PRODUCTS as readonly string[]).includes(item);
  if (!isRaw && !isProduct) {
    logs.push(`❌ The Broker can't find a buyer for ${item}`);
    return;
  }
  const held = state.inventory[item] || 0;
  if (held <= 0) {
    logs.push(`❌ You have no ${item} in the hold for the Broker to sell`);
    return;
  }
  const qty = Math.floor(quantity);
  if (!Number.isFinite(qty) || qty < 1 || qty > held) {
    logs.push(`❌ Choose between 1 and ${held} ${item} for the Broker to sell`);
    return;
  }
  const localRng: Rng = Math.random;
  const order = isRaw
    ? genRawOrder(localRng, poolsFor(state), item, qty)
    : genProductOrder(localRng, poolsFor(state), item, qty);
  const nextId =
    state.customerCards.reduce((m, c) => Math.max(m, c.id), -1) + 1;
  state.customerCards.push({ id: nextId, ...order, isBrokerFavor: true });
  state.brokersFavorUsed = true;
  const txt = order.resources
    .map((r) => `${ICONS[r.type]}${r.type}×${r.required}`)
    .join(" + ");
  logs.push(
    `🤝 Broker's Favor called in: a buyer at ${order.demandPort} now wants ${txt}. The bigger the ask, the bigger the Broker's cut.`,
  );
}

export function purchaseIntel(state: GameState, logs: string[]) {
  if (!state.phase2DemandTags.length) {
    logs.push("🔮 The Broker has no more whispers...");
    return;
  }
  const cost = getIntelCost(state);
  if (state.money < cost) {
    logs.push(`❌ Need ${cost} Gold for a rumor`);
    return;
  }
  // Ocean Interpreter adds a rumor that is genuinely free: only the paid
  // reveals below deduct the fee, so the extra one costs nothing.
  const paidCount = hasModule(state, "brokers_network") ? 2 : 1;
  const count = paidCount + (hasModule(state, "ocean_relay") ? 1 : 0);
  for (let i = 0; i < count; i++) {
    if (!state.phase2DemandTags.length) break;
    const item =
      state.phase2DemandTags[
        Math.floor(Math.random() * state.phase2DemandTags.length)
      ];
    state.phase2DemandTags.splice(state.phase2DemandTags.indexOf(item), 1);
    const openPorts = unlockedPorts(state.difficulty, state.currentRound);
    const port = openPorts[Math.floor(Math.random() * openPorts.length)];
    state.revealedIntel.push({ item, port });
    logs.push(
      `🗣️ Broker's Whisper: 'Word from ${port}: High demand for ${item}!'`,
    );
    if (i < paidCount) state.money -= cost;
    // [DIFFICULTY] Corrupt broker (Monsoon only). The rumor above is always
    // delivered and always true, on every tier: the intel guarantee is never
    // touched. What a corrupt broker does instead is also sell word of this
    // hold to the pirates, raising the round's raid chance once. Announced
    // plainly here rather than hidden, so the captain can price the risk.
    const cfg = difficultyConfig(state.difficulty);
    if (
      cfg.brokerCorruption &&
      !state.brokerTippedPirates &&
      Math.random() < cfg.brokerCorruptionChance
    ) {
      state.brokerTippedPirates = true;
      logs.push(
        `🕵️ That broker was corrupt. The word is good, but your position leaked: raid risk is up ${Math.round(cfg.brokerCorruptionRisk * 100)} points this round.`,
      );
    }
  }
}

export function startOrders(
  state: GameState,
  ctx: GameContext,
  logs: string[],
) {
  state.phase = "orders";
  state.orderCount = 0;
  state.completedOrders = [];
  logs.push(
    `\n🤝=== Round ${state.currentRound} · Orders: Trade Transaction ===`,
  );
  // [ONLINE] Deterministic trade orders: this captain's seed, this voyage,
  // this round. The loop below reads nothing captain specific, so what
  // differs between two captains at the same table is the seed and nothing
  // else, which is what keeps a reload from dealing a fresh hand.
  const orderRng = createRng(
    `${ctx.seedBase}:V${state.voyageEpoch}:R${state.currentRound}:orders`,
  );
  state.customerCards = [];
  const orderPools = poolsFor(state);
  // [DIFFICULTY] Same widening as the port market above, applied to the trade
  // board, so both boards grow together as a tier's charter opens.
  const orderCount = marketCountsFor(
    state.difficulty,
    state.currentRound,
  ).order;
  for (let i = 0; i < orderCount; i++) {
    state.customerCards.push({ id: i, ...genMixedOrder(orderRng, orderPools) });
  }
  const extraOrders = state.modifierFlags.extra_order ?? 0;
  for (let i = 0; i < extraOrders; i++) {
    const nextId = orderCount + i;
    state.customerCards.push({
      id: nextId,
      ...genMixedOrder(orderRng, orderPools),
    });
    logs.push(`${cardLead("merchants_converge")}: One extra order appeared.`);
  }
  // Broker's Whisper guarantee, applied after the seeded draw above and
  // entirely with this captain's own randomness, so it cannot shift the
  // drawn stream that produced the board. One order slot is overwritten per
  // rumor this captain has revealed and not yet cashed in this round
  // (see purchaseIntel), up to however many revealed items and order
  // slots there are; previously a single `intelOrderUsed` flag capped
  // this at one guarantee per round no matter how many rumors a captain
  // had revealed (Broker's Network reveals two per purchase), so the
  // second rumor's "guaranteed" order silently never appeared.
  const guaranteedCount = Math.min(
    state.revealedIntel.length,
    state.customerCards.length,
  );
  for (let i = 0; i < guaranteedCount; i++) {
    const intel = state.revealedIntel[i];
    const localRng: Rng = Math.random;
    const guaranteed = (RESOURCES as readonly string[]).includes(intel.item)
      ? genRawOrder(localRng, orderPools, intel.item)
      : genProductOrder(localRng, orderPools, intel.item);
    state.customerCards[i] = { id: state.customerCards[i].id, ...guaranteed };
  }
  // [DIFFICULTY] Imperial mandate: on the rounds this tier schedules one, the
  // Emperor commissions a single large order. Fixed template data with no rng,
  // appended after the seeded draw, so it shifts nobody's stream, and the same
  // template for everyone on that round, since the tier and round it reads are
  // the room's rather than this captain's. Flagged isProductOrder: false, since
  // an imperial levy is never charged VAT.
  const mandateIdx = mandateIndexFor(state.difficulty, state.currentRound);
  const mandate =
    mandateIdx === undefined ? undefined : MANDATE_TEMPLATES[mandateIdx];
  if (mandate) {
    const nextId =
      state.customerCards.reduce((m, c) => Math.max(m, c.id), -1) + 1;
    // Placed first rather than appended. It is the round's headline commission
    // and should read that way regardless of how wide the charter has grown
    // the board. Inserted after the intel guarantee loop above, which writes
    // by index, so it cannot be overwritten; card identity stays on `id`, so
    // position carries presentation only and no logic depends on it.
    state.customerCards.unshift({
      id: nextId,
      demandPort: mandate.port,
      resources: mandate.resources.map((r) => ({
        type: r.type,
        required: r.required,
      })),
      reward: mandate.reward,
      totalItems: mandate.resources.reduce((s, r) => s + r.required, 0),
      isProductOrder: false,
      isMandate: true,
    });
    const need = mandate.resources
      .map((r) => `${ICONS[r.type]}${r.type}×${r.required}`)
      .join(" + ");
    logs.push(
      `📜 Imperial Mandate at ${mandate.port}: ${need} for ${mandate.reward} Gold. The Emperor's commission is exempt from VAT.`,
    );
  }
  // [D2: the nine slot order board] The pathbound slots, filled last and
  // drawn from a stream of their own (`:pathorders` rather than `:orders`),
  // for the reason the intel guarantee above is applied after the seeded
  // draw rather than inside it: the six the tier schedules have to stay the
  // same six, seed for seed, so a table playing with the switch off is dealt
  // exactly the board it was dealt before this feature existed. Appended
  // rather than inserted, for the same reason and for one more: the mandate
  // reads as the round's headline, and the tier's own orders keep the
  // positions they have always held on the board.
  //
  // These cards are the board's invitation rather than its tax: each one
  // names a good the path's trade lives in and pays what that trade pays, so
  // a captain can see the whole of what holding the path would open without
  // a panel explaining it.
  if (pathOrdersOn(state.mode)) {
    const pathOrderRng = createRng(
      `${ctx.seedBase}:V${state.voyageEpoch}:R${state.currentRound}:pathorders`,
    );
    for (let i = 0; i < PATH_ORDER_SLOTS; i++) {
      const order = genPathOrder(pathOrderRng, orderPools);
      if (!order) break;
      const nextId =
        state.customerCards.reduce((m, c) => Math.max(m, c.id), -1) + 1;
      state.customerCards.push({ id: nextId, ...order });
    }
  }
}
