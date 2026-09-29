// =====================================================================
// PortMasters 2.2 Parallel Release: the smoke run, as an order of suites.
//
// Drives one honest voyage through the running app: two captains sign up,
// one opens a harbor, the other joins it by code, both open a socket and
// authenticate, and the run then walks every feature this branch added
// against the same live server, over the same public HTTP and WebSocket
// surface a browser uses.
//
// Start the app first, then in another terminal:
//
//   npm run dev
//   npm run test:smoke
//
// Point it somewhere else with SMOKE_BASE_URL, for example
// SMOKE_BASE_URL=http://localhost:8099 npm run test:smoke
//
// This file is the order, the setup and the teardown, and nothing else.
// Each article of the run lives in ./suites, which is handed what it reads
// and returns what it measured, so what an article depends on can be read
// off its signature rather than worked out from who assigned what earlier
// in one long body.
//
// Five of those values are assigned back into variables declared here
// rather than destructured at the call site: the two captains and the
// three harbor ids the cleanup below has to be able to read, whether the
// run passed or threw.
// =====================================================================
import "@/server/env";
import { db } from "@/lib/db";
import { BASE, check, failures, signUp } from "./harness";
import type { Captain } from "./wire";
import type { Socket } from "socket.io-client";
import { cleanupSuite } from "./cleanup";
import type { SmokeRun } from "./run";
import { signedInCaptainSuite } from "./suites/01-signedInCaptain";
import { lobbyKeepsItsMessagesSuite } from "./suites/02-lobbyKeepsItsMessages";
import { harborSquareSuite } from "./suites/03-harborSquare";
import { openingAndJoiningASuite } from "./suites/04-openingAndJoiningA";
import { realtimeChannelSuite } from "./suites/05-realtimeChannel";
import { seeingEachOtherSSuite } from "./suites/06-seeingEachOtherS";
import { detailPopupSQuestionSuite } from "./suites/07-detailPopupSQuestion";
import { recoveringASessionAfterSuite } from "./suites/08-recoveringASessionAfter";
import { quickStartPairingSuite } from "./suites/09-quickStartPairing";
import { conversationTheVoyageKeepsSuite } from "./suites/10-conversationTheVoyageKeeps";
import { muteAndTheReportSuite } from "./suites/11-muteAndTheReport";
import { inboundBudgetSuite } from "./suites/12-inboundBudget";
import { barteringFromAnywhereSuite } from "./suites/13-barteringFromAnywhere";
import { captainSExchangeInSuite } from "./suites/14-captainSExchangeIn";
import { wipingTheVoyageSuite } from "./suites/15-wipingTheVoyage";
import { operatorConsoleSuite } from "./suites/16-operatorConsole";
import { actingOnASelectionSuite } from "./suites/17-actingOnASelection";
import { privateInformationSpineSuite } from "./suites/18-privateInformationSpine";
import { victoryRulesSuite } from "./suites/19-victoryRules";
import { voyageBriefingsSuite } from "./suites/20-voyageBriefings";
import { legClockSuite } from "./suites/21-legClock";
import { voyageEndToEndSuite } from "./suites/22-voyageEndToEnd";
import { harborClockSuite } from "./suites/23-harborClock";
import { standingOrdersSuite } from "./suites/24-standingOrders";
import { voyageLogSuite } from "./suites/25-voyageLog";
import { fleetCommissionSuite } from "./suites/26-fleetCommission";
import { quotaRungSuite } from "./suites/27-quotaRung";
import { manifestAuditSuite } from "./suites/28-manifestAudit";
import { maroonAndTheHarbormasterSuite } from "./suites/29-maroonAndTheHarbormaster";
import { revealAndTheReplaySuite } from "./suites/30-revealAndTheReplay";
import { unlockCodeSuite } from "./suites/31-unlockCode";
import { telemetrySpineSuite } from "./suites/32-telemetrySpine";
import { balanceDashboardSuite } from "./suites/33-balanceDashboard";
import { launchGatesSuite } from "./suites/34-launchGates";
import { pathsSuite } from "./suites/35-paths";
import { pathboundOrderBoardSuite } from "./suites/36-pathboundOrderBoard";
import { escortContractSuite } from "./suites/37-escortContract";
import { loomTheRefitSuite } from "./suites/38-loomTheRefit";
import { aromaTheBazaarRumorSuite } from "./suites/39-aromaTheBazaarRumor";
import { freeCaptainTheBorrowSuite } from "./suites/40-freeCaptainTheBorrow";
import { pathDraftSuite } from "./suites/41-pathDraft";
import { signingOutSuite } from "./suites/42-signingOut";

