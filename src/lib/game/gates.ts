// =====================================================================
// PortMasters 2.2 Parallel Release: the launch verdict.
//
// Every number in
// the design's balance section is a gate rather than a target, and the
// mode does not ship until each one is in band over at least three hundred
// recorded voyages. The balance dashboard reads those gates and shows
// them; this module decides with them, which is a different job and the
// reason it is a different file.
//
// It is a reduction over a reading rather than a second reading of the
// window, and that is the property to keep. `readLaunchVerdict` takes what
// `readDashboard` returned and answers one question with it: does the mode
// ship. It opens no database, reads no clock and knows nothing about where
// the window came from, so the page, the command line report and any
// future surface all ask one implementation and cannot disagree about
// whether the mode passed.
//
// What "clear" costs is the whole of the design. It requires all sixteen
// gates, read over the design's floor of voyages, every one of them inside
// its band, at a sample rate of one and with nothing unread or truncated.
// Anything less is not a near miss to be rounded up: a gate with no source,
// a gate no voyage has exercised, a run that is a hundred voyages short and
// a window recorded at half rate are each their own reason the verdict
// cannot be given, and each is named in the gaps rather than folded into a
// count. A mode that shipped on the gates that happened to be measurable is
// the failure this module exists to make impossible, which is why the
// absence of a gate blocks the ship decision rather than being skipped by
// it.
//
// The one rule the design writes down before the run starts lives here as
// data: when two gates conflict, the Free Captain pick rate wins, because
// the design makes it a hard requirement of the hidden role mode rather
// than a balance nicety. It is a partial order holding exactly what the
// design names, and an empty list would mean the design names none, so a
// later change that adds a second untouchable gate adds a line rather than
// rewriting a sentence in a document nobody rereads during a run.
//
// Nothing here is read by the game. The verdict reads finished voyages and
// decides about a release; no rule, no save and no socket knows it exists.
// =====================================================================

import {
  LAUNCH_GATE_IDS,
  type DashboardReading,
  type DashboardReadingLine,
  type GateId,
  type ReadingVerdict,
} from "./dashboard";
// The verdict is composed here for two surfaces, the page and the command
// line report, and every sentence of it is read at the moment it is built:
// the strip a captain on balance duty reads is drawn from these strings
// rather than from a copy taken when the process started. The list joiner
// rides beside the reader for the tally and the gate name lists.
import { listJoiner, t } from "./i18n";

// The design's floor for the run: three hundred recorded voyages, which is
// also the size of the window the operator surfaces read (see
// src/server/telemetry-window.ts, which takes its size from here so the
// two numbers cannot drift into a window too small to clear).
export const LAUNCH_MINIMUM_VOYAGES = 300;

// The design's tie break rule, as the one gate it names. See the header for
// why this is a list rather than a single constant: the design names a
// priority rather than a single protected number, and a second untouchable
// gate would be a second line here.
export const LAUNCH_PRIORITY: readonly GateId[] = ["free_captain_pick_rate"];

// Whether the mode ships. Three answers rather than two, because "we cannot
// say yet" is not the same finding as "something is out of band" and a
// release process that confuses them either ships on no evidence or holds a
// mode that is ready.
export type LaunchState = "clear" | "held" | "unjudged";

// One of the design's sixteen gates, as the reading carried it.
export type LaunchGate = {
  id: GateId;
  // The reading that decides this gate: the first one out of band, or the
  // first one that was read at all, or the first of the gate's readings.
  // A role's win rate is one gate over three table sizes, so the gate has
  // to pick the line that decided it rather than printing three, and the
  // line it picks is the one an operator has to go and fix.
  line: DashboardReadingLine;
  // The gate's own verdict, which is the strictest of its readings: a rate
  // out of band at one table size is that gate out of band, however the
  // other sizes read.
  verdict: ReadingVerdict;
  // How many readings carry the gate, so a reader can tell a role read at
  // three table sizes from a single number.
  readings: number;
};

