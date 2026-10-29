// PortMasters 2.2 Parallel Release, smoke run: Three foods, spoilage
// and the split hold.
//
// Three foods of three densities, one of them never turning, the
// order they are eaten in, and the two sizes the split hold is built out
// of.
//
// The lines this article writes for a captain are handed back to the run
// rather than read here, because the house rule covers the whole set and
// the Larder before it writes into the same one.
import {
  CARGO_SLOTS,
  FOODS,
  FOODS_DRAW_ORDER,
  LARDER_MAX,
  LARDER_START,
  PRESERVE_MEALS_IN,
  PRESERVE_MEALS_OUT,
  RATION_PRICE,
  SHORT_RATIONS_CARGO,
  STORES_SLOTS,
} from "@/lib/game/constants/supplies";
import { hireWorker, nextPhase, purchaseCard } from "@/lib/game/engine";
import { splitHoldOn } from "@/lib/game/flags";
import {
  addLot,
  drawMeals,
  foodRoomMeals,
  larderMeals,
  mealsOf,
  normalizeLarderLots,
  normalizeLarderSpoilRound,
  pantryLines,
  preserveFood,
  reconcileLarder,
  tickSpoilage,
} from "@/lib/game/foods";
import {
  cargoSlots,
  holdCapacityOn,
  storeRoomMeals,
  storesMealCeiling,
  storesSlots,
  usedCargoSlots,
  usedHoldSlots,
  usedStoreSlots,
} from "@/lib/game/hold";
import {
  cargoCapacity,
  cargoRoom,
  feedCrew,
  normalizeLarder,
  provisionFood,
} from "@/lib/game/larder";
import type { GameState } from "@/lib/game/types";
import type { LedgerLine } from "@/lib/game/ledger";
import {
  carriesADash,
  check,
  GAMBIT,
  ledgerLines,
  ledgerSentences,
  suffix,
  switchFor,
  voyageState,
  withEnv,
} from "../harness";

