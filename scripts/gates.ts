/**
 * The launch gate report.
 *
 * Prints the plan's sixteen launch gates against the window the balance
 * dashboard reads (src/server/telemetry-window.ts, the last three hundred
 * Ocean Gambit voyages on this database), and with them the ship decision
 * goal I4 asks for, taken by src/lib/game/gates.ts. The run's own claim is
 * that every one of the sixteen is in band over at least three hundred
 * recorded voyages, and a claim of that shape has to be readable without
 * opening a browser and without writing a query.
 *
 * Run with npm run report:gates, against whichever database DATABASE_URL
 * names at the time. It only reads.
 *
 * The exit code is the verdict rather than an accident, so the command can
 * stand in a release gate: 0 the mode is clear to ship, 1 it is held by a
 * gate that is out of band, 2 no verdict can be given yet, 3 the report
 * could not be read at all. Anything that is not a clear ship is a failure
 * of the command, which is the direction to fail in.
 *
 * A gate with no source prints as no source rather than as 0, because a
 * system still to build is not a number that is doing badly, and a report
 * that flattens the two is the kind of instrument that agrees with
 * whatever it is pointed at.
 */

import { db } from "@/lib/db";
import { readDashboard } from "@/lib/game/dashboard";
import {
  LAUNCH_PRIORITY,
  readLaunchVerdict,
  type LaunchGate,
} from "@/lib/game/gates";
import { readOperatorWindow } from "@/server/telemetry-window";

// The verdict as a word an operator reads rather than a slug: the reading
// verdicts are the page's own, so a gate cannot read "in" here and
// something else on the page.
function verdictWord(gate: LaunchGate): string {
  switch (gate.verdict) {
    case "in":
      return "in band";
    case "under":
      return "under";
    case "over":
      return "over";
    case "unplayed":
      return "no voyage";
    case "ungated":
      return "no threshold";
    default:
      return "no source";
  }
}

async function main(): Promise<void> {
  const reading = readDashboard(await readOperatorWindow());
  const verdict = readLaunchVerdict(reading);
  const { voyages, captains, sampleRate, truncated, unreadable } =
    reading.window;

  console.log("\nOcean Gambit launch gates");
  console.log(
    `\nThe last ${verdict.required} recorded voyages on this database, against the plan's floor of ${verdict.required}.`,
  );
  console.log(
    `Window: ${voyages} voyages, ${captains} captains, sample rate ${Math.round(
      sampleRate * 100,
    )}%, ${unreadable} unreadable, ${truncated} truncated.`,
  );

  // Columns wide enough for whatever the page named, so a long gate label
  // or a long reading shifts the table rather than colliding with the
  // column beside it.
  const gateWidth = Math.max(
    ...verdict.gates.map((gate) => gate.line.label.length),
  );
  const valueWidth = Math.max(
    "reading".length,
    ...verdict.gates.map((gate) => gate.line.value.length),
  );
  console.log(
    `\n${"verdict".padEnd(13)}${"gate".padEnd(gateWidth + 4)}${"reading".padEnd(
      valueWidth + 4,
    )}target`,
  );
  for (const gate of verdict.gates) {
    console.log(
      [
        verdictWord(gate).padEnd(13),
        gate.line.label.padEnd(gateWidth + 4),
        gate.line.value.padEnd(valueWidth + 4),
        gate.line.target,
      ].join(""),
    );
  }

  // A gate the page read at more than one table size, said out loud,
  // because the row above shows the one reading that decided it and a
  // reader should not have to guess that two others were read.
  const multiple = verdict.gates.filter((gate) => gate.readings > 1);
  if (multiple.length > 0) {
    console.log(
      `\nRead at more than one table size: ${multiple
        .map((gate) => `${gate.line.label} (${gate.readings} readings)`)
        .join(", ")}. The row above shows the reading that decided each.`,
    );
  }

  // The plan's tie break, printed on every run rather than only when it is
  // needed. The plan asks for the rule to be written down before the run
  // starts, and a rule that first appears in the report of the run that
  // broke is a rule discovered at the worst possible moment.
  for (const id of LAUNCH_PRIORITY) {
    const gate = verdict.gates.find((candidate) => candidate.id === id);
    console.log(
      `\nWhen two gates conflict, ${gate?.line.label ?? id} wins: it cannot be traded against the others.`,
    );
  }

  console.log(`\n${verdict.answer}`);
  for (const gap of verdict.gaps) {
    console.log(`  ${gap}`);
  }
  console.log("");

  process.exitCode =
    verdict.state === "clear" ? 0 : verdict.state === "held" ? 1 : 2;
}

main()
  .catch((err) => {
    console.error("The launch gate report could not be read.", err);
    process.exitCode = 3;
  })
  .finally(() => db.$disconnect());
