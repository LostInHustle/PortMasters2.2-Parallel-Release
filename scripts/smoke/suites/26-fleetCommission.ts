// PortMasters 2.2 Parallel Release, smoke run: The fleet commission.

import { db } from "@/lib/db";
import {
  PRODUCTS_TIER0,
  RESOURCES_TIER0,
  STARTING_STOCK,
} from "@/lib/game/constants/goods";
import {
  OBJECTIVE_DECK,
  drawObjective,
  objectiveSeed,
  objectiveTotalItems,
} from "@/lib/game/objectives";
import { BROKER_PAYOUT_TARGET } from "@/lib/game/victory";
import { call, check, openAuthedSocket, waitForEvent } from "../harness";
import type { WireHistory } from "../wire";
import type { Socket } from "socket.io-client";
import type { SmokeRun } from "../run";

export async function fleetCommissionSuite(
  run: SmokeRun,
  inputs: {
    classicRoomId: string;
    gambitFourth: {
      id: string;
      token: string;
      cookie: string;
      username: string;
    };
    gambitHost: { id: string; token: string; cookie: string; username: string };
    gambitRoomId: string;
    gambitSecond: {
      id: string;
      token: string;
      cookie: string;
      username: string;
    };
    gambitThird: {
      id: string;
      token: string;
      cookie: string;
      username: string;
    };
    seated: {
      captain: {
        id: string;
        token: string;
        cookie: string;
        username: string;
      };
      socket: Socket;
      frames: { event: string; text: string }[];
    }[];
    secret: string;
  },
): Promise<void> {
  const {
    classicRoomId,
    gambitFourth,
    gambitHost,
    gambitRoomId,
    gambitSecond,
    gambitThird,
    seated,
    secret,
  } = inputs;
  // Ocean Gambit's one public surface, and the contrast with the section
  // above is the point of both: the alignment is a secret defended all
  // the way to the wire, and this is a shared number that only has to be
  // un-inflatable. So these checks are about the deck holding its own
  // authoring rule, about every captain hearing the same board, and about
  // a doctored report not moving it.

  // ---- The deck, which needs no sockets ----
  const foundingTier = new Set<string>([...RESOURCES_TIER0, ...PRODUCTS_TIER0]);
  const openingHold = Object.values(STARTING_STOCK).reduce(
    (sum, held) => sum + held,
    0,
  );
  check(
    OBJECTIVE_DECK.every((objective) =>
      objective.resources.every((r) => foundingTier.has(r.type)),
    ),
    "every commission asks only for goods the founding tier can put on the table",
  );
  check(
    OBJECTIVE_DECK.every((objective) =>
      objective.resources.some(
        (r) => r.required > (STARTING_STOCK[r.type] ?? 0),
      ),
    ),
    "and every one asks for more of some good than a hold begins the voyage with",
  );
  check(
    OBJECTIVE_DECK.every(
      (objective) =>
        objective.resources.length >= 2 &&
        objectiveTotalItems(objective) > openingHold,
    ),
    "so no captain can fill one alone, and none of them is one round's work",
  );
  check(
    drawObjective(objectiveSeed("harbor-a", 3)).id ===
      drawObjective(objectiveSeed("harbor-a", 3)).id,
    "one harbor draws the same commission twice",
  );
  check(
    objectiveSeed("harbor-a", 3) === "harbor-a:V3:objective",
    "and its seed is the harbor and the voyage with no captain anywhere in it",
  );
  const voyageDraws = new Set(
    Array.from(
      { length: 40 },
      (_, epoch) => drawObjective(objectiveSeed("harbor-a", epoch)).id,
    ),
  );
  check(
    voyageDraws.size > 1,
    "a run of voyages pulls more than one entry off the deck",
  );

  // ---- The board, over the wire ----
  // A socket holds one harbor at a time, so the four captains sail back
  // into the Gambit room to report there. The commission is drawn here
  // the way both the server and a client draw it, from the harbor and
  // the voyage, which is also what makes the clamp check below a
  // statement about the two of them agreeing.
  const gambitNow = await db.room.findUnique({
    where: { id: gambitRoomId },
    select: { voyageEpoch: true },
  });
  const commission = drawObjective(
    objectiveSeed(gambitRoomId, gambitNow?.voyageEpoch ?? 0),
  );
  const owed = commission.resources[0];

  const backInHarbor = seated.map((seat) =>
    waitForEvent<WireHistory>(
      seat.socket,
      "chat:history",
      (payload) => payload?.roomId === gambitRoomId,
    ),
  );
  for (const seat of seated) {
    seat.socket.emit("room:join", { roomId: gambitRoomId });
  }
  await Promise.all(backInHarbor);

  const boardOn = (socket: Socket) =>
    waitForEvent<{
      roomId: string;
      total: Record<string, number>;
    }>(
      socket,
      "objective:progress",
      (payload) => payload?.roomId === gambitRoomId,
      4000,
    );

  // Every socket in the harbor is listened to at once, because a board
  // that reached only the captain who moved would still look right to
  // that captain.
  const heardByEveryone = seated.map((seat) => boardOn(seat.socket));
  seated[0].socket.emit("objective:report", {
    roomId: gambitRoomId,
    delivered: { [owed.type]: 2 },
  });
  const boardHeard = await Promise.all(heardByEveryone);
  check(
    boardHeard.every((frame) => frame?.total?.[owed.type] === 2),
    `a delivery of 2 ${owed.type} reaches every captain in the harbor`,
  );

  const summed = boardOn(seated[0].socket);
  seated[1].socket.emit("objective:report", {
    roomId: gambitRoomId,
    delivered: { [owed.type]: 3 },
  });
  check(
    (await summed)?.total?.[owed.type] === 5,
    "and a second captain's report adds to the same board",
  );

  const boardReplayed = boardOn(seated[0].socket);
  seated[0].socket.emit("objective:report", {
    roomId: gambitRoomId,
    delivered: { [owed.type]: 2 },
  });
  check(
    (await boardReplayed)?.total?.[owed.type] === 5,
    "a re-report of what was already sent does not count twice",
  );

  const walkedBack = boardOn(seated[0].socket);
  seated[1].socket.emit("objective:report", {
    roomId: gambitRoomId,
    delivered: { [owed.type]: 1 },
  });
  check(
    (await walkedBack)?.total?.[owed.type] === 5,
    "and a report that goes backwards cannot walk the board down",
  );

  const inflated = boardOn(seated[0].socket);
  seated[2].socket.emit("objective:report", {
    roomId: gambitRoomId,
    delivered: { [owed.type]: 999999, Unobtainium: 5 },
  });
  const clamped = await inflated;
  check(
    clamped?.total?.[owed.type] === owed.required,
    `a report claiming six figures is capped at the ${owed.required} the commission asks for`,
  );
  check(
    clamped !== null &&
      Object.keys(clamped.total).every((good) =>
        commission.resources.some((r) => r.type === good),
      ),
    "and the board names no good the deck does not",
  );

  const lateArrival = await openAuthedSocket(gambitThird);
  run.sockets.push(lateArrival);
  const greeted = boardOn(lateArrival);
  lateArrival.emit("room:join", { roomId: gambitRoomId });
  check(
    (await greeted)?.total?.[owed.type] === owed.required,
    "a captain who joins late is handed the board as it stands",
  );

  // The frames the two sections above collected, read back for the same
  // reason the alignment frames were: a payload with nowhere to put a
  // secret cannot leak one, so the claim is about the shape it carries.
  const boardFrames = seated.flatMap((seat) =>
    seat.frames.filter((frame) => frame.event === "objective:progress"),
  );
  check(
    boardFrames.length > 0,
    "the harbor's board really did ride the wire, so the next checks have something to read",
  );
  check(
    boardFrames.every((frame) => {
      const payload = JSON.parse(frame.text)[0] as Record<string, unknown>;
      return (
        JSON.stringify(Object.keys(payload).sort()) ===
        JSON.stringify(["roomId", "total"])
      );
    }),
    "and every frame of it carries exactly a room and a total, nothing else",
  );
  const secretPattern = new RegExp(`\\b${secret}\\b`);
  check(
    boardFrames.every((frame) => !secretPattern.test(frame.text)),
    `and none of them names the ${secret}, on any socket`,
  );

  // The tally this captain owns rides inside the per voyage save blob,
  // which nothing in this file covered before now.
  const saved = {
    objectiveDelivered: { [owed.type]: 4 },
    objectiveTrace: [
      { round: 2, at: Date.now(), delivered: { [owed.type]: 4 } },
    ],
  };
  const put = await call<{ ok: boolean }>("/api/game/state", {
    method: "PUT",
    cookie: gambitHost.cookie,
    body: JSON.stringify({ roomId: gambitRoomId, data: saved }),
  });
  check(
    put.status === 200,
    "a voyage state carrying a commission record saves",
  );
  const loaded = await call<{ state: string | null }>(
    `/api/game/state?roomId=${gambitRoomId}`,
    { cookie: gambitHost.cookie },
  );
  // The route hands back the stored blob as the text it is, and every
  // client parses it, so this reads it back the way a client does.
  const loadedState =
    typeof loaded.body.state === "string"
      ? (JSON.parse(loaded.body.state) as typeof saved)
      : null;
  check(
    loadedState?.objectiveDelivered?.[owed.type] === 4 &&
      loadedState?.objectiveTrace?.[0]?.round === 2,
    "and loads back with the tally and the trace it was given",
  );

  // [J1: the private information review] The save path's one bound,
  // which exists because a save is read by the harbor rather than only
  // by the captain who wrote it: the conclusion parses every blob at the
  // table and the Manifest Audit samples one of them, so an enormous
  // save is paid for by six captains, on the code path that has to
  // finish before a voyage can end. 64 KB is around twenty times the
  // largest real save, so this fills well past it and then reads both
  // halves of what a bound owes: the oversized save is refused, and the
  // good one already written to the row is still there afterwards.
  const enormous = {
    objectiveDelivered: { [owed.type]: 4 },
    objectiveTrace: Array.from({ length: 4000 }, (_, i) => ({
      round: 3,
      at: i,
      delivered: { [owed.type]: 1 },
    })),
  };
  check(
    JSON.stringify(enormous).length > 64 * 1024,
    "the probe save is larger than the cap, so the check below can fail",
  );
  const tooLarge = await call<{ error?: string }>("/api/game/state", {
    method: "PUT",
    cookie: gambitHost.cookie,
    body: JSON.stringify({ roomId: gambitRoomId, data: enormous }),
  });
  check(
    tooLarge.status === 413,
    "a save larger than the cap is refused rather than stored",
  );
  const afterRefusal = await call<{ state: string | null }>(
    `/api/game/state?roomId=${gambitRoomId}`,
    { cookie: gambitHost.cookie },
  );
  const untouched =
    typeof afterRefusal.body.state === "string"
      ? (JSON.parse(afterRefusal.body.state) as typeof saved)
      : null;
  check(
    untouched?.objectiveDelivered?.[owed.type] === 4 &&
      untouched?.objectiveTrace?.length === 1,
    "and the refusal left the voyage's own save exactly as it was",
  );

  // A restarted voyage starts the board empty, and this is the one check
  // in the section that cannot be satisfied by a client re-reporting: a
  // report of zero cannot clear a max merged tally, because max(old, 0)
  // is old. Without the clear in room:restart, the dead voyage's numbers
  // are still there and this report lands on top of them.
  seated[0].socket.emit("room:restart", { roomId: gambitRoomId });
  await new Promise((resolve) => setTimeout(resolve, 600));
  const nextRoom = await db.room.findUnique({
    where: { id: gambitRoomId },
    select: { voyageEpoch: true },
  });
  const nextCommission = drawObjective(
    objectiveSeed(gambitRoomId, nextRoom?.voyageEpoch ?? 0),
  );
  const nextOwed = nextCommission.resources[0];
  const freshBoard = boardOn(seated[0].socket);
  seated[0].socket.emit("objective:report", {
    roomId: gambitRoomId,
    delivered: { [nextOwed.type]: 2 },
  });
  check(
    (await freshBoard)?.total?.[nextOwed.type] === 2,
    "restarting the voyage starts the board empty rather than on the dead voyage's numbers",
  );

  // ---- What a concluded voyage leaves behind ----
  // The measurement half of the mode, and the one thing here no other
  // part of this file reaches: a voyage that ends writes the commission
  // onto its Chronicle rows, and a slice about telemetry that never
  // exercises the write would be claiming something it never checked.
  //
  // One captain ends holding a trace that met the commission and the
  // others end holding nothing, which is what makes the two branches of
  // the met flag both testable in one voyage.
  const fullBoard: Record<string, number> = {};
  for (const r of nextCommission.resources) fullBoard[r.type] = r.required;
  await call<{ ok: boolean }>("/api/game/state", {
    method: "PUT",
    cookie: gambitHost.cookie,
    body: JSON.stringify({
      roomId: gambitRoomId,
      data: {
        objectiveDelivered: fullBoard,
        objectiveTrace: [{ round: 4, at: Date.now(), delivered: fullBoard }],
      },
    }),
  });

  // Only a captain's newest socket may report a status, and the six
  // captain table above left a newer one behind for every captain here,
  // seated in a harbor this one is not. So each finisher is handed a
  // fresh socket seated in this harbor, which is both the newest socket
  // the server keeps for that captain and the one bound to this room,
  // and the report goes out from there. A report from any of the seats
  // taken earlier is refused, which is the rule under test rather than
  // an obstacle to it.
  const finishers: Socket[] = [];
  for (const captain of [gambitHost, gambitSecond, gambitThird, gambitFourth]) {
    const socket = await openAuthedSocket(captain);
    run.sockets.push(socket);
    const seatedHere = waitForEvent<WireHistory>(
      socket,
      "chat:history",
      (payload) => payload?.roomId === gambitRoomId,
    );
    socket.emit("room:join", { roomId: gambitRoomId });
    await seatedHere;
    finishers.push(socket);
  }
  // The hand this voyage is judged on, written here rather than drawn:
  // one card per finisher, chosen so that the verdict each captain is owed
  // is known before the voyage ends. The harness owns the hand the same
  // way it owns the paired table's above, and the reason is the same one:
  // a drawn hand would make every check below unrepeatable.
  //
  // The saves those verdicts are read from are written here too, which is
  // the other half of the arrangement. gambitHost's was put above and met
  // the commission, and the two Brokers are handed the ledger their own
  // verdict turns on, one exactly at the target and one a single Gold
  // under it, so the boundary of the rule is what the voyage records.
  const writeCard = (userId: string, role: string) =>
    db.voyageRole.upsert({
      where: { roomId_userId: { roomId: gambitRoomId, userId } },
      create: { roomId: gambitRoomId, userId, role },
      update: { role, flourish: null },
    });
  const writeSave = (cookie: string, data: Record<string, unknown>) =>
    call<{ ok: boolean }>("/api/game/state", {
      method: "PUT",
      cookie,
      body: JSON.stringify({ roomId: gambitRoomId, data }),
    });
  await writeCard(gambitHost.id, "honest");
  await writeCard(gambitSecond.id, "broker");
  await writeCard(gambitThird.id, "broker");
  await writeCard(gambitFourth.id, "pirate");
  // The ledger a Broker's verdict turns on is the one ending figure the
  // client is trusted for, so this writes it and then reads the row back:
  // a failure here reads as "the save never reached the row" rather than
  // as a rule that decided wrongly under it.
  const brokerHand = await writeSave(gambitSecond.cookie, {
    peerTradeProfit: BROKER_PAYOUT_TARGET,
  });
  const nearMissHand = await writeSave(gambitThird.cookie, {
    peerTradeProfit: BROKER_PAYOUT_TARGET - 1,
  });
  const handedRow = await db.gameState.findUnique({
    where: {
      userId_roomId: { userId: gambitSecond.id, roomId: gambitRoomId },
    },
    select: { data: true },
  });
  check(
    brokerHand.status === 200 &&
      nearMissHand.status === 200 &&
      handedRow?.data?.includes(String(BROKER_PAYOUT_TARGET)) === true,
    "the harness can hand a captain the ledger their verdict is read from",
  );

  for (const socket of finishers) {
    socket.emit("game:status", {
      roomId: gambitRoomId,
      round: 5,
      phase: "endgame",
      phaseLabel: "Voyage Complete",
      gold: 40,
      reputation: 30,
      shipLevel: 2,
      gameOver: true,
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  // The conclusion writes behind the last report rather than inside it,
  // so the rows are waited for rather than slept past: a fixed pause
  // long enough on this machine is the kind of check that fails the
  // first time it runs somewhere slower.
  const readChronicles = () =>
    db.voyageChronicle.findMany({
      where: { roomId: gambitRoomId },
      select: {
        userId: true,
        mode: true,
        objectiveId: true,
        objectiveMet: true,
        objectiveTrace: true,
        alignment: true,
        won: true,
      },
    });
  let chronicles = await readChronicles();
  for (
    let waited = 0;
    chronicles.length < finishers.length && waited < 10000;
    waited += 250
  ) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    chronicles = await readChronicles();
  }
  check(
    chronicles.length === finishers.length,
    "a concluded voyage writes one chronicle per captain",
  );
  check(
    chronicles.every((row) => row.mode === "ocean_gambit"),
    "and every one records the lap it was sailed on",
  );
  check(
    chronicles.every((row) => row.objectiveId === nextCommission.id),
    `and names the commission the fleet was working on (${nextCommission.id})`,
  );
  const hostChronicle = chronicles.find((row) => row.userId === gambitHost.id);
  check(
    JSON.parse(hostChronicle?.objectiveTrace ?? "[]").length === 1,
    "and carries the per leg trace rather than dropping it",
  );
  check(
    hostChronicle?.objectiveMet === true &&
      chronicles
        .filter((row) => row.userId !== gambitHost.id)
        .every((row) => row.objectiveMet === false),
    "reading the met flag out of that trace, and never inventing one for a captain who kept none",
  );

  // ---- What the voyage decided about each card ----
  // The other half of the victory rules above: the card a captain sailed
  // under and whether the rule says they won it, read back off the rows
  // the conclusion wrote. The hand is the one written a few lines up, so
  // every verdict here is known in advance, and the four rows between them
  // cover a win, a win that needs no commission at all, and two ways to
  // lose.
  const verdictOf = (captainId: string) =>
    chronicles.find((row) => row.userId === captainId);
  check(
    chronicles.every(
      (row) =>
        row.alignment === "honest" ||
        row.alignment === "broker" ||
        row.alignment === "pirate",
    ),
    "every concluded voyage records the card its captain sailed under",
  );
  check(
    verdictOf(gambitHost.id)?.won === true,
    "an Honest captain whose fleet met the commission wins the voyage",
  );
  check(
    verdictOf(gambitSecond.id)?.won === true &&
      verdictOf(gambitSecond.id)?.objectiveMet === false,
    "and a Broker who reached the target wins it beside them, on a voyage the fleet did not finish",
  );
  check(
    verdictOf(gambitThird.id)?.won === false,
    "while a Broker one Gold short of the target wins nothing",
  );
  check(
    verdictOf(gambitFourth.id)?.won === false,
    "and a Pirate ends a voyage the fleet fell short of with nothing, from a rating below the floor the card demands",
  );

  // The mode is a room property the server reads for itself, so the
  // other half of the guard is that a Classic harbor has no board at
  // all, whatever it is sent.
  const boardRefused: string[] = [];
  const collector = (event: string, ...args: unknown[]) =>
    boardRefused.push(`${event}:${JSON.stringify(args)}`);
  seated[0].socket.onAny(collector);
  const backInClassic = waitForEvent<WireHistory>(
    seated[0].socket,
    "chat:history",
    (payload) => payload?.roomId === classicRoomId,
  );
  seated[0].socket.emit("room:join", { roomId: classicRoomId });
  await backInClassic;
  seated[0].socket.emit("objective:report", {
    roomId: classicRoomId,
    delivered: { [nextOwed.type]: 2 },
  });
  await new Promise((resolve) => setTimeout(resolve, 600));
  seated[0].socket.offAny(collector);
  check(
    !boardRefused.some((frame) => frame.startsWith("objective:progress")),
    "a Classic harbor is sent no commission board at all",
  );
}
