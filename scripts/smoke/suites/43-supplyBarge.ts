// PortMasters 2.2 Parallel Release, smoke run: the Supply Barge.
//
// The anonymous vendor is the fail safe for a table that never took the
// Quartermaster: one lot a round, eight of them at the most, at a markup,
// drawn from the voyage's own numbers so the rule needs no state that has
// to be kept in step. What is checked here is the rule,
// then the reading it feeds: the draw, the sale and its three ceilings,
// the two tallies a voyage leaves behind, the heal that reads a save this
// build did not write, the switch that takes the whole feature away, and
// then the page's own two numbers reduced out of records shaped the way
// the spine writes one.
//
// The wire half of this feature, which is what the record does with the
// pair of counters a captain files, is checked in the spine's own suite
// (32-telemetrySpine) for the reason every other field's claim rule is: one
// place holds what the spine does with a report.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ratePercent } from "@/lib/game/balance";
import {
  BARGE_PRICE_MULTIPLIER,
  BARGE_RATIONS_PER_ROUND,
  RATION_PRICE,
} from "@/lib/game/constants/supplies";
import { readDashboard } from "@/lib/game/dashboard";
import {
  bargeLeftAtPort,
  bargeLotAtPort,
  bargeOn,
  bargePortAtRound,
  bargeRationPrice,
  buyFromBarge,
  hireWorker,
  normalizeBargeState,
} from "@/lib/game/engine";
import { foodRoomMeals, mealsOf, reconcileLarder } from "@/lib/game/foods";
import { provisionFood } from "@/lib/game/larder";
import { unlockedPorts } from "@/lib/game/pools";
import {
  telemetryEvent,
  voyageIdFor,
  type TelemetryRecord,
} from "@/lib/game/telemetry";
import { crewSize, type GameState } from "@/lib/game/types";
import {
  CARRIES_A_DASH,
  carriesADash,
  check,
  CLASSIC,
  GAMBIT,
  ledgerSentences,
  voyageState,
  withEnv,
  withoutComments,
} from "../harness";
import type { LedgerLine } from "@/lib/game/ledger";

