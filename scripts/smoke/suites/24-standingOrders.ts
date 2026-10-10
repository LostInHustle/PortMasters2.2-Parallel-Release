// PortMasters 2.2 Parallel Release, smoke run: Standing orders.

import { cardText } from "@/lib/game/cards";
import { BOONS } from "@/lib/game/constants/drafts";
import { ITEMS, MARKET_GOODS, RAGS } from "@/lib/game/constants/goods";
import { MAX_SHIP_LEVEL } from "@/lib/game/constants/ships";
import {
  autoCommit,
  lockedBehind,
  pathOrderOf,
  purchaseCard,
  restartGame,
  snapToCheckpoint,
  tallyPurchasesByResource,
} from "@/lib/game/engine";
import { usedCargoSlots } from "@/lib/game/hold";
import { cargoCapacity, cargoRoom } from "@/lib/game/larder";
import type { StandingOrders } from "@/lib/game/standing";
import {
  MAX_STANDING_BUYS,
  defaultStandingOrders,
  normalizeStandingOrders,
  standingBoon,
  standingOrdersLive,
} from "@/lib/game/standing";
import type { GameState, Phase } from "@/lib/game/types";
import { createInitialGameState } from "@/lib/game/types";
import { GAMBIT, carriesADash, check } from "../harness";

