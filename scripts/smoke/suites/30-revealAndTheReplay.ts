// PortMasters 2.2 Parallel Release, smoke run: The reveal and the replay ledger.

import { db } from "@/lib/db";
import { flourishDeck } from "@/lib/game/gambit";
import { checkSave } from "@/lib/game/integrity";
import { drawObjective, objectiveSeed } from "@/lib/game/objectives";
import { unlockedPorts } from "@/lib/game/pools";
import {
  BROKER_PAYOUT_TARGET,
  PIRATE_STANDING_FLOOR,
} from "@/lib/game/victory";
import {
  LEDGER_PHRASE,
  call,
  check,
  openAuthedSocket,
  signUp,
  suffix,
  waitForEvent,
} from "../harness";
import type { Captain, WireHistory, WireReveal } from "../wire";
import type { Socket } from "socket.io-client";
import type { SmokeRun } from "../run";

export async function revealAndTheReplaySuite(run: SmokeRun): Promise<{
  revBroker: { id: string; token: string; cookie: string; username: string };
  revNew: { id: string; token: string; cookie: string; username: string };
  revPirate: { id: string; token: string; cookie: string; username: string };
  revRoomId: string;
}> {
  // H8, and the reason the mode is worth playing: a voyage spends an
  // hour defending one secret and then turns every card face up at once.
  // This section sails a harbor of its own to watch that happen, and it
  // has to be one of its own. A reveal names every alignment at its
  // table, which is exactly what the sweep in the private information
  // spine above forbids in the harbor that sweep is watching, so putting
  // the two in one room would mean weakening the sharpest check in this
  // file to make room for the feature that needs the rule relaxed.
  //
  // The hand is written rather than drawn, the way the fleet commission's
  // section writes its own, so every verdict below is known before the
  // voyage ends. Five seats cover what the ledger has to get right: every
  // card the deck holds, a seat the hand never reached, and a finish the
  // integrity pass refuses to read.

  const revHonest = await signUp("revhon");
  const revPirate = await signUp("revpir");
  const revBroker = await signUp("revbro");
  const revNew = await signUp("revnew");
  const revForged = await signUp("revfake");
  const revCrew = [revHonest, revPirate, revBroker, revNew, revForged];
  run.extraAccounts.push(...revCrew);

  const revRoom = await call<{ room: { id: string; code: string } }>(
    "/api/rooms",
    {
      method: "POST",
      cookie: revHonest.cookie,
      body: JSON.stringify({
        name: `Smoke reveal harbor ${suffix}`,
        isPublic: false,
        mode: "ocean_gambit",
        unlock: LEDGER_PHRASE,
      }),
    },
  );
  if (revRoom.status !== 200) {
    throw new Error("No reveal harbor to test with, stopping here.");
  }
  const revRoomId = revRoom.body.room.id;
  const revTaken = await Promise.all(
    revCrew.slice(1).map((captain) =>
      call<{ room: { id: string } }>("/api/rooms/join", {
        method: "POST",
        cookie: captain.cookie,
        body: JSON.stringify({ code: revRoom.body.room.code }),
      }),
    ),
  );
  check(
    revTaken.every((seat) => seat.status === 200),
    "five captains take a harbor of their own to watch the cards come down in",
  );

  // Every socket listens for the reveal from the moment it takes its
  // seat, and each seat's copies are kept apart, so the frame under test
  // is one this harbor actually broadcast to this captain rather than
  // one asked for afterwards.
  const revSockets: Socket[] = [];
  const revSeen = new Map<string, WireReveal[]>();
  for (const captain of revCrew) {
    const socket = await openAuthedSocket(captain);
    run.sockets.push(socket);
    revSeen.set(captain.id, []);
    socket.on("voyage:reveal", (payload: WireReveal) => {
      revSeen.get(captain.id)?.push(payload);
    });
    const seatedHere = waitForEvent<WireHistory>(
      socket,
      "chat:history",
      (payload) => payload?.roomId === revRoomId,
    );
    socket.emit("room:join", { roomId: revRoomId });
    await seatedHere;
    revSockets.push(socket);
  }
  const revHeld = () => [...revSeen.values()].flat();

  // The voyage sets sail, which deals the harbor a hand and pins its size
  // the way any real voyage does. What that hand is does not matter
  // below, because every card in it is overwritten a few lines down.
  revSockets[0].emit("room:start", { roomId: revRoomId });
  await new Promise((resolve) => setTimeout(resolve, 800));
  check(
    (await db.voyageRole.count({ where: { roomId: revRoomId } })) ===
      revCrew.length,
    "the departure deals this harbor one card per seat",
  );
  check(
    revHeld().length === 0,
    "and a voyage in flight tells the room nothing about any of them, however loud its own ending will be",
  );

  // The commission this harbor is working on, drawn here the way every
  // client draws it: from the room's own id, epoch and pinned size, with
  // no captain's name anywhere in the seed. The flourish comes off that
  // commission's own deck for the same reason, since a goal about the
  // goods a fleet is not being asked for is a goal the mode never deals.
  const revRoomRow = await db.room.findUnique({
    where: { id: revRoomId },
    select: { voyageEpoch: true, voyageSeats: true },
  });
  const revSeatCount = revRoomRow?.voyageSeats ?? 0;
  const revObjective = drawObjective(
    objectiveSeed(revRoomId, revRoomRow?.voyageEpoch ?? 0, revSeatCount),
    revSeatCount,
  );
  const revFlourish = flourishDeck(revObjective.id)[0];
  const revSet = (
    userId: string,
    role: string,
    flourish: string | null = null,
  ) =>
    db.voyageRole.upsert({
      where: { roomId_userId: { roomId: revRoomId, userId } },
      create: { roomId: revRoomId, userId, role, flourish },
      update: { role, flourish },
    });
  await revSet(revHonest.id, "honest", revFlourish.id);
  await revSet(revPirate.id, "pirate");
  await revSet(revBroker.id, "broker");
  await revSet(revForged.id, "honest");
  // And the seat the hand never reached. The departure dealt them a card
  // like everybody else, so this is a deal being taken back rather than a
  // row that was never written: a captain who takes a berth after the
  // cards are down is a captain the mode has nothing to say about, and
  // the ledger has to be able to draw that seat.
  await db.voyageRole.deleteMany({
    where: { roomId: revRoomId, userId: revNew.id },
  });
  check(
    (await db.voyageRole.count({ where: { roomId: revRoomId } })) ===
      revCrew.length - 1,
    "and one of the five is taken back, leaving a table of five with four cards on it",
  );

  // The commission's own goods, so every figure below is one the board
  // could have carried. What a leg is short by is read off the drawn
  // commission rather than written down, because the quotas scale with
  // the fleet that was dealt them, and a hard coded number would be a
  // full delivery at one table size and short of it at another.
  //
  // The two captains who keep a trace disagree about what the fleet had
  // handed over, which is the case the merge exists for: their clients
  // wrote the harbor's number down at different moments, and the ledger
  // reads the higher of the two at every leg.
  const [revA, revB] = revObjective.resources;
  const revShortA = Math.max(0, revA.required - 1);
  const revShortB = Math.max(0, revB.required - 1);
  const revTrace = (
    early: Record<string, number>,
    late: Record<string, number>,
  ) => [
    { round: 1, at: Date.now(), delivered: early },
    { round: 3, at: Date.now(), delivered: late },
  ];
  const revSave = (cookie: string, data: Record<string, unknown>) =>
    call<{ ok: boolean }>("/api/game/state", {
      method: "PUT",
      cookie,
      body: JSON.stringify({ roomId: revRoomId, data }),
    });
  // The merchant's record ends with one good filled and none of the
  // second, which is a commission the fleet fell short of, and a short
  // commission is the one thing that decides the Pirate's voyage. The
  // met flag is read from this captain's own last recorded leg, so the
  // shortfall is arranged here rather than hoped for.
  const revFilled = await revSave(revHonest.cookie, {
    objectiveDelivered: { [revA.type]: revA.required },
    objectiveTrace: revTrace(
      { [revA.type]: 2 },
      { [revA.type]: revA.required },
    ),
    // An order fulfillment, so the ledger has a trade with a name, a leg
    // and a port on it rather than only a total.
    orderFills: [
      {
        round: 2,
        port: unlockedPorts("monsoon", 2)[0],
        items: [{ type: revA.type, qty: 2 }],
        reward: 40,
      },
    ],
  });
  const revBehind = await revSave(revPirate.cookie, {
    objectiveTrace: revTrace(
      { [revA.type]: 4 },
      { [revA.type]: revShortA, [revB.type]: revShortB },
    ),
  });
  // The ledger a Broker's verdict turns on, which is the one ending
  // figure a client is trusted for.
  const revBrokerHand = await revSave(revBroker.cookie, {
    peerTradeProfit: BROKER_PAYOUT_TARGET,
  });
  // And the forger's own record, which is written for one reason: the
  // ledger has to be seen dropping a book it could have read. With no
  // save on this row the two fields asserted below would be empty
  // because there was nothing to read rather than because the forgery
  // was refused, which is a check that cannot fail.
  const revForgedSave = await revSave(revForged.cookie, {
    objectiveDelivered: { [revA.type]: revA.required },
    peerTradeProfit: BROKER_PAYOUT_TARGET + 500,
    orderFills: [
      {
        round: 4,
        port: unlockedPorts("monsoon", 4)[0],
        items: [{ type: revA.type, qty: 3 }],
        reward: 60,
      },
    ],
  });
  const revForgedRow = await db.gameState.findUnique({
    where: { userId_roomId: { userId: revForged.id, roomId: revRoomId } },
    select: { data: true },
  });
  check(
    revFilled.status === 200 &&
      revBehind.status === 200 &&
      revBrokerHand.status === 200 &&
      revForgedSave.status === 200,
    "and the harbor's own clients have a record of the commission to read back",
  );
  check(
    revForgedRow?.data?.includes(String(BROKER_PAYOUT_TARGET + 500)) === true,
    "including the forger's, whose book really did reach the row the ledger would have read it from",
  );

  // A finish no voyage could have produced, proved here rather than
  // assumed. The number below is the fixture's, and the ceilings the
  // pass derives from the live game data are orders of magnitude under
  // it at any voyage length, so the disqualification further down is the
  // rule deciding rather than this table's difficulty happening to hide
  // a forgery that was not one.
  const revImpossible = checkSave({ money: 99_999_999 }, 12);
  check(
    revImpossible.severity === "impossible",
    "the finish this fixture reports as a forgery is one no harbor could have paid",
  );

  // Every finisher reports. Two of the five carry a mark of their own:
  // one claims a maroon the harbor never voted on, which is the claim
  // the conclusion must not believe, and one reports an honest
  // bankruptcy.
  const revReports: {
    captain: Captain;
    gold: number;
    reputation: number;
    bankrupt: boolean;
    marooned: boolean;
  }[] = [
    {
      captain: revHonest,
      gold: 120,
      reputation: 30,
      bankrupt: false,
      marooned: false,
    },
    {
      captain: revPirate,
      gold: 200,
      reputation: PIRATE_STANDING_FLOOR + 10,
      bankrupt: false,
      marooned: false,
    },
    {
      captain: revBroker,
      gold: 150,
      reputation: 25,
      bankrupt: false,
      marooned: true,
    },
    {
      captain: revNew,
      gold: 100,
      reputation: 20,
      bankrupt: true,
      marooned: false,
    },
    {
      captain: revForged,
      gold: 99_999_999,
      reputation: 40,
      bankrupt: false,
      marooned: false,
    },
  ];
  // The harbor's own copy of those reports, taken off the broadcast
  // rather than from the fixture, so a check below can prove a claim
  // reached the server before another says the server did not believe
  // it. The frame names its captain through the public user it carries,
  // the way every status frame does, rather than a bare id.
  const revStatuses: { user?: { id?: string }; marooned?: boolean }[] = [];
  revSockets[0].on(
    "game:status",
    (payload: { user?: { id?: string }; marooned?: boolean }) =>
      revStatuses.push(payload),
  );
  for (const { captain, gold, reputation, bankrupt, marooned } of revReports) {
    revSockets[revCrew.indexOf(captain)].emit("game:status", {
      roomId: revRoomId,
      round: 6,
      phase: "endgame",
      phaseLabel: "Voyage Complete",
      gold,
      reputation,
      shipLevel: 2,
      gameOver: true,
      bankrupt,
      marooned,
    });
  }
  check(
    revHeld().length === 0,
    "no report is a reveal, since the ledger is the conclusion's to send",
  );

  // The conclusion writes behind the last report rather than inside it,
  // so the frame is waited for rather than slept past: a fixed pause long
  // enough on this machine is the kind of check that fails the first time
  // it runs somewhere slower. The wait is for the last socket rather than
  // the first, because one broadcast lands on five of them in its own
  // time and the claim under test is about the whole table: reading the
  // frame off whichever seat happened to hear it first and then counting
  // the others would be asserting on a race.
  const revArrived = () =>
    revCrew.every((captain) => (revSeen.get(captain.id)?.length ?? 0) > 0);
  for (let waited = 0; !revArrived() && waited < 10000; waited += 250) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const revPaid = revSeen.get(revPirate.id)?.[0];
  check(
    revPaid?.roomId === revRoomId,
    "a concluded voyage turns every card over to the room",
  );
  check(
    revArrived(),
    "every seat at the table was told, rather than the one the frame was read off",
  );
  check(
    revCrew.every((captain) => revSeen.get(captain.id)?.length === 1),
    "once per captain at the table, so every seat is told the whole hand rather than a share of it",
  );
  const revOf = (captain: Captain) =>
    revPaid?.captains.find((row) => row.userId === captain.id);
  check(
    revPaid?.captains.length === revCrew.length &&
      revCrew.every((captain) => revOf(captain) !== undefined),
    "and the ledger names every finisher at the table",
  );
  check(
    revPaid?.captains[0]?.userId === revPirate.id,
    "read back in the order the standings were, so the first card the table sees is the crowned one",
  );
  check(
    revPaid?.objective.id === revObjective.id,
    `and draws the commission the harbor was actually working on (${revObjective.id})`,
  );

  // The cards themselves. The hand was written above, so each row is the
  // captain it was written for and the verdict is the one the rule owes
  // them: the Pirate wins a commission the fleet fell short of and takes
  // the crown with it, the Broker wins on a ledger the fleet's failure
  // cannot touch, and the Honest captain of a short commission wins
  // nothing whatever their own goal did.
  check(
    revOf(revPirate)?.role === "pirate" &&
      revOf(revPirate)?.won === true &&
      revOf(revPirate)?.crowned === true,
    "the reveal names the Pirate, who wins the voyage the fleet did not finish and is crowned for it",
  );
  check(
    revOf(revBroker)?.role === "broker" &&
      revOf(revBroker)?.won === true &&
      revOf(revBroker)?.crowned === false,
    "and the Broker, who wins beside them on coin taken from the table rather than on the commission",
  );
  check(
    revOf(revHonest)?.role === "honest" &&
      revOf(revHonest)?.flourishId === revFlourish.id &&
      revOf(revHonest)?.won === false,
    "while an Honest card on a commission that fell short wins nothing, with the goal it was dealt named beside it",
  );
  check(
    revOf(revNew)?.role === null &&
      revOf(revNew)?.won === false &&
      revOf(revNew)?.bankrupt === true,
    "and a seat the hand never reached is drawn holding no card, and is judged on none",
  );
  check(
    revOf(revForged)?.forged === true && revOf(revForged)?.won === false,
    "a finish the ledger could not read is marked as a forgery and wins nothing",
  );
  check(
    Object.keys(revOf(revForged)?.delivered ?? { read: 1 }).length === 0 &&
      revOf(revForged)?.fills.length === 0 &&
      revOf(revForged)?.peerTradeProfit === 0,
    "and contributes no goods, no trades and no peer profit to it, since a forged book is not a book",
  );
  // The two halves of the maroon: that the claim really arrived, and that
  // the ledger did not take it. Read in that order for the reason the
  // save above was written at all, so the second check cannot pass
  // because the first never happened.
  check(
    revStatuses.some(
      (frame) => frame.user?.id === revBroker.id && frame.marooned === true,
    ),
    "the harbor did read the Broker's claim of a maroon nobody voted on",
  );
  check(
    revOf(revBroker)?.marooned === false,
    "and the ledger hands them none, since a vote is the harbor's own record rather than a captain's report",
  );

  // The curve. Two clients kept a record of the same commission and
  // disagreed about it, and what goes on the wire is one story rather
  // than two: the higher figure at each leg, in leg order.
  check(
    revPaid?.fleetTrace.length === 2 &&
      revPaid.fleetTrace[0]?.round === 1 &&
      revPaid.fleetTrace[1]?.round === 3,
    "the fleet's commission is read back leg by leg, in the order the voyage sailed it",
  );
  check(
    revPaid?.fleetTrace[0]?.delivered[revA.type] === 4,
    "and a leg two clients recorded differently reads as the further along of the two",
  );
  check(
    revPaid?.fleetTrace[1]?.delivered[revA.type] === revA.required &&
      revPaid?.fleetTrace[1]?.delivered[revB.type] === revShortB,
    "while the last leg is neither captain's copy of it, taking one good from the merchant's record and the other from the pirate's",
  );
  check(
    revOf(revHonest)?.delivered[revA.type] === revA.required &&
      revOf(revHonest)?.fills.length === 1 &&
      revOf(revHonest)?.fills[0]?.round === 2,
    "and each captain's own contribution and the trades left on their record are attributed to their own row",
  );

  // And the half a reloading captain gets. The voyage is over, so the
  // reveal is the only way a browser that arrives after it can be told
  // what the table saw, and the hand out is the same door the audit's
  // reveal and the commission's board come through.
  const revRejoin = await openAuthedSocket(revBroker);
  run.sockets.push(revRejoin);
  const revHanded = waitForEvent<WireReveal>(
    revRejoin,
    "voyage:reveal",
    (payload) => payload?.roomId === revRoomId,
  );
  revRejoin.emit("room:join", { roomId: revRoomId });
  const revBack = await revHanded;
  check(
    revBack !== null &&
      revBack.captains.length === revCrew.length &&
      revBack.captains.some((row) => row.userId === revPirate.id),
    "a captain who reloads onto the finished voyage is handed the same ledger the room watched",
  );

  // And a restarted voyage hands nobody the last one's cards, which is
  // the only way this frame could lie: it refuses nothing, so a harbor
  // that kept it would tell its next table a story about other people.
  revSockets[0].emit("room:restart", { roomId: revRoomId });
  const revStale = await (async () => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const socket = await openAuthedSocket(revNew);
    run.sockets.push(socket);
    const frame = waitForEvent<WireReveal>(
      socket,
      "voyage:reveal",
      (payload) => payload?.roomId === revRoomId,
      1200,
    );
    socket.emit("room:join", { roomId: revRoomId });
    return frame;
  })();
  check(
    revStale === null,
    "and a voyage that has restarted hands out no cards at all, since the hand it would show belongs to a voyage nobody sailed",
  );

  return { revBroker, revNew, revPirate, revRoomId };
}
