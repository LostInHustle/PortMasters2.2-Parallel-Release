// Orders: the cards a captain can fill, what filling one pays, and the two
// ways an order can be conjured outside the ordinary draw (an Imperial
// Mandate or a Broker's Favor).
//
// completeOrder is deliberately left whole. Its steps are strictly ordered:
// VAT comes off the original reward before percentage bonuses apply,
// freight is charged before the Salvage Crane can refund it, and the
// Broker's commission is taken last. Splitting that into helpers would make
// the ordering implicit. quoteOrder runs the same chain for every surface
// that prices an order.
//
// The order generators come from ./market, so Market and Orders draw from
// one seeded deck.
import { cardLead, cargoCarriesTag } from "../cards";
import { ICONS } from "../constants/brand";
import { joined, line, type LedgerLine } from "@/lib/game/ledger";
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
import { lockingPathFor, pathLockLedgerLine, type PathId } from "../paths";
import {
  isCharterGood,
  isTier1CharterGood,
  isTier2CharterGood,
} from "../pools";
import { createRng, type Rng } from "../rng";
import type { GameContext, GameState, OrderCard } from "../types";
import { hasModule } from "./core";
import {
  opportunistLedgerLine,
  opportunistMayBorrow,
  opportunistPayout,
} from "./opportunist";
import {
  genMixedOrder,
  genPathOrder,
  genProductOrder,
  genRawOrder,
  poolsFor,
  revealRumor,
} from "./market";
import { queueMilestoneMoment } from "./milestones";
import {
  brokersFavorCommission,
  calcTransportCost,
  cargoUnitsWithAllTags,
  cargoUnitsWithTag,
  explainVAT,
  fleetOfTreasuresUnits,
  getIntelCost,
  type PriceBreakdown,
} from "./pricing";

// The hold's guard on an order, shared by a captain's press and a standing
// order's press (see workStandingOrders in ./standing). Returning the short
// good rather than a boolean lets the refusal name what is missing.
// canFillOrder reads this same answer as a yes or no.
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
 * The next free id on the board: one past the highest card, or 0 when the
 * board is empty. The seeded draw in startOrders mints its own contiguous
 * run instead, since it deals a fresh board.
 */
function nextCardId(state: GameState): number {
  return state.customerCards.reduce((m, c) => Math.max(m, c.id), -1) + 1;
}

/**
 * Which path posts an order, or null. The answer comes from the good the
 * order demands rather than from a marker on the card, so retuning a pool
 * moves the locks with it. The mode switch is read here as well as at the
 * draw: with path orders off, a board dealt while the feature was on plays
 * as six ordinary orders instead of leaving three cards locked forever.
 */
export function pathOrderOf(order: OrderCard, mode: unknown): PathId | null {
  if (!order.isPathOrder || !pathOrdersOn(mode)) return null;
  return lockingPathFor(order.resources[0]?.type ?? "");
}

/**
 * The path a card is locked behind for this captain, or null if the card is
 * theirs to fill. A pathless captain is locked out of every pathbound card.
 */
export function lockedBehind(
  state: GameState,
  order: OrderCard,
): PathId | null {
  const path = pathOrderOf(order, state.mode);
  return path === null || path === state.path ? null : path;
}

// The board's yes or no: the hold covers the order and the order is not
// locked behind another path. `borrow` says the caller is spending the Free
// Captain's once per voyage ability on this card; it defaults to false so no
// policy surface can spend an ability its captain did not choose. The
// allowance itself lives in ./opportunist.
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
 * the cards locked behind a path they do not hold. Counting a locked card as
 * expired would charge a captain for a feature they cannot touch yet.
 */
export function openOrderCount(state: GameState): number {
  return state.customerCards.filter((o) => lockedBehind(state, o) === null)
    .length;
}

// One step of the reward chain below, as the settlement log and any
// itemized uplift read it.
type OrderRewardStep = { cardId: string; pct: number; amount: number };

