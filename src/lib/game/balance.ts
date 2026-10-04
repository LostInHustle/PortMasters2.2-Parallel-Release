// =====================================================================
// PortMasters 2.2 Parallel Release: reading the mode's win rates.
//
// [H5: the quota rung] The epic's gate is a claim about numbers: an honest
// captain wins something between 52 and 58 voyages in a hundred, a Broker
// between 35 and 45, a Pirate between 20 and 26, and none of those rates
// moves when the table grows from four seats to five to six. Before H4
// nothing could check that, because a voyage concluded without recording
// who was dealt what. Now every finished voyage leaves its alignment and
// its verdict on a Chronicle row, so the claim is a query, and this module
// is the query: rows in, a reading of every band out.
//
// It is pure and it owns no database, the way ./victory.ts owns no socket:
// the reader below is arithmetic over rows, and the script that fetches
// them (scripts/bands.ts) is thin on purpose. One consequence worth naming
// is that a reading is never a measurement of the *players*, only of the
// voyages that happened to be played. A band with three voyages in it has a
// rate; it does not have evidence, and the report says so rather than
// rounding three voyages into a verdict.
//
// Bands are the deck's own (see ./objectives.ts): the reader walks the same
// table the rung scales quotas with, so a report can never group voyages by
// a table size the commission does not distinguish.
// =====================================================================

import { SEAT_BANDS, seatBand } from "./objectives";
import type { GambitRole } from "./gambit";

// One finished voyage, as far as the rates care: what the captain was
// dealt, whether they won it, and how big the fleet was. Exactly the three
// columns the conclusion writes.
export type VoyageOutcome = {
  // The VoyageRole the table dealt, or "" for a Classic voyage, which this
  // reader skips: no card was dealt there and none of the three targets
  // below describes one.
  alignment: string;
  won: boolean;
  // Room.voyageSeats at the moment of conclusion. 0 is a voyage that began
  // before the rung existed, and it is read as the anchor band, which is
  // the board it was in fact judged on.
  seats: number;
};

// The plan's targets, in percent, and the reason this reader exists rather
// than a hand written query in a planning document: a target that lives
// only in prose is retyped into every report that judges against it, and
// the one that gets retyped wrong is the one nobody notices.
export const WIN_RATE_TARGETS: Record<
  GambitRole,
  { floor: number; ceiling: number }
> = {
  honest: { floor: 52, ceiling: 58 },
  broker: { floor: 35, ceiling: 45 },
  pirate: { floor: 20, ceiling: 26 },
};

// The three roles in the order the deck deals them, which is the order a
// report reads them in: the fleet, then the two who are playing against it.
// Exported since the balance dashboard's cover row reads the same three
// rates in the same order (see ./dashboard), and a second order would be
// one of the two places a reader could find the roles listed differently.
export const ROLE_ORDER: readonly GambitRole[] = ["honest", "broker", "pirate"];

// One cell of the grid: how a role did at one table size.
type BandReading = {
  alignment: GambitRole;
  // The band's own label, taken from the deck's table rather than written
  // again, so a report and the rung cannot disagree about what a band is
  // called. It is the whole address of the cell as far as anything reading
  // one is concerned, which is why the band's seat floor is not carried
  // here as well: the label says it to a reader and the table says it to
  // any arithmetic that needs the number.
  band: string;
  played: number;
  won: number;
  // won over played, or null when nothing was played, because a rate over
  // no voyages is not zero: it is unknown, and a report that prints 0.0%
  // there is reporting a loss nobody suffered.
  rate: number | null;
};

/**
 * Every role at every table size, in a fixed order.
 *
 * The grid is complete rather than only the cells that saw play, which is
 * the point: the gate claims the Pirate's rate does not swing with table
 * size, and a reading that silently dropped the six seat column while
 * nobody had played one would be agreeing with itself. A row with
 * `played === 0` is a hole in the evidence and reads as one.
 */
export function readWinRates(rows: readonly VoyageOutcome[]): BandReading[] {
  const readings: BandReading[] = [];
  for (const alignment of ROLE_ORDER) {
    for (const band of SEAT_BANDS) {
      // The band a row is in, compared by identity: both sides come out of
      // the deck's own table, so the same band is the same object.
      const cell = rows.filter(
        (row) => row.alignment === alignment && seatBand(row.seats) === band,
      );
      const won = cell.filter((row) => row.won).length;
      readings.push({
        alignment,
        band: band.label,
        played: cell.length,
        won,
        rate: cell.length === 0 ? null : won / cell.length,
      });
    }
  }
  return readings;
}

// One role's spread across the table sizes it was actually played at.
//
// The gate's second half is that a rate does not move as the table grows,
// so the number a reader wants is the widest gap between the bands that
// saw play. A band nobody played is skipped rather than counted as zero,
// which would put a spectacular swing on the board for a table size that
// does not exist, and a role with fewer than two played bands has no
// swing to read at all: `points` is null there rather than 0.0, which is
// the same rule `rate` follows one cell up.
type SwingReading = {
  alignment: GambitRole;
  // How many bands of this role saw play, so "one played band at most"
  // and "no band played" can be told apart by whatever prints it.
  bands: number;
  points: number | null;
};

/**
 * Every role's swing across the bands it was played at, in the same order
 * readWinRates returns its cells.
 *
 * It takes readings rather than rows so the two readers cannot disagree
 * about the same arithmetic: the report and the balance dashboard both
 * hand it the output of readWinRates, and there is one implementation of
 * "the widest gap between the played bands" in the tree.
 */
export function readSwings(readings: readonly BandReading[]): SwingReading[] {
  return ROLE_ORDER.map((alignment) => {
    const played = readings
      .filter((reading) => reading.alignment === alignment)
      .map((reading) => reading.rate)
      .filter((rate): rate is number => rate !== null);
    return {
      alignment,
      bands: played.length,
      points:
        played.length < 2
          ? null
          : (Math.max(...played) - Math.min(...played)) * 100,
    };
  });
}

// Where a rate sits against its role's target. A rate is judged in whole
// percent, matching the targets, so a rate that rounds to the floor is in
// band: 52.4% against a floor of 52 is a rate the plan asked for, and
// failing it on a hundredth of a percent would be a gate nobody can pass.
export type BandVerdict = "in" | "under" | "over" | "unplayed";

export function bandVerdict(
  alignment: GambitRole,
  rate: number | null,
): BandVerdict {
  if (rate === null) return "unplayed";
  // Rounded before it is compared, which is the whole reason the comment
  // above says whole percent: a rate of 51.6 is a rate the plan asked for,
  // and 19.4 is not, and neither is decided by the hundredth of a point
  // that division left behind. It is also what keeps the boundaries honest
  // under floating point, where 0.58 * 100 is a whisker under 58.
  const percent = Math.round(rate * 100);
  const target = WIN_RATE_TARGETS[alignment];
  if (percent < target.floor) return "under";
  if (percent > target.ceiling) return "over";
  return "in";
}

/**
 * A rate as the report and the dashboard both print one: one decimal
 * place, which is the resolution the plan's gates are written at.
 *
 * It lives beside the reader that produces rates rather than in either
 * place that shows them, because the command line report and the balance
 * page print the same cells: a rate that read 54.3% on one and 54.2% on
 * the other would be two readings of one number rather than a rounding
 * question. The two print it differently around this, which is theirs to
 * do: the report pads it into a column and writes n/a for a band nobody
 * played, and the page writes the sample it was read over beside it.
 */
export function ratePercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}
