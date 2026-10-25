// The balance dashboard's reading. It answers the three questions a person
// on balance duty has to settle in under a minute: is the Quartermaster
// seat healthy, is anything becoming a staple, and is the variance too
// swingy.
//
// Pure: rows in, a reading out, so the route that fetches the rows stays
// thin. The rows are measurement tables written once a voyage ends, and
// this module cannot write, so the dashboard is read only by construction.
//
// A gate with no source reads as unmeasured, and a measured number with no
// threshold reads as ungated. Neither is a zero: a dashboard that prints
// 0.0% for something nobody measured is misleading. A gate whose band saw
// no voyage reads as unplayed, which is neither a failure nor a rate.
//
// The window is the caller's: the route hands in the mode's records and the
// chronicle rows for exactly those voyages, so every number on the page is
// over one window rather than whichever rows a query reached.

import {
  ROLE_ORDER,
  WIN_RATE_TARGETS,
  bandVerdict,
  ratePercent,
  readSwings,
  readWinRates,
  type BandVerdict,
  type VoyageOutcome,
} from "./balance";
import { normalizeRole, roleCard, type GambitRole } from "./gambit";
// The charter rows read tables that already exist rather than minting any:
// which two charters belong to each path, which answer a raid, and the
// sample floor, shared with the card reader, a path must reach first.
import { CARD_CONVERSION_FLOOR } from "./cards";
import { CHARTER_PATH, COVER_CHARTERS } from "./constants/charters";
// The utilization denominator, from the split hold's two capacities, so a
// retune in ./constants moves this page without an edit here.
import { CARGO_SLOTS, STORES_SLOTS } from "./constants/supplies";
// Table size bands from the deck's own table, so a band the draw knows
// cannot go unmeasured here.
import { SEAT_BANDS, seatBand } from "./objectives";
// Path display names for the split row, from the deck's own table.
import { PATHS, type PathId } from "./paths";
import type { TelemetryPayloads, TelemetryRecord } from "./telemetry";
// Sentences are composed here and built at read time, so a language flip
// applies. The joiner is for the one row that prints a list.
import { getLocale, listJoiner, tFor, type Locale } from "./i18n";

// A finished voyage as this module reads one: the win rate columns plus
// bankruptcy, which only the chronicle carries, in a captain's own row
// written at the conclusion.
export type DashboardOutcome = VoyageOutcome & { bankrupt: boolean };

// The win rate reader's four band verdicts, plus two of this module's:
// unmeasured for a gate with no source, ungated for a measured number with
// no threshold. The band verdicts are shared so a cell cannot be in band
// here and out of band in the report.
export type ReadingVerdict = BandVerdict | "unmeasured" | "ungated";

// The sixteen launch gate ids. Handles rather than labels, so the launch
// verdict can count and name gates without matching prose. A gate the page
// forgets is an id that stopped appearing, and a gate renamed on one side
// fails the build rather than leaving the ship decision short by one.
export type GateId =
  | "path_pick_rate"
  | "quartermaster_fill"
  | "free_captain_pick_rate"
  | "honest_win_rate"
  | "pirate_win_rate"
  | "broker_win_rate"
  | "card_share"
  | "card_pairing"
  | "charter_split"
  | "bourse_fills"
  | "hold_utilization"
  | "distinct_goods"
  | "bankruptcy"
  | "maroon_retention"
  | "parley_participation"
  | "session_length";

// Every launch gate, in the order the verdict reads them. This is also the
// list the smoke suite covers the page against: a gate on this list with no
// reading is one the ship decision cannot see.
export const LAUNCH_GATE_IDS: readonly GateId[] = [
  "path_pick_rate",
  "quartermaster_fill",
  "free_captain_pick_rate",
  "honest_win_rate",
  "pirate_win_rate",
  "broker_win_rate",
  "card_share",
  "card_pairing",
  "charter_split",
  "bourse_fills",
  "hold_utilization",
  "distinct_goods",
  "bankruptcy",
  "maroon_retention",
  "parley_participation",
  "session_length",
];

export type DashboardReadingLine = {
  label: string;
  // Already written as shown: a rate with the sample it was read over, a
  // count, or the absence. The page prints this string rather than
  // formatting a number, so "no source" and "0.0% of 0" cannot be confused.
  value: string;
  target: string;
  verdict: ReadingVerdict;
  // The launch gate this reading answers. Absent on unjudged readings and
  // on the front page number, which is an early warning rather than one of
  // the sixteen. A gate can be carried by more than one reading: a role's
  // win rate is one gate at three table sizes, so all three cells carry the
  // role's id and the verdict reads them together.
  gate?: GateId;
};

// What a panel says at a glance; "no reading" is not a failure and is shown
// differently from one.
export type QuestionState = "clear" | "watch" | "no reading";

// The names the front page keys on. Not exported; read through
// DashboardPanel.
type DashboardPanelId = "seat" | "staples" | "variance" | "floor";

