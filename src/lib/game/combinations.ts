// =====================================================================
// [F7: the combination instrument] Win rate by combination, read off the
// chronicle's own record of what each finished voyage was holding.
//
// The plan's second half, verbatim: "with forty boons, twenty modules and
// ten charters the pair matrix is far past what anyone can hand test.
// Instrument win rate by combination, automatically flag any pair
// appearing in more than a threshold share of wins", with the balance
// target "that any two card combination stays under sixty two percent
// win rate once it has at least forty recorded appearances". The rule
// that keeps this instrument honest is the plan's too: broken pairs are
// found empirically and never by reasoning, so nothing here knows what
// any card does. It counts pairs and wins and says which counts are
// loud.
//
// The population is the held sets the conclusion writes (see heldCards
// on VoyageChronicle and readHeldCards in the finishers), parsed through
// parseHeldCards below and resolved through the pool here, so a card
// retired from the catalogue falls out of the matrix with the pool, the
// same reading a save's own heal gives it.
//
// Everything here is a pure reduction over rows handed in. Nothing reads
// a database and no clock is read; the report script is the only caller
// that owns a query (see scripts/pairs.ts), which is what lets the suite
// hand this reader fixture rows and hold the arithmetic without one.
// =====================================================================
import { cardById, cardName } from "./cards";

// ========== The thresholds ==========

// How many appearances a pair needs before its rate is a rate. The plan's
// words are the number ("once it has at least forty recorded
// appearances"), and it is the same forty the conversion floor already
// reads cards at (see CARD_CONVERSION_FLOOR in ./cards, whose own
// comment records the alignment): one number for what counts as
// evidence, whichever instrument is doing the counting.
export const PAIR_APPEARANCE_FLOOR = 40;

// The balance target: the plan's words are that a pair "stays under sixty
// two percent win rate", so a measurable pair at or above this share of
// its appearances has not stayed under and is a broken pair. The line is
// read inclusively for exactly that reason: thirty one wins out of fifty
// is the arithmetic a fifty appearance table actually writes, and it is
// the target that is missed, not the sample.
export const PAIR_WIN_CEILING = 0.62;

// The share of all wins a pair may appear in before the flag fires, the
// plan's "more than a threshold share of wins". Authored here with its
// reasoning because the plan leaves the number to the build: with
// roughly seventy cards in the pools, a pair appears in about one
// percent of wins under uniform play (a held set carries a handful of
// cards and each one pairs with every other), so a pair riding fifteen
// percent of wins is a pair present in one win in seven, an order of
// magnitude past chance. Raising it is a constant and nothing else, the
// same rollback the budget cap carries.
export const PAIR_WIN_SHARE = 0.15;

// The longest held set a column may carry, enforced at both ends: the
// finishers bound what they write with it (see the import in
// conclusion/finishers) and parseHeldCards bounds what it reads with it,
// so a hand written column cannot be longer than the record it imitates.
// The voyage itself bounds honest play far below this (a hull carries at
// most five modules, one charter, and a voyage's moments a handful of
// boons); this is headroom, not a limit.
export const MAX_HELD_CARDS = 32;

// ========== The column ==========

/**
 * The held set a chronicle row carries, read back defensively.
 *
 * The column is JSON text written by the finishers, and this is the one
 * parse the report and any suite share so two readings of one column
 * cannot disagree. Anything that is not an array of strings reads as
 * empty, the reading the finishers give a save they could not trust, and
 * the list is deduped and bounded by the same constant the writer
 * bounded it with, because a row can also be written by hand.
 *
 * The ids are not resolved through the pool here. They are at counting
 * time instead (see readPairs), because the pool a row is read against
 * is the pool of the build doing the reading, which is the whole point:
 * a card retired after the row was written falls out of the matrix then,
 * not at some earlier parse.
 */
export function parseHeldCards(raw: unknown): string[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const ids: string[] = [];
  for (const id of parsed) {
    if (typeof id !== "string" || id.length === 0 || ids.includes(id)) {
      continue;
    }
    ids.push(id);
    if (ids.length >= MAX_HELD_CARDS) break;
  }
  return ids;
}

// ========== The reading ==========