async function main(): Promise<void> {
  console.log(`\nSmoke testing ${BASE}\n`);

  // The captains this run signs up and the harbors it opens, declared
  // outside the try because the cleanup in the finally below reads them
  // whether the run passed or threw. Each is nullable until the article
  // that fills it has run, and every article that uses one is handed it.
  let host: Captain | null = null;
  let guest: Captain | null = null;
  let third: Captain | null = null;
  let roomId: string | null = null;
  let quickStartRoomId: string | null = null;

  // Everything else one smoke run accumulates. A field here is a fact some
  // article produced and a later one acts on; a local inside an article is
  // that article's own business.
  // Every harbor that already exists before this run starts. Cleanup only
  // ever deletes a room this run created, so a Quick Start that seats the
  // test captains into somebody's real open harbor cannot take that harbor
  // down with it.
  const preExistingRoomIds = new Set(
    (await db.room.findMany({ select: { id: true } })).map((r) => r.id),
  );

  // Everything else one smoke run accumulates. A field here is a fact some
  // article produced and a later one acts on; a local inside an article is
  // that article's own business.
  const run: SmokeRun = {
    // Accounts this run creates that belong to no harbor, so there is
    // nothing to tear down for them but the accounts themselves. The
    // messages they send each other cascade away with them.
    extraAccounts: [] as Captain[],
    // Harbors opened for the one walk that sails a voyage rather than
    // probing a route. They are this run's, so cleanup deletes them, and
    // they are listed here rather than reused from the fields above
    // because that walk needs a room whose whole voyage it drives itself.
    lapRoomIds: [] as string[],
    sockets: [] as Socket[],
    // Only armed once the first account has been proven visible to this
    // process's database connection. Until then, nothing is deleted.
    cleanupIsSafe: false,
    preExistingRoomIds,
  };

  try {
    console.log("Accounts");
    host = await signUp("host");

    // Safety interlock. The account was just written through the API; if
    // this connection cannot see it, the server and this script are on
    // different databases and the cleanup below would silently do
    // nothing. Stop now, before a second account and a room exist.
    const visible = await db.user.findUnique({
      where: { username: host.username },
      select: { id: true },
    });
    if (!visible || visible.id !== host.id) {
      throw new Error(
        `The server at ${BASE} is writing to a different database than this script reads.\n` +
          `This script resolves DATABASE_URL from this project's .env, so start the server the same way,\n` +
          `or export DATABASE_URL first. Nothing has been deleted.`,
      );
    }
    run.cleanupIsSafe = true;

    guest = await signUp("guest");
    check(Boolean(host.token), "the host receives a session token");
    check(Boolean(guest.token), "the guest receives a session token");

    console.log("\nThe signed in captain");
    await signedInCaptainSuite({ host });
    console.log("\nThe Lobby keeps its messages");
    const lobbyKeepsItsMessages = await lobbyKeepsItsMessagesSuite(run);
    const { ashore, ashoreSocket, quay, quayLine, quaySocket } =
      lobbyKeepsItsMessages;
    console.log("\nThe harbor square");
    await harborSquareSuite({
      ashore,
      ashoreSocket,
      quay,
      quayLine,
      quaySocket,
    });
    console.log("\nOpening and joining a harbor");
    const openingAndJoiningA = await openingAndJoiningASuite({ guest, host });
    roomId = openingAndJoiningA.roomId;
    const { code } = openingAndJoiningA;
    console.log("\nThe realtime channel");
    const realtimeChannel = await realtimeChannelSuite(run, { guest, host });
    const { guestSocket, hostSocket } = realtimeChannel;
    console.log("\nSeeing each other's live data");
    const seeingEachOtherS = await seeingEachOtherSSuite({
      ashoreSocket,
      guest,
      guestSocket,
      host,
      hostSocket,
      quaySocket,
      roomId,
    });
    const { guestToken, hostId } = seeingEachOtherS;
    console.log("\nThe detail popup's question and answer");
    await detailPopupSQuestionSuite(run, {
      guest,
      guestSocket,
      guestToken,
      hostId,
      hostSocket,
      roomId,
    });
    console.log("\nRecovering a session after a reload");
    await recoveringASessionAfterSuite({ guest, roomId });
    console.log("\nQuick Start pairing");
    const quickStartPairing = await quickStartPairingSuite({
      guestSocket,
      hostSocket,
    });
    quickStartRoomId = quickStartPairing.quickStartRoomId;
    console.log("\nA conversation the voyage keeps to itself");
    const conversationTheVoyageKeeps = await conversationTheVoyageKeepsSuite(
      run,
      { code, guest, guestSocket, host, hostId, hostSocket, roomId },
    );
    third = conversationTheVoyageKeeps.third;
    const { thirdSocket } = conversationTheVoyageKeeps;
    console.log("\nThe mute and the report");
    await muteAndTheReportSuite({
      guest,
      guestSocket,
      hostId,
      hostSocket,
      roomId,
      third,
      thirdSocket,
    });
    console.log("\nThe inbound budget");
    await inboundBudgetSuite(run, { guestSocket, third });
    console.log("\nBartering from anywhere");
    const barteringFromAnywhere = await barteringFromAnywhereSuite({
      guest,
      guestSocket,
      hostId,
      hostSocket,
      roomId,
      third,
      thirdSocket,
    });
    const { guestId } = barteringFromAnywhere;
    console.log("\nThe Captain's Exchange in its own phase");
    await captainSExchangeInSuite({
      guest,
      guestId,
      guestSocket,
      hostSocket,
      roomId,
    });
    console.log("\nWiping the voyage");
    await wipingTheVoyageSuite(run, { guest, guestSocket, hostSocket, roomId });
    console.log("\nThe operator console");
    const operatorConsole = await operatorConsoleSuite(run, {
      guest,
      guestSocket,
      host,
      hostSocket,
    });
    const { operator, operatorSocket } = operatorConsole;
    console.log("\nActing on a selection");
    await actingOnASelectionSuite(run, { host, operator, operatorSocket });
    console.log("\nThe private information spine");
    const privateInformationSpine = await privateInformationSpineSuite(run);
    const {
      classicRoomId,
      gambitFifth,
      gambitFourth,
      gambitHost,
      gambitRoomId,
      gambitSecond,
      gambitSixth,
      gambitThird,
      pairedCrew,
      pairedRoomId,
      seated,
      secret,
    } = privateInformationSpine;
    console.log("\nThe victory rules");
    await victoryRulesSuite();
    console.log("\nThe voyage briefings");
    await voyageBriefingsSuite();
    console.log("\nThe leg clock");
    await legClockSuite();
    console.log("\nA voyage end to end on the six phase leg");
    await voyageEndToEndSuite(run);
    console.log("\nThe harbor clock");
    await harborClockSuite(run);
    console.log("\nStanding orders");
    await standingOrdersSuite();
    console.log("\nThe voyage log");
    await voyageLogSuite(run);
    console.log("\nThe fleet commission");
    await fleetCommissionSuite(run, {
      classicRoomId,
      gambitFourth,
      gambitHost,
      gambitRoomId,
      gambitSecond,
      gambitThird,
      seated,
      secret,
    });
    console.log("\nThe quota rung");
    await quotaRungSuite(run, {
      gambitFifth,
      gambitFourth,
      gambitHost,
      gambitRoomId,
      gambitSecond,
      gambitThird,
      pairedCrew,
      pairedRoomId,
    });
    console.log("\nThe Manifest Audit");
    await manifestAuditSuite(run, {
      gambitFifth,
      gambitFourth,
      gambitHost,
      gambitSecond,
      gambitSixth,
      gambitThird,
    });
    console.log("\nMaroon, and the Harbormaster's hand");
    const maroonAndTheHarbormaster = await maroonAndTheHarbormasterSuite(run, {
      gambitFifth,
      gambitFourth,
      gambitHost,
      gambitSecond,
      gambitSixth,
      gambitThird,
      guest,
    });
    const { maroonRoomId, maroonTargetId } = maroonAndTheHarbormaster;
    console.log("\nThe reveal and the replay ledger");
    const revealAndTheReplay = await revealAndTheReplaySuite(run);
    const { revBroker, revNew, revPirate, revRoomId } = revealAndTheReplay;
    console.log("\nThe unlock code");
    await unlockCodeSuite(run);
    console.log("\nThe telemetry spine");
    const telemetrySpine = await telemetrySpineSuite(run, {
      maroonRoomId,
      maroonTargetId,
      revBroker,
      revNew,
      revPirate,
      revRoomId,
    });
    const { telHome, telSail, telStand, telWaitForOne } = telemetrySpine;
    console.log("\nThe balance dashboard");
    const balanceDashboard = await balanceDashboardSuite({
      host,
      operator,
      telHome,
    });
    const {
      dashRecord,
      emptyReading,
      floorReading,
      gateLines,
      inBandOutcomes,
      liveReading,
    } = balanceDashboard;
    console.log("\nThe launch gates");
    await launchGatesSuite(run, {
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
    });
    console.log("\nThe paths");
    await pathsSuite();
    console.log("\nThe pathbound order board");
    await pathboundOrderBoardSuite();
    console.log("\nThe escort contract");
    await escortContractSuite(run, { host });
    console.log("\nLoom: the refit");
    await loomTheRefitSuite(run, { host });
    console.log("\nAroma: the bazaar rumor");
    await aromaTheBazaarRumorSuite(run);
    console.log("\nFree Captain: the borrow");
    await freeCaptainTheBorrowSuite();
    console.log("\nThe path draft");
    await pathDraftSuite(run, { telWaitForOne });
    console.log("\nSigning out");
    await signingOutSuite({ guest });
  } finally {
    await cleanupSuite(run, { host, guest, third, roomId, quickStartRoomId });
  }

  if (failures.length) {
    console.log(`\n${failures.length} check(s) failed.\n`);
    process.exit(1);
  }
  console.log("\nAll checks passed.\n");
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("\nThe smoke test could not finish.", err);
  process.exit(1);
});