export type DashboardPanel = {
  id: DashboardPanelId;
  title: string;
  // The question this panel answers, or null for the floor panel, which
  // answers none of the three.
  question: string | null;
  state: QuestionState;
  // The one line the front page prints, computed from its own readings
  // rather than written beside them.
  answer: string;
  readings: DashboardReadingLine[];
  // What the panel cannot say, and what it waits on. A reason is a sentence
  // and a reading is a row, so they are kept apart.
  gaps: string[];
};

// The window the page reports over, including how the sample was taken.
export type DashboardWindow = {
  voyages: number;
  captains: number;
  // The rate the records were sampled at, or 1 for an empty window. Below
  // one means the counts are a sample of the voyages played rather than all
  // of them, which the page says rather than leaving a reader to assume. A
  // window spanning a config change reports the smaller rate.
  sampleRate: number;
  // Records that hit the event cap, and records that could not be read.
  // Both are measurement gaps rather than voyage facts, and a page that
  // hides them would report a window it does not have.
  truncated: number;
  unreadable: number;
};

// The rows the reading is taken over, as the route fetched them.
export type DashboardInput = {
  records: readonly TelemetryRecord[];
  outcomes: readonly DashboardOutcome[];
  unreadable: number;
};

export type DashboardReading = {
  // The Barge's share of food spending, the early warning for the seat. It
  // is read from the round reports rather than held as a slot, and carried
  // here as well as inside the seat panel because a panel three screens down
  // is not the front page. The page and the panel hold the same object,
  // built once in readDashboard, so the two cannot drift.
  frontPage: DashboardReadingLine;
  window: DashboardWindow;
  panels: DashboardPanel[];
};

// What a gate with no source reads, everywhere below. One string, so the
// page cannot show two words for one absence.
const NO_SOURCE = "not measurable";

// The Barge's two rows, built together off one pass over the records.
type BargeReadings = {
  share: DashboardReadingLine;
  without: DashboardReadingLine;
};

/**
 * The Barge's two numbers, read off the round reports. They are only worth
 * anything together: the share of food spending that went to the vendor is
 * the early warning for the seat, and the share of lobbies that sailed
 * without it asks the same question from the table's side. They move in
 * opposite directions, and a window where one is healthy and the other is
 * not says whether the Barge is a fallback or the market.
 *
 * The figures are voyage running totals, so each captain's report is taken
 * at their greatest round rather than summed over rounds. A voyage that filed no
 * pair was not playing the provisions layer and is left out rather than
 * counted as avoiding the vendor, so a switched off layer reads as never
 * played. The lobby in the second number is one voyage's table, not a
 * captain.
 */
function readBarge(
  records: readonly TelemetryRecord[],
  locale: Locale,
): BargeReadings {
  let voyages = 0;
  let without = 0;
  let food = 0;
  let barge = 0;
  for (const record of records) {
    const latest = new Map<
      string,
      { round: number; food: number; barge: number }
    >();
    for (const event of record.events) {
      if (event.name !== "round_report") continue;
      const { foodSpend, bargeSpend } = event;
      if (foodSpend === undefined || bargeSpend === undefined) continue;
      const seen = latest.get(event.actor);
      if (seen === undefined || event.round > seen.round) {
        latest.set(event.actor, {
          round: event.round,
          food: foodSpend,
          barge: bargeSpend,
        });
      }
    }
    if (latest.size === 0) continue;
    voyages++;
    let atBarge = 0;
    for (const report of latest.values()) {
      food += report.food;
      barge += report.barge;
      atBarge += report.barge;
    }
    if (atBarge === 0) without++;
  }

  const share: DashboardReadingLine = {
    label: tFor(locale, "Barge revenue share of all food spending"),
    value:
      voyages === 0
        ? tFor(locale, "no round report from a provisions harbor")
        : food === 0
          ? tFor(locale, "no food bought in the window")
          : tFor(locale, "{rate} of {food} Gold over {voyages} {voyageWord}", {
              rate: ratePercent(barge / food),
              food,
              voyages,
              // A plural form beside a count, so it travels raw and the pack
              // drops it where Mandarin does not need it.
              voyageWord: voyages === 1 ? "voyage" : "voyages",
            }),
    // No threshold applies: this is the front page's early warning, so it
    // reads measured and unjudged rather than inside or outside anything. A
    // band invented here would be a gate nobody set.
    target: tFor(locale, "no threshold in the design"),
    verdict: voyages === 0 ? "unplayed" : "ungated",
  };
  const rate = voyages === 0 ? null : Math.round((without / voyages) * 100);
  const withoutRow: DashboardReadingLine = {
    label: tFor(locale, "Lobbies that sailed without the Barge"),
    value:
      voyages === 0
        ? tFor(locale, "no round report from a provisions harbor")
        : tFor(locale, "{share} of {voyages} {lobbyWord}", {
            share: sharePercent(without, voyages),
            voyages,
            lobbyWord: voyages === 1 ? "lobby" : "lobbies",
          }),
    target: tFor(locale, "above 70%"),
    verdict: rate === null ? "unplayed" : rate < 70 ? "under" : "in",
  };
  return { share, without: withoutRow };
}

