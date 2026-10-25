// PortMasters 2.2 Parallel Release, smoke run: The Larder, and the crew
// that eats from it.
//
// The Larder, and the mode boundary that stands in front of it. The crew is
// the artisan roster and the Larder is what it eats: one ration a head a
// round, bought at the market, and a shortage when the count reaches zero.
//
// The lines this article writes for a captain are handed back to the run
// rather than read here, because the house rule covers the whole set and
// the wardrobe beside it writes into the same one.
import { AUDIT_FROM_ROUND } from "@/lib/game/audit";
import { MODULES } from "@/lib/game/constants/drafts";
import {
  LARDER_MAX,
  LARDER_START,
  RATION_PRICE,
  SHORT_RATIONS_YIELD,
} from "@/lib/game/constants/supplies";
import { crewLossRuleOn, normalizeHungryRounds } from "@/lib/game/crew";
import { assignTask, hireWorker, nextPhase, refitsOn } from "@/lib/game/engine";
import {
  bazaarRumorsOn,
  escortContractsOn,
  moduleTradesOn,
  pathDraftOn,
  pathOrdersOn,
  splitHoldOn,
  survivalLayerOn,
} from "@/lib/game/flags";
import { foodRoomMeals, normalizeLarderSpoilRound } from "@/lib/game/foods";
import {
  garmentsLayerOn,
  normalizeGarmentsTickRound,
} from "@/lib/game/garments";
import { holdCapacityOn, storesMealCeiling } from "@/lib/game/hold";
import {
  feedCrew,
  normalizeLarder,
  normalizeLarderFedRound,
  onShortRations,
  provisionFood,
  shortRationsYield,
} from "@/lib/game/larder";
import { auditOpensAt, modeConfig } from "@/lib/game/mode";
import type { GameContext, GameState } from "@/lib/game/types";
import { crewSize, flatWorkerRoster } from "@/lib/game/types";
import type { LedgerLine } from "@/lib/game/ledger";
import {
  CARRIES_A_DASH,
  check,
  CLASSIC,
  GAMBIT,
  ledgerSentences,
  suffix,
  switchFor,
  voyageState,
  withEnv,
} from "../harness";

