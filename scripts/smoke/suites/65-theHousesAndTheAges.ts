// PortMasters 2.2 Parallel Release, smoke run: The Houses and the Ages.
//
// [HYG-5] The first of the two coverage articles the studio audit's
// hygiene finding asked for: the Great Houses' pledge and its per voyage
// perk, the epoch anchored Age read, and the two account level boards,
// none of which had a suite of its own before this one.
//
// The pledge is walked through the route a Lobby picker calls, the perk
// on a fresh voyage the engine builds at the one place a voyage is born,
// the Ages at a fixed clock the way the engine's own comment invites
// ("tests and seeded voyages can pass a fixed Date"), and the boards as
// their routes' rows against the tables' own reduction rather than
// against a copy of the arithmetic.
//
// It signs up one captain of its own, because a pledge is account level
// and writing one onto a shared article's captain would leak between
// articles. No harbor is opened: the two boards are account level reads
// and every engine state below is built in process.

import { db } from "@/lib/db";
import { BROKERS_FAVOR_PAYOUT_CAP } from "@/lib/game/constants/world";
import {
  HOUSES,
  currentAge,
  nextAgeChange,
  noHousePerks,
  pirateChance,
  getHireCost,
  hireWorker,
} from "@/lib/game/engine";
import {
  WIDEST_BROKERS_FAVOR_PAYOUT_CAP,
  ageBackingReputationMultiplier,
  ageBarterReputation,
  brokersFavorPayoutCap,
} from "@/lib/game/engine/ages";
import { startMarket } from "@/lib/game/engine/market";
import { HOUSE_IDS, normalizeHouseId, type HouseId } from "@/lib/game/legacy";
import {
  check,
  call,
  signUp,
  voyageState,
  walkSrc,
  withoutComments,
} from "../harness";
import type { SmokeRun } from "../run";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(import.meta.dirname, "..", "..", "..");

function readSource(relative: string): string {
  return withoutComments(readFileSync(join(REPO, relative), "utf8"));
}

// Two weeks in milliseconds, spelled here rather than imported, because
// the anchor is the contract: every client computes the same Age at the
// same instant by flooring the Unix clock, and a suite that read the
// engine's own constant would follow it to any other anchor without
// noticing that the clients out in the world did not.
const FORTNIGHT = 14 * 24 * 60 * 60 * 1000;

