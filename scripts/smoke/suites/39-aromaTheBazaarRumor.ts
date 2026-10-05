// PortMasters 2.2 Parallel Release, smoke run: Aroma: the bazaar rumor.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { BazaarBoard } from "@/types/realtime/boards";
import { db } from "@/lib/db";
import {
  COMMODITIES,
  PRODUCT_PRICES,
  RESOURCES_TIER0,
  RESOURCES_TIER1,
} from "@/lib/game/constants/goods";
import {
  RUMOR_COOLDOWN_ROUNDS,
  RUMOR_SHIFT_FRACTION,
} from "@/lib/game/constants/paths";
import type {
  BazaarRumor,
  MarketLeans,
  PublicRumor,
  RumorDirection,
} from "@/lib/game/engine";
import {
  BAZAAR_SELLER_PATH,
  applyMarketLeans,
  bazaarGoods,
  canPublishRumor,
  normalizeBazaarRumor,
  normalizeRumorLean,
  publicRumors,
  rumorCanLand,
  rumorClosingLine,
  rumorCooldownLeft,
  rumorCooldownLine,
  rumorDirectionLine,
  rumorGoodAllowed,
  rumorId,
  rumorLean,
  rumorNextLeg,
  rumorSpokeIn,
  rumorStanding,
  snapToCheckpoint,
} from "@/lib/game/engine";
// The three readers this pass added, taken from the module that states the
// rule rather than from the engine barrel: the barrel's bazaar block carries
// the readers the desk already read, and these are the ones the desk's own
// naming of a leg and its reading of a landed row moved into.
import {
  rumorLandedLine,
  rumorLandsOn,
  rumorWaitLine,
} from "@/lib/game/engine/bazaar";
import { bazaarRumorsOn } from "@/lib/game/flags";
import { PORT_SHIFT_FRACTION } from "@/lib/game/maroon";
import { voyageRoundsFor } from "@/lib/game/mode";
import { PATH_IDS } from "@/lib/game/paths";
import { phaseFace } from "@/lib/game/phases";
import type { GameState, Phase } from "@/lib/game/types";
import type { VoyageLogEntry } from "@/lib/game/voyage-log";
import { voyageLogLine } from "@/lib/game/voyage-log";
import {
  GAMBIT,
  LEDGER_PHRASE,
  call,
  carriesADash,
  check,
  openAuthedSocket,
  signUp,
  suffix,
  switchFor,
  voyageState,
  waitForEvent,
  withEnv,
  withoutComments,
} from "../harness";
import type { Captain, WireHistory } from "../wire";
import type { Socket } from "socket.io-client";
import type { SmokeRun } from "../run";