// The percentage bonuses a completed order's reward carries, read as one
// chain so a quoted number and a credited number cannot drift apart.
//
// The order matters: Woven Monopoly first, then the first charter's boon,
// the Maritime Bureau Token, the second charter's boon, the path quarter,
// and the two voyage long charters last, because those scale the reward the
// voyage has built rather than the face value.
//
// Each arm pays reward + floor(reward * pct) rather than
// floor(reward * (1 + pct)): the latter loses a coin to floating point on
// common rates such as 15%. The Woven Monopoly keeps its own
// floor(reward * 1.2), the arithmetic it has always applied. The input is
// the reward after VAT, which is what each arm scales in turn.
export function orderRewardBonusSteps(
  state: GameState,
  order: OrderCard,
  rewardIn: number,
): { reward: number; steps: OrderRewardStep[] } {
  let reward = rewardIn;
  const steps: OrderRewardStep[] = [];
  // Each arm floors its uplift off the running reward, adds it, and records
  // the percentage as the whole number the log prints.
  const pay = (cardId: string, pct: number) => {
    const amount = Math.floor(reward * pct);
    reward += amount;
    steps.push({ cardId, pct: Math.round(pct * 100), amount });
  };
  const hasCharterGood = order.resources.some((r) => isCharterGood(r.type));
  // A charter good is one the voyage's schedule opened, so its wave is a
  // fact about arrival rather than about the good. Each charter boon asks
  // about its own wave; the Bureau Token keeps the any wave test its text
  // promises.
  const hasTier1Good = order.resources.some((r) => isTier1CharterGood(r.type));
  const hasTier2Good = order.resources.some((r) => isTier2CharterGood(r.type));
  const hasWoven = cargoCarriesTag(order.resources, "woven");
  // Route Mastery pays a quarter more on orders that follow the captain's
  // own path.
  const followsPath =
    state.path !== null && pathOrderOf(order, state.mode) === state.path;
  if (hasModule(state, "silk_monopoly") && hasWoven) {
    const next = Math.floor(reward * 1.2);
    steps.push({ cardId: "silk_monopoly", pct: 20, amount: next - reward });
    reward = next;
  }
  if (hasTier1Good && state.modifierFlags.charter_order_bonus)
    pay("kiln_and_forge_guild", state.modifierFlags.charter_order_bonus);
  if (hasCharterGood && hasModule(state, "bureau_token"))
    pay("bureau_token", 0.1);
  if (hasTier2Good && state.modifierFlags.exotic_order_bonus)
    pay("exotic_treasures", state.modifierFlags.exotic_order_bonus);
  if (followsPath && state.modifierFlags.route_mastery)
    pay("route_mastery", state.modifierFlags.route_mastery);
  // The two voyage long charters land last and scale the reward the voyage
  // has built. The Quality Mark reads the same woven gate as the Woven
  // Monopoly, so the two cannot disagree about what counts as woven.
  if (state.modifierFlags.manifest_order_bonus)
    pay("standing_manifest", state.modifierFlags.manifest_order_bonus);
  if (hasWoven && state.modifierFlags.loom_sale_bonus)
    pay("quality_mark", state.modifierFlags.loom_sale_bonus);
  return { reward, steps };
}

/**
 * One order's money as the settlement reads it: the pieces the reward is
 * made of, the reward itself, and what the run costs to carry the goods.
 */
type OrderQuote = {
  /** The card's face value, or the payout a borrow would pay. */
  basis: number;
  /** VAT taken off the basis before any bonus applies. */
  vat: number;
  /** VAT per unit for the tooltip; null when the order sells nothing. */
  vatBreakdown: PriceBreakdown | null;
  /** Percentage bonus steps, one per arm that paid. */
  bonusSteps: OrderRewardStep[];
  /** The Broker's commission, taken last, on the face value. */
  commission: number;
  /** The commission as a share of the face value, as the ledger prints it. */
  commissionPct: number;
  /** Basis less VAT plus bonuses less commission. */
  reward: number;
  /** What the run costs to carry the goods. */
  freight: number;
  /** Reward less freight, before the crane refund or audit roll. */
  net: number;
};