export function thePantrySuite(): LedgerLine[] {
  // The lines this family writes, held for the run rather than read here.
  const survivalLines: LedgerLine[] = [];
  // ========== three foods, spoilage and the split hold ==========
  // The catalogue first, because every number below is read off it: three
  // foods of three densities, one of them never turning, the order they
  // are eaten in, and the two sizes the split hold is built out of.
  check(
    Object.keys(FOODS).length === 3 &&
      FOODS.Grain.mealsPerSlot === 1 &&
      FOODS.Grain.keeps === null &&
      FOODS["Salt Fish"].mealsPerSlot === 2 &&
      FOODS["Salt Fish"].keeps === 6 &&
      FOODS.Produce.mealsPerSlot === 3 &&
      FOODS.Produce.keeps === 2 &&
      FOODS_DRAW_ORDER.join(",") === "Produce,Salt Fish,Grain" &&
      CARGO_SLOTS === 30 &&
      STORES_SLOTS === LARDER_MAX &&
      SHORT_RATIONS_CARGO === 0.75 &&
      PRESERVE_MEALS_IN === 3 &&
      PRESERVE_MEALS_OUT === 2,
    "three foods of three densities and three clocks, eaten in the order the sea takes them back: produce turns after two rounds, salt fish after six, grain never, and the split hold is thirty slots of cargo and the Larder's own sixty of stores",
  );

  // The split's own switch, read through the same policy function the
  // provisions switch is read through, so one typo cannot leave a table
  // half switched: the capacity model is a rule about provisions, so a
  // build without the Larder plays the base game whatever the split says.
  check(
    [undefined, "", "1", "on", "true", "live", "ON "].every((value) =>
      withEnv("NEXT_PUBLIC_SPLIT_HOLD", value, switchFor(GAMBIT, splitHoldOn)),
    ) &&
      ["off", "0", "OFF", " off ", "Off"].every(
        (value) =>
          !withEnv(
            "NEXT_PUBLIC_SPLIT_HOLD",
            value,
            switchFor(GAMBIT, splitHoldOn),
          ),
      ) &&
      withEnv("NEXT_PUBLIC_SURVIVAL", "off", () =>
        withEnv(
          "NEXT_PUBLIC_SPLIT_HOLD",
          "1",
          switchFor(GAMBIT, holdCapacityOn),
        ),
      ) === false &&
      withEnv("NEXT_PUBLIC_SURVIVAL", "1", () =>
        withEnv(
          "NEXT_PUBLIC_SPLIT_HOLD",
          "off",
          switchFor(GAMBIT, holdCapacityOn),
        ),
      ) === false &&
      withEnv("NEXT_PUBLIC_SURVIVAL", "1", () =>
        withEnv(
          "NEXT_PUBLIC_SPLIT_HOLD",
          "1",
          switchFor(GAMBIT, holdCapacityOn),
        ),
      ) === true,
    "the split hold is on for every value except the word off and the digit zero, and the provisions layer governs it from above, so a table can be rolled back one switch at a time without a hold size outliving the rule it belonged to",
  );

  withEnv("NEXT_PUBLIC_SPLIT_HOLD", "1", () => {
    const splitLines: LedgerLine[] = [];
    const rationCrew = 2;
    const rationRound = rationCrew * RATION_PRICE;
    const staff = (state: GameState) => {
      for (let hired = 0; hired < rationCrew; hired += 1) {
        hireWorker(state, "weaver", []);
      }
      state.money = 1000;
    };

    // ========== what a voyage leaves the pier with ==========
    // The opening hold is grain, and it is the same twelve meals the
    // Larder has always shipped, which is the continuity the whole split
    // rests on: grain fills one slot with one meal, so the account and
    // the plain number agree to the meal until a captain buys something
    // else.
    const storeFresh = voyageState();
    check(
      storeFresh.larder === LARDER_START &&
        larderMeals(storeFresh) === LARDER_START &&
        storeFresh.larderLots.length === 1 &&
        storeFresh.larderLots[0].food === "Grain" &&
        storeFresh.larderLots[0].meals === LARDER_START &&
        usedStoreSlots(storeFresh) === LARDER_START &&
        usedCargoSlots(storeFresh) === 16 &&
        usedHoldSlots(storeFresh) ===
          usedCargoSlots(storeFresh) + usedStoreSlots(storeFresh),
      "a voyage leaves the pier with its opening twelve rations as one lot of grain, and the hold reads as two halves that add up to the whole: sixteen slots of stock and twelve of stores",
    );
    check(
      storesSlots() === LARDER_MAX &&
        storesMealCeiling() === LARDER_MAX * 3 &&
        cargoSlots(false) === CARGO_SLOTS &&
        cargoSlots(true) === Math.floor(CARGO_SLOTS * SHORT_RATIONS_CARGO) &&
        storeRoomMeals(storeFresh, "Grain") === LARDER_MAX - LARDER_START &&
        foodRoomMeals(storeFresh, "Grain") === LARDER_MAX - LARDER_START &&
        foodRoomMeals(storeFresh, "Produce") ===
          (LARDER_MAX - LARDER_START) * 3,
      "the stores are the Larder's old ceiling to the slot, so the same sixty slots hold sixty meals of grain, a hundred and twenty of salt fish or a hundred and eighty of produce, and what a captain can still buy is read in rounds off the food they are buying",
    );

    // ========== buying, by the food ==========
    // Two rounds of salt fish, twice, because the second purchase is the
    // one that would show a doubled lot or a count that drifted: the
    // same food bought in the same round merges into the lot already
    // aboard, and the price of a meal does not move with the food.
    const buyFoods = voyageState();
    staff(buyFoods);
    const buyFoodLines: LedgerLine[] = [];
    const firstBuy = provisionFood(buyFoods, "Salt Fish", 2, buyFoodLines);
    const secondBuy = provisionFood(buyFoods, "Salt Fish", 2, buyFoodLines);
    splitLines.push(...buyFoodLines);
    check(
      firstBuy === 2 &&
        secondBuy === 2 &&
        buyFoods.larder === LARDER_START + 8 &&
        mealsOf(buyFoods, "Salt Fish") === 8 &&
        buyFoods.larderLots.filter((lot) => lot.food === "Salt Fish").length ===
          1 &&
        buyFoods.money === 1000 - 4 * rationRound &&
        buyFoods.roundCosts === 4 * rationRound &&
        usedStoreSlots(buyFoods) === LARDER_START + 4 &&
        buyFoodLines.length === 2,
      "salt fish buys at two meals a slot, four meals for two rounds of a crew of two at the same price a meal of grain costs, and a second purchase in the same round merges into the lot already aboard rather than starting a second one with the same age",
    );

    // ========== the order the sea takes things back ==========
    // One meal a round for a crew of one, out of a pantry holding all
    // three foods, walked round by round so a reader sees which food fed
    // which round: produce first because it turns soonest, then salt
    // fish, then the grain nothing can be wrong about.
    const eatOrder = voyageState();
    eatOrder.money = 1000;
    hireWorker(eatOrder, "weaver", []);
    eatOrder.larder = 17;
    eatOrder.larderLots = [];
    addLot(eatOrder, "Grain", 12, 0);
    addLot(eatOrder, "Salt Fish", 2, 0);
    addLot(eatOrder, "Produce", 3, 4);
    const drewOrder: string[] = [];
    for (let round = 4; round <= 10; round += 1) {
      eatOrder.currentRound = round;
      const before = FOODS_DRAW_ORDER.map((food) => mealsOf(eatOrder, food));
      feedCrew(eatOrder, []);
      FOODS_DRAW_ORDER.forEach((food, index) => {
        if (mealsOf(eatOrder, food) < before[index]) drewOrder.push(food);
      });
    }
    check(
      drewOrder.join(",") ===
        "Produce,Produce,Produce,Salt Fish,Salt Fish,Grain,Grain" &&
        eatOrder.larder === 10 &&
        mealsOf(eatOrder, "Grain") === 10 &&
        mealsOf(eatOrder, "Produce") === 0 &&
        mealsOf(eatOrder, "Salt Fish") === 0,
      "the crew eats what spoils first, one meal a round: three rounds of produce, then two of salt fish, then grain, and the count follows the account down whichever food the meal came out of",
    );

    // The draw read for what it returns rather than for what it was
    // asked: a pantry that cannot cover the meal takes what is there and
    // says so, which is the answer the meal above uses to leave a
    // shortage standing rather than to conjure rations.
    const shortDraw = voyageState();
    shortDraw.larder = 2;
    shortDraw.larderLots = [{ food: "Produce", meals: 2, boughtRound: 0 }];
    check(
      drawMeals(shortDraw, 5.9) === 2 && larderMeals(shortDraw) === 0,
      "a draw for more meals than the pantry holds takes what is there rather than conjuring the difference, and a fraction of a meal is not a meal",
    );

    // ========== spoilage, stamped once a round ==========
    // Produce bought at one market is food for that round and the one
    // after it and is gone at the second Dusk, counted from the round it
    // was bought in. The stamp is what makes "once a round" true rather
    // than hopeful, the same way the meal's own stamp does, and the
    // second tick in the same round is written out because that is the
    // shape of the defect it prevents.
    const turnPot = voyageState();
    turnPot.larder = 18;
    turnPot.larderLots = [];
    addLot(turnPot, "Grain", 12, 0);
    addLot(turnPot, "Produce", 6, 1);
    turnPot.currentRound = 1;
    const turnLines: LedgerLine[] = [];
    tickSpoilage(turnPot, turnLines);
    turnPot.currentRound = 2;
    tickSpoilage(turnPot, turnLines);
    const keptFresh =
      turnLines.length === 0 &&
      turnPot.larder === 18 &&
      mealsOf(turnPot, "Produce") === 6;
    turnPot.currentRound = 3;
    tickSpoilage(turnPot, turnLines);
    tickSpoilage(turnPot, turnLines);
    splitLines.push(...turnLines);
    check(
      keptFresh &&
        turnPot.larder === 12 &&
        mealsOf(turnPot, "Produce") === 0 &&
        mealsOf(turnPot, "Grain") === 12 &&
        turnPot.larderLots.length === 1 &&
        turnPot.larderSpoilRound === 3 &&
        turnLines.length === 1 &&
        ledgerSentences(turnLines)[0].includes("🥬") &&
        ledgerSentences(turnLines)[0].includes(
          "6 rations of Produce turned at sea",
        ) &&
        ledgerSentences(turnLines)[0].includes("12 left in the larder"),
      "produce is food for the round it arrived in and the one after it, and on the second Dusk it turns: the count comes down with the account in the same statement, and a second tick in the same round is not a second loss",
    );

    // Salt fish lasts six, so the same walk one food over turns on the
    // seventh round rather than the third, and grain is never asked at
    // all: a food whose keeping is null is a lot no Dusk can touch.
    const keepPot = voyageState();
    keepPot.larder = 4;
    keepPot.larderLots = [{ food: "Salt Fish", meals: 4, boughtRound: 1 }];
    keepPot.currentRound = 6;
    const keepPotLines: LedgerLine[] = [];
    tickSpoilage(keepPot, keepPotLines);
    const heldSix = keepPot.larder === 4 && mealsOf(keepPot, "Salt Fish") === 4;
    keepPot.currentRound = 7;
    tickSpoilage(keepPot, keepPotLines);
    splitLines.push(...keepPotLines);
    check(
      heldSix &&
        keepPot.larder === 0 &&
        keepPotLines.length === 1 &&
        ledgerSentences(keepPotLines)[0].includes("🐟"),
      "salt fish keeps six rounds from the market it was bought at and turns on the seventh, which is the long clock a preserve buys",
    );
    const everGrain = voyageState();
    everGrain.currentRound = 40;
    const everLines: LedgerLine[] = [];
    tickSpoilage(everGrain, everLines);
    check(
      everLines.length === 0 &&
        everGrain.larder === LARDER_START &&
        larderMeals(everGrain) === LARDER_START,
      "and grain is never asked: a food that keeps forever is a lot no round, however long the voyage, can take back",
    );

    // The pantry as a screen reads it, which is the number the market's
    // own keeping line is built from: what is aboard and how many rounds
    // the oldest of it has left.
    const lotScreen = voyageState();
    lotScreen.larder = 3;
    lotScreen.larderLots = [];
    addLot(lotScreen, "Produce", 3, 4);
    lotScreen.currentRound = 5;
    const atFive = pantryLines(lotScreen);
    lotScreen.currentRound = 6;
    const atSix = pantryLines(lotScreen);
    lotScreen.currentRound = 9;
    const atNine = pantryLines(lotScreen);
    check(
      atFive.length === 1 &&
        atFive[0].food === "Produce" &&
        atFive[0].meals === 3 &&
        atFive[0].legsLeft === 1 &&
        atSix[0].legsLeft === 0 &&
        atNine[0].legsLeft === 0,
      "the pantry a captain reads says what is aboard and how many rounds the oldest of it has left, floored at the Dusk it turns rather than counting into the past",
    );

    // ========== preserving, at the catalogue's ratio ==========
    // Three meals of produce into two of salt fish at the same slot and
    // the same price, so the third meal is what a captain pays for a
    // fresh clock. The trade is about keeping rather than quantity, and
    // the hold it costs is the same hold either way.
    const cookPot = voyageState();
    cookPot.larder = 7;
    cookPot.larderLots = [{ food: "Produce", meals: 7, boughtRound: 0 }];
    const slotsBefore = usedStoreSlots(cookPot);
    const cookPotLines: LedgerLine[] = [];
    const batches = preserveFood(cookPot, cookPotLines);
    const refusedPotLines: LedgerLine[] = [];
    const secondBatches = preserveFood(cookPot, refusedPotLines);
    splitLines.push(...cookPotLines, ...refusedPotLines);
    check(
      batches === 2 &&
        cookPot.larder === 5 &&
        mealsOf(cookPot, "Produce") === 1 &&
        mealsOf(cookPot, "Salt Fish") === 4 &&
        Math.abs(usedStoreSlots(cookPot) - slotsBefore) < 1e-9 &&
        cookPotLines.length === 1 &&
        ledgerSentences(cookPotLines)[0].includes(
          "Preserved 6 rations of Produce into 4 of Salt Fish",
        ) &&
        secondBatches === 0 &&
        refusedPotLines.length === 1 &&
        ledgerSentences(refusedPotLines)[0].includes("Not enough Produce"),
      "preserving turns three meals of produce into two of salt fish at the same slots and the same price, and a pantry with less than a batch aboard is told why rather than served a fraction of one",
    );

    // ========== the ceiling, reached rather than overshot ==========
    // A captain who asks for more rounds than the stores have room for
    // buys the room exactly, and the next meal of grain is the purchase
    // that finds them full, which is the line the Larder has always
    // shipped and the reason the ration purchase kept its old name: a
    // captain buying rations without naming a food is buying the food
    // that never turns.
    const fullPot = voyageState();
    staff(fullPot);
    const fullPotLines: LedgerLine[] = [];
    const fillRounds = provisionFood(fullPot, "Produce", 999, fullPotLines);
    const fullRoom = foodRoomMeals(fullPot, "Grain");
    const overfill = provisionFood(fullPot, "Grain", 1, fullPotLines);
    splitLines.push(...fullPotLines);
    check(
      fillRounds === 72 &&
        fullPot.larder === LARDER_START + 144 &&
        usedStoreSlots(fullPot) === STORES_SLOTS &&
        fullRoom === 0 &&
        overfill === 0 &&
        ledgerSentences(fullPotLines)[1] === "🧺 The larder is full.",
      "the stores are reached rather than overshot: a captain asking for more rounds than fit buys the hold exactly full of the food that fills it densest, and the next purchase is told the larder is full in the words the Larder shipped",
    );

    // ========== the quarter a hungry crew costs the cargo ==========
    // The short rations clause, landed on the single capacity read: a
    // quarter off the cargo while the crew is on short rations, and
    // nothing at all when the hold has no size. The card below is refused
    // by the market rather than by the hold, because the market is the
    // door that sells, and the same card buys without complaint one meal
    // later, which is what makes the shortage a cost rather than a wall.
    const hungryShip = voyageState();
    staff(hungryShip);
    hungryShip.larder = 0;
    hungryShip.larderLots = [];
    const heavyCard = {
      id: 9001,
      port: "Smoke Harbor",
      resources: [{ type: "Hemp", quantity: 7, price: 10, materialCost: 0 }],
      totalCost: 20,
      isProductCard: false,
    };
    hungryShip.resourceCards = [heavyCard];
    const quarterLines: LedgerLine[] = [];
    purchaseCard(hungryShip, heavyCard.id, quarterLines);
    const stayedHungry =
      quarterLines.length === 1 &&
      ledgerSentences(quarterLines)[0].includes(
        "it takes 7 slots and 6 are free",
      ) &&
      hungryShip.inventory.Hemp === 8 &&
      hungryShip.money === 1000 &&
      cargoCapacity(hungryShip) ===
        Math.floor(CARGO_SLOTS * SHORT_RATIONS_CARGO) &&
      cargoRoom(hungryShip) === 6;
    hungryShip.larder = LARDER_START;
    hungryShip.larderLots = [];
    addLot(hungryShip, "Grain", LARDER_START, 0);
    const fedShipLines: LedgerLine[] = [];
    purchaseCard(hungryShip, heavyCard.id, fedShipLines);
    splitLines.push(...quarterLines, ...fedShipLines);
    check(
      stayedHungry &&
        hungryShip.inventory.Hemp === 15 &&
        hungryShip.money === 1000 - heavyCard.totalCost &&
        cargoCapacity(hungryShip) === CARGO_SLOTS &&
        cargoRoom(hungryShip) === CARGO_SLOTS - 23,
      "a crew on short rations costs the cargo a quarter, so a lot one slot too large for the hungry hold is turned away with the numbers it was measured against, and the same lot buys the moment the crew has eaten",
    );

    // ========== a save written by hand ==========
    // The same reading the Larder's own number gets, one family down:
    // lots the catalogue does not know are dropped rather than carried,
    // a lot with nothing in it is not a lot, a save with no account
    // heals onto the count as grain, and a count is clamped to the hold
    // it is actually in rather than to the ceiling a build once had.
    check(
      normalizeLarderLots(undefined, LARDER_START)[0].food === "Grain" &&
        normalizeLarderLots(undefined, LARDER_START)[0].meals ===
          LARDER_START &&
        normalizeLarderLots("Brocade", 5)[0].meals === 5 &&
        normalizeLarderLots([], 0).length === 0 &&
        normalizeLarderLots(
          [
            { food: "Brocade", meals: 3, boughtRound: 1 },
            null,
            7,
            {},
            { food: "Produce", meals: -2, boughtRound: 0 },
            { food: "Grain", meals: 0, boughtRound: 0 },
            { food: "Produce", meals: 6.8, boughtRound: 2.9 },
          ],
          LARDER_START,
        ).length === 1 &&
        normalizeLarderLots(
          [{ food: "Produce", meals: 6.8, boughtRound: 2.9 }],
          0,
        )[0].meals === 6 &&
        normalizeLarderLots(
          Array.from({ length: 70 }, () => ({
            food: "Produce",
            meals: 3,
            boughtRound: 0,
          })),
          0,
        ).length === 64 &&
        normalizeLarderSpoilRound(undefined) === 0 &&
        normalizeLarderSpoilRound(-2) === 0 &&
        normalizeLarderSpoilRound(3.9) === 3,
      "a pantry read off a save drops the lots the catalogue does not know, floors what a portion is and what round it was bought at, keeps the sixty four lots a voyage can legitimately carry, and reads a missing stamp as a round no voyage has",
    );
    check(
      normalizeLarder(180, GAMBIT) === 180 &&
        normalizeLarder(-4, GAMBIT) === 0 &&
        normalizeLarder("sixty", GAMBIT) === LARDER_START &&
        normalizeLarder(3.9, GAMBIT) === 3 &&
        withEnv("NEXT_PUBLIC_SPLIT_HOLD", "off", () =>
          normalizeLarder(180, GAMBIT),
        ) === LARDER_MAX,
      "a Larder read off a save is clamped to the hold it is actually in: the stores' own ceiling under the split, which is sixty meals of grain or a hundred and eighty of produce, and the old sixty with the split switched off",
    );

    // ========== a count and an account that have parted ==========
    // The one writer that makes them agree, read in both directions,
    // because a hand that writes one of the two and not the other is
    // what every scenario in this file is: the count is the game's and
    // the account is what a crew eats from, and grain is what absorbs
    // the difference either way.
    const partedPot = voyageState();
    partedPot.larder = 0;
    const partedLines = pantryLines(partedPot);
    reconcileLarder(partedPot);
    const emptied =
      partedPot.larderLots.length === 0 && larderMeals(partedPot) === 0;
    partedPot.larder = 30;
    reconcileLarder(partedPot);
    check(
      partedLines.length === 1 &&
        partedLines[0].meals === LARDER_START &&
        emptied &&
        larderMeals(partedPot) === 30 &&
        mealsOf(partedPot, "Grain") === 30 &&
        partedPot.larderLots.length === 1,
      "a pantry a screen draws while the count says zero is the account rather than the count, and reconciling a state parted either way lands the difference on grain: the food that never turns is the one that can take an unknown age without lying about one",
    );

    // ========== the tick through the engine's own lap ==========
    // Spoilage belongs on the deterministic resolve step rather than on a
    // clock, so the check walks the phase every captain
    // already walks: a round ends, the settlement tick reads the pantry,
    // and the produce the voyage carried through it is gone.
    const spoilWalk = voyageState();
    spoilWalk.money = 1000;
    spoilWalk.larder = 18;
    spoilWalk.larderLots = [];
    addLot(spoilWalk, "Grain", 12, 0);
    addLot(spoilWalk, "Produce", 6, 0);
    spoilWalk.currentRound = 2;
    spoilWalk.phase = "resolve";
    spoilWalk.pirateAttackResolved = true;
    const spoilWalkLines: LedgerLine[] = [];
    nextPhase(
      spoilWalk,
      {
        seedBase: `smoke:foods:${suffix}`,
        harborId: `smoke-foods-${suffix}`,
      },
      spoilWalkLines,
    );
    splitLines.push(...ledgerLines(spoilWalkLines, "turned at sea"));
    check(
      spoilWalk.larderSpoilRound === 2 &&
        mealsOf(spoilWalk, "Produce") === 0 &&
        mealsOf(spoilWalk, "Grain") === 12 &&
        spoilWalk.larder === LARDER_START &&
        ledgerSentences(spoilWalkLines).some((line) =>
          line.includes("turned at sea"),
        ),
      "the settlement tick is where the sea takes its food back, in the phase every captain already walks and on the round number rather than on any clock",
    );

    // ========== the switch, off ==========
    // The rollback is one switch, and with it off this feature is not
    // running at all: no meal, no rot, no purchase, no
    // conversion, no stamp written and no mark left, and the room reads
    // the Larder's own ceiling again rather than the stores'.
    check(
      withEnv("NEXT_PUBLIC_SURVIVAL", "off", () => {
        const darkShip = voyageState();
        darkShip.money = 1000;
        darkShip.currentRound = 3;
        hireWorker(darkShip, "weaver", []);
        darkShip.larder = 0;
        darkShip.larderLots = [];
        const darkLines: LedgerLine[] = [];
        const fed = feedCrew(darkShip, darkLines);
        const ateStamp = darkShip.larderFedRound;
        tickSpoilage(darkShip, darkLines);
        const spoilStamp = darkShip.larderSpoilRound;
        const bought = provisionFood(darkShip, "Produce", 2, darkLines);
        const preserved = preserveFood(darkShip, darkLines);
        return (
          !fed &&
          ateStamp === 0 &&
          spoilStamp === 0 &&
          bought === 0 &&
          preserved === 0 &&
          darkLines.length === 0 &&
          holdCapacityOn(GAMBIT) === false &&
          cargoCapacity(darkShip) === Number.POSITIVE_INFINITY &&
          foodRoomMeals(darkShip, "Produce") === LARDER_MAX &&
          normalizeLarder(180, GAMBIT) === LARDER_MAX
        );
      }),
      "with the provisions layer off the pantry is a plain number again: no meal drawn, nothing turned, nothing bought or preserved and no stamp written, and the room a captain reads is the Larder's own ceiling rather than a stores the rule is not running",
    );
    // Every line this feature wrote, into the one accumulator the family
    // is read through at the end of this section, so the dash rule
    // covers the pantry's own sentences as well as the Larder's.
    survivalLines.push(...splitLines);
  });

  // The files this feature owns, read as files rather than asserted
  // about, the same reading the crew's own files get above, so the house
  // rule covers their comments as well as the strings they build. The
  // two files that carry the spine's own banners are read by the checks
  // that own them instead, since a banner is drawn with the characters
  // the rule is about.
  check(
    !carriesADash("src/lib/game/foods.ts") &&
      !carriesADash("src/lib/game/hold.ts") &&
      !carriesADash("src/lib/game/flags.ts") &&
      !carriesADash("src/lib/game/larder.ts") &&
      !carriesADash("src/lib/game/engine/lifecycle.ts"),
    "and the four modules the pantry, the hold and the two switches live in, and the settlement that ticks them, hold the house rule in their comments as well as in their code",
  );
  check(
    !carriesADash("src/lib/game/engine/market.ts") &&
      !carriesADash("src/lib/game/dashboard.ts") &&
      !carriesADash("src/lib/game/integrity.ts") &&
      !carriesADash("src/lib/use-round-report.ts") &&
      !carriesADash("src/types/realtime") &&
      !carriesADash("src/server/realtime/index.ts") &&
      !carriesADash("src/components/portmasters/game/phases/Purchase.tsx"),
    "and the four screens and the wire the split reaches, the market that refuses a lot for room, the dashboard that reads the hold, the integrity note, the round report and its server side, and the Provisions panel a captain buys from, hold it too",
  );

  return survivalLines;
}
