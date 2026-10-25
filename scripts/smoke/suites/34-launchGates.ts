// PortMasters 2.2 Parallel Release, smoke run: The launch gates.
//
// The ship decision, over the readings the dashboard has just built. The
// verdict is a reduction with no database behind it, so what is checked
// here is that it withholds the decision in every way it must and gives it
// only over the whole of what it asks for. The last two checks are the
// run's own window, over the wire.
//
// This article was one file of 2,305 lines that held the four survival
// families as well as the gate verdict. It is now a run of articles, one
// theme each, and the run takes them in the order the checks used to
// come in, because a check that moves is a check that reports in the
// wrong place.
import type {
  DashboardOutcome,
  DashboardPanel,
  DashboardReading,
  DashboardReadingLine,
  DashboardWindow,
} from "@/lib/game/dashboard";
import { LAUNCH_GATE_IDS, readDashboard } from "@/lib/game/dashboard";
import { LAUNCH_MINIMUM_VOYAGES, readLaunchVerdict } from "@/lib/game/gates";
import type { TelemetryRecord } from "@/lib/game/telemetry";
import { check } from "../harness";
import type { Captain } from "../wire";

export async function launchGatesSuite(inputs: {
  dashRecord: (
    roomId: string,
    over?: Partial<TelemetryRecord>,
  ) => TelemetryRecord;
  emptyReading: {
    frontPage: DashboardReadingLine;
    window: DashboardWindow;
    panels: DashboardPanel[];
  };
  floorReading: {
    frontPage: DashboardReadingLine;
    window: DashboardWindow;
    panels: DashboardPanel[];
  };
  gateLines: DashboardReadingLine[];
  inBandOutcomes: DashboardOutcome[];
  liveReading: DashboardReading | undefined;
  telHome: Captain;
}): Promise<void> {
  const {
    dashRecord,
    emptyReading,
    floorReading,
    gateLines,
    inBandOutcomes,
    liveReading,
    telHome,
  } = inputs;
  // The ship decision, over the readings the dashboard has just built. The
  // verdict is a reduction with no database behind it, so what is checked
  // here is that it withholds the decision in every way it must and gives
  // it only over the whole of what it asks for. The last two checks are
  // the run's own window, over the wire.
  const emptyVerdict = readLaunchVerdict(emptyReading);
  check(
    emptyVerdict.gates.length === LAUNCH_GATE_IDS.length &&
      emptyVerdict.gates.map((gate) => gate.id).join(",") ===
        LAUNCH_GATE_IDS.join(","),
    "the verdict reads the design's sixteen gates in the design's order, whatever state each one is in",
  );
  check(
    LAUNCH_GATE_IDS.every((id) => gateLines.some((line) => line.gate === id)),
    "and every one of them is carried by a row on the page, so a gate the design lists and the page forgets cannot leave the decision short by one",
  );
  check(
    emptyVerdict.state === "unjudged" &&
      emptyVerdict.answer ===
        `No verdict yet: the run stands at 0 of ${LAUNCH_MINIMUM_VOYAGES} recorded voyages.`,
    "an empty window reads as no verdict rather than as a clear one, and says what it is short of",
  );
  check(
    emptyVerdict.tally ===
      "0 of 16 gates inside their bands, 0 out of band, 8 with no source, 8 with no voyage to read.",
    "and the tally counts the gates by where they stand, keeping the zeroes rather than dropping them, so a quiet line and a good line cannot read the same",
  );

  // A reading whose every gate is inside its band, over a full run. The
  // mode cannot produce this yet, since thirteen of the sixteen gates have
  // no source and three have no voyage, so the fixture forces them: what
  // is being checked is the verdict's own rule about what a clear mode
  // costs rather than what the mode has built.
  const forcedIn = emptyReading.panels.map((panel) => ({
    ...panel,
    state: "clear" as const,
    readings: panel.readings.map((line) => ({
      ...line,
      verdict: "in" as const,
    })),
  }));
  const fullRun: DashboardReading = {
    ...emptyReading,
    window: {
      ...emptyReading.window,
      voyages: LAUNCH_MINIMUM_VOYAGES,
      captains: 1500,
    },
    panels: forcedIn,
  };
  const clearVerdict = readLaunchVerdict(fullRun);
  check(
    clearVerdict.state === "clear" &&
      clearVerdict.gaps.length === 0 &&
      clearVerdict.answer ===
        `Clear to ship: all 16 gates sit inside their bands over ${LAUNCH_MINIMUM_VOYAGES} recorded voyages.`,
    "a full run with every gate inside its band clears the mode to ship in one sentence",
  );
  check(
    readLaunchVerdict({
      ...fullRun,
      window: { ...fullRun.window, voyages: LAUNCH_MINIMUM_VOYAGES - 1 },
    }).answer ===
      `No verdict yet: the run stands at ${
        LAUNCH_MINIMUM_VOYAGES - 1
      } of ${LAUNCH_MINIMUM_VOYAGES} recorded voyages.`,
    "and one voyage short of the design's three hundred withholds it, because a gate read over fewer is a reading rather than evidence",
  );
  // The three window facts that make a window a sample of the run rather
  // than the run: a rate below one, a record that hit the event cap, and a
  // record that would not read. Each one alone withholds the decision over
  // an otherwise perfect window, and each is then the only reason left.
  const thinning = [
    { sampleRate: 0.5, truncated: 0, unreadable: 0 },
    { sampleRate: 1, truncated: 1, unreadable: 0 },
    { sampleRate: 1, truncated: 0, unreadable: 1 },
  ];
  check(
    thinning.every((window) => {
      const verdict = readLaunchVerdict({
        ...fullRun,
        window: { ...fullRun.window, ...window },
      });
      return verdict.state === "unjudged" && verdict.gaps.length === 1;
    }),
    "a window recorded at a sample rate below one, or holding a record that hit the event cap or would not read, withholds it too, since the floor is voyages that happened rather than voyages that were kept",
  );

  // The one way to be held: a gate out of band. The priority rule is
  // exercised in both directions, because a rule naming one gate as
  // untouchable has to say nothing when some other gate is the one that
  // failed.
  const heldBy = (label: string, verdict: "under" | "over") =>
    readLaunchVerdict({
      ...fullRun,
      panels: fullRun.panels.map((panel) => ({
        ...panel,
        state: "watch" as const,
        readings: panel.readings.map((line) =>
          line.label === label ? { ...line, verdict } : line,
        ),
      })),
    });
  const heldByPriority = heldBy("Free Captain pick rate", "under");
  check(
    heldByPriority.state === "held" &&
      heldByPriority.failing.length === 1 &&
      heldByPriority.untradeable?.id === "free_captain_pick_rate" &&
      heldByPriority.answer.includes("cannot be traded against the others"),
    "a gate out of band holds the mode, and a failure in the design's own priority is named as the gate that cannot be traded away when two of them conflict",
  );
  const heldByOther = heldBy("The top card's share of winning builds", "over");
  check(
    heldByOther.state === "held" &&
      heldByOther.failing.length === 1 &&
      heldByOther.untradeable === null &&
      !heldByOther.answer.includes("cannot be traded"),
    "while a gate off the priority list failing holds the mode without claiming the priority, which is the rule in the direction it does not apply",
  );
  const floorVerdict = readLaunchVerdict(floorReading);
  check(
    // Five rather than the floor's own two: the role rates read off the
    // same four chronicle rows are out of band as well, so this check
    // fails if the verdict stops gathering gates from the whole page.
    floorVerdict.state === "held" &&
      floorVerdict.failing.length === 5 &&
      floorVerdict.failing.some((gate) => gate.id === "maroon_retention") &&
      floorVerdict.failing.some((gate) => gate.id === "bankruptcy") &&
      floorVerdict.answer.includes(
        "Marooned captains still standing at the close",
      ) &&
      floorVerdict.answer.includes("Captains bankrupt at the reveal"),
    "and the floor the dashboard built holds the mode alongside the three role rates the same chronicle rows read, naming the gates rather than printing a chip a reader has to interpret",
  );

  // Gates waiting on a voyage, over a window whose other thirteen are
  // read: the sentence has to say how many rather than sixteen, because a
  // reader on balance duty should not have to work out which it is
  // talking about. Three wait here, each for its own reason: retention,
  // since the voyage in the window had nobody put ashore; utilization,
  // since no captain of it filed a round report from a split hold; and the
  // charter split, since no captain of it took a charter at the fourth
  // round.
  const oneUnplayed = readLaunchVerdict(
    readDashboard({
      records: [dashRecord("dash-lone")],
      outcomes: inBandOutcomes,
      unreadable: 0,
    }),
  );
  check(
    oneUnplayed.unplayed.length === 3 &&
      oneUnplayed.gaps.some((gap) =>
        gap.includes("3 of the 16 gates have no voyage to read"),
      ),
    "and gates waiting on a voyage are described by their count, since three gates and sixteen are not the same finding",
  );

  // A gate whose row stopped carrying it. It cannot happen while the page
  // and the gate list agree, which is checked above, and the verdict fails
  // closed on the day they stop: a decision taken over fifteen gates is
  // not the decision the list asks for.
  const droppedGate = readLaunchVerdict({
    ...fullRun,
    panels: fullRun.panels.map((panel) => ({
      ...panel,
      readings: panel.readings.map((line) =>
        line.gate === "free_captain_pick_rate"
          ? { ...line, gate: undefined }
          : line,
      ),
    })),
  });
  check(
    droppedGate.state === "unjudged" &&
      droppedGate.unmeasured.length === 1 &&
      droppedGate.gaps.some((gap) => gap.includes("free_captain_pick_rate")),
    "and a gate the page stopped carrying withholds the decision rather than being skipped out of it, failing closed on the day the page and the design disagree",
  );

  // ========== The run's own window ==========
  const runVerdict =
    liveReading === undefined ? null : readLaunchVerdict(liveReading);
  check(
    runVerdict !== null &&
      runVerdict.voyages === liveReading?.window.voyages &&
      runVerdict.gates.length === LAUNCH_GATE_IDS.length &&
      runVerdict.state !== "clear" &&
      runVerdict.gaps.some((gap) =>
        gap.includes(`of ${LAUNCH_MINIMUM_VOYAGES} recorded voyages`),
      ),
    "the verdict over the run's own voyages reads the same window the page does and withholds the ship decision, naming the voyages it is short of",
  );
  check(
    runVerdict !== null && !JSON.stringify(runVerdict).includes(telHome.id),
    "and names no captain either, since the decision is about the mode rather than about who sailed it",
  );
}