/**
 * What an order pays, through the one chain the settlement runs. Every
 * surface that prices an order reads this.
 *
 * The order of steps is the rule: the borrow penalty first, so every step
 * below scales the reduced payout; VAT per unit off what is left; the
 * percentage bonuses, each scaling the running reward; the Broker's
 * commission last and on the card's face value; and freight outside the
 * reward because the Salvage Crane can refund it.
 *
 * The crane refund and the Tax Evasion audit are rolls at the fill, so no
 * quote can carry them: the net here is the net before either.
 */
export function quoteOrder(
  state: GameState,
  order: OrderCard,
  options: { borrowed?: boolean } = {},
): OrderQuote {
  const basis = options.borrowed
    ? opportunistPayout(state, order.reward)
    : order.reward;
  // Only a line that actually sells something is taxed: no resource line or
  // no count means no VAT, rather than a NaN payout in the ledger.
  const productRef = order.isProductOrder ? order.resources[0] : undefined;
  const productUnits = productRef?.required ?? 0;
  let vat = 0;
  let vatBreakdown: PriceBreakdown | null = null;
  if (productRef && productUnits > 0) {
    vatBreakdown = explainVAT(state, productRef.type, basis / productUnits);
    vat = vatBreakdown.final * productUnits;
  }
  const chain = orderRewardBonusSteps(state, order, basis - vat);
  // The commission is a share of the card's face value, not of what the
  // chain left: a borrowed order pays less but the Broker still takes his
  // cut of the advertised reward.
  const commission = order.isBrokerFavor
    ? brokersFavorCommission(order.reward)
    : 0;
  const commissionPct =
    order.reward > 0 ? Math.round((commission / order.reward) * 100) : 0;
  const reward = chain.reward - commission;
  // The woven count, not a yes or no: the freight rungs take only these
  // units' share, so one woven line cannot halve the cargo beside it.
  const wovenUnits = cargoUnitsWithTag(order.resources, "woven");
  const freight = calcTransportCost(
    state,
    order.totalItems,
    wovenUnits,
    fleetOfTreasuresUnits(state, order.resources),
    cargoUnitsWithAllTags(order.resources, "woven", "luxury"),
  );
  return {
    basis,
    vat,
    vatBreakdown,
    bonusSteps: chain.steps,
    commission,
    commissionPct,
    reward,
    freight,
    net: reward - freight,
  };
}