/**
 * The whole reading: every panel and the window they were read over. The
 * caller hands in the mode's own records and outcomes, so every panel reads
 * one set of voyages and none quietly reads a different one. Nothing here
 * reads a clock, a database or a socket, so the reading is a function of the
 * window it was handed.
 */
export function readDashboard(
  input: DashboardInput,
  locale: Locale = getLocale(),
): DashboardReading {
  const { records, outcomes } = input;

  // Distinct captains, not captain lines, so a fleet that stays through the
  // window is not counted once per voyage. The set is built from lines the
  // records carry, so a captain sailing twice reads once and a fleet that
  // changes between voyages reads at its true size.
  const captains = new Set(
    records.flatMap((record) =>
      record.captains.map((captain) => captain.userId),
    ),
  ).size;
  const window: DashboardWindow = {
    voyages: records.length,
    captains,
    // The smallest rate any record ran under, so a window spanning a config
    // change does not overstate what it holds.
    sampleRate:
      records.length === 0
        ? 1
        : Math.min(...records.map((record) => record.sampleRate)),
    truncated: records.filter((record) => record.truncated).length,
    unreadable: input.unreadable,
  };

  // Read once here and handed to the seat panel, since the first row is also
  // the front page number. One object reaching both places is what makes
  // them the same reading rather than two readings that agree today.
  const barge = readBarge(records, locale);

  return {
    frontPage: barge.share,
    window,
    panels: [
      seatPanel(barge, locale),
      staplesPanel(records, locale),
      variancePanel(records, outcomes, locale),
      floorPanel(records, outcomes, locale),
    ],
  };
}

// The seat, the paths competing with it, and the Barge's two numbers. The
// Barge's rows are handed in, so the first can stand as the front page
// number at the same time. The seat's three gates are slots: the record
// carries the path each captain sailed, but this page does not reduce it to
// a pick rate yet, and a slot says so rather than printing a zero. A rate
// nobody computed is not a zero.
function seatPanel(barge: BargeReadings, locale: Locale): DashboardPanel {
  const readings: DashboardReadingLine[] = [
    barge.share,
    barge.without,
    {
      label: tFor(locale, "Quartermaster fill"),
      value: tFor(locale, NO_SOURCE),
      target: tFor(locale, "above 70%"),
      verdict: "unmeasured",
      gate: "quartermaster_fill",
    },
    {
      label: tFor(locale, "Path pick rate"),
      value: tFor(locale, NO_SOURCE),
      target: tFor(locale, "12 to 28%"),
      verdict: "unmeasured",
      gate: "path_pick_rate",
    },
    {
      label: tFor(locale, "Free Captain pick rate"),
      value: tFor(locale, NO_SOURCE),
      target: tFor(locale, "15 to 22%"),
      verdict: "unmeasured",
      gate: "free_captain_pick_rate",
    },
  ];
  return {
    id: "seat",
    title: tFor(locale, "The Quartermaster seat"),
    question: tFor(locale, "Is the Quartermaster seat healthy?"),
    state: stateOf(readings),
    answer: summarize(
      readings,
      tFor(
        locale,
        "No reading yet: the seat's three readings are counts over an event the record carries and this page does not reduce. The Barge's own two numbers are read below.",
      ),
      locale,
    ),
    readings,
    gaps: [
      tFor(
        locale,
        "Three of the seat's readings are counts over an event the record already carries: the path each captain sailed is filed once per captain when the draft settles, with the seconds the table took to choose, and both the pick rate and the Quartermaster's share of the fleet are counted from it. The page does not reduce that event yet, so the three read as not measurable rather than as zeroes: a rate nobody computed is not a zero, and this is a reading to write rather than a source that is missing.",
      ),
      tFor(
        locale,
        "The Barge's two numbers are read from the round reports: each captain files the voyage's running food spending and Barge spending with the round, and the page takes the report at their greatest round rather than adding the rounds up, because the figures are the voyage's totals and counting them per round would count every purchase once per round it survived. A voyage whose captains filed no such pair was not playing the provisions layer, and it is left out of the sample rather than counted as a lobby that avoided the vendor.",
      ),
    ],
  };
}

