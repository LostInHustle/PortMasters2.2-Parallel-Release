// PortMasters 2.2 Parallel Release, smoke run: The launch gates.

import { db } from "@/lib/db";
import { AUDIT_FROM_ROUND } from "@/lib/game/audit";
import { guideText, tutorialSteps } from "@/lib/game/constants/copy";
import {
  CREW_LOSS_AFTER_HUNGRY_LEGS,
  CREW_NAMES,
} from "@/lib/game/constants/crew";
import { MODULES } from "@/lib/game/constants/drafts";
import {
  COLD_LEG_CHANCE,
  COLD_LEG_WARMTH,
  GARMENTS,
  GARMENT_DECAY_COLD_LEG,
  GARMENT_DECAY_PER_LEG,
  RAG_SCRAP_VALUE,
} from "@/lib/game/constants/garments";
import {
  CARGO_SLOTS,
  FOODS,
  FOODS_DRAW_ORDER,
  LARDER_MAX,
  LARDER_START,
  PRESERVE_MEALS_IN,
  PRESERVE_MEALS_OUT,
  RATION_PRICE,
  SHORT_RATIONS_CARGO,
  SHORT_RATIONS_YIELD,
  STORES_SLOTS,
} from "@/lib/game/constants/supplies";
import { tipsText } from "@/lib/game/constants/tips";
import {
  crewLossRuleOn,
  healCrewIdentity,
  normalizeCrewLost,
  normalizeHungryLegs,
  settleHunger,
} from "@/lib/game/crew";
import type {
  DashboardOutcome,
  DashboardPanel,
  DashboardReading,
  DashboardReadingLine,
  DashboardWindow,
} from "@/lib/game/dashboard";
import { LAUNCH_GATE_IDS, readDashboard } from "@/lib/game/dashboard";
import {
  assignTask,
  hireWorker,
  nextPhase,
  purchaseCard,
  refitsOn,
  startBoonDrafting,
} from "@/lib/game/engine";
import { processProduction } from "@/lib/game/engine/workers";
import {
  bazaarRumorsOn,
  escortContractsOn,
  moduleTradesOn,
  pathDraftOn,
  pathOrdersOn,
  splitHoldOn,
  survivalLayerOn,
} from "@/lib/game/flags";
import {
  addLot,
  drawMeals,
  foodRoomMeals,
  larderMeals,
  mealsOf,
  normalizeLarderLots,
  normalizeLarderSpoilRound,
  pantryLines,
  preserveFood,
  reconcileLarder,
  tickSpoilage,
} from "@/lib/game/foods";
import {
  garmentSpec,
  garmentWarmth,
  garmentsLayerOn,
  isFrostbitten,
  legIsCold,
  normalizeGarments,
  normalizeGarmentsTickRound,
  shortOfWarmth,
  tickGarments,
  warmthScore,
  warmthText,
  wearGarment,
} from "@/lib/game/garments";
import { LAUNCH_MINIMUM_VOYAGES, readLaunchVerdict } from "@/lib/game/gates";
import {
  cargoSlots,
  holdCapacityOn,
  storeRoomMeals,
  storesMealCeiling,
  storesSlots,
  usedCargoSlots,
  usedHoldSlots,
  usedStoreSlots,
} from "@/lib/game/hold";
import {
  cargoCapacity,
  cargoRoom,
  crewSize,
  feedCrew,
  normalizeLarder,
  normalizeLarderFedRound,
  onShortRations,
  provisionFood,
  shortRationsYield,
} from "@/lib/game/larder";
import {
  MODES,
  auditOpensAt,
  modeConfig,
  voyageRoundsFor,
} from "@/lib/game/mode";
import type { TelemetryRecord } from "@/lib/game/telemetry";
import type { GameContext, GameState, Phase, Worker } from "@/lib/game/types";
import { flatWorkerRoster } from "@/lib/game/types";
import {
  CARRIES_A_DASH,
  CLASSIC,
  GAMBIT,
  call,
  carriesADash,
  check,
  openAuthedSocket,
  signUp,
  suffix,
  switchFor,
  voyageState,
  waitForEvent,
  withEnv,
} from "../harness";
import type { WireHistory } from "../wire";
import type { Socket } from "socket.io-client";
import type { SmokeRun } from "../run";