export function completeOrder(
  state: GameState,
  orderId: number,
  logs: LedgerLine[],
  borrow = false,
) {
  const order = state.customerCards.find((o) => o.id === orderId);
  if (!order) return;
  if (state.completedOrders.includes(order.id)) return;
  // Ask the lock before the hold: a locked card the captain happens to be
  // carrying is still not theirs, and an inventory sentence would describe
  // the wrong refusal. The line is the same string the board prints.
  //
  // A locked card is fillable only by a Free Captain who passed `borrow`
  // and still has the allowance (see canFillOrder and ./opportunist).
  const locked = lockedBehind(state, order);
  if (locked && !(borrow && opportunistMayBorrow(state, locked))) {
    logs.push(pathLockLedgerLine(locked));
    return;
  }
  const short = orderShortfall(state, order);
  if (short) {
    logs.push(
      line("❌ Inventory short! Need {short.type}×{short.required}", {
        "short.type": line(short.type),
        "short.required": short.required ?? 0,
      }),
    );
    return;
  }
  // Woven is read off the tag rather than a hand written list, so a good
  // added to the class joins the rule with its own record.
  const wovenUnits = cargoUnitsWithTag(order.resources, "woven");
  // Fleet of Treasures units are counted off this manifest and passed into
  // the freight read, so this charge and every quote agree.
  const luxuryUnits = fleetOfTreasuresUnits(state, order.resources);
  // The one quote every surface shares: borrow penalty, VAT, percentage
  // bonuses, commission, and freight in the settlement's order.
  const quote = quoteOrder(state, order, { borrowed: locked !== null });
  let transport = quote.freight;
  // A line without a count takes nothing, rather than subtracting an
  // undefined and poisoning every later inventory figure.
  for (const r of order.resources) state.inventory[r.type] -= r.required ?? 0;
  const reward = quote.reward;
  // The borrow penalty is already inside the quote's basis, so every step
  // below scales the reduced payout. Every guard above has passed, so the
  // allowance can be spent here; the completedOrders guard at the top keeps
  // a reload from spending it twice.
  if (locked) {
    state.opportunistBorrows += 1;
    // The ledger reports the reward this fill credits, not the basis the
    // penalty was taken from.
    logs.push(opportunistLedgerLine(state, order.reward, quote.reward));
  }
  // The VAT comes from the quote, where the taxed line is read once.
  if (quote.vatBreakdown) {
    state.vatPaid += quote.vat;
    logs.push(
      line("🧾 Product Sales VAT: {totalVat} Gold", { totalVat: quote.vat }),
    );
  }
  // The receipt reports the Gold the discount actually took: the freight
  // without the module's units minus the quoted freight. A floor at zero
  // can make the nominal per unit figure an overstatement, so the line
  // reports what moved.
  if (luxuryUnits > 0) {
    const freightOff =
      calcTransportCost(state, order.totalItems, wovenUnits) - transport;
    if (freightOff > 0) {
      logs.push(
        line("{fleetLead}: {freightOff} Gold off freight", {
          fleetLead: (locale) => cardLead("fleet_of_treasures", locale),
          freightOff,
        }),
      );
    }
  }
  state.money -= transport;
  state.roundCosts += transport;
  state.totalCosts += transport;
  const origTransport = transport;
  // The quote ran the bonus chain; the log prints each step under its
  // arm's lead.
  for (const step of quote.bonusSteps) {
    logs.push(
      line("{lead}: +{pct}% Reward!", {
        lead: (locale) => cardLead(step.cardId, locale),
        pct: step.pct,
      }),
    );
  }
  // Read once for the milestone moment below, through the same gate the
  // reward chain uses. The null check comes first so a pathless captain
  // never matches a null derivation.
  const followsPath =
    state.path !== null && pathOrderOf(order, state.mode) === state.path;
  if (hasModule(state, "salvage_crane") && Math.random() < 0.3) {
    state.money += transport;
    logs.push(
      line("{lead}: Refunded {transport} Gold freight!", {
        lead: (locale) => cardLead("salvage_crane", locale),
        transport,
      }),
    );
    transport = 0;
  }
  if (hasModule(state, "tax_evasion") && Math.random() < 0.15) {
    state.money -= 20;
    // The fine is a voyage expense, so the closing sheet can account for it.
    state.finesPaid += 20;
    logs.push(
      line("🚨 AUDIT! {taxEvasionLead} triggered. Lost 20 Gold!", {
        taxEvasionLead: (locale) => cardLead("tax_evasion", locale),
      }),
    );
  }
  if (transport !== origTransport) {
    // Only the Salvage Crane moves `transport`, and it has already handed
    // the Gold back. This trues up the cost ledger; crediting money here as
    // well would pay every refund twice.
    const diff = origTransport - transport;
    state.roundCosts -= diff;
    state.totalCosts -= diff;
  }
  // The Broker takes his cut of the reward (see brokersFavorCommission),
  // and the credited reward is already net of it.
  if (order.isBrokerFavor) {
    logs.push(
      line("🤝 Broker's Commission ({pct}%): {commission} Gold", {
        pct: quote.commissionPct,
        commission: quote.commission,
      }),
    );
  }
  state.money += reward;
  state.roundRevenue += reward;
  // Revenue is written gross of VAT while VAT goes to its own expense
  // tally, so the closing sheet counts the tax exactly once. Subtracting
  // vatPaid as an expense too would count it on both sides.
  state.totalRevenue += reward + quote.vat;
  state.score += Math.floor(reward - transport);
  // Folded from the credited reward, not the face value, so the Chronicle's
  // largest trade matches the log line the captain just read.
  state.largestTrade = Math.max(state.largestTrade, reward);
  state.completedOrders.push(order.id);
  state.orderCount++;
  state.totalOrdersCompleted++;
  // The audit reads this later, so record what the fill actually credited
  // rather than the face value. Trimmed on every push to keep the save
  // bounded.
  state.orderFills.push({
    round: state.currentRound,
    port: order.demandPort,
    // Record what was actually deducted, the same `?? 0` the guards use.
    items: order.resources.map((r) => ({ type: r.type, qty: r.required ?? 0 })),
    reward,
  });
  state.orderFills = state.orderFills.slice(-AUDIT_WINDOW);
  // Joined at the read so the list uses the reader's language.
  const txt = joined(
    order.resources.map((r) =>
      line("{goodIcon}{r.type}×{r.required}", {
        goodIcon: ICONS[r.type],
        "r.type": line(r.type),
        "r.required": r.required ?? 0,
      }),
    ),
    () => " + ",
  );
  logs.push(
    line("📦 Completed Order at {order.demandPort}: {txt}", {
      "order.demandPort": line(order.demandPort),
      txt,
    }),
  );
  logs.push(
    line(
      "💰 Reward: {reward} Gold · ⚓ Freight: {transport} Gold = 📊 Net Profit: {netProfit} Gold",
      { reward, transport, netProfit: reward - transport },
      "   ",
    ),
  );
  logs.push(
    line("📊 Completed {state.orderCount} transactions", {
      "state.orderCount": state.orderCount,
    }),
  );
  // Fires once, when this captain's own count crosses the threshold,
  // whether or not they turn out to be first. The server decides the race
  // when the claim arrives.
  if (state.totalOrdersCompleted === WORD_ON_THE_DOCKS_THRESHOLD) {
    state._pendingDocksClaim = { total: state.totalOrdersCompleted };
  }
  // A fill along the captain's own path is the pathbound moment. A borrowed
  // fill of another path's card is not, and the latch inside the queue call
  // keeps the moment to the once.
  if (followsPath) queueMilestoneMoment(state, logs, "pathbound_order");
}

