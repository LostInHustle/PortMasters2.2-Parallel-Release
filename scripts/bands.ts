/**
 * The band report.
 *
 * Prints every Ocean Gambit win rate band, per role and per table size,
 * against the targets in src/lib/game/balance.ts. The epic's gate is a
 * claim about these numbers, so the numbers have to be readable without
 * writing a query: this reads the finished voyages' chronicle rows and
 * hands them to the reader in that module.
 *
 * Run with npm run report:bands, against whichever database DATABASE_URL
 * names at the time. It only reads.
 *
 * A cell with no voyages prints as unplayed rather than as 0.0%, because
 * three voyages are not evidence and no voyages are not a rate, and a
 * report that flattens either into a percentage is the kind of instrument
 * that agrees with whatever it is pointed at.
 */

import { db } from "@/lib/db";
import {
  WIN_RATE_TARGETS,
  bandVerdict,
  ratePercent,
  readSwings,
  readWinRates,
  type VoyageOutcome,
} from "@/lib/game/balance";

// A cell with no rate prints as n/a rather than as a number, and every
// other one is written by the reader's own ratePercent, so this report and
// the balance dashboard cannot round the same cell to two different
// figures.
function percent(rate: number | null): string {
  return rate === null ? "  n/a" : ratePercent(rate);
}

async function main(): Promise<void> {
  // Classic voyages are filtered out here as well as inside the reader, so
  // the count below is the count of rows that mean something.
  const rows = await db.voyageChronicle.findMany({
    where: { alignment: { not: "" } },
    select: { alignment: true, won: true, seats: true },
  });
  const outcomes: VoyageOutcome[] = rows.map((row) => ({
    alignment: row.alignment,
    won: row.won,
    seats: row.seats,
  }));

  console.log("\nOcean Gambit win rate bands");
  console.log(
    `\n${outcomes.length} concluded voyages with a card dealt, on this database.`,
  );
  const readings = readWinRates(outcomes);
  console.log("\nrole    table size     played   won    rate    target");
  for (const reading of readings) {
    const target = WIN_RATE_TARGETS[reading.alignment];
    const cells = [
      reading.alignment.padEnd(8),
      reading.band.padEnd(16),
      String(reading.played).padStart(4),
      String(reading.won).padStart(7),
      percent(reading.rate).padStart(7),
      `${target.floor} to ${target.ceiling}%`,
      bandVerdict(reading.alignment, reading.rate),
    ];
    console.log(cells.join("  "));
  }

  // The gate's second half is the swing, so it gets a line of its own
  // rather than being left to a reader comparing three rows by eye. The
  // arithmetic is the reader's (readSwings), not this script's, because
  // the balance dashboard asks the same question of the same cells and
  // two implementations of one number is how they start to disagree.
  console.log("");
  for (const swing of readSwings(readings)) {
    if (swing.points === null) {
      console.log(
        `${swing.alignment}: no swing to read, ${
          swing.bands === 0 ? "no band played" : "one played band at most"
        }.`,
      );
      continue;
    }
    console.log(
      `${swing.alignment}: swing across played bands ${swing.points.toFixed(1)} points.`,
    );
  }
  console.log("");
}

main()
  .catch((err) => {
    console.error("The band report could not be read.", err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
