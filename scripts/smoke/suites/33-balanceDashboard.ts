// PortMasters 2.2 Parallel Release, smoke run: The balance dashboard.

import {
  WIN_RATE_TARGETS,
  bandVerdict,
  readWinRates,
} from "@/lib/game/balance";
import type {
  DashboardOutcome,
  DashboardPanel,
  DashboardReading,
  DashboardReadingLine,
  DashboardWindow,
} from "@/lib/game/dashboard";
import { readDashboard } from "@/lib/game/dashboard";
import type { GambitRole } from "@/lib/game/gambit";
import { roleCard } from "@/lib/game/gambit";
import { seatBand } from "@/lib/game/objectives";
import type { TelemetryRecord } from "@/lib/game/telemetry";
import { TELEMETRY_VERSION, voyageIdFor } from "@/lib/game/telemetry";
import { BASE, call, check } from "../harness";

export async function balanceDashboardSuite(inputs: {
  host: {
    id: string;
    token: string;
    cookie: string;
    username: string;
  };
  operator: { id: string; token: string; cookie: string; username: string };
  telHome: { id: string; token: string; cookie: string; username: string };
}): Promise<{
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
}> {
  const { host, operator, telHome } = inputs;
  // Goal I3's evaluation is that somebody on balance duty can answer three
  // questions off one page in under a minute, and the arithmetic behind
  // that page is pure, so most of what is checked here is the reduction
  // itself rather than the screen: a window in, and the reading the page
  // prints out. The two ends of it are checked over the wire at the
  // bottom, because a reduction nothing can reach is not a dashboard.
  //
  // One record, shaped the way the spine writes one. Only the fields a
  // fixture is about are set from the arguments; the rest are what an
  // ordinary Gambit voyage carries, so a fixture stays a record rather
  // than becoming a shape of its own.
  const dashRecord = (
    roomId: string,
    over: Partial<TelemetryRecord> = {},
  ): TelemetryRecord => ({
    version: TELEMETRY_VERSION,
    voyageId: voyageIdFor(roomId, 1),
    roomId: roomId,
    voyageEpoch: 1,
    mode: "ocean_gambit",
    difficulty: "fair_winds",
    seats: 5,
    sampleRate: 1,
    openedAt: 0,
    startedAt: 60_000,
    endedAt: 70 * 60_000,
    outcome: "concluded",
    endedAtLeg: 12,
    captains: [],
    events: [],
    truncated: false,
    ...over,
  });
  // One captain's line, with the fields the marks and the mute live on
  // read as the ordinary case unless a fixture says otherwise: a captain
  // who was still in the harbor when the voyage closed, who was not put
  // ashore, who was not silenced, and who took nothing in trade.
  const dashLine = (
    userId: string,
    over: Partial<TelemetryRecord["captains"][number]> = {},
  ): TelemetryRecord["captains"][number] => ({
    userId,
    presentAtEnd: true,
    marooned: false,
    muted: false,
    peerTradeProfit: 0,
    ...over,
  });
  // A band's worth of chronicle rows: the wins and the losses one role
  // took at one table size, which is all the win rate reader asks of a
  // row and all a fixture here needs to say.
  const dashRows = (
    alignment: GambitRole,
    won: number,
    lost: number,
    seats: number,
  ): DashboardOutcome[] => [
    ...Array.from({ length: won }, () => ({
      alignment,
      won: true,
      seats,
      bankrupt: false,
    })),
    ...Array.from({ length: lost }, () => ({
      alignment,
      won: false,
      seats,
      bankrupt: false,
    })),
  ];

  // ---- An empty window ----
  // The state the page opens in before the mode has been played, which is
  // the one a fresh database would show. Every gate is still named and
  // still answered for: a page that printed nothing, or a zero, for a
  // gate nobody has measured is the instrument the plan warns about.
  const emptyReading = readDashboard({
    records: [],
    outcomes: [],
    unreadable: 0,
  });
  check(
    emptyReading.window.voyages === 0 &&
      emptyReading.window.captains === 0 &&
      emptyReading.window.sampleRate === 1 &&
      emptyReading.window.truncated === 0 &&
      emptyReading.window.unreadable === 0,
    "a window with no voyage in it reads as empty rather than as a rate of zero",
  );
  check(
    emptyReading.panels.map((panel) => panel.id).join(",") ===
      "seat,staples,variance,floor",
    "and the page still carries its four panels, in the plan's order",
  );
  check(
    emptyReading.panels.every(
      (panel) =>
        panel.state === "no reading" &&
        panel.readings.length > 0 &&
        panel.readings.every(
          (line) =>
            line.label.length > 0 &&
            line.value.length > 0 &&
            line.target.length > 0,
        ),
    ),
    "with every gate named, and every one of them saying it has no source rather than showing a blank row",
  );
  check(
    JSON.stringify(emptyReading.panels[0]?.readings[0]) ===
      JSON.stringify(emptyReading.frontPage),
    "and the front page number is the Barge revenue share, held in the seat panel as its own first reading so the two cannot drift apart",
  );

  // Every gate goal I4 lists, matched by the label the page gives it and
  // the target it is judged against, which is the one check that would
  // catch a gate dropped from a panel rather than only a panel dropped
  // from the page. The empty window is where the set is complete: a
  // window with voyages in it has the same gates with values beside
  // them, so the names are asserted here and the readings are asserted
  // against built windows below.
  const gateLines = emptyReading.panels.flatMap((panel) => panel.readings);
  const gates: [string, string][] = [
    ["Quartermaster fill", "above 70%"],
    ["Path pick rate", "12 to 28%"],
    ["Free Captain pick rate", "15 to 22%"],
    ["The top card's share of winning builds", "no card above 35%"],
    ["The top card pairing", "no pair above 62% over 40 appearances"],
    ["Charter split deviation", "no deviation above 20%"],
    ["Distinct goods traded", "above 60%"],
    ["Bourse fills", "above 60%"],
    ["Median hold utilization", "55 to 80%"],
    ["Captains bankrupt at the reveal", "under 12%"],
    ["Marooned captains still standing at the close", "above 90%"],
    ["Parley participation", "above 66%"],
    ["Session length at five captains, charted to reveal", "62 to 74 min"],
  ];
  check(
    gates.every(([label, target]) =>
      gateLines.some((line) => line.label === label && line.target === target),
    ),
    "and every gate the launch goal lists is on a panel under its own name and its own target, so a gate cannot be dropped from the page without a panel losing a row",
  );
  check(
    (["honest", "broker", "pirate"] as const).every((role) =>
      gateLines.some(
        (line) =>
          line.label.startsWith(`${roleCard(role).title}, `) &&
          line.target ===
            `${WIN_RATE_TARGETS[role].floor} to ${WIN_RATE_TARGETS[role].ceiling}%`,
      ),
    ),
    "with the three win rate bands carried under the deck's own name for the card and each judged against its own target",
  );
  check(
    emptyReading.frontPage.label ===
      "Barge revenue share of all food spending" &&
      emptyReading.frontPage.target === "waits on Epic E",
    "and the front page number is named as the share of all food spending the proposal identifies, waiting on the epic that would measure it",
  );

  // ---- The window ----
  // What the page is reading, counted from the records rather than asked
  // for: two voyages and three captains between them, one voyage recorded
  // under a rate below one, one truncated, and two rows the route could
  // not read at all.
  const windowReading = readDashboard({
    records: [
      dashRecord("dash-a", {
        sampleRate: 0.5,
        truncated: true,
        captains: [dashLine("dash-p1"), dashLine("dash-p2")],
      }),
      dashRecord("dash-b", { captains: [dashLine("dash-p3")] }),
    ],
    outcomes: [],
    unreadable: 2,
  });
  check(
    windowReading.window.voyages === 2 &&
      windowReading.window.captains === 3 &&
      windowReading.window.truncated === 1 &&
      windowReading.window.unreadable === 2,
    "the window counts the voyages, the captains in them, and the records that would not read",
  );
  check(
    windowReading.window.sampleRate === 0.5,
    "and reports the lowest rate its records were sampled at, so a window that spans a config change is never read as the whole run",
  );

  // ---- The variance panel, over the rows the report reads ----
  // Three rated bands, every one of them inside its target: four won of
  // seven at the five seat Honest table, one won of five Pirates at six,
  // and two won of five Brokers at four. The page does not compute a rate
  // of its own, so what is checked is that the cells it shows are the
  // reader's own cells, under the deck's name for the role and the
  // reader's own verdict.
  const inBandOutcomes: DashboardOutcome[] = [
    ...dashRows("honest", 4, 3, 5),
    ...dashRows("pirate", 1, 4, 6),
    ...dashRows("broker", 2, 3, 4),
  ];
  const inBand = readDashboard({
    records: [dashRecord("dash-v")],
    outcomes: inBandOutcomes,
    unreadable: 0,
  });
  const ratedCells = readWinRates(inBandOutcomes).filter(
    (cell) => cell.rate !== null,
  );
  const inBandVariance = inBand.panels.find((panel) => panel.id === "variance");
  check(
    inBandVariance !== undefined &&
      ratedCells.length === 3 &&
      ratedCells.every((cell) =>
        inBandVariance.readings.some(
          (line) =>
            line.label ===
              `${roleCard(cell.alignment).title}, ${cell.band} seats` &&
            line.verdict === bandVerdict(cell.alignment, cell.rate),
        ),
      ),
    "every band the report reads appears on the page under the deck's own name for the role and the reader's own verdict, so the two cannot disagree about a rate",
  );
  check(
    inBandVariance !== undefined &&
      inBandVariance.state === "clear" &&
      inBandVariance.answer.startsWith(
        "Every gate this window can read sits inside it",
      ),
    "and a window whose rated bands are all inside their targets reads as inside them rather than as a number to interpret",
  );

  // The same page with one band under its target. The panel has to say
  // which band and what it read, not only that something is out: a state
  // chip on its own is the data dump the plan's evaluation warns about.
  const underBand = readDashboard({
    records: [dashRecord("dash-v2")],
    outcomes: [...inBandOutcomes, ...dashRows("broker", 0, 4, 6)],
    unreadable: 0,
  });
  const underVariance = underBand.panels.find(
    (panel) => panel.id === "variance",
  );
  const underLabel = `${roleCard("broker").title}, ${seatBand(6).label} seats`;
  check(
    underVariance !== undefined &&
      underVariance.state === "watch" &&
      underVariance.readings.some(
        (line) => line.label === underLabel && line.verdict === "under",
      ) &&
      underVariance.answer.includes(underLabel),
    "and one band under its target moves the panel to watching and names the band in the answer",
  );

  // ---- The three readings the spine can already answer ----
  // Session length is a clock the record carries: charted to closed, at
  // the five captain tune target, and only over the voyages that
  // concluded. The three hour harbor is in the window to be sat beside
  // the two ordinary ones, because a median a single long lobby can move
  // is not a reading of the ordinary voyage, and the four seat and the
  // emptied voyage are in it to be left out.
  //
  // The lobby fill time is the other clock a record carries, and it is
  // read one table size band at a time because the plan asks whether six
  // seats are worth supporting at all rather than how long a lobby takes
  // on average.
  const clockReading = readDashboard({
    records: [
      dashRecord("dash-c1", { endedAt: 60 * 60_000 }),
      dashRecord("dash-c2", { endedAt: 70 * 60_000 }),
      dashRecord("dash-c3", { endedAt: 200 * 60_000 }),
      dashRecord("dash-c4", { seats: 4, endedAt: 300 * 60_000 }),
      dashRecord("dash-c5", {
        outcome: "emptied",
        endedAt: 400 * 60_000,
        endedAtLeg: 3,
      }),
    ],
    outcomes: [],
    unreadable: 0,
  });
  const clockPanel = clockReading.panels.find(
    (panel) => panel.id === "variance",
  );
  const sessionLine = clockPanel?.readings.find((line) =>
    line.label.includes("Session length"),
  );
  check(
    sessionLine !== undefined &&
      sessionLine.value === "70 min, median of 3" &&
      sessionLine.verdict === "in",
    "session length is the median of the concluded five captain voyages, and a harbor that sat open for three hours does not move it",
  );
  const stopLine = clockPanel?.readings.find((line) =>
    line.label.includes("stopped before the reveal"),
  );
  check(
    stopLine !== undefined &&
      stopLine.value === "1 of 5, stopping at leg 3 on the median" &&
      stopLine.verdict === "ungated",
    "and where the voyages that stopped early stopped is measured without being judged, since the plan sets no line on it",
  );

  // The lobby fill time, one band at a time. The four seat band holds two
  // voyages twenty minutes apart, so its median is thirty minutes; the
  // six seat band holds one at five; and the five seat record in the
  // window is a harbor that emptied without ever setting sail, which is
  // what a zero start and the emptied outcome together describe. It is in
  // the window and in no band's rate, because seating a voyage that never
  // started at zero minutes would read as a table that filled instantly,
  // and because a band of voyages that did not happen is the one answer
  // this row must not give.
  const fillReading = readDashboard({
    records: [
      dashRecord("dash-f1", {
        seats: 4,
        startedAt: 20 * 60_000,
        endedAt: 60 * 60_000,
      }),
      dashRecord("dash-f2", {
        seats: 4,
        startedAt: 40 * 60_000,
        endedAt: 90 * 60_000,
      }),
      dashRecord("dash-f3", {
        seats: 6,
        startedAt: 5 * 60_000,
        endedAt: 30 * 60_000,
      }),
      dashRecord("dash-f4", {
        seats: 5,
        outcome: "emptied",
        startedAt: 0,
        endedAt: 40 * 60_000,
      }),
    ],
    outcomes: [],
    unreadable: 0,
  });
  const fillPanel = fillReading.panels.find((panel) => panel.id === "variance");
  const fillLine = fillPanel?.readings.find((line) =>
    line.label.includes("Lobby fill time"),
  );
  check(
    fillLine !== undefined &&
      fillLine.value ===
        "4 or fewer seats 30 min of 2; 5 seats none in the window; 6 or more seats 5 min of 1" &&
      fillLine.target === "no threshold in the plan" &&
      fillLine.verdict === "ungated",
    "the lobby fill time reads one band at a time under the deck's own band names, a band that saw no voyage says so rather than reading as a zero, and the row is measured without being judged",
  );
  check(
    fillPanel !== undefined &&
      fillPanel.state === "no reading" &&
      !fillPanel.answer.includes("Lobby fill time") &&
      fillPanel.gaps.some((gap) => gap.includes("voyageLegs")),
    "and a panel whose only measured row is the fill time still says it has nothing to judge, while naming the voyage length as the knob the plan shortens when a session runs long, because a comparison between bands is not one of the sixteen gates",
  );
  const emptyFill = emptyReading.panels
    .flatMap((panel) => panel.readings)
    .find((line) => line.label.includes("Lobby fill time"));
  check(
    emptyFill !== undefined &&
      emptyFill.value === "no voyage in the window" &&
      emptyFill.verdict === "unplayed",
    "while a window with no voyage in it says as much, rather than printing three bands of nothing",
  );

  // ---- The floor ----
  // Retention is read off the two fields goal I2 added to a captain line,
  // and only over the voyages that closed with somebody standing: a
  // harbor that emptied has nobody left to be standing, so its lines
  // cannot answer the question and are left out of the denominator rather
  // than counted as departures.
  const floorReading = readDashboard({
    records: [
      dashRecord("dash-f1", {
        captains: [
          dashLine("dash-f-present-a", { marooned: true }),
          dashLine("dash-f-present-b", { marooned: true }),
          dashLine("dash-f-away", { marooned: true, presentAtEnd: false }),
        ],
      }),
      dashRecord("dash-f2", {
        outcome: "emptied",
        captains: [
          dashLine("dash-f-emptied", {
            marooned: true,
            presentAtEnd: false,
          }),
        ],
      }),
    ],
    outcomes: [
      { alignment: "honest", won: true, seats: 5, bankrupt: false },
      { alignment: "honest", won: false, seats: 5, bankrupt: true },
      { alignment: "pirate", won: false, seats: 5, bankrupt: false },
      { alignment: "broker", won: false, seats: 5, bankrupt: false },
    ],
    unreadable: 0,
  });
  const floorPanel = floorReading.panels.find((panel) => panel.id === "floor");
  const retentionLine = floorPanel?.readings.find((line) =>
    line.label.includes("Marooned captains"),
  );
  check(
    retentionLine !== undefined &&
      retentionLine.value === "66.7% of 3" &&
      retentionLine.verdict === "under",
    "retention is the share of the captains put ashore who were still standing at the close, over the voyages that had a close, and it is judged against the plan's ninety percent",
  );
  const bankruptcyLine = floorPanel?.readings.find((line) =>
    line.label.includes("bankrupt"),
  );
  check(
    bankruptcyLine !== undefined &&
      bankruptcyLine.value === "25.0% of 4" &&
      bankruptcyLine.verdict === "over",
    "and bankruptcy is a share of the chronicle rows in the window rather than of the records, since it is the one launch fact the record does not carry",
  );
  check(
    floorPanel !== undefined && floorPanel.state === "watch",
    "so a floor with two of its gates out of band reads as one to watch rather than as a clear one",
  );
  // The reading is a statement about the mode rather than about the
  // people in it. The captain lines retention is read from carry a user
  // id, and the reduction has to leave it behind: a page that shipped one
  // would be a page an operator could read a captain's voyage off.
  check(
    !JSON.stringify(floorReading).includes("dash-f-present-a"),
    "and nothing in the reading names a captain, since the page is about the mode rather than about who sailed it",
  );

  // ---- The route the page reads ----
  // The page's own check is a convenience that keeps a captain from being
  // shown a dashboard, so the gate is checked here the way the console's
  // is: the server is what has to refuse, against the account row.
  const noBalance = await call<{ error?: string }>("/api/admin/balance");
  check(
    noBalance.status === 401,
    "a stranger asking for the balance reading is refused",
  );
  const captainBalance = await call<{ error?: string }>("/api/admin/balance", {
    cookie: host.cookie,
  });
  check(
    captainBalance.status === 403 &&
      captainBalance.body?.error === "This account is not an administrator.",
    "and a signed in captain is refused in the words the realtime layer uses, so the two surfaces cannot describe one refusal two ways",
  );
  const operatorBalance = await call<{ reading?: DashboardReading }>(
    "/api/admin/balance",
    { cookie: operator.cookie },
  );
  const liveReading = operatorBalance.body?.reading;
  check(
    operatorBalance.status === 200 && liveReading !== undefined,
    "the operator is handed the reading",
  );
  check(
    liveReading !== undefined &&
      liveReading.window.voyages > 0 &&
      liveReading.window.captains > 0,
    "over the Gambit voyages this run recorded rather than over an empty window",
  );
  check(
    liveReading !== undefined &&
      liveReading.panels.map((panel) => panel.id).join(",") ===
        "seat,staples,variance,floor" &&
      liveReading.frontPage.verdict === "unmeasured",
    "carrying the four panels in the plan's order, with the front page number held in its slot",
  );
  check(
    liveReading !== undefined &&
      !JSON.stringify(liveReading).includes(telHome.id),
    "and naming no captain on the wire, exactly as on the page",
  );

  // ---- The page itself ----
  // The route above is the page's only wire, so the last thing to check
  // is that the page is served at all. It is a client component, so what
  // the server sends is the sentence it waits on, which is the one string
  // it can be recognized by before any reading has arrived.
  const balancePage = await fetch(`${BASE}/admin/balance`);
  const balanceHtml = await balancePage.text();
  check(
    balancePage.status === 200 &&
      balanceHtml.includes("Reading the balance..."),
    "GET /admin/balance serves the dashboard page",
  );

  return {
    dashRecord,
    emptyReading,
    floorReading,
    gateLines,
    inBandOutcomes,
    liveReading,
  };
}
