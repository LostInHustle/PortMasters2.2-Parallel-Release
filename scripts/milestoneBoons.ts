/**
 * The milestone boons report.
 *
 * [F4: boons at milestone moments] The plan's evaluation of this feature
 * has two halves: "track boon pick rate against voyage outcome so it is
 * visible whether boons cluster on voyages that were already winning".
 * The pick rate half is the card tally's, and it is already read by
 * npm run report:cards, which walks every save's tally without knowing or
 * caring which cards are boons, so the five milestone boons appear there
 * the moment they are dealt and no second counter is kept here. What is
 * here is the outcome half: retention, read the way the dashboard reads
 * I2's maroon retention, as a pass over the captain lines of the
 * window's records rather than a join. It is the same window the balance
 * dashboard and report:gates read (src/server/telemetry-window.ts), one
 * reader for every operator number.
 *
 * The two cohorts partition the captains of the voyages that closed with
 * somebody standing: the captains whose voyage lost a hand, read off the
 * crewLost mark F4 writes on a captain's line at the same call that keeps
 * the leg report carrying the count, and the captains whose voyage lost
 * none. What is compared is the share of each cohort that was still in
 * the harbor when their voyage closed. A boon that cushions the voyages
 * that were already in trouble is a lost a hand row that climbs toward
 * the row beneath it, and the plan's question is answered by the gap
 * between the two.
 *
 * Voyages that emptied are left out, on the dashboard's own rule and for
 * the dashboard's own reason: a harbor that emptied has nobody left to be
 * standing, so its lines cannot answer whether a captain stayed. The
 * mode is the window's, because the boons are Ocean Gambit's: a Classic
 * voyage never loses a hand, and its lines would all sit in the second
 * row and flatten the base rate the first is read against.
 *
 * Run with npm run report:milestones, against whichever database
 * DATABASE_URL names at the time. It only reads.
 */

import type { TelemetryCaptain, TelemetryRecord } from "@/lib/game/telemetry";
import { readOperatorWindow } from "@/server/telemetry-window";
import { runReport } from "./report";

// One cohort's retention: how many lines it holds and how many of those
// were still standing at the close. The same pass the dashboard's maroon
// row makes, taken once per cohort rather than once for the whole list.
function cohortOf(
  lines: readonly TelemetryCaptain[],
  lost: boolean,
): { captains: number; stayed: number } {
  const held = lines.filter((line) => line.crewLost === lost);
  return {
    captains: held.length,
    stayed: held.filter((line) => line.presentAtEnd).length,
  };
}

// A share of a cohort, or a dash when the cohort is empty: a share of no
// captains is not a reading of zero, and printing 0% for it would read as
// a cohort that all walked out.
function shareOf(stayed: number, captains: number): string {
  return captains === 0 ? "-" : `${Math.round((stayed / captains) * 100)}%`;
}

async function main(): Promise<void> {
  const { records, unreadable } = await readOperatorWindow();
  // The voyages whose lines can answer the question, filtered on the
  // dashboard's own rule rather than beside it.
  const closing: TelemetryRecord[] = records.filter(
    (record) => record.outcome !== "emptied",
  );
  const lines = closing.flatMap((record) => record.captains);
  const lost = cohortOf(lines, true);
  const whole = cohortOf(lines, false);
  const rows = [
    { label: "lost a hand", ...lost },
    { label: "lost none", ...whole },
  ];

  console.log("\nMilestone boons: crew loss and retention");
  console.log(
    `\nThe last ${records.length} Ocean Gambit voyage(s) on this database, ` +
      `${closing.length} of them closed with somebody standing; ` +
      `${unreadable} unreadable, left out.`,
  );

  const nameWidth = Math.max(
    "cohort".length,
    ...rows.map((r) => r.label.length),
  );
  const line = (
    label: string,
    captains: string,
    stayed: string,
    share: string,
  ) =>
    `${label.padEnd(nameWidth)}  ${captains.padStart(8)}  ${stayed.padStart(14)}  ${share.padStart(5)}`;
  console.log("");
  console.log(line("cohort", "captains", "still standing", "share"));
  console.log(
    line("-".repeat(nameWidth), "-".repeat(8), "-".repeat(14), "-".repeat(5)),
  );
  for (const row of rows) {
    console.log(
      line(
        row.label,
        String(row.captains),
        String(row.stayed),
        shareOf(row.stayed, row.captains),
      ),
    );
  }
  console.log(
    closing.length === 0
      ? "\nNo voyage that closed with somebody standing is in the window yet, so the cohorts await their first reading."
      : `\n${lines.length} captain line(s) read. The plan's sentence is the comparison: a boon that cushions the voyages already in trouble shows as the lost a hand row climbing toward the row beneath it, and the boon pick rate that names which boon is read by npm run report:cards.`,
  );
}

runReport("The milestone boons report could not be read.", main);