export type LaunchVerdict = {
  state: LaunchState;
  // The one sentence an operator reads first, in plain words.
  answer: string;
  // The run as the window held it, against the design's floor.
  voyages: number;
  required: number;
  // All sixteen gates, in the design's order, whatever state they are in.
  gates: LaunchGate[];
  // The ways a gate can keep the mode on the quay, kept apart because they
  // ask for different work: a measured number to move, a system to build,
  // a voyage to play, and (empty by construction today) a gate id on a
  // reading the design set no threshold on, which is a contradiction in the
  // page rather than a reading.
  failing: LaunchGate[];
  unmeasured: LaunchGate[];
  unplayed: LaunchGate[];
  ungated: LaunchGate[];
  // The design's own priority: the gate that cannot be traded against the
  // others when two of them conflict, which is the one out of band case
  // and null everywhere else.
  untradeable: LaunchGate | null;
  // The sixteen by where they stand, as one line a surface can print
  // without counting anything of its own. The counting lives here for the
  // same reason every other number on the operator surfaces does: a page
  // that added up its own gates would be a second implementation of this
  // verdict, and the two would disagree on the day one of them changed.
  tally: string;
  // Every reason the verdict is not clear, in prose, so the answer above
  // can be one sentence and this can be the whole of the rest.
  gaps: string[];
};

/* === The reader === */

/**
 * The ship decision, over a reading the dashboard already took.
 *
 * The reading is the only input, which is what keeps this cheap enough to
 * run on demand: the page computes it from the answer it already fetched
 * and the report computes it from the window it has just read, and neither
 * asks the database a second question.
 */
export function readLaunchVerdict(reading: DashboardReading): LaunchVerdict {
  const gates = groupGates(reading);

  const failing = gates.filter(
    (gate) => gate.verdict === "under" || gate.verdict === "over",
  );
  const unmeasured = gates.filter((gate) => gate.verdict === "unmeasured");
  const unplayed = gates.filter((gate) => gate.verdict === "unplayed");
  const ungated = gates.filter((gate) => gate.verdict === "ungated");
  // The design's own priority, and only the case the rule has something to
  // resolve: the priority gate is the one out of band, so a conflict is
  // settled in its favor rather than against it. A priority gate with no
  // source and a priority gate inside its band both leave this null,
  // because in neither state is there a number of it being traded.
  const untradeable =
    gates.find(
      (gate) =>
        LAUNCH_PRIORITY.includes(gate.id) &&
        (gate.verdict === "under" || gate.verdict === "over"),
    ) ?? null;

  const reasons = reasonsFor({
    reading,
    gates,
    failing,
    unmeasured,
    unplayed,
    ungated,
  });
  const gaps = reasons
    .filter((reason) => reason.applies)
    .map((reason) => reason.gap);

  // The state is read off the gates rather than off the gap list, so the
  // two cannot disagree: a gate that is not inside its band withholds the
  // verdict whatever the prose managed to name. The gap list explains the
  // state; it does not decide it, and the second half of the test is the
  // belt to the first half's braces, for a verdict this module has never
  // seen.
  const notInBand = gates.filter((gate) => gate.verdict !== "in");
  const state: LaunchState =
    failing.length > 0
      ? "held"
      : notInBand.length > 0 || gaps.length > 0
        ? "unjudged"
        : "clear";

  // The gates by where they stand. The four standing verdicts are always
  // named, zeroes included, because "0 out of band" is the reassuring half
  // of this line and a line that dropped it would read the same on a good
  // run and a quiet one. The contradiction bucket is named only when it
  // has anything in it, since it can never have anything in it.
  const tally = [
    t("{inBand} of {gates.length} gates inside {bandWord}", {
      inBand: gates.length - notInBand.length,
      "gates.length": gates.length,
      bandWord:
        gates.length - notInBand.length === 1 ? "its band" : "their bands",
    }),
    t("{failing.length} out of band", { "failing.length": failing.length }),
    t("{unmeasured.length} with no source", {
      "unmeasured.length": unmeasured.length,
    }),
    t("{unplayed.length} with no voyage to read", {
      "unplayed.length": unplayed.length,
    }),
    ...(ungated.length > 0
      ? [
          t("{ungated.length} answering a reading with no threshold", {
            "ungated.length": ungated.length,
          }),
        ]
      : []),
  ].join(listJoiner());

  return {
    state,
    answer: answerFor({
      state,
      reasons,
      failing,
      untradeable,
      voyages: reading.window.voyages,
      total: gates.length,
    }),
    voyages: reading.window.voyages,
    required: LAUNCH_MINIMUM_VOYAGES,
    gates,
    failing,
    unmeasured,
    unplayed,
    ungated,
    untradeable,
    tally: `${tally}.`,
    gaps,
  };
}