export async function theHousesAndTheAgesSuite(run: SmokeRun): Promise<void> {
  // ---- A. The pledge is account level, and its route is the Lobby's ----
  const captain = await signUp("pledge");
  run.extraAccounts.push(captain);

  // Both reads refuse a stranger, and the pledge route refuses a House
  // the record does not hold: the enum is built from HOUSE_IDS, so an id
  // outside the tuple is a 400 rather than a row nothing can read back.
  const strangerPledge = await call<{ error?: string }>("/api/house", {
    method: "POST",
    body: JSON.stringify({ houseId: "jade_pavilion" }),
  });
  const strangerStandings = await call<{ error?: string }>(
    "/api/houses/standings",
  );
  const bogusPledge = await call<{ error?: string }>("/api/house", {
    method: "POST",
    cookie: captain.cookie,
    body: JSON.stringify({ houseId: "kraken_court" }),
  });
  check(
    strangerPledge.status === 401 &&
      strangerStandings.status === 401 &&
      bogusPledge.status === 400,
    "the pledge and its standings answer a stranger with a refusal rather than a row, and a House id the record does not hold is refused by the route's own enum rather than written and read back as nothing",
  );

  const pledged = await call<{ houseId?: string }>("/api/house", {
    method: "POST",
    cookie: captain.cookie,
    body: JSON.stringify({ houseId: "jade_pavilion" }),
  });

  type StandingRow = {
    houseId: string;
    name: string;
    icon: string;
    motto: string;
    perk: string;
    crowns: number;
    voyages: number;
    bestScore: number;
  };
  const standingsAfter = await call<{
    standings: StandingRow[];
    myHouseId: string | null;
  }>("/api/houses/standings", { cookie: captain.cookie });
  check(
    pledged.status === 200 &&
      pledged.body.houseId === "jade_pavilion" &&
      standingsAfter.body.myHouseId === "jade_pavilion",
    "a pledge lands through the route the picker calls and reads straight back on the standings, so the row a captain picks and the row their boards print are one write and one read rather than a screen's own memory",
  );

  // Every row wears the record itself, in the record's own order, so a
  // House reworded in ./engine/houses reaches the picker and never has
  // to be retyped into a route. The totals beside them are held to the
  // legacy table's own reduction underneath.
  check(
    standingsAfter.body.standings.length === HOUSE_IDS.length &&
      standingsAfter.body.standings.every(
        (row, index) =>
          row.houseId === HOUSE_IDS[index] &&
          row.name === HOUSES[index].name &&
          row.icon === HOUSES[index].icon &&
          row.motto === HOUSES[index].motto &&
          row.perk === HOUSES[index].perk,
      ),
    "the standings carry one row per House, in the record's own order, each wearing the name, crest, motto and perk the record itself states",
  );

  const legacyRows = await db.captainLegacy.findMany({
    where: { houseId: { not: null } },
    select: {
      houseId: true,
      voyagesCompleted: true,
      seaMasterCrowns: true,
      bestScore: true,
    },
  });
  const reduction = new Map<
    HouseId,
    { voyages: number; crowns: number; bestScore: number }
  >(HOUSE_IDS.map((id) => [id, { voyages: 0, crowns: 0, bestScore: 0 }]));
  for (const row of legacyRows) {
    const id = normalizeHouseId(row.houseId);
    if (!id) continue;
    const total = reduction.get(id)!;
    total.voyages += row.voyagesCompleted;
    total.crowns += row.seaMasterCrowns;
    total.bestScore = Math.max(total.bestScore, row.bestScore);
  }
  check(
    standingsAfter.body.standings.every((row) => {
      const total = reduction.get(row.houseId as HouseId);
      return (
        total !== undefined &&
        row.voyages === total.voyages &&
        row.crowns === total.crowns &&
        row.bestScore === total.bestScore
      );
    }),
    "and the totals beside each name are the legacy table's own reduction, recomputed here row by row: the voyages summed, the crowns summed and the best score kept at its maximum, with no captain's pledge counted into a House they did not choose",
  );

  // Switching is free and takes effect on the next fresh voyage, which is
  // the half of the design a route can hold: the field moves, and nothing
  // else on the row does.
  const switched = await call<{ houseId?: string }>("/api/house", {
    method: "POST",
    cookie: captain.cookie,
    body: JSON.stringify({ houseId: "golden_lotus" }),
  });
  const standingsSwitched = await call<{ myHouseId: string | null }>(
    "/api/houses/standings",
    { cookie: captain.cookie },
  );
  check(
    switched.status === 200 &&
      switched.body.houseId === "golden_lotus" &&
      standingsSwitched.body.myHouseId === "golden_lotus",
    "and a captain can switch Houses between voyages at no cost: the pledge follows the picker to the new House while the voyage in progress keeps the one it was stamped with",
  );

  // ---- B. The perk is stamped on a fresh voyage, and it fires ----

  // The flags table, read off voyages the engine builds at its one birth
  // place. Each House flips exactly its own perk and no other, and a
  // captain with no House reads the shared empty set, which is also what
  // every save written before Houses existed heals to.
  const jadeVoyage = voyageState({ houseId: "jade_pavilion" });
  const vermilionVoyage = voyageState({ houseId: "vermilion_gate" });
  const goldenVoyage = voyageState({ houseId: "golden_lotus" });
  const noneVoyage = voyageState({});
  check(
    jadeVoyage.houseId === "jade_pavilion" &&
      jadeVoyage.housePerks.jadeFreeHireAvailable &&
      !jadeVoyage.housePerks.vermilionExtraCard &&
      !jadeVoyage.housePerks.goldenWageDiscount &&
      !jadeVoyage.housePerks.goldenPirateBump &&
      vermilionVoyage.housePerks.vermilionExtraCard &&
      !vermilionVoyage.housePerks.jadeFreeHireAvailable &&
      goldenVoyage.housePerks.goldenWageDiscount &&
      goldenVoyage.housePerks.goldenPirateBump &&
      !goldenVoyage.housePerks.jadeFreeHireAvailable &&
      noneVoyage.houseId === null &&
      JSON.stringify(noneVoyage.housePerks) === JSON.stringify(noHousePerks()),
    "a fresh voyage is stamped with the pledged House and exactly that House's perk flags, and a voyage with no pledge reads the shared empty set rather than a private copy of it",
  );

  // Jade Pavilion's first artisan: the pledge covers the wage of the
  // first hire after the stamp, which is the round the artisan joins, so
  // an empty purse can still take the hire the House promised and the
  // next hire over that empty purse is refused like any other.
  const emptyPurse = voyageState({ houseId: "jade_pavilion" });
  emptyPurse.money = 0;
  const jadeHireLogs: string[] = [];
  hireWorker(emptyPurse, "weaver", jadeHireLogs);
  hireWorker(emptyPurse, "weaver", jadeHireLogs);
  const plainPurse = voyageState({});
  plainPurse.money = 0;
  const plainHireLogs: string[] = [];
  hireWorker(plainPurse, "weaver", plainHireLogs);
  check(
    emptyPurse.workers.weaver.length === 1 &&
      !emptyPurse.housePerks.jadeFreeHireAvailable &&
      emptyPurse.workers.weaver[0].freeFirstWage === true &&
      jadeHireLogs.some((line) => line.includes("Jade Pavilion pledge")) &&
      jadeHireLogs.some((line) => line.includes("Insufficient funds")) &&
      plainPurse.workers.weaver.length === 0 &&
      plainHireLogs.some((line) => line.includes("Insufficient funds")),
    "the Jade Pavilion pledge is spent by the first hire it covers and by no second one: a pledged captain with an empty purse comes away with one artisan, written as the one the waiver meant, while an unpledged captain with the same purse is refused at the hire",
  );

  // Vermilion Gate's extra lot: two voyages off one seed read the same
  // board, one card wider for the pledged captain, and they read it every
  // round rather than once, because the pledge is a lean on the harbor
  // rather than a one shot.
  const marketCtx = {
    seedBase: `smoke:houses:${captain.username}`,
    harborId: "smoke-houses",
  };
  const plannedVermilion = voyageState({ houseId: "vermilion_gate" });
  const plannedPlain = voyageState({});
  startMarket(plannedVermilion, marketCtx, []);
  startMarket(plannedPlain, marketCtx, []);
  const firstRound = plannedVermilion.resourceCards.length;
  const plainFirstRound = plannedPlain.resourceCards.length;
  plannedVermilion.currentRound += 1;
  plannedPlain.currentRound += 1;
  startMarket(plannedVermilion, marketCtx, []);
  check(
    firstRound === plainFirstRound + 1 &&
      plannedVermilion.resourceCards.length ===
        plannedPlain.resourceCards.length + 1,
    "the Vermilion Gate pledge widens the Port Purchase board by exactly one cargo lot off the same seed, on the round the pledge begins and on the round after it, which is the perk its record promises every round",
  );

  // Golden Lotus's two halves: a fifth off the wage the engine actually
  // charges, taken after every other shift the way getHireCost applies
  // it, and five percent onto the raid odds before any reduction, which
  // the settlement panel reads through the same function the roll does.
  const goldenWage = getHireCost(goldenVoyage, "weaver");
  const plainWage = getHireCost(noneVoyage, "weaver");
  check(
    goldenWage === Math.floor(plainWage * 0.8) && goldenWage < plainWage,
    "the Golden Lotus pledge takes its fifth off the wage every desk quotes, because the hire, the payroll and the severance all read the one cost function the discount is applied inside",
  );
  const plainOdds = pirateChance(noneVoyage);
  const goldenOdds = pirateChance(goldenVoyage);
  check(
    goldenOdds === Math.min(1, plainOdds * 1.05) && goldenOdds > plainOdds,
    "and the same pledge draws raiders five percent more often on the voyage's own tier odds, read through the one function the panel and the roll share rather than a second opinion of the risk",
  );

  // ---- C. The Ages anchor on the epoch, in every client the same ----

  // The three boundaries and the wrap, plus the one date no voyage will
  // pass and the function is still total for: a Date before 1970 lands
  // on the first Age rather than on an undefined row.
  check(
    currentAge(new Date(0)).id === "lender" &&
      currentAge(new Date(FORTNIGHT)).id === "trader" &&
      currentAge(new Date(2 * FORTNIGHT)).id === "broker" &&
      currentAge(new Date(3 * FORTNIGHT)).id === "lender" &&
      currentAge(new Date(FORTNIGHT - 1)).id === "lender" &&
      currentAge(new Date(-1)).id === "lender",
    "the Age is the floor of the clock over a fortnight taken modulo three, starting from the Unix epoch: the Lender, the Trader, the Broker and round again, with the last millisecond of a fortnight still the old Age and a date before the epoch still answering an Age rather than nothing",
  );
  check(
    nextAgeChange(new Date(0)).getTime() === FORTNIGHT &&
      nextAgeChange(new Date(FORTNIGHT - 1)).getTime() === FORTNIGHT &&
      nextAgeChange(new Date(FORTNIGHT)).getTime() === 2 * FORTNIGHT,
    "and the handover the banner counts down to is the same anchor one fortnight on, computed from the same clock the Age itself came from, so the two can never disagree about which side of a boundary a moment stands on",
  );

  // One accessor per Age, each the only reader of that Age's modifier,
  // read at fixed dates so the suite reproduces a chosen Age exactly.
  const lender = new Date(0);
  const trader = new Date(FORTNIGHT);
  const broker = new Date(2 * FORTNIGHT);
  check(
    ageBackingReputationMultiplier(lender) === 1.5 &&
      ageBackingReputationMultiplier(trader) === 1 &&
      ageBackingReputationMultiplier(broker) === 1 &&
      ageBarterReputation(lender) === 0 &&
      ageBarterReputation(trader) === 1 &&
      ageBarterReputation(broker) === 0 &&
      brokersFavorPayoutCap(lender) === BROKERS_FAVOR_PAYOUT_CAP &&
      brokersFavorPayoutCap(trader) === BROKERS_FAVOR_PAYOUT_CAP &&
      brokersFavorPayoutCap(broker) === 250,
    "each Age's effect lands through its own accessor at a fixed date: the Lender's backing pays half again, the Trader's completed barter lands one Reputation, and the Broker's commission cap rises, while each of the other two dates reads the ordinary rule rather than a leaning",
  );
  check(
    WIDEST_BROKERS_FAVOR_PAYOUT_CAP ===
      Math.max(BROKERS_FAVOR_PAYOUT_CAP, 250) &&
      WIDEST_BROKERS_FAVOR_PAYOUT_CAP >= brokersFavorPayoutCap(broker),
    "the plausibility bound is the widest cap any Age can put in force rather than the live one, so a save judged whenever it is next loaded still allows for the payout a captain collected under last fortnight's Age",
  );

  // The map from which Age it is to what it changes stays in one file,
  // and each accessor's named reader still calls it. The branch is swept
  // across the whole game library, not a hand list, and every file is
  // read with its comments stripped so a note about an accessor cannot
  // read as a call of it.
  const agesPath = join(REPO, "src", "lib", "game", "engine", "ages.ts");
  const strayBranches = walkSrc(join(REPO, "src", "lib", "game")).filter(
    (file) =>
      file !== agesPath &&
      withoutComments(readFileSync(file, "utf8")).includes("age.id ==="),
  );
  const agesCode = readSource("src/lib/game/engine/ages.ts");
  check(
    strayBranches.length === 0 &&
      agesCode.includes('age.id === "lender"') &&
      agesCode.includes('age.id === "trader"') &&
      agesCode.includes('age.id === "broker"') &&
      readSource("src/lib/game/engine/backingState.ts").includes(
        "ageBackingReputationMultiplier(",
      ) &&
      readSource("src/lib/game/engine/barter.ts").includes(
        "ageBarterReputation(",
      ) &&
      readSource("src/lib/game/engine/pricing.ts").includes(
        "brokersFavorPayoutCap(",
      ),
    "the branch from an Age's id to its effect lives in one file and nowhere else in the game library, and the three readers the record names still call their own accessor, so what an Age changes is decided in exactly one place",
  );

  // ---- D. The two boards are the tables' own rows ----

  type LeaderboardEntry = {
    userId: string;
    displayName: string;
    username: string;
    renownLevel: number;
    renownXP: number;
    voyagesCompleted: number;
    seaMasterCrowns: number;
    bestScore: number;
    consecutiveSolventVoyages: number;
    houseId: string | null;
  };
  const board = await call<{ leaderboard: LeaderboardEntry[] }>(
    "/api/leaderboard",
    { cookie: captain.cookie },
  );
  const boardRows = await db.captainLegacy.findMany({
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarHue: true,
        },
      },
    },
    orderBy: { renownXP: "desc" },
    take: 100,
  });
  const byUser = new Map(boardRows.map((row) => [row.userId, row]));
  check(
    board.body.leaderboard.length === boardRows.length &&
      board.body.leaderboard.every((entry, index) => {
        const row = byUser.get(entry.userId);
        return (
          row !== undefined &&
          entry.displayName === row.user.displayName &&
          entry.username === row.user.username &&
          entry.renownLevel === row.renownLevel &&
          entry.renownXP === row.renownXP &&
          entry.voyagesCompleted === row.voyagesCompleted &&
          entry.seaMasterCrowns === row.seaMasterCrowns &&
          entry.bestScore === row.bestScore &&
          entry.consecutiveSolventVoyages === row.consecutiveSolventVoyages &&
          entry.houseId === normalizeHouseId(row.houseId) &&
          (index === 0 ||
            board.body.leaderboard[index - 1].renownXP >= entry.renownXP)
        );
      }),
    "the leaderboard's rows are the legacy table's own, joined to the names it prints and ranked by Renown with the widest first, and every column on a row is the column the table holds rather than a figure the route worked out for the board alone",
  );
  // The board prints the top hundred by Renown, and a fresh account has
  // none to rank with: in a database the battery has filled past a
  // hundred rows, a zero Renown tail is not promised to be inside the
  // window at all. The two clauses below are the two claims split apart.
  // First the pledge alone wrote the row the boards read, read straight
  // off the table with no voyage sailed. Then the route's join itself:
  // the suite stands the new row at the head of the board, which is
  // scaffolding for the window and not a claim about the figure, reads
  // the captain's own line back through the route wearing the name and
  // the House, and puts the figure back the way it found it so the copy
  // carries no lifted ghost between suites.
  const myLegacyRow = await db.captainLegacy.findUnique({
    where: { userId: captain.id },
  });
  if (myLegacyRow) {
    await db.captainLegacy.update({
      where: { userId: captain.id },
      data: { renownXP: 9_000_000 },
    });
  }
  const headedBoard = await call<{ leaderboard: LeaderboardEntry[] }>(
    "/api/leaderboard",
    { cookie: captain.cookie },
  );
  const mine = headedBoard.body.leaderboard.find(
    (entry) => entry.userId === captain.id,
  );
  if (myLegacyRow) {
    await db.captainLegacy.update({
      where: { userId: captain.id },
      data: { renownXP: myLegacyRow.renownXP },
    });
  }
  check(
    myLegacyRow !== null &&
      normalizeHouseId(myLegacyRow.houseId) === "golden_lotus" &&
      mine !== undefined &&
      mine.houseId === "golden_lotus" &&
      mine.displayName === "Smoke pledge",
    "and the newest captain's own line stands on the board the moment they pledge, wearing the House they just chose, because a pledge is what writes the row the boards read rather than a voyage having to be sailed first",
  );
  const strangerBoard = await call<{ error?: string }>("/api/leaderboard");
  check(
    strangerBoard.status === 401,
    "and the board refuses a stranger the same way the standings do, because both read accounts rather than the room they were standing in",
  );
}
