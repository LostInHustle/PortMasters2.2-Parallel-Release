// PortMasters 2.2 Parallel Release, smoke run: The clothes, and the
// cold.
//
// One data model for three jobs. A garment is a good with a
// warmth rating and a durability, a round carries a weather tag, and the
// check between them decides who freezes.
//
// The lines this article writes for a captain are handed back to the run
// rather than read here, because the house rule covers the whole set and
// the Larder before it writes into the same one.
import {
  COLD_ROUND_CHANCE,
  COLD_ROUND_WARMTH,
  GARMENTS,
  GARMENT_DECAY_COLD_ROUND,
  GARMENT_DECAY_PER_ROUND,
  RAG_SCRAP_VALUE,
} from "@/lib/game/constants/garments";
import { assignTask, hireWorker, nextPhase } from "@/lib/game/engine";
import { processProduction } from "@/lib/game/engine/workers";
import {
  garmentSpec,
  garmentWarmth,
  garmentsLayerOn,
  isFrostbitten,
  legIsCold,
  normalizeGarments,
  normalizeGarmentsTickRound,
  shortOfWarmth,
  tickGarments,
  warmthScore,
  warmthText,
  wearGarment,
} from "@/lib/game/garments";
import type { GameState } from "@/lib/game/types";
import type { LedgerLine } from "@/lib/game/ledger";
import {
  carriesADash,
  check,
  GAMBIT,
  ledgerSentences,
  suffix,
  switchFor,
  voyageState,
  withEnv,
} from "../harness";

