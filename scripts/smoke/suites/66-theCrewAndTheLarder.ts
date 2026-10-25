// PortMasters 2.2 Parallel Release, smoke run: The crew and the Larder.
//
// The second of the two coverage articles: the artisan walk (hire, assign
// and fire by name, with the wage and maintenance lines said as the
// engine says them), and a round the crew goes hungry, driven end to end
// from the meal to the work it slows and back out through provisioning.
//
// Nothing here opens a harbor: the walk runs one state in process from
// its first hire to its last dismissal, which is the shape the wage
// article beside it uses and for the same reason. The lines are pinned
// as the engine composes them, off the recipes and the roster the state
// itself carries, so a recipe retune moves the expectation with the
// engine rather than leaving a typed number behind.

import { ICONS } from "@/lib/game/constants/brand";
import { workerType } from "@/lib/game/constants/crew";
import { RECIPES } from "@/lib/game/constants/goods";
import {
  LARDER_START,
  RATION_PRICE,
  SHORT_RATIONS_YIELD,
} from "@/lib/game/constants/supplies";
import { getHireCost } from "@/lib/game/engine";
import {
  assignTask,
  fireWorker,
  hireWorker,
  payMaintenance,
  payWages,
  processProduction,
} from "@/lib/game/engine/workers";
import { feedCrew, onShortRations, provisionFood } from "@/lib/game/larder";
import { hungryProductionNote } from "@/lib/game/status-copy";
import {
  CARRIES_A_DASH,
  check,
  ledgerSentences,
  voyageState,
  withEnv,
} from "../harness";
import type { LedgerLine } from "@/lib/game/ledger";

const TASK = "Linen Clothes";

// The engine's own compositions of the lines this walk reads, built from
// the tables the engine builds them from: the recipe's materials out of
// RECIPES, each good's crest out of ICONS. A check that typed
// "🧶Hemp×2" would go on passing after a recipe retune and this one
// cannot.
function assignedLine(): string {
  const req = Object.entries(RECIPES[TASK].materials)
    .map(([good, amount]) => `${ICONS[good]}${good}×${amount}`)
    .join(" + ");
  return `📋 Assigned: Produce ${ICONS[TASK]}${TASK} (Req: ${req})`;
}

function shortageLine(have: Record<string, number>): string {
  const held = Object.entries(RECIPES[TASK].materials)
    .map(([good, amount]) => {
      const onHand = have[good] ?? 0;
      return `${ICONS[good]}${good} ${onHand}/${amount}${onHand < amount ? " ⚠️" : ""}`;
    })
    .join(" + ");
  return `❌ Material shortage to produce ${TASK}! (Have: ${held})`;
}

