// =====================================================================
// PortMasters 2.2 Parallel Release: the balance dashboard's reading.
//
// [I3: the dashboard, and the front page number] The plan asks for one
// page that answers whether the mode is healthy, and its evaluation names
// the three questions somebody on balance duty has to be able to answer
// in under a minute: is the Quartermaster seat healthy, is anything
// becoming a staple, and is the variance too swingy. This module is the
// arithmetic behind that page, and it is pure for the same reason
// ./balance.ts is: rows in, a reading of every question out, and the
// route that fetches the rows (src/app/api/admin/balance) stays thin.
// Nothing here reads a clock, a database or a socket, so the whole
// reading is a function of the window it was handed and can be exercised
// without a server.
//
// Two properties shape every number below.
//
// The first is where the rows come from. They are measurement tables: the
// spine's records (VoyageTelemetry) and the chronicle rows written beside
// them, both written once, when a voyage is over. Nothing here reads a
// room, a seat, a save or a live socket, so the page cannot contend with
// a voyage that is under way. That is the plan's rollback made structural
// rather than promised: this module has no way to write anything, so the
// dashboard can only ever be read only.
//
// The second is what the page owes a reader when a gate has no source.
// Sixteen numbers are launch gates (goal I4) and most of them read what the
// record does not carry yet: the card gates are F and the market gates are
// G. Every one of those appears below as a reading with no
// source and the epic it waits on beside it, never as a zero, because a
// dashboard that prints 0.0% for something nobody has measured is the
// instrument the plan warns about. What the record can already answer, it
// answers: the win rate bands and the swing across them, session length,
// the lobby fill time by table size, where voyages stopped, hold
// utilization, maroon retention, bankruptcy, the charter split and its
// cover row [F6], and the Barge's own two numbers, which is where this
// module's reading of Epic E lands.
//
// A reading is judged by one of five verdicts. A gate a window could
// compare reads `in`, `under` or `over`; a gate whose band saw no voyage
// reads `unplayed`, which is not a failure and not a rate, because three
// voyages are not evidence and no voyages are not zero; a gate with no
// source at all reads `unmeasured`; and a reading the plan left without a
// threshold (the swing, the goods counts, the board's volumes) reads
// `ungated`, which says measured but not judged rather than inventing a
// band the plan never set.
//
// The window itself is the caller's: the route hands this module the
// mode's own records and the chronicle rows for exactly those voyages, so
// every number on the page is over one window rather than each being
// read over whichever rows a query happened to reach.
// =====================================================================

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
// [F6: charters at leg four] The two charter rows read three tables that
// already exist rather than minting any of their own: which two charters
// belong to each path (CHARTER_PATH), which charters answer a raid
// (COVER_CHARTERS), and the floor a path's takes must reach before its
// split is judged. The floor is the card reader's own (see ./cards) rather
// than a number written again here, because the plan sets one sample floor
// for a card statistic and a second would have this page judging a sample
// the page next door still calls thin.
import { CARD_CONVERSION_FLOOR } from "./cards";
import { CHARTER_PATH, COVER_CHARTERS } from "./constants/charters";
// [C4: three foods, spoilage and the split hold] The utilization row's
// denominator, read from the two capacities the split hold declares rather
// than repeated as a number here: a hold whose size was retuned in
// ./constants must move the percentage on this page without anybody
// editing a dashboard.
import { CARGO_SLOTS, STORES_SLOTS } from "./constants/supplies";
// The table size bands, read from the deck's own table rather than
// repeated here: the fill time below is read one band at a time, and a
// band the draw knows and the dashboard does not would be a table size
// nobody measured.
import { SEAT_BANDS, seatBand } from "./objectives";
// The path display names for the split row's value, read from the deck's
// own table rather than written here: a value that named a path the
// catalogue does not would be the page inventing a place the voyage was
// not sailed from.
import { PATHS, type PathId } from "./paths";
import type { TelemetryPayloads, TelemetryRecord } from "./telemetry";

// A finished voyage as this module reads one: the three columns the win
// rates are read from, plus the one fact bankruptcy needs that the spine's
// records do not carry. The chronicle is where a bankruptcy is written
// (a captain's own row, at the conclusion), so it is read from there
// rather than inferred from a save this module would have to see.
export type DashboardOutcome = VoyageOutcome & { bankrupt: boolean };

// How a reading is judged. The four band verdicts are the win rate
// reader's own, so a cell cannot be in band on the page and out of band
// in the report: both ask bandVerdict. The two extra values are this
// module's, for the gates there is nothing to read (unmeasured) and for
// the measured numbers the plan set no threshold on (ungated).
export type ReadingVerdict = BandVerdict | "unmeasured" | "ungated";

