// PortMasters 2.2 Parallel Release, smoke run: The telemetry spine.

import { loadServerConfig } from "@/lib/config";
import { db } from "@/lib/db";
import type { TelemetryRecord } from "@/lib/game/telemetry";
import {
  TELEMETRY_FAMILY,
  TELEMETRY_VERSION,
  normalizeRecord,
  readStoredRecord,
  telemetryEvent,
  voyageIdFor,
} from "@/lib/game/telemetry";
import type { Phase } from "@/lib/game/types";
import { BROKER_PAYOUT_TARGET, readPeerTradeProfit } from "@/lib/game/victory";
import {
  LEDGER_PHRASE,
  call,
  check,
  openAuthedSocket,
  signUp,
  suffix,
  waitForEvent,
} from "../harness";
import type { Captain, WireHistory, WireOffer } from "../wire";
import type { Socket } from "socket.io-client";
import type { SmokeRun } from "../run";

export async function telemetrySpineSuite(
  run: SmokeRun,
  inputs: {
    maroonRoomId: string;
    maroonTargetId: string;
    revBroker: { id: string; token: string; cookie: string; username: string };
    revNew: { id: string; token: string; cookie: string; username: string };
    revPirate: { id: string; token: string; cookie: string; username: string };
    revRoomId: string;
  },
): Promise<{
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
}> {
  // =====================================================================
  // [I1: the telemetry spine]
  //
  // The plan's evaluation for this slice has two halves: a full voyage
  // leaves a complete record with no gaps, and a deliberately broken
  // voyage, one abandoned mid leg, leaves a record that explains where it
  // stopped. Both are read back off the server below, from the row it
  // actually wrote rather than from anything this file assembled.
  //
  // Three harbors do the work. The first sails to its end with every kind
  // of event the spine knows fired at least once, the second is abandoned
  // by its only captain and proves a record outlives the harbor it
  // describes, and the third is wiped by its host mid leg and proves the
  // spine forgets a voyage it has already closed.
  // =====================================================================
  const {
    maroonRoomId,
    maroonTargetId,
    revBroker,
    revNew,
    revPirate,
    revRoomId,
  } = inputs;

  // ---- The vocabulary, on its own ----
  // The pure half is checked first and without a server, so a failure
  // here is never read as a server that declined to record something.
  const telVoyage = voyageIdFor("harbor-1", 4);
  check(
    telVoyage === "harbor-1:V4",
    "a voyage is named by its harbor and its epoch, which is the same string the commission and the order board already seed from",
  );
  const telPosted = telemetryEvent(
    "offer_posted",
    telVoyage,
    1_700_000_000_000,
    { leg: 2, actor: "captain-a", goods: 4 },
  );
  check(
    telPosted.v === TELEMETRY_VERSION &&
      telPosted.family === "market" &&
      telPosted.leg === 2 &&
      telPosted.voyageId === telVoyage,
    "an event carries the version, the voyage and the leg the plan asks for, and its family is read from the table rather than handed in by the caller",
  );
  check(
    TELEMETRY_FAMILY.leg_report === "loop" &&
      TELEMETRY_FAMILY.offer_expired === "market" &&
      TELEMETRY_FAMILY.maroon_carried === "social" &&
      TELEMETRY_FAMILY.captain_left === "business",
    "the family table says what each event measures, so a reader asks for a family instead of matching on names",
  );
  // A record that has been through JSON, which is how the accumulator
  // stores one: the header, the captain lines and the events all have to
  // come back out of it.
  const telRecord: TelemetryRecord = {
    version: TELEMETRY_VERSION,
    voyageId: telVoyage,
    roomId: "harbor-1",
    voyageEpoch: 4,
    mode: "ocean_gambit",
    difficulty: "fair_winds",
    seats: 3,
    sampleRate: 1,
    openedAt: 1_700_000_000_000,
    startedAt: 1_700_000_000_500,
    endedAt: 1_700_000_090_000,
    outcome: "emptied",
    endedAtLeg: 9,
    captains: [
      {
        userId: "captain-a",
        presentAtEnd: false,
        marooned: true,
        muted: true,
        crewLost: true,
        peerTradeProfit: 1234,
      },
    ],
    events: [telPosted],
    truncated: false,
  };
  const telReadBack = normalizeRecord(JSON.parse(JSON.stringify(telRecord)));
  check(
    telReadBack !== null &&
      telReadBack.voyageId === telVoyage &&
      telReadBack.outcome === "emptied" &&
      telReadBack.endedAtLeg === 9 &&
      telReadBack.captains[0]?.presentAtEnd === false &&
      telReadBack.captains[0]?.marooned === true &&
      telReadBack.captains[0]?.muted === true &&
      telReadBack.captains[0]?.peerTradeProfit === 1234 &&
      telReadBack.events.length === 1,
    "and a record read back out of stored JSON keeps its header, its captains, the maroon, the mute and the peer ledger their lines carry, and its events",
  );
  check(
    normalizeRecord(null) === null &&
      normalizeRecord("record") === null &&
      normalizeRecord({}) === null,
    "while a row this build cannot read at all comes back as an absence rather than as an empty voyage",
  );
  const telStrange = normalizeRecord({
    voyageId: telVoyage,
    events: [telPosted, { name: "trade_settled", leg: 2 }],
    outcome: "sunk",
    captains: [{ presentAtEnd: true }, { userId: "captain-b" }],
  });
  check(
    telStrange !== null &&
      telStrange.events.length === 1 &&
      telStrange.outcome === "emptied" &&
      telStrange.captains.length === 1 &&
      telStrange.captains[0]?.userId === "captain-b",
    "and an event this build does not know, an outcome it does not know and a captain line with no captain in it are dropped or read as absence rather than carried",
  );
  // [I2: the two measurements most likely to be skipped] The peer ledger
  // on its own, which the Broker's verdict and the record's captain lines
  // both read through. A number is the number, a negative one included,
  // since a captain can come out of a voyage having paid out more than
  // they took; everything else is the absence of a ledger rather than a
  // ledger of zero.
  check(
    readPeerTradeProfit({ peerTradeProfit: 2200 }) === 2200 &&
      readPeerTradeProfit({ peerTradeProfit: -40 }) === -40 &&
      readPeerTradeProfit({}) === 0 &&
      readPeerTradeProfit({ peerTradeProfit: "2200" }) === 0 &&
      readPeerTradeProfit({ peerTradeProfit: Number.NaN }) === 0 &&
      readPeerTradeProfit(null) === 0 &&
      readPeerTradeProfit([2200]) === 0,
    "the peer ledger is read out of a save the way the rule reads it, so one reading of a save cannot become two numbers",
  );
  // The fields those two marks and the mute live on, on their way back
  // out of stored JSON, in the two shapes a reader can meet: a line an
  // older build wrote, which carries none of them, and a line whose
  // values are not the shapes this build writes. Both read as the absence
  // rather than as a hole, which is what lets a reader pass over a line
  // without special casing it.
  const telOlderLines = normalizeRecord({
    voyageId: telVoyage,
    captains: [
      { userId: "captain-a", presentAtEnd: true },
      {
        userId: "captain-b",
        presentAtEnd: false,
        marooned: "yes",
        muted: "yes",
        peerTradeProfit: Number.NaN,
      },
    ],
  });
  check(
    telOlderLines !== null &&
      telOlderLines.captains.length === 2 &&
      telOlderLines.captains[0]?.marooned === false &&
      telOlderLines.captains[0]?.muted === false &&
      telOlderLines.captains[0]?.peerTradeProfit === 0 &&
      telOlderLines.captains[1]?.marooned === false &&
      telOlderLines.captains[1]?.muted === false &&
      telOlderLines.captains[1]?.peerTradeProfit === 0,
    "and a captain line written before the voyage recorded any of them reads as a captain the harbor did not put ashore and did not silence, and who took nothing in trade, rather than as a line a reader has to guard",
  );

  // ---- The voyage that sails to its end ----
  // Every fixture below reads this process's own configuration, which is
  // the same file the server under test reads when both are run the way
  // the README says. A rate below one is refused here rather than
  // tolerated: these fixtures can only observe what was recorded, and a
  // suite that quietly recorded nothing would still report success.
  if (loadServerConfig().telemetrySampleRate < 1) {
    throw new Error(
      "The telemetry checks need every voyage recorded, so the server under test has to run with TELEMETRY_SAMPLE_RATE=1.",
    );
  }

  const telHome = await signUp("tel_a");
  const telMate = await signUp("tel_b");
  const telCast = await signUp("tel_c");
  const telDrift = await signUp("tel_d");
  const telWipe = await signUp("tel_e");
  run.extraAccounts.push(telHome, telMate, telCast, telDrift, telWipe);

  // One harbor, chartered, seated and started. The three fixtures differ
  // in what they then do to it rather than in how it comes into being,
  // so the shared part is written once: the room is opened through the
  // route a host uses, the rest of the crew joins by code, everyone takes
  // the channel, and the first of them sets sail.
  const telSail = async (
    label: string,
    crew: Captain[],
  ): Promise<{ roomId: string; crewSockets: Socket[] }> => {
    const opened = await call<{ room: { id: string; code: string } }>(
      "/api/rooms",
      {
        method: "POST",
        cookie: crew[0].cookie,
        body: JSON.stringify({
          name: `Smoke telemetry ${label} ${suffix}`,
          isPublic: false,
          mode: "ocean_gambit",
          unlock: LEDGER_PHRASE,
        }),
      },
    );
    if (opened.status !== 200) {
      throw new Error(`No harbor to record a ${label} voyage in.`);
    }
    const roomId = opened.body.room.id;
    const seats = await Promise.all(
      crew.slice(1).map((captain) =>
        call<{ room: { id: string } }>("/api/rooms/join", {
          method: "POST",
          cookie: captain.cookie,
          body: JSON.stringify({ code: opened.body.room.code }),
        }),
      ),
    );
    if (seats.some((seat) => seat.status !== 200)) {
      throw new Error(`A captain could not sit in the ${label} harbor.`);
    }
    const crewSockets: Socket[] = [];
    for (const captain of crew) {
      const socket = await openAuthedSocket(captain);
      run.sockets.push(socket);
      const aboard = waitForEvent<WireHistory>(
        socket,
        "chat:history",
        (payload) => payload?.roomId === roomId,
      );
      socket.emit("room:join", { roomId });
      await aboard;
      crewSockets.push(socket);
    }
    const departed = crewSockets.map((socket) =>
      waitForEvent<{ roomId?: string }>(
        socket,
        "room:started",
        (payload) => payload?.roomId === roomId,
      ),
    );
    crewSockets[0].emit("room:start", { roomId });
    await Promise.all(departed);
    return { roomId, crewSockets };
  };

  // A harbor reaches a leg the way it always does: a captain reports
  // where they are standing and the room's checkpoint follows the
  // furthest report. Nothing here is special to the spine, which is why
  // it is four lines and a wait rather than a fixture of its own.
  const telStand = async (
    socket: Socket,
    roomId: string,
    round: number,
    phase: Phase,
  ): Promise<void> => {
    socket.emit("game:status", {
      roomId: roomId,
      round,
      phase,
      phaseLabel: phase,
      gold: 100,
      reputation: 10,
      shipLevel: 0,
      gameOver: false,
      renownLevel: 3,
    });
    for (let waited = 0; waited < 5000; waited += 100) {
      const row = await db.room.findUnique({
        where: { id: roomId },
        select: { currentRound: true, currentPhase: true },
      });
      if (row?.currentRound === round && row.currentPhase === phase) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`The harbor never reached leg ${round} at ${phase}.`);
  };

  // The record as the server stored it, read the way a later reader reads
  // it: the columns it can be queried by, and the blob normalized back
  // into shape. A record that cannot be parsed at all reads as null here
  // rather than throwing, so a corrupt row is a failed check instead of a
  // suite that stopped early.
  const telStored = async (roomId: string) => {
    const rows = await db.voyageTelemetry.findMany({
      where: { roomId: roomId },
      select: {
        outcome: true,
        leg: true,
        sampleRate: true,
        voyageEpoch: true,
        record: true,
      },
    });
    // Read through the reader a later reader uses, rather than through a
    // parse of its own: a row that will not parse and a row whose shape
    // will not read are the same absence, and the suite has to see the
    // record the way the dashboard's own route sees it or it would be
    // checking a stricter reader than the one that ships.
    return rows.map((row) => ({
      row,
      record: readStoredRecord(row.record),
    }));
  };
  const telWaitForOne = async (roomId: string) => {
    for (let waited = 0; waited < 12000; waited += 250) {
      const found = await telStored(roomId);
      if (found.length) return found[0];
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return (await telStored(roomId))[0];
  };

  const sailRoom = await telSail("complete", [telHome, telMate, telCast]);
  const [sailHome, sailMate, sailCast] = sailRoom.crewSockets;
  const sailRoomId = sailRoom.roomId;

  // Leg one at the Parley, which is where a board opens and where both
  // votes below are called from.
  await telStand(sailHome, sailRoomId, 1, "parley");

  // ---- the market, all three of its lines ----
  // One offer taken, and one left standing to expire when the harbor
  // leaves the bartering phase.
  const takenBoard = waitForEvent<{ offers: WireOffer[] }>(
    sailMate,
    "barter:update",
    (payload) =>
      (payload?.offers ?? []).some((o) => o.fromUserId === telHome.id),
  );
  sailHome.emit("barter:post", {
    roomId: sailRoomId,
    offerItem: "Tea",
    offerAmount: 3,
    requestItem: "Silk",
    requestAmount: 2,
  });
  const takenOffer = (await takenBoard)?.offers.find(
    (o) => o.fromUserId === telHome.id,
  );
  check(
    takenOffer !== undefined,
    "a captain posts an offer in the harbor the record is being taken in",
  );
  const fulfilled = waitForEvent<{ accepterId?: string }>(
    sailHome,
    "barter:fulfilled",
    (payload) => payload?.accepterId === telMate.id,
  );
  sailMate.emit("barter:accept", {
    roomId: sailRoomId,
    offerId: takenOffer?.id,
  });
  check(
    (await fulfilled) !== null,
    "and another captain takes it, which is the one settlement a peer trade produces",
  );
  const standingBoard = waitForEvent<{ offers: WireOffer[] }>(
    sailMate,
    "barter:update",
    (payload) =>
      (payload?.offers ?? []).some((o) => o.fromUserId === telHome.id),
  );
  sailHome.emit("barter:post", {
    roomId: sailRoomId,
    offerItem: "Porcelain Clay",
    offerAmount: 5,
    requestItem: "Copper Ore",
    requestAmount: 4,
  });
  const standingOffer = (await standingBoard)?.offers.find(
    (o) => o.fromUserId === telHome.id,
  );
  check(
    standingOffer !== undefined,
    "a second offer is left on the board where nobody takes it",
  );

  // ---- talk, and the two figures only a captain's screen holds ----
  sailHome.emit("chat:room", {
    roomId: sailRoomId,
    content: "Leg one, good wind.",
  });
  sailMate.emit("chat:room", { roomId: sailRoomId, content: "Same to you." });
  const telLegReport = (
    socket: Socket,
    leg: number,
    ordersDealt: number,
    ordersFilled: number,
    distinctGoods: number,
    hold?: {
      holdSlots?: unknown;
      grainMeals?: unknown;
      saltFishMeals?: unknown;
      produceMeals?: unknown;
    },
    // [D6: Free Captain: Opportunist] The borrow counter rides here for
    // the reason the hold figures do: a report is a claim, and what the
    // checks below are about is what the spine does with one.
    ability?: { opportunistBorrows?: unknown },
    // [E1: the Supply Barge] The two counters the page's share is divided
    // from, filed here for the same reason and checked for one of their
    // own: they are kept as a pair, so a report carrying half of one is a
    // report the spine has nothing to divide and drops the half of.
    barge?: { foodSpend?: unknown; bargeSpend?: unknown },
  ) =>
    socket.emit("telemetry:leg", {
      roomId: sailRoomId,
      leg,
      ordersDealt,
      ordersFilled,
      distinctGoods,
      ...(hold ?? {}),
      ...(ability ?? {}),
      ...(barge ?? {}),
    });
  telLegReport(sailHome, 1, 3, 1, 2);
  // The same captain, the same leg, reporting again after filling another
  // order: the last report for a leg is the one kept, so this is the pair
  // of figures the record has to close with. The borrow counter rides the
  // second of the two, so a reader can tell that the replacement kept the
  // whole report rather than the three figures it was filed for.
  telLegReport(sailHome, 1, 4, 2, 3, undefined, {
    opportunistBorrows: 3.7,
  });
  telLegReport(sailMate, 1, 2, 2, 1, undefined, {
    opportunistBorrows: "three",
  });
  // Two claims outside the voyage's reach, which the spine refuses rather
  // than keeping: a leg it never got to, and a leg that does not exist at
  // all. Both are filed about a captain who never filed a report of their
  // own, so a refusal is the only way either could appear.
  telLegReport(sailCast, 99, 1, 1, 1);
  telLegReport(sailCast, 0, 1, 1, 1);
  await new Promise((resolve) => setTimeout(resolve, 300));

  // The Parley ends and the standing offer goes back to its poster, which
  // is the expired line. The checkpoint has to move forward off the table
  // for that to happen, so this stands the room at the phase after it on
  // this voyage's own lap, which is the one the room would open next.
  await telStand(sailHome, sailRoomId, 1, "resolve");
  await telStand(sailHome, sailRoomId, 2, "parley");
  // And a report filed one leg ahead of the harbor, which is the one leg
  // of slack the spine allows: a captain who has just finished counting a
  // leg is routinely ahead of a checkpoint that only moves when somebody
  // says they are standing at it. The same claim filed while the voyage
  // was still on leg one was refused, which is where the slack stops.
  //
  // [C4: three foods, spoilage and the split hold] That same report is
  // where the four figures a split hold adds ride. They are sent as a
  // number, a negative, a value that is not a number at all and one the
  // build never measured, so the spine's read of them is exercised rather
  // than assumed: a claim is floored and kept, a negative is clamped to
  // the empty hold it is, and a value that is not a number is dropped
  // rather than defaulted to a zero a reader would take for a real one.
  telLegReport(
    sailMate,
    3,
    5,
    0,
    4,
    {
      holdSlots: 27.9,
      grainMeals: 12,
      saltFishMeals: -4,
      produceMeals: "six",
    },
    // [D6: Free Captain: Opportunist] The borrow counter rides the same
    // report and the same spine reader as the four figures above, filed
    // as a negative here so the clamp is exercised rather than assumed.
    // It is deliberately not a report of its own: a second report for one
    // captain and one leg replaces the first, which would take the hold
    // figures off the record rather than add a figure to it.
    { opportunistBorrows: -2 },
    // [E1: the Supply Barge] The two counters the page's own share is
    // divided from, filed here as a fraction and a negative for the same
    // reason the figures above are: what the spine does with a claim has
    // to be exercised rather than read off the reader.
    { foodSpend: 240.9, bargeSpend: -3 },
  );
  // A claim carrying half the pair, filed about a leg the voyage reached,
  // which is the case the pair rule exists for: a lone numerator beside a
  // missing denominator is a number nobody can divide, so the spine drops
  // the half rather than keeping it and letting a reader divide by zero.
  telLegReport(sailHome, 2, 2, 1, 1, undefined, undefined, {
    foodSpend: 120,
  });
  await new Promise((resolve) => setTimeout(resolve, 300));

  // ---- the two votes, at their own rungs ----
  // Two of three carries both, and the record keeps the nominations and
  // the harbor's answer separately: the first is usage and the second is
  // the outcome.
  await telStand(sailHome, sailRoomId, 5, "parley");
  sailHome.emit("audit:vote", {
    roomId: sailRoomId,
    round: 5,
    targetUserId: telCast.id,
  });
  sailMate.emit("audit:vote", {
    roomId: sailRoomId,
    round: 5,
    targetUserId: telCast.id,
  });
  await new Promise((resolve) => setTimeout(resolve, 400));

  await telStand(sailHome, sailRoomId, 9, "parley");
  sailHome.emit("maroon:vote", {
    roomId: sailRoomId,
    round: 9,
    targetUserId: telCast.id,
  });
  sailMate.emit("maroon:vote", {
    roomId: sailRoomId,
    round: 9,
    targetUserId: telCast.id,
  });
  await new Promise((resolve) => setTimeout(resolve, 400));

  // ---- the captain who walks out ----
  // The ordinary Leave button, in the order the client sends it: the
  // route that gives up the seat, then the socket that says so. The
  // captain the harbor just put ashore is the one who goes, which is
  // what the retention figure reads later.
  const castSeat = await call<{ ok: boolean }>(
    `/api/rooms/${sailRoomId}/leave`,
    { method: "POST", cookie: telCast.cookie },
  );
  sailCast.emit("room:leave", { roomId: sailRoomId });
  const castMembership = await db.roomMember.findUnique({
    where: { userId_roomId: { userId: telCast.id, roomId: sailRoomId } },
    select: { id: true },
  });
  check(
    castSeat.status === 200 && castMembership === null,
    "a captain gives up their seat mid leg, through the same route the Leave button uses",
  );
  await new Promise((resolve) => setTimeout(resolve, 400));

  // ---- the ending ----
  const sailEnds = waitForEvent<{ roomId?: string }>(
    sailHome,
    "voyage:reveal",
    (payload) => payload?.roomId === sailRoomId,
    10000,
  );
  for (const socket of [sailHome, sailMate]) {
    socket.emit("game:status", {
      roomId: sailRoomId,
      round: 9,
      phase: "endgame",
      phaseLabel: "Voyage Complete",
      gold: 120,
      reputation: 20,
      shipLevel: 1,
      gameOver: true,
      renownLevel: 3,
      marooned: false,
    });
  }
  await sailEnds;

  const sailRow = await telWaitForOne(sailRoomId);
  const sailRecord = sailRow?.record ?? null;
  check(sailRecord !== null, "the voyage that concluded leaves a record");
  if (!sailRecord) {
    throw new Error("No recorded voyage to read the measurements off.");
  }
  const sailEvents = sailRecord.events;
  // The record's events, sorted by the name they carry. The event type is
  // a union keyed on that name, so reading a payload field off a line is
  // only sound once the name is spelled out: the filters below are what
  // tells the compiler which fields a line has.
  const sailLines = {
    advanced: sailEvents.filter((event) => event.name === "leg_advanced"),
    posted: sailEvents.filter((event) => event.name === "offer_posted"),
    filled: sailEvents.filter((event) => event.name === "offer_filled"),
    expired: sailEvents.filter((event) => event.name === "offer_expired"),
    talk: sailEvents.filter((event) => event.name === "message_sent"),
    auditAsked: sailEvents.filter((event) => event.name === "audit_asked"),
    auditCarried: sailEvents.filter((event) => event.name === "audit_carried"),
    maroonAsked: sailEvents.filter((event) => event.name === "maroon_asked"),
    maroonCarried: sailEvents.filter(
      (event) => event.name === "maroon_carried",
    ),
    left: sailEvents.filter((event) => event.name === "captain_left"),
    reports: sailEvents.filter((event) => event.name === "leg_report"),
  };
  const sailGoods = (list: ReadonlyArray<{ goods: number }>) =>
    list.reduce((sum, event) => sum + event.goods, 0);
  check(
    sailRow?.row.outcome === "concluded" &&
      sailRow?.row.leg === 9 &&
      sailRow?.row.sampleRate === loadServerConfig().telemetrySampleRate &&
      sailRow?.row.voyageEpoch === sailRecord.voyageEpoch,
    "and the columns it can be queried by say the same thing as the record inside them",
  );
  check(
    sailRecord.voyageId === voyageIdFor(sailRoomId, sailRecord.voyageEpoch) &&
      sailRecord.mode === "ocean_gambit" &&
      sailRecord.seats === 3 &&
      sailRecord.truncated === false,
    "the record is named by the voyage it belongs to, and carries the mode, the three seats it was dealt and no truncation",
  );
  check(
    sailRecord.openedAt <= sailRecord.startedAt &&
      sailRecord.startedAt <= sailRecord.endedAt,
    "and it is stamped in order, from the moment the harbor was charted to the moment the voyage closed, which is the two ends of the lobby fill time",
  );
  check(
    sailRecord.captains.length === 3 &&
      sailRecord.captains.filter((line) => line.presentAtEnd).length === 2 &&
      sailRecord.captains.find((line) => line.userId === telCast.id)
        ?.presentAtEnd === false,
    "every captain the voyage saw has a line, and the one who walked out is the one marked as gone at the end",
  );
  // [I2: the two measurements most likely to be skipped] The maroon, on
  // the captain the harbor actually voted ashore. It is the one field on
  // a line the server watched happen rather than read out of a save, and
  // it is a fact of its own beside the one above: this captain is gone
  // from the voyage *and* was put ashore, which is the pair the plan's
  // retention figure is read off. Of the captains this reads true for,
  // none were still there at the end, and that is the figure.
  check(
    sailRecord.captains.find((line) => line.userId === telCast.id)?.marooned ===
      true &&
      sailRecord.captains.filter((line) => line.marooned).length === 1 &&
      sailRecord.captains
        .filter((line) => line.marooned)
        .every((line) => line.presentAtEnd === false),
    "and the captain the harbor put ashore at leg nine is marked on their own line rather than left for a reader to join out of the events",
  );
  // The other field the same slice added, on a harbor whose captains
  // never wrote a save at all. Nothing here was read, so every line
  // carries the zero an unreadable save gives: the same reading, not a
  // missing number a reader would have to guard.
  check(
    sailRecord.captains.every((line) => line.peerTradeProfit === 0),
    "while a voyage whose captains never filed a save reads every peer ledger as the zero an unreadable save gives",
  );
  // The counts, one family at a time. The market's three lines count the
  // same side of an offer, so they have to add up: what was posted, less
  // what was filled and what expired, is what is still standing.
  check(
    sailLines.posted.length === 2 &&
      sailLines.filled.length === 1 &&
      sailLines.expired.length === 1 &&
      sailLines.filled[0]?.goods === 3 &&
      sailLines.expired[0]?.goods === 5 &&
      sailGoods(sailLines.posted) ===
        sailGoods(sailLines.filled) + sailGoods(sailLines.expired),
    "the market family records both offers, the one that was taken and the one that went back to its poster, and the three lines add up in the units their posters escrowed",
  );
  check(
    sailLines.talk.length === 2,
    "and the harbor's talk is counted once per message, from the captain who sent it",
  );
  check(
    sailLines.auditAsked.length === 2 &&
      sailLines.auditCarried.length === 1 &&
      sailLines.auditCarried[0]?.target === telCast.id &&
      sailLines.maroonAsked.length === 2 &&
      sailLines.maroonCarried.length === 1 &&
      sailLines.maroonCarried[0]?.target === telCast.id,
    "the social family keeps the two nominations and the one carried vote for each of the harbor's two votes, so usage and outcome are separate numbers",
  );
  check(
    sailLines.left.length === 1 &&
      sailLines.left[0]?.actor === telCast.id &&
      sailLines.left[0]?.leg === 9,
    "and the captain who gave up their seat is one abandonment, stamped with the leg it happened in",
  );
  check(
    sailLines.advanced.length === 3 &&
      sailLines.advanced.map((event) => event.leg).join(",") === "2,5,9",
    "the leg clock moves three times in a voyage that opens on leg one and ends on leg nine, and never twice for the same leg",
  );
  // The one report a client sends, and the two rules that keep it a
  // measurement rather than a chat log: one line per captain per leg,
  // and nothing from outside the voyage's own reach.
  const sailReports = sailLines.reports;
  const sailReportLines = sailReports.map(
    (event) => `${event.actor}:${event.leg}`,
  );
  check(
    sailReports.length === 4 &&
      new Set(sailReportLines).size === sailReports.length &&
      sailReportLines.includes(`${telHome.id}:1`) &&
      sailReportLines.includes(`${telHome.id}:2`) &&
      sailReportLines.includes(`${telMate.id}:1`) &&
      sailReportLines.includes(`${telMate.id}:3`),
    "one line per captain per leg is kept, and the four that were filed are the four that are there",
  );
  const homeLegOne = sailReports.find(
    (event) => event.actor === telHome.id && event.leg === 1,
  );
  check(
    homeLegOne?.ordersDealt === 4 &&
      homeLegOne?.ordersFilled === 2 &&
      homeLegOne?.distinctGoods === 3,
    "and a captain who reports the same leg twice closes it with the later figures, which is what a client that keeps trading produces",
  );
  // [C4: three foods, spoilage and the split hold] The four figures a
  // split hold adds to a report are claims like the three above them, and
  // the spine reads them the same way: a number is floored and kept, a
  // negative is clamped to the empty hold it describes, a value that is
  // not a number is dropped rather than read as a zero, and a report from
  // a leg that measured no hold leaves all four absent, which is how a
  // reader tells a survival voyage from one that never measured.
  const mateLegThree = sailReports.find(
    (event) => event.actor === telMate.id && event.leg === 3,
  );
  check(
    mateLegThree?.holdSlots === 27 &&
      mateLegThree?.grainMeals === 12 &&
      mateLegThree?.saltFishMeals === 0 &&
      mateLegThree?.produceMeals === undefined &&
      homeLegOne?.holdSlots === undefined &&
      homeLegOne?.grainMeals === undefined &&
      homeLegOne?.produceMeals === undefined,
    "and a hold reading on a report is a claim the spine floors, clamps or drops rather than a figure it trusts, while a leg that measured no hold carries none of the four",
  );
  // [D6: Free Captain: Opportunist] The borrow counter is read by that
  // same rule, and the three readings are the whole of it: a fraction
  // floors to the whole borrows it can stand for, a negative clamps to
  // the voyage that spent none, and a claim that is not a number at all
  // is dropped. The last is the one that matters most on this field,
  // because a zero here is a real reading rather than an empty one: it
  // says the allowance is unspent.
  const mateLegOne = sailReports.find(
    (event) => event.actor === telMate.id && event.leg === 1,
  );
  check(
    homeLegOne?.opportunistBorrows === 3 &&
      mateLegThree?.opportunistBorrows === 0 &&
      mateLegOne?.opportunistBorrows === undefined,
    "and the borrow counter rides the same reader, so a fraction floors to the whole borrows it stands for, a negative clamps to the voyage that spent none, and a value that is not a number is dropped rather than landing as a zero a reader could take for an unspent allowance",
  );
  // [E1: the Supply Barge] The two counters the page's share is divided
  // from are read by that same rule, and the fourth figure is the pair
  // rule itself: half a pair is dropped, so a reader dividing the two can
  // never be handed a numerator without its denominator.
  const homeLegTwo = sailReports.find(
    (event) => event.actor === telHome.id && event.leg === 2,
  );
  check(
    mateLegThree?.foodSpend === 240 &&
      mateLegThree?.bargeSpend === 0 &&
      homeLegOne?.foodSpend === undefined &&
      homeLegOne?.bargeSpend === undefined,
    "and the two food counters ride the same reader, so a fraction floors, a negative clamps to the voyage that spent nothing at the vendor, and a leg that measured neither carries neither rather than a pair of zeroes",
  );
  check(
    homeLegTwo?.foodSpend === undefined &&
      homeLegTwo?.bargeSpend === undefined &&
      homeLegTwo?.ordersDealt === 2,
    "while a claim carrying half the pair is dropped to nothing at all and takes nothing else with it, because a share of food spending is one number divided by another and the spine keeps neither half of a pair it cannot divide",
  );
  check(
    !sailReportLines.some(
      (line) => line.endsWith(":99") || line.endsWith(":0"),
    ),
    "while a claim about a leg the voyage never reached, and one about a leg that does not exist, are refused rather than written down",
  );
  // The one invariant that covers every event in the record: nothing can
  // sit on a leg the voyage had not got to, and the only events allowed
  // to run one leg ahead are the captain's own reports, which is the
  // slack the client's own counting needs.
  const sailReached = new Set([
    1,
    ...sailLines.advanced.map((event) => event.leg),
  ]);
  check(
    sailEvents.every(
      (event) =>
        event.leg >= 1 &&
        event.leg <= sailRecord.endedAtLeg + 1 &&
        (sailReached.has(event.leg) || event.name === "leg_report"),
    ),
    "and every event in the record sits on a leg the voyage reached, or on the one leg its captain was allowed to be ahead on",
  );

  // ---- The two readings a captain's line carries ----
  // Both are read off harbors this run sailed earlier rather than off
  // fixtures of their own, because the point of each field is that it
  // carries something the game already decided with rather than something
  // a measurement invented.
  //
  // The first is the reveal harbor, which concluded with a Broker handed
  // exactly the ledger their own verdict turns on. That harbor is
  // restarted after the voyage ends, and the restart writes no second
  // record: the voyage it belonged to was already closed.
  const revLedgered =
    (await telStored(revRoomId)).find(
      (row) => row.record?.outcome === "concluded",
    )?.record ?? null;
  check(
    revLedgered !== null &&
      revLedgered.captains.find((line) => line.userId === revBroker.id)
        ?.peerTradeProfit === BROKER_PAYOUT_TARGET,
    "a captain's line carries the peer ledger their own save held, which is the number the Broker's verdict was decided on",
  );
  // The two absences a reader meets on the same lines: a save that is
  // there and holds no ledger, and a seat with no save at all. Neither is
  // a hole in the record.
  check(
    revLedgered !== null &&
      revLedgered.captains.find((line) => line.userId === revPirate.id)
        ?.peerTradeProfit === 0 &&
      revLedgered.captains.find((line) => line.userId === revNew.id)
        ?.peerTradeProfit === 0,
    "while a save holding no peer ledger and a captain with no save at all both read zero rather than a missing number",
  );
  // The maroon is the server's own fact rather than a client's claim, so
  // a captain reporting a maroon the harbor never called reaches the
  // record as it is rather than as it was reported: the same claim the
  // conclusion refuses, read here off the line it would have had to move
  // to be believed.
  check(
    revLedgered !== null &&
      revLedgered.captains.every((line) => line.marooned === false),
    "and a voyage that voted nobody ashore marks nobody, the captain who reported one included",
  );

  // The second is the six captain harbor that voted a captain ashore and
  // was then wiped by its host. This is the ending the mark exists for:
  // there is no conclusion to read it off, and the captain is still
  // standing in the harbor it happened in, which is the other half of the
  // retention figure the concluded voyage above carries.
  const maroonWiped =
    (await telStored(maroonRoomId)).find(
      (row) => row.record?.outcome === "restarted",
    )?.record ?? null;
  check(
    maroonWiped !== null &&
      maroonWiped.captains.find((line) => line.userId === maroonTargetId)
        ?.marooned === true &&
      maroonWiped.captains.filter((line) => line.marooned).length === 1 &&
      maroonWiped.captains.every((line) => line.presentAtEnd === true),
    "and a voyage its host wiped still carries the captain the harbor put ashore, since an ending with no conclusion is the one a mark derived from the events would have lost",
  );

  // ---- The voyage that is abandoned mid leg ----
  // One captain, alone in a harbor of their own, who walks out at leg
  // two. This is the plan's deliberately broken voyage, and the point of
  // it is that the record survives the harbor: the room is deleted the
  // moment its last seat goes, and a measurement that vanished with it
  // would read as a harbor where nobody ever abandons anything.
  const driftRoom = await telSail("abandoned", [telDrift]);
  const [driftSolo] = driftRoom.crewSockets;
  await telStand(driftSolo, driftRoom.roomId, 2, "parley");
  const driftLeft = await call<{ ok: boolean }>(
    `/api/rooms/${driftRoom.roomId}/leave`,
    { method: "POST", cookie: telDrift.cookie },
  );
  driftSolo.emit("room:leave", { roomId: driftRoom.roomId });
  const driftRoomRow = await db.room.findUnique({
    where: { id: driftRoom.roomId },
    select: { id: true },
  });
  check(
    driftLeft.status === 200 && driftRoomRow === null,
    "a harbor whose last seat is given up stops existing, which is the case a record has to outlive",
  );
  const driftRow = await telWaitForOne(driftRoom.roomId);
  const driftRecord = driftRow?.record ?? null;
  check(
    driftRecord !== null && driftRecord.outcome === "emptied",
    "and the voyage it was sailing leaves a record that says the harbor emptied out from under it",
  );
  if (!driftRecord) {
    throw new Error("No abandoned voyage to read the measurements off.");
  }
  check(
    driftRecord.endedAtLeg === 2 &&
      driftRecord.seats === 1 &&
      driftRecord.captains.length === 1 &&
      driftRecord.captains[0]?.userId === telDrift.id &&
      driftRecord.captains[0]?.presentAtEnd === false,
    "the record explains where the voyage stopped: leg two, one captain, and nobody in the harbor when it closed",
  );
  // The two fields goal I2 added on the ending with nothing to read them
  // from: the harbor emptied, so there is no conclusion and no save left
  // in the room, and the line still reads as a captain who was not put
  // ashore and who took nothing in trade. The same zero the concluded
  // voyage's unread captains get, which is what makes the field a reading
  // rather than a hole in the record.
  check(
    driftRecord.captains.every(
      (line) => line.marooned === false && line.peerTradeProfit === 0,
    ),
    "and it carries the two fields of a captain line as readings even though there was no conclusion to take them from",
  );
  const driftEvents = driftRecord.events;
  check(
    driftEvents.filter((event) => event.name === "leg_advanced").length === 1 &&
      driftEvents.filter(
        (event) =>
          event.name === "captain_left" &&
          event.actor === telDrift.id &&
          event.leg === 2,
      ).length === 1,
    "and it carries the leg the voyage reached and the abandonment that ended it",
  );

  // ---- The voyage its host wipes ----
  // A restart is the third way a voyage stops, and the one that has to
  // prove forgetting as well as writing: the record is closed by the
  // frame that reopens the harbor, and nothing the harbor does afterwards
  // belongs to it.
  const wipeRoom = await telSail("wiped", [telWipe]);
  const [wipeSolo] = wipeRoom.crewSockets;
  await telStand(wipeSolo, wipeRoom.roomId, 2, "parley");
  wipeSolo.emit("chat:room", {
    roomId: wipeRoom.roomId,
    content: "Wreck ahead.",
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const wipeFrame = waitForEvent<{ roomId?: string }>(
    wipeSolo,
    "room:restarted",
    (payload) => payload?.roomId === wipeRoom.roomId,
    8000,
  );
  wipeSolo.emit("room:restart", { roomId: wipeRoom.roomId });
  check((await wipeFrame) !== null, "a host wipes the voyage they are sailing");
  const wipeRow = await telWaitForOne(wipeRoom.roomId);
  const wipeRecord = wipeRow?.record ?? null;
  check(
    wipeRecord !== null &&
      wipeRecord.outcome === "restarted" &&
      wipeRecord.endedAtLeg === 2 &&
      wipeRecord.captains[0]?.presentAtEnd === true,
    "and the record says the voyage was wiped at leg two, with the captain who wiped it still standing in the harbor",
  );
  check(
    wipeRecord !== null &&
      wipeRecord.captains[0]?.marooned === false &&
      wipeRecord.captains[0]?.peerTradeProfit === 0,
    "with the two fields of their line read the same way, since a harbor that voted nobody ashore and left no save to read reads exactly this",
  );
  check(
    wipeRecord !== null &&
      wipeRecord.events.some((event) => event.name === "message_sent") &&
      wipeRecord.events.filter((event) => event.name === "leg_advanced")
        .length === 1,
    "carrying what happened before the wipe rather than only the wipe itself",
  );
  // The harbor is live again and the spine has forgotten it: a report
  // filed into the reopened lobby lands nowhere, which is the difference
  // between a record that was closed and one that was merely written
  // down so far.
  const wipeStored = wipeRow?.row.record ?? "";
  wipeSolo.emit("telemetry:leg", {
    roomId: wipeRoom.roomId,
    leg: 1,
    ordersDealt: 9,
    ordersFilled: 9,
    distinctGoods: 9,
  });
  wipeSolo.emit("chat:room", {
    roomId: wipeRoom.roomId,
    content: "New voyage.",
  });
  await new Promise((resolve) => setTimeout(resolve, 600));
  const wipeAfter = await telStored(wipeRoom.roomId);
  check(
    wipeAfter.length === 1 && wipeAfter[0]?.row.record === wipeStored,
    "and the voyage that follows is a new one: nothing after the wipe reaches the record that was closed, and no second record is written",
  );

  return { telHome, telSail, telStand, telWaitForOne };
}