// Whether anything is becoming the obvious pick. The card and goods gates
// have no source yet and stay slots; the charter gate is read here from the
// takes the record files, with the cover watch beside it. The goods counts
// and board volumes are the nearest readings the window has: a hold closing
// a round with two goods is a count, while the goods gate wants a share of a
// pool this page cannot see.
function staplesPanel(
  records: readonly TelemetryRecord[],
  locale: Locale,
): DashboardPanel {
  const roundReports: TelemetryPayloads["round_report"][] = [];
  const offers = { posted: 0, filled: 0, expired: 0 };
  // The charter takes, bucketed by the charter's own path rather than the
  // reported path, since the question is which of a path's two charters
  // captains reach for. A stored role that is not one of the three is left
  // out of both numerator and denominator rather than guessed into Honest:
  // guessing on a measurement is the failure the take was written to avoid.
  // The split and cover buckets come from one pass, so the two rows cannot
  // read different sets of takes. CHARTER_PATH is the one place that says
  // which two charters belong to a path.
  const splitByPath = new Map<PathId, Map<string, number>>();
  const coverByRole: Record<GambitRole, { takes: number; cover: number }> = {
    honest: { takes: 0, cover: 0 },
    broker: { takes: 0, cover: 0 },
    pirate: { takes: 0, cover: 0 },
  };
  for (const record of records) {
    for (const event of record.events) {
      if (event.name === "round_report") roundReports.push(event);
      else if (event.name === "offer_posted") offers.posted += event.goods;
      else if (event.name === "offer_filled") offers.filled += event.goods;
      else if (event.name === "offer_expired") offers.expired += event.goods;
      else if (event.name === "charter_taken") {
        const path = CHARTER_PATH[event.charter];
        if (path !== undefined) {
          const counts = splitByPath.get(path) ?? new Map<string, number>();
          counts.set(event.charter, (counts.get(event.charter) ?? 0) + 1);
          splitByPath.set(path, counts);
        }
        const named = normalizeRole(event.role);
        if (named === event.role) {
          coverByRole[named].takes += 1;
          if (COVER_CHARTERS.includes(event.charter)) {
            coverByRole[named].cover += 1;
          }
        }
      }
    }
  }

  // The split, read off those buckets. A path is judged only once it holds
  // the card floor; below it the sample is not evidence. The deviation is
  // the larger charter's share in whole points off fifty, rounded before
  // comparison so the boundary is decided the way the win rate bands decide
  // theirs (see bandVerdict). Only the widest judged path prints, so the
  // number and the verdict are about the same path.
  let splitTakes = 0;
  let widest: { path: PathId; points: number; takes: number } | null = null;
  for (const [path, counts] of splitByPath) {
    let total = 0;
    let larger = 0;
    for (const count of counts.values()) {
      total += count;
      if (count > larger) larger = count;
    }
    splitTakes += total;
    if (total < CARD_CONVERSION_FLOOR) continue;
    const points = Math.round((larger / total) * 100) - 50;
    if (widest === null || points > widest.points) {
      widest = { path, points, takes: total };
    }
  }
  const coverTakes = ROLE_ORDER.reduce(
    (total, role) => total + coverByRole[role].takes,
    0,
  );

  const goodsCounts = roundReports.map((report) => report.distinctGoods);
  const medianGoods = median(goodsCounts);
  const thinRounds = goodsCounts.filter((count) => count <= 1).length;

  const readings: DashboardReadingLine[] = [
    {
      label: tFor(locale, "The top card's share of winning builds"),
      value: tFor(locale, NO_SOURCE),
      target: tFor(locale, "no card above 35%"),
      verdict: "unmeasured",
      gate: "card_share",
    },
    {
      label: tFor(locale, "The top card pairing"),
      value: tFor(locale, NO_SOURCE),
      target: tFor(locale, "no pair above 62% over 40 appearances"),
      verdict: "unmeasured",
      gate: "card_pairing",
    },
    {
      label: tFor(locale, "Charter split deviation"),
      value:
        splitTakes === 0
          ? tFor(locale, "no charter taken in the window")
          : widest === null
            ? tFor(
                locale,
                "{splitTakes} {takeWord}, none past the {CARD_CONVERSION_FLOOR} a path is read over",
                {
                  splitTakes,
                  takeWord: splitTakes === 1 ? "take" : "takes",
                  CARD_CONVERSION_FLOOR,
                },
              )
            : tFor(
                locale,
                "{pathName}, {widest.points} points off even over {widest.takes} takes",
                {
                  pathName: tFor(locale, PATHS[widest.path].name),
                  "widest.points": widest.points,
                  "widest.takes": widest.takes,
                },
              ),
      target: tFor(locale, "no deviation above 20%"),
      // Only one direction is judged: even is the target and wide is the
      // failure, so a narrow split reads in band rather than under. The 20
      // matches the target string's own 20, and the comparison is in whole
      // points.
      verdict:
        widest === null ? "unplayed" : widest.points > 20 ? "over" : "in",
      gate: "charter_split",
    },
    {
      label: tFor(locale, "Distinct goods traded"),
      value: tFor(locale, NO_SOURCE),
      target: tFor(locale, "above 60%"),
      verdict: "unmeasured",
      gate: "distinct_goods",
    },
    {
      label: tFor(locale, "Bourse fills"),
      value: tFor(locale, NO_SOURCE),
      target: tFor(locale, "above 60%"),
      verdict: "unmeasured",
      gate: "bourse_fills",
    },
    // The cover watch beside the gate: whether the cover charters are taken
    // at the same rate by each alignment, because one only traitors take has
    // stopped being cover. Unjudged, and a rate is read only where there is
    // a take to divide by, since a rate over zero takes is the zero the page
    // refuses to print.
    {
      label: tFor(locale, "Cover charter take rate, by alignment"),
      value:
        coverTakes === 0
          ? tFor(locale, "no charter taken in the window")
          : ROLE_ORDER.filter((role) => coverByRole[role].takes > 0)
              .map((role) => {
                const { takes, cover } = coverByRole[role];
                return tFor(locale, "{roleTitle} {share} of {takes}", {
                  roleTitle: tFor(locale, roleCard(role).title),
                  share: sharePercent(cover, takes),
                  takes,
                });
              })
              .join(listJoiner(locale)),
      target: tFor(locale, "no threshold in the design"),
      verdict: coverTakes === 0 ? "unplayed" : "ungated",
    },
    // The nearest readings the window has, labeled for what they are
    // rather than dressed as the gates above them: a count is not a share,
    // and the gate wants a share.
    {
      label: tFor(
        locale,
        "Distinct goods a hold closes a round carrying, median",
      ),
      value:
        medianGoods === null
          ? tFor(locale, "no round report in the window")
          : tFor(
              locale,
              "{medianGoods} over {roundReports.length} captain rounds",
              {
                medianGoods,
                "roundReports.length": roundReports.length,
              },
            ),
      target: tFor(locale, "no gate yet"),
      verdict: medianGoods === null ? "unplayed" : "ungated",
    },
    {
      label: tFor(locale, "Captain rounds closing on one good or none"),
      value:
        roundReports.length === 0
          ? tFor(locale, "no round report in the window")
          : tFor(locale, "{share} over {roundReports.length} captain rounds", {
              share: sharePercent(thinRounds, roundReports.length),
              "roundReports.length": roundReports.length,
            }),
      target: tFor(locale, "no gate yet"),
      verdict: roundReports.length === 0 ? "unplayed" : "ungated",
    },
    {
      label: tFor(locale, "Offer units posted, filled, expired"),
      value: `${offers.posted} / ${offers.filled} / ${offers.expired}`,
      target: tFor(locale, "no gate yet"),
      verdict:
        offers.posted === 0 && offers.filled === 0 && offers.expired === 0
          ? "unplayed"
          : "ungated",
    },
  ];

  return {
    id: "staples",
    title: tFor(locale, "The staples"),
    question: tFor(locale, "Is anything becoming a staple?"),
    state: stateOf(readings),
    answer: summarize(
      readings,
      tFor(
        locale,
        "No gate yet: the card gates and the goods and Bourse gates have no source on the record, so four slots stand, and the charter gate has no path past its floor yet.",
      ),
      locale,
    ),
    readings,
    gaps: [
      tFor(
        locale,
        "The card gates and the goods and Bourse gates have no source on the record, so the four gates above stand as slots rather than readings.",
      ),
      tFor(
        locale,
        "The record keeps the count of goods a round dealt and a hold closed with, never their names, so the share of goods traded has no source until an event carries the identity rather than the count.",
      ),
      tFor(
        locale,
        "The two charter rows are the window's own takes, filed once per captain per voyage when the moment is answered at round four. The split is read inside each path, because the open question is which of a path's two charters captains reach for, and a path is only judged once it holds the floor the card reader reads its own card statistics over; the value names the widest judged path, so the deviation it prints and the verdict over it are about the same path. The cover row is a watch rather than a gate: a charter that only traitors take has stopped being cover, so the row reads how often the salvage charters were taken by each alignment, and it is left unjudged because no threshold was set on it.",
      ),
    ],
  };
}