// The plan's own names for the sixteen numbers goal I4 makes launch gates,
// in the order that goal lists them.
//
// A reading carries one of these where it answers a gate, which is what
// lets the launch verdict (./gates.ts) count and name gates without
// matching prose: a gate the page forgets is an id that stopped appearing,
// and a gate renamed in one place fails the build rather than quietly
// leaving the ship decision short by one. Ids rather than labels because a
// label is written to be read by a captain on balance duty and is allowed
// to change its wording, while this is the plan's own handle on the number.
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

// Every gate the plan sets, in the plan's order, which is the order the
// launch verdict reads them in and the list the smoke suite covers the page
// against: a gate that is on this list and on no reading is a gate the ship
// decision cannot see.
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
  // The reading, already written the way it is shown: a rate with the
  // sample it was read over, a count, or the absence. The page prints
  // this string rather than formatting a number, so "no source" and "0.0%
  // of 0" cannot be told apart by a reader who was handed the wrong one.
  value: string;
  target: string;
  verdict: ReadingVerdict;
  // The plan gate this reading answers, where it answers one. Absent on
  // the readings the plan left unjudged (the swings, the goods counts, the
  // board's volumes) and on the front page number, which the proposal
  // names as the mode's early warning rather than as one of the sixteen.
  //
  // A gate can be carried by more than one reading, and the win rate bands
  // are the case that matters: a role's rate is one gate read at three
  // table sizes, so all three cells carry that role's id and the launch
  // verdict reads them together rather than treating a band as a gate.
  gate?: GateId;
};

// What a panel says about itself at a glance, in the plan's own terms: it
// is reading inside the gates, something is out, or there is nothing to
// read yet. The third is not a failure and is shown differently from one.
export type QuestionState = "clear" | "watch" | "no reading";

// The panels are named, and the name is what the front page keys on. Not
// exported: a panel is read through DashboardPanel, and the name is only
// ever compared against the one beside it in the reading.
type DashboardPanelId = "seat" | "staples" | "variance" | "floor";

export type DashboardPanel = {
  id: DashboardPanelId;
  title: string;
  // The plan's question, for the three panels that answer one. The floor
  // panel answers none of them, which is why it is null rather than a
  // fourth question the plan never asked.
  question: string | null;
  state: QuestionState;
  // The one line the front page prints: what the panel can say today,
  // computed from its own readings rather than written beside them.
  answer: string;
  readings: DashboardReadingLine[];
  // What the panel cannot say, and what it waits on. Kept separate from
  // the readings because a reason is a sentence and a reading is a row,
  // and a reader on balance duty needs both.
  gaps: string[];
};

export type DashboardWindow = {
  voyages: number;
  captains: number;
  // The rate the window's records were sampled at, or 1 for an empty
  // window. Anything below one means the counts on the page are a sample
  // of the voyages that were played rather than all of them, which the
  // page says rather than leaving a reader to assume.
  sampleRate: number;
  // Records that hit the event cap, and records whose stored text could
  // not be read at all. Both are measurement gaps rather than voyage
  // facts, and a page that hides them would report a window it does not
  // have.
  truncated: number;
  unreadable: number;
};

export type DashboardInput = {
  records: readonly TelemetryRecord[];
  outcomes: readonly DashboardOutcome[];
  unreadable: number;
};

