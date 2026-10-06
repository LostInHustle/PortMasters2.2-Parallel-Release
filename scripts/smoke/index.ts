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
// rather than destructured at the call site: the three captains and the
// two harbor ids the cleanup below has to be able to read, whether the
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
import { supplyBargeSuite } from "./suites/43-supplyBarge";
import { tagVocabularySuite } from "./suites/44-tagVocabulary";
import { readyCheckThatStallsSuite } from "./suites/45-theReadyCheckThatStalls";
import { cardRecordSuite } from "./suites/46-cardRecord";
import { moduleTradesSuite } from "./suites/47-moduleTrades";
import { milestoneBoonsSuite } from "./suites/48-milestoneBoons";
import { publicOffersSuite } from "./suites/49-publicOffers";
import { brokersWhisperSuite } from "./suites/50-brokersWhisper";
import { chartersSuite } from "./suites/51-charters";
import { powerBudgetSuite } from "./suites/52-powerBudget";
import { theSeatWaitsInsideTheYardSuite } from "./suites/53-theSeatWaitsInsideTheYard";
import { theFleetsOwnOutcomeSuite } from "./suites/54-theFleetsOwnOutcome";
import { theLegacyPhaseMovesSuite } from "./suites/55-theLegacyPhaseMoves";
import { theMarksAndTheGatesSuite } from "./suites/56-theMarksAndTheGates";
import { theOrderThatSettlesSuite } from "./suites/57-theOrderThatSettles";
import { theWageTheBillQuotesSuite } from "./suites/58-theWageTheBillQuotes";
import { theDoorsAndTheLoadSuite } from "./suites/59-theDoorsAndTheLoad";
import { theMirrorAndTheChargeSuite } from "./suites/60-theMirrorAndTheCharge";
import { theStatusConventionSuite } from "./suites/61-theStatusConvention";
import { theMutesAndTheKeysSuite } from "./suites/62-theMutesAndTheKeys";
import { theWayOutSuite } from "./suites/63-theWayOut";
import { theFirstVoyageSuite } from "./suites/64-theFirstVoyage";

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
    // The whisper's article deals its boards through the same lifecycle
    // calls the article above uses and reads the same order cards, so it
    // stands beside it rather than in the group at the foot of the run.
    console.log("\nThe Broker's Whisper");
    await brokersWhisperSuite();
    console.log("\nThe escort contract");
    await escortContractSuite(run, { host });
    console.log("\nLoom: the refit");
    await loomTheRefitSuite(run, { host });
    // The third consent kind runs beside the two before it for the reason
    // it exists beside them in the tree: the market is made of the same
    // primitive, and its harbor block reads the same way theirs do.
    console.log("\nThe module trade");
    await moduleTradesSuite(run, { host });
    console.log("\nAroma: the bazaar rumor");
    await aromaTheBazaarRumorSuite(run);
    console.log("\nFree Captain: the borrow");
    await freeCaptainTheBorrowSuite();
    console.log("\nThe path draft");
    await pathDraftSuite(run, { telWaitForOne });
    console.log("\nSigning out");
    await signingOutSuite({ guest });
    // The vendor's article is arithmetic over records and needs no harbor,
    // no socket and no captain, which is why it is the one article that can
    // run after the run has put its captains away. It is handed the
    // dashboard suite's own record builder rather than carrying a second
    // copy of the shape the spine writes.
    console.log("\nThe Supply Barge");
    await supplyBargeSuite({ dashRecord });
    // The vocabulary's article is the other one that needs no harbor: the
    // content is static data and the rule over it is a pure function, so it
    // reads the same whether a table is sailing or not.
    console.log("\nThe tag vocabulary");
    await tagVocabularySuite();
    // The card record's article is the third of the three that need no
    // harbor, and it is the tag walk's neighbour in the tree as well as in
    // the run: the same pool the vocabulary is asked about is the one the
    // record puts a shape under, and both are static data rather than a
    // table anybody has to be sitting at.
    console.log("\nThe card record");
    await cardRecordSuite();
    // The milestone boons' article joins the three above that need no
    // harbor, and it is the card record's neighbour in the run the way it
    // is in the tree: the pool the record puts a shape under is the pool
    // the five moment cards are drawn from. Its checks walk the engine's
    // own state in process, and the one half that touches the database
    // (the telemetry accumulator the wire feeds) opens no harbor of its
    // own, so no table has to be sitting for any of it.
    console.log("\nThe milestone boons");
    await milestoneBoonsSuite();
    // [F5] The public offers' article follows the record suite it extends
    // (the two pick sites its first half walks are the ones the milestone
    // boons' own article armed), and unlike it the wire half needs a real
    // harbor with live sockets, which is why it opens one of its own
    // rather than joining the group above that needs no table.
    console.log("\nPublic offers");
    await publicOffersSuite(run, { gambitHost, gambitSecond });
    // [F6] The charters' article joins the group above that needs no
    // harbor, and it is the milestone boons' sibling in the tree as well
    // as in the run: both walk one moment off a state in process, and the
    // one half that touches the database (the take the leg report files)
    // opens no harbor of its own. It sits after the public offers because
    // it is the newer article and the ready check stays last.
    console.log("\nThe charters");
    await chartersSuite();
    // [F7] The power budget's article is the charters' sibling in the
    // tree as well as in the run: both hold one derived table against a
    // state in process, and the instrument half reads fixture rows
    // through a pure reduction, so no harbor is opened here either. It
    // sits after the charters because it is the newer article and the
    // ready check stays last.
    console.log("\nThe power budget");
    await powerBudgetSuite();
    // The yard's article is the ready check's sibling, and it runs just
    // ahead of it: both need a live harbor, and this one is done in a few
    // seconds rather than watched through a grace, which is the only
    // reason the ready check stays last.
    console.log("\nThe seat that waits inside the yard");
    await theSeatWaitsInsideTheYardSuite(run);
    // The fleet's own outcome's article is the yard's sibling: both drive
    // a live harbor with raw reports and neither spends a wall clock on a
    // grace. It sits after the yard because it is the newer article and
    // the ready check stays last.
    console.log("\nThe fleet's own outcome");
    await theFleetsOwnOutcomeSuite(run);
    // The correctness articles below open no harbor: each is a pure read
    // of a state in process (a load heal, a flag contract, a settlement, a
    // wage bill, a bolt onto a hull and the load that reconciles it, and
    // the two price mirrors held to the charges they quote), so
    // they sit together after the harbor articles and ahead
    // of the ready check, which stays last for the reason below.
    console.log("\nThe legacy phase that moves");
    await theLegacyPhaseMovesSuite();
    console.log("\nThe marks and the gates");
    await theMarksAndTheGatesSuite();
    console.log("\nThe order that settles");
    await theOrderThatSettlesSuite();
    console.log("\nThe wage the bill quotes");
    await theWageTheBillQuotesSuite();
    console.log("\nThe doors and the load");
    await theDoorsAndTheLoadSuite();
    console.log("\nThe mirror and the charge");
    await theMirrorAndTheChargeSuite();
    // [W3] The status convention's article joins the pure cluster above:
    // the registry is static data and its validator is a pure function,
    // so nothing here needs a harbor. It sits after the correctness
    // articles because it is the newer article and the ready check stays
    // last.
    console.log("\nThe status convention");
    await theStatusConventionSuite();
    // [W3] The mutes and the keys' article is the convention's sibling:
    // it reads the preference functions through a storage stub and walks
    // src for the three key literals, so it opens no harbor either. It
    // sits last of the pure cluster because the ready check stays last
    // of the run.
    console.log("\nThe mutes and the keys");
    await theMutesAndTheKeysSuite();
    // The way out's article is the third of the pure cluster: both exits
    // it holds are client source shapes rather than harbor state, so it
    // opens nothing either, and it sits ahead of the ready check for the
    // same reason the two above it do.
    console.log("\nThe way out");
    await theWayOutSuite();
    // [W5] The first voyage's article is the fourth of the pure cluster:
    // the surfaces a new captain meets before the first market are read as
    // records and source rather than as harbor state, so it opens nothing
    // either and sits with them ahead of the ready check.
    console.log("\nThe first voyage");
    await theFirstVoyageSuite();
    // The ready check's article is the one that needs a harbor and a wall
    // clock rather than a table: its cure is a grace the room has to be
    // watched through, so it is the last thing the run does and it opens a
    // harbor of its own to spend that time in.
    console.log("\nThe ready check that stalls");
    await readyCheckThatStallsSuite(run);
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