// Whether outcomes move when they should not: the win rate bands, their
// swing, session length, lobby fill time and where unfinished voyages
// stopped. Readings without a threshold read as measured but unjudged rather
// than being given a band nobody set. A role's win rate is one gate at three
// table sizes, so all three cells carry the role's id and the verdict reads
// them together. The mapping below is one statement a reader can check
// against the gate list.
const WIN_RATE_GATE: Record<GambitRole, GateId> = {
  honest: "honest_win_rate",
  broker: "broker_win_rate",
  pirate: "pirate_win_rate",
};

function variancePanel(
  records: readonly TelemetryRecord[],
  outcomes: readonly DashboardOutcome[],
  locale: Locale,
): DashboardPanel {
  const cells = readWinRates(outcomes);
  const cellLines: DashboardReadingLine[] = cells.map((cell) => ({
    // The role's own name from the deck's table, never two names for one.
    label: tFor(locale, "{roleTitle}, {cell.band} seats", {
      roleTitle: tFor(locale, roleCard(cell.alignment).title),
      "cell.band": tFor(locale, cell.band),
    }),
    value:
      cell.rate === null
        ? tFor(locale, "no voyage played")
        : tFor(locale, "{rate} of {cell.played}", {
            rate: ratePercent(cell.rate),
            "cell.played": cell.played,
          }),
    target: tFor(locale, "{floor} to {ceiling}%", {
      floor: WIN_RATE_TARGETS[cell.alignment].floor,
      ceiling: WIN_RATE_TARGETS[cell.alignment].ceiling,
    }),
    verdict: bandVerdict(cell.alignment, cell.rate),
    gate: WIN_RATE_GATE[cell.alignment],
  }));
  const swingLines: DashboardReadingLine[] = readSwings(cells).map((swing) => ({
    label: tFor(locale, "Swing across played bands, {roleTitle}", {
      roleTitle: tFor(locale, roleCard(swing.alignment).title),
    }),
    value:
      swing.points === null
        ? swing.bands === 0
          ? tFor(locale, "no band played")
          : tFor(locale, "one played band at most")
        : tFor(locale, "{MEND_POINTS} points", {
            MEND_POINTS: swing.points.toFixed(1),
          }),
    target: tFor(locale, "no threshold in the design"),
    verdict: swing.points === null ? "unplayed" : "ungated",
  }));
  const readings: DashboardReadingLine[] = [
    ...cellLines,
    ...swingLines,
    sessionLength(records, locale),
    lobbyFill(records, locale),
    earlyEndings(records, locale),
  ];

  return {
    id: "variance",
    title: tFor(locale, "The variance"),
    question: tFor(locale, "Is the variance too swingy?"),
    state: stateOf(readings),
    answer: summarize(
      readings,
      tFor(locale, "No voyage in the window has a gate to read yet."),
      locale,
    ),
    readings,
    gaps: [
      tFor(
        locale,
        "The swing has no hard threshold: its gate is that a rate does not move as the table grows, so the points beside each role show what moving would look like rather than a band to fail.",
      ),
      tFor(
        locale,
        "Session length is measured from the moment the harbor was charted to the moment the voyage closed, the lobby-to-reveal span, and only over voyages that concluded at five seats: a wiped or emptied voyage stopped early and its clock is not a session.",
      ),
      tFor(
        locale,
        "The lobby fill time has no hard threshold and is not one of the sixteen gates: it is read to decide whether six seats are worth supporting at all. When a session runs long, the voyage length gives before the phases do, because the phases are where the conversation lives; the knob for that is the mode's own voyageRounds (twelve rounds for Ocean Gambit, the tier's ladder for Classic) rather than a round count written beside this row.",
      ),
    ],
  };
}