/* === The sixteen, gathered from the page === */

// The gates in the design's order, each with the readings that carry it.
//
// A gate the page does not carry at all is not skipped: it is built as an
// unmeasured gate with the design's own id as its label and a gap saying so,
// because a ship decision taken over fifteen gates is not the decision the
// design asks for. That branch is unreachable while the page and this list
// agree, and the smoke suite holds them together from both ends, but it
// fails closed rather than open on the day they stop agreeing.
function groupGates(reading: DashboardReading): LaunchGate[] {
  return LAUNCH_GATE_IDS.map((id) => {
    const lines: DashboardReadingLine[] = [];
    for (const panel of reading.panels) {
      for (const line of panel.readings) {
        if (line.gate === id) lines.push(line);
      }
    }
    if (lines.length === 0) {
      return {
        id,
        line: { label: id, value: "", target: "", verdict: "unmeasured" },
        verdict: "unmeasured",
        readings: 0,
      };
    }
    return {
      id,
      line: decidingLine(lines),
      verdict: gateVerdict(lines),
      readings: lines.length,
    };
  });
}

// The reading a gate is judged by, and printed with: the first one out of
// band, because that is the one somebody has to go and change, or the
// first one that was read at all, or failing both the first of them.
function decidingLine(
  lines: readonly DashboardReadingLine[],
): DashboardReadingLine {
  return (
    lines.find((line) => line.verdict === "under" || line.verdict === "over") ??
    lines.find((line) => line.verdict === "in") ??
    lines.find((line) => line.verdict === "unplayed") ??
    lines[0]
  );
}

// The strictest verdict among a gate's readings. Out of band beats in
// band, in band beats no evidence, and no evidence beats no source: a
// gate read at one table size is read, even when another band is empty,
// and a gate whose every reading is a slot is unmeasured.
//
// The last line is the contradiction detector: a gate id attached to a
// reading the design set no threshold on is not a reading at all, so it is
// returned as the ungated verdict rather than folded into unmeasured,
// where it would read as a system still to build instead of a page that
// lost its gate. It withholds the ship decision like every other verdict
// but in band.
function gateVerdict(lines: readonly DashboardReadingLine[]): ReadingVerdict {
  const verdicts = lines.map((line) => line.verdict);
  if (verdicts.some((v) => v === "under" || v === "over")) {
    return verdicts.includes("over") ? "over" : "under";
  }
  if (verdicts.includes("in")) return "in";
  if (verdicts.includes("unplayed")) return "unplayed";
  if (verdicts.includes("ungated")) return "ungated";
  return "unmeasured";
}

/* === The reasons, in the order an operator works them === */

// One reason the verdict is not clear. Each carries both sentences a
// surface needs: the sentence the gap list prints in full, and the short
// clause the answer uses when this is the first reason to apply. Carrying
// both is what keeps the answer and the gaps from disagreeing about which
// reason came first, since both read this one ordered list.
type LaunchReason = {
  applies: boolean;
  // The clause the answer uses, or null where the reason only ever applies
  // in a state whose answer is written elsewhere: a failed gate, whose
  // answer names the failures themselves rather than a missing number.
  short: string | null;
  gap: string;
};

