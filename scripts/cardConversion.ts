/**
 * The card conversion report.
 *
 * [F2: the card record, and the mode weighting field] The plan's evaluation
 * for this goal is one reading per card: "Offer to pick conversion per card,
 * with the appearance count beside it, because a card with a high win rate
 * over nine appearances is noise and a card with a high win rate over four
 * hundred is a problem." This prints exactly that, off the voyage saves that
 * carry the tally, through the reader in src/lib/game/cards.ts.
 *
 * Run with npm run report:cards, against whichever database DATABASE_URL
 * names at the time. It only reads.
 *
 * A card below the floor prints its appearance count and no rate rather than
 * a percentage, because the plan's own sentence is about the difference
 * between the two: the count is what decides whether the rate means
 * anything, so the count is what the row prints until it does.
 */

import {
  CARD_CONVERSION_FLOOR,
  normalizeCardTally,
  readCardConversion,
  type CardTally,
} from "@/lib/game/cards";
import { parseJsonObject } from "@/lib/game/json";
import { db } from "@/lib/db";
import { runReport } from "./report";

// One voyage's tally, read back the way the save heals it. A row whose blob
// will not parse, or that carries no tally at all, contributes nothing
// rather than stopping the report: a database holds saves written by every
// build that ever ran against it.
function tallyOf(data: string): CardTally {
  return normalizeCardTally(parseJsonObject(data)?.cardTally);
}

async function main(): Promise<void> {
  const rows = await db.gameState.findMany({ select: { data: true } });
  const total: CardTally = {};
  for (const row of rows) {
    for (const [id, counts] of Object.entries(tallyOf(row.data))) {
      const entry = (total[id] ??= { offered: 0, picked: 0 });
      entry.offered += counts.offered;
      entry.picked += counts.picked;
    }
  }

  const readings = readCardConversion(total);
  const measurable = readings.filter((reading) => reading.rate !== null).length;

  console.log("\nCard offer to pick conversion");
  console.log(
    `\n${rows.length} voyage saves on this database, ${readings.length} cards seen at least once.`,
  );
  console.log(
    `A rate is read from ${CARD_CONVERSION_FLOOR} appearances; ${measurable} of them are there.`,
  );
  console.log(
    "\ncard                        kind      offered  picked    rate",
  );
  for (const reading of readings) {
    const cells = [
      reading.name.padEnd(26),
      reading.kind.padEnd(8),
      String(reading.offered).padStart(7),
      String(reading.picked).padStart(7),
      reading.rate === null
        ? "n/a".padStart(7)
        : `${(reading.rate * 100).toFixed(1)}%`.padStart(7),
    ];
    console.log(cells.join("  "));
  }
  console.log("");
}

runReport("The card conversion report could not be read.", main);