// Hold utilization, read off the round reports. The numerator is the captain's
// own count of occupied slots, filed as a claim like the rest of the report.
// Only a voyage playing the split hold files one, so other rounds are left out
// rather than read as empty ships.
//
// The denominator is the two capacities at full size, not the quarter a
// hungry crew takes off the cargo: the report does not carry the shortage,
// and a per captain denominator would make rounds incomparable under a fleet
// claim. The cost is stated rather than hidden: a captain on short rations
// reads against the hold they would have had. The median, because one nearly
// empty hold is a tail rather than a center.
function holdUtilization(
  records: readonly TelemetryRecord[],
  locale: Locale,
): DashboardReadingLine {
  const fills: number[] = [];
  for (const record of records) {
    for (const event of record.events) {
      if (event.name === "round_report" && event.holdSlots !== undefined) {
        fills.push(event.holdSlots / (CARGO_SLOTS + STORES_SLOTS));
      }
    }
  }
  const center = median(fills);
  if (center === null) {
    return {
      label: tFor(locale, "Median hold utilization"),
      value: tFor(locale, "no round report from a split hold"),
      target: tFor(locale, "55 to 80%"),
      verdict: "unplayed",
      gate: "hold_utilization",
    };
  }
  const percent = Math.round(center * 100);
  return {
    label: tFor(locale, "Median hold utilization"),
    value: tFor(locale, "{rate}, median of {fills.length}", {
      rate: ratePercent(center),
      "fills.length": fills.length,
    }),
    target: tFor(locale, "55 to 80%"),
    verdict: percent < 55 ? "under" : percent > 80 ? "over" : "in",
    gate: "hold_utilization",
  };
}