// Every reason a verdict is not clear, in the order an operator would work
// them: the run first, since nothing else means anything over a window
// that is too small or was sampled, then the gates with no source, then
// the gates no voyage has exercised, then the records the window could not
// keep whole, and last the gates that failed.
function reasonsFor(input: {
  reading: DashboardReading;
  gates: readonly LaunchGate[];
  failing: readonly LaunchGate[];
  unmeasured: readonly LaunchGate[];
  unplayed: readonly LaunchGate[];
  ungated: readonly LaunchGate[];
}): LaunchReason[] {
  const { reading, gates, failing, unmeasured, unplayed, ungated } = input;
  const { voyages, sampleRate, unreadable, truncated } = reading.window;
  // The window's sample rate as the gap sentence writes it, worked out
  // once: two places rounding one number is how a sentence and a sentence
  // start to disagree.
  const samplePercent = Math.round(sampleRate * 100);

  return [
    {
      applies: voyages < LAUNCH_MINIMUM_VOYAGES,
      short: t(
        "the run stands at {voyages} of {LAUNCH_MINIMUM_VOYAGES} recorded voyages",
        {
          voyages,
          LAUNCH_MINIMUM_VOYAGES,
        },
      ),
      gap: t(
        "The run stands at {voyages} of {LAUNCH_MINIMUM_VOYAGES} recorded voyages, and a gate read over fewer than {LAUNCH_MINIMUM_VOYAGES} is a reading rather than evidence.",
        { voyages, LAUNCH_MINIMUM_VOYAGES },
      ),
    },
    {
      // A window recorded at a sample rate below one is a sample of the
      // run rather than the run, and the design's floor is about voyages
      // that happened rather than voyages that were kept.
      applies: sampleRate < 1,
      short: t(
        "the window was recorded at a sample rate of {samplePercent}%, so it is a sample of the run rather than the run",
        { samplePercent },
      ),
      gap: t(
        "The window was recorded at a sample rate of {samplePercent}%, so these are readings of a sample of the run rather than of the run.",
        { samplePercent },
      ),
    },
    {
      applies: unmeasured.length > 0,
      short: t(
        "{unmeasured.length} of the {gates.length} gates {haveWord} no source yet",
        {
          "unmeasured.length": unmeasured.length,
          "gates.length": gates.length,
          haveWord: unmeasured.length === 1 ? "has" : "have",
        },
      ),
      gap: t(
        "{unmeasured.length} of the {gates.length} gates {haveWord} no source: {gateNames}. {waitWord} on the systems that would produce them, and the design does not ship a mode on the gates that happen to be measurable.",
        {
          "unmeasured.length": unmeasured.length,
          "gates.length": gates.length,
          haveWord: unmeasured.length === 1 ? "has" : "have",
          gateNames: names(unmeasured),
          waitWord: unmeasured.length === 1 ? "It waits" : "They wait",
        },
      ),
    },
    {
      applies: unplayed.length > 0,
      short: t(
        "{unplayed.length} of the {gates.length} gates {haveWord} no voyage to read",
        {
          "unplayed.length": unplayed.length,
          "gates.length": gates.length,
          haveWord: unplayed.length === 1 ? "has" : "have",
        },
      ),
      gap: t(
        "{unplayed.length} of the {gates.length} gates {haveWord} no voyage to read: {gateNames}.",
        {
          "unplayed.length": unplayed.length,
          "gates.length": gates.length,
          haveWord: unplayed.length === 1 ? "has" : "have",
          gateNames: names(unplayed),
        },
      ),
    },
    {
      applies: unreadable > 0,
      short: t(
        "the window holds {unreadable} {recordWord} that could not be read",
        {
          unreadable,
          recordWord: unreadable === 1 ? "record" : "records",
        },
      ),
      gap: t(
        "The window holds {unreadable} {recordWord} that could not be read, so it is that much smaller than the run it was taken from.",
        {
          unreadable,
          recordWord: unreadable === 1 ? "record" : "records",
        },
      ),
    },
    {
      applies: truncated > 0,
      short: t(
        "the window holds {truncated} {recordWord} that hit the event cap",
        {
          truncated,
          recordWord: truncated === 1 ? "record" : "records",
        },
      ),
      gap: t(
        "The window holds {truncated} {recordWord} that hit the event cap, so some of what happened in those voyages was never kept and the gates read over them are floors rather than readings.",
        {
          truncated,
          recordWord: truncated === 1 ? "record" : "records",
        },
      ),
    },
    {
      applies: ungated.length > 0,
      short: t(
        "{ungated.length} of the {gates.length} gates answer a reading the design set no threshold on",
        {
          "ungated.length": ungated.length,
          "gates.length": gates.length,
        },
      ),
      gap: t(
        "{ungated.length} of the {gates.length} gates answer readings the design set no threshold on: {gateNames}. That is a contradiction in the page rather than a reading, and it is named here rather than passed over.",
        {
          "ungated.length": ungated.length,
          "gates.length": gates.length,
          gateNames: names(ungated),
        },
      ),
    },
    {
      applies: failing.length > 0,
      short: null,
      gap: t(
        "{failing.length} {sitsWord} outside {theirWord} band: {gateLines}.",
        {
          "failing.length": failing.length,
          sitsWord: failing.length === 1 ? "gate sits" : "gates sit",
          theirWord: failing.length === 1 ? "its" : "their",
          gateLines: lines(failing),
        },
      ),
    },
  ];
}