export function theColdSuite(): LedgerLine[] {
  // The lines this family writes, held for the run rather than read here.
  const survivalLines: LedgerLine[] = [];
  // ========== The clothes, and the cold ==========
  // One data model for three jobs: a garment
  // is a good with a warmth rating and a durability, a round carries a
  // weather tag, and the check between them decides who freezes. Four
  // things about that are worth naming before the first assertion.
  //
  // The tag is drawn rather than stored, so what is checked is that it
  // belongs to the harbor rather than to a captain: the same voyage answers
  // the same way on every read, two captains holding different goods read
  // the same round the same way, and a save carried through a round trip
  // answers it the same way again. That is what lets the forecast be read
  // in the browser with no wire field behind it and no clock in it.
  //
  // The check is read on both sides of its own line. A rule that only ever
  // bit or only ever spared would pass every other check down here, so one
  // cold round is sailed twice, once bare and once dressed, and the two
  // voyages have to come out differently.
  //
  // The decay is read in the units the model gives it and read twice in one
  // round, because a round opens through more than one path and a wardrobe
  // that decayed twice for one round is a durability bar the player cannot
  // see moving.
  //
  // And the whole thing is walked once through the engine's own Resolve,
  // for the reason the Larder's reduction is walked through the lap: the
  // tick belongs inside settlement on the deterministic resolve step, and
  // a tick that only landed when it was called by name is
  // exactly the defect that check exists to catch.
  check(
    [undefined, "", "1", "on", "true", "live", "ON "].every((value) =>
      withEnv(
        "NEXT_PUBLIC_GARMENTS",
        value,
        switchFor(GAMBIT, garmentsLayerOn),
      ),
    ) &&
      ["off", "0", "OFF", " off ", "Off"].every(
        (value) =>
          !withEnv(
            "NEXT_PUBLIC_GARMENTS",
            value,
            switchFor(GAMBIT, garmentsLayerOn),
          ),
      ),
    "the garments layer is on for every value except the word off and the digit zero, read through the same policy the two switches above it are read through rather than through a third copy of it",
  );

  withEnv("NEXT_PUBLIC_SURVIVAL", "1", () =>
    withEnv("NEXT_PUBLIC_GARMENTS", "1", () => {
      // The catalogue, before any rule that reads it.
      check(
        Object.keys(GARMENTS).length === 3 &&
          GARMENTS["Linen Clothes"].warmth === 1 &&
          GARMENTS["Linen Clothes"].durability === 6 &&
          GARMENTS["Cotton Clothes"].warmth === 2 &&
          GARMENTS["Cotton Clothes"].durability === 8 &&
          GARMENTS.Brocade.warmth === 3 &&
          GARMENTS.Brocade.durability === 10,
        "the three garments carry the design's own numbers, one warmth with six of durability, two with eight and three with ten, and nothing else in the tree is clothes",
      );
      check(
        garmentSpec("Brocade") !== null &&
          garmentSpec("Linen") === null &&
          garmentSpec("toString") === null &&
          garmentSpec(7) === null &&
          garmentWarmth(null) === 0 &&
          garmentWarmth({ good: "Sachet", durability: 9 }) === 0,
        "and a good is read as a garment only when the catalogue says so, so a save naming a raw material, a key the object's prototype happens to carry, or the one finished good the design leaves out is read as a captain with nothing on rather than as warmth nobody can account for",
      );

      // Wearing, and the ways it refuses, on a round that is actually asking
      // for warmth: the cold round is found by asking the rule rather than
      // written down as a number that was cold once, the same way the
      // weather checks below find theirs. The hire writes into a throwaway
      // log so the lines counted below are the wardrobe's own.
      const wardrobe = voyageState();
      wardrobe.money = 1000;
      for (let round = 1; round <= 60 && !legIsCold(wardrobe); round++) {
        wardrobe.currentRound = round;
      }
      const dressLines: LedgerLine[] = [];
      const crewless = wearGarment(wardrobe, "Brocade", dressLines) === false;
      hireWorker(wardrobe, "weaver", []);
      const emptyHold = wearGarment(wardrobe, "Brocade", dressLines) === false;
      wardrobe.inventory.Brocade = 2;
      const notClothes = wearGarment(wardrobe, "Linen", dressLines) === false;
      const wornNow = wearGarment(wardrobe, "Brocade", dressLines);
      check(
        crewless &&
          emptyHold &&
          notClothes &&
          wornNow &&
          wardrobe.inventory.Brocade === 1 &&
          wardrobe.garments.length === 1 &&
          wardrobe.garments[0].good === "Brocade" &&
          wardrobe.garments[0].durability === GARMENTS.Brocade.durability &&
          dressLines.length === 4 &&
          ledgerSentences(dressLines)[3].includes(
            `Warmth ${GARMENTS.Brocade.warmth}`,
          ),
        "putting a garment on takes it out of the hold and onto the crew at its full durability, and the three ways it can fail each say why: nobody aboard, nothing of that good in the hold, or a good that is not clothing at all",
      );

      // The two presses the need rule turns away, which the field asked
      // for after closets walked onto backs no cold had asked about: a
      // crew the cold round is already answered for, and a crew the sea is
      // not asking anything of at all. Neither spends a stitch.
      const dressedAgain =
        wearGarment(wardrobe, "Brocade", dressLines) === false;
      const mildDress = voyageState();
      mildDress.money = 1000;
      for (let round = 1; round <= 60 && legIsCold(mildDress); round++) {
        mildDress.currentRound = round;
      }
      hireWorker(mildDress, "weaver", []);
      mildDress.inventory["Linen Clothes"] = 1;
      const mildLines: LedgerLine[] = [];
      const mildRefused =
        wearGarment(mildDress, "Linen Clothes", mildLines) === false;
      check(
        dressedAgain &&
          wardrobe.inventory.Brocade === 1 &&
          wardrobe.garments.length === 1 &&
          dressLines.length === 5 &&
          ledgerSentences(dressLines)[4].includes(
            "already meets this cold round",
          ) &&
          mildRefused &&
          mildDress.inventory["Linen Clothes"] === 1 &&
          (mildDress.garments ?? []).length === 0 &&
          mildLines.length === 1 &&
          ledgerSentences(mildLines)[0].includes("mild this round") &&
          !shortOfWarmth(mildDress),
        "while a crew the round is not asking about is left in the hold exactly as found: a second press on a cold round already answered and a press on a mild round are each turned away with the reason the wardrobe is shut, so clothes stop walking onto backs for rounds that asked for nothing and the hold keeps what it carried",
      );

      // The sum, and the multiplier under it. The wardrobe is set rather
      // than dressed on, because dressing a crew past the round's own cold
      // is exactly what the need check above turns away: this fixture is
      // about the arithmetic rather than about the way in.
      const tailor = voyageState();
      tailor.money = 1000;
      hireWorker(tailor, "weaver", []);
      tailor.garments = [
        {
          good: "Linen Clothes",
          durability: GARMENTS["Linen Clothes"].durability,
        },
        {
          good: "Cotton Clothes",
          durability: GARMENTS["Cotton Clothes"].durability,
        },
        { good: "Brocade", durability: GARMENTS.Brocade.durability },
      ];
      const aWholeBack = warmthScore(tailor) === 1 + 2 + 3;
      tailor.garments[1].durability = 4;
      tailor.garments[2].durability = 8;
      const partWorn = warmthScore(tailor);
      check(
        aWholeBack &&
          warmthText(warmthScore(voyageState())) === "0" &&
          Math.abs(garmentWarmth(tailor.garments[2]) - 2.4) < 1e-9 &&
          Math.abs(partWorn - 4.4) < 1e-9 &&
          warmthText(partWorn) === "4.4",
        "the warmth score is the design's sum, one and two and three for a whole back and four and four tenths once the sea has had part of two of them, because a garment is worth its rating times the fraction of itself that is left rather than a number that steps down a rung at a time",
      );

      // The tag: drawn, deterministic, harbor wide and replayable.
      const weather = voyageState();
      weather.voyageEpoch = 4242;
      weather.currentRound = 4;
      const thisRound = legIsCold(weather);
      const mate = voyageState();
      mate.voyageEpoch = 4242;
      mate.currentRound = 4;
      mate.money = 77;
      mate.score = 19;
      mate.inventory.Brocade = 3;
      hireWorker(mate, "potter", []);
      const recalled = JSON.parse(JSON.stringify(weather)) as GameState;
      check(
        legIsCold(weather) === thisRound &&
          legIsCold(mate) === thisRound &&
          legIsCold(recalled) === thisRound,
        "the round's weather is drawn rather than stored: the same voyage answers the same way on every read, a second captain holding different goods and a different purse reads the same round the same way, and a save carried through a round trip answers it the same way again",
      );
      // Over a hundred rounds of one voyage the draw has to be a rate rather
      // than a rule, so the count is read against the chance the constants
      // file states rather than against a number written down here. The
      // bounds are wide enough to hold the rate and far too narrow to hold
      // a tag that always says the same thing.
      const weatherRun = voyageState();
      weatherRun.voyageEpoch = 4242;
      let coldRounds = 0;
      for (let round = 1; round <= 100; round++) {
        weatherRun.currentRound = round;
        if (legIsCold(weatherRun)) coldRounds++;
      }
      check(
        coldRounds >= 100 * COLD_ROUND_CHANCE * 0.5 &&
          coldRounds <= 100 * COLD_ROUND_CHANCE * 1.5,
        "and across a hundred rounds of one voyage roughly three in ten come up cold, so the weather is a rate a captain sails through rather than a rule that always bites or never does",
      );

      // The two rounds the checks below stand on, found by asking the rule
      // rather than written down as numbers that were cold once.
      const calendar = voyageState();
      calendar.voyageEpoch = 4242;
      const findRound = (cold: boolean) => {
        for (let round = 1; round <= 60; round++) {
          calendar.currentRound = round;
          if (legIsCold(calendar) === cold) return round;
        }
        return -1;
      };
      const coldRound = findRound(true);
      const mildRound = findRound(false);
      check(
        coldRound > 0 && mildRound > 0,
        "and a cold round and a mild one both turn up in the first sixty of a voyage, which is the floor the rest of these checks stand on",
      );

      // The same cold round, sailed bare.
      const freezing = voyageState();
      freezing.voyageEpoch = 4242;
      freezing.money = 1000;
      freezing.currentRound = coldRound;
      hireWorker(freezing, "weaver", []);
      hireWorker(freezing, "weaver", []);
      const elderHand = freezing.workers.weaver[0].name;
      const newestHand = freezing.workers.weaver[1].name;
      const bareLines: LedgerLine[] = [];
      const warned = shortOfWarmth(freezing);
      tickGarments(freezing, bareLines);
      check(
        warned &&
          freezing.garmentsTickRound === coldRound &&
          isFrostbitten(freezing.workers.weaver[1], coldRound + 1) &&
          freezing.workers.weaver[1].frostbittenRound === coldRound + 1 &&
          !isFrostbitten(freezing.workers.weaver[0], coldRound + 1) &&
          ledgerSentences(bareLines).some((line) =>
            line.includes("falls short"),
          ) &&
          ledgerSentences(bareLines).some(
            (line) => line.includes("Frostbite") && line.includes(newestHand),
          ) &&
          !ledgerSentences(bareLines).some(
            (line) => line.includes("Frostbite") && line.includes(elderHand),
          ),
        "a cold round met with nothing on takes the newest hand by name and stands them down for the round after the one they froze through, so the rule that chooses who pays for the cold is the same newest aboard the loss of a hand is taken from rather than a second draw",
      );

      // And the same round again, dressed. Two of warmth is what the round
      // asks, so this is the check read on its other side.
      const warmCrew = voyageState();
      warmCrew.voyageEpoch = 4242;
      warmCrew.money = 1000;
      warmCrew.currentRound = coldRound;
      hireWorker(warmCrew, "weaver", []);
      warmCrew.inventory["Cotton Clothes"] = 1;
      wearGarment(warmCrew, "Cotton Clothes", []);
      // Read before the tick, because the tick is the round that just ended:
      // what the check is about is the warmth the crew met the round with,
      // and by the time the settlement returns, the same pair is worth less
      // than the round asked for and reads as short for the next one.
      const dressedInTime =
        warmthScore(warmCrew) >= COLD_ROUND_WARMTH && !shortOfWarmth(warmCrew);
      const warmLines: LedgerLine[] = [];
      tickGarments(warmCrew, warmLines);
      check(
        dressedInTime &&
          warmCrew.workers.weaver[0].frostbittenRound === undefined &&
          ledgerSentences(warmLines).some((line) => line.includes("enough")) &&
          !ledgerSentences(warmLines).some((line) =>
            line.includes("Frostbite"),
          ),
        "while the same cold round met with two of warmth costs nobody anything: one pair of Cotton Clothes is enough for it, the settlement says so, and the hand who froze on the bare voyage beside this one is still at the bench",
      );

      // The mark lasts the one round it names.
      freezing.currentRound = coldRound + 1;
      freezing.garments = [
        { good: "Brocade", durability: GARMENTS.Brocade.durability },
      ];
      tickGarments(freezing, []);
      const downForTheirRound = isFrostbitten(
        freezing.workers.weaver[1],
        coldRound + 1,
      );
      freezing.currentRound = coldRound + 2;
      freezing.garments = [
        { good: "Brocade", durability: GARMENTS.Brocade.durability },
      ];
      tickGarments(freezing, []);
      check(
        downForTheirRound &&
          freezing.workers.weaver[1].frostbittenRound === undefined &&
          freezing.workers.weaver.length === 2,
        "the hand stands down for exactly the round the mark names and is back at the bench the round after, because the tick clears the marks whose round is over as it walks, and the cold costs them the work of one round rather than their place aboard",
      );

      // The wear, in the model's units, and once a round.
      const sea = voyageState();
      sea.voyageEpoch = 4242;
      sea.money = 1000;
      sea.currentRound = mildRound;
      hireWorker(sea, "weaver", []);
      sea.garments = [
        { good: "Brocade", durability: GARMENTS.Brocade.durability },
      ];
      tickGarments(sea, []);
      const afterOneRound = sea.garments[0].durability;
      tickGarments(sea, []);
      const stampedOnce = sea.garments[0].durability === afterOneRound;
      sea.currentRound = coldRound;
      tickGarments(sea, []);
      check(
        afterOneRound ===
          GARMENTS.Brocade.durability - GARMENT_DECAY_PER_ROUND &&
          stampedOnce &&
          sea.garments[0].durability ===
            GARMENTS.Brocade.durability -
              GARMENT_DECAY_PER_ROUND -
              GARMENT_DECAY_COLD_ROUND,
        "clothes lose one of their warmth a round and two on a cold one, and a round that arrives twice wears them once, since the tick stamps the round it read before it reads anything else",
      );

      // [Status copy] A status a captain can act on. The lines the cold and
      // the larder write about a hand's state used to say the state and
      // nothing else, and a state with no why and no way back is a mood
      // rather than a message: the field read "out of action" as the sea
      // having taken a hand for good, and read "slower pace" without ever
      // learning the empty larder was two rounds from costing them one.
      check(
        ledgerSentences(bareLines).some(
          (line) =>
            line.includes("Frostbite") &&
            line.includes(newestHand) &&
            line.includes("short of warm clothes") &&
            line.includes("keeps every hand working"),
        ),
        "and the line that stands a hand down for the cold names what the cold caught them short of and what keeps every hand working, because warm clothes before the cold are the whole of the remedy and a warning that hides them leaves a captain reading a funeral into a laundry problem",
      );

      const statusSnowed = voyageState();
      statusSnowed.voyageEpoch = 4242;
      statusSnowed.money = 1000;
      statusSnowed.currentRound = coldRound + 1;
      hireWorker(statusSnowed, "weaver", []);
      const snowedHand = statusSnowed.workers.weaver[0];
      snowedHand.task = "Linen Clothes";
      snowedHand.frostbittenRound = coldRound + 1;
      const snowedLines: LedgerLine[] = [];
      processProduction(statusSnowed, snowedLines);
      check(
        ledgerSentences(snowedLines).some(
          (line) =>
            line.includes(snowedHand.name) &&
            line.includes("frozen out this round") &&
            line.includes("short of warm clothes") &&
            line.includes("waits for next round"),
        ) &&
          snowedHand.task === "Linen Clothes" &&
          (statusSnowed.inventory["Linen Clothes"] ?? 0) === 0,
        "and a hand the cold has taken says from the bench why they are missing and that the work waits for them, since their materials were spent when the task was set and a captain watching an empty output line is owed the sentence that says the order survives the round",
      );

      const statusHungry = voyageState();
      statusHungry.voyageEpoch = 4242;
      statusHungry.money = 1000;
      statusHungry.currentRound = mildRound;
      hireWorker(statusHungry, "weaver", []);
      statusHungry.larder = 0;
      const statusHungryLines: LedgerLine[] = [];
      processProduction(statusHungry, statusHungryLines);
      check(
        ledgerSentences(statusHungryLines).some(
          (line) =>
            line.includes("short rations") &&
            line.includes("slower pace") &&
            line.includes("costs the newest hand aboard"),
        ),
        "and the line about a hungry round carries the stake as well as the slowdown, because the empty larder's real price is the newest hand and a captain told only about speed cannot know which round is the one that takes them",
      );

      const statusRefused = voyageState();
      statusRefused.voyageEpoch = 4242;
      statusRefused.money = 1000;
      statusRefused.currentRound = coldRound + 1;
      hireWorker(statusRefused, "weaver", []);
      statusRefused.workers.weaver[0].frostbittenRound = coldRound + 1;
      const statusRefusalLines: LedgerLine[] = [];
      assignTask(statusRefused, "weaver", "Linen Clothes", statusRefusalLines);
      check(
        statusRefusalLines.length === 1 &&
          ledgerSentences(statusRefusalLines)[0].includes(
            "frozen out this round",
          ) &&
          ledgerSentences(statusRefusalLines)[0].includes(
            "short of warm clothes",
          ) &&
          ledgerSentences(statusRefusalLines)[0].includes(
            "keeps every hand working",
          ) &&
          statusRefused.workers.weaver[0].task === null,
        "and a task refused over hands the cold has taken says the same why and the same way back as the row does, so a refusal about a full bench never lands on a bench that is standing idle",
      );

      // The rags at the bottom of that, and what they pay.
      const ragged = voyageState();
      ragged.voyageEpoch = 4242;
      ragged.money = 100;
      ragged.currentRound = mildRound;
      hireWorker(ragged, "weaver", []);
      ragged.garments = [{ good: "Linen Clothes", durability: 1 }];
      const ragLines: LedgerLine[] = [];
      tickGarments(ragged, ragLines);
      check(
        ragged.garments.length === 0 &&
          ragged.money === 100 + RAG_SCRAP_VALUE &&
          ledgerSentences(ragLines).some((line) =>
            line.includes(`scrapped for ${RAG_SCRAP_VALUE} Gold`),
          ),
        "a garment the sea has had all of leaves the wardrobe and is scrapped for the design's four Gold in the same breath, so the hold and the purse agree about a good that stopped being wearable rather than the garment vanishing quietly",
      );

      // And the whole of it through the engine's own Resolve.
      const settling = voyageState();
      settling.money = 1000;
      settling.voyageEpoch = 4242;
      settling.currentRound = coldRound;
      hireWorker(settling, "weaver", []);
      settling.garments = [
        {
          good: "Cotton Clothes",
          durability: GARMENTS["Cotton Clothes"].durability,
        },
      ];
      settling.phase = "resolve";
      settling.pirateAttackResolved = true;
      const settleLines: LedgerLine[] = [];
      nextPhase(
        settling,
        {
          seedBase: `smoke:garments:${suffix}`,
          harborId: `smoke-garments-${suffix}`,
        },
        settleLines,
      );
      check(
        settling.garmentsTickRound === coldRound &&
          settling.garments[0].durability ===
            GARMENTS["Cotton Clothes"].durability - GARMENT_DECAY_COLD_ROUND &&
          ledgerSentences(settleLines).some((line) =>
            line.includes("The Cold and the Cloth"),
          ),
        "and the wear lands through the engine's own Resolve rather than beside it, so the tick is part of the deterministic settlement step every round already passes through rather than a rule that only fires when something calls it by name",
      );

      // Every line this family wrote, gathered here rather than threaded
      // through each check, since the dash rule is about the whole set.
      survivalLines.push(
        ...dressLines,
        ...mildLines,
        ...bareLines,
        ...warmLines,
        ...ragLines,
        ...snowedLines,
        ...statusHungryLines,
        ...statusRefusalLines,
      );

      // The switch off, read on its own so the checks above can stay about
      // the rules rather than about the flag.
      check(
        withEnv("NEXT_PUBLIC_GARMENTS", "off", () => {
          const dark = voyageState();
          dark.voyageEpoch = 4242;
          dark.money = 1000;
          dark.currentRound = coldRound;
          hireWorker(dark, "weaver", []);
          dark.inventory.Brocade = 1;
          dark.garments = [
            { good: "Brocade", durability: GARMENTS.Brocade.durability },
          ];
          const darkLines: LedgerLine[] = [];
          const refused = wearGarment(dark, "Brocade", darkLines) === false;
          tickGarments(dark, darkLines);
          return (
            !garmentsLayerOn(GAMBIT) &&
            refused &&
            dark.inventory.Brocade === 1 &&
            dark.garments.length === 1 &&
            dark.garments[0].durability === GARMENTS.Brocade.durability &&
            dark.garmentsTickRound === 0 &&
            !shortOfWarmth(dark) &&
            dark.workers.weaver[0].frostbittenRound === undefined &&
            darkLines.length === 0
          );
        }),
        "with the switch off no garment is worn, nothing wears out, no round is stamped and nobody freezes, while the clothes a voyage is already carrying are left on it exactly as they were read, so the layer rolls back without taking anybody's wardrobe with it",
      );

      // And the layer above, which is why the two switches are separate
      // readings rather than one.
      check(
        withEnv("NEXT_PUBLIC_SURVIVAL", "off", () =>
          withEnv("NEXT_PUBLIC_GARMENTS", "1", () => {
            const unfed = voyageState();
            unfed.voyageEpoch = 4242;
            unfed.money = 1000;
            unfed.currentRound = coldRound;
            hireWorker(unfed, "weaver", []);
            unfed.inventory.Brocade = 1;
            unfed.garments = [{ good: "Brocade", durability: 5 }];
            const unfedLines: LedgerLine[] = [];
            const refused = wearGarment(unfed, "Brocade", unfedLines) === false;
            tickGarments(unfed, unfedLines);
            return (
              !garmentsLayerOn(GAMBIT) &&
              refused &&
              unfed.garments[0].durability === 5 &&
              unfed.garmentsTickRound === 0 &&
              !shortOfWarmth(unfed) &&
              unfedLines.length === 0
            );
          }),
        ),
        "and the provisions layer governs this one from above, because the clothes belong to the same family: a build with the Larder off has no cold whatever the garments switch says, so a table can be rolled back one switch at a time without a wardrobe outliving the rule it belonged to",
      );

      // A save read back, with the switch off, because the healing is the
      // save's business rather than the rule's and has to hold either way.
      const many = (count: number) =>
        Array.from({ length: count }, () => ({
          good: "Brocade",
          durability: GARMENTS.Brocade.durability,
        }));
      check(
        withEnv("NEXT_PUBLIC_GARMENTS", "off", () => {
          return (
            normalizeGarments(undefined).length === 0 &&
            normalizeGarments("Brocade").length === 0 &&
            normalizeGarments([{ good: "Sable", durability: 9 }, null, 7, {}])
              .length === 0 &&
            normalizeGarments([{ good: "Brocade", durability: 40 }])[0]
              .durability === GARMENTS.Brocade.durability &&
            normalizeGarments([{ good: "Brocade", durability: -1 }]).length ===
              0 &&
            normalizeGarments([{ good: "Brocade", durability: 6.8 }])[0]
              .durability === 6 &&
            normalizeGarments(many(12)).length === 12 &&
            normalizeGarments(many(13)).length === 12 &&
            normalizeGarments(many(40)).length === 12 &&
            normalizeGarmentsTickRound(undefined) === 0 &&
            normalizeGarmentsTickRound(Number.NaN) === 0 &&
            normalizeGarmentsTickRound(-2) === 0 &&
            normalizeGarmentsTickRound(3.9) === 3
          );
        }),
        "a save written before this layer existed heals to a crew with nothing on, since a voyage should meet its first cold round the way a fresh one does rather than in clothes a save invented for it, and a wardrobe it can read is clamped to the catalogue's own ends: entries for goods that are not clothes are dropped, a durability is floored into the garment, a garment already in rags is not worn, the back holds twelve, and a stamp it cannot read lands on a round no voyage has",
      );
    }),
  );

  // The files this feature owns, read as files rather than asserted about,
  // so the rule covers their comments as well as the lines they write. It
  // is the same reading the crew's own files are held to above, and the
  // bench the wardrobe is drawn on is read there with them.
  check(
    !carriesADash("src/lib/game/garments.ts") &&
      !carriesADash("src/lib/game/engine/workers.ts") &&
      !carriesADash("src/lib/game/engine/lifecycle.ts") &&
      !carriesADash("src/components/portmasters/game/GameStatusPanel.tsx"),
    "and the module the clothes live in and the three files the cold reaches, the bench that assigns work, the settlement that ticks it and the rail a captain reads the forecast on, hold the house rule in their comments as well as in their code",
  );

  return survivalLines;
}