// Applied only on the client the server confirmed won the race. A losing
// claim never receives this call, so it costs nothing and needs no
// rollback.
export function claimWordOnTheDocksReward(
  state: GameState,
  logs: LedgerLine[],
) {
  state.money += WORD_ON_THE_DOCKS_REWARD;
  logs.push(
    line(
      "📣 Word on the Docks: you were first to complete {WORD_ON_THE_DOCKS_THRESHOLD} trade orders this voyage! +{WORD_ON_THE_DOCKS_REWARD} Gold",
      { WORD_ON_THE_DOCKS_THRESHOLD, WORD_ON_THE_DOCKS_REWARD },
    ),
  );
}

// Broker's Favor: a Renown gated, once per voyage skill that appends one
// extra standard order for goods the captain already holds, so unsellable
// stock still has a guaranteed buyer. It draws with the captain's own
// Math.random and only touches their own board, so it cannot shift anyone
// else's market. Quantity is capped at the hold; the commission curve, not
// a quantity limit, keeps an oversized ask from paying out too much.
export function callBrokersFavor(
  state: GameState,
  item: string,
  quantity: number,
  logs: LedgerLine[],
) {
  if (state.phase !== "orders") return;
  if (state.renownLevel < BROKERS_FAVOR_UNLOCK_LEVEL) {
    logs.push(
      line(
        "❌ Broker's Favor unlocks at Renown Level {BROKERS_FAVOR_UNLOCK_LEVEL}",
        {
          BROKERS_FAVOR_UNLOCK_LEVEL,
        },
      ),
    );
    return;
  }
  if (state.brokersFavorUsed) {
    logs.push(line("❌ You've already called in a Broker's Favor this voyage"));
    return;
  }
  const isRaw = (RESOURCES as readonly string[]).includes(item);
  const isProduct = (PRODUCTS as readonly string[]).includes(item);
  if (!isRaw && !isProduct) {
    logs.push(
      line("❌ The Broker can't find a buyer for {item}", {
        item: line(item),
      }),
    );
    return;
  }
  const held = state.inventory[item] || 0;
  if (held <= 0) {
    logs.push(
      line("❌ You have no {item} in the hold for the Broker to sell", {
        item: line(item),
      }),
    );
    return;
  }
  const qty = Math.floor(quantity);
  if (!Number.isFinite(qty) || qty < 1 || qty > held) {
    logs.push(
      line("❌ Choose between 1 and {held} {item} for the Broker to sell", {
        held,
        item: line(item),
      }),
    );
    return;
  }
  const localRng: Rng = Math.random;
  const order = isRaw
    ? genRawOrder(localRng, poolsFor(state), item, qty)
    : genProductOrder(localRng, poolsFor(state), item, qty);
  const nextId = nextCardId(state);
  state.customerCards.push({ id: nextId, ...order, isBrokerFavor: true });
  state.brokersFavorUsed = true;
  const txt = joined(
    order.resources.map((r) =>
      line("{goodIcon}{r.type}×{r.required}", {
        goodIcon: ICONS[r.type],
        "r.type": line(r.type),
        "r.required": r.required ?? 0,
      }),
    ),
    () => " + ",
  );
  logs.push(
    line(
      "🤝 Broker's Favor called in: a buyer at {order.demandPort} now wants {txt}. The bigger the ask, the bigger the Broker's cut.",
      { "order.demandPort": line(order.demandPort), txt },
    ),
  );
}

