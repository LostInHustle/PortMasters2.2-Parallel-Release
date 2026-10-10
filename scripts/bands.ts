/**
 * The band report.
 *
 * Prints every Ocean Gambit win rate band, per role and per table size,
 * against the targets in src/lib/game/balance.ts. The epic's gate is a
 * claim about these numbers, so the numbers have to be readable without
 * writing a query: this reads the outcomes out of the same window the
 * balance page and the launch gate read (see readOperatorWindow in
 * src/server/telemetry-window) and hands them to the reader in that
 * module.
 *
 * The window rather than every row on the database, because the two used
 * to disagree about which voyages they were judging: this report counted
 * the whole table while the page and the gate counted the last three
 * hundred, and two surfaces answering one question over two different
 * windows is how a report tells a mode it passed while the page in front
 * of the operator shows it failing.
 *
 * Run with npm run report:bands, against whichever database DATABASE_URL
 * names at the time. It only reads.
 *
 * A cell with no voyages prints as unplayed rather than as 0.0%, because
 * three voyages are not evidence and no voyages are not a rate, and a
 * report that flattens either into a percentage is the kind of instrument
 * that agrees with whatever it is pointed at.
 */

import { readOperatorWindow } from "@/server/telemetry-window";
import {
  WIN_RATE_TARGETS,
  bandVerdict,
  ratePercent,
  readSwings,
  readWinRates,
} from "@/lib/game/balance";
import { runReport } from "./report";

// A cell with no rate prints as n/a rather than as a number, and every
// other one is written by the reader's own ratePercent, so this report and
// the balance dashboard cannot round the same cell to two different
// figures.
function percent(rate: number | null): string {
  return rate === null ? "  n/a" : ratePercent(rate);
}

async function main(): Promise<void> {
  // The window is the reader's own, so its outcomes are already the rows
  // that mean something: Classic rows carry an empty alignment and no
  // card was dealt there, which the window's chronicle read filters out
  // before this sees them. A record that would not parse takes its voyage
  // out of the window, and the count is printed below rather than
  // swallowed, because a gap the report does not mention reads as a
  // smaller run rather than as a missing one.
  const { outcomes, unreadable } = await readOperatorWindow();

  console.log("\nOcean Gambit win rate bands");
  console.log(
    `\n${outcomes.length} concluded voyages with a card dealt, in the operator window.`,
  );
  if (unreadable > 0) {
    console.log(
      `${unreadable} further voyage${unreadable === 1 ? "" : "s"} in the window could not be read and are not judged here.`,
    );
  }
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

runReport("The band report could not be read.", main);