export async function theCrewAndTheLarderSuite(): Promise<void> {
  const weaver = workerType("weaver")!;
  // Every line the walk collects, for one closing sweep under the house
  // rule below rather than a dash test at each of the thirty checks.
  const readLines: LedgerLine[] = [];

  // ========== A. Every hire writes a person, and the line introduces them ==========
  const g = voyageState();
  g.money = 200;
  const hireLogs: LedgerLine[] = [];
  hireWorker(g, "weaver", hireLogs);
  hireWorker(g, "weaver", hireLogs);
  hireWorker(g, "weaver", hireLogs);
  readLines.push(...hireLogs);
  const wage = getHireCost(g, "weaver");
  const roster = g.workers.weaver;
  const names = roster.map((hand) => hand.name);
  check(
    roster.length === 3 &&
      names.every((name) => typeof name === "string" && name.length > 0) &&
      new Set(names).size === 3 &&
      roster.map((hand) => hand.seq).join(",") === "1,2,3" &&
      names.every((name) =>
        ledgerSentences(hireLogs).includes(
          `${weaver.icon} Hired ${name} the ${weaver.label}! Wage: ${wage} Gold / Round (paid at round end)`,
        ),
      ),
    "every hire draws a hand of their own and the line introduces the person rather than the trade: three hires are three names and three benches, each introduced with the wage the payroll will actually charge rather than the table's list price",
  );

  const broke = voyageState();
  broke.money = 0;
  const brokeLogs: LedgerLine[] = [];
  hireWorker(broke, "weaver", brokeLogs);
  readLines.push(...brokeLogs);
  check(
    broke.workers.weaver.length === 0 &&
      brokeLogs.length === 1 &&
      ledgerSentences(brokeLogs)[0] === "❌ Not enough Gold to hire artisans!",
    "and a hire the purse cannot cover is refused in one line with the bench left as it was, rather than taken and billed later by a payroll the captain never agreed to",
  );

  // ========== B. The assignment spends the recipe and names the shortfall ==========
  g.inventory["Hemp"] = 5;
  const assignLogs: LedgerLine[] = [];
  assignTask(g, "weaver", TASK, assignLogs);
  assignTask(g, "weaver", TASK, assignLogs);
  readLines.push(...assignLogs);
  check(
    ledgerSentences(assignLogs).filter((line) => line === assignedLine())
      .length === 2 &&
      roster[0].task === TASK &&
      roster[1].task === TASK &&
      g.inventory["Hemp"] === 1,
    "the first two assignments land on the first two hands in the order they came aboard, each spending the recipe out of the hold as it is handed out, which is the whole of what an assignment is: the materials are gone the moment the task exists",
  );
  const shortLogs: LedgerLine[] = [];
  assignTask(g, "weaver", TASK, shortLogs);
  readLines.push(...shortLogs);
  check(
    shortLogs.length === 1 &&
      ledgerSentences(shortLogs)[0] === shortageLine({ Hemp: 1 }) &&
      roster[2].task === null &&
      g.inventory["Hemp"] === 1,
    "and a task the hold cannot cover is refused by naming every material against what is on hand, flagging the short ones, with the idle hand still idle and the last Hemp still in the hold rather than spent on a line that never started",
  );

  // ========== C. Two fed rounds: the work lands, and the hand learns it ==========
  // The survival layer is held on for the meal below the way the launch
  // gates' article holds it: the rules read the same whatever the
  // operator set at the door.
  withEnv("NEXT_PUBLIC_SURVIVAL", "1", () => {
    g.currentRound = 1;
    g.larder = LARDER_START;
    const mealOne: LedgerLine[] = [];
    feedCrew(g, mealOne);
    readLines.push(...mealOne);
    const workOne: LedgerLine[] = [];
    processProduction(g, workOne);
    readLines.push(...workOne);
    check(
      ledgerSentences(mealOne).includes(
        "🍲 The crew eats 3 rations. 9 left in the larder.",
      ) &&
        g.larder === 9 &&
        ledgerSentences(workOne).filter(
          (line) =>
            line === `✅ ${weaver.label} finished ${ICONS[TASK]}${TASK}!`,
        ).length === 2 &&
        g.inventory[TASK] === 2 &&
        roster[0].producedCount === 1 &&
        roster[1].producedCount === 1 &&
        roster[2].producedCount === 0,
      "the crew eats one ration a head and the two assigned hands work: a round of grain comes off the count with the line saying what it cost, both hands bring home one finished good each on the bench's own finished line, which names the trade rather than the hand, and the idle hand's count stands at zero rather than being carried by the other two",
    );

    g.currentRound = 2;
    g.inventory["Hemp"] += 4;
    const assignTwo: LedgerLine[] = [];
    assignTask(g, "weaver", TASK, assignTwo);
    assignTask(g, "weaver", TASK, assignTwo);
    const mealTwo: LedgerLine[] = [];
    feedCrew(g, mealTwo);
    const workTwo: LedgerLine[] = [];
    processProduction(g, workTwo);
    readLines.push(...assignTwo, ...mealTwo, ...workTwo);
    check(
      ledgerSentences(workTwo).filter(
        (line) =>
          line ===
          `⭐ ${weaver.label} Promotion! Can now produce 2 items per round!`,
      ).length === 2 &&
        roster[0].isSkilled &&
        roster[1].isSkilled &&
        !roster[2].isSkilled &&
        g.inventory[TASK] === 4,
      "and the second round promotes both working hands the moment their second item lands, so a captain meets a Master on the roster the same way they met the recruit: the promotion arrives after the work that earned it, not instead of it, and the hand that never worked stays unskilled",
    );

    // ========== D. The payroll says what it takes, and what it cannot ==========
    const wageLogs: LedgerLine[] = [];
    const paid = payWages(g, wageLogs);
    readLines.push(...wageLogs);
    check(
      paid === true &&
        ledgerSentences(wageLogs).includes(
          `💰 Paid wages for 3 Weavers: ${3 * wage} Gold`,
        ) &&
        g.money === 200 - 3 * wage &&
        g.workerWages === 3 * wage,
      "the payroll line names the trade in its plural with the count and the Gold it took, and the purse and the voyage's wage ledger move by exactly the figure the bill quoted, so the line a captain reads and the number the settlement holds are one deduction",
    );

    const underpaid = voyageState();
    underpaid.money = 200;
    hireWorker(underpaid, "weaver", []);
    underpaid.money = 3;
    const shortPayLogs: LedgerLine[] = [];
    const shortPaid = payWages(underpaid, shortPayLogs);
    readLines.push(...shortPayLogs);
    check(
      shortPaid === "bankruptcy" &&
        ledgerSentences(shortPayLogs).includes(
          `⚠️ Not enough Gold! Needed: ${getHireCost(underpaid, "weaver")}, Have: 3`,
        ) &&
        ledgerSentences(shortPayLogs).includes(
          "💥 Could not pay wages, the crew is left unpaid.",
        ) &&
        ledgerSentences(shortPayLogs).includes(
          "💥 Reputation collapsed: a bankruptcy is recorded.",
        ) &&
        underpaid.money === 3 &&
        underpaid.workerWages === 0,
      "and a payroll the purse cannot cover says the shortfall by number, says plainly that the crew is left unpaid and a bankruptcy is recorded, and takes nothing: the lines stopped short of ending the voyage in words because the seat that keeps sailing decides what the failure costs",
    );

    // ========== E. The maintenance bill, paid, forced and absent ==========
    const cost = g.fixedCost + g.maintenancePenalty;
    const beforeMaintenance = g.money;
    const maintenanceLogs: LedgerLine[] = [];
    const maintained = payMaintenance(g, maintenanceLogs);
    readLines.push(...maintenanceLogs);
    check(
      maintained === true &&
        ledgerSentences(maintenanceLogs).includes(
          `💸 Paid Ship Maintenance Fee: ${cost} Gold`,
        ) &&
        g.money === beforeMaintenance - cost &&
        g.maintenanceCosts === cost,
      "the maintenance line is the hull's own bill rather than a flat fee in words: the fixed cost plus whatever the hull was carrying, charged to the Gold and written to the voyage's maintenance ledger in the same statement",
    );

    const thin = voyageState();
    thin.money = 5;
    const thinLogs: LedgerLine[] = [];
    const thinPaid = payMaintenance(thin, thinLogs);
    readLines.push(...thinLogs);
    const empty = voyageState();
    empty.money = 0;
    const emptyLogs: LedgerLine[] = [];
    const emptyPaid = payMaintenance(empty, emptyLogs);
    readLines.push(...emptyLogs);
    check(
      thinPaid === "bankruptcy" &&
        ledgerSentences(thinLogs).includes(
          `⚠️ Forced payment of 5 Gold (Needed ${thin.fixedCost + thin.maintenancePenalty} Gold)`,
        ) &&
        ledgerSentences(thinLogs).includes(
          "⚠️ Gold depleted: the maintenance fee goes unpaid.",
        ) &&
        thin.money === 0 &&
        thin.maintenanceCosts === 5 &&
        emptyPaid === "bankruptcy" &&
        emptyLogs.length === 0,
      "a hull with something left in the purse pays what it can and the line names both figures, a hull with nothing left is a bankruptcy with no line at all rather than a forced payment of nothing, and both leave the voyage's ending to the seat that decides it",
    );

    // ========== F. A dismissal names the person and the price ==========
    g.inventory["Hemp"] += 2;
    assignTask(g, "weaver", TASK, []);
    const beforeFire = g.money;
    const fireLogs: LedgerLine[] = [];
    fireWorker(g, "weaver", 0, fireLogs);
    readLines.push(...fireLogs);
    check(
      ledgerSentences(fireLogs).includes(
        `💔 Dismissed ${names[0]} the ${weaver.label}. Severance: ${wage} Gold`,
      ) &&
        ledgerSentences(fireLogs).includes(
          `  This artisan was making: ${TASK}`,
        ) &&
        g.money === beforeFire - wage &&
        g.workers.weaver.length === 2 &&
        g.workers.weaver.every((hand) => hand.name !== names[0]),
      "a dismissal names the hand who left rather than the trade alone, takes the severance the same cost function quoted for their hire, and hands over what they were making, so a captain reading the line back can match the person to the bench and the bench to the bill",
    );

    const poor = voyageState();
    poor.money = 200;
    hireWorker(poor, "weaver", []);
    poor.money = 0;
    const poorLogs: LedgerLine[] = [];
    fireWorker(poor, "weaver", 0, poorLogs);
    readLines.push(...poorLogs);
    check(
      poorLogs.length === 1 &&
        ledgerSentences(poorLogs)[0] ===
          `❌ Not enough Gold for ${weaver.label}'s severance: ${getHireCost(poor, "weaver")}` &&
        poor.workers.weaver.length === 1,
      "and a severance the purse cannot pay leaves the hand aboard rather than dismissing them into a debt, with the refusal naming the trade and the figure the dismissal would have taken",
    );
  });

  // ========== G. The hungry round, end to end ==========
  withEnv("NEXT_PUBLIC_SURVIVAL", "1", () => {
    const h = voyageState();
    h.money = 1000;
    const lonelyLogs: LedgerLine[] = [];
    hireWorker(h, "weaver", lonelyLogs);
    readLines.push(...lonelyLogs);
    const hand = h.workers.weaver[0];
    h.larder = LARDER_START;

    // Two fed rounds first, through the engine's own order: feed, assign,
    // work. They are what makes the shortage round readable, because the
    // lone hand has to have come into its skill before hunger has
    // anything to take off it.
    for (let round = 0; round < 2; round++) {
      h.currentRound = round + 1;
      feedCrew(h, []);
      h.inventory["Hemp"] = (h.inventory["Hemp"] ?? 0) + 2;
      assignTask(h, "weaver", TASK, []);
      processProduction(h, []);
    }
    check(
      hand.isSkilled &&
        h.larder === LARDER_START - 2 &&
        h.inventory[TASK] === 2 &&
        !onShortRations(h),
      "two fed rounds bring the lone hand to its skill through the work itself, one finished good a round, with the larder one ration lighter each time and the shortage still silent",
    );

    // The round the larder runs dry on: the meal eats the last ration, the
    // announcement lands on that same round, and the work that follows it
    // is done under the rule the announcement just stated.
    h.currentRound = 3;
    h.larder = 1;
    const hungryMeal: LedgerLine[] = [];
    const mealWasEaten = feedCrew(h, hungryMeal);
    h.inventory["Hemp"] = (h.inventory["Hemp"] ?? 0) + 2;
    assignTask(h, "weaver", TASK, []);
    const hungryWork: LedgerLine[] = [];
    processProduction(h, hungryWork);
    readLines.push(...hungryMeal, ...hungryWork);
    check(
      mealWasEaten === true &&
        h.larder === 0 &&
        onShortRations(h) &&
        hungryMeal.length === 1 &&
        ledgerSentences(hungryMeal)[0].includes("Short rations") &&
        ledgerSentences(hungryMeal)[0].includes(
          `${Math.round(SHORT_RATIONS_YIELD * 100)}%`,
        ),
      "the round the last ration goes is the round the shortage is announced on: the meal is still eaten, the count reads empty rather than in debt, and the line states the pace the engine is about to apply rather than a warning that arrives after it",
    );
    check(
      ledgerSentences(hungryWork).includes(hungryProductionNote()) &&
        ledgerSentences(hungryWork).includes(
          `✅ Skilled ${weaver.label} finished 1× ${ICONS[TASK]}${TASK}!`,
        ) &&
        !ledgerSentences(hungryWork).some((line) => line.includes("(Bonus)")) &&
        h.inventory[TASK] === 3,
      "and the hungry round costs exactly what the rule says: the skilled hand that finished two the round before brings home one, the line counts the one it brought home rather than promising the two its skill would have made, and the note above it names the state and the way back before the smaller number is read",
    );

    // The way back: provisions bought at a market, through the same
    // function the panel's buttons call, and the next round is fed.
    const provisionLogs: LedgerLine[] = [];
    const bought = provisionFood(h, "Grain", 2, provisionLogs);
    readLines.push(...provisionLogs);
    check(
      bought === 2 &&
        ledgerSentences(provisionLogs).includes(
          `🧺 Provisioned 2 rations of Grain for 1 aboard (${2 * RATION_PRICE} Gold). 2 in the larder.`,
        ) &&
        h.larder === 2 &&
        h.money === 1000 - 2 * RATION_PRICE &&
        h.foodSpend === 2 * RATION_PRICE &&
        !onShortRations(h),
      "and the way back is a purchase rather than a wait: two rounds of grain bought at the one provisioning function the market panel calls, charged to the purse and counted to the voyage's food spending at the same till, and the shortage is over the moment the count passes zero",
    );

    h.currentRound = 4;
    const fedMeal: LedgerLine[] = [];
    feedCrew(h, fedMeal);
    h.inventory["Hemp"] = (h.inventory["Hemp"] ?? 0) + 2;
    assignTask(h, "weaver", TASK, []);
    const fedWork: LedgerLine[] = [];
    processProduction(h, fedWork);
    readLines.push(...fedMeal, ...fedWork);
    check(
      ledgerSentences(fedMeal).includes(
        "🍲 The crew eats 1 ration. 1 left in the larder.",
      ) &&
        !ledgerSentences(fedWork).includes(hungryProductionNote()) &&
        ledgerSentences(fedWork).includes(
          `✅ Skilled ${weaver.label} finished 2× ${ICONS[TASK]}${TASK}!`,
        ) &&
        h.inventory[TASK] === 5,
      "and the round after the purchase is the fed round again: the same hand on the same task brings home two where the hungry round brought home one, the hunger note is gone rather than standing as a habit, and the shortage has cost the voyage exactly the goods the one round was short",
    );
  });

  // ========== The house rule, over every line the walk read ==========
  check(
    readLines.length >= 25 &&
      ledgerSentences(readLines).every(
        (line) => line.trim().length > 0 && !CARRIES_A_DASH.test(line),
      ),
    "every line this walk put in front of a captain, from the first hire to the last provision, says something and holds the house rule: no dashes and no doubled hyphens anywhere in the recount of the voyage",
  );
}