export function purchaseIntel(state: GameState, logs: LedgerLine[]) {
  // Sold on the Market board only: startOrders cashes the whisper, so a
  // rumor bought after the board is dealt could never be honored. The
  // dialog can outlive the round, so a late press is refused rather than
  // charged.
  if (state.phase !== "market") {
    logs.push(line("🔮 The Broker only deals during Market."));
    return;
  }
  if (!state.marketDemandTags.length) {
    logs.push(line("🔮 The Broker has no more whispers..."));
    return;
  }
  const cost = getIntelCost(state);
  if (state.money < cost) {
    logs.push(line("❌ Need {cost} Gold for a whisper", { cost }));
    return;
  }
  // One press is one purchase and one fee. The modules change how many
  // whispers that purchase brings back: the Brokers' Network brings two and
  // the Ocean Interpreter adds a third.
  const paidCount = hasModule(state, "brokers_network") ? 2 : 1;
  const count = paidCount + (hasModule(state, "ocean_relay") ? 1 : 0);
  // The demand pool is finite and resets each Market, so a late press can
  // find fewer tags than its promise names. Refuse before the purse moves
  // rather than charging for whispers never delivered; the round's reset
  // makes the remainder reachable again.
  const remaining = state.marketDemandTags.length;
  if (remaining < count) {
    logs.push(
      line(
        "🔮 The Broker has only {remaining} of {count} whispers left this round, so this press would come up short.",
        { remaining, count },
      ),
    );
    return;
  }
  // The fee is paid once, matching the price on the button and the guard
  // above. Billing it inside the loop would charge the Brokers' Network
  // twice and could drive the purse negative.
  state.money -= cost;
  for (let i = 0; i < count; i++) {
    if (!state.marketDemandTags.length) break;
    revealRumor(
      state,
      logs,
      "🗣️ Broker's Whisper: ‘Word from {port}: High demand for {item}!’",
    );
    // Corrupt broker (Monsoon only): the rumor itself is always delivered
    // and true, on every tier. The broker instead also sells word of this
    // hold to the pirates, raising the round's raid chance once, announced
    // so the captain can price the risk.
    const cfg = difficultyConfig(state.difficulty);
    if (
      cfg.brokerCorruption &&
      !state.brokerTippedPirates &&
      Math.random() < cfg.brokerCorruptionChance
    ) {
      state.brokerTippedPirates = true;
      logs.push(
        line(
          "🕵️ That broker was corrupt. The word is good, but your position leaked: raid risk is up {riskPoints} points this round.",
          { riskPoints: Math.round(cfg.brokerCorruptionRisk * 100) },
        ),
      );
    }
  }
}