/* === The one sentence === */

// The answer, chosen by state: the ship decision in the clear case, the
// failures in the held case, and otherwise the first reason to apply, so
// the first sentence an operator reads is the first thing they would fix.
function answerFor(input: {
  state: LaunchState;
  reasons: readonly LaunchReason[];
  failing: readonly LaunchGate[];
  untradeable: LaunchGate | null;
  voyages: number;
  total: number;
}): string {
  const { state, reasons, failing, untradeable, voyages, total } = input;

  if (state === "clear") {
    return t(
      "Clear to ship: all {total} gates sit inside their bands over {voyages} recorded voyages.",
      { total, voyages },
    );
  }

  if (state === "held") {
    const head = t("Held by {failing.length} of {total} gates: {gateLines}.", {
      "failing.length": failing.length,
      total,
      gateLines: lines(failing),
    });
    // The priority rule is said only when the priority gate is one of the
    // gates holding the mode, which is the state the design's tie break was
    // written for: there is a conflict, and one side of it is untouchable.
    return untradeable === null
      ? head
      : t(
          "{head} {untradeable.line.label} is the design's own priority and cannot be traded against the others.",
          { head, "untradeable.line.label": untradeable.line.label },
        );
  }

  const first = reasons.find(
    (reason) => reason.applies && reason.short !== null,
  );
  // The fallback is unreachable while the reasons cover the verdicts the
  // gates can carry, and it is written as a withheld verdict rather than
  // an empty sentence in case they stop covering them.
  if (first === undefined || first.short === null) {
    return t("No verdict yet: the reading leaves gates to read.");
  }
  return t("No verdict yet: {first.short}.", { "first.short": first.short });
}

// The gates as a list meant to be read, used by the answer and the gaps: each
// gate as its label and its reading, which is what an operator has to look
// up rather than a slug.
function lines(gates: readonly LaunchGate[]): string {
  return gates
    .map((gate) =>
      t("{gate.line.label}, {gate.line.value} against {gate.line.target}", {
        "gate.line.label": gate.line.label,
        "gate.line.value": gate.line.value,
        "gate.line.target": gate.line.target,
      }),
    )
    .join("; ");
}

function names(gates: readonly LaunchGate[]): string {
  return gates.map((gate) => gate.line.label).join(listJoiner());
}