export async function aromaTheBazaarRumorSuite(run: SmokeRun): Promise<void> {
  // ---- The board, on a captain's own machine ----
  //
  // The switch is switched on for the whole block, the same way the
  // bench's is, so every check below that is not about the switch is
  // about the rule rather than about whatever the environment happened
  // to say. Nothing in this feature moves Gold or goods, so unlike the
  // two consent markets above there is no settlement to check and no
  // ledger to heal: what a rumor does to a voyage is lean a price, and
  // the market at the end of this half is where that is measured.
  withEnv("NEXT_PUBLIC_BAZAAR", "1", () => {
    check(
      [undefined, "", "1", "on", "true", "live", "ON "].every((value) =>
        withEnv("NEXT_PUBLIC_BAZAAR", value, switchFor(GAMBIT, bazaarRumorsOn)),
      ) &&
        ["off", "0", "OFF", " off ", "Off"].every(
          (value) =>
            !withEnv(
              "NEXT_PUBLIC_BAZAAR",
              value,
              switchFor(GAMBIT, bazaarRumorsOn),
            ),
        ),
      "the bazaar is on for every value of its own switch except the word off and the digit zero, which is the policy every switch in this tree is read through",
    );
    check(
      PATH_IDS.every(
        (id) =>
          canPublishRumor({ path: id, mode: GAMBIT }) ===
          (id === BAZAAR_SELLER_PATH),
      ) && !canPublishRumor({ path: null, mode: GAMBIT }),
      "one path works the bazaar and no other does, so the question a captain asks before speaking is answered by the path record rather than by a name written into a screen",
    );
    check(
      !withEnv("NEXT_PUBLIC_BAZAAR", "off", () =>
        canPublishRumor({ path: BAZAAR_SELLER_PATH, mode: GAMBIT }),
      ),
      "and the switch is read before the path rather than beside it: a build with the bazaar rolled back refuses an Aroma captain as flatly as it refuses everyone else",
    );

    // The goods a rumor may name, read the way the desk and the server
    // read them: one leg ahead, against the room's own charter. Fair
    // Winds never opens a tier and Open Waters opens one at leg four,
    // which is what gives the checks below a real commodity the coming
    // market does not trade and a real commodity that unlocks on the
    // very leg a rumor would move.
    const tierOne = RESOURCES_TIER1[0] ?? "";
    const goodsAt = (difficulty: string, round: number) =>
      bazaarGoods(difficulty, round);
    check(
      goodsAt("fair_winds", 3).length > 0 &&
        goodsAt("fair_winds", 3).every((good) => good in COMMODITIES) &&
        RESOURCES_TIER0.every((good) =>
          goodsAt("fair_winds", 3).includes(good),
        ) &&
        !goodsAt("fair_winds", 9).includes(tierOne),
      "the bazaar's goods are the goods the port trades, read off the one list the market draws from and narrowed to the goods the pricing table carries, so a rumor always lands on a price rather than on nothing",
    );
    check(
      !goodsAt("open_waters", 3).includes(tierOne) &&
        goodsAt("open_waters", 4).includes(tierOne),
      "and a tier is nameable one leg before the port stocks it, because a rumor is a claim about the market the room has not reached yet: a captain can speak about a cargo before the harbor has the goods, which is the fiction the plan asks for",
    );
    check(
      rumorGoodAllowed("Hemp", "fair_winds", 3) &&
        !rumorGoodAllowed(tierOne, "fair_winds", 3) &&
        !rumorGoodAllowed(
          Object.keys(PRODUCT_PRICES)[0] ?? "",
          "fair_winds",
          3,
        ) &&
        !rumorGoodAllowed("", "fair_winds", 3) &&
        !rumorGoodAllowed(null, "fair_winds", 3) &&
        !rumorGoodAllowed(7, "fair_winds", 3),
      "and the server's check is a membership test on that same list rather than a second set of conditions, so a good the desk offers and a good the server refuses cannot come apart: a finished good is refused with the raws, because the market a rumor prices draws raw goods",
    );

    // The wait, which is the one rule in this feature a client cannot
    // carry: it is measured off the room's own rows.
    const speaker = "captain-a";
    const spoke = (rounds: number[], who = speaker) =>
      rounds.map((round) => ({ publisherUserId: who, round }));
    check(
      rumorCooldownLeft([], speaker, 5) === 0 &&
        rumorCooldownLeft(spoke([4], "captain-b"), speaker, 5) === 0,
      "a captain who has never spoken waits for nothing, and neither does a captain whose table has been busy, because the wait is measured off a captain's own rows rather than off the board",
    );
    check(
      [3, 4, 5, 6, 9]
        .map((round) => rumorCooldownLeft(spoke([3]), speaker, round))
        .join(",") === `${RUMOR_COOLDOWN_ROUNDS},2,1,0,0`,
      "the wait counts down from the leg the captain spoke in and reaches nothing on the third leg after it, where it stays rather than going negative, which is the once every three legs the plan asks for",
    );
    check(
      rumorCooldownLeft(spoke([1, 5]), speaker, 6) === 2 &&
        rumorCooldownLeft(spoke([5, 1]), speaker, 6) === 2,
      "and it is measured from the newest row rather than the oldest, in whichever order the board happens to hold them, because a captain who has spoken twice is waiting on the second time",
    );
    check(
      rumorCooldownLine(0) === "The bazaar will hear you again." &&
        rumorCooldownLine(1).includes("one more leg") &&
        rumorCooldownLine(2).includes("2 more legs") &&
        !rumorCooldownLine(1).includes("2"),
      "the wait is said in legs and in a sentence rather than as a bare number: a captain with one leg to wait is told so in words, and a captain whose wait is over is told that rather than told nothing",
    );
    // The same wait read from its other end. How many legs are left
    // answers how long, and the desk's second question is when, because
    // the legs are numbered above it and a number of legs is a number of
    // page turns rather than a leg to come back at.
    check(
      rumorSpokeIn([], speaker) === 0 &&
        rumorSpokeIn(spoke([4], "captain-b"), speaker) === 0 &&
        rumorSpokeIn(spoke([3]), speaker) === 3 &&
        rumorSpokeIn(spoke([3, 6]), speaker) === 6 &&
        rumorSpokeIn(spoke([6, 3]), speaker) === 6 &&
        rumorNextLeg([], speaker) === 0 &&
        rumorNextLeg(spoke([3]), speaker) === 3 + RUMOR_COOLDOWN_ROUNDS,
      "the leg a captain last spoke in is the newest of their own rows in whichever order the board holds them, and the leg the bazaar hears them again is that leg plus the cooldown, with a captain who has never spoken waiting for nothing at all, because a desk that draws the wait has to draw the leg it ends on rather than only its length",
    );
    check(
      [3, 4, 5, 6, 7, 9].every(
        (round) =>
          rumorCooldownLeft(spoke([3]), speaker, round) ===
          Math.max(0, rumorNextLeg(spoke([3]), speaker) - round),
      ),
      "and the two readings are one reading rather than two counts kept beside each other: the wait counted down from the leg a captain spoke in and the leg the desk tells them to come back at agree on every leg between them",
    );

    // The one leg a rumor would move nothing, which is the last thing the
    // server has to be true about a row and the one no client can be
    // trusted to have worked out for itself.
    const pinnedLegs = voyageState({ difficulty: "fair_winds" }).maxRounds;
    check(
      pinnedLegs === voyageRoundsFor(GAMBIT, "fair_winds") && pinnedLegs === 12,
      "the length the closing leg is read against is one number read in exactly one place: the legs a captain's own state pins at departure are the legs the server reads off the room when it decides whether a rumor has a market to land on",
    );
    check(
      rumorCanLand(1, pinnedLegs) &&
        rumorCanLand(pinnedLegs - 1, pinnedLegs) &&
        !rumorCanLand(pinnedLegs, pinnedLegs) &&
        !rumorCanLand(pinnedLegs + 1, pinnedLegs) &&
        !rumorCanLand(1, 1),
      "a rumor may be spoken in every leg of a voyage except the one with no leg after it, because a row is a claim about the next port and the closing leg has no next port: the row would lean a market this voyage never opens, which is the settlement the plan's own rollback note asks to be skipped cleanly rather than left half applied",
    );
    // The same wait, read against the voyage that holds it. The cooldown
    // runs three legs whatever the table is doing, so a captain who speaks
    // at the tenth leg of a twelve leg voyage is still being counted down
    // in the eleventh, and the leg the ordinary sentence ends on is the
    // thirteenth: a leg this voyage never opens, and a desk that names it
    // is a countdown to a moment nobody at the table ever reaches.
    const lateRows = spoke([pinnedLegs - 2]);
    const lateWait = rumorWaitLine(
      lateRows,
      speaker,
      pinnedLegs - 1,
      pinnedLegs,
    );
    const openWait = rumorWaitLine(
      lateRows,
      speaker,
      pinnedLegs - 1,
      pinnedLegs + 8,
    );
    check(
      rumorCooldownLeft(lateRows, speaker, pinnedLegs - 1) === 2 &&
        lateWait ===
          `The bazaar is quiet for you to the end of this voyage. You spoke in leg ${pinnedLegs - 2}.` &&
        !lateWait.includes(String(pinnedLegs + 1)) &&
        lateWait !== openWait &&
        openWait.includes(`again at leg ${pinnedLegs + 1}`),
      "and a wait the cooldown outlasts is said in the bazaar's own words rather than in a leg the voyage never reaches: the desk keeps the leg the captain spoke in and drops the leg it would have come back at, while the same rows read on a voyage long enough to hold that leg are still sent back to it, so the sentence turns on the length rather than on the count",
    );
    check(
      rumorClosingLine().includes("last leg") &&
        !rumorClosingLine().toLowerCase().includes("more leg") &&
        !rumorClosingLine().toLowerCase().includes("again") &&
        rumorClosingLine() !== rumorCooldownLine(1),
      "and that leg is refused in the bazaar's own sentence rather than in the wait's: a captain standing at the closing leg is told which leg is the reason, so the desk's silence is read as a fact about the voyage rather than as a wait that would end in three legs time",
    );
    check(
      RUMOR_SHIFT_FRACTION === PORT_SHIFT_FRACTION,
      "and the band a rumor leans a price by is the Harbormaster's own tenth rather than a second number kept beside it, which is what makes a rumor a call the table already knows how to read and what keeps the plan's guard on how swingy a price may become one number in one place",
    );

    // One row, as the room holds it and as three readers may see it.
    const rumorRow: BazaarRumor = {
      id: rumorId(speaker, 5),
      publisherUserId: speaker,
      publisherName: "Smoke aroma",
      good: "Silk",
      direction: 1,
      round: 5,
    };
    const rowBy = (over: Partial<BazaarRumor>): BazaarRumor => ({
      ...rumorRow,
      ...over,
    });
    const asPublisher = publicRumors([rumorRow], speaker, 5)[0];
    const asOther = publicRumors([rumorRow], "captain-b", 5)[0];
    const asLater = publicRumors([rumorRow], "captain-b", 6)[0];
    check(
      rumorStanding(rumorRow, 5) &&
        !rumorStanding(rumorRow, 6) &&
        !rumorStanding(rumorRow, 7),
      "a rumor stands in the leg it was spoken in and in no leg after it, which is the one question the whole visibility rule turns on",
    );
    check(
      asPublisher?.direction === 1 &&
        asOther?.direction === null &&
        asLater?.direction === 1 &&
        rumorRow.direction === 1,
      "the direction is stripped for every reader but its publisher while the rumor stands, and it is public the moment the market it moved is drawn, while the row the room holds keeps it either way: the fleet is handed the captain, the good and the leg rather than the lean, and the row itself is never rewritten",
    );
    check(
      asOther?.publisherName === "Smoke aroma" &&
        asOther?.good === "Silk" &&
        asOther?.round === 5 &&
        asOther?.id === rumorRow.id,
      "and the name, the good and the leg travel to everyone, because a rumor the harbor cannot attribute is not the mechanic: the fleet is meant to know who spoke and to have to guess at why",
    );
    check(
      rumorId(speaker, 5) !== rumorId(speaker, 6) &&
        rumorId(speaker, 5) !== rumorId("captain-b", 5) &&
        rumorId(speaker, 5).includes(speaker) &&
        rumorId(speaker, 5).includes("5"),
      "one captain speaks once a leg, so a row's id is its publisher and its leg together: two rows can never be handed one id, which is what the board's one writer relies on rather than checking",
    );

    // What the lean does, which is the other half of the visibility
    // rule: the row is public but the direction is what prices a market,
    // and it prices exactly one market.
    const teaRow = rowBy({
      id: rumorId("captain-b", 5),
      publisherUserId: "captain-b",
      good: "Tea",
      direction: -1,
    });
    const atSix = rumorLean([rumorRow, teaRow], 6);
    check(
      atSix.Silk === RUMOR_SHIFT_FRACTION &&
        atSix.Tea === -RUMOR_SHIFT_FRACTION &&
        Object.keys(rumorLean([rumorRow, teaRow], 5)).length === 0 &&
        Object.keys(rumorLean([rumorRow, teaRow], 7)).length === 0,
      "a rumor is priced by the very next market and by no other: the leg it was spoken in has already been drawn and the leg after next has moved on, so one row leans one price once",
    );
    check(
      rumorLean([rumorRow, rowBy({ publisherUserId: "captain-b" })], 6).Silk ===
        RUMOR_SHIFT_FRACTION &&
        Object.keys(
          rumorLean(
            [rumorRow, rowBy({ publisherUserId: "captain-b", direction: -1 })],
            6,
          ),
        ).length === 0,
      "and two captains naming one good are summed and then held to the band the Harbormaster's own hand is capped at, so the loudest the bazaar can get is the loudest one call can get, while two rumors pulling against each other cancel rather than averaging into a move nobody called",
    );
    check(
      Object.keys(
        normalizeRumorLean(
          rumorLean([rumorRow, rowBy({ publisherUserId: "captain-b" })], 6),
        ),
      ).length === 1 &&
        normalizeRumorLean(rumorLean([rumorRow, teaRow], 6)).Silk ===
          RUMOR_SHIFT_FRACTION,
      "and a lean that has been through a save is the lean that went into it, because a good the rumors left alone has one representation rather than two",
    );

    // The two shapes a row and a lean arrive in, off a wire and off a
    // save. Both are read by something that would not look wrong if they
    // were read as they came: a screen would draw a row, and the market
    // would price a card.
    const soundRow = {
      id: "captain-a:5",
      publisherUserId: "captain-a",
      publisherName: "Smoke aroma",
      good: "Silk",
      direction: 1,
      round: 5,
    };
    check(
      normalizeBazaarRumor({ ...soundRow, direction: null })?.direction ===
        null &&
        normalizeBazaarRumor({ ...soundRow, round: 5.7 })?.round === 5 &&
        normalizeBazaarRumor(null) === null &&
        normalizeBazaarRumor([]) === null &&
        normalizeBazaarRumor("Silk") === null &&
        normalizeBazaarRumor({ ...soundRow, publisherUserId: "" }) === null &&
        normalizeBazaarRumor({ ...soundRow, good: "" }) === null &&
        normalizeBazaarRumor({ ...soundRow, round: 0 }) === null &&
        normalizeBazaarRumor({ ...soundRow, round: Number.NaN }) === null &&
        normalizeBazaarRumor({ ...soundRow, direction: 0 }) === null &&
        normalizeBazaarRumor({ ...soundRow, direction: 2 }) === null &&
        normalizeBazaarRumor({ ...soundRow, direction: "higher" }) === null,
      "a row off the wire is kept only when it names a publisher, a good and a leg and its direction is a real lean or the null a standing row carries, because a row that failed to parse is not an empty row and a row the screen draws is a row the fleet believes",
    );
    const leaned = normalizeRumorLean({
      Silk: RUMOR_SHIFT_FRACTION,
      Tea: -RUMOR_SHIFT_FRACTION,
      Hemp: 0.9,
      Spices: -5,
      Pearls: 0,
      "Porcelain Clay": Number.NaN,
      Sails: "0.1",
    });
    check(
      leaned.Silk === RUMOR_SHIFT_FRACTION &&
        leaned.Tea === -RUMOR_SHIFT_FRACTION &&
        leaned.Hemp === RUMOR_SHIFT_FRACTION &&
        leaned.Spices === -RUMOR_SHIFT_FRACTION &&
        !("Pearls" in leaned) &&
        !("Porcelain Clay" in leaned) &&
        !("Sails" in leaned) &&
        Object.keys(normalizeRumorLean(null)).length === 0 &&
        Object.keys(normalizeRumorLean([RUMOR_SHIFT_FRACTION])).length === 0,
      "and a lean off a save is held to the band the constant declares with everything that is not a finite number dropped, so a save edited to lean a good by half is read as a rumor's worth and no more, which is the defensive half of the plan's own guard on how swingy a price may become",
    );

    // The two sentences, which are the ones a captain reads and the room
    // keeps.
    check(
      rumorDirectionLine({ good: "Silk", direction: 1 }).includes("Silk") &&
        rumorDirectionLine({ good: "Silk", direction: 1 }).includes(
          String(Math.round(RUMOR_SHIFT_FRACTION * 100)),
        ) &&
        rumorDirectionLine({ good: "Silk", direction: 1 }).includes("higher") &&
        rumorDirectionLine({ good: "Silk", direction: -1 }).includes("lower") &&
        !rumorDirectionLine({ good: "Silk", direction: -1 }).includes("higher"),
      "the clause a row is drawn with reads its percent off the constant the market prices with and names the way in words, so the number a captain reads and the number the market applied are one number",
    );
    const rumorLine = voyageLogLine({
      kind: "rumor_published",
      captain: "Smoke aroma",
      good: "Silk",
    });
    check(
      rumorLine.includes("Smoke aroma") &&
        rumorLine.includes("Silk") &&
        !rumorLine.includes("higher") &&
        !rumorLine.includes("lower") &&
        !rumorLine.includes("%"),
      "the room's log carries the captain and the good and never the direction, because the log is public the instant it is written and the direction is not public until the market answers the row",
    );

    // ---- The market the lean lands on ----
    //
    // One leg drawn twice from one seed for two captains who differ in
    // one thing only: what the bazaar told them. The cards have to come
    // out identical and only the named good's price may move, which is
    // also what proves a rumor is a price rather than a second market
    // nobody else can see.
    const marketCtx = {
      seedBase: "harbor-b:captain-b",
      harborId: "harbor-b",
    };
    const marketUnder = (leans: MarketLeans) => {
      const state = voyageState({ difficulty: "fair_winds" });
      applyMarketLeans(state, leans);
      snapToCheckpoint(state, marketCtx, 6, "market", []);
      return state;
    };
    const plainMarket = marketUnder({});
    const priced = (price: number, lean: number) =>
      Math.max(1, Math.round(price * (1 + lean)));
    // The floor and the rounding, read at the low end before they are read
    // against a market. A tenth of a four Gold price rounds back to four
    // both ways, so the lean is a no op there and a rumor naming such a
    // good would move nothing at all, which is why the good this block
    // leans is found on the drawn board below rather than named here.
    check(
      priced(4, RUMOR_SHIFT_FRACTION) === 4 &&
        priced(4, -RUMOR_SHIFT_FRACTION) === 4 &&
        Math.round(4 * 1.1) === 4 &&
        Math.round(4 * 0.9) === 4,
      "and the lean is a no op at the low end: a tenth of a four Gold price rounds back to four in both directions, so the good this block leans is drawn off the board rather than named, because a check leaning a price that never moves would assert nothing",
    );
    // The good the rumor names is read off the drawn board rather than
    // named here, for the reason the Harbormaster's own block gives: a
    // tenth of a price that is already high is a price that moves, and a
    // tenth of three Gold rounds away and would leave the comparison
    // below asserting nothing.
    const drawnRaw = plainMarket.resourceCards
      .filter((card) => !card.isProductCard)
      .flatMap((card) => card.resources)
      .map((resource) => ({
        good: resource.type,
        price: resource.price ?? 0,
      }));
    const rumored = [...new Set(drawnRaw.map((raw) => raw.good))].find((good) =>
      drawnRaw
        .filter((raw) => raw.good === good)
        .every(
          (raw) =>
            priced(raw.price, RUMOR_SHIFT_FRACTION) > raw.price &&
            priced(raw.price, -RUMOR_SHIFT_FRACTION) < raw.price,
        ),
    );
    if (rumored === undefined) {
      throw new Error("This leg's board carried no good a tenth moves.");
    }
    const leanedUp = marketUnder({
      bazaarLean: { [rumored]: RUMOR_SHIFT_FRACTION },
    });
    const leanedDown = marketUnder({
      bazaarLean: { [rumored]: -RUMOR_SHIFT_FRACTION },
    });
    const sameDraw = plainMarket.resourceCards.every((card, i) => {
      const other = leanedUp.resourceCards[i];
      return (
        other !== undefined &&
        other.port === card.port &&
        other.isProductCard === card.isProductCard &&
        other.resources.length === card.resources.length &&
        card.resources.every(
          (resource, j) =>
            other.resources[j].type === resource.type &&
            other.resources[j].quantity === resource.quantity,
        )
      );
    });
    check(
      plainMarket.resourceCards.length > 1 && sameDraw,
      "the same ports, the same goods and the same counts, so a rumor moves a price and never the market: the lean is the third hand on one price rather than a board of its own",
    );
    const pricedByTheRumor = (market: GameState, direction: 1 | -1) =>
      plainMarket.resourceCards.every((card, i) => {
        const under = market.resourceCards[i];
        return card.resources.every(
          (resource, j) =>
            under.resources[j].price ===
            (resource.type === rumored
              ? priced(resource.price ?? 0, direction * RUMOR_SHIFT_FRACTION)
              : resource.price),
        );
      });
    check(
      pricedByTheRumor(leanedUp, 1) && pricedByTheRumor(leanedDown, -1),
      "and every price of the good the rumor names is a tenth up or a tenth down at every port, floored at one Gold, while every other good on every card is untouched",
    );

    // The other half of the reveal, which is presence rather than price: a
    // landed row tells the table which way a captain leaned and nothing
    // about whether the good was in the port at all. The two states are
    // read off the one drawn board, because that is what a captain holds
    // on the leg their rumor lands: one row naming a good the port drew
    // and one naming a good it did not.
    const drawnGoods = new Set(
      plainMarket.resourceCards.flatMap((card) =>
        card.resources.map((resource) => resource.type),
      ),
    );
    const drewGood = drawnRaw[0]?.good;
    const missedGood = Object.keys(COMMODITIES).find(
      (good) => !drawnGoods.has(good),
    );
    if (drewGood === undefined || missedGood === undefined) {
      throw new Error(
        "This leg's board named every good, so no rumor could miss it.",
      );
    }
    check(
      rumorLandedLine(
        { good: drewGood, round: 5 },
        plainMarket.resourceCards,
      ) ===
        `The port of leg 6 drew ${drewGood} and priced it against your rumor.` &&
        rumorLandedLine(
          { good: missedGood, round: 5 },
          plainMarket.resourceCards,
        ) ===
          `The port of leg 6 drew no ${missedGood}, so your rumor moved no price you could buy.` &&
        rumorLandedLine({ good: drewGood, round: 5 }, []) === null,
      "and the port's answer to a row the market just priced is presence rather than a price: a good the port drew is reported as priced against the rumor and a good it did not is reported as a price that never moved, both read off this captain's own drawn market, while a market that has not been drawn yet is answered with nothing rather than with a guess about a port nobody has reached",
    );

    // The three hands at once, which is what the single rounding in the
    // pricing rewrite is for: the harbor's appetite, the Harbormaster's
    // call and the bazaar's rumor are three accounts of one price, so
    // they are one rounding rather than three. The card this is measured
    // on is found rather than named, and it is a card where rounding the
    // hands one at a time would land somewhere else, so the check is a
    // measurement rather than a coincidence.
    const hands = { pulse: PORT_SHIFT_FRACTION, rumor: RUMOR_SHIFT_FRACTION };
    const together = (price: number, nudge: number, lean: number) =>
      Math.max(1, Math.round(price * (1 + nudge) * lean));
    const apart = (price: number, nudge: number, lean: number) =>
      Math.max(
        1,
        Math.round(Math.max(1, Math.round(price * (1 + nudge))) * lean),
      );
    const leaningCard = plainMarket.resourceCards
      .filter((card) => !card.isProductCard)
      .find((card) =>
        card.resources.some(
          (resource) =>
            resource.type === rumored &&
            together(
              resource.price ?? 0,
              hands.pulse + hands.rumor,
              1 + PORT_SHIFT_FRACTION,
            ) !==
              apart(
                resource.price ?? 0,
                hands.pulse + hands.rumor,
                1 + PORT_SHIFT_FRACTION,
              ),
        ),
      );
    if (leaningCard === undefined) {
      throw new Error(
        "This leg's board carried no card where the three hands disagree about rounding.",
      );
    }
    const allThree = marketUnder({
      harborPulse: { [rumored]: hands.pulse },
      portShift: { port: leaningCard.port, direction: 1 },
      bazaarLean: { [rumored]: hands.rumor },
    });
    const pricedByAllThree = plainMarket.resourceCards.every((card, i) => {
      const under = allThree.resourceCards[i];
      const atThePort = !card.isProductCard && card.port === leaningCard.port;
      return card.resources.every((resource, j) => {
        const nudge = resource.type === rumored ? hands.pulse + hands.rumor : 0;
        const lean = atThePort ? 1 + PORT_SHIFT_FRACTION : 1;
        return (
          under.resources[j].price ===
          together(resource.price ?? 0, nudge, lean)
        );
      });
    });
    check(
      pricedByAllThree,
      "and the three hands are one price rather than three: a card carrying the rumored good at the port under the Harbormaster's call is priced by the rounding of the whole product, and this leg's board carries a card where rounding the hands one at a time would land elsewhere, so that is the claim and not a coincidence",
    );
  });

  // ---- The desk and the handler, read as source ----
  //
  // The panel and the publish handler are read here rather than driven,
  // for the reason the engine block above needs no socket: what these
  // checks hold is that a sentence a captain reads and the rule behind it
  // are one reading rather than two that agree until one of them is
  // edited, and that is a fact about two files. Comments are stripped
  // before the read, so what is asserted is the code rather than the prose
  // describing it.
  const repoRoot = join(import.meta.dirname, "..", "..", "..");
  const readSource = (parts: string[]): string =>
    withoutComments(readFileSync(join(repoRoot, ...parts), "utf8"));
  const deskSource = readSource([
    "src",
    "components",
    "portmasters",
    "game",
    "BazaarRumors.tsx",
  ]);
  const wiringSource = readSource([
    "src",
    "server",
    "realtime",
    "wiring",
    "bazaar.ts",
  ]);

  // The leg a landed row was priced by, which is the one leg of delay the
  // whole feature is: the chip names both legs off the reader and the
  // footnote's outcome sentence is built on the same reader, so the leg a
  // captain reads and the leg the market priced are one number rather
  // than the same arithmetic written twice.
  check(
    rumorLandsOn({ round: 5 }) === 6 &&
      rumorLandsOn({ round: 12 }) === 13 &&
      deskSource.includes("const landsOn = rumorLandsOn(row);") &&
      deskSource.includes(
        "const landsOn = rumorLandsOn({ round: game.currentRound });",
      ) &&
      deskSource.includes(
        "`spoken in leg ${row.round} · priced at leg ${landsOn}`",
      ) &&
      deskSource.includes("rumorLandedLine(row, game.resourceCards)") &&
      !deskSource.includes("row.round + 1"),
    "the leg a landed row was priced by is the leg after the one it was spoken in, named by the one reader that states the pair and by no arithmetic written into the desk: the chip names both legs off it and the footnote's outcome goes through the same reader, so the two legs a row wears cannot come apart",
  );

  // The copy the desk prints, held to the table it is printed for: the
  // empty board says why its window is two legs wide rather than claiming
  // the voyage has been silent, and the two paragraphs that explain the
  // seat are written for a table that may hold two captains of the
  // speaking path rather than one.
  check(
    deskSource.includes(
      "The board keeps those two legs and no more. Older rows moved markets the room has already priced and traded through.",
    ) &&
      deskSource.includes("which good they named") &&
      deskSource.includes("each {SELLER_PATH.name}") &&
      deskSource.includes(
        "captain may spread a word about one commodity, here at the Parley.",
      ) &&
      deskSource.includes(
        "Speaking at the bazaar belongs to the {SELLER_PATH.name} path, once",
      ) &&
      deskSource.includes(
        "voyage. Whoever holds it is named in the voyage log, and the board",
      ) &&
      deskSource.includes("below names them the moment they speak.") &&
      !deskSource.includes("named ports"),
    "and the desk's own copy names the good rather than the ports and turns on the captain rather than on the seat: the empty board explains the two leg window rather than announcing a silent voyage, the intro says each Aroma captain may speak rather than the Aroma captain, and the reader who holds no path is told who is named where rather than left to work the silence out from a form that is not there",
  );

  // The publish handler's two reads, and the order between them: the room
  // row is read first because it is the read that waits on the database,
  // and the checkpoint is read last because its phase and its leg are what
  // every check after it judges and what the row is written with. Nothing
  // between the checkpoint and the write yields, so a phase that moved out
  // of the Parley while the database read was in flight is refused rather
  // than written under. A true interleave is not reachable from outside
  // the handler without a shim over the database or the checkpoint, so
  // what is pinned here is the shape the race was closed with.
  const handler = wiringSource.slice(
    Math.max(0, wiringSource.indexOf('"bazaar:publish"')),
  );
  const roomReadAt = handler.indexOf("db.room.findUnique(");
  const checkpointReadAt = handler.indexOf(
    "const cp = await getCheckpoint(roomId);",
  );
  const phaseCheckAt = handler.indexOf('cp.phase !== "parley"');
  const publishAt = handler.indexOf("publishBazaarRumor(roomId, {");
  const afterCheckpoint =
    checkpointReadAt === -1
      ? wiringSource
      : handler.slice(
          checkpointReadAt + "const cp = await getCheckpoint(roomId);".length,
          publishAt === -1 ? undefined : publishAt,
        );
  check(
    roomReadAt !== -1 &&
      checkpointReadAt !== -1 &&
      phaseCheckAt !== -1 &&
      publishAt !== -1 &&
      roomReadAt < checkpointReadAt &&
      checkpointReadAt < phaseCheckAt &&
      phaseCheckAt < publishAt &&
      !afterCheckpoint.includes("await "),
    "the checkpoint a publish is judged against is read after the room row rather than before it, and nothing between that read and the row being written yields: a phase that moved out of the Parley while the database read was in flight is refused rather than written under, which is the stale phase the two reads were reordered to close",
  );

  // ---- The bazaar, in a real harbor ----
  //
  // Three captains at a table of their own, for the reason the two blocks
  // above give: the harbor this run shares is still standing at the end
  // of this section, and the checks after it read that one.
  //
  // Fair Winds on purpose: it never opens a tier, so a real commodity the
  // coming market does not trade is nameable on this table and the
  // refusal for it is about the route rather than about a good invented
  // for the check.
  // Short labels, because a username is capped and the suffix is six
  // characters of it.
  const bazaarSeller = await signUp("baz_s");
  const bazaarReader = await signUp("baz_r");
  const bazaarThird = await signUp("baz_t");
  run.extraAccounts.push(bazaarSeller, bazaarReader, bazaarThird);

  const bazaarRoom = await call<{ room: { id: string; code: string } }>(
    "/api/rooms",
    {
      method: "POST",
      cookie: bazaarSeller.cookie,
      body: JSON.stringify({
        name: `Smoke bazaar ${suffix}`,
        isPublic: false,
        difficulty: "fair_winds",
        mode: "ocean_gambit",
        unlock: LEDGER_PHRASE,
      }),
    },
  );
  if (bazaarRoom.status !== 200) {
    throw new Error("No harbor to spread a rumor in.");
  }
  const bazaarRoomId = bazaarRoom.body.room.id;
  const bazaarCrew = [bazaarSeller, bazaarReader, bazaarThird];
  const bazaarJoins = await Promise.all(
    bazaarCrew.slice(1).map((captain) =>
      call<{ room: { id: string } }>("/api/rooms/join", {
        method: "POST",
        cookie: captain.cookie,
        body: JSON.stringify({ code: bazaarRoom.body.room.code }),
      }),
    ),
  );
  check(
    bazaarJoins.every((join) => join.status === 200),
    "three captains can sit at a table where rumors are spread",
  );

  // Each socket's newest board, and every row that board has ever
  // carried, the second being what makes the checks below claims about
  // what a captain was told rather than about what they happened to read
  // last.
  const bazaarBoards = new Map<string, PublicRumor[]>();
  const bazaarSeen = new Map<string, Set<string>>();
  const bazaarSockets = new Map<string, Socket>();
  // The one invariant this whole feature is built on, read on every frame
  // that reaches any of the three captains rather than at the two moments a
  // row happens to be published. A standing row is a market that has not
  // been priced yet, so a captain who is not its publisher must never read
  // a direction off one, and this is the list of every time one of them
  // did. It is empty at the end of the run or the feature is broken
  // somewhere no single check above was pointed at.
  //
  // Standing is judged against the leg the room was standing on rather
  // than against a clock: every move of the room in this suite goes through
  // parkBazaar, so this is never behind the room, and the only frames that
  // can arrive between two parks are the ones a park itself caused.
  let bazaarLeg = 0;
  const bazaarLeaks: string[] = [];
  // And the reading that keeps the scan above honest: the publisher is the
  // one captain who is owed a standing direction, so a run where none was
  // ever read is a run whose frames stopped arriving rather than a run with
  // no leaks in it, and the two numbers are read together at the end.
  let bazaarOwnReads = 0;
  for (const captain of bazaarCrew) {
    const socket = await openAuthedSocket(captain);
    run.sockets.push(socket);
    const seatedHere = waitForEvent<WireHistory>(
      socket,
      "chat:history",
      (payload) => payload?.roomId === bazaarRoomId,
    );
    socket.emit("room:join", { roomId: bazaarRoomId });
    await seatedHere;
    socket.on("bazaar:update", (payload: BazaarBoard) => {
      if (payload?.roomId !== bazaarRoomId) return;
      bazaarBoards.set(captain.id, payload.rumors);
      const seen = bazaarSeen.get(captain.id) ?? new Set<string>();
      for (const row of payload.rumors) {
        seen.add(row.id);
        if (row.direction === null || row.round < bazaarLeg) continue;
        if (row.publisherUserId === captain.id) {
          bazaarOwnReads += 1;
          continue;
        }
        bazaarLeaks.push(`${captain.username} read ${row.id}`);
      }
      bazaarSeen.set(captain.id, seen);
    });
    bazaarSockets.set(captain.id, socket);
  }
  const bazaarSocketOf = (captain: Captain): Socket => {
    const found = bazaarSockets.get(captain.id);
    if (!found) throw new Error(`No socket for ${captain.username}.`);
    return found;
  };
  const bazaarBoardOf = (captain: Captain): PublicRumor[] =>
    bazaarBoards.get(captain.id) ?? [];
  const bazaarDirectionOf = (
    captain: Captain,
    rowId: string,
  ): RumorDirection | null | undefined =>
    bazaarBoardOf(captain).find((row) => row.id === rowId)?.direction;
  const bazaarSettle = () => new Promise((resolve) => setTimeout(resolve, 500));
  // The emit and the wait are one call, for the reason the market above
  // gives: a refusal waited for after the fact is a refusal this run might
  // already have missed.
  const bazaarRefused = async (
    captain: Captain,
    event: string,
    frame: Record<string, unknown>,
  ): Promise<string | null> => {
    const refused = waitForEvent<{ roomId: string; error: string }>(
      bazaarSocketOf(captain),
      "bazaar:error",
      (payload) => payload?.roomId === bazaarRoomId && Boolean(payload.error),
    );
    bazaarSocketOf(captain).emit(event, { roomId: bazaarRoomId, ...frame });
    return (await refused)?.error ?? null;
  };
  const bazaarSpeaks = (
    captain: Captain,
    match: (board: PublicRumor[]) => boolean,
  ) =>
    waitForEvent<BazaarBoard>(
      bazaarSocketOf(captain),
      "bazaar:update",
      (payload) =>
        payload?.roomId === bazaarRoomId && match(payload?.rumors ?? []),
    );
  // The boards a claim reads beyond the one it watched a frame on.
  //
  // A board is delivered per socket rather than per room: the one pass
  // that writes a frame writes it on each captain's own connection, and
  // the order two of them land in is not the order the server wrote them.
  // So a claim that read a board which had not taken the frame in yet
  // would be testing the scheduler rather than the rule, and every board a
  // claim reads is waited for here, armed before the publish rather than
  // checked after it. A board already holding what the claim wants is not
  // waited on, which is what keeps a wait from outliving the frame it was
  // armed for and hanging a run that had nothing left to hear.
  const bazaarBoardsReach = (
    captains: Captain[],
    match: (board: PublicRumor[]) => boolean,
  ): Promise<unknown> =>
    Promise.all(
      captains
        .filter((captain) => !match(bazaarBoardOf(captain)))
        .map((captain) =>
          waitForEvent<BazaarBoard>(
            bazaarSocketOf(captain),
            "bazaar:update",
            (payload) =>
              payload?.roomId === bazaarRoomId && match(payload?.rumors ?? []),
          ),
        ),
    );

  // The room's own seat, moved the way this suite moves any room's seat.
  // A checkpoint only ever moves forward, so the legs below are walked in
  // order rather than named at random.
  const bazaarRoomRow = async () =>
    db.room.findUnique({
      where: { id: bazaarRoomId },
      select: { currentRound: true, currentPhase: true },
    });
  const parkBazaar = async (round: number, phase: Phase) => {
    bazaarSocketOf(bazaarReader).emit("game:status", {
      roomId: bazaarRoomId,
      round,
      phase,
      phaseLabel: phaseFace(phase).label,
      gold: 0,
      reputation: 0,
      shipLevel: 0,
      gameOver: false,
    });
    let row = await bazaarRoomRow();
    for (
      let waited = 0;
      (row?.currentRound !== round || row?.currentPhase !== phase) &&
      waited < 5000;
      waited += 250
    ) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      row = await bazaarRoomRow();
    }
    // The leg the room is standing on now, which is the leg every frame
    // this park caused is read against by the scan above. Set after the
    // room has moved rather than before it, so a frame the park itself
    // caused is judged against the leg it was caused by rather than the one
    // it left.
    bazaarLeg = round;
    return row;
  };
  const bazaarReadyAll = (round: number, phase: Phase) => {
    for (const captain of bazaarCrew) {
      bazaarSocketOf(captain).emit("phase:ready", {
        roomId: bazaarRoomId,
        round,
        phase,
      });
    }
  };
  const bazaarAdvanceTo = (from: number) =>
    waitForEvent<{
      roomId: string;
      round: number;
      phase: string;
      bazaarLean?: Record<string, number>;
    }>(
      bazaarSocketOf(bazaarThird),
      "phase:advance",
      (payload) => payload?.roomId === bazaarRoomId && payload?.round === from,
      5000,
    );

  bazaarSocketOf(bazaarSeller).emit("room:start", { roomId: bazaarRoomId });
  await bazaarSettle();

  // The bazaar belongs to the Parley, and the departure puts the room at
  // its opening seat rather than at one, so this is refused out of season
  // by construction rather than by a clock the run has to wait on.
  const bazaarAtPort = await parkBazaar(2, "market");
  const bazaarOutOfSeason = await bazaarRefused(
    bazaarSeller,
    "bazaar:publish",
    { good: "Silk", direction: 1 },
  );
  check(
    bazaarAtPort?.currentPhase === "market" &&
      bazaarOutOfSeason !== null &&
      bazaarOutOfSeason.includes(phaseFace("parley").label),
    "a rumor cannot be spread outside the Parley, and the refusal names the phase that opens the bazaar, because a rumor is spoken where the whole table hears it and the market it moves is the one after it",
  );

  await parkBazaar(3, "parley");
  const bazaarNoLean = await bazaarRefused(bazaarSeller, "bazaar:publish", {
    good: "Silk",
    direction: 0,
  });
  const bazaarSilent = await bazaarRefused(bazaarSeller, "bazaar:publish", {
    good: "Silk",
  });
  check(
    bazaarNoLean !== null &&
      bazaarNoLean === bazaarSilent &&
      bazaarNoLean.includes("one way or the other"),
    "a rumor leaning neither way is refused before anything else is read, and a frame carrying no direction at all is refused in the same sentence, because a row the market would ignore is a lie about a lie",
  );

  const bazaarLockedGood = Object.keys(COMMODITIES).find(
    (good) => !bazaarGoods("fair_winds", 4).includes(good),
  );
  if (!bazaarLockedGood) {
    throw new Error(
      "This route traded every commodity, so nothing is out of season at this port.",
    );
  }
  const bazaarNotTraded = await bazaarRefused(bazaarSeller, "bazaar:publish", {
    good: bazaarLockedGood,
    direction: 1,
  });
  check(
    bazaarNotTraded !== null && bazaarNotTraded.includes("does not trade"),
    "and a real commodity the coming market does not stock is refused rather than leaned onto nothing, because the list the server checks is the list that market draws from rather than the catalogue the game owns",
  );

  // The two rows this leg will price the next market with.
  const bazaarSilk = bazaarSpeaks(bazaarThird, (board) => board.length === 1);
  // The claim below reads the speaker's own board beside the frame it
  // watched, so that board is waited for too rather than read hopeful.
  const bazaarSilkEverywhere = bazaarBoardsReach(
    [bazaarSeller],
    (board) => board.length === 1,
  );
  bazaarSocketOf(bazaarSeller).emit("bazaar:publish", {
    roomId: bazaarRoomId,
    good: "Silk",
    direction: 1,
  });
  const bazaarAfterSilk = await bazaarSilk;
  await bazaarSilkEverywhere;
  check(
    bazaarAfterSilk?.rumors.length === 1 &&
      bazaarAfterSilk.rumors[0].round === 3 &&
      bazaarAfterSilk.rumors[0].publisherUserId === bazaarSeller.id &&
      bazaarAfterSilk.rumors[0].good === "Silk",
    "a captain who speaks puts a row on the board the whole harbor reads, and the row carries the leg it was spoken in and the name of the captain who spoke it",
  );
  check(
    bazaarAfterSilk?.rumors[0].direction === null &&
      bazaarDirectionOf(bazaarSeller, rumorId(bazaarSeller.id, 3)) === 1,
    "and the one fact the row is carrying is handed to its publisher alone: the captain who spoke reads their own lean back while the captain beside them reads the same row with the direction taken off",
  );

  const bazaarTea = bazaarSpeaks(bazaarThird, (board) => board.length === 2);
  // This claim reads three boards, and the frame it watched is only one of
  // them: the speaker's and the listener's are waited for beside it, or the
  // two lean readings it makes could be made against a board a moment
  // behind the frame that carried them.
  const bazaarTeaEverywhere = bazaarBoardsReach(
    [bazaarSeller, bazaarReader],
    (board) => board.length === 2,
  );
  bazaarSocketOf(bazaarReader).emit("bazaar:publish", {
    roomId: bazaarRoomId,
    good: "Tea",
    direction: -1,
  });
  const bazaarAfterTea = await bazaarTea;
  await bazaarTeaEverywhere;
  check(
    bazaarAfterTea?.rumors.length === 2 &&
      bazaarDirectionOf(bazaarThird, rumorId(bazaarSeller.id, 3)) === null &&
      bazaarDirectionOf(bazaarThird, rumorId(bazaarReader.id, 3)) === null &&
      bazaarDirectionOf(bazaarSeller, rumorId(bazaarSeller.id, 3)) === 1 &&
      bazaarDirectionOf(bazaarSeller, rumorId(bazaarReader.id, 3)) === null &&
      bazaarDirectionOf(bazaarReader, rumorId(bazaarSeller.id, 3)) === null &&
      bazaarDirectionOf(bazaarReader, rumorId(bazaarReader.id, 3)) === -1,
    "two captains can speak in one leg about two goods, and each of them reads their own row with its direction and the other captain's without: the third captain at the table, who holds no path at all, reads both rows and neither lean, which is what makes this a market rather than a private channel",
  );

  // A rumor is not a promise, so a captain who leaves the harbor does not
  // take their row with them. The two consent boards drop a departed
  // captain's rows; this one deliberately does not, because a row the
  // harbor heard is priced by the market it names whether or not the
  // captain who said it is still ashore.
  bazaarSocketOf(bazaarSeller).close();
  await bazaarSettle();
  check(
    bazaarBoardOf(bazaarThird).length === 2 &&
      bazaarSeen.get(bazaarThird.id)?.size === 2,
    "and a captain who leaves the table does not take their rumor with them, because a rumor is not a promise: dropping the row would reprice the good for everyone still sailing, which is a settlement applied halfway rather than a cleanup",
  );

  // A captain who comes back is handed the room's board, and the row they
  // own comes back to them with the lean still on it: the personalization
  // is a property of the payload rather than of the broadcast that
  // happened to be in flight when they left.
  const bazaarReload = await openAuthedSocket(bazaarSeller);
  run.sockets.push(bazaarReload);
  bazaarSockets.set(bazaarSeller.id, bazaarReload);
  const bazaarSnapshot = waitForEvent<BazaarBoard>(
    bazaarReload,
    "bazaar:update",
    (payload) => payload?.roomId === bazaarRoomId,
  );
  const bazaarSeatedAgain = waitForEvent<WireHistory>(
    bazaarReload,
    "chat:history",
    (payload) => payload?.roomId === bazaarRoomId,
  );
  bazaarReload.emit("room:join", { roomId: bazaarRoomId });
  const [bazaarOnJoin] = await Promise.all([bazaarSnapshot, bazaarSeatedAgain]);
  // A second wait is attached after the first board has landed, so the two
  // reads below are two frames rather than one frame seen twice.
  const bazaarAskedFor = waitForEvent<BazaarBoard>(
    bazaarReload,
    "bazaar:update",
    (payload) => payload?.roomId === bazaarRoomId,
  );
  bazaarReload.emit("bazaar:state:request", { roomId: bazaarRoomId });
  const bazaarOnAsk = await bazaarAskedFor;
  const readFrom = (board: BazaarBoard | null, rowId: string) =>
    (board?.rumors ?? []).find((row) => row.id === rowId)?.direction;
  check(
    readFrom(bazaarOnJoin, rumorId(bazaarSeller.id, 3)) === 1 &&
      readFrom(bazaarOnJoin, rumorId(bazaarReader.id, 3)) === null &&
      readFrom(bazaarOnAsk, rumorId(bazaarSeller.id, 3)) === 1 &&
      readFrom(bazaarOnAsk, rumorId(bazaarReader.id, 3)) === null,
    "a captain who comes back is handed the board twice, once as they take their seat and once when they ask for it, and both reads say the same thing: their own row comes back with the lean still on it and the row their tablemate spoke under comes back as nothing, because the personalization belongs to the payload rather than to the broadcast that happened to be in flight when they left",
  );

  const bazaarTooSoon = await bazaarRefused(bazaarSeller, "bazaar:publish", {
    good: "Hemp",
    direction: 1,
  });
  check(
    bazaarTooSoon !== null &&
      bazaarTooSoon === rumorCooldownLine(RUMOR_COOLDOWN_ROUNDS),
    "and a captain who has already spoken this leg is refused in the sentence the desk prints, counted off the rows the room already holds rather than off a counter a doctored client could simply not obey",
  );

  // The room's log, which is the other place the trade is written down.
  const bazaarLog = waitForEvent<{
    roomId: string;
    entries: VoyageLogEntry[];
  }>(
    bazaarSocketOf(bazaarThird),
    "voyage:log:history",
    (payload) => payload?.roomId === bazaarRoomId,
  );
  bazaarSocketOf(bazaarThird).emit("voyage:log:request", {
    roomId: bazaarRoomId,
  });
  const bazaarLines = ((await bazaarLog)?.entries ?? []).map(
    (entry) => entry.text,
  );
  // The line is built from the row the server itself broadcast, so the
  // check is a claim about the bazaar and the log agreeing rather than
  // about this file's copy of a sentence.
  const bazaarSilkRow = bazaarBoardOf(bazaarThird).find(
    (row) => row.id === rumorId(bazaarSeller.id, 3),
  );
  check(
    bazaarSilkRow !== undefined &&
      bazaarLines.includes(
        voyageLogLine({
          kind: "rumor_published",
          captain: bazaarSilkRow.publisherName,
          good: bazaarSilkRow.good,
        }),
      ),
    "the room's log carries the rumor as the bazaar wrote it, with the captain and the good and never the direction, because the log is public the instant it is written and the direction is not public until the market answers the row",
  );

  // ---- The leg the rumors land on ----
  //
  // The market of leg four is the one both rows were aimed at, and it is
  // opened by the advance out of Dawn, which is the step the server hangs
  // the lean on.
  await parkBazaar(4, "dawn");
  const bazaarReveal = bazaarAdvanceTo(4);
  // The reveal rides the same advance, so this is waited for as its own
  // frame rather than read after the fact: what the check below is about
  // is what the third captain was told, not what a board happened to hold
  // a moment later.
  const bazaarRevealed = waitForEvent<BazaarBoard>(
    bazaarSocketOf(bazaarThird),
    "bazaar:update",
    (payload) =>
      payload?.roomId === bazaarRoomId &&
      payload.rumors.some(
        (row) => row.id === rumorId(bazaarReader.id, 3) && row.direction === -1,
      ),
  );
  bazaarReadyAll(4, "dawn");
  const bazaarAtTheMarket = await bazaarReveal;
  await bazaarRevealed;
  check(
    bazaarAtTheMarket?.bazaarLean?.Silk === RUMOR_SHIFT_FRACTION &&
      bazaarAtTheMarket?.bazaarLean?.Tea === -RUMOR_SHIFT_FRACTION &&
      Object.keys(bazaarAtTheMarket?.bazaarLean ?? {}).length === 2,
    "the leg four market is priced against both rumors, each good leaned by exactly the band the constant declares, and the frame carrying the lean carries no name with it: every captain draws the same market from that frame and none of them is told which captain leaned which way",
  );
  check(
    bazaarDirectionOf(bazaarThird, rumorId(bazaarSeller.id, 3)) === 1 &&
      bazaarDirectionOf(bazaarThird, rumorId(bazaarReader.id, 3)) === -1,
    "and the reveal lands with the market rather than after it: the third captain, who read two rows with no direction a moment ago, now reads both, which is the plan's false positive generator and the reason a direction is held back for exactly one leg",
  );
  // The frame and the board, which are the two halves of one price: what a
  // captain was told the market was priced by, read against the lean their
  // own board makes of the rows it was sent beside. A client that drew the
  // board under the market would otherwise be drawing two numbers about one
  // good, and the reveal is what makes this readable at all: a direction
  // that is still standing is stripped for everyone but its publisher, so
  // the lean a captain can compute for themselves is only the whole lean
  // once the market it was meant for has opened.
  //
  // The rows the lean is built from are exactly the rows whose market has
  // just opened, and a row whose market has opened carries its direction to
  // every captain, which is what makes this computable from a board at all.
  // The narrowing is a claim rather than a hope: the count of the rows it
  // keeps is asserted beside the lean, so a board that had not taken the
  // reveal in yet could not pass this by having nothing to add up.
  const bazaarLandedRows = (captain: Captain, round: number): BazaarRumor[] =>
    bazaarBoardOf(captain).filter(
      (row): row is PublicRumor & { direction: RumorDirection } =>
        row.direction !== null && row.round + 1 === round,
    );
  const bazaarHeldLean = rumorLean(bazaarLandedRows(bazaarThird, 4), 4);
  const bazaarFrameLean = bazaarAtTheMarket?.bazaarLean ?? {};
  check(
    bazaarLandedRows(bazaarThird, 4).length === 2 &&
      Object.keys(bazaarHeldLean).length === 2 &&
      Object.keys(bazaarFrameLean).length ===
        Object.keys(bazaarHeldLean).length &&
      Object.entries(bazaarHeldLean).every(
        ([good, lean]) => bazaarFrameLean[good] === lean,
      ) &&
      Object.values(bazaarFrameLean).every(
        (lean) => Math.abs(lean) <= RUMOR_SHIFT_FRACTION,
      ),
    "and the lean the frame carried is the lean the board it was sent beside makes of its own rows, every good leaned inside the tenth the constant declares: the direction a captain reads off a row is the number their market was priced by, which is the one place the private half of this feature and the public half are the same fact",
  );

  await parkBazaar(4, "parley");
  const bazaarStillQuiet = await bazaarRefused(bazaarSeller, "bazaar:publish", {
    good: "Hemp",
    direction: 1,
  });
  check(
    bazaarStillQuiet !== null && bazaarStillQuiet === rumorCooldownLine(2),
    "a captain who spoke in one leg is refused through the two legs after it and told how many are left, which is the wait the desk draws before the click rather than a refusal discovered after it",
  );

  const bazaarThirdSpeaks = bazaarSpeaks(bazaarThird, (board) =>
    board.some((row) => row.publisherUserId === bazaarThird.id),
  );
  bazaarSocketOf(bazaarThird).emit("bazaar:publish", {
    roomId: bazaarRoomId,
    good: "Hemp",
    direction: -1,
  });
  check(
    (await bazaarThirdSpeaks) !== null,
    "and the wait is a hush on one captain rather than over the table: a captain who has not spoken this voyage may speak while the captain beside them is still quiet",
  );

  // The window the whole feature is built on: the market after next is
  // priced by the rumor spoken in leg four and by neither of the two from
  // leg three, and the market after that is told that nobody spoke at all.
  await parkBazaar(5, "dawn");
  const bazaarLegFive = bazaarAdvanceTo(5);
  bazaarReadyAll(5, "dawn");
  const bazaarAtFive = await bazaarLegFive;
  check(
    bazaarAtFive?.bazaarLean?.Hemp === -RUMOR_SHIFT_FRACTION &&
      Object.keys(bazaarAtFive?.bazaarLean ?? {}).length === 1,
    "and the next market is priced by the rumor spoken in leg four alone: the two rows from leg three are not carried forward, which is the one leg window the feature is built on",
  );

  await parkBazaar(6, "dawn");
  const bazaarLegSix = bazaarAdvanceTo(6);
  bazaarReadyAll(6, "dawn");
  const bazaarAtSix = await bazaarLegSix;
  check(
    bazaarAtSix !== null &&
      "bazaarLean" in bazaarAtSix &&
      Object.keys(bazaarAtSix.bazaarLean ?? {}).length === 0,
    "and a market nobody spoke about is sent an empty lean rather than no lean at all, because a market that is never told last leg's rumor is over would price the same good twice",
  );

  // ---- The closing leg, which has no market left to move ----
  //
  // The last leg of the voyage, walked to rather than sailed to: a
  // checkpoint only ever moves forward and nothing between here and there
  // is a leg this rule reads, so the walk is a jump.
  const bazaarClosingPark = await parkBazaar(12, "parley");
  const bazaarTooLate = await bazaarRefused(bazaarSeller, "bazaar:publish", {
    good: "Hemp",
    direction: 1,
  });
  check(
    bazaarClosingPark?.currentRound === 12 &&
      bazaarClosingPark?.currentPhase === "parley" &&
      bazaarTooLate !== null &&
      bazaarTooLate === rumorClosingLine(),
    "and the closing leg of the voyage is the one leg a rumor cannot be spoken in, refused in the bazaar's own sentence rather than in the wait's: a rumor is priced by the port one leg after the leg it was spoken in and this leg has no port after it, so the row would spend the publisher's whole cooldown leaning a market the voyage never opens",
  );
  check(
    bazaarBoardOf(bazaarThird).length === 3 &&
      bazaarSeen.get(bazaarThird.id)?.size === 3 &&
      bazaarTooLate !== rumorCooldownLine(1),
    "and the refusal is a refusal rather than a row written and then discarded: the board still carries the voyage's three rows and no fourth, and the captain is told the leg rather than a wait, because the two refusals are two different facts about their table and only one of them is about their own record",
  );

  // ---- A restarted voyage has a bazaar nobody has spoken at ----
  //
  // The rows go with the voyage that ends, which is the half of that clear
  // that is load bearing rather than tidy: a row is what a captain's
  // cooldown is measured from, so a row left standing across a restart
  // would refuse its publisher in the voyage about to begin, for legs they
  // never spoke in, and the desk would draw that wait over a button with
  // nothing behind it. The reading below is what the old rows would have
  // cost, computed off the very rows the room is holding, paired with what
  // the reopened bazaar actually does with them.
  const bazaarOldRows = bazaarBoardOf(bazaarThird);
  const bazaarHeldLeg = bazaarOldRows.find(
    (row) => row.publisherUserId === bazaarThird.id,
  )?.round;
  const bazaarCarried = rumorCooldownLeft(bazaarOldRows, bazaarThird.id, 1);
  // Armed before the restart rather than after it, because the frame the
  // clear sends is the one that says the rows are gone and a wait attached
  // afterwards would be a wait on a moment this run already missed.
  const bazaarCleared = waitForEvent<BazaarBoard>(
    bazaarSocketOf(bazaarThird),
    "bazaar:update",
    (payload) =>
      payload?.roomId === bazaarRoomId && payload.rumors.length === 0,
    5000,
  );
  bazaarSocketOf(bazaarSeller).emit("room:restart", { roomId: bazaarRoomId });
  let bazaarReopened = await bazaarRoomRow();
  for (
    let waited = 0;
    (bazaarReopened?.currentRound !== 1 ||
      bazaarReopened?.currentPhase !== "harbor") &&
    waited < 5000;
    waited += 250
  ) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    bazaarReopened = await bazaarRoomRow();
  }
  const bazaarEmptyBoard = await bazaarCleared;
  check(
    bazaarReopened?.currentRound === 1 &&
      bazaarReopened?.currentPhase === "harbor" &&
      bazaarEmptyBoard?.rumors.length === 0 &&
      bazaarBoardOf(bazaarThird).length === 0,
    "restarting the voyage reopens the harbor at its first checkpoint with a bazaar nobody has spoken at, and the board is emptied by a frame rather than by the clients looking away: a captain still standing in that harbor is told the rows are gone rather than left to work it out from a wait that never ends",
  );
  check(
    bazaarHeldLeg !== undefined &&
      bazaarCarried === bazaarHeldLeg + RUMOR_COOLDOWN_ROUNDS - 1 &&
      bazaarCarried > 0,
    "and the wait that clear spared the table is the wait the old rows would have charged: the row this captain spoke in leg four would have refused them in leg one of the voyage about to begin and for five legs after it, which is the one way this feature can read as a button that is simply broken rather than as a rule",
  );

  // The whole run's reading of the one invariant, which is the claim the
  // two publishes above are only able to make twice.
  //
  // Two controls hold the scan up rather than the count alone: the frames
  // it read carried real rows, and the same scan watched a publisher read
  // their own standing direction back, so a scan that had quietly stopped
  // finding anything would be visible in the number it did find rather than
  // passing as a clean harbor.
  check(
    bazaarLeaks.length === 0 &&
      bazaarOwnReads > 0 &&
      bazaarSeen.get(bazaarThird.id)?.size === 3,
    "no board this harbor ever sent carried a standing direction to a captain it was not the publisher's: every frame the three of them were handed was read as it landed rather than at the two moments a row was published, and the one reader who did see a direction on a standing row is the captain who chose it",
  );

  // The house rule, over the copy this feature added: the sentences a
  // captain reads at the bazaar are the bazaar's own, and the files that
  // carry them are held whole, comments included.
  check(
    !carriesADash("src/lib/game/engine/bazaar.ts") &&
      !carriesADash("src/lib/use-bazaar-rumors.ts") &&
      !carriesADash("src/components/portmasters/game/BazaarRumors.tsx") &&
      !carriesADash("src/server/realtime/bazaar.ts") &&
      // The desk's own refusals, which are copy a captain reads even
      // though they are written where the rule is enforced rather than
      // where it is drawn.
      !carriesADash("src/server/realtime/wiring/bazaar.ts"),
    "every file the bazaar's copy lives in reads free of en dashes, em dashes and doubled hyphens, which is the house rule for every string a captain reads",
  );

  // =====================================================================
  // [D6: Free Captain: Opportunist] The plan's clause for this feature,
  // and the whole of it: "Once per voyage, fulfill any one pathbound
  // order without joining that path, at a forty percent payout penalty."
  //
  // The checks are split the way the feature is. The allowance is
  // arithmetic and is read here without a server, because nothing in this
  // feature travels: the borrow is a permission the captain's own client
  // holds, the fill is the fill the manifest already ran, and the one
  // wire fact it adds is the counter the leg report files, which is read
  // where every leg report is read (see the telemetry spine above). The
  // board a captain meets is dealt through the engine's own lifecycle
  // rather than assembled by hand, the same way the pathbound board above
  // is dealt, so what is read here is the board a Free Captain really
  // meets in the Orders phase.
  // =====================================================================
}