/** One row of the matrix: a pair, its record, and what it tripped. */
export type PairRow = {
  /** The two card ids, in sorted order so the pair has one spelling. */
  a: string;
  b: string;
  aName: string;
  bName: string;
  /** Voyages whose held set carried both cards. */
  appearances: number;
  /** Of those, the ones the captain won. */
  wins: number;
  /** wins over appearances, or null below the floor. */
  rate: number | null;
  /** wins over the winning voyages, the plan's share of wins. */
  share: number;
  /** What this row tripped, empty for a pair neither flag fires on. */
  flags: PairFlag[];
};

/**
 * The two ways a pair can be loud. `win_rate` is the plan's balance
 * target tripped (a measurable pair at or above the ceiling); `share_of_wins`
 * is the plan's automatic flag (a measurable pair in more than the
 * threshold share of wins, and that line stays strict because the plan's
 * own word for it is "more than"). A pair can trip both, which is why the
 * row carries a list rather than a verdict.
 */
type PairFlag = "win_rate" | "share_of_wins";

type PairReading = {
  /** Rows the reading could speak about: those that carried any cards. */
  voyages: number;
  /** Of those, the ones won, which is the share's denominator. */
  wins: number;
  /** Every pair seen at least once, flagged ones first. */
  pairs: PairRow[];
  /** The rows whose flags are not empty, in the same order. */
  flagged: PairRow[];
};

/**
 * Win rate by pair, over the held sets of finished voyages.
 *
 * Every row contributes the unordered pairs of its distinct held cards,
 * resolved through the pool (a retired id is not a card and drops out,
 * taking its pairs with it) and deduped, because a pair is a set of two
 * cards and two copies of one module are one card in that set. A row
 * holding nothing contributes to neither the pairs nor the denominator:
 * a winning voyage with no held cards is a fact about nothing this
 * instrument reads, and letting it dilute every share would be counting
 * silence as evidence.
 *
 * The two flags share the appearance floor on purpose. The plan attaches
 * it to the win rate reading in words, but its own reason is general
 * ("a card with a high win rate over nine appearances is noise"), and a
 * pair present in one fifth of three wins is the same noise wearing the
 * other flag. Ordering puts the flagged rows first, then the measurable
 * by rate, then the rest by how often they have been seen, which is the
 * conversion report's order (see readCardConversion in ./cards) and the
 * same sentence: the pairs worth acting on come first.
 */
export function readPairs(
  rows: readonly { ids: readonly string[]; won: boolean }[],
): PairReading {
  const counts = new Map<
    string,
    { a: string; b: string; appearances: number; wins: number }
  >();
  let voyages = 0;
  let wins = 0;
  for (const row of rows) {
    const known = [
      ...new Set(row.ids.filter((id) => cardById(id) !== null)),
    ].sort();
    if (known.length === 0) continue;
    voyages += 1;
    if (row.won) wins += 1;
    for (let i = 0; i < known.length; i++) {
      for (let j = i + 1; j < known.length; j++) {
        const key = `${known[i]}|${known[j]}`;
        const entry = counts.get(key) ?? {
          a: known[i],
          b: known[j],
          appearances: 0,
          wins: 0,
        };
        entry.appearances += 1;
        if (row.won) entry.wins += 1;
        counts.set(key, entry);
      }
    }
  }
  const pairs: PairRow[] = [...counts.values()].map((entry) => {
    const rate =
      entry.appearances >= PAIR_APPEARANCE_FLOOR
        ? entry.wins / entry.appearances
        : null;
    const share = wins === 0 ? 0 : entry.wins / wins;
    const flags: PairFlag[] = [];
    if (rate !== null && rate >= PAIR_WIN_CEILING) flags.push("win_rate");
    if (rate !== null && share > PAIR_WIN_SHARE) flags.push("share_of_wins");
    return {
      a: entry.a,
      b: entry.b,
      aName: cardName(entry.a),
      bName: cardName(entry.b),
      appearances: entry.appearances,
      wins: entry.wins,
      rate,
      share,
      flags,
    };
  });
  pairs.sort((one, other) => {
    const flagged = (row: PairRow) => (row.flags.length > 0 ? 0 : 1);
    if (flagged(one) !== flagged(other)) return flagged(one) - flagged(other);
    if (one.rate === null && other.rate === null) {
      return other.appearances - one.appearances;
    }
    if (one.rate === null) return 1;
    if (other.rate === null) return -1;
    if (other.rate !== one.rate) return other.rate - one.rate;
    return other.appearances - one.appearances;
  });
  return {
    voyages,
    wins,
    pairs,
    flagged: pairs.filter((row) => row.flags.length > 0),
  };
}
