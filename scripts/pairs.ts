/**
 * The combination report.
 *
 * The reading is one per pair: win rate by combination, with any pair past a
 * threshold share of wins flagged automatically, because "with forty
 * boons, twenty modules and ten charters the pair matrix is far past what
 * anyone can hand test". This prints every pair the finished voyages have
 * carried, off the held sets the conclusion writes into the chronicle,
 * through the reader in src/lib/game/combinations.ts.
 *
 * Run with npm run report:pairs, against whichever database DATABASE_URL
 * names at the time. It only reads.
 *
 * A nightly simulation harness (both sides played without humans) is not
 * built, so the nightly run the flag is meant for is this report, run by
 * the operator and read as a recorded reading: the flags on this table are
 * what a balance pass would open with, and a pair below the appearance floor
 * prints its count and no rate, for the conversion report's own reason
 * (the count is what decides whether the rate means anything).
 */

import {
  PAIR_APPEARANCE_FLOOR,
  PAIR_WIN_CEILING,
  PAIR_WIN_SHARE,
  parseHeldCards,
  readPairs,
} from "@/lib/game/combinations";
import { ratePercent } from "@/lib/game/balance";
import { db } from "@/lib/db";
import { runReport } from "./report";

async function main(): Promise<void> {
  const rows = await db.voyageChronicle.findMany({
    select: { heldCards: true, won: true },
  });
  const reading = readPairs(
    rows.map((row) => ({ ids: parseHeldCards(row.heldCards), won: row.won })),
  );
  const measurable = reading.pairs.filter((pair) => pair.rate !== null).length;

  console.log("\nCombination win rates");
  console.log(
    `\n${rows.length} chronicle rows on this database, ${reading.voyages} carried a held set this pool can resolve, ${reading.wins} of those won.`,
  );
  console.log(
    `A rate is read from ${PAIR_APPEARANCE_FLOOR} appearances; ${measurable} of ${reading.pairs.length} pairs are there.`,
  );
  console.log(
    `A pair is flagged at or above ${(PAIR_WIN_CEILING * 100).toFixed(0)}% win rate or in more than ${(PAIR_WIN_SHARE * 100).toFixed(0)}% of wins: ${reading.flagged.length} flagged.`,
  );
  if (reading.pairs.length === 0) {
    console.log(
      "\nNo pair has been seen yet: no finished voyage carried two cards.",
    );
    console.log("");
    return;
  }
  console.log(
    "\npair                                        apps  wins    rate   share  flags",
  );
  for (const pair of reading.pairs) {
    const cells = [
      `${pair.aName} + ${pair.bName}`.padEnd(40),
      String(pair.appearances).padStart(6),
      String(pair.wins).padStart(6),
      pair.rate === null
        ? "n/a".padStart(7)
        : ratePercent(pair.rate).padStart(7),
      ratePercent(pair.share).padStart(8),
      pair.flags.length > 0 ? ` ${pair.flags.join(", ")}` : "",
    ];
    console.log(cells.join("  "));
  }
  console.log("");
}

runReport("The combination report could not be read.", main);