export async function standingOrdersSuite(): Promise<void> {
  // [B3: standing orders] The evaluation for this slice, and the one the
  // plan asks to be testable with no server: what the room's clock plays
  // for a captain who is not standing at their seat is a pure engine
  // function taking a state and a record. Every check below drives it
  // through the entry point the clock itself uses, autoCommit, so what is
  // held to is the seat rather than a copy of the seat. Nothing in this
  // section opens a socket.
  //
  // The first checks are about the record itself, because the record is
  // what makes this a change to the engine at all. A set a captain wrote
  // and a set somebody tampered with arrive through the same reader, and
  // the reader's whole job is that the second can only ever do what the
  // first could have done by hand.
  //
  // The boards below are dealt by snapToCheckpoint rather than written out
  // here, for the reason the lap walk reads the lap rather than restating
  // it: a fixture market would pass every check in this section while the
  // real one dealt something else. Where a check needs the board to
  // discriminate, the expectation is computed from the board it was dealt
  // rather than from a number chosen here, so the checks hold on any seed.
  const quiet = defaultStandingOrders();
  const sameOrders = (a: StandingOrders, b: StandingOrders) =>
    a.enabled === b.enabled &&
    a.boon === b.boon &&
    a.fill === b.fill &&
    a.shipyard === b.shipyard &&
    a.buy.length === b.buy.length &&
    a.buy.every(
      (line, i) =>
        line.good === b.buy[i].good && line.maxPrice === b.buy[i].maxPrice,
    );
  const sameIds = (a: readonly number[], b: readonly number[]) =>
    a.length === b.length && a.every((id, i) => id === b[i]);
  const sameTally = (a: Record<string, number>, b: Record<string, number>) => {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return (
      ka.length === kb.length &&
      ka.every((key, i) => key === kb[i] && a[key] === b[key])
    );
  };
  const sumTally = (a: Record<string, number>, b: Record<string, number>) => {
    const out: Record<string, number> = { ...a };
    for (const [key, value] of Object.entries(b))
      out[key] = (out[key] ?? 0) + value;
    return out;
  };
  const standingCtx = {
    seedBase: "standing-orders:captain-a",
    harborId: "standing-orders",
  };
  // A fresh voyage stopped at one phase of round one, on the widest tier
  // the tree deals so the two boards below are wide enough to say
  // something about the lots and the orders that were left behind.
  const deal = (phase: Phase) => {
    const state = createInitialGameState({
      mode: "ocean_gambit",
      difficulty: "monsoon",
    });
    snapToCheckpoint(state, standingCtx, 1, phase, []);
    return state;
  };
  const deepPurse = (state: GameState) => {
    state.money = 100000;
    return state;
  };
  // The same purse over an empty hold, which is what the three price
  // checks below need: the cargo has a size, and a voyage ships
  // the tree's own opening stock, so a board whose lots happen to run
  // large would measure the hold's room as well as the price list. The
  // line those checks hold is that the list reaches every lot, not that
  // the ship could carry every lot, and the seat that meets a hold with
  // no room left is read on its own beside them.
  const roomy = (state: GameState) => {
    deepPurse(state);
    state.inventory = {};
    return state;
  };
  const took = (logs: string[], needle: string) =>
    logs.some((line) => line.includes(needle));

  // The record itself, and what a captain who wrote nothing holds.
  check(
    quiet.enabled &&
      quiet.boon === null &&
      quiet.buy.length === 0 &&
      quiet.fill === "none" &&
      quiet.shipyard === "continue",
    "a captain who wrote nothing holds the switch on and no instruction under it, which is the seat every default already played",
  );
  check(
    !standingOrdersLive(quiet),
    "and a switch that is on over an empty set is a seat nothing is going to play, rather than a lit button promising one",
  );
  const garbage = [
    undefined,
    null,
    42,
    "orders",
    [],
    { enabled: "yes", boon: 7, fill: "some", shipyard: "scrap", buy: "Hemp" },
  ];
  check(
    garbage.every((raw) => sameOrders(normalizeStandingOrders(raw), quiet)),
    "and anything the vocabulary does not name is read back as that same record rather than trusted",
  );
  const goods = MARKET_GOODS;
  const littered = normalizeStandingOrders({
    enabled: true,
    buy: [
      { good: goods[0], maxPrice: 4.7 },
      { good: goods[0], maxPrice: 9 },
      { good: "Unobtainium", maxPrice: 5 },
      { good: goods[1], maxPrice: -3 },
      { good: goods[1], maxPrice: "12" },
      { good: goods[2], maxPrice: Number.NaN },
      { good: goods[3], maxPrice: Number.POSITIVE_INFINITY },
    ],
  });
  check(
    littered.buy.length === 1 &&
      littered.buy[0].good === goods[0] &&
      littered.buy[0].maxPrice === 4,
    "a shopping list keeps the first line for each good the tree can price, floors the price, and drops every line that is not a price",
  );
  const everyGood = normalizeStandingOrders({
    buy: goods.flatMap((good) => [
      { good, maxPrice: 1 },
      { good, maxPrice: 2 },
    ]),
  });
  check(
    MAX_STANDING_BUYS === goods.length &&
      everyGood.buy.length === MAX_STANDING_BUYS &&
      everyGood.buy.every((line) => line.maxPrice === 1),
    `and one line per good is the whole of what a list can say, however long the list it was read from was (${goods.length} goods)`,
  );
  // [D4: Loom: the Refit] The line the board can never answer. Rags is
  // cargo the Loom's bench buys off the quay rather than a good the port
  // merchant trades, so an instruction naming one would be a line the
  // merchant could never fill, and the reader drops it the same way it
  // drops a name no catalogue carries. This is the reason the cap above is
  // the board's list rather than the hold's: the two stopped being the
  // same list the day Rags arrived.
  const ragsLine = normalizeStandingOrders({
    enabled: true,
    buy: [{ good: RAGS, maxPrice: 999 }],
  });
  check(
    !(MARKET_GOODS as readonly string[]).includes(RAGS) &&
      (ITEMS as readonly string[]).includes(RAGS) &&
      ragsLine.buy.length === 0 &&
      MAX_STANDING_BUYS === MARKET_GOODS.length &&
      MAX_STANDING_BUYS < ITEMS.length,
    "a shopping list cannot name a rag, because a standing order buys a card and the merchant's cards are dealt from the goods the merchant trades, so the hold's catalogue and the board's are two lists rather than one",
  );
  // A set the captain wrote and then switched off is the rollback the
  // plan asks for, and it is measured against this one record below.
  const ordersWritten: StandingOrders = {
    ...quiet,
    boon: BOONS[0].id,
    buy: [{ good: goods[0], maxPrice: 9 }],
    fill: "all",
    shipyard: "upgrade",
  };
  const switchedOff = normalizeStandingOrders({
    ...ordersWritten,
    enabled: false,
  });
  check(
    !switchedOff.enabled &&
      switchedOff.boon === BOONS[0].id &&
      switchedOff.buy.length === 1 &&
      switchedOff.fill === "all" &&
      switchedOff.shipyard === "upgrade",
    "while the switch off keeps the set it was written with, because erasing it would punish a captain for a rollback they may take back",
  );
  check(
    standingBoon(ordersWritten)?.id === BOONS[0].id &&
      standingBoon(quiet) === null &&
      standingBoon({ ...quiet, boon: "no_such_boon" }) === null,
    "and a written boon is read as the catalogue entry it names, or as nothing at all when it names nothing the tree still ships",
  );

  // Dawn, the one seat whose work is a choice rather than a press. The
  // draft is the one board in the leg drawn with live randomness rather
  // than from the captain's seed, so every fixture below reads the hand
  // the state under test was actually dealt rather than a hand taken
  // from some other state and hoped for.
  const orderedDawn = deal("dawn");
  const writtenPick = orderedDawn.boonChoices[1];
  const firstOffer = orderedDawn.boonChoices[0];
  if (!writtenPick || !firstOffer)
    throw new Error(
      "The standing order checks need a draft holding more than one boon on it, or the written choice cannot be told apart from the board's own first offer.",
    );
  orderedDawn.standingOrders = { ...quiet, boon: writtenPick.id };
  const orderedDawnLogs: string[] = [];
  autoCommit(orderedDawn, standingCtx, orderedDawnLogs);
  check(
    took(orderedDawnLogs, cardText(writtenPick).name) &&
      !took(orderedDawnLogs, cardText(firstOffer).name) &&
      JSON.stringify(orderedDawn.modifierFlags) ===
        JSON.stringify(
          writtenPick.effect.kind === "flags" ? writtenPick.effect.flags : null,
        ) &&
      orderedDawn.boonChoices.length === 0 &&
      orderedDawn.phase !== "dawn",
    "an absent captain's Dawn takes the boon they wrote, off the board they were dealt rather than out of the catalogue, and the round reads back exactly what that card carries: the comparison is content rather than object identity because the write folds any held flags in beneath the card's own, and a captain holding nothing yet lands on the card's flags alone",
  );
  const missedDawn = deal("dawn");
  const missedFirst = missedDawn.boonChoices[0];
  const offBoard = BOONS.find(
    (b) => !missedDawn.boonChoices.some((o) => o.id === b.id),
  );
  if (!missedFirst || !offBoard)
    throw new Error(
      "The standing order checks need a catalogue boon that is not on the drawn board, or the fallback they measure cannot be told apart from a written choice.",
    );
  missedDawn.standingOrders = { ...quiet, boon: offBoard.id };
  const missedDawnLogs: string[] = [];
  autoCommit(missedDawn, standingCtx, missedDawnLogs);
  check(
    took(missedDawnLogs, cardText(missedFirst).name) &&
      !took(missedDawnLogs, cardText(offBoard).name) &&
      missedDawn.phase !== "dawn",
    "a name the draft did not deal is passed over for the board's first offer, so a written order can never take a boon its captain was not shown",
  );
  const rollbackDawn = deal("dawn");
  const rollbackPick = rollbackDawn.boonChoices[1];
  const rollbackFirst = rollbackDawn.boonChoices[0];
  if (!rollbackPick || !rollbackFirst)
    throw new Error(
      "The standing order checks need a draft holding more than one boon on it, or the rollback they measure cannot be told apart from the written choice.",
    );
  rollbackDawn.standingOrders = {
    ...quiet,
    boon: rollbackPick.id,
    enabled: false,
  };
  const rollbackDawnLogs: string[] = [];
  autoCommit(rollbackDawn, standingCtx, rollbackDawnLogs);
  check(
    took(rollbackDawnLogs, cardText(rollbackFirst).name) &&
      !took(rollbackDawnLogs, cardText(rollbackPick).name),
    "and with the switch off the same written boon is passed over too, which is the rollback the plan asks for",
  );

  // Market. The purse is deep enough that affordability is not what is
  // being measured here; the price checks read the board they were dealt,
  // so they hold wherever the lots happen to fall.
  const boardTops = (state: GameState) => {
    const tops = new Map<string, number>();
    const floors = new Map<string, number>();
    for (const card of state.resourceCards)
      for (const r of card.resources) {
        const price = r.price ?? 0;
        tops.set(r.type, Math.max(tops.get(r.type) ?? price, price));
        floors.set(r.type, Math.min(floors.get(r.type) ?? price, price));
      }
    return { tops, floors };
  };
  const listFrom = (
    prices: Map<string, number>,
    spare: number,
  ): StandingOrders => ({
    ...quiet,
    buy: [...prices].map(([good, price]) => ({
      good,
      maxPrice: Math.max(0, price - spare),
    })),
  });

  const whole = roomy(deal("market"));
  const wholeLogs: string[] = [];
  const wholeBoard = whole.resourceCards.map((card) => card.id);
  whole.standingOrders = listFrom(boardTops(whole).tops, 0);
  autoCommit(whole, standingCtx, wholeLogs);
  check(
    wholeBoard.length > 1 &&
      sameIds(whole.purchasedCards, wholeBoard) &&
      whole.money === 100000 - whole.totalCosts &&
      took(wholeLogs, "Standing orders at the port board"),
    `orders pricing every good at the top the board itself asks buy the whole board and pay for it out of the captain's purse (${wholeBoard.length} lots)`,
  );
  // [C4: three foods, spoilage and the split hold] The same order on the
  // ship every captain actually starts in, with the tree's own opening
  // stock in the hold: the list still buys what the hold has room for,
  // and every lot it could not take is refused for room rather than for
  // price, which is the split hold's own rule arriving through the seat
  // that shops with nobody sitting at it. The board weighs twenty slots
  // against fourteen free, so this is not a corner of the draw.
  const crowded = deepPurse(deal("market"));
  const crowdedLogs: string[] = [];
  const crowdedBoard = crowded.resourceCards.map((card) => card.id);
  const largestLot = Math.max(
    ...crowded.resourceCards.map((card) =>
      card.resources.reduce((n, r) => n + (r.quantity ?? 0), 0),
    ),
  );
  crowded.standingOrders = listFrom(boardTops(crowded).tops, 0);
  autoCommit(crowded, standingCtx, crowdedLogs);
  const crowdedRefusals = crowdedLogs.filter((line) =>
    line.includes("No room in the hold"),
  ).length;
  check(
    crowded.purchasedCards.length > 0 &&
      crowded.purchasedCards.length < crowdedBoard.length &&
      crowdedRefusals === crowdedBoard.length - crowded.purchasedCards.length &&
      crowded.money === 100000 - crowded.totalCosts &&
      usedCargoSlots(crowded) <= cargoCapacity(crowded) &&
      cargoRoom(crowded) < largestLot,
    `orders meeting a hold that is already carrying the opening stock buy what fits and are told why for each lot that does not (${crowded.purchasedCards.length} of ${crowdedBoard.length} lots)`,
  );
  const choosy = roomy(deal("market"));
  const choosyTops = boardTops(choosy).tops;
  const underTops = choosy.resourceCards.filter((card) =>
    card.resources.every((r) => (r.price ?? 0) < (choosyTops.get(r.type) ?? 0)),
  );
  choosy.standingOrders = listFrom(choosyTops, 1);
  autoCommit(choosy, standingCtx, []);
  check(
    sameIds(
      choosy.purchasedCards,
      underTops.map((card) => card.id),
    ),
    `and a list priced a gold under those tops buys exactly the lots whose every unit is under them, leaving the rest of the board alone (${underTops.length} of ${choosy.resourceCards.length})`,
  );
  const nothingPriced = roomy(deal("market"));
  const nothingPricedLogs: string[] = [];
  nothingPriced.standingOrders = listFrom(boardTops(nothingPriced).floors, 1);
  autoCommit(nothingPriced, standingCtx, nothingPricedLogs);
  check(
    nothingPriced.purchasedCards.length === 0 &&
      nothingPriced.money === 100000 &&
      !took(nothingPricedLogs, "Standing orders at the port board"),
    "a list priced a gold under the cheapest lot the board offers buys nothing and says nothing, rather than reporting work it did not do",
  );
  const broke = deal("market");
  broke.money = 0;
  const brokeLogs: string[] = [];
  broke.standingOrders = listFrom(boardTops(broke).tops, 0);
  autoCommit(broke, standingCtx, brokeLogs);
  check(
    broke.purchasedCards.length === 0 &&
      broke.money === 0 &&
      !took(brokeLogs, "Standing orders at the port board"),
    "and a purse that is empty buys nothing at all, because an order spends the same guard a hand does",
  );
  const reportedByHand = deepPurse(deal("market"));
  const handCard = reportedByHand.resourceCards[0];
  if (!handCard || reportedByHand.resourceCards.length < 2)
    throw new Error(
      "The standing order checks need a port board holding at least two lots, or the delta they measure cannot be told apart from the whole report.",
    );
  purchaseCard(reportedByHand, handCard.id, []);
  const beforeOrders = tallyPurchasesByResource(reportedByHand);
  reportedByHand.standingOrders = listFrom(boardTops(reportedByHand).tops, 0);
  autoCommit(reportedByHand, standingCtx, []);
  const orderDelta = reportedByHand._pendingPulseTally ?? {};
  check(
    Object.keys(orderDelta).length > 0 &&
      sameTally(
        sumTally(beforeOrders, orderDelta),
        tallyPurchasesByResource(reportedByHand),
      ),
    "and the lots the orders bought after a captain's own round ride the pulse as a delta on that report, which together are the lots the harbor counts",
  );

  // Orders. The hold is what decides this seat. Two fixtures decide it
  // without depending on how the board happened to fall: an empty hold
  // covers no order at all, because every order on the board asks for at
  // least one unit of something, and a hold loaded for the board's own
  // first order covers that one by construction, since nothing precedes
  // it on the board to spend the goods first.
  const loadFor = (state: GameState) => {
    const order = state.customerCards[0];
    for (const good of goods) state.inventory[good] = 0;
    if (!order)
      throw new Error(
        "The standing order checks need a trade board with at least one order on it.",
      );
    const hold: Record<string, number> = {};
    for (const r of order.resources) {
      const required = r.required ?? 0;
      state.inventory[r.type] = (state.inventory[r.type] ?? 0) + required;
      hold[r.type] = (hold[r.type] ?? 0) + required;
    }
    return { order, hold };
  };
  // The rule the panel promises a captain, written out here rather than
  // read off the engine: walk the board in order, fill what the hold
  // covers at that moment, and let every fill spend the goods it took.
  // Holding the engine to this is what makes the check about the rule
  // rather than about the engine agreeing with itself.
  //
  // [D2] The one thing the model does not restate is the pathbound lock,
  // because the lock is not a rule about the hold: it is asked through
  // lockedBehind, the same reader the trade board greys a card with and
  // the same one the engine's own guard asks, so a card this model would
  // cover and the engine would refuse cannot slip past here having been
  // checked nowhere.
  const greedyFills = (state: GameState, hold: Record<string, number>) => {
    const filled: number[] = [];
    for (const order of state.customerCards) {
      if (lockedBehind(state, order)) continue;
      const covered = order.resources.every(
        (r) => (hold[r.type] ?? 0) >= (r.required ?? 0),
      );
      if (!covered) continue;
      for (const r of order.resources) hold[r.type] -= r.required ?? 0;
      filled.push(order.id);
    }
    return filled;
  };
  const bare = deal("orders");
  for (const good of goods) bare.inventory[good] = 0;
  const bareLogs: string[] = [];
  bare.standingOrders = { ...quiet, fill: "all" };
  autoCommit(bare, standingCtx, bareLogs);
  check(
    bare.customerCards.length > 0 &&
      bare.completedOrders.length === 0 &&
      bare.totalOrdersCompleted === 0 &&
      !took(bareLogs, "Standing orders at the trade board"),
    `an order to fill every order the hold can cover fills none of them from an empty hold, rather than buying goods to chase one (${bare.customerCards.length} on the board)`,
  );
  const filledHold = deal("orders");
  const { order: firstOrder, hold: loadedHold } = loadFor(filledHold);
  const filledHoldLogs: string[] = [];
  filledHold.standingOrders = { ...quiet, fill: "all" };
  autoCommit(filledHold, standingCtx, filledHoldLogs);
  check(
    sameIds(filledHold.completedOrders, greedyFills(filledHold, loadedHold)) &&
      filledHold.completedOrders[0] === firstOrder.id &&
      took(filledHoldLogs, "Standing orders at the trade board") &&
      goods.every((good) => (filledHold.inventory[good] ?? 0) >= 0),
    `a hold loaded for the first order on the board fills it, and then every later order it still covers, in board order and without overdrawing (${filledHold.completedOrders.length} of ${filledHold.customerCards.length} filled)`,
  );
  const skipping = deal("orders");
  // The same loaded hold as the fixture above, so the order left
  // standing below is the switch's doing and not an empty hold's.
  loadFor(skipping);
  const skippingLogs: string[] = [];
  skipping.standingOrders = { ...quiet, fill: "none" };
  autoCommit(skipping, standingCtx, skippingLogs);
  check(
    skipping.completedOrders.length === 0 &&
      skipping.totalOrdersCompleted === 0 &&
      !took(skippingLogs, "Standing orders at the trade board"),
    `and the trade board's default is still to fill nothing, which is the seat [B2] shipped (the hold was loaded for it, and it is left standing)`,
  );
  // [D2] The two seats below are the same board and the same hold, one
  // environment value apart in nothing at all: the only difference is the
  // path the captain sails. It is the check the lock was put inside
  // canFillOrder for, since that function is the one judgement the hand
  // and the seat both go through (see workStandingOrders), and the one
  // the board greys its cards with.
  const pathboundSeat = (withPath: boolean) => {
    const state = deal("orders");
    const card = state.customerCards.find((o) => o.isPathOrder);
    const owner = card ? pathOrderOf(card, GAMBIT) : null;
    if (!card || !owner)
      throw new Error(
        "The pathbound order checks need a marked card on the trade board.",
      );
    if (withPath) state.path = owner;
    for (const good of goods) state.inventory[good] = 0;
    for (const r of card.resources) {
      state.inventory[r.type] = r.required ?? 0;
    }
    state.standingOrders = { ...quiet, fill: "all" };
    autoCommit(state, standingCtx, []);
    return { state, card };
  };
  const pathless = pathboundSeat(false);
  const holding = pathboundSeat(true);
  check(
    !pathless.state.completedOrders.includes(pathless.card.id) &&
      holding.state.completedOrders.includes(holding.card.id),
    "a standing order leaves a pathbound card standing for a captain who holds no path and fills it for the captain it belongs to, from one board and one hold: the seat asks the same guard a hand does",
  );

  // Dusk, the shipyard's one standing choice, and the seat whose guard is
  // the engine's own: an order to upgrade that cannot be paid for does
  // nothing and costs nothing.
  const yard = deepPurse(deal("dusk"));
  const yardLogs: string[] = [];
  yard.standingOrders = { ...quiet, shipyard: "upgrade" };
  autoCommit(yard, standingCtx, yardLogs);
  check(
    yard.shipLevel === 1 && took(yardLogs, "Standing orders at the shipyard"),
    "an absent captain's Dusk buys the next hull the moment the yard opens, which is the one seat whose work is a purchase rather than a press",
  );
  const poor = deal("dusk");
  poor.money = 0;
  const poorLogs: string[] = [];
  poor.standingOrders = { ...quiet, shipyard: "upgrade" };
  autoCommit(poor, standingCtx, poorLogs);
  check(
    poor.shipLevel === 0 &&
      took(poorLogs, "Gold to upgrade the ship") &&
      !took(poorLogs, "Standing orders at the shipyard"),
    "and a yard the purse cannot pay for is refused by the engine rather than by the order, so a written upgrade costs a captain nothing",
  );
  const topped = deepPurse(deal("dusk"));
  topped.shipLevel = MAX_SHIP_LEVEL;
  const toppedLogs: string[] = [];
  topped.standingOrders = { ...quiet, shipyard: "upgrade" };
  autoCommit(topped, standingCtx, toppedLogs);
  check(
    topped.shipLevel === MAX_SHIP_LEVEL &&
      !took(toppedLogs, "Standing orders at the shipyard"),
    `and a hull already at its own ceiling (level ${MAX_SHIP_LEVEL}) is left where it is, because that guard is the yard's and not the order's`,
  );

  // The seat itself, through the clock's own entry point, which is where
  // the switch has to be read: with it off the whole seat is the engine's
  // own default, and with it on the written work happens before the
  // departure that would have happened anyway.
  const absent = deepPurse(deal("market"));
  autoCommit(absent, standingCtx, []);
  check(
    absent.purchasedCards.length === 0 &&
      absent._pendingPulseTally === undefined &&
      absent.phase !== "market",
    "a captain who wrote nothing is played exactly as [B2] played them: no lot bought, no report added, and the seat left on the lap's own terms",
  );
  const played = deepPurse(deal("market"));
  played.standingOrders = listFrom(boardTops(played).tops, 0);
  autoCommit(played, standingCtx, []);
  check(
    played.purchasedCards.length > 0 &&
      played._pendingPulseTally !== undefined &&
      played.phase !== "market",
    "and a captain who did write an order is played by it before the seat is left, which is the whole of what the clock does differently now",
  );
  const shutOff = deepPurse(deal("market"));
  shutOff.standingOrders = {
    ...listFrom(boardTops(shutOff).tops, 0),
    enabled: false,
  };
  autoCommit(shutOff, standingCtx, []);
  check(
    shutOff.purchasedCards.length === 0 &&
      shutOff._pendingPulseTally === undefined &&
      shutOff.phase !== "market",
    "while the same written set with the switch off buys nothing and reports nothing, and leaves the seat the way the seat is left anyway",
  );

  // Restart and the load heal, the two ways a record arrives at a voyage
  // it was not written during.
  const carried = createInitialGameState();
  carried.standingOrders = { ...ordersWritten };
  restartGame(carried, [], {});
  check(
    sameOrders(carried.standingOrders, ordersWritten),
    "restarting the voyage keeps the set a captain wrote, because a host setting sail again is not the captain changing their mind",
  );
  const damaged = createInitialGameState();
  damaged.standingOrders = "not a record" as unknown as StandingOrders;
  restartGame(damaged, [], {});
  check(
    sameOrders(damaged.standingOrders, quiet),
    "and a record the tree cannot read heals to the default rather than costing a captain their voyage",
  );
  const madeNow = createInitialGameState({ mode: "ocean_gambit" });
  check(
    sameOrders(
      normalizeStandingOrders(madeNow.standingOrders),
      madeNow.standingOrders,
    ),
    "which is what makes the heal a no op for a current save: a voyage this build creates holds a record the normalizer reads back unchanged",
  );

  // The copy rule, read off the files rather than off a claim about them.
  check(
    !carriesADash("src/lib/game/standing.ts") &&
      !carriesADash("src/lib/game/engine/standing.ts") &&
      !carriesADash(
        "src/components/portmasters/game/StandingOrdersModal.tsx",
      ) &&
      !carriesADash("src/components/portmasters/game/GameControlPanel.tsx"),
    "and none of the words a captain reads about standing orders, nor the comments that explain them, carries an en dash, an em dash or a doubled hyphen",
  );
}