// The gates that are none of the three questions: worst outcomes rare and
// people staying. Three can be read and one cannot: the record's talk line
// carries the round and not the phase, so participation cannot be separated
// from the rest of the round. They stay together rather than being
// scattered into questions they do not answer.
function floorPanel(
  records: readonly TelemetryRecord[],
  outcomes: readonly DashboardOutcome[],
  locale: Locale,
): DashboardPanel {
  // Only over voyages that closed with somebody standing: an emptied harbor
  // has nobody left to be standing. The mark is the server's fact, which is
  // what lets this be a pass over one record rather than a join.
  const closing = records.filter((record) => record.outcome !== "emptied");
  const marooned = closing.flatMap((record) =>
    record.captains.filter((captain) => captain.marooned),
  );
  const stayed = marooned.filter((captain) => captain.presentAtEnd).length;

  const bankrupt = outcomes.filter((outcome) => outcome.bankrupt).length;

  const readings: DashboardReadingLine[] = [
    {
      label: tFor(locale, "Marooned captains still standing at the close"),
      value:
        marooned.length === 0
          ? tFor(locale, "no maroon in the window")
          : tFor(locale, "{share} of {marooned.length}", {
              share: sharePercent(stayed, marooned.length),
              "marooned.length": marooned.length,
            }),
      target: tFor(locale, "above 90%"),
      verdict:
        marooned.length === 0
          ? "unplayed"
          : Math.round((stayed / marooned.length) * 100) < 90
            ? "under"
            : "in",
      gate: "maroon_retention",
    },
    {
      label: tFor(locale, "Captains bankrupt at the reveal"),
      value:
        outcomes.length === 0
          ? tFor(locale, "no chronicle row in the window")
          : tFor(locale, "{share} of {outcomes.length}", {
              share: sharePercent(bankrupt, outcomes.length),
              "outcomes.length": outcomes.length,
            }),
      target: tFor(locale, "under 12%"),
      verdict:
        outcomes.length === 0
          ? "unplayed"
          : Math.round((bankrupt / outcomes.length) * 100) > 12
            ? "over"
            : "in",
      gate: "bankruptcy",
    },
    holdUtilization(records, locale),
    {
      label: tFor(locale, "Parley participation"),
      value: tFor(locale, NO_SOURCE),
      target: tFor(locale, "above 66%"),
      verdict: "unmeasured",
      gate: "parley_participation",
    },
  ];

  return {
    id: "floor",
    title: tFor(locale, "The floor"),
    question: null,
    state: stateOf(readings),
    answer: summarize(
      readings,
      tFor(
        locale,
        "No voyage in the window has a gate to read yet: utilization needs a round report from a harbor playing the split hold, and participation needs a talk line that names the phase.",
      ),
      locale,
    ),
    readings,
    gaps: [
      tFor(
        locale,
        "Hold utilization is read off the round reports, and only off those whose voyage was playing the split hold: a round filed by a harbor with the split switched off carries no slots and is not in the sample. Its denominator is the ship's two capacities at their full size, because the quarter a hungry crew costs the cargo is not something the report carries, so a captain on short rations reads against the hold they would have had.",
      ),
      tFor(
        locale,
        "Parley participation cannot be read off the record's talk line either, because that line carries the round and not the phase, and talk is open through every phase of a round: the record cannot separate Parley from the rest of the round.",
      ),
      tFor(
        locale,
        "Retention is read over the voyages that closed with somebody standing, at the resolution the record has, which is presence at the close rather than the length of one connection.",
      ),
    ],
  };
}

// Session length at five captains, from charted to revealed. The clock is
// the record's own, and only concluded voyages have an end a session can be
// measured to; a wiped or emptied voyage stopped early and its clock is not
// a session. The median, because one harbor left open for an hour is a tail
// rather than a center.
function sessionLength(
  records: readonly TelemetryRecord[],
  locale: Locale,
): DashboardReadingLine {
  const minutes = records
    .filter((record) => record.outcome === "concluded" && record.seats === 5)
    .map((record) => (record.endedAt - record.openedAt) / 60000)
    .filter((value) => Number.isFinite(value) && value > 0);
  const center = median(minutes);
  if (center === null) {
    return {
      label: tFor(locale, "Session length at five captains, charted to reveal"),
      value: tFor(locale, "no concluded voyage at five"),
      target: tFor(locale, "62 to 74 min"),
      verdict: "unplayed",
      gate: "session_length",
    };
  }
  const whole = Math.round(center);
  return {
    label: tFor(locale, "Session length at five captains, charted to reveal"),
    value: tFor(locale, "{whole} min, median of {minutes.length}", {
      whole,
      "minutes.length": minutes.length,
    }),
    target: tFor(locale, "62 to 74 min"),
    verdict: whole < 62 ? "under" : whole > 74 ? "over" : "in",
    gate: "session_length",
  };
}