export function theLarderSuite(): LedgerLine[] {
  // ========== The Larder, and the crew that eats from it ==========
  // The crew is the artisan roster and
  // the Larder is what it eats: one ration a head a round, bought at the
  // market, and a shortage when the count reaches zero. Three things are
  // checked here and they are worth naming before the first assertion.
  //
  // The switch is read from both sides inside one run, which is the whole
  // reason survivalLayerOn is not cached. Rollback is the test of this
  // layer: with the flag off a captain eats nothing, nothing is
  // slower and nothing is drawn, and a suite that could only hold one
  // value would be checking a build the operator is not necessarily
  // running.
  //
  // The reduction is checked through the engine's own settlement rather
  // than beside it. Walking the lap from Orders into Resolve is what
  // every captain does every round, so if the slowdown only worked when
  // processProduction was called directly, this is where that shows.
  //
  // The buy is checked against both ceilings, because the hold's room and
  // the purse are two different reasons a purchase stops and a store that
  // confused them would sell a captain rations they cannot carry.
  //
  // Everything captain facing that the survival layer produces is dash
  // checked at the end of it, in one place, for the reason the manifest
  // line above is: the house rule covers every string a captain reads, and
  // the log lines these features write are read by the table. The crew's
  // own block below writes into that same accumulator rather than into a
  // second one.
  check(
    [undefined, "", "1", "on", "true", "live", "ON "].every((value) =>
      withEnv(
        "NEXT_PUBLIC_SURVIVAL",
        value,
        switchFor(GAMBIT, survivalLayerOn),
      ),
    ) &&
      ["off", "0", "OFF", " off ", "Off"].every(
        (value) =>
          !withEnv(
            "NEXT_PUBLIC_SURVIVAL",
            value,
            switchFor(GAMBIT, survivalLayerOn),
          ),
      ),
    "the provisions layer is on for every value except the word off and the digit zero, so a typo in the switch leaves the game playable rather than quietly deleting a system",
  );

  // [The mode boundary] And the other half of every switch's answer, held
  // here rather than inside each family's own block.
  //
  // The families below each check their own switch against the
  // environment, because that is the switch their own family reads. What
  // none of them can check is the rule that stands in
  // front of all ten, because the rule is about them together: Classic
  // is the shipped release and no system this branch added may reach it,
  // whatever an operator exported into the process. A check written per
  // family would be ten copies of one sentence, and the tenth is the one
  // a later feature would forget.
  //
  // So the ten are listed once, with the environment forced on rather
  // than left to whatever the runner exported, and every one of them has
  // to answer no in the shipped mode. The environment value is a real one
  // rather than undefined on purpose: a switch that answered no here
  // because the runner happened to leave the variable unset would be a
  // check that passes for the wrong reason.
  check(
    (
      [
        ["NEXT_PUBLIC_SURVIVAL", survivalLayerOn],
        ["NEXT_PUBLIC_CREW_LOSS", crewLossRuleOn],
        ["NEXT_PUBLIC_GARMENTS", garmentsLayerOn],
        ["NEXT_PUBLIC_SPLIT_HOLD", splitHoldOn],
        ["NEXT_PUBLIC_PATH_ORDERS", pathOrdersOn],
        ["NEXT_PUBLIC_ESCORT_CONTRACTS", escortContractsOn],
        ["NEXT_PUBLIC_REFITS", refitsOn],
        ["NEXT_PUBLIC_BAZAAR", bazaarRumorsOn],
        ["NEXT_PUBLIC_PATH_DRAFT", pathDraftOn],
        ["NEXT_PUBLIC_MODULE_TRADES", moduleTradesOn],
      ] as ReadonlyArray<[string, (mode: unknown) => boolean]>
    ).every(
      ([name, read]) =>
        withEnv(name, "1", () => read(CLASSIC) === false) &&
        withEnv(name, undefined, () => read(CLASSIC) === false) &&
        withEnv(name, "1", () => read(GAMBIT) === true),
    ),
    "every switch of this release answers no in the shipped mode whatever the environment says, and yes in the mode that owns it: the boundary is the mode rather than the operator's export, so a deployment serving both harbors cannot hand a Classic table a system the mode does not have",
  );

  // The same boundary for the systems that have no switch of their own,
  // because they are gated by the mode record rather than by a dial: the
  // audit's rung, the standing order and the round clock. A rung of null is
  // the whole of the first, and the two booleans below are the whole of
  // the other two.
  check(
    auditOpensAt(CLASSIC) === null &&
      auditOpensAt(GAMBIT) === AUDIT_FROM_ROUND &&
      modeConfig(CLASSIC).standingOrders === false &&
      modeConfig(GAMBIT).standingOrders === true &&
      modeConfig(CLASSIC).phaseClock === false &&
      modeConfig(GAMBIT).phaseClock === true &&
      modeConfig(CLASSIC).gambitSystems === false &&
      modeConfig(GAMBIT).gambitSystems === true,
    "the systems with no switch of their own go off with the mode as well: the shipped voyage opens no manifest, keeps no standing order and runs on no clock, and both records carry the two rungs they gate and the boundary every switch reads",
  );

  // Held on for every rule below, so this block reads the same rules
  // whatever the operator set at the door.
  const survivalLines: LedgerLine[] = [];
  withEnv("NEXT_PUBLIC_SURVIVAL", "1", () => {
    const larderCrew = voyageState();
    larderCrew.money = 1000;
    check(
      crewSize(larderCrew) === 0 && !onShortRations(larderCrew),
      "a fresh captain has nobody aboard, and an empty larder over an empty roster is not a shortage: there is nobody going without",
    );
    hireWorker(larderCrew, "weaver", survivalLines);
    hireWorker(larderCrew, "weaver", survivalLines);
    check(
      crewSize(larderCrew) === 2 &&
        flatWorkerRoster(larderCrew).length === crewSize(larderCrew) &&
        larderCrew.workers.weaver.length === 2,
      "hiring artisans is what puts a crew aboard, counted through the one helper that flattens the roster rather than in a second place that could disagree with it",
    );

    // Eating, once a round. The stamp is what makes "once" true rather than
    // hopeful, and the check is written as a second call in the same round
    // because that is the shape of the defect it prevents: a round opens
    // through more than one path, and charging a captain twice for one
    // round is silent in every screen.
    larderCrew.larder = 10;
    larderCrew.currentRound = 3;
    feedCrew(larderCrew, survivalLines);
    feedCrew(larderCrew, survivalLines);
    const ateOnce = larderCrew.larder === 8 && larderCrew.larderFedRound === 3;
    larderCrew.currentRound = 4;
    feedCrew(larderCrew, survivalLines);
    check(
      ateOnce && larderCrew.larder === 6 && larderCrew.larderFedRound === 4,
      "the crew eats one ration a head and the round is stamped, so a second call in the same round eats nothing more while the next round eats again",
    );

    // The floor, and the line that says so. A larder the crew emptied
    // reads as empty rather than in debt, and the round the shortage begins
    // is the one that says it.
    larderCrew.larder = 1;
    larderCrew.currentRound = 5;
    const shortLines: LedgerLine[] = [];
    feedCrew(larderCrew, shortLines);
    survivalLines.push(...shortLines);
    check(
      larderCrew.larder === 0 &&
        onShortRations(larderCrew) &&
        shortLines.length === 1 &&
        ledgerSentences(shortLines)[0].includes("Short rations") &&
        ledgerSentences(shortLines)[0].includes(
          `${Math.round(SHORT_RATIONS_YIELD * 100)}%`,
        ) &&
        !CARRIES_A_DASH.test(ledgerSentences(shortLines)[0]),
      "a larder the crew empties reads as empty rather than in debt, and the round announces the shortage at the pace the rule actually applies",
    );

    check(
      shortRationsYield(6) === 3 &&
        shortRationsYield(4) === 2 &&
        shortRationsYield(3) === 1 &&
        shortRationsYield(2) === 1 &&
        shortRationsYield(1) === 1 &&
        shortRationsYield(0) === 1,
      "a hungry crew works at half pace, floored at one item, because a task spends its recipe when it is assigned and a yield that rounded away to nothing would take the goods and return silence",
    );

    // The reduction through the engine's own lap. Three workshops walked
    // from Orders into Resolve with the same artisan and the same
    // materials, so the only difference between any two holds is the one
    // being read: the larder for the first pair, and the module for the
    // second. The third is hungry as well as equipped, because what it
    // settles is that the module's bonus is applied before the shortage
    // takes its share rather than after, and a fed workshop would settle
    // nothing about the order the two run in.
    const larderCtx: GameContext = {
      seedBase: `smoke:larder:${suffix}`,
      harborId: `smoke-larder-${suffix}`,
    };
    const shops: Array<{ state: GameState; label: string }> = [];
    for (const label of ["fed", "hungry", "workshop"]) {
      const state = voyageState();
      state.money = 1000;
      hireWorker(state, "weaver", []);
      state.workers.weaver[0].isSkilled = true;
      if (label === "workshop") {
        const workshop = MODULES.find((m) => m.id === "artisans_workshop");
        if (workshop) state.equippedModules.push(workshop);
      }
      assignTask(state, "weaver", "Linen Clothes", []);
      state.phase = "orders";
      // Every workshop but the fed one goes into the round with an empty
      // larder, so the shortage is the state under test rather than a
      // side effect of how much the crew happened to have.
      state.larder = label === "fed" ? LARDER_START : 0;
      shops.push({ state, label });
    }
    const before = shops.map(
      (shop) => shop.state.inventory["Linen Clothes"] ?? 0,
    );
    // Pressed until the books are settled rather than pressed once, because
    // which phase follows Orders is the mode's own decision: the founding
    // lap goes straight from the manifest to the settlement, and the lap
    // this layer belongs to puts the exchange between them. A single press
    // would walk one of those two modes into a round that makes nothing and
    // the check would read the empty hold as the rule under test. The bound
    // is the longest lap plus a margin, and it is a bound rather than a
    // count so that a lap that grows a round still walks.
    for (const shop of shops) {
      for (let step = 0; step < 8 && shop.state.phase !== "resolve"; step++) {
        nextPhase(shop.state, larderCtx, []);
      }
    }
    const made = shops.map(
      (shop, index) =>
        (shop.state.inventory["Linen Clothes"] ?? 0) - before[index],
    );
    check(
      made[0] === 2 && made[1] === 1,
      "walking the lap into Resolve makes a skilled artisan's two goods while the crew is fed and one while it is not, so the design's slower crafting lands through the engine every captain already walks rather than beside it",
    );
    check(
      made[2] === 1,
      "and an Artisan's Workshop's third good is halved to one as well, so the module's bonus is applied before the shortage takes its share rather than after",
    );

    // Buying. Two ceilings and a floor, each read on its own state so one
    // cannot be mistaken for another.
    const buyer = voyageState();
    buyer.money = 1000;
    hireWorker(buyer, "weaver", []);
    hireWorker(buyer, "weaver", []);
    // Emptied first, because a fresh voyage is handed a full opening hold
    // (see LARDER_START) and what this check is about is what a purchase
    // adds to it rather than what it was already carrying.
    buyer.larder = 0;
    const buyLines: LedgerLine[] = [];
    const boughtRounds = provisionFood(buyer, "Grain", 2, buyLines);
    check(
      boughtRounds === 2 &&
        buyer.larder === 4 &&
        buyer.money === 1000 - 4 * RATION_PRICE &&
        buyer.roundCosts === 4 * RATION_PRICE &&
        buyer.totalCosts === 4 * RATION_PRICE &&
        // The panel's own read of what still fits, made the way the panel
        // makes it: the stores' room for the food being bought, over the
        // crew it has to feed.
        Math.floor(foodRoomMeals(buyer, "Grain") / crewSize(buyer)) === 28,
      "provisioning buys a round at a time for the crew aboard, and what it spends is booked where every other purchase is booked",
    );
    const filledRoom = Math.floor(
      foodRoomMeals(buyer, "Grain") / crewSize(buyer),
    );
    const filledRounds = provisionFood(buyer, "Grain", 999, buyLines);
    check(
      filledRounds === filledRoom &&
        buyer.larder === LARDER_MAX &&
        provisionFood(buyer, "Grain", 1, buyLines) === 0 &&
        ledgerSentences(buyLines)[buyLines.length - 1] ===
          "🧺 The larder is full.",
      "a request past the hold's room fills it and stops there, and a full larder says so rather than taking a press and returning nothing",
    );

    const thin = voyageState();
    thin.money = 100;
    hireWorker(thin, "weaver", []);
    thin.money = 1;
    const thinLines: LedgerLine[] = [];
    check(
      provisionFood(thin, "Grain", 1, thinLines) === 0 && thin.money === 1,
      "and a purse that cannot cover one round of rations buys nothing rather than going into debt for it",
    );
    const crewless = voyageState();
    crewless.money = 100;
    const crewlessLines: LedgerLine[] = [];
    check(
      provisionFood(crewless, "Grain", 1, crewlessLines) === 0 &&
        crewSize(crewless) === 0 &&
        crewlessLines.length === 1,
      "while a captain with nobody aboard has nothing to provision and is told so in one line, which is the same answer that case already gives a buyer",
    );

    // Every line this block produced, gathered here rather than threaded
    // through each check, since the dash rule is about the whole set.
    survivalLines.push(...buyLines, ...thinLines, ...crewlessLines);

    // A save read back. The end a count is clamped to is the hold the
    // build is actually running, which the split hold moved: the stores'
    // own ceiling under the split and the Larder's old sixty without it. The
    // check reads that end from the model rather than writing it down,
    // so it follows the hold rather than a number the split left behind.
    const larderEnd = holdCapacityOn(GAMBIT) ? storesMealCeiling() : LARDER_MAX;
    check(
      normalizeLarder(undefined, GAMBIT) === LARDER_START &&
        normalizeLarder("seven", GAMBIT) === LARDER_START &&
        normalizeLarder(NaN, GAMBIT) === LARDER_START &&
        normalizeLarder(7.8, GAMBIT) === 7 &&
        normalizeLarder(-4, GAMBIT) === 0 &&
        normalizeLarder(larderEnd + 90, GAMBIT) === larderEnd &&
        normalizeLarderFedRound(undefined) === 0 &&
        normalizeLarderFedRound(-2) === 0 &&
        normalizeLarderFedRound(2.5) === 2,
      "a save this build cannot read heals to a full hold rather than to a hungry one, a count outside the hold's ends is clamped rather than dropped, and a missing round stamp lands on a round no voyage has",
    );

    // The four saved round stamps are one reader's work, the Larder's two,
    // the crew's run of hungry rounds and the wardrobe's tick (see wholeStamp
    // in src/lib/game/types.ts, which every one of them heals through).
    // This check holds all four to the same fraction at once, which is the
    // invariant the sharing exists to keep: it sits beside the Larder's own
    // stamp because the other three are read, by their own words, the same
    // way the Larder's is, and a path that grew its own arithmetic would
    // fail here even while its own check still passed.
    check(
      normalizeLarderFedRound(3.9) === 3 &&
        normalizeLarderSpoilRound(3.9) === 3 &&
        normalizeHungryRounds(3.9) === 3 &&
        normalizeGarmentsTickRound(3.9) === 3,
      "and the four round stamps a save can carry, the Larder's fed and spoil rounds, the crew's hungry rounds and the wardrobe's tick round, floor a fraction to the same whole round, because one reader answers for all four",
    );
  });

  return survivalLines;
}