export async function supplyBargeSuite(inputs: {
  dashRecord: (
    roomId: string,
    over?: Partial<TelemetryRecord>,
  ) => TelemetryRecord;
}): Promise<void> {
  const { dashRecord } = inputs;

  // One voyage with a crew aboard and a pantry that is empty rather than
  // full, because what every check below is reading is what a purchase
  // adds rather than what the opening stores were already carrying. The
  // emptying goes through the module's own reconcile, so the count and the
  // lots are parted exactly the way the game parts them.
  const bargeVoyage = (money = 1000): GameState => {
    const state = voyageState();
    state.money = money;
    hireWorker(state, "weaver", []);
    state.larder = 0;
    reconcileLarder(state);
    return state;
  };

  // ========== The vendor's price ==========
  // The rule is a markup on the port's price, so the two numbers are read
  // off each other rather than written down twice: a
  // retune of either moves the vendor with it, and the premium is checked
  // to be a premium rather than taken on faith.
  check(
    bargeRationPrice() === Math.ceil(RATION_PRICE * BARGE_PRICE_MULTIPLIER) &&
      bargeRationPrice() > RATION_PRICE,
    "a barge ration costs the port's own price marked up by the published multiplier, so the premium is one number read off another rather than a second price that could drift from it",
  );

  // ========== Where it stands, and how much it has ==========
  const state = bargeVoyage();
  const firstPort = bargePortAtRound(state);
  check(
    firstPort !== null &&
      unlockedPorts(state.difficulty, state.currentRound).includes(firstPort) &&
      bargePortAtRound({ ...state }) === firstPort,
    "the vendor stands at a port the voyage can reach on that round, and the same state draws the same quay, because what the design asks for is a rule rather than a coin the server flips",
  );
  const rounds = Array.from({ length: 12 }, (_, index) => index + 1);
  const ports = rounds.map((round) =>
    bargePortAtRound({ ...state, currentRound: round }),
  );
  check(
    ports.every(
      (port, index) =>
        port !== null &&
        unlockedPorts(state.difficulty, rounds[index]).includes(port),
    ),
    "and every round of a voyage draws a quay the table can actually sail to, so the fallback is never a harbor the ship cannot reach",
  );
  check(
    new Set(ports).size > 1,
    "and it is not one harbor's vendor: the quay moves through the voyage with the round it is drawn from",
  );
  const lots = rounds.map((round) =>
    bargeLotAtPort({ ...state, currentRound: round }),
  );
  // The ceiling, said out loud here as the rule the check below is about
  // rather than as a number typed twice: the lot is read from the
  // constant, and this is the promise it is being held to.
  const PLAN_CEILING = 8;
  check(
    lots.every(
      (lot) =>
        Number.isInteger(lot) && lot >= 1 && lot <= BARGE_RATIONS_PER_ROUND,
    ) && BARGE_RATIONS_PER_ROUND === PLAN_CEILING,
    "the lot is a whole count between one and the ceiling the design names, so the promise of never more than eight a round is a bound the rule cannot cross rather than a number the panel prints",
  );
  check(
    new Set(lots).size > 1,
    "and the lot is drawn rather than fixed, so a table wanting all eight has rounds where that is possible and rounds where it is not",
  );
  check(
    bargeLeftAtPort(state) === bargeLotAtPort(state),
    "and nothing has been bought on a fresh round, so what is left of the lot is the lot",
  );

  // ========== The sale ==========
  const buyer = bargeVoyage();
  const price = bargeRationPrice();
  const purseBefore = buyer.money;
  const mealsBefore = mealsOf(buyer, "Grain");
  const saleLines: LedgerLine[] = [];
  const bought = buyFromBarge(buyer, 1, saleLines);
  check(
    bought === 1 &&
      buyer.money === purseBefore - price &&
      mealsOf(buyer, "Grain") === mealsBefore + 1 &&
      buyer.larder === 1 &&
      buyer.roundCosts === price &&
      buyer.totalCosts === price,
    "one ration is one meal of grain for the premium on the label, booked at the till the way every other purchase in this game is booked",
  );
  check(
    buyer.foodSpend === price &&
      buyer.bargeSpend === price &&
      buyer.bargeTaken === 1 &&
      buyer.bargeRound === buyer.currentRound,
    "and the Gold lands in both counters the page's share is divided from, stamped with the round it was spent in",
  );

  // The ceiling that is the feature. A press for the whole lot buys the
  // lot, and the round's shelf is then empty however deep the purse is.
  const eager = bargeVoyage(10_000);
  const lot = bargeLotAtPort(eager);
  const eagerLines: LedgerLine[] = [];
  const took = buyFromBarge(eager, BARGE_RATIONS_PER_ROUND * 4, eagerLines);
  const pressedAgain = buyFromBarge(eager, 1, eagerLines);
  check(
    took === lot &&
      bargeLeftAtPort(eager) === 0 &&
      pressedAgain === 0 &&
      ledgerSentences(eagerLines)[eagerLines.length - 1] ===
        "⛵ The barge has nothing left for you this round.",
    "a press for more than a round's lot buys the lot and stops there, and a second press in the same round is told the vendor has nothing left rather than being sold a shelf the design does not have",
  );

  // The stamp. A round is the unit of the lot and of the tally, so the next
  // round is both a fresh shelf and a fresh count, which is the whole of the
  // state this feature added.
  const perRound = bargeVoyage(10_000);
  buyFromBarge(perRound, 1, []);
  const firstRoundTaken = perRound.bargeTaken;
  perRound.currentRound += 1;
  const freshRoundLeft = bargeLeftAtPort(perRound);
  buyFromBarge(perRound, 1, []);
  check(
    firstRoundTaken === 1 &&
      perRound.bargeTaken === 1 &&
      perRound.bargeRound === perRound.currentRound &&
      freshRoundLeft === bargeLotAtPort(perRound),
    "the tally is stamped with the round it belongs to, so the next round draws a fresh lot and starts the count again rather than leaving the quay bare for the rest of the voyage",
  );

  // ========== The ceilings a purchase is held to ==========
  const full = bargeVoyage(10_000);
  provisionFood(full, "Grain", 999, []);
  const fullLines: LedgerLine[] = [];
  check(
    foodRoomMeals(full, "Grain") < 1 &&
      buyFromBarge(full, 1, fullLines) === 0 &&
      ledgerSentences(fullLines)[fullLines.length - 1] ===
        "🧺 The larder is full.",
    "a stores with no room takes no rations, and the vendor says so in the same words the port counter uses, because there is one larder and one answer to a full one",
  );
  // The purse is drawn down after the crew is aboard rather than handed to
  // the fixture, because a voyage that cannot pay its own crew is a voyage
  // with nobody aboard, and that captain is answered by the crewless line
  // below rather than by this one. What this check is about is the
  // sentence a vendor whose price is over the purse gives the captain.
  const thin = bargeVoyage();
  thin.money = 1;
  const thinLines: LedgerLine[] = [];
  check(
    price > 1 &&
      buyFromBarge(thin, 1, thinLines) === 0 &&
      thin.money === 1 &&
      ledgerSentences(thinLines)[thinLines.length - 1] ===
        `❌ The barge charges ${price} Gold a ration, and the purse cannot cover one.`,
    "and a purse that cannot cover one ration buys nothing rather than going into debt to the vendor, told the price it is short of",
  );
  const crewless = voyageState();
  crewless.money = 1000;
  crewless.larder = 0;
  reconcileLarder(crewless);
  const crewlessLines: LedgerLine[] = [];
  check(
    crewSize(crewless) === 0 &&
      buyFromBarge(crewless, 1, crewlessLines) === 0 &&
      ledgerSentences(crewlessLines)[crewlessLines.length - 1] ===
        "⚓ No crew aboard, so there is nothing to provision.",
    "while a captain with nobody aboard has nobody to feed and is told so in one line, which is the answer that case already gives a buyer at the port",
  );
  const odd = bargeVoyage();
  const oddLines: LedgerLine[] = [];
  check(
    buyFromBarge(odd, 0.4, oddLines) === 0 &&
      odd.money === 1000 &&
      ledgerSentences(oddLines)[oddLines.length - 1] ===
        "❌ Name how many rations to buy from the barge.",
    "and a press that names no ration at all is refused in words rather than read as a zero it would quietly take and charge nothing for",
  );

  // ========== The share can never pass one ==========
  // The invariant the page's headline rests on: every Gold the vendor
  // takes is a Gold of food spending, so the numerator is inside the
  // denominator whatever a voyage buys and wherever it buys it.
  const spender = bargeVoyage(10_000);
  provisionFood(spender, "Grain", 2, []);
  const portSpend = spender.foodSpend;
  buyFromBarge(spender, 1, []);
  check(
    portSpend === 2 * RATION_PRICE &&
      spender.foodSpend === portSpend + price &&
      spender.bargeSpend === price &&
      spender.bargeSpend <= spender.foodSpend,
    "every Gold the vendor takes is booked in the denominator its share is divided by, so the page's headline can never read above one hundred percent however a voyage spends",
  );

  // ========== A save this build did not write ==========
  const nonsense = {
    ...voyageState(),
    bargeTaken: -3,
    bargeRound: 2.7,
    foodSpend: Number.NaN,
    bargeSpend: "six",
  } as unknown as GameState;
  normalizeBargeState(nonsense);
  const legacy = { ...voyageState() } as unknown as Record<string, unknown>;
  delete legacy.bargeTaken;
  delete legacy.bargeRound;
  delete legacy.foodSpend;
  delete legacy.bargeSpend;
  normalizeBargeState(legacy as unknown as GameState);
  check(
    nonsense.bargeTaken === 0 &&
      nonsense.bargeRound === 2 &&
      nonsense.foodSpend === 0 &&
      nonsense.bargeSpend === 0 &&
      legacy.bargeTaken === 0 &&
      legacy.bargeRound === 0 &&
      legacy.foodSpend === 0 &&
      legacy.bargeSpend === 0,
    "a tally this build cannot read heals to a voyage that never bought at the vendor, and a save written before the vendor existed reads the same way rather than as a captain who spent Gold nobody can account for",
  );

  // ========== The switch ==========
  check(
    withEnv(
      "NEXT_PUBLIC_SURVIVAL",
      "1",
      () => bargeOn(GAMBIT) && !bargeOn(CLASSIC),
    ),
    "the vendor belongs to the survival layer, so a Classic table never meets one whatever the environment says",
  );
  check(
    withEnv("NEXT_PUBLIC_SURVIVAL", "off", () => {
      const dark = bargeVoyage();
      const darkLines: LedgerLine[] = [];
      const sold = buyFromBarge(dark, 1, darkLines);
      return (
        !bargeOn(GAMBIT) &&
        bargePortAtRound(dark) === null &&
        bargeLotAtPort(dark) === 0 &&
        bargeLeftAtPort(dark) === 0 &&
        sold === 0 &&
        dark.money === 1000 &&
        dark.foodSpend === 0 &&
        dark.bargeSpend === 0 &&
        darkLines.length === 0
      );
    }),
    "and with the switch off there is no quay, no lot and no sale, so the base game is exactly as it was",
  );

  // ========== The page's two numbers ==========
  // Records shaped the way the spine writes one, through the builder the
  // dashboard's own suite hands on rather than through a second copy of
  // the shape. Each captain files two rounds, because the counters are the
  // voyage's running totals: the reader takes the report at their greatest
  // round, and the numbers below say which of the two rules was applied.
  const report = (
    roomId: string,
    actor: string,
    round: number,
    foodSpend: number,
    bargeSpend: number,
  ) =>
    telemetryEvent("round_report", voyageIdFor(roomId, 1), 0, {
      round,
      actor,
      ordersDealt: 0,
      ordersFilled: 0,
      distinctGoods: 0,
      foodSpend,
      bargeSpend,
    });
  const sailedWith = dashRecord("barge-with", {
    events: [
      report("barge-with", "one", 1, 240, 48),
      report("barge-with", "one", 2, 300, 60),
      report("barge-with", "two", 1, 100, 0),
    ],
  });
  const sailedWithout = dashRecord("barge-without", {
    events: [
      report("barge-without", "one", 3, 200, 0),
      report("barge-without", "two", 3, 150, 0),
    ],
  });
  // A voyage whose captains filed a report and no pair of counters, which
  // is a harbor that was not playing the provisions layer at all.
  const notPlaying = dashRecord("barge-dark", {
    events: [
      telemetryEvent("round_report", voyageIdFor("barge-dark", 1), 0, {
        round: 1,
        actor: "one",
        ordersDealt: 2,
        ordersFilled: 2,
        distinctGoods: 2,
      }),
    ],
  });

  const window = readDashboard({
    records: [sailedWith, sailedWithout, notPlaying],
    outcomes: [],
    unreadable: 0,
  });
  const shareRow = window.frontPage;
  const withoutRow = window.panels[0]?.readings[1];
  check(
    window.panels[0]?.readings[0] === window.frontPage,
    "the front page number and the seat panel's first reading are one object rather than two copies of one number, which is what keeps the page from printing a share the panel beside it disagrees with",
  );
  check(
    shareRow.label === "Barge revenue share of all food spending" &&
      shareRow.value === `${ratePercent(60 / 750)} of 750 Gold over 2 voyages`,
    "and the share is the vendor's Gold over the whole window's food spending, read at each captain's greatest round rather than by adding their rounds up, and over the two voyages that filed the pair rather than the three in the window",
  );
  check(
    shareRow.target === "no threshold in the design" &&
      shareRow.verdict === "ungated",
    "with the design setting no band on it, so the page reads it as measured and unjudged rather than inventing a threshold the design never wrote",
  );
  check(
    withoutRow?.label === "Lobbies that sailed without the Barge" &&
      withoutRow?.value === `${ratePercent(1 / 2)} of 2 lobbies` &&
      withoutRow?.target === "above 70%" &&
      withoutRow?.verdict === "under",
    "while the number the design does gate is the share of lobbies that sailed without the vendor, read over the tables rather than over the captains and judged under its own band",
  );
  check(
    window.panels[0]?.answer.startsWith("1 of 1 gates sit outside theirs") ===
      true &&
      window.panels[0]?.answer.includes(
        "Lobbies that sailed without the Barge",
      ) === true,
    "and the share of food spending is not one of the sixteen gates, so the panel counts the one gate it can read rather than two",
  );

  // A window where every table avoided the vendor is the target met: the
  // headline reads as the target held, and the share reads as no
  // denominator rather than as a share of zero.
  const avoided = readDashboard({
    records: [
      dashRecord("barge-none", {
        events: [report("barge-none", "one", 2, 0, 0)],
      }),
    ],
    outcomes: [],
    unreadable: 0,
  });
  check(
    avoided.frontPage.value === "no food bought in the window" &&
      avoided.frontPage.verdict === "ungated" &&
      avoided.panels[0]?.readings[1]?.value ===
        `${ratePercent(1)} of 1 lobby` &&
      avoided.panels[0]?.readings[1]?.verdict === "in" &&
      avoided.panels[0]?.answer ===
        "Every gate this window can read sits inside it, 1 of 1.",
    "a window where nobody bought food reads as no denominator rather than as a share of zero, while a table that avoided the vendor is the design's target met rather than a number the page hedges",
  );

  // And the window nothing has been played in, which is where the two rows
  // have to read as an absence rather than as a vendor that sold nothing.
  const empty = readDashboard({ records: [], outcomes: [], unreadable: 0 });
  check(
    empty.frontPage.value === "no round report from a provisions harbor" &&
      empty.frontPage.verdict === "unplayed" &&
      empty.panels[0]?.readings[1]?.value ===
        "no round report from a provisions harbor" &&
      empty.panels[0]?.readings[1]?.verdict === "unplayed",
    "and a window no voyage filed in reads as no report on both rows rather than as a vendor that sold nothing to nobody",
  );
  check(
    empty.panels[0]?.state === "no reading" &&
      empty.panels[0]?.answer ===
        "No reading yet: the seat's three readings are counts over an event the record carries and this page does not reduce. The Barge's own two numbers are read below.",
    "with the seat panel still reading as nothing to read on an empty window, because the vendor's two rows are reports and a report nobody filed is not a rate",
  );

  // ========== The house rule ==========
  // The row itself, with its comments taken out, because these checks are
  // about what a captain reads rather than about what the file says.
  const panelCode = withoutComments(
    readFileSync(
      join(
        import.meta.dirname,
        "..",
        "..",
        "..",
        "src/components/portmasters/game/phases/PurchaseProvisions.tsx",
      ),
      "utf8",
    ),
  );
  check(
    panelCode.includes("Supply Barge") &&
      panelCode.includes("buyFromBarge") &&
      panelCode.includes("bargePortAtRound") &&
      panelCode.includes("bargeLeftAtPort") &&
      panelCode.includes("bargeRationPrice") &&
      panelCode.includes("RATION_PRICE") &&
      !CARRIES_A_DASH.test(panelCode),
    "the row a captain presses reads the quay, the lot, the price and what a press would buy from the engine's own readers and from the port's own price constant, and what it prints carries no dash of any kind",
  );
  check(
    !carriesADash("src/lib/game/engine/barge.ts") &&
      !carriesADash("src/lib/game/dashboard.ts") &&
      !carriesADash("src/lib/use-round-report.ts") &&
      !carriesADash("src/server/realtime/wiring/round-report.ts"),
    "with every file this feature lands in carrying the house rule in its comments as well as in its code",
  );
}