// How long a harbor waited to fill, one band at a time. A table that
// gathered and then wiped still gathered, so no ending is filtered out.
//
// It is not one of the sixteen gates, so it reads measured and unjudged.
// What it is for is whether six seats are worth supporting at all, which is
// a comparison between bands rather than a line one of them crosses. Every
// band prints so "nobody sailed at six" stays visible. The clock runs from
// charted to set sail; a voyage that never started is dropped rather than
// seated at zero minutes.
function lobbyFill(
  records: readonly TelemetryRecord[],
  locale: Locale,
): DashboardReadingLine {
  const bands = SEAT_BANDS.map((band) => {
    const minutes = records
      .filter((record) => seatBand(record.seats).min === band.min)
      .map((record) => (record.startedAt - record.openedAt) / 60000)
      .filter((value) => Number.isFinite(value) && value > 0);
    return {
      label: band.label,
      center: median(minutes),
      count: minutes.length,
    };
  });
  const sailed = bands.filter((band) => band.center !== null);
  if (sailed.length === 0) {
    return {
      label: tFor(locale, "Lobby fill time by table size, charted to set sail"),
      value: tFor(locale, "no voyage in the window"),
      target: tFor(locale, "no threshold in the design"),
      verdict: "unplayed",
    };
  }
  return {
    label: tFor(locale, "Lobby fill time by table size, charted to set sail"),
    value: bands
      .map((band) =>
        band.center === null
          ? tFor(locale, "{band.label} seats none in the window", {
              // The band table in ./objectives holds the English; the read
              // sits here, where the label becomes part of the row.
              "band.label": tFor(locale, band.label),
            })
          : tFor(
              locale,
              "{band.label} seats {medianMinutes} min of {band.count}",
              {
                "band.label": tFor(locale, band.label),
                medianMinutes: Math.round(band.center),
                "band.count": band.count,
              },
            ),
      )
      .join("; "),
    target: tFor(locale, "no threshold in the design"),
    verdict: "ungated",
  };
}

// Where voyages that did not reach the reveal stopped. The abandon rate by
// round is a business number with no threshold, so the row shows a mode losing
// tables at round three without pretending to know how many is too many. The
// median round is the one a reader can act on.
function earlyEndings(
  records: readonly TelemetryRecord[],
  locale: Locale,
): DashboardReadingLine {
  const stopped = records.filter((record) => record.outcome !== "concluded");
  const center = median(stopped.map((record) => record.endedAtRound));
  return {
    label: tFor(locale, "Voyages that stopped before the reveal"),
    value:
      records.length === 0
        ? tFor(locale, "no voyage in the window")
        : center === null
          ? tFor(locale, "none")
          : tFor(
              locale,
              "{stopped.length} of {records.length}, stopping at round {medianRound} on the median",
              {
                "stopped.length": stopped.length,
                "records.length": records.length,
                medianRound: Math.round(center),
              },
            ),
    target: tFor(locale, "no gate yet"),
    verdict: records.length === 0 ? "unplayed" : "ungated",
  };
}

// Unmeasured and ungated are not gates, so a panel's state counts only the
// rest, and a panel whose remaining gates all read unplayed has nothing to
// report.
function isGated(reading: DashboardReadingLine): boolean {
  return reading.verdict !== "unmeasured" && reading.verdict !== "ungated";
}

// A panel with no readable gate is "no reading", not "clear": the two
// answers a dashboard must not confuse, and the third state has its own
// color.
function stateOf(readings: readonly DashboardReadingLine[]): QuestionState {
  const readable = readings.filter(
    (reading) => isGated(reading) && reading.verdict !== "unplayed",
  );
  if (readable.length === 0) return "no reading";
  const outside = readable.some(
    (reading) => reading.verdict === "under" || reading.verdict === "over",
  );
  return outside ? "watch" : "clear";
}

// The one line a panel answers with: how many gates it could read are
// outside them, or that every readable one is inside, or the sentence the
// panel was handed for when nothing is. It counts against the gates the
// panel holds rather than the readings it printed, so four slots with two
// readable gates says "2 of 4".
function summarize(
  readings: readonly DashboardReadingLine[],
  whenNothing: string,
  locale: Locale,
): string {
  const gated = readings.filter(isGated);
  const readable = gated.filter((reading) => reading.verdict !== "unplayed");
  if (readable.length === 0) return whenNothing;
  const outside = readable.filter(
    (reading) => reading.verdict === "under" || reading.verdict === "over",
  );
  if (outside.length === 0) {
    return tFor(
      locale,
      "Every gate this window can read sits inside it, {readable.length} of {gated.length}.",
      { "readable.length": readable.length, "gated.length": gated.length },
    );
  }
  return tFor(
    locale,
    "{outside.length} of {gated.length} gates sit outside theirs: {list}.",
    {
      "outside.length": outside.length,
      "gated.length": gated.length,
      list: outside
        .map((reading) => `${reading.label}, ${reading.value}`)
        .join("; "),
    },
  );
}

// A share written through the rate formatter, so a share and a rate print
// the same way; the labels say which is which.
function sharePercent(part: number, whole: number): string {
  return ratePercent(part / whole);
}

// The middle of a list, or null for an empty one. An even count takes the
// mean of the two middles, which for a list of minutes stays a number a
// reader can hold once it is rounded, and for goods counts is the only
// defensible center.
function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}