export async function launchGatesSuite(
  run: SmokeRun,
  inputs: {
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
    telHome: { id: string; token: string; cookie: string; username: string };
    telSail: (
      label: string,
      crew: {
        id: string;
        token: string;
        cookie: string;
        username: string;
      }[],
    ) => Promise<{ roomId: string; crewSockets: Socket[] }>;
    telStand: (
      socket: Socket,
      roomId: string,
      round: number,
      phase: Phase,
    ) => Promise<void>;
    telWaitForOne: (roomId: string) => Promise<{
      row: {
        voyageEpoch: number;
        sampleRate: number;
        outcome: string;
        leg: number;
        record: string;
      };
      record: TelemetryRecord | null;
    }>;
  },
): Promise<void> {
  const {
    dashRecord,
    emptyReading,
    floorReading,
    gateLines,
    inBandOutcomes,
    liveReading,
    telHome,
    telSail,
    telStand,
    telWaitForOne,
  } = inputs;
  // Goal I4's ship decision, over the readings the dashboard has just
  // built. The verdict is a reduction with no database behind it, so what
  // is checked here is that it withholds the decision in every way the
  // plan says it must and gives it only over the whole of what the plan
  // asks for. The last two checks are the run's own window, over the wire.
  const emptyVerdict = readLaunchVerdict(emptyReading);
  check(
    emptyVerdict.gates.length === LAUNCH_GATE_IDS.length &&
      emptyVerdict.gates.map((gate) => gate.id).join(",") ===
        LAUNCH_GATE_IDS.join(","),
    "the verdict reads the plan's sixteen gates in the plan's order, whatever state each one is in",
  );
  check(
    LAUNCH_GATE_IDS.every((id) => gateLines.some((line) => line.gate === id)),
    "and every one of them is carried by a row on the page, so a gate the plan lists and the page forgets cannot leave the decision short by one",
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
    "and one voyage short of the plan's three hundred withholds it, because a gate read over fewer is a reading rather than evidence",
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
    "a gate out of band holds the mode, and a failure in the plan's own priority is named as the gate that cannot be traded away when two of them conflict",
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
  // since no captain of it filed a leg report from a split hold; and the
  // charter split, since no captain of it took a charter at the fourth
  // leg.
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
  // and the plan's list agree, which is checked above, and the verdict
  // fails closed on the day they stop: a decision taken over fifteen gates
  // is not the decision the plan asks for.
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
    "and a gate the page stopped carrying withholds the decision rather than being skipped out of it, failing closed on the day the page and the plan disagree",
  );

  // ---- The run's own window ----
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

  // ---- The voyage's length, and the table that sails it ----
  // [I5: session length, and table size] The plan makes the mode's length
  // a configuration restriction rather than a system of its own: the
  // ladder stays the founding mode's, and a mode that runs a different
  // voyage pins its own number on its own record. What is checked here is
  // that the pin is read through the one selector, that the state a
  // captain is handed carries it, that the copy a captain reads quotes
  // the voyage rather than the tier, and that a four captain harbor sails
  // the twelve legs to the end and is paid into the chronicle as a four
  // seat voyage. Four is also the smallest table the mode deals a
  // hidden card into, so the last fixture is the plan's "four has to be
  // genuinely good rather than a degraded mode" read end to end.
  check(
    (["fair_winds", "open_waters", "monsoon"] as const)
      .map((tier) => voyageRoundsFor("classic", tier))
      .join(",") === "8,12,16",
    "the founding mode keeps the tier's ladder, eight legs at Fair Winds and sixteen at Monsoon, so nothing about the base game's length moved",
  );
  check(
    (["fair_winds", "open_waters", "monsoon"] as const).every(
      (tier) => voyageRoundsFor("ocean_gambit", tier) === 12,
    ) &&
      MODES.ocean_gambit.voyageLegs === 12 &&
      MODES.classic.voyageLegs === null,
    "and a Gambit voyage runs twelve legs on every tier, pinned on the mode's own record rather than copied out of the tier beside it",
  );
  check(
    voyageRoundsFor("nonsense", "nonsense") === 8,
    "while a mode and a tier nobody recognises read as the founding voyage's eight legs, the same fallback every other reader of a mode or a tier makes",
  );

  // The state the captain is handed. This is the number the lap, the
  // chronicle row and the integrity ceiling all read, so it is checked
  // where it is minted rather than only where each of them uses it.
  check(
    voyageState({ mode: "ocean_gambit", difficulty: "fair_winds" })
      .maxRounds === 12 &&
      voyageState({ mode: "ocean_gambit", difficulty: "monsoon" }).maxRounds ===
        12 &&
      voyageState({ mode: "classic", difficulty: "fair_winds" }).maxRounds ===
        8,
    "a Gambit voyage is handed twelve legs whatever tier it is charted at, while the founding voyage still sails its tier's own ladder",
  );

  // The copy a captain reads. All three of these quoted the tier before
  // this feature, which was the same number as the voyage until a mode
  // could pin one, and the loan line's round is the voyage's last leg.
  // The wording is the record's, and it counts rounds: a voyage is the
  // whole run, so the guide's objective line is what states its length.
  check(
    guideText("ocean_gambit", "fair_winds").includes(
      "Sail one voyage of 12 rounds",
    ) &&
      tipsText("ocean_gambit", "fair_winds").includes("Round 12") &&
      tutorialSteps("ocean_gambit", "fair_winds")[0]?.content.includes(
        "one voyage of 12 rounds",
      ) &&
      guideText("classic", "fair_winds").includes(
        "Sail one voyage of 8 rounds",
      ) &&
      tipsText("classic", "fair_winds").includes("Round 8"),
    "the guide, the advice and the tutorial quote the voyage's own length, so a twelve round table is never briefed on the eight round voyage its tier would have run",
  );

  // A four captain harbor, sailed to its end. The crew walks the legs the
  // way every harbor walks them, one checkpoint move at a time, and then
  // reports the endgame the way a finished voyage does: currentRound one
  // past the last leg, which is the number the engine's own endgame check
  // crosses. The endgame is a personal phase and never becomes a room
  // checkpoint, so the leg the record carries is the twelfth.
  const sizeHome = await signUp("size_a");
  const sizeMate = await signUp("size_b");
  const sizeThird = await signUp("size_c");
  const sizeFourth = await signUp("size_d");
  run.extraAccounts.push(sizeHome, sizeMate, sizeThird, sizeFourth);
  const sizeRoom = await telSail("four seat", [
    sizeHome,
    sizeMate,
    sizeThird,
    sizeFourth,
  ]);
  const sizeRoomId = sizeRoom.roomId;
  const sizeEnds = waitForEvent<{ roomId?: string }>(
    sizeRoom.crewSockets[0],
    "voyage:reveal",
    (payload) => payload?.roomId === sizeRoomId,
    10000,
  );
  for (let leg = 1; leg <= 12; leg++) {
    await telStand(sizeRoom.crewSockets[0], sizeRoomId, leg, "parley");
  }
  for (const socket of sizeRoom.crewSockets) {
    socket.emit("game:status", {
      roomId: sizeRoomId,
      round: 13,
      phase: "endgame",
      phaseLabel: "Voyage Complete",
      gold: 150,
      reputation: 30,
      shipLevel: 1,
      gameOver: true,
      renownLevel: 3,
      marooned: false,
    });
  }
  await sizeEnds;

  const sizeRow = await telWaitForOne(sizeRoomId);
  const sizeRecord = sizeRow?.record ?? null;
  check(
    sizeRow?.row.outcome === "concluded" &&
      sizeRecord?.mode === "ocean_gambit" &&
      sizeRecord?.seats === 4 &&
      sizeRecord?.endedAtLeg === 12 &&
      sizeRecord?.captains.length === 4,
    "four captains sail a Gambit voyage its twelve legs to the reveal, and the record it leaves carries the four seats it was sailed with and the twelfth leg as the one it ended on",
  );
  const sizeChronicle = await db.voyageChronicle.findMany({
    where: { roomId: sizeRoomId },
    select: { rounds: true, seats: true, mode: true },
  });
  check(
    sizeChronicle.length === 4 &&
      sizeChronicle.every(
        (row) =>
          row.rounds === 12 && row.seats === 4 && row.mode === "ocean_gambit",
      ),
    "and every chronicle row the voyage writes names the twelve legs and the four seats together, which is the pair a later reader groups the four seat band by",
  );

  // ---- The Larder, and the crew that eats from it ----
  // [C1: the Larder and Short Rations] The crew is the artisan roster and
  // the Larder is what it eats: one ration a head a leg, bought at the
  // market, and a shortage when the count reaches zero. Three things are
  // checked here and they are worth naming before the first assertion.
  //
  // The switch is read from both sides inside one run, which is the whole
  // reason survivalLayerOn is not cached. Rollback is the plan's own test
  // of this layer: with the flag off a captain eats nothing, nothing is
  // slower and nothing is drawn, and a suite that could only hold one
  // value would be checking a build the operator is not necessarily
  // running.
  //
  // The reduction is checked through the engine's own settlement rather
  // than beside it. Walking the lap from Orders into Resolve is what
  // every captain does every leg, so if the slowdown only worked when
  // processProduction was called directly, this is where that shows.
  //
  // The buy is checked against both ceilings, because the hold's room and
  // the purse are two different reasons a purchase stops and a store that
  // confused them would sell a captain rations they cannot carry.
  //
  // Everything captain facing that the survival layer produces is dash
  // checked at the end of it, in one place, for the reason the manifest
  // line above is: the house rule covers every string a captain reads, and
  // the log lines these features write are read by the table. The crew's
  // own block below writes into that same accumulator rather than into a
  // second one.
  check(
    [undefined, "", "1", "on", "true", "live", "ON "].every((value) =>
      withEnv(
        "NEXT_PUBLIC_SURVIVAL",
        value,
        switchFor(GAMBIT, survivalLayerOn),
      ),
    ) &&
      ["off", "0", "OFF", " off ", "Off"].every(
        (value) =>
          !withEnv(
            "NEXT_PUBLIC_SURVIVAL",
            value,
            switchFor(GAMBIT, survivalLayerOn),
          ),
      ),
    "the provisions layer is on for every value except the word off and the digit zero, so a typo in the switch leaves the game playable rather than quietly deleting a system",
  );

  // [The mode boundary] And the other half of every switch's answer, held
  // here rather than inside each family's own block.
  //
  // The families below each check their own switch against the
  // environment, because that is the dial their slice of the plan
  // promised. What none of them can check is the rule that stands in
  // front of all ten, because the rule is about them together: Classic
  // is the shipped release and no system this branch added may reach it,
  // whatever an operator exported into the process. A check written per
  // family would be ten copies of one sentence, and the tenth is the one
  // a later feature would forget.
  //
  // So the ten are listed once, with the environment forced on rather
  // than left to whatever the runner exported, and every one of them has
  // to answer no in the shipped mode. The environment value is a real one
  // rather than undefined on purpose: a switch that answered no here
  // because the runner happened to leave the variable unset would be a
  // check that passes for the wrong reason.
  check(
    (
      [
        ["NEXT_PUBLIC_SURVIVAL", survivalLayerOn],
        ["NEXT_PUBLIC_CREW_LOSS", crewLossRuleOn],
        ["NEXT_PUBLIC_GARMENTS", garmentsLayerOn],
        ["NEXT_PUBLIC_SPLIT_HOLD", splitHoldOn],
        ["NEXT_PUBLIC_PATH_ORDERS", pathOrdersOn],
        ["NEXT_PUBLIC_ESCORT_CONTRACTS", escortContractsOn],
        ["NEXT_PUBLIC_REFITS", refitsOn],
        ["NEXT_PUBLIC_BAZAAR", bazaarRumorsOn],
        ["NEXT_PUBLIC_PATH_DRAFT", pathDraftOn],
        ["NEXT_PUBLIC_MODULE_TRADES", moduleTradesOn],
      ] as ReadonlyArray<[string, (mode: unknown) => boolean]>
    ).every(
      ([name, read]) =>
        withEnv(name, "1", () => read(CLASSIC) === false) &&
        withEnv(name, undefined, () => read(CLASSIC) === false) &&
        withEnv(name, "1", () => read(GAMBIT) === true),
    ),
    "every switch of this release answers no in the shipped mode whatever the environment says, and yes in the mode that owns it: the boundary is the mode rather than the operator's export, so a deployment serving both harbors cannot hand a Classic table a system the mode does not have",
  );

  // The same boundary for the systems that have no switch of their own,
  // because they are gated by the mode record rather than by a dial: the
  // audit's rung, the standing order and the leg clock. A rung of null is
  // the whole of the first, and the two booleans below are the whole of
  // the other two.
  check(
    auditOpensAt(CLASSIC) === null &&
      auditOpensAt(GAMBIT) === AUDIT_FROM_ROUND &&
      modeConfig(CLASSIC).standingOrders === false &&
      modeConfig(GAMBIT).standingOrders === true &&
      modeConfig(CLASSIC).phaseClock === false &&
      modeConfig(GAMBIT).phaseClock === true &&
      modeConfig(CLASSIC).gambitSystems === false &&
      modeConfig(GAMBIT).gambitSystems === true,
    "the systems with no switch of their own go off with the mode as well: the shipped voyage opens no manifest, keeps no standing order and runs on no clock, and both records carry the two rungs they gate and the boundary every switch reads",
  );

  // Held on for every rule below, so this block reads the same rules
  // whatever the operator set at the door.
  const survivalLines: string[] = [];
  withEnv("NEXT_PUBLIC_SURVIVAL", "1", () => {
    const larderCrew = voyageState();
    larderCrew.money = 1000;
    check(
      crewSize(larderCrew) === 0 && !onShortRations(larderCrew),
      "a fresh captain has nobody aboard, and an empty larder over an empty roster is not a shortage: there is nobody going without",
    );
    hireWorker(larderCrew, "weaver", survivalLines);
    hireWorker(larderCrew, "weaver", survivalLines);
    check(
      crewSize(larderCrew) === 2 &&
        flatWorkerRoster(larderCrew).length === crewSize(larderCrew) &&
        larderCrew.workers.weaver.length === 2,
      "hiring artisans is what puts a crew aboard, counted through the one helper that flattens the roster rather than in a second place that could disagree with it",
    );

    // Eating, once a leg. The stamp is what makes "once" true rather than
    // hopeful, and the check is written as a second call in the same leg
    // because that is the shape of the defect it prevents: a leg opens
    // through more than one path, and charging a captain twice for one
    // leg is silent in every screen.
    larderCrew.larder = 10;
    larderCrew.currentRound = 3;
    feedCrew(larderCrew, survivalLines);
    feedCrew(larderCrew, survivalLines);
    const ateOnce = larderCrew.larder === 8 && larderCrew.larderFedRound === 3;
    larderCrew.currentRound = 4;
    feedCrew(larderCrew, survivalLines);
    check(
      ateOnce && larderCrew.larder === 6 && larderCrew.larderFedRound === 4,
      "the crew eats one ration a head and the leg is stamped, so a second call in the same leg eats nothing more while the next leg eats again",
    );

    // The floor, and the line that says so. A larder the crew emptied
    // reads as empty rather than in debt, and the leg the shortage begins
    // is the one that says it.
    larderCrew.larder = 1;
    larderCrew.currentRound = 5;
    const shortLines: string[] = [];
    feedCrew(larderCrew, shortLines);
    survivalLines.push(...shortLines);
    check(
      larderCrew.larder === 0 &&
        onShortRations(larderCrew) &&
        shortLines.length === 1 &&
        shortLines[0].includes("Short rations") &&
        shortLines[0].includes(`${Math.round(SHORT_RATIONS_YIELD * 100)}%`) &&
        !CARRIES_A_DASH.test(shortLines[0]),
      "a larder the crew empties reads as empty rather than in debt, and the leg announces the shortage at the pace the rule actually applies",
    );

    check(
      shortRationsYield(6) === 3 &&
        shortRationsYield(4) === 2 &&
        shortRationsYield(3) === 1 &&
        shortRationsYield(2) === 1 &&
        shortRationsYield(1) === 1 &&
        shortRationsYield(0) === 1,
      "a hungry crew works at half pace, floored at one item, because a task spends its recipe when it is assigned and a yield that rounded away to nothing would take the goods and return silence",
    );

    // The reduction through the engine's own lap. Three workshops walked
    // from Orders into Resolve with the same artisan and the same
    // materials, so the only difference between any two holds is the one
    // being read: the larder for the first pair, and the module for the
    // second. The third is hungry as well as equipped, because what it
    // settles is that the module's bonus is applied before the shortage
    // takes its share rather than after, and a fed workshop would settle
    // nothing about the order the two run in.
    const larderCtx: GameContext = {
      seedBase: `smoke:larder:${suffix}`,
      harborId: `smoke-larder-${suffix}`,
    };
    const shops: Array<{ state: GameState; label: string }> = [];
    for (const label of ["fed", "hungry", "workshop"]) {
      const state = voyageState();
      state.money = 1000;
      hireWorker(state, "weaver", []);
      state.workers.weaver[0].isSkilled = true;
      if (label === "workshop") {
        const workshop = MODULES.find((m) => m.id === "artisans_workshop");
        if (workshop) state.equippedModules.push(workshop);
      }
      assignTask(state, "weaver", "Linen Clothes", []);
      state.phase = "orders";
      // Every workshop but the fed one goes into the leg with an empty
      // larder, so the shortage is the state under test rather than a
      // side effect of how much the crew happened to have.
      state.larder = label === "fed" ? LARDER_START : 0;
      shops.push({ state, label });
    }
    const before = shops.map(
      (shop) => shop.state.inventory["Linen Clothes"] ?? 0,
    );
    // Pressed until the books are settled rather than pressed once, because
    // which phase follows Orders is the mode's own decision: the founding
    // lap goes straight from the manifest to the settlement, and the lap
    // this layer belongs to puts the exchange between them. A single press
    // would walk one of those two modes into a leg that makes nothing and
    // the check would read the empty hold as the rule under test. The bound
    // is the longest lap plus a margin, and it is a bound rather than a
    // count so that a lap that grows a leg still walks.
    for (const shop of shops) {
      for (let step = 0; step < 8 && shop.state.phase !== "resolve"; step++) {
        nextPhase(shop.state, larderCtx, []);
      }
    }
    const made = shops.map(
      (shop, index) =>
        (shop.state.inventory["Linen Clothes"] ?? 0) - before[index],
    );
    check(
      made[0] === 2 && made[1] === 1,
      "walking the lap into Resolve makes a skilled artisan's two goods while the crew is fed and one while it is not, so the plan's slower crafting lands through the engine every captain already walks rather than beside it",
    );
    check(
      made[2] === 1,
      "and an Artisan's Workshop's third good is halved to one as well, so the module's bonus is applied before the shortage takes its share rather than after",
    );

    // Buying. Two ceilings and a floor, each read on its own state so one
    // cannot be mistaken for another.
    const buyer = voyageState();
    buyer.money = 1000;
    hireWorker(buyer, "weaver", []);
    hireWorker(buyer, "weaver", []);
    // Emptied first, because a fresh voyage is handed a full opening hold
    // (see LARDER_START) and what this check is about is what a purchase
    // adds to it rather than what it was already carrying.
    buyer.larder = 0;
    const buyLines: string[] = [];
    const boughtLegs = provisionFood(buyer, "Grain", 2, buyLines);
    check(
      boughtLegs === 2 &&
        buyer.larder === 4 &&
        buyer.money === 1000 - 4 * RATION_PRICE &&
        buyer.roundCosts === 4 * RATION_PRICE &&
        buyer.totalCosts === 4 * RATION_PRICE &&
        // The panel's own read of what still fits, made the way the panel
        // makes it: the stores' room for the food being bought, over the
        // crew it has to feed.
        Math.floor(foodRoomMeals(buyer, "Grain") / crewSize(buyer)) === 28,
      "provisioning buys a leg at a time for the crew aboard, and what it spends is booked where every other purchase is booked",
    );
    const filledRoom = Math.floor(
      foodRoomMeals(buyer, "Grain") / crewSize(buyer),
    );
    const filledLegs = provisionFood(buyer, "Grain", 999, buyLines);
    check(
      filledLegs === filledRoom &&
        buyer.larder === LARDER_MAX &&
        provisionFood(buyer, "Grain", 1, buyLines) === 0 &&
        buyLines[buyLines.length - 1] === "🧺 The larder is full.",
      "a request past the hold's room fills it and stops there, and a full larder says so rather than taking a press and returning nothing",
    );

    const thin = voyageState();
    thin.money = 100;
    hireWorker(thin, "weaver", []);
    thin.money = 1;
    const thinLines: string[] = [];
    check(
      provisionFood(thin, "Grain", 1, thinLines) === 0 && thin.money === 1,
      "and a purse that cannot cover one leg of rations buys nothing rather than going into debt for it",
    );
    const crewless = voyageState();
    crewless.money = 100;
    const crewlessLines: string[] = [];
    check(
      provisionFood(crewless, "Grain", 1, crewlessLines) === 0 &&
        crewSize(crewless) === 0 &&
        crewlessLines.length === 1,
      "while a captain with nobody aboard has nothing to provision and is told so in one line, which is the same answer that case already gives a buyer",
    );

    // Every line this block produced, gathered here rather than threaded
    // through each check, since the dash rule is about the whole set.
    survivalLines.push(...buyLines, ...thinLines, ...crewlessLines);

    // A save read back. The end a count is clamped to is the hold the
    // build is actually running, which [C4] moved: the stores' own
    // ceiling under the split and the Larder's old sixty without it. The
    // check reads that end from the model rather than writing it down,
    // so it follows the hold rather than a number the split left behind.
    const larderEnd = holdCapacityOn(GAMBIT) ? storesMealCeiling() : LARDER_MAX;
    check(
      normalizeLarder(undefined, GAMBIT) === LARDER_START &&
        normalizeLarder("seven", GAMBIT) === LARDER_START &&
        normalizeLarder(NaN, GAMBIT) === LARDER_START &&
        normalizeLarder(7.8, GAMBIT) === 7 &&
        normalizeLarder(-4, GAMBIT) === 0 &&
        normalizeLarder(larderEnd + 90, GAMBIT) === larderEnd &&
        normalizeLarderFedRound(undefined) === 0 &&
        normalizeLarderFedRound(-2) === 0 &&
        normalizeLarderFedRound(2.5) === 2,
      "a save this build cannot read heals to a full hold rather than to a hungry one, a count outside the hold's ends is clamped rather than dropped, and a missing leg stamp lands on a leg no voyage has",
    );
  });

  // ---- The crew, by name ----
  // [C2: crew loss by name] Two legs hungry in a row cost the newest hand
  // aboard, by name and for good. Three things are checked here, and they
  // are worth naming before the first assertion.
  //
  // The run is counted rather than reconstructed, so it is checked the way
  // it is advanced: one call a leg, with the reset read on both sides of
  // it. The leg the crew eats in between is the one that matters, because
  // a run that counted hungry legs ever rather than in a row would pass
  // every other check down here and still take a hand from a captain who
  // provisioned through the shortage.
  //
  // The victim is a rule rather than a roll, and the rule is the newest
  // aboard, so the check reads the two names apart rather than the count
  // down: a roster of two that loses a member says nothing about which
  // hand went.
  //
  // The tick is checked through the engine's own Dawn rather than beside
  // it, for the reason the Larder's reduction is checked through the lap.
  // startBoonDrafting is the one function every leg opens through, and a
  // price that only landed when settleHunger was called directly is
  // exactly the defect a check that called it directly would miss. The
  // second call in the same leg is in there because that is the shape of
  // the defect it prevents: a leg opens through more than one path.
  //
  // And a save written before any of this existed is read back, because
  // every voyage in flight the day this ships is one of those. The roster
  // has to heal to named hands rather than to blanks, and the two new
  // fields have to heal to the state of a captain who never went hungry.
  check(
    [undefined, "", "1", "on", "true", "live", "ON "].every((value) =>
      withEnv(
        "NEXT_PUBLIC_CREW_LOSS",
        value,
        switchFor(GAMBIT, crewLossRuleOn),
      ),
    ) &&
      ["off", "0", "OFF", " off ", "Off"].every(
        (value) =>
          !withEnv(
            "NEXT_PUBLIC_CREW_LOSS",
            value,
            switchFor(GAMBIT, crewLossRuleOn),
          ),
      ),
    "the crew loss rule is on for every value except the word off and the digit zero, read through the same policy the provisions layer is read through rather than through a second copy of it",
  );

  withEnv("NEXT_PUBLIC_SURVIVAL", "1", () =>
    withEnv("NEXT_PUBLIC_CREW_LOSS", "1", () => {
      // The pool the names come out of, checked before the rule that
      // spends it: a duplicate or a two word name in here is damage no
      // rule below could produce, and every roster of every voyage would
      // inherit it.
      check(
        CREW_NAMES.length > 0 &&
          CREW_NAMES.every((name) => /^[A-Za-z]+$/.test(name)) &&
          new Set(CREW_NAMES).size === CREW_NAMES.length,
        "every name the crew is drawn from is one word of letters and no name appears twice, so a hand can be named in a line the table reads and the pool itself cannot hand two hands one name",
      );

      // The run, the hand, and the ledger. The round is set rather than
      // inherited, so the leg on the record is a number this check chose
      // and a record that wrote the wrong one cannot pass.
      const hungry = voyageState();
      hungry.money = 1000;
      hungry.currentRound = 7;
      hireWorker(hungry, "weaver", survivalLines);
      hireWorker(hungry, "weaver", survivalLines);
      const longestAboard = hungry.workers.weaver[0].name;
      const newestAboard = hungry.workers.weaver[1].name;
      hungry.larder = 0;
      const lossLines: string[] = [];
      settleHunger(hungry, lossLines);
      const oneLegIn = hungry.hungryLegs === 1 && hungry.crewLost.length === 0;
      settleHunger(hungry, lossLines);
      survivalLines.push(...lossLines);
      check(
        oneLegIn &&
          hungry.hungryLegs === 0 &&
          hungry.crewLost.length === 1 &&
          hungry.crewLost[0].name === newestAboard &&
          hungry.crewLost[0].round === 7 &&
          hungry.workers.weaver.length === 1 &&
          hungry.workers.weaver[0].name === longestAboard &&
          lossLines.some((line) => line.includes(newestAboard)) &&
          lossLines.some((line) =>
            line.includes(`${CREW_LOSS_AFTER_HUNGRY_LEGS} legs`),
          ),
        "the second leg hungry in a row takes the newest hand aboard by name, writes the leg it happened on beside them, resets the run and says so, while the artisan who was already at the bench keeps it",
      );

      // A name once spent is not handed out again while the voyage
      // remembers it, the lost as much as the living, and the hand who
      // replaces them is the newest aboard for the next loss.
      hireWorker(hungry, "weaver", survivalLines);
      const aboard = flatWorkerRoster(hungry).map((worker) => worker.name);
      const remembered = hungry.crewLost.map((loss) => loss.name);
      const replacement =
        hungry.workers.weaver[hungry.workers.weaver.length - 1];
      check(
        aboard.length === 2 &&
          aboard.every((name) => CREW_NAMES.includes(name)) &&
          new Set([...aboard, ...remembered]).size ===
            aboard.length + remembered.length &&
          replacement.seq > hungry.workers.weaver[0].seq,
        "a name this voyage has already spent is not handed to the next hire, and the hand who joins is the newest aboard, so the one lost over the side is not quietly replaced by a stranger wearing their name",
      );

      // A fed leg resets the run rather than pausing it.
      const fed = voyageState();
      fed.money = 1000;
      hireWorker(fed, "weaver", survivalLines);
      fed.larder = 0;
      settleHunger(fed, []);
      fed.larder = 4;
      settleHunger(fed, []);
      const afterMeal = fed.hungryLegs === 0;
      fed.larder = 0;
      settleHunger(fed, []);
      check(
        afterMeal &&
          fed.hungryLegs === 1 &&
          fed.crewLost.length === 0 &&
          fed.workers.weaver.length === 1,
        "a leg the crew eats resets the run, so hunger that a purchase breaks and then lets return counts again from the first bad leg rather than taking a hand for a shortage the captain already provisioned through",
      );

      // The price is settled at the one moment the leg's meal is, through
      // the function every leg opens through.
      const dawn = voyageState();
      dawn.money = 1000;
      hireWorker(dawn, "weaver", survivalLines);
      dawn.larder = 0;
      startBoonDrafting(dawn, []);
      startBoonDrafting(dawn, []);
      const onceALeg = dawn.hungryLegs === 1 && dawn.crewLost.length === 0;
      dawn.currentRound += 1;
      startBoonDrafting(dawn, []);
      check(
        onceALeg &&
          dawn.hungryLegs === 0 &&
          dawn.crewLost.length === 1 &&
          dawn.workers.weaver.length === 0,
        "the run advances at the one moment a leg's meal is settled, so a Dawn a client reaches twice charges one leg of hunger once and the next leg is the one that takes the hand",
      );

      // A save written before the crew had names. Every member is written
      // the way the build before this one wrote them: no identity at all.
      const legacy = voyageState();
      legacy.money = 1000;
      hireWorker(legacy, "weaver", []);
      hireWorker(legacy, "potter", []);
      for (const worker of flatWorkerRoster(legacy)) {
        delete (worker as Partial<Worker>).name;
        delete (worker as Partial<Worker>).seq;
      }
      legacy.hungryLegs = Number.NaN;
      healCrewIdentity(legacy);
      const healed = flatWorkerRoster(legacy);
      check(
        healed.length === 2 &&
          healed.every(
            (worker) =>
              CREW_NAMES.includes(worker.name) &&
              Number.isInteger(worker.seq) &&
              worker.seq >= 1,
          ) &&
          new Set(healed.map((worker) => worker.name)).size === 2 &&
          new Set(healed.map((worker) => worker.seq)).size === 2 &&
          legacy.hungryLegs === 0 &&
          legacy.crewLost.length === 0,
        "a save written before the crew had names heals to a roster of people rather than of blanks, each with a name from the pool and a number of their own, and a run it cannot read heals to nobody hungry yet",
      );

      // Two hands claiming one name, which the draw exists to prevent and
      // a hand written save can still produce.
      const twins = voyageState();
      twins.money = 1000;
      hireWorker(twins, "weaver", survivalLines);
      hireWorker(twins, "weaver", survivalLines);
      const claimant = twins.workers.weaver[0].name;
      twins.workers.weaver[1].name = claimant;
      healCrewIdentity(twins);
      check(
        twins.workers.weaver[0].name === claimant &&
          twins.workers.weaver[1].name !== claimant &&
          CREW_NAMES.includes(twins.workers.weaver[1].name) &&
          twins.workers.weaver[0].seq !== twins.workers.weaver[1].seq,
        "a stored name is kept rather than redrawn, and two hands claiming one name resolve to one claimant and one fresh draw, since a roster of two people called Ada is exactly what the draw is for",
      );

      check(
        normalizeHungryLegs(undefined) === 0 &&
          normalizeHungryLegs(Number.NaN) === 0 &&
          normalizeHungryLegs(-3) === 0 &&
          normalizeHungryLegs(2.9) === 2 &&
          normalizeCrewLost(undefined).length === 0 &&
          normalizeCrewLost("Runa").length === 0 &&
          normalizeCrewLost([{ name: "Runa", round: 4.8 }, null, 7, {}])
            .length === 1 &&
          normalizeCrewLost([{ name: "Runa", round: 4.8 }])[0].round === 4,
        "a run or a record of losses this build cannot read heals to none rather than to an invented hand, while a loss that does name one survives the read with the leg it was taken on",
      );

      // The same two legs with the rule switched off, read inside the
      // layer that is on. Read anywhere else this check would pass for the
      // wrong reason: with the provisions off there is no shortage to lose
      // anyone to, and the check would be measuring that instead.
      check(
        withEnv("NEXT_PUBLIC_CREW_LOSS", "off", () => {
          const spared = voyageState();
          spared.money = 1000;
          hireWorker(spared, "weaver", []);
          spared.larder = 0;
          const sparedLines: string[] = [];
          settleHunger(spared, sparedLines);
          settleHunger(spared, sparedLines);
          return (
            !crewLossRuleOn(GAMBIT) &&
            spared.hungryLegs === 0 &&
            spared.crewLost.length === 0 &&
            spared.workers.weaver.length === 1 &&
            spared.workers.weaver[0].name.length > 0 &&
            sparedLines.length === 0
          );
        }),
        "with the loss rule switched off hunger never takes a hand: the run stays at zero, the record stays empty and no line is spoken, while the roster keeps the names it already carries, so the rule can be rolled back without erasing anyone",
      );

      // And the layer governs it from above, which is why the two switches
      // are separate readings rather than one.
      check(
        withEnv("NEXT_PUBLIC_SURVIVAL", "off", () => {
          const unfed = voyageState();
          unfed.money = 1000;
          hireWorker(unfed, "weaver", []);
          unfed.larder = 0;
          settleHunger(unfed, []);
          settleHunger(unfed, []);
          return (
            crewLossRuleOn(GAMBIT) &&
            unfed.hungryLegs === 0 &&
            unfed.crewLost.length === 0 &&
            unfed.workers.weaver.length === 1
          );
        }),
        "and with the provisions switched off a captain loses nobody whatever the loss rule says, because a shortage the layer is not counting is not a shortage a hand can be taken for",
      );
    }),
  );

  // The two files this feature owns, read as files rather than asserted
  // about, so the rule covers their comments as well as the lines they
  // write. It is the same reading the standing order record and the
  // voyage log are held to, and it is the one check down here that no
  // runtime case can make.
  check(
    !carriesADash("src/lib/game/crew.ts") &&
      !carriesADash("src/lib/use-game-session.ts") &&
      !carriesADash("src/components/portmasters/game/phases/WorkerMgmt.tsx") &&
      !carriesADash("src/components/portmasters/game/phases/Endgame.tsx"),
    "and the module the rule lives in, the hook that heals a voyage on load and the two panels a captain reads the crew on hold the house rule in their comments as well as in their code",
  );

  // The other side of the switch, read on its own so the check above can
  // stay about the rules rather than about the flag.
  check(
    withEnv("NEXT_PUBLIC_SURVIVAL", "off", () => {
      const dark = voyageState();
      dark.money = 100;
      hireWorker(dark, "weaver", []);
      dark.larder = 0;
      const darkLines: string[] = [];
      feedCrew(dark, darkLines);
      const boughtNothing = provisionFood(dark, "Grain", 3, darkLines) === 0;
      return (
        !survivalLayerOn(GAMBIT) &&
        !onShortRations(dark) &&
        dark.larder === 0 &&
        dark.larderFedRound === 0 &&
        dark.money === 100 &&
        boughtNothing &&
        darkLines.length === 0
      );
    }),
    "with the switch off nothing is eaten, nothing is bought, no leg is stamped and no shortage is claimed, so the base game is exactly as it was",
  );

  // The fleet sees a hungry crew. The plan asks for the state to be
  // publicly visible and its implementation clause says the visibility
  // rides the status broadcast the room already carries, so what is
  // checked here is the frame every captain is already listening to
  // rather than a channel built for this. A fed crew reports no mark at
  // all, which is the allow list read run the other way: only an
  // explicit true is a hungry crew, so a client that never had a larder
  // reads as fed rather than as unknown.
  const larderHome = await signUp("lard_h");
  run.extraAccounts.push(larderHome);
  const larderRoom = await call<{ room: { id: string; code: string } }>(
    "/api/rooms",
    {
      method: "POST",
      cookie: larderHome.cookie,
      body: JSON.stringify({
        name: `Smoke larder ${suffix}`,
        isPublic: false,
      }),
    },
  );
  if (larderRoom.status !== 200) {
    throw new Error("No harbor to report a hungry crew in.");
  }
  const larderRoomId = larderRoom.body.room.id;
  const larderSocket = await openAuthedSocket(larderHome);
  run.sockets.push(larderSocket);
  const larderSeated = waitForEvent<WireHistory>(
    larderSocket,
    "chat:history",
    (payload) => payload?.roomId === larderRoomId,
  );
  larderSocket.emit("room:join", { roomId: larderRoomId });
  await larderSeated;

  const larderFrames: Array<{ shortRations?: boolean }> = [];
  larderSocket.on(
    "game:status",
    (payload: { user?: { id?: string }; shortRations?: boolean }) => {
      if (payload?.user?.id !== larderHome.id) return;
      larderFrames.push(payload);
    },
  );
  const reportLarder = (shortRations: boolean) => {
    larderSocket.emit("game:status", {
      roomId: larderRoomId,
      round: 1,
      phase: "market",
      phaseLabel: "Market",
      gold: 100,
      reputation: 0,
      shipLevel: 0,
      gameOver: false,
      shortRations,
    });
  };
  reportLarder(true);
  await new Promise((resolve) => setTimeout(resolve, 400));
  reportLarder(false);
  await new Promise((resolve) => setTimeout(resolve, 400));
  check(
    larderFrames.length === 2 &&
      larderFrames[0].shortRations === true &&
      larderFrames[1].shortRations === undefined,
    "a hungry crew reaches the fleet on the status frame every captain already listens to, and a fed one reports no mark at all",
  );

  // ---- The clothes, and the cold ----
  // [C3: garments and the cold] One data model for three jobs: a garment
  // is a good with a warmth rating and a durability, a leg carries a
  // weather tag, and the check between them decides who freezes. Four
  // things about that are worth naming before the first assertion.
  //
  // The tag is drawn rather than stored, so what is checked is that it
  // belongs to the room rather than to a captain: the same voyage answers
  // the same way on every read, two captains holding different goods read
  // the same leg the same way, and a save carried through a round trip
  // answers it the same way again. That is what lets the forecast be read
  // in the browser with no wire field behind it and no clock in it.
  //
  // The check is read on both sides of its own line. A rule that only ever
  // bit or only ever spared would pass every other check down here, so one
  // cold leg is sailed twice, once bare and once dressed, and the two
  // voyages have to come out differently.
  //
  // The decay is read in the units the plan gives it and read twice in one
  // leg, because a leg opens through more than one path and a wardrobe
  // that decayed twice for one leg is a durability bar the player cannot
  // see moving.
  //
  // And the whole thing is walked once through the engine's own Resolve,
  // for the reason the Larder's reduction is walked through the lap: the
  // plan puts the tick inside settlement on the deterministic resolve
  // step, and a tick that only landed when it was called by name is
  // exactly the defect that check exists to catch.
  check(
    [undefined, "", "1", "on", "true", "live", "ON "].every((value) =>
      withEnv(
        "NEXT_PUBLIC_GARMENTS",
        value,
        switchFor(GAMBIT, garmentsLayerOn),
      ),
    ) &&
      ["off", "0", "OFF", " off ", "Off"].every(
        (value) =>
          !withEnv(
            "NEXT_PUBLIC_GARMENTS",
            value,
            switchFor(GAMBIT, garmentsLayerOn),
          ),
      ),
    "the garments layer is on for every value except the word off and the digit zero, read through the same policy the two switches above it are read through rather than through a third copy of it",
  );

  withEnv("NEXT_PUBLIC_SURVIVAL", "1", () =>
    withEnv("NEXT_PUBLIC_GARMENTS", "1", () => {
      // The catalogue, before any rule that reads it.
      check(
        Object.keys(GARMENTS).length === 3 &&
          GARMENTS["Linen Clothes"].warmth === 1 &&
          GARMENTS["Linen Clothes"].durability === 6 &&
          GARMENTS["Cotton Clothes"].warmth === 2 &&
          GARMENTS["Cotton Clothes"].durability === 8 &&
          GARMENTS.Brocade.warmth === 3 &&
          GARMENTS.Brocade.durability === 10,
        "the three garments carry the plan's own numbers, one warmth with six of durability, two with eight and three with ten, and nothing else in the tree is clothes",
      );
      check(
        garmentSpec("Brocade") !== null &&
          garmentSpec("Linen") === null &&
          garmentSpec("toString") === null &&
          garmentSpec(7) === null &&
          garmentWarmth(null) === 0 &&
          garmentWarmth({ good: "Sachet", durability: 9 }) === 0,
        "and a good is read as a garment only when the catalogue says so, so a save naming a raw material, a key the object's prototype happens to carry, or the one finished good the plan leaves out is read as a captain with nothing on rather than as warmth nobody can account for",
      );

      // Wearing, and the ways it refuses, on a leg that is actually asking
      // for warmth: the cold round is found by asking the rule rather than
      // written down as a number that was cold once, the same way the
      // weather checks below find theirs. The hire writes into a throwaway
      // log so the lines counted below are the wardrobe's own.
      const wardrobe = voyageState();
      wardrobe.money = 1000;
      for (let round = 1; round <= 60 && !legIsCold(wardrobe); round++) {
        wardrobe.currentRound = round;
      }
      const dressLines: string[] = [];
      const crewless = wearGarment(wardrobe, "Brocade", dressLines) === false;
      hireWorker(wardrobe, "weaver", []);
      const emptyHold = wearGarment(wardrobe, "Brocade", dressLines) === false;
      wardrobe.inventory.Brocade = 2;
      const notClothes = wearGarment(wardrobe, "Linen", dressLines) === false;
      const wornNow = wearGarment(wardrobe, "Brocade", dressLines);
      check(
        crewless &&
          emptyHold &&
          notClothes &&
          wornNow &&
          wardrobe.inventory.Brocade === 1 &&
          wardrobe.garments.length === 1 &&
          wardrobe.garments[0].good === "Brocade" &&
          wardrobe.garments[0].durability === GARMENTS.Brocade.durability &&
          dressLines.length === 4 &&
          dressLines[3].includes(`Warmth ${GARMENTS.Brocade.warmth}`),
        "putting a garment on takes it out of the hold and onto the crew at its full durability, and the three ways it can fail each say why: nobody aboard, nothing of that good in the hold, or a good that is not clothing at all",
      );

      // The two presses the need rule turns away, which the field asked
      // for after closets walked onto backs no cold had asked about: a
      // crew the cold leg is already answered for, and a crew the sea is
      // not asking anything of at all. Neither spends a stitch.
      const dressedAgain =
        wearGarment(wardrobe, "Brocade", dressLines) === false;
      const mildDress = voyageState();
      mildDress.money = 1000;
      for (let round = 1; round <= 60 && legIsCold(mildDress); round++) {
        mildDress.currentRound = round;
      }
      hireWorker(mildDress, "weaver", []);
      mildDress.inventory["Linen Clothes"] = 1;
      const mildLines: string[] = [];
      const mildRefused =
        wearGarment(mildDress, "Linen Clothes", mildLines) === false;
      check(
        dressedAgain &&
          wardrobe.inventory.Brocade === 1 &&
          wardrobe.garments.length === 1 &&
          dressLines.length === 5 &&
          dressLines[4].includes("already meets this cold leg") &&
          mildRefused &&
          mildDress.inventory["Linen Clothes"] === 1 &&
          (mildDress.garments ?? []).length === 0 &&
          mildLines.length === 1 &&
          mildLines[0].includes("mild this leg") &&
          !shortOfWarmth(mildDress),
        "while a crew the leg is not asking about is left in the hold exactly as found: a second press on a cold leg already answered and a press on a mild leg are each turned away with the reason the wardrobe is shut, so clothes stop walking onto backs for legs that asked for nothing and the hold keeps what it carried",
      );

      // The sum, and the multiplier under it. The wardrobe is set rather
      // than dressed on, because dressing a crew past the leg's own cold
      // is exactly what the need check above turns away: this fixture is
      // about the arithmetic rather than about the way in.
      const tailor = voyageState();
      tailor.money = 1000;
      hireWorker(tailor, "weaver", []);
      tailor.garments = [
        {
          good: "Linen Clothes",
          durability: GARMENTS["Linen Clothes"].durability,
        },
        {
          good: "Cotton Clothes",
          durability: GARMENTS["Cotton Clothes"].durability,
        },
        { good: "Brocade", durability: GARMENTS.Brocade.durability },
      ];
      const aWholeBack = warmthScore(tailor) === 1 + 2 + 3;
      tailor.garments[1].durability = 4;
      tailor.garments[2].durability = 8;
      const partWorn = warmthScore(tailor);
      check(
        aWholeBack &&
          warmthText(warmthScore(voyageState())) === "0" &&
          Math.abs(garmentWarmth(tailor.garments[2]) - 2.4) < 1e-9 &&
          Math.abs(partWorn - 4.4) < 1e-9 &&
          warmthText(partWorn) === "4.4",
        "the warmth score is the plan's sum, one and two and three for a whole back and four and four tenths once the sea has had part of two of them, because a garment is worth its rating times the fraction of itself that is left rather than a number that steps down a rung at a time",
      );

      // The tag: drawn, deterministic, room wide and replayable.
      const weather = voyageState();
      weather.voyageEpoch = 4242;
      weather.currentRound = 4;
      const thisLeg = legIsCold(weather);
      const mate = voyageState();
      mate.voyageEpoch = 4242;
      mate.currentRound = 4;
      mate.money = 77;
      mate.score = 19;
      mate.inventory.Brocade = 3;
      hireWorker(mate, "potter", []);
      const recalled = JSON.parse(JSON.stringify(weather)) as GameState;
      check(
        legIsCold(weather) === thisLeg &&
          legIsCold(mate) === thisLeg &&
          legIsCold(recalled) === thisLeg,
        "the leg's weather is drawn rather than stored: the same voyage answers the same way on every read, a second captain holding different goods and a different purse reads the same leg the same way, and a save carried through a round trip answers it the same way again",
      );
      // Over a hundred legs of one voyage the draw has to be a rate rather
      // than a rule, so the count is read against the chance the constants
      // file states rather than against a number written down here. The
      // bounds are wide enough to hold the rate and far too narrow to hold
      // a tag that always says the same thing.
      const weatherRun = voyageState();
      weatherRun.voyageEpoch = 4242;
      let coldLegs = 0;
      for (let leg = 1; leg <= 100; leg++) {
        weatherRun.currentRound = leg;
        if (legIsCold(weatherRun)) coldLegs++;
      }
      check(
        coldLegs >= 100 * COLD_LEG_CHANCE * 0.5 &&
          coldLegs <= 100 * COLD_LEG_CHANCE * 1.5,
        "and across a hundred legs of one voyage roughly three in ten come up cold, so the weather is a rate a captain sails through rather than a rule that always bites or never does",
      );

      // The two rounds the checks below stand on, found by asking the rule
      // rather than written down as numbers that were cold once.
      const calendar = voyageState();
      calendar.voyageEpoch = 4242;
      const findRound = (cold: boolean) => {
        for (let round = 1; round <= 60; round++) {
          calendar.currentRound = round;
          if (legIsCold(calendar) === cold) return round;
        }
        return -1;
      };
      const coldRound = findRound(true);
      const mildRound = findRound(false);
      check(
        coldRound > 0 && mildRound > 0,
        "and a cold leg and a mild one both turn up in the first sixty of a voyage, which is the floor the rest of these checks stand on",
      );

      // The same cold leg, sailed bare.
      const freezing = voyageState();
      freezing.voyageEpoch = 4242;
      freezing.money = 1000;
      freezing.currentRound = coldRound;
      hireWorker(freezing, "weaver", []);
      hireWorker(freezing, "weaver", []);
      const elderHand = freezing.workers.weaver[0].name;
      const newestHand = freezing.workers.weaver[1].name;
      const bareLines: string[] = [];
      const warned = shortOfWarmth(freezing);
      tickGarments(freezing, bareLines);
      check(
        warned &&
          freezing.garmentsTickRound === coldRound &&
          isFrostbitten(freezing.workers.weaver[1], coldRound + 1) &&
          freezing.workers.weaver[1].frostbittenRound === coldRound + 1 &&
          !isFrostbitten(freezing.workers.weaver[0], coldRound + 1) &&
          bareLines.some((line) => line.includes("falls short")) &&
          bareLines.some(
            (line) => line.includes("Frostbite") && line.includes(newestHand),
          ) &&
          !bareLines.some(
            (line) => line.includes("Frostbite") && line.includes(elderHand),
          ),
        "a cold leg met with nothing on takes the newest hand by name and stands them down for the leg after the one they froze through, so the rule that chooses who pays for the cold is the same newest aboard the loss of a hand is taken from rather than a second draw",
      );

      // And the same leg again, dressed. Two of warmth is what the leg
      // asks, so this is the check read on its other side.
      const warmCrew = voyageState();
      warmCrew.voyageEpoch = 4242;
      warmCrew.money = 1000;
      warmCrew.currentRound = coldRound;
      hireWorker(warmCrew, "weaver", []);
      warmCrew.inventory["Cotton Clothes"] = 1;
      wearGarment(warmCrew, "Cotton Clothes", []);
      // Read before the tick, because the tick is the leg that just ended:
      // what the check is about is the warmth the crew met the leg with,
      // and by the time the settlement returns, the same pair is worth less
      // than the leg asked for and reads as short for the next one.
      const dressedInTime =
        warmthScore(warmCrew) >= COLD_LEG_WARMTH && !shortOfWarmth(warmCrew);
      const warmLines: string[] = [];
      tickGarments(warmCrew, warmLines);
      check(
        dressedInTime &&
          warmCrew.workers.weaver[0].frostbittenRound === undefined &&
          warmLines.some((line) => line.includes("enough")) &&
          !warmLines.some((line) => line.includes("Frostbite")),
        "while the same cold leg met with two of warmth costs nobody anything: one pair of Cotton Clothes is enough for it, the settlement says so, and the hand who froze on the bare voyage beside this one is still at the bench",
      );

      // The mark lasts the one leg it names.
      freezing.currentRound = coldRound + 1;
      freezing.garments = [
        { good: "Brocade", durability: GARMENTS.Brocade.durability },
      ];
      tickGarments(freezing, []);
      const downForTheirLeg = isFrostbitten(
        freezing.workers.weaver[1],
        coldRound + 1,
      );
      freezing.currentRound = coldRound + 2;
      freezing.garments = [
        { good: "Brocade", durability: GARMENTS.Brocade.durability },
      ];
      tickGarments(freezing, []);
      check(
        downForTheirLeg &&
          freezing.workers.weaver[1].frostbittenRound === undefined &&
          freezing.workers.weaver.length === 2,
        "the hand stands down for exactly the leg the mark names and is back at the bench the leg after, because the tick clears the marks whose leg is over as it walks, and the cold costs them the work of one leg rather than their place aboard",
      );

      // The wear, in the plan's units, and once a leg.
      const sea = voyageState();
      sea.voyageEpoch = 4242;
      sea.money = 1000;
      sea.currentRound = mildRound;
      hireWorker(sea, "weaver", []);
      sea.garments = [
        { good: "Brocade", durability: GARMENTS.Brocade.durability },
      ];
      tickGarments(sea, []);
      const afterOneLeg = sea.garments[0].durability;
      tickGarments(sea, []);
      const stampedOnce = sea.garments[0].durability === afterOneLeg;
      sea.currentRound = coldRound;
      tickGarments(sea, []);
      check(
        afterOneLeg === GARMENTS.Brocade.durability - GARMENT_DECAY_PER_LEG &&
          stampedOnce &&
          sea.garments[0].durability ===
            GARMENTS.Brocade.durability -
              GARMENT_DECAY_PER_LEG -
              GARMENT_DECAY_COLD_LEG,
        "clothes lose one of their warmth a leg and two on a cold one, and a leg that arrives twice wears them once, since the tick stamps the round it read before it reads anything else",
      );

      // [Status copy] A status a captain can act on. The lines the cold and
      // the larder write about a hand's state used to say the state and
      // nothing else, and a state with no why and no way back is a mood
      // rather than a message: the field read "out of action" as the sea
      // having taken a hand for good, and read "slower pace" without ever
      // learning the empty larder was two legs from costing them one.
      check(
        bareLines.some(
          (line) =>
            line.includes("Frostbite") &&
            line.includes(newestHand) &&
            line.includes("short of warm clothes") &&
            line.includes("keeps every hand working"),
        ),
        "and the line that stands a hand down for the cold names what the cold caught them short of and what keeps every hand working, because warm clothes before the cold are the whole of the remedy and a warning that hides them leaves a captain reading a funeral into a laundry problem",
      );

      const statusSnowed = voyageState();
      statusSnowed.voyageEpoch = 4242;
      statusSnowed.money = 1000;
      statusSnowed.currentRound = coldRound + 1;
      hireWorker(statusSnowed, "weaver", []);
      const snowedHand = statusSnowed.workers.weaver[0];
      snowedHand.task = "Linen Clothes";
      snowedHand.frostbittenRound = coldRound + 1;
      const snowedLines: string[] = [];
      processProduction(statusSnowed, snowedLines);
      check(
        snowedLines.some(
          (line) =>
            line.includes(snowedHand.name) &&
            line.includes("frozen out this leg") &&
            line.includes("short of warm clothes") &&
            line.includes("waits for next leg"),
        ) &&
          snowedHand.task === "Linen Clothes" &&
          (statusSnowed.inventory["Linen Clothes"] ?? 0) === 0,
        "and a hand the cold has taken says from the bench why they are missing and that the work waits for them, since their materials were spent when the task was set and a captain watching an empty output line is owed the sentence that says the order survives the leg",
      );

      const statusHungry = voyageState();
      statusHungry.voyageEpoch = 4242;
      statusHungry.money = 1000;
      statusHungry.currentRound = mildRound;
      hireWorker(statusHungry, "weaver", []);
      statusHungry.larder = 0;
      const statusHungryLines: string[] = [];
      processProduction(statusHungry, statusHungryLines);
      check(
        statusHungryLines.some(
          (line) =>
            line.includes("short rations") &&
            line.includes("slower pace") &&
            line.includes("costs the newest hand aboard"),
        ),
        "and the line about a hungry leg carries the stake as well as the slowdown, because the empty larder's real price is the newest hand and a captain told only about speed cannot know which leg is the one that takes them",
      );

      const statusRefused = voyageState();
      statusRefused.voyageEpoch = 4242;
      statusRefused.money = 1000;
      statusRefused.currentRound = coldRound + 1;
      hireWorker(statusRefused, "weaver", []);
      statusRefused.workers.weaver[0].frostbittenRound = coldRound + 1;
      const statusRefusalLines: string[] = [];
      assignTask(statusRefused, "weaver", "Linen Clothes", statusRefusalLines);
      check(
        statusRefusalLines.length === 1 &&
          statusRefusalLines[0].includes("frozen out this leg") &&
          statusRefusalLines[0].includes("short of warm clothes") &&
          statusRefusalLines[0].includes("keeps every hand working") &&
          statusRefused.workers.weaver[0].task === null,
        "and a task refused over hands the cold has taken says the same why and the same way back as the row does, so a refusal about a full bench never lands on a bench that is standing idle",
      );

      // The rags at the bottom of that, and what they pay.
      const ragged = voyageState();
      ragged.voyageEpoch = 4242;
      ragged.money = 100;
      ragged.currentRound = mildRound;
      hireWorker(ragged, "weaver", []);
      ragged.garments = [{ good: "Linen Clothes", durability: 1 }];
      const ragLines: string[] = [];
      tickGarments(ragged, ragLines);
      check(
        ragged.garments.length === 0 &&
          ragged.money === 100 + RAG_SCRAP_VALUE &&
          ragLines.some((line) =>
            line.includes(`scrapped for ${RAG_SCRAP_VALUE} Gold`),
          ),
        "a garment the sea has had all of leaves the wardrobe and is scrapped for the plan's four Gold in the same breath, so the hold and the purse agree about a good that stopped being wearable rather than the garment vanishing quietly",
      );

      // And the whole of it through the engine's own Resolve.
      const settling = voyageState();
      settling.money = 1000;
      settling.voyageEpoch = 4242;
      settling.currentRound = coldRound;
      hireWorker(settling, "weaver", []);
      settling.garments = [
        {
          good: "Cotton Clothes",
          durability: GARMENTS["Cotton Clothes"].durability,
        },
      ];
      settling.phase = "resolve";
      settling.pirateAttackResolved = true;
      const settleLines: string[] = [];
      nextPhase(
        settling,
        {
          seedBase: `smoke:garments:${suffix}`,
          harborId: `smoke-garments-${suffix}`,
        },
        settleLines,
      );
      check(
        settling.garmentsTickRound === coldRound &&
          settling.garments[0].durability ===
            GARMENTS["Cotton Clothes"].durability - GARMENT_DECAY_COLD_LEG &&
          settleLines.some((line) => line.includes("The Cold and the Cloth")),
        "and the wear lands through the engine's own Resolve rather than beside it, so the tick is part of the deterministic settlement step every leg already passes through rather than a rule that only fires when something calls it by name",
      );

      // Every line this family wrote, gathered here rather than threaded
      // through each check, since the dash rule is about the whole set.
      survivalLines.push(
        ...dressLines,
        ...mildLines,
        ...bareLines,
        ...warmLines,
        ...ragLines,
        ...snowedLines,
        ...statusHungryLines,
        ...statusRefusalLines,
      );

      // The switch off, read on its own so the checks above can stay about
      // the rules rather than about the flag.
      check(
        withEnv("NEXT_PUBLIC_GARMENTS", "off", () => {
          const dark = voyageState();
          dark.voyageEpoch = 4242;
          dark.money = 1000;
          dark.currentRound = coldRound;
          hireWorker(dark, "weaver", []);
          dark.inventory.Brocade = 1;
          dark.garments = [
            { good: "Brocade", durability: GARMENTS.Brocade.durability },
          ];
          const darkLines: string[] = [];
          const refused = wearGarment(dark, "Brocade", darkLines) === false;
          tickGarments(dark, darkLines);
          return (
            !garmentsLayerOn(GAMBIT) &&
            refused &&
            dark.inventory.Brocade === 1 &&
            dark.garments.length === 1 &&
            dark.garments[0].durability === GARMENTS.Brocade.durability &&
            dark.garmentsTickRound === 0 &&
            !shortOfWarmth(dark) &&
            dark.workers.weaver[0].frostbittenRound === undefined &&
            darkLines.length === 0
          );
        }),
        "with the switch off no garment is worn, nothing wears out, no leg is stamped and nobody freezes, while the clothes a voyage is already carrying are left on it exactly as they were read, so the layer rolls back without taking anybody's wardrobe with it",
      );

      // And the layer above, which is why the two switches are separate
      // readings rather than one.
      check(
        withEnv("NEXT_PUBLIC_SURVIVAL", "off", () =>
          withEnv("NEXT_PUBLIC_GARMENTS", "1", () => {
            const unfed = voyageState();
            unfed.voyageEpoch = 4242;
            unfed.money = 1000;
            unfed.currentRound = coldRound;
            hireWorker(unfed, "weaver", []);
            unfed.inventory.Brocade = 1;
            unfed.garments = [{ good: "Brocade", durability: 5 }];
            const unfedLines: string[] = [];
            const refused = wearGarment(unfed, "Brocade", unfedLines) === false;
            tickGarments(unfed, unfedLines);
            return (
              !garmentsLayerOn(GAMBIT) &&
              refused &&
              unfed.garments[0].durability === 5 &&
              unfed.garmentsTickRound === 0 &&
              !shortOfWarmth(unfed) &&
              unfedLines.length === 0
            );
          }),
        ),
        "and the provisions layer governs this one from above, because the clothes belong to the same family: a build with the Larder off has no cold whatever the garments switch says, so a table can be rolled back one switch at a time without a wardrobe outliving the rule it belonged to",
      );

      // A save read back, with the switch off, because the healing is the
      // save's business rather than the rule's and has to hold either way.
      const many = (count: number) =>
        Array.from({ length: count }, () => ({
          good: "Brocade",
          durability: GARMENTS.Brocade.durability,
        }));
      check(
        withEnv("NEXT_PUBLIC_GARMENTS", "off", () => {
          return (
            normalizeGarments(undefined).length === 0 &&
            normalizeGarments("Brocade").length === 0 &&
            normalizeGarments([{ good: "Sable", durability: 9 }, null, 7, {}])
              .length === 0 &&
            normalizeGarments([{ good: "Brocade", durability: 40 }])[0]
              .durability === GARMENTS.Brocade.durability &&
            normalizeGarments([{ good: "Brocade", durability: -1 }]).length ===
              0 &&
            normalizeGarments([{ good: "Brocade", durability: 6.8 }])[0]
              .durability === 6 &&
            normalizeGarments(many(12)).length === 12 &&
            normalizeGarments(many(13)).length === 12 &&
            normalizeGarments(many(40)).length === 12 &&
            normalizeGarmentsTickRound(undefined) === 0 &&
            normalizeGarmentsTickRound(Number.NaN) === 0 &&
            normalizeGarmentsTickRound(-2) === 0 &&
            normalizeGarmentsTickRound(3.9) === 3
          );
        }),
        "a save written before this layer existed heals to a crew with nothing on, since a voyage should meet its first cold leg the way a fresh one does rather than in clothes a save invented for it, and a wardrobe it can read is clamped to the catalogue's own ends: entries for goods that are not clothes are dropped, a durability is floored into the garment, a garment already in rags is not worn, the back holds twelve, and a stamp it cannot read lands on a leg no voyage has",
      );
    }),
  );

  // The files this feature owns, read as files rather than asserted about,
  // so the rule covers their comments as well as the lines they write. It
  // is the same reading the crew's own files are held to above, and the
  // bench the wardrobe is drawn on is read there with them.
  check(
    !carriesADash("src/lib/game/garments.ts") &&
      !carriesADash("src/lib/game/engine/workers.ts") &&
      !carriesADash("src/lib/game/engine/lifecycle.ts") &&
      !carriesADash("src/components/portmasters/game/GameStatusPanel.tsx"),
    "and the module the clothes live in and the three files the cold reaches, the bench that assigns work, the settlement that ticks it and the rail a captain reads the forecast on, hold the house rule in their comments as well as in their code",
  );

  // ---- [C4: three foods, spoilage and the split hold] ----
  // The catalogue first, because every number below is read off it: three
  // foods of three densities, one of them never turning, the order they
  // are eaten in, and the two sizes the split hold is built out of.
  check(
    Object.keys(FOODS).length === 3 &&
      FOODS.Grain.mealsPerSlot === 1 &&
      FOODS.Grain.keeps === null &&
      FOODS["Salt Fish"].mealsPerSlot === 2 &&
      FOODS["Salt Fish"].keeps === 6 &&
      FOODS.Produce.mealsPerSlot === 3 &&
      FOODS.Produce.keeps === 2 &&
      FOODS_DRAW_ORDER.join(",") === "Produce,Salt Fish,Grain" &&
      CARGO_SLOTS === 30 &&
      STORES_SLOTS === LARDER_MAX &&
      SHORT_RATIONS_CARGO === 0.75 &&
      PRESERVE_MEALS_IN === 3 &&
      PRESERVE_MEALS_OUT === 2,
    "three foods of three densities and three clocks, eaten in the order the sea takes them back: produce turns after two legs, salt fish after six, grain never, and the split hold is thirty slots of cargo and the Larder's own sixty of stores",
  );

  // The split's own switch, read through the same policy function the
  // provisions switch is read through, so one typo cannot leave a table
  // half switched: the capacity model is a rule about provisions, so a
  // build without the Larder plays the base game whatever the split says.
  check(
    [undefined, "", "1", "on", "true", "live", "ON "].every((value) =>
      withEnv("NEXT_PUBLIC_SPLIT_HOLD", value, switchFor(GAMBIT, splitHoldOn)),
    ) &&
      ["off", "0", "OFF", " off ", "Off"].every(
        (value) =>
          !withEnv(
            "NEXT_PUBLIC_SPLIT_HOLD",
            value,
            switchFor(GAMBIT, splitHoldOn),
          ),
      ) &&
      withEnv("NEXT_PUBLIC_SURVIVAL", "off", () =>
        withEnv(
          "NEXT_PUBLIC_SPLIT_HOLD",
          "1",
          switchFor(GAMBIT, holdCapacityOn),
        ),
      ) === false &&
      withEnv("NEXT_PUBLIC_SURVIVAL", "1", () =>
        withEnv(
          "NEXT_PUBLIC_SPLIT_HOLD",
          "off",
          switchFor(GAMBIT, holdCapacityOn),
        ),
      ) === false &&
      withEnv("NEXT_PUBLIC_SURVIVAL", "1", () =>
        withEnv(
          "NEXT_PUBLIC_SPLIT_HOLD",
          "1",
          switchFor(GAMBIT, holdCapacityOn),
        ),
      ) === true,
    "the split hold is on for every value except the word off and the digit zero, and the provisions layer governs it from above, so a table can be rolled back one switch at a time without a hold size outliving the rule it belonged to",
  );

  withEnv("NEXT_PUBLIC_SPLIT_HOLD", "1", () => {
    const splitLines: string[] = [];
    const rationCrew = 2;
    const rationLeg = rationCrew * RATION_PRICE;
    const staff = (state: GameState) => {
      for (let hired = 0; hired < rationCrew; hired += 1) {
        hireWorker(state, "weaver", []);
      }
      state.money = 1000;
    };

    // ---- what a voyage leaves the pier with ----
    // The opening hold is grain, and it is the same twelve meals C1
    // shipped, which is the continuity the whole split rests on: grain
    // fills one slot with one meal, so the account and the plain number
    // agree to the meal until a captain buys something else.
    const storeFresh = voyageState();
    check(
      storeFresh.larder === LARDER_START &&
        larderMeals(storeFresh) === LARDER_START &&
        storeFresh.larderLots.length === 1 &&
        storeFresh.larderLots[0].food === "Grain" &&
        storeFresh.larderLots[0].meals === LARDER_START &&
        usedStoreSlots(storeFresh) === LARDER_START &&
        usedCargoSlots(storeFresh) === 16 &&
        usedHoldSlots(storeFresh) ===
          usedCargoSlots(storeFresh) + usedStoreSlots(storeFresh),
      "a voyage leaves the pier with its opening twelve rations as one lot of grain, and the hold reads as two halves that add up to the whole: sixteen slots of stock and twelve of stores",
    );
    check(
      storesSlots() === LARDER_MAX &&
        storesMealCeiling() === LARDER_MAX * 3 &&
        cargoSlots(false) === CARGO_SLOTS &&
        cargoSlots(true) === Math.floor(CARGO_SLOTS * SHORT_RATIONS_CARGO) &&
        storeRoomMeals(storeFresh, "Grain") === LARDER_MAX - LARDER_START &&
        foodRoomMeals(storeFresh, "Grain") === LARDER_MAX - LARDER_START &&
        foodRoomMeals(storeFresh, "Produce") ===
          (LARDER_MAX - LARDER_START) * 3,
      "the stores are the Larder's old ceiling to the slot, so the same sixty slots hold sixty meals of grain, a hundred and twenty of salt fish or a hundred and eighty of produce, and what a captain can still buy is read in legs off the food they are buying",
    );

    // ---- buying, by the food ----
    // Two legs of salt fish, twice, because the second purchase is the
    // one that would show a doubled lot or a count that drifted: the
    // same food bought in the same leg merges into the lot already
    // aboard, and the price of a meal does not move with the food.
    const buyFoods = voyageState();
    staff(buyFoods);
    const buyFoodLines: string[] = [];
    const firstBuy = provisionFood(buyFoods, "Salt Fish", 2, buyFoodLines);
    const secondBuy = provisionFood(buyFoods, "Salt Fish", 2, buyFoodLines);
    splitLines.push(...buyFoodLines);
    check(
      firstBuy === 2 &&
        secondBuy === 2 &&
        buyFoods.larder === LARDER_START + 8 &&
        mealsOf(buyFoods, "Salt Fish") === 8 &&
        buyFoods.larderLots.filter((lot) => lot.food === "Salt Fish").length ===
          1 &&
        buyFoods.money === 1000 - 4 * rationLeg &&
        buyFoods.roundCosts === 4 * rationLeg &&
        usedStoreSlots(buyFoods) === LARDER_START + 4 &&
        buyFoodLines.length === 2,
      "salt fish buys at two meals a slot, four meals for two legs of a crew of two at the same price a meal of grain costs, and a second purchase in the same leg merges into the lot already aboard rather than starting a second one with the same age",
    );

    // ---- the order the sea takes things back ----
    // One meal a leg for a crew of one, out of a pantry holding all
    // three foods, walked leg by leg so a reader sees which food fed
    // which leg: produce first because it turns soonest, then salt
    // fish, then the grain nothing can be wrong about.
    const eatOrder = voyageState();
    eatOrder.money = 1000;
    hireWorker(eatOrder, "weaver", []);
    eatOrder.larder = 17;
    eatOrder.larderLots = [];
    addLot(eatOrder, "Grain", 12, 0);
    addLot(eatOrder, "Salt Fish", 2, 0);
    addLot(eatOrder, "Produce", 3, 4);
    const drewOrder: string[] = [];
    for (let round = 4; round <= 10; round += 1) {
      eatOrder.currentRound = round;
      const before = FOODS_DRAW_ORDER.map((food) => mealsOf(eatOrder, food));
      feedCrew(eatOrder, []);
      FOODS_DRAW_ORDER.forEach((food, index) => {
        if (mealsOf(eatOrder, food) < before[index]) drewOrder.push(food);
      });
    }
    check(
      drewOrder.join(",") ===
        "Produce,Produce,Produce,Salt Fish,Salt Fish,Grain,Grain" &&
        eatOrder.larder === 10 &&
        mealsOf(eatOrder, "Grain") === 10 &&
        mealsOf(eatOrder, "Produce") === 0 &&
        mealsOf(eatOrder, "Salt Fish") === 0,
      "the crew eats what spoils first, one meal a leg: three legs of produce, then two of salt fish, then grain, and the count follows the account down whichever food the meal came out of",
    );

    // The draw read for what it returns rather than for what it was
    // asked: a pantry that cannot cover the meal takes what is there and
    // says so, which is the answer the meal above uses to leave a
    // shortage standing rather than to conjure rations.
    const shortDraw = voyageState();
    shortDraw.larder = 2;
    shortDraw.larderLots = [{ food: "Produce", meals: 2, boughtRound: 0 }];
    check(
      drawMeals(shortDraw, 5.9) === 2 && larderMeals(shortDraw) === 0,
      "a draw for more meals than the pantry holds takes what is there rather than conjuring the difference, and a fraction of a meal is not a meal",
    );

    // ---- spoilage, stamped once a leg ----
    // Produce bought at one market is food for that leg and the one
    // after it and is gone at the second Dusk, counted from the leg it
    // was bought in. The stamp is what makes "once a leg" true rather
    // than hopeful, the same way the meal's own stamp does, and the
    // second tick in the same leg is written out because that is the
    // shape of the defect it prevents.
    const turnPot = voyageState();
    turnPot.larder = 18;
    turnPot.larderLots = [];
    addLot(turnPot, "Grain", 12, 0);
    addLot(turnPot, "Produce", 6, 1);
    turnPot.currentRound = 1;
    const turnLines: string[] = [];
    tickSpoilage(turnPot, turnLines);
    turnPot.currentRound = 2;
    tickSpoilage(turnPot, turnLines);
    const keptFresh =
      turnLines.length === 0 &&
      turnPot.larder === 18 &&
      mealsOf(turnPot, "Produce") === 6;
    turnPot.currentRound = 3;
    tickSpoilage(turnPot, turnLines);
    tickSpoilage(turnPot, turnLines);
    splitLines.push(...turnLines);
    check(
      keptFresh &&
        turnPot.larder === 12 &&
        mealsOf(turnPot, "Produce") === 0 &&
        mealsOf(turnPot, "Grain") === 12 &&
        turnPot.larderLots.length === 1 &&
        turnPot.larderSpoilRound === 3 &&
        turnLines.length === 1 &&
        turnLines[0].includes("🥬") &&
        turnLines[0].includes("6 rations of Produce turned at sea") &&
        turnLines[0].includes("12 left in the larder"),
      "produce is food for the leg it arrived in and the one after it, and on the second Dusk it turns: the count comes down with the account in the same statement, and a second tick in the same leg is not a second loss",
    );

    // Salt fish lasts six, so the same walk one food over turns on the
    // seventh leg rather than the third, and grain is never asked at
    // all: a food whose keeping is null is a lot no Dusk can touch.
    const keepPot = voyageState();
    keepPot.larder = 4;
    keepPot.larderLots = [{ food: "Salt Fish", meals: 4, boughtRound: 1 }];
    keepPot.currentRound = 6;
    const keepPotLines: string[] = [];
    tickSpoilage(keepPot, keepPotLines);
    const heldSix = keepPot.larder === 4 && mealsOf(keepPot, "Salt Fish") === 4;
    keepPot.currentRound = 7;
    tickSpoilage(keepPot, keepPotLines);
    splitLines.push(...keepPotLines);
    check(
      heldSix &&
        keepPot.larder === 0 &&
        keepPotLines.length === 1 &&
        keepPotLines[0].includes("🐟"),
      "salt fish keeps six legs from the market it was bought at and turns on the seventh, which is the long clock a preserve buys",
    );
    const everGrain = voyageState();
    everGrain.currentRound = 40;
    const everLines: string[] = [];
    tickSpoilage(everGrain, everLines);
    check(
      everLines.length === 0 &&
        everGrain.larder === LARDER_START &&
        larderMeals(everGrain) === LARDER_START,
      "and grain is never asked: a food that keeps forever is a lot no leg, however long the voyage, can take back",
    );

    // The pantry as a screen reads it, which is the number the market's
    // own keeping line is built from: what is aboard and how many legs
    // the oldest of it has left.
    const lotScreen = voyageState();
    lotScreen.larder = 3;
    lotScreen.larderLots = [];
    addLot(lotScreen, "Produce", 3, 4);
    lotScreen.currentRound = 5;
    const atFive = pantryLines(lotScreen);
    lotScreen.currentRound = 6;
    const atSix = pantryLines(lotScreen);
    lotScreen.currentRound = 9;
    const atNine = pantryLines(lotScreen);
    check(
      atFive.length === 1 &&
        atFive[0].food === "Produce" &&
        atFive[0].meals === 3 &&
        atFive[0].legsLeft === 1 &&
        atSix[0].legsLeft === 0 &&
        atNine[0].legsLeft === 0,
      "the pantry a captain reads says what is aboard and how many legs the oldest of it has left, floored at the Dusk it turns rather than counting into the past",
    );

    // ---- preserving, at the plan's own ratio ----
    // Three meals of produce into two of salt fish at the same slot and
    // the same price, so the third meal is what a captain pays for a
    // fresh clock. The trade is about keeping rather than quantity, and
    // the hold it costs is the same hold either way.
    const cookPot = voyageState();
    cookPot.larder = 7;
    cookPot.larderLots = [{ food: "Produce", meals: 7, boughtRound: 0 }];
    const slotsBefore = usedStoreSlots(cookPot);
    const cookPotLines: string[] = [];
    const batches = preserveFood(cookPot, cookPotLines);
    const refusedPotLines: string[] = [];
    const secondBatches = preserveFood(cookPot, refusedPotLines);
    splitLines.push(...cookPotLines, ...refusedPotLines);
    check(
      batches === 2 &&
        cookPot.larder === 5 &&
        mealsOf(cookPot, "Produce") === 1 &&
        mealsOf(cookPot, "Salt Fish") === 4 &&
        Math.abs(usedStoreSlots(cookPot) - slotsBefore) < 1e-9 &&
        cookPotLines.length === 1 &&
        cookPotLines[0].includes(
          "Preserved 6 rations of Produce into 4 of Salt Fish",
        ) &&
        secondBatches === 0 &&
        refusedPotLines.length === 1 &&
        refusedPotLines[0].includes("Not enough Produce"),
      "preserving turns three meals of produce into two of salt fish at the same slots and the same price, and a pantry with less than a batch aboard is told why rather than served a fraction of one",
    );

    // ---- the ceiling, reached rather than overshot ----
    // A captain who asks for more legs than the stores have room for
    // buys the room exactly, and the next meal of grain is the purchase
    // that finds them full, which is the line C1 shipped and the reason
    // the ration purchase kept its old name: a captain buying rations
    // without naming a food is buying the food that never turns.
    const fullPot = voyageState();
    staff(fullPot);
    const fullPotLines: string[] = [];
    const fillLegs = provisionFood(fullPot, "Produce", 999, fullPotLines);
    const fullRoom = foodRoomMeals(fullPot, "Grain");
    const overfill = provisionFood(fullPot, "Grain", 1, fullPotLines);
    splitLines.push(...fullPotLines);
    check(
      fillLegs === 72 &&
        fullPot.larder === LARDER_START + 144 &&
        usedStoreSlots(fullPot) === STORES_SLOTS &&
        fullRoom === 0 &&
        overfill === 0 &&
        fullPotLines[1] === "🧺 The larder is full.",
      "the stores are reached rather than overshot: a captain asking for more legs than fit buys the hold exactly full of the food that fills it densest, and the next purchase is told the larder is full in the words C1 shipped",
    );

    // ---- the quarter a hungry crew costs the cargo ----
    // C1's own clause, landed on the single capacity read: a quarter off
    // the cargo while the crew is on short rations, and nothing at all
    // when the hold has no size. The card below is refused by the
    // market rather than by the hold, because the market is the door
    // that sells, and the same card buys without complaint one meal
    // later, which is what makes the shortage a cost rather than a wall.
    const hungryShip = voyageState();
    staff(hungryShip);
    hungryShip.larder = 0;
    hungryShip.larderLots = [];
    const heavyCard = {
      id: 9001,
      port: "Smoke Harbor",
      resources: [{ type: "Hemp", quantity: 7, price: 10, materialCost: 0 }],
      totalCost: 20,
      isProductCard: false,
    };
    hungryShip.resourceCards = [heavyCard];
    const quarterLines: string[] = [];
    purchaseCard(hungryShip, heavyCard.id, quarterLines);
    const stayedHungry =
      quarterLines.length === 1 &&
      quarterLines[0].includes("it takes 7 slots and 6 are free") &&
      hungryShip.inventory.Hemp === 8 &&
      hungryShip.money === 1000 &&
      cargoCapacity(hungryShip) ===
        Math.floor(CARGO_SLOTS * SHORT_RATIONS_CARGO) &&
      cargoRoom(hungryShip) === 6;
    hungryShip.larder = LARDER_START;
    hungryShip.larderLots = [];
    addLot(hungryShip, "Grain", LARDER_START, 0);
    const fedShipLines: string[] = [];
    purchaseCard(hungryShip, heavyCard.id, fedShipLines);
    splitLines.push(...quarterLines, ...fedShipLines);
    check(
      stayedHungry &&
        hungryShip.inventory.Hemp === 15 &&
        hungryShip.money === 1000 - heavyCard.totalCost &&
        cargoCapacity(hungryShip) === CARGO_SLOTS &&
        cargoRoom(hungryShip) === CARGO_SLOTS - 23,
      "a crew on short rations costs the cargo a quarter, so a lot one slot too large for the hungry hold is turned away with the numbers it was measured against, and the same lot buys the moment the crew has eaten",
    );

    // ---- a save written by hand ----
    // The same reading the Larder's own number gets, one family down:
    // lots the catalogue does not know are dropped rather than carried,
    // a lot with nothing in it is not a lot, a save with no account
    // heals onto the count as grain, and a count is clamped to the hold
    // it is actually in rather than to the ceiling a build once had.
    check(
      normalizeLarderLots(undefined, LARDER_START)[0].food === "Grain" &&
        normalizeLarderLots(undefined, LARDER_START)[0].meals ===
          LARDER_START &&
        normalizeLarderLots("Brocade", 5)[0].meals === 5 &&
        normalizeLarderLots([], 0).length === 0 &&
        normalizeLarderLots(
          [
            { food: "Brocade", meals: 3, boughtRound: 1 },
            null,
            7,
            {},
            { food: "Produce", meals: -2, boughtRound: 0 },
            { food: "Grain", meals: 0, boughtRound: 0 },
            { food: "Produce", meals: 6.8, boughtRound: 2.9 },
          ],
          LARDER_START,
        ).length === 1 &&
        normalizeLarderLots(
          [{ food: "Produce", meals: 6.8, boughtRound: 2.9 }],
          0,
        )[0].meals === 6 &&
        normalizeLarderLots(
          Array.from({ length: 70 }, () => ({
            food: "Produce",
            meals: 3,
            boughtRound: 0,
          })),
          0,
        ).length === 64 &&
        normalizeLarderSpoilRound(undefined) === 0 &&
        normalizeLarderSpoilRound(-2) === 0 &&
        normalizeLarderSpoilRound(3.9) === 3,
      "a pantry read off a save drops the lots the catalogue does not know, floors what a portion is and what leg it was bought at, keeps the sixty four lots a voyage can legitimately carry, and reads a missing stamp as a leg no voyage has",
    );
    check(
      normalizeLarder(180, GAMBIT) === 180 &&
        normalizeLarder(-4, GAMBIT) === 0 &&
        normalizeLarder("sixty", GAMBIT) === LARDER_START &&
        normalizeLarder(3.9, GAMBIT) === 3 &&
        withEnv("NEXT_PUBLIC_SPLIT_HOLD", "off", () =>
          normalizeLarder(180, GAMBIT),
        ) === LARDER_MAX,
      "a Larder read off a save is clamped to the hold it is actually in: the stores' own ceiling under the split, which is sixty meals of grain or a hundred and eighty of produce, and the old sixty with the split switched off",
    );

    // ---- a count and an account that have parted ----
    // The one writer that makes them agree, read in both directions,
    // because a hand that writes one of the two and not the other is
    // what every scenario in this file is: the count is the game's and
    // the account is what a crew eats from, and grain is what absorbs
    // the difference either way.
    const partedPot = voyageState();
    partedPot.larder = 0;
    const partedLines = pantryLines(partedPot);
    reconcileLarder(partedPot);
    const emptied =
      partedPot.larderLots.length === 0 && larderMeals(partedPot) === 0;
    partedPot.larder = 30;
    reconcileLarder(partedPot);
    check(
      partedLines.length === 1 &&
        partedLines[0].meals === LARDER_START &&
        emptied &&
        larderMeals(partedPot) === 30 &&
        mealsOf(partedPot, "Grain") === 30 &&
        partedPot.larderLots.length === 1,
      "a pantry a screen draws while the count says zero is the account rather than the count, and reconciling a state parted either way lands the difference on grain: the food that never turns is the one that can take an unknown age without lying about one",
    );

    // ---- the tick through the engine's own lap ----
    // The plan puts spoilage on the deterministic resolve step rather
    // than on a clock, so the check walks the phase every captain
    // already walks: a leg ends, the settlement tick reads the pantry,
    // and the produce the voyage carried through it is gone.
    const spoilWalk = voyageState();
    spoilWalk.money = 1000;
    spoilWalk.larder = 18;
    spoilWalk.larderLots = [];
    addLot(spoilWalk, "Grain", 12, 0);
    addLot(spoilWalk, "Produce", 6, 0);
    spoilWalk.currentRound = 2;
    spoilWalk.phase = "resolve";
    spoilWalk.pirateAttackResolved = true;
    const spoilWalkLines: string[] = [];
    nextPhase(
      spoilWalk,
      {
        seedBase: `smoke:foods:${suffix}`,
        harborId: `smoke-foods-${suffix}`,
      },
      spoilWalkLines,
    );
    splitLines.push(
      ...spoilWalkLines.filter((line) => line.includes("turned at sea")),
    );
    check(
      spoilWalk.larderSpoilRound === 2 &&
        mealsOf(spoilWalk, "Produce") === 0 &&
        mealsOf(spoilWalk, "Grain") === 12 &&
        spoilWalk.larder === LARDER_START &&
        spoilWalkLines.some((line) => line.includes("turned at sea")),
      "the settlement tick is where the sea takes its food back, in the phase every captain already walks and on the leg number rather than on any clock",
    );

    // ---- the switch, off ----
    // The rollback the plan asks for is one switch, and with it off this
    // feature is not running at all: no meal, no rot, no purchase, no
    // conversion, no stamp written and no mark left, and the room reads
    // the Larder's own ceiling again rather than the stores'.
    check(
      withEnv("NEXT_PUBLIC_SURVIVAL", "off", () => {
        const darkShip = voyageState();
        darkShip.money = 1000;
        darkShip.currentRound = 3;
        hireWorker(darkShip, "weaver", []);
        darkShip.larder = 0;
        darkShip.larderLots = [];
        const darkLines: string[] = [];
        const fed = feedCrew(darkShip, darkLines);
        const ateStamp = darkShip.larderFedRound;
        tickSpoilage(darkShip, darkLines);
        const spoilStamp = darkShip.larderSpoilRound;
        const bought = provisionFood(darkShip, "Produce", 2, darkLines);
        const preserved = preserveFood(darkShip, darkLines);
        return (
          !fed &&
          ateStamp === 0 &&
          spoilStamp === 0 &&
          bought === 0 &&
          preserved === 0 &&
          darkLines.length === 0 &&
          holdCapacityOn(GAMBIT) === false &&
          cargoCapacity(darkShip) === Number.POSITIVE_INFINITY &&
          foodRoomMeals(darkShip, "Produce") === LARDER_MAX &&
          normalizeLarder(180, GAMBIT) === LARDER_MAX
        );
      }),
      "with the provisions layer off the pantry is a plain number again: no meal drawn, nothing turned, nothing bought or preserved and no stamp written, and the room a captain reads is the Larder's own ceiling rather than a stores the rule is not running",
    );
    // Every line this feature wrote, into the one accumulator the family
    // is read through at the end of this section, so the dash rule
    // covers the pantry's own sentences as well as the Larder's.
    survivalLines.push(...splitLines);
  });

  // The files this feature owns, read as files rather than asserted
  // about, the same reading the crew's own files get above, so the house
  // rule covers their comments as well as the strings they build. The
  // two files that carry the spine's own banners are read by the checks
  // that own them instead, since a banner is drawn with the characters
  // the rule is about.
  check(
    !carriesADash("src/lib/game/foods.ts") &&
      !carriesADash("src/lib/game/hold.ts") &&
      !carriesADash("src/lib/game/flags.ts") &&
      !carriesADash("src/lib/game/larder.ts") &&
      !carriesADash("src/lib/game/engine/lifecycle.ts"),
    "and the four modules the pantry, the hold and the two switches live in, and the settlement that ticks them, hold the house rule in their comments as well as in their code",
  );
  check(
    !carriesADash("src/lib/game/engine/market.ts") &&
      !carriesADash("src/lib/game/dashboard.ts") &&
      !carriesADash("src/lib/game/integrity.ts") &&
      !carriesADash("src/lib/use-leg-report.ts") &&
      !carriesADash("src/types/realtime") &&
      !carriesADash("src/server/realtime/index.ts") &&
      !carriesADash("src/components/portmasters/game/phases/Purchase.tsx"),
    "and the four screens and the wire the split reaches, the market that refuses a lot for room, the dashboard that reads the hold, the integrity note, the leg report and its server side, and the Provisions panel a captain buys from, hold it too",
  );

  // Every string the survival layer puts in front of a captain, read with
  // the same rule the manifest line above is read with. The house rule
  // covers every string a captain reads, and it is built out of code
  // points at the top of this file so that the check is never where the
  // dashes are kept. Every feature of this family writes into this one
  // accumulator, the wardrobe included, since a frostbite crossing a log
  // line is a captain facing string whatever wrote it, and the rule is
  // about the whole set.
  check(
    survivalLines.length > 0 &&
      survivalLines.every((line) => !CARRIES_A_DASH.test(line)),
    "and every line the survival layer writes for a captain, the Larder's shortage, the crew's own losses and the wardrobe's wear alike, is free of dashes, the same rule every other string in the game is held to",
  );

  // =====================================================================
  // [D1: the path configuration module, and the naming change]
  //
  // The plan asks for one record per path carrying crest, signature
  // ability, goods, order pool, cargo modifier and Renown ceiling, in the
  // shape the difficulty ladder already uses, so that adding or retuning
  // a path is one entry and no other server code to touch. What is held
  // below is that record read as a record: the facts it claims, the
  // properties that make it one source of truth, and the naming change it
  // carried, which is the half of this slice a later reader is likeliest
  // to undo by accident.
  //
  // Nothing here talks to the server, because there is no server side to
  // this feature: a path is content, and the module holding it reads no
  // clock, no database and no socket. Every check is also written to
  // survive the day a sixth path is added, because the plan's own
  // evaluation adds one to prove that no other module has to move, and a
  // suite that failed on that edit would itself be the second place the
  // paths are listed.
  // =====================================================================
}