export function startOrders(
  state: GameState,
  ctx: GameContext,
  logs: LedgerLine[],
) {
  state.phase = "orders";
  state.orderCount = 0;
  state.completedOrders = [];
  logs.push(
    line("\n🤝=== Round {state.currentRound} · Orders: Trade Transaction ===", {
      "state.currentRound": state.currentRound,
    }),
  );
  // Deterministic orders: this captain's seed, voyage and round. What
  // differs between captains is the seed, so a reload deals the same hand.
  const orderRng = createRng(
    `${ctx.seedBase}:V${state.voyageEpoch}:R${state.currentRound}:orders`,
  );
  state.customerCards = [];
  const orderPools = poolsFor(state);
  // The trade board widens with the port market as a tier's charter opens.
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
    logs.push(
      line("{lead}: One extra order appeared.", {
        lead: (locale) => cardLead("merchants_converge", locale),
      }),
    );
  }
  // Each revealed rumor replaces one existing order. The named good and
  // harbor stay on that card, and the seeded draw stays unchanged.
  const guaranteedCount = Math.min(
    state.revealedIntel.length,
    state.customerCards.length,
  );
  for (let i = 0; i < guaranteedCount; i++) {
    const intel = state.revealedIntel[i];
    const localRng: Rng = Math.random;
    const guaranteed = (RESOURCES as readonly string[]).includes(intel.item)
      ? genRawOrder(localRng, orderPools, intel.item, undefined, intel.port)
      : genProductOrder(
          localRng,
          orderPools,
          intel.item,
          undefined,
          intel.port,
        );
    state.customerCards[i] = {
      id: state.customerCards[i].id,
      ...guaranteed,
      isGuaranteed: true,
    };
  }
  // Imperial Mandate: on scheduled rounds the Emperor commissions one large
  // order from fixed template data, with no rng and the same template for
  // everyone. An imperial levy is never charged VAT, hence isProductOrder:
  // false.
  const mandateIdx = mandateIndexFor(state.difficulty, state.currentRound);
  const mandate =
    mandateIdx === undefined ? undefined : MANDATE_TEMPLATES[mandateIdx];
  if (mandate) {
    const nextId = nextCardId(state);
    // Placed first because it is the round's headline. Its id stays with it
    // even after it moves to the front.
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
    const need = joined(
      mandate.resources.map((r) =>
        line("{goodIcon}{r.type}×{r.required}", {
          goodIcon: ICONS[r.type],
          "r.type": line(r.type),
          "r.required": r.required,
        }),
      ),
      () => " + ",
    );
    logs.push(
      line(
        "📜 Imperial Mandate at {mandate.port}: {need} for {mandate.reward} Gold. The Emperor's commission is exempt from VAT.",
        {
          "mandate.port": line(mandate.port),
          need,
          "mandate.reward": mandate.reward,
        },
      ),
    );
  }
  // The pathbound slots are filled last from their own stream (`:pathorders`),
  // so the six scheduled orders stay the same six seed for seed. Each card
  // names a good the path's trade lives in and pays what that trade pays.
  if (pathOrdersOn(state.mode)) {
    const pathOrderRng = createRng(
      `${ctx.seedBase}:V${state.voyageEpoch}:R${state.currentRound}:pathorders`,
    );
    for (let i = 0; i < PATH_ORDER_SLOTS; i++) {
      const order = genPathOrder(pathOrderRng, orderPools);
      if (!order) break;
      const nextId = nextCardId(state);
      state.customerCards.push({ id: nextId, ...order });
    }
  }
}