export type DashboardReading = {
  // The plan's front page number: the Barge revenue share of all food
  // spending, which is the early warning for the Quartermaster seat going
  // wrong. It is read from the leg reports now rather than held as a slot,
  // and it is carried here as well as inside the seat panel rather than
  // only there, because the plan says front page and a panel three screens
  // down is not the front page. The page and the panel hold the same
  // object, built once in readDashboard, so the two cannot drift apart.
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
 * The two numbers the plan judges the Barge by, read off the leg reports.
 *
 * The plan's evaluation names them as a pair that is only worth anything
 * read together: the share of all food spending that went over the vendor's
 * counter, which is the early warning for the seat going wrong, and the
 * share of lobbies that sailed without it, which is the same question asked
 * from the table's side. They move in opposite directions, and a window
 * where one is healthy and the other is not is the reading that says
 * whether the Barge is a fallback or the market.
 *
 * Both come off two figures a captain files with the leg: what the voyage
 * has spent on food and what of that went to the Barge. The figures are the
 * voyage's running totals rather than the leg's, so the reader takes each
 * captain's report at their greatest leg instead of adding the legs up,
 * which would count every purchase once per leg it survived. A voyage whose
 * captains filed no such pair was not playing the provisions layer, and it
 * is left out of the sample rather than counted as a lobby that avoided the
 * vendor: the honest reading of a switched off layer is that it was never
 * played, which is the line every other switched reading on this page
 * draws.
 *
 * The lobby in the second number is one voyage's table, because the plan's
 * question is about tables and not about captains: a lobby sailed without
 * the Barge when nobody at it bought from the vendor, however many of the
 * captains aboard looked at the price.
 */
function readBarge(records: readonly TelemetryRecord[]): BargeReadings {
  let voyages = 0;
  let without = 0;
  let food = 0;
  let barge = 0;
  for (const record of records) {
    const latest = new Map<
      string,
      { leg: number; food: number; barge: number }
    >();
    for (const event of record.events) {
      if (event.name !== "leg_report") continue;
      const { foodSpend, bargeSpend } = event;
      if (foodSpend === undefined || bargeSpend === undefined) continue;
      const seen = latest.get(event.actor);
      if (seen === undefined || event.leg > seen.leg) {
        latest.set(event.actor, {
          leg: event.leg,
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
    label: "Barge revenue share of all food spending",
    value:
      voyages === 0
        ? "no leg report from a provisions harbor"
        : food === 0
          ? "no food bought in the window"
          : `${ratePercent(barge / food)} of ${food} Gold over ${voyages} ${voyages === 1 ? "voyage" : "voyages"}`,
    // The plan sets no band on this number. It is the page's front page
    // figure and its early warning, and a threshold invented for it here
    // would be a gate the plan never made, which is why it reads measured
    // and unjudged rather than inside or outside anything.
    target: "no threshold in the plan",
    verdict: voyages === 0 ? "unplayed" : "ungated",
  };
  const rate = voyages === 0 ? null : Math.round((without / voyages) * 100);
  const withoutRow: DashboardReadingLine = {
    label: "Lobbies that sailed without the Barge",
    value:
      voyages === 0
        ? "no leg report from a provisions harbor"
        : `${sharePercent(without, voyages)} of ${voyages} ${voyages === 1 ? "lobby" : "lobbies"}`,
    target: "above 70%",
    verdict: rate === null ? "unplayed" : rate < 70 ? "under" : "in",
  };
  return { share, without: withoutRow };
}

/**
 * The whole reading: every panel, and the window they were read over.
 *
 * The caller hands in the mode's own records and the chronicle rows for
 * exactly those voyages, so there is one window on the page and no panel
 * quietly reading a different set of voyages than its neighbour. What the
 * module does with them is arithmetic and prose.
 */
export function readDashboard(input: DashboardInput): DashboardReading {
  const { records, outcomes } = input;

  // Distinct captains, not captain lines: the same fleet sitting through
  // the whole window would otherwise be counted once per voyage, and a
  // page saying eighteen hundred captains over a three hundred voyage
  // window is counting seats rather than people. The set is built from
  // the lines the records already carry, so a fleet that changes between
  // voyages reads at its true size while one captain sailing twice reads
  // once.
  const captains = new Set(
    records.flatMap((record) =>
      record.captains.map((captain) => captain.userId),
    ),
  ).size;
  const window: DashboardWindow = {
    voyages: records.length,
    captains,
    // The smallest rate any record ran under: a window that spans a
    // config change is a sample of the smaller of the two rates, and
    // reporting the larger would overstate what the page holds.
    sampleRate:
      records.length === 0
        ? 1
        : Math.min(...records.map((record) => record.sampleRate)),
    truncated: records.filter((record) => record.truncated).length,
    unreadable: input.unreadable,
  };

  // The Barge's two rows are read once, here, and handed to the seat panel
  // rather than read inside it: the first of them is also the page's front
  // page number, and one object reaching both places is what makes the two
  // the same reading rather than two readings that agree today.
  const barge = readBarge(records);

  return {
    frontPage: barge.share,
    window,
    panels: [
      seatPanel(barge),
      staplesPanel(records),
      variancePanel(records, outcomes),
      floorPanel(records, outcomes),
    ],
  };
}

/* === The four panels === */

// The seat, the paths that compete with it, and the two numbers the Barge
// is judged by: the share of all food spending that went over its counter,
// and the share of lobbies that sailed without it.
//
// The Barge's two rows are read from the record and handed in, so the first
// of them can stand as the front page number at the same time. The seat's
// three gates are slots still, and the reason is the reading rather than the
// source: the record carries the path each captain sailed, filed once per
// captain when the draft settles, and this page does not reduce that event
// into a pick rate or a share of the fleet yet. A slot says so rather than
// printing a zero, which is the rule the whole page is built on.
function seatPanel(barge: BargeReadings): DashboardPanel {
  const readings: DashboardReadingLine[] = [
    barge.share,
    barge.without,
    {
      label: "Quartermaster fill",
      value: NO_SOURCE,
      target: "above 70%",
      verdict: "unmeasured",
      gate: "quartermaster_fill",
    },
    {
      label: "Path pick rate",
      value: NO_SOURCE,
      target: "12 to 28%",
      verdict: "unmeasured",
      gate: "path_pick_rate",
    },
    {
      label: "Free Captain pick rate",
      value: NO_SOURCE,
      target: "15 to 22%",
      verdict: "unmeasured",
      gate: "free_captain_pick_rate",
    },
  ];
  return {
    id: "seat",
    title: "The Quartermaster seat",
    question: "Is the Quartermaster seat healthy?",
    state: stateOf(readings),
    answer: summarize(
      readings,
      "No reading yet: the seat's three readings are counts over an event the record carries and this page does not reduce. The Barge's own two numbers are read below.",
    ),
    readings,
    gaps: [
      "Three of the seat's readings are counts over an event the record already carries: the path each captain sailed is filed once per captain when the draft settles, with the seconds the table took to choose, and both the pick rate and the Quartermaster's share of the fleet are counted from it. The page does not reduce that event yet, so the three read as not measurable rather than as zeroes: a rate nobody computed is not a zero, and this is a reading to write rather than a source that is missing.",
      "The Barge's two numbers are read from the leg reports: each captain files the voyage's running food spending and Barge spending with the leg, and the page takes the report at their greatest leg rather than adding the legs up, because the figures are the voyage's totals and counting them per leg would count every purchase once per leg it survived. A voyage whose captains filed no such pair was not playing the provisions layer, and it is left out of the sample rather than counted as a lobby that avoided the vendor.",
    ],
  };
}

// Whether anything is becoming the obvious pick. The plan gates this on
// cards, charters and goods: the card and goods gates belong to epics this
// tree has not read yet, so those rows are slots, and the charter gate is
// read here [F6] off the takes the record files, with the plan's cover
// watch beside it. What else the window can read is the nearest thing the
// spine holds: how many distinct goods a hold closes a leg carrying, which
// is a staple signal at the count level, and the board's own volumes, which
// say whether there is a board to staple on.
function staplesPanel(records: readonly TelemetryRecord[]): DashboardPanel {
  const legReports: TelemetryPayloads["leg_report"][] = [];
  const offers = { posted: 0, filled: 0, expired: 0 };
  // The charter takes, bucketed once for the two charter rows below. The
  // split is bucketed by the charter's own path rather than by the path
  // the report claimed, because the question is which of a path's two
  // charters captains reach for, and CHARTER_PATH is the one place that
  // says which two those are. The cover row is bucketed by the alignment
  // the server attached to the take; a stored role that is not one of the
  // three is left out of both the numerator and the denominator rather
  // than folded into Honest, because guessing a role on a measurement is
  // the failure the take itself was written to avoid (normalizeRole's
  // fallback reads a card, where the safe direction is the fleet; a row
  // is not a card).
  const splitByPath = new Map<PathId, Map<string, number>>();
  const coverByRole: Record<GambitRole, { takes: number; cover: number }> = {
    honest: { takes: 0, cover: 0 },
    broker: { takes: 0, cover: 0 },
    pirate: { takes: 0, cover: 0 },
  };
  for (const record of records) {
    for (const event of record.events) {
      if (event.name === "leg_report") legReports.push(event);
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

  // The split, read off those buckets. A path is judged once it holds the
  // floor the card reader reads its own statistics over; below it the
  // sample is not evidence and the split is not read. The deviation is the
  // larger charter's share of the path's takes in whole points off an even
  // fifty, rounded before it is compared so the boundary is decided the
  // way the win rate bands decide theirs (see bandVerdict). Only the
  // widest judged path is printed, so the number and the verdict are
  // always about the same path.
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

  const goodsCounts = legReports.map((report) => report.distinctGoods);
  const medianGoods = median(goodsCounts);
  const thinLegs = goodsCounts.filter((count) => count <= 1).length;

  const readings: DashboardReadingLine[] = [
    {
      label: "The top card's share of winning builds",
      value: NO_SOURCE,
      target: "no card above 35%",
      verdict: "unmeasured",
      gate: "card_share",
    },
    {
      label: "The top card pairing",
      value: NO_SOURCE,
      target: "no pair above 62% over 40 appearances",
      verdict: "unmeasured",
      gate: "card_pairing",
    },
    {
      label: "Charter split deviation",
      value:
        splitTakes === 0
          ? "no charter taken in the window"
          : widest === null
            ? `${splitTakes} ${splitTakes === 1 ? "take" : "takes"}, none past the ${CARD_CONVERSION_FLOOR} a path is read over`
            : `${PATHS[widest.path].name}, ${widest.points} points off even over ${widest.takes} takes`,
      target: "no deviation above 20%",
      // The plan judges one direction: an even split is the target and a
      // wide one is the failure, so a narrow split reads in band rather
      // than under it. The 20 stands beside the target string's own 20 the
      // way the Barge's 70 stands beside its target, and the comparison is
      // made in whole points so the boundary is decided the way the win
      // rate bands decide theirs.
      verdict:
        widest === null ? "unplayed" : widest.points > 20 ? "over" : "in",
      gate: "charter_split",
    },
    {
      label: "Distinct goods traded",
      value: NO_SOURCE,
      target: "above 60%",
      verdict: "unmeasured",
      gate: "distinct_goods",
    },
    {
      label: "Bourse fills",
      value: NO_SOURCE,
      target: "above 60%",
      verdict: "unmeasured",
      gate: "bourse_fills",
    },
    // The plan's watch beside the gate: whether the cover charters are
    // taken at the same rate by honest players as by traitors, because a
    // charter that only traitors take has stopped being cover. It is a
    // reading rather than a gate, because the plan sets no threshold on
    // it: the rate is printed for each alignment the window can name and
    // the row is left unjudged. A rate is read only where the alignment
    // has a take to divide by, since a rate over zero takes is the zero
    // the whole page refuses to print.
    {
      label: "Cover charter take rate, by alignment",
      value:
        coverTakes === 0
          ? "no charter taken in the window"
          : ROLE_ORDER.filter((role) => coverByRole[role].takes > 0)
              .map((role) => {
                const { takes, cover } = coverByRole[role];
                return `${roleCard(role).title} ${sharePercent(cover, takes)} of ${takes}`;
              })
              .join(", "),
      target: "no threshold in the plan",
      verdict: coverTakes === 0 ? "unplayed" : "ungated",
    },
    // The nearest readings the window has. They are labelled for what
    // they are rather than dressed as the gates above them: a hold
    // closing a leg carrying two goods is a count, and the gate wants a
    // share of a pool it cannot see.
    {
      label: "Distinct goods a hold closes a leg carrying, median",
      value:
        medianGoods === null
          ? "no leg report in the window"
          : `${medianGoods} over ${legReports.length} captain legs`,
      target: "no gate yet",
      verdict: medianGoods === null ? "unplayed" : "ungated",
    },
    {
      label: "Captain legs closing on one good or none",
      value:
        legReports.length === 0
          ? "no leg report in the window"
          : `${sharePercent(thinLegs, legReports.length)} over ${legReports.length} captain legs`,
      target: "no gate yet",
      verdict: legReports.length === 0 ? "unplayed" : "ungated",
    },
    {
      label: "Offer units posted, filled, expired",
      value: `${offers.posted} / ${offers.filled} / ${offers.expired}`,
      target: "no gate yet",
      verdict:
        offers.posted === 0 && offers.filled === 0 && offers.expired === 0
          ? "unplayed"
          : "ungated",
    },
  ];

  return {
    id: "staples",
    title: "The staples",
    question: "Is anything becoming a staple?",
    state: stateOf(readings),
    answer: summarize(
      readings,
      "No gate yet: the card gates and the goods and Bourse gates have no source on the record, so four slots stand, and the charter gate has no path past its floor yet.",
    ),
    readings,
    gaps: [
      "The card gates and the goods and Bourse gates have no source on the record, so the four gates above stand as slots rather than readings.",
      "The record keeps the count of goods a leg dealt and a hold closed with, never their names, so the share of goods traded the plan asks for has no source until an event carries the identity rather than the count.",
      // [F6] How the two charter rows were read, for whoever is on balance
      // duty when one of them moves: what the split is grouped by and why
      // a path has to earn its floor, and what the cover row is watching
      // for now that the plan's threshold is nothing at all.
      "The two charter rows are the window's own takes, filed once per captain per voyage when the moment is answered at leg four. The split is read inside each path, because the plan's question is which of a path's two charters captains reach for, and a path is only judged once it holds the floor the card reader reads its own card statistics over; the value names the widest judged path, so the deviation it prints and the verdict over it are about the same path. The cover row is the plan's watch rather than a gate: a charter that only traitors take has stopped being cover, so the row reads how often the salvage charters were taken by each alignment, and it is left unjudged because the plan set no threshold on it.",
    ],
  };
}

// Whether the mode's outcomes move when they should not. This is the
// panel the window can actually read today: the win rate bands, the swing
// across them, session length at the five captain tune target, the lobby
// fill time by table size, and where the voyages that stopped before the
// reveal stopped. The three rows with no threshold in the plan (the
// swing, the fill time, the stops) read as measured but unjudged rather
// than being given a band nobody set.
// A role's win rate is one launch gate read at three table sizes, so the
// three cells of a role all carry that role's id and the launch verdict
// reads them together rather than counting a band as a gate of its own.
// The table is here rather than inside the map below so the mapping is one
// statement a reader can check against the plan's list of sixteen.
const WIN_RATE_GATE: Record<GambitRole, GateId> = {
  honest: "honest_win_rate",
  broker: "broker_win_rate",
  pirate: "pirate_win_rate",
};

function variancePanel(
  records: readonly TelemetryRecord[],
  outcomes: readonly DashboardOutcome[],
): DashboardPanel {
  const cells = readWinRates(outcomes);
  const cellLines: DashboardReadingLine[] = cells.map((cell) => ({
    // The deck's own name for the card, read from the table the cards
    // are dealt from, so a role is never called two things.
    label: `${roleCard(cell.alignment).title}, ${cell.band} seats`,
    value:
      cell.rate === null
        ? "no voyage played"
        : `${ratePercent(cell.rate)} of ${cell.played}`,
    target: `${WIN_RATE_TARGETS[cell.alignment].floor} to ${
      WIN_RATE_TARGETS[cell.alignment].ceiling
    }%`,
    verdict: bandVerdict(cell.alignment, cell.rate),
    gate: WIN_RATE_GATE[cell.alignment],
  }));
  const swingLines: DashboardReadingLine[] = readSwings(cells).map((swing) => ({
    label: `Swing across played bands, ${roleCard(swing.alignment).title}`,
    value:
      swing.points === null
        ? swing.bands === 0
          ? "no band played"
          : "one played band at most"
        : `${swing.points.toFixed(1)} points`,
    target: "no threshold in the plan",
    verdict: swing.points === null ? "unplayed" : "ungated",
  }));
  const readings: DashboardReadingLine[] = [
    ...cellLines,
    ...swingLines,
    sessionLength(records),
    lobbyFill(records),
    earlyEndings(records),
  ];

  return {
    id: "variance",
    title: "The variance",
    question: "Is the variance too swingy?",
    state: stateOf(readings),
    answer: summarize(
      readings,
      "No voyage in the window has a gate to read yet.",
    ),
    readings,
    gaps: [
      "The swing has no threshold in the plan: its gate is that a rate does not move as the table grows, so the points beside each role are what moving would look like rather than a band to fail.",
      "Session length is measured from the moment the harbor was charted to the moment the voyage closed, which is the plan's lobby to reveal, and only over voyages that concluded at five seats: a wiped or emptied voyage stopped early and its clock is not a session.",
      "The lobby fill time has no threshold in the plan and is not one of the sixteen gates: it is read to decide whether six seats are worth supporting at all. When a session runs long the plan shortens the voyage before it shortens the phases, because the phases are where the conversation lives, and the knob for that is the mode's own voyageLegs (twelve for Ocean Gambit, the tier's ladder for Classic) rather than a round count written beside this row.",
    ],
  };
}

// The plan's utilization gate, which had no source until the hold had a
// size to divide by and now reads the leg reports.
//
// The numerator is the captain's own count of the slots their ship was
// carrying something in, filed as a claim like the rest of the leg report
// and read here as one. Only a voyage playing the split hold files one:
// a record written before this feature, or by a harbor with the split
// switched off, carries no slots, and those legs are left out of the
// sample rather than read as empty ships. That is the same line the whole
// spine draws around a switched off layer, and it is what keeps this
// reading from moving when a table rolls the switch back.
//
// The denominator is the ship's two capacities at their nominal size, and
// deliberately not the quarter a hungry crew takes off the cargo: the
// report does not carry the shortage, and a denominator that moved per
// captain would make two captains' legs incomparable under a gate that is
// a claim about the fleet. The cost of that is stated rather than hidden:
// a captain on short rations reads against the hold they would have had,
// which is the reading that says how full their ship is rather than how
// much of it hunger took away.
//
// The median rather than the mean, for the reason the session length
// gives: one captain who sailed with a hold almost empty is a tail rather
// than a centre, and the gate is a claim about the ordinary ship.
function holdUtilization(
  records: readonly TelemetryRecord[],
): DashboardReadingLine {
  const fills: number[] = [];
  for (const record of records) {
    for (const event of record.events) {
      if (event.name === "leg_report" && event.holdSlots !== undefined) {
        fills.push(event.holdSlots / (CARGO_SLOTS + STORES_SLOTS));
      }
    }
  }
  const centre = median(fills);
  if (centre === null) {
    return {
      label: "Median hold utilization",
      value: "no leg report from a split hold",
      target: "55 to 80%",
      verdict: "unplayed",
      gate: "hold_utilization",
    };
  }
  const percent = Math.round(centre * 100);
  return {
    label: "Median hold utilization",
    value: `${ratePercent(centre)}, median of ${fills.length}`,
    target: "55 to 80%",
    verdict: percent < 55 ? "under" : percent > 80 ? "over" : "in",
    gate: "hold_utilization",
  };
}

// The gates that are none of the three questions: the mode's worst
// outcomes being rare and its people staying. Three of the four can be
// read today and one cannot, and the panel keeps them together rather
// than scattering them into questions they do not answer.
function floorPanel(
  records: readonly TelemetryRecord[],
  outcomes: readonly DashboardOutcome[],
): DashboardPanel {
  // Retention is read off I2's mark on the captain lines, and only over
  // the voyages that closed with somebody standing: a harbor that emptied
  // has nobody left to be standing, so its lines cannot answer whether a
  // marooned captain stayed. The mark is the server's fact, which is what
  // lets this be a pass over one record rather than a join.
  const closing = records.filter((record) => record.outcome !== "emptied");
  const marooned = closing.flatMap((record) =>
    record.captains.filter((captain) => captain.marooned),
  );
  const stayed = marooned.filter((captain) => captain.presentAtEnd).length;

  const bankrupt = outcomes.filter((outcome) => outcome.bankrupt).length;

  const readings: DashboardReadingLine[] = [
    {
      label: "Marooned captains still standing at the close",
      value:
        marooned.length === 0
          ? "no maroon in the window"
          : `${sharePercent(stayed, marooned.length)} of ${marooned.length}`,
      target: "above 90%",
      verdict:
        marooned.length === 0
          ? "unplayed"
          : Math.round((stayed / marooned.length) * 100) < 90
            ? "under"
            : "in",
      gate: "maroon_retention",
    },
    {
      label: "Captains bankrupt at the reveal",
      value:
        outcomes.length === 0
          ? "no chronicle row in the window"
          : `${sharePercent(bankrupt, outcomes.length)} of ${outcomes.length}`,
      target: "under 12%",
      verdict:
        outcomes.length === 0
          ? "unplayed"
          : Math.round((bankrupt / outcomes.length) * 100) > 12
            ? "over"
            : "in",
      gate: "bankruptcy",
    },
    holdUtilization(records),
    {
      label: "Parley participation",
      value: NO_SOURCE,
      target: "above 66%",
      verdict: "unmeasured",
      gate: "parley_participation",
    },
  ];

  return {
    id: "floor",
    title: "The floor",
    question: null,
    state: stateOf(readings),
    answer: summarize(
      readings,
      "No voyage in the window has a gate to read yet: utilization needs a leg report from a harbor playing the split hold, and participation needs a talk line that names the phase.",
    ),
    readings,
    gaps: [
      "Hold utilization is read off the leg reports, and only off those whose voyage was playing the split hold: a leg filed by a harbor with the split switched off carries no slots and is not in the sample. Its denominator is the ship's two capacities at their full size, because the quarter a hungry crew costs the cargo is not something the report carries, so a captain on short rations reads against the hold they would have had.",
      "Parley participation cannot be read off the record's talk line either, because that line carries the leg and not the phase, and talk is open through every phase of a leg: the record cannot separate Parley from the rest of the round.",
      "Retention is read over the voyages that closed with somebody standing, at the resolution the record has, which is presence at the close rather than the length of one connection.",
    ],
  };
}

/* === The three readings the variance panel builds === */

// The plan's session length gate, at the tune target of five captains.
// The clock is the record's own: charted to closed, which is the plan's
// lobby to reveal, over the voyages that concluded because only those
// have an end a session can be measured to. The median rather than the
// mean, because one harbor left open for an hour before it sailed is a
// tail rather than a centre, and the gate is a claim about the ordinary
// voyage.
function sessionLength(
  records: readonly TelemetryRecord[],
): DashboardReadingLine {
  const minutes = records
    .filter((record) => record.outcome === "concluded" && record.seats === 5)
    .map((record) => (record.endedAt - record.openedAt) / 60000)
    .filter((value) => Number.isFinite(value) && value > 0);
  const centre = median(minutes);
  if (centre === null) {
    return {
      label: "Session length at five captains, charted to reveal",
      value: "no concluded voyage at five",
      target: "62 to 74 min",
      verdict: "unplayed",
      gate: "session_length",
    };
  }
  const whole = Math.round(centre);
  return {
    label: "Session length at five captains, charted to reveal",
    value: `${whole} min, median of ${minutes.length}`,
    target: "62 to 74 min",
    verdict: whole < 62 ? "under" : whole > 74 ? "over" : "in",
    gate: "session_length",
  };
}

// The plan's other session number: how long a harbor sat waiting for its
// table to fill, read one band at a time. Nothing about a voyage's ending
// is filtered out here, because a table that gathered in four minutes and
// then wiped gathered in four minutes, and the question the row is asked
// is how long the gathering takes rather than how the voyage went. The
// plan sets no threshold on it and it is not one of the sixteen gates,
// which is why it reads as measured and unjudged: what it is for is the
// decision the plan names, whether six seats are worth supporting at all,
// and that decision is a comparison between the bands rather than a line
// any single one of them crosses. Every band prints whether or not it saw
// a voyage, because "nobody sailed at six" is one of the two answers the
// row exists to give, and a band left off the row would read as a band
// nobody looked at.
//
// The clock is the record's own, charted to set sail, which the record
// header names as the lobby fill time. A voyage that never started
// carries no start to subtract from, and the positive filter below drops
// it rather than seating it at zero minutes, which would read as a table
// that filled instantly.
function lobbyFill(records: readonly TelemetryRecord[]): DashboardReadingLine {
  const bands = SEAT_BANDS.map((band) => {
    const minutes = records
      .filter((record) => seatBand(record.seats).min === band.min)
      .map((record) => (record.startedAt - record.openedAt) / 60000)
      .filter((value) => Number.isFinite(value) && value > 0);
    return {
      label: band.label,
      centre: median(minutes),
      count: minutes.length,
    };
  });
  const sailed = bands.filter((band) => band.centre !== null);
  if (sailed.length === 0) {
    return {
      label: "Lobby fill time by table size, charted to set sail",
      value: "no voyage in the window",
      target: "no threshold in the plan",
      verdict: "unplayed",
    };
  }
  return {
    label: "Lobby fill time by table size, charted to set sail",
    value: bands
      .map((band) =>
        band.centre === null
          ? `${band.label} seats none in the window`
          : `${band.label} seats ${Math.round(band.centre)} min of ${band.count}`,
      )
      .join("; "),
    target: "no threshold in the plan",
    verdict: "ungated",
  };
}

// Where the voyages that did not reach the reveal stopped. The plan lists
// the abandon rate by leg as a business number and sets no threshold on
// it, so this reads as measured and unjudged: a mode losing its tables at
// leg three is what the row is there to show, and the row does not
// pretend to know how many is too many.
function earlyEndings(
  records: readonly TelemetryRecord[],
): DashboardReadingLine {
  const stopped = records.filter((record) => record.outcome !== "concluded");
  const centre = median(stopped.map((record) => record.endedAtLeg));
  return {
    label: "Voyages that stopped before the reveal",
    value:
      records.length === 0
        ? "no voyage in the window"
        : centre === null
          ? "none"
          : `${stopped.length} of ${records.length}, stopping at leg ${Math.round(centre)} on the median`,
    target: "no gate yet",
    verdict: records.length === 0 ? "unplayed" : "ungated",
  };
}

/* === The arithmetic every panel shares === */

// Whether a reading is a gate at all: the two verdicts that mean there is
// nothing to judge (no source, or no threshold) are not gates, and a
// panel's state is computed from the ones that are.
function isGated(reading: DashboardReadingLine): boolean {
  return reading.verdict !== "unmeasured" && reading.verdict !== "ungated";
}

// What a panel says at a glance. A panel with no gate it could read is
// not clear and not watching: it is a panel with nothing to read yet,
// which is its own state and its own colour, because "no reading" and
// "everything inside the gates" are the two answers a dashboard must not
// confuse.
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

// The one line a panel answers with: how many of the gates it could read
// are outside them and which, or that everything readable is inside, or
// the sentence the panel was handed for the case where nothing is. It
// counts against the gates the panel holds rather than the readings it
// printed, so a panel with four slots and two readable gates says "2 of
// 4" rather than implying the slots were read.
function summarize(
  readings: readonly DashboardReadingLine[],
  whenNothing: string,
): string {
  const gated = readings.filter(isGated);
  const readable = gated.filter((reading) => reading.verdict !== "unplayed");
  if (readable.length === 0) return whenNothing;
  const outside = readable.filter(
    (reading) => reading.verdict === "under" || reading.verdict === "over",
  );
  if (outside.length === 0) {
    return `Every gate this window can read sits inside it, ${readable.length} of ${gated.length}.`;
  }
  return `${outside.length} of ${gated.length} gates sit outside theirs: ${outside
    .map((reading) => `${reading.label}, ${reading.value}`)
    .join("; ")}.`;
}

// A share of a whole, written through the reader's own rate formatter, so
// a share and a rate print the same way and a reader cannot tell them
// apart by their shapes: the labels are what say which is which, which is
// how the labels are meant to be read.
function sharePercent(part: number, whole: number): string {
  return ratePercent(part / whole);
}

// The middle of a list of numbers, or null for an empty one. Even counts
// take the mean of the two middles, which for a list of minutes is still
// a number a reader can hold in their head once it is rounded, and for a
// list of goods counts is the only defensible centre there is.
function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}
