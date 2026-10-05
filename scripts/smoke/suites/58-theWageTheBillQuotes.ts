// PortMasters 2.2 Parallel Release, smoke run: The wage the bill quotes.

import { getHireCost, hireWorker, payWages, wageBill } from "@/lib/game/engine";
import { check, voyageState } from "../harness";

/**
 * One roster, one bill, five readers: payWages charges it, and four
 * surfaces quote it (the settle sheet, the bench payroll, the advice
 * line, the left rail). Each of the four used to walk the roster itself,
 * and none of them knew about the Jade Pavilion pledge, so a pledged
 * captain was billed exactly one wage too many: the settle button warned
 * of a bankruptcy the run would never deliver and the harbor aid request
 * was seeded with a shortfall that did not exist. What is settled here is
 * the reader all five now share: the figure it quotes before the run is
 * the figure the run charges, the pledge is spent on exactly one run,
 * and a trade whose only hand is sponsored reads as owing nothing while
 * still reporting why.
 *
 * The states below are built by hand in the manner of the order
 * settlement beside this article: no dealer writes a pledged hire for
 * you, and the arithmetic under check is the arithmetic the engine's own
 * paths run on.
 */
export async function theWageTheBillQuotesSuite(): Promise<void> {
  const logs: string[] = [];

  // ---- A. The bill read before the run is the bill the run charges ----
  // Two hands of one trade, the first taken on the pledge: the reader
  // must count them apart, because only one of them pays.
  const g = voyageState();
  g.money = 200;
  g.housePerks.jadeFreeHireAvailable = true;
  hireWorker(g, "weaver", logs);
  hireWorker(g, "weaver", logs);
  const wage = getHireCost(g, "weaver");
  const firstBill = wageBill(g);
  const quoted = firstBill.find((b) => b.id === "weaver");
  check(
    quoted !== undefined &&
      quoted.count === 1 &&
      quoted.sponsored === 1 &&
      quoted.due === wage,
    "the bill read before the run counts the pledge hire apart from the hand that pays, so the settle sheet quotes one wage for a two hand bench where a hand count alone would quote two",
  );

  const billTotal = firstBill.reduce((sum, b) => sum + b.due, 0);
  const before = g.money;
  const wageLogs: string[] = [];
  const paid = payWages(g, wageLogs);
  check(
    paid === true &&
      g.money === before - billTotal &&
      g.workerWages === billTotal,
    "and the run charges the figure that was quoted, to the Gold: what every screen reads before the settle and what the payroll takes out of the purse are one number rather than two readings of one bench",
  );
  check(
    wageLogs.some(
      (line) =>
        line === "🪷 Jade Pavilion covers the wage for 1 Weaver this round.",
    ),
    "and the pledge is named on the run that spends it, in the engine's own sentence, so the sheet's annotation and the ledger's line cannot describe two different waivers",
  );

  // ---- B. The pledge covers one run, not one service ----
  // The same bench a round later: the waiver is spent, the hand is not.
  const nextBill = wageBill(g);
  const quotedAfter = nextBill.find((b) => b.id === "weaver");
  check(
    quotedAfter !== undefined &&
      quotedAfter.count === 2 &&
      quotedAfter.sponsored === 0 &&
      quotedAfter.due === 2 * wage,
    "so the next bill folds the covered hand back in at its full wage, because the pledge covers a captain's first payroll run rather than that artisan for the rest of the voyage",
  );
  const secondBefore = g.money;
  const secondLogs: string[] = [];
  const again = payWages(g, secondLogs);
  check(
    again === true &&
      secondBefore - g.money === nextBill.reduce((sum, b) => sum + b.due, 0),
    "and the run after it charges what the folded bill quoted, which is the second half of the same promise: one reader, every run",
  );

  // ---- C. A trade with nothing to charge still says why ----
  // The settle sheet's own case: a bench of one, and that one is the
  // pledge hire. The bill reads 0 Gold, the run takes nothing, and the
  // reason is still spoken, because a waiver a screen cannot explain is a
  // discount a captain cannot audit.
  const lonely = voyageState();
  lonely.money = 50;
  lonely.housePerks.jadeFreeHireAvailable = true;
  hireWorker(lonely, "master", logs);
  const masterRow = wageBill(lonely).find((b) => b.id === "master");
  check(
    masterRow !== undefined &&
      masterRow.count === 0 &&
      masterRow.sponsored === 1 &&
      masterRow.due === 0,
    "a trade whose only hand is sponsored reads as owing nothing rather than as absent: the settle sheet draws 0 Gold beside a roster of one instead of hiding the trade it just hired",
  );
  const lonelyBefore = lonely.money;
  const lonelyLogs: string[] = [];
  const lonelyPaid = payWages(lonely, lonelyLogs);
  check(
    lonelyPaid === true &&
      lonely.money === lonelyBefore &&
      lonelyLogs.some(
        (line) =>
          line ===
          "🪷 Jade Pavilion covers the wage for 1 Master Weaver this round.",
      ),
    "and the run behind that sheet spends the pledge, takes no Gold, and still names the waiver, which is the settle the sheet promised",
  );
}
