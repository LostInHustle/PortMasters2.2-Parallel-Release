// PortMasters 2.2 Parallel Release, smoke run: The fleet commission.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";
import {
  PRODUCTS_TIER0,
  RESOURCES_TIER0,
  STARTING_STOCK,
} from "@/lib/game/constants/goods";
import {
  OBJECTIVE_DECK,
  drawObjective,
  objectiveProgress,
  objectiveSeed,
  objectiveTotalItems,
} from "@/lib/game/objectives";
import {
  deliverToObjective,
  OBJECTIVE_DELIVERY_PHASE,
} from "@/lib/game/engine";
import { BROKER_PAYOUT_TARGET } from "@/lib/game/victory";
import {
  clearObjectiveTallies,
  objectiveTotalFor,
  recordObjectiveHandover,
  recordObjectiveReport,
  roomObjectiveTallies,
} from "@/server/realtime/objective";
import { claimObjectiveRoom } from "@/server/realtime/presence";
import {
  call,
  check,
  openAuthedSocket,
  voyageState,
  waitForEvent,
} from "../harness";
import type { WireHistory } from "../wire";
import type { Server } from "socket.io";
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
  // impossible to inflate. So these checks are about the deck holding its own
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
  // in the section that cannot be satisfied by a client reporting again: a
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

  // ========== The press, asked before the goods move ==========
  // The half of the commission no board can show, and the field report
  // itself: a press on Deliver moves goods in the captain's own client,
  // judged against the last board that client heard. Two captains who
  // press inside the debounce plus a round trip therefore both hold the
  // board above, each client takes the whole of what that board says is
  // left, both are paid, and the wire board clamps back to the quota
  // afterwards and hides it: the fleet gives twice for one commission and
  // every screen reads right. The repair is a frame in each direction. A
  // press asks the room first (objective:handover, carrying the standing
  // the press would leave this captain on, which is the same payload a
  // report carries because it is the same number), the room answers that
  // socket alone with what it accepted of it (objective:granted, the
  // accepted standing good by good), and only what came back moves. Both
  // settles inside those answers run in one stretch with nothing awaited,
  // so the second of two presses is judged against the line the first one
  // just wrote.
  type GrantFrame = { roomId: string; granted: Record<string, number> };
  const grantOn = (socket: Socket) =>
    waitForEvent<GrantFrame>(
      socket,
      "objective:granted",
      (payload) => payload?.roomId === gambitRoomId,
      4000,
    );

  // The captain at the second seat is holding a second socket in this
  // harbor (the late arrival above), so that tab is listened to as well:
  // an answer addressed to the captain rather than to the socket that
  // pressed would reach it, and a grant is about one press rather than
  // about one captain.
  const otherTab: string[] = [];
  lateArrival.onAny((event: string) => {
    otherTab.push(event);
  });

  // The board both presses read, and the take each of them works out from
  // it: the report above left 2 on the first good the commission names, so
  // the remainder is what a press against that board would ask for whole.
  // The good is the commission's first rather than its last, because the
  // section below fills the last one exactly and a good already full there
  // would make that check pass for the wrong reason.
  const pressGood = nextCommission.resources[0];
  const heldBack = 2;
  const staleRemaining = pressGood.required - heldBack;
  const askedWhole: Record<string, number> = {
    [pressGood.type]: staleRemaining,
  };

  const answerOfFirstSocket = grantOn(seated[1].socket);
  const answerOfSecondSocket = grantOn(seated[2].socket);
  const racedBoard = boardOn(seated[0].socket);
  // Nothing awaited between the two emits, which is the pair the report is
  // about: two presses carrying the take each of them worked out from the
  // board above before either of them moved.
  seated[1].socket.emit("objective:handover", {
    roomId: gambitRoomId,
    delivered: askedWhole,
  });
  seated[2].socket.emit("objective:handover", {
    roomId: gambitRoomId,
    delivered: askedWhole,
  });
  const answerOfFirst = await answerOfFirstSocket;
  const answerOfSecond = await answerOfSecondSocket;
  const raced = await racedBoard;
  const grantedOf = (answer: GrantFrame | null) =>
    answer?.granted?.[pressGood.type] ?? 0;
  check(
    answerOfFirst !== null &&
      answerOfSecond !== null &&
      grantedOf(answerOfFirst) + grantedOf(answerOfSecond) === staleRemaining,
    `two captains who press at the same instant are granted the ${staleRemaining} ${pressGood.type} the commission still had between them, rather than the whole of it each`,
  );
  check(
    raced !== null &&
      raced.total[pressGood.type] === pressGood.required &&
      nextCommission.resources.every(
        (r) => (raced.total[r.type] ?? 0) <= r.required,
      ),
    "and the board the room hears is what those two grants came to, at the quota the commission named and never past it",
  );

  // The same press sent a second time by the captain whose first one was
  // taken, which is the frame a double click, a debounce and a reload all
  // produce. A grant is a standing rather than a delta, so answering it
  // again lands on the line the first answer set, and the goods and the
  // Gold behind it move nothing the second time.
  const servedFirst =
    grantedOf(answerOfFirst) >= grantedOf(answerOfSecond)
      ? seated[1]
      : seated[2];
  const answeredAgainSocket = grantOn(servedFirst.socket);
  const unchangedBoard = boardOn(seated[0].socket);
  servedFirst.socket.emit("objective:handover", {
    roomId: gambitRoomId,
    delivered: askedWhole,
  });
  const answeredAgain = await answeredAgainSocket;
  const heldStill = await unchangedBoard;
  check(
    answeredAgain !== null &&
      grantedOf(answeredAgain) ===
        Math.max(grantedOf(answerOfFirst), grantedOf(answerOfSecond)),
    "and the same press sent a second time is answered with the standing the first one was granted rather than with a second helping of it",
  );
  check(
    heldStill !== null &&
      heldStill.total[pressGood.type] === pressGood.required,
    "so one press is paid for once: the board stays where the pair brought it",
  );

  // The answer is private, and the proof is the sockets that did not press:
  // every captain heard the board move and no captain but the one who
  // pressed heard what their press was accepted as, down to the second tab
  // of the captain who did press with it. The frames are read off the
  // recorders rather than waited for, because every answer above was
  // awaited before this line and a frame cannot be in flight behind an
  // answer that has already arrived.
  const grantedFrames = seated.flatMap((seat) =>
    seat.frames.filter((frame) => frame.event === "objective:granted"),
  );
  check(
    grantedFrames.length === 3 &&
      !otherTab.includes("objective:granted") &&
      otherTab.includes("objective:progress") &&
      seated[0].frames.every((frame) => frame.event !== "objective:granted") &&
      seated[3].frames.every((frame) => frame.event !== "objective:granted") &&
      seated[3].frames.some((frame) => frame.event === "objective:progress"),
    "the answer to a press reaches the socket that pressed and nowhere else: the room, the other tab of the same captain, and the captains who did not press all hear the board move without hearing whose press moved it",
  );
  check(
    grantedFrames.length > 0 &&
      grantedFrames.every((frame) => {
        const payload = JSON.parse(frame.text)[0] as Record<string, unknown>;
        return (
          JSON.stringify(Object.keys(payload).sort()) ===
          JSON.stringify(["granted", "roomId"])
        );
      }),
    "and every answer carries exactly a room and the rows it granted, nothing else",
  );
  check(
    grantedFrames.every((frame) => !secretPattern.test(frame.text)),
    `and none of them names the ${secret}, on any socket`,
  );

  // ========== The room's own board, driven directly ==========
  // Two of the claims above cannot be read off a socket at the instant
  // they are made. The first is what the raw lines behind the board hold:
  // the board is one line per captain summed, and the wire only ever
  // carries the sum. The second is the claim a room's board is held under
  // while one press settles, which is memory in the server process rather
  // than anything it sends.
  //
  // Both live in the realtime layer, and this suite runs in its own
  // process with its own copy of that layer, so what it holds is nobody
  // else's board (the same boundary the harness notes on quickstart:join).
  // The commission is not one of the copies: it is drawn from the harbor,
  // the voyage epoch and the table size, and this process reads the same
  // three values the server does, so the arithmetic below is the
  // arithmetic the room is running.
  const quietIo = {
    to: () => ({ emit: () => undefined }),
  } as unknown as Server;
  const offerWhole: Record<string, number> = {};
  for (const r of nextCommission.resources) {
    offerWhole[r.type] = r.required;
  }
  const linesNow = () => {
    const summed: Record<string, number> = {};
    for (const line of roomObjectiveTallies.get(gambitRoomId)?.values() ?? []) {
      for (const [good, count] of Object.entries(line)) {
        summed[good] = (summed[good] ?? 0) + count;
      }
    }
    return summed;
  };

  clearObjectiveTallies(gambitRoomId);
  const pressLineA = recordObjectiveHandover(
    quietIo,
    gambitRoomId,
    "smoke26-press-a",
    offerWhole,
  );
  const pressLineB = recordObjectiveHandover(
    quietIo,
    gambitRoomId,
    "smoke26-press-b",
    offerWhole,
  );
  const [lineOfA, lineOfB] = await Promise.all([pressLineA, pressLineB]);
  const rawLines = linesNow();
  const boardHere = objectiveTotalFor(gambitRoomId, nextCommission);
  check(
    lineOfA !== null &&
      lineOfB !== null &&
      nextCommission.resources.every((r) => lineOfA[r.type] === r.required) &&
      Object.keys(lineOfB).length === 0,
    "of two presses offering the whole commission in one tick, the first is granted it all and the second is granted nothing at all",
  );
  check(
    nextCommission.resources.every(
      (r) => (rawLines[r.type] ?? 0) <= r.required,
    ),
    "and the raw lines the room keeps are held to the commission good by good: no captain's line and no sum of them passes the quota",
  );
  check(
    nextCommission.resources.every(
      (r) =>
        (rawLines[r.type] ?? 0) === (boardHere[r.type] ?? 0) &&
        boardHere[r.type] === r.required,
    ),
    "and those raw lines are what the public board is summed from: the board the fleet reads is exactly what they come to, at the quota on every good",
  );

  // The report path behind the same lines, for the reason it exists: a
  // reload, a reconnect and a heartbeat all repeat a standing this
  // captain already holds, and a line is a standing rather than a sum.
  await recordObjectiveReport(
    quietIo,
    gambitRoomId,
    "smoke26-press-a",
    offerWhole,
  );
  await recordObjectiveHandover(
    quietIo,
    gambitRoomId,
    "smoke26-press-a",
    offerWhole,
  );
  const linesAfterRepeat = linesNow();
  check(
    nextCommission.resources.every(
      (r) => (linesAfterRepeat[r.type] ?? 0) === (rawLines[r.type] ?? 0),
    ),
    "and a line that re-reports the standing it already holds moves nothing, by report or by press: one commission is answered once however many frames carry it",
  );

  // And a press that proposes less than the standing the room already holds
  // for that captain, which is what a client whose own record lags the room
  // sends. It is still answered, because a press is answered with the
  // standing the room accepts and a repeat has to land on the number the
  // first one set (the check above). What it cannot do is lift a raw line
  // the merge already holds: the acceptance is capped by the standing plus
  // the remaining, and the remaining here is nothing, so the line and the
  // board stay exactly where the pair above left them.
  const belowStanding = await recordObjectiveHandover(
    quietIo,
    gambitRoomId,
    "smoke26-press-a",
    { [pressGood.type]: 1 },
  );
  check(
    belowStanding !== null &&
      nextCommission.resources.every(
        (r) => (linesNow()[r.type] ?? 0) === (rawLines[r.type] ?? 0),
      ),
    "a press below the standing the room already holds for that captain is answered but lifts no raw line, so a lagging record cannot move the filled board",
  );

  // The claim itself, which a restart waits on before it clears the board
  // for a new voyage (see the room:restart handler). Held for the length
  // of one settle, and read twice: a press that arrives while it is held
  // waits rather than settling under it, and the room is free again the
  // moment the work that held it lets go.
  const releaseClaim = await claimObjectiveRoom(gambitRoomId);
  let settledUnderClaim = false;
  const waitingOnClaim = recordObjectiveReport(
    quietIo,
    gambitRoomId,
    "smoke26-held",
    offerWhole,
  ).then(() => {
    settledUnderClaim = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 200));
  check(
    !settledUnderClaim,
    "a press that arrives while the room's commission claim is held waits for it rather than settling under it",
  );
  releaseClaim();
  await waitingOnClaim;
  check(
    settledUnderClaim &&
      nextCommission.resources.every(
        (r) => (linesNow()[r.type] ?? 0) === r.required,
      ),
    "and it settles the moment the claim is let go, finding the board the claim was holding: every quota reached and nothing left for it to take",
  );

  // And the claim is handed back while the room lives, which is the one
  // way a lock like this fails loudly: a claim that was never released
  // leaves every later press waiting for a signal nobody holds. The proof
  // is the next claim being granted rather than waited for.
  const reclaimed = await Promise.race([
    claimObjectiveRoom(gambitRoomId),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
  ]);
  check(
    reclaimed !== null,
    "and every claim above was handed back when its work finished, so the next press in the room is not left standing behind a claim nobody holds",
  );
  if (reclaimed) reclaimed();
  // The suite's own copy of the board goes with the drive above, so a
  // later file in this process finds nothing here that it did not write.
  clearObjectiveTallies(gambitRoomId);

  // The two halves of the restart guard, which no frame can show: the
  // clear a restart runs is taken under the same claim a press holds, so a
  // line accepted against the dead voyage cannot be seeded into the fresh
  // board, and both entry points take it before they read the room. Read
  // off the files rather than driven, because the restart is a frame on a
  // live socket and the order two frames in one tick settle in is not this
  // suite's to call; 51-charters reads its own wiring the same way.
  const repoRoot = join(import.meta.dirname, "..", "..", "..");
  const objectiveModule = readFileSync(
    join(repoRoot, "src", "server", "realtime", "objective.ts"),
    "utf8",
  );
  const restartWiring = readFileSync(
    join(repoRoot, "src", "server", "realtime", "wiring", "restart-voyage.ts"),
    "utf8",
  );
  const pressHook = readFileSync(
    join(repoRoot, "src", "lib", "use-objective.ts"),
    "utf8",
  );
  check(
    objectiveModule.includes("await claimObjectiveRoom(roomId)") &&
      restartWiring.includes("await claimObjectiveRoom(roomId)") &&
      restartWiring.includes("clearObjectiveTallies(roomId)"),
    "the board is claimed before the commission is read, and the restart claims it around its clear, so no line accepted against one voyage can reach the next one's board",
  );
  // The client's own half, which is the half the field report was about:
  // the press asks rather than applying itself, and what moves the goods
  // is the answer the room sent back. A needle rather than a drive for the
  // reason the two above are: the press lives in a React hook, and the
  // suite has no browser to press it in.
  check(
    pressHook.includes('"objective:handover"') &&
      pressHook.includes('"objective:granted"') &&
      pressHook.includes("data.granted"),
    "and the client asks before it moves anything: its press goes out as a handover and the granted rows are what reach the hold",
  );
  // The panel's own half of the same claim, and the half a captain reads:
  // the button is not drawn at all once the fleet has met the commission,
  // and the strip says why in its place, so there is no press left to make
  // against a board the room would refuse. A needle for the same reason
  // the hook above is one: the panel is React and this suite has no
  // browser to press it in.
  const objectivePanel = readFileSync(
    join(
      repoRoot,
      "src",
      "components",
      "portmasters",
      "game",
      "ObjectivePanel.tsx",
    ),
    "utf8",
  );
  check(
    objectivePanel.includes("{open && deliverable > 0 && (") &&
      objectivePanel.includes(
        "The commission is met, and nothing more is owed.",
      ),
    "the panel withdraws the button when the commission is met rather than leaving a press the room would refuse",
  );

  // ========== Where the commission stops, and what it refuses ==========
  // What the field reported: the commission went on taking handovers after
  // the fleet had filled it, and two captains pressing at once could each
  // hand over the whole of it. The rule the checks below hold it to is the
  // one the deck itself is written by (see objectiveTaking in
  // @/lib/game/objectives and acceptAgainstRemaining in
  // @/server/realtime/objective): a handover is taken against what the
  // commission still has room for at that instant, so it can never hold
  // more than it asked for and a commission already filled takes nothing
  // from anybody.
  //
  // A handover has two halves and they live in two places, so this section
  // drives both. The board is the harbor's acceptance and is driven over
  // two sockets here, one handover each with nothing awaited between the
  // two emits, which is the simultaneous pair. The goods and the Gold move
  // in the captain's own engine against the board the room last reported,
  // and no socket can press another captain's Deliver button, so that half
  // is driven the way 48-theMilestoneBoons drives the same function: the
  // state and the board handed to deliverToObjective directly.
  const fillGood =
    nextCommission.resources[nextCommission.resources.length - 1];

  // Exactly what the commission still asks for. The good is the last one
  // the commission names rather than the first, because the presses above
  // counted on that one and a check about exact numbers wants a good
  // nothing has touched.
  const exactlySo = boardOn(seated[0].socket);
  seated[1].socket.emit("objective:report", {
    roomId: gambitRoomId,
    delivered: { [fillGood.type]: fillGood.required },
  });
  check(
    (await exactlySo)?.total?.[fillGood.type] === fillGood.required,
    `a handover that is exactly what the commission still asks for is accepted whole, ${fillGood.required} ${fillGood.type}`,
  );

  const pastIt = boardOn(seated[0].socket);
  seated[2].socket.emit("objective:report", {
    roomId: gambitRoomId,
    delivered: { [fillGood.type]: fillGood.required + 7 },
  });
  const overAsked = await pastIt;
  check(
    overAsked?.total?.[fillGood.type] === fillGood.required &&
      overAsked !== null &&
      nextCommission.resources.every(
        (r) => (overAsked.total[r.type] ?? 0) <= r.required,
      ),
    "and a handover past it is not taken: the board sits at the quota the commission asks for, and no good passes its own",
  );

  // The simultaneous pair: one handover from each of two sockets, each
  // carrying the whole commission, emitted with nothing awaited between
  // them. Sequential settlement is the claim, and the first frame plus the
  // board a joiner is handed are what say so: the pair adds up to the
  // commission's own number rather than to twice one handover.
  const wholeHand: Record<string, number> = {};
  for (const r of nextCommission.resources) wholeHand[r.type] = r.required;
  const firstOfThePair = boardOn(seated[0].socket);
  seated[2].socket.emit("objective:report", {
    roomId: gambitRoomId,
    delivered: wholeHand,
  });
  seated[3].socket.emit("objective:report", {
    roomId: gambitRoomId,
    delivered: wholeHand,
  });
  const takenFirst = await firstOfThePair;
  check(
    takenFirst !== null &&
      nextCommission.resources.every(
        (r) => takenFirst.total[r.type] === r.required,
      ),
    "the first of two handovers emitted back to back is taken only up to the quotas the commission names",
  );

  const settledReader = await openAuthedSocket(gambitFourth);
  run.sockets.push(settledReader);
  const settledFrame = boardOn(settledReader);
  settledReader.emit("room:join", { roomId: gambitRoomId });
  const settled = await settledFrame;
  check(
    settled !== null &&
      nextCommission.resources.every(
        (r) => settled.total[r.type] === r.required,
      ) &&
      nextCommission.resources.reduce(
        (sum, r) => sum + (settled.total[r.type] ?? 0),
        0,
      ) === objectiveTotalItems(nextCommission),
    `and the second is settled after it against the board the first one left, so the pair comes to the ${objectiveTotalItems(nextCommission)} items the commission asked for and never twice them`,
  );

  // The same handover sent again from the socket that sent it the first
  // time, which is the duplicate emit a reload or a double press produces.
  const duplicate = boardOn(seated[0].socket);
  seated[2].socket.emit("objective:report", {
    roomId: gambitRoomId,
    delivered: wholeHand,
  });
  const repeated = await duplicate;
  check(
    repeated !== null &&
      nextCommission.resources.every(
        (r) => repeated.total[r.type] === r.required,
      ),
    "and the same handover sent a second time is counted once: a filled commission stays at its quotas",
  );

  // The same refusal as a press rather than a report, from the captain the
  // board owes nothing: the room has nothing left of any good, so what
  // comes back is an answer with no rows in it at all, and the goods stay
  // where they are. The engine's half of this, and the sentence a captain
  // reads, are driven below.
  const refusedAnswer = grantOn(settledReader);
  const stillAtQuota = boardOn(seated[0].socket);
  settledReader.emit("objective:handover", {
    roomId: gambitRoomId,
    delivered: wholeHand,
  });
  const refusal = await refusedAnswer;
  const boardAfterRefusal = await stillAtQuota;
  check(
    refusal !== null &&
      Object.keys(refusal.granted).length === 0 &&
      boardAfterRefusal !== null &&
      nextCommission.resources.every(
        (r) => (boardAfterRefusal.total[r.type] ?? 0) === r.required,
      ),
    "a press against a commission the fleet has filled is answered with no rows at all, and the board stays at the quotas the pair brought it to",
  );

  // ========== The other half of a handover, in the captain's own engine ==========
  const engineObjective = nextCommission;
  const owedLast =
    engineObjective.resources[engineObjective.resources.length - 1];
  const filledBoard: Record<string, number> = {};
  for (const r of engineObjective.resources) filledBoard[r.type] = r.required;
  const fullPayout = engineObjective.resources.reduce(
    (sum, r) => sum + r.required * r.price,
    0,
  );

  // A hold that covers the commission exactly, handed over whole: every
  // good's own record lands on its quota, the purse moves by the Emperor's
  // own arithmetic, and the commission reads complete.
  const exactlyCaptain = voyageState();
  exactlyCaptain.phase = OBJECTIVE_DELIVERY_PHASE;
  for (const r of engineObjective.resources) {
    exactlyCaptain.inventory[r.type] = r.required;
  }
  const exactPurse = exactlyCaptain.money;
  const exactLogs: string[] = [];
  deliverToObjective(exactlyCaptain, engineObjective, exactLogs, {});
  check(
    engineObjective.resources.every(
      (r) => exactlyCaptain.objectiveDelivered[r.type] === r.required,
    ) &&
      exactlyCaptain.money - exactPurse === fullPayout &&
      objectiveProgress(engineObjective, exactlyCaptain.objectiveDelivered).met,
    "a captain whose hold answers the commission exactly hands it over whole, is paid the Emperor's price for every item, and reads the commission complete",
  );

  // The same press to a commission the fleet has already filled. This is
  // the field report itself: the goods stay aboard, no Gold is paid, and
  // the captain is told why rather than left with a silent button.
  const lateCaptain = voyageState();
  lateCaptain.phase = OBJECTIVE_DELIVERY_PHASE;
  const spare = 3;
  for (const r of engineObjective.resources) {
    lateCaptain.inventory[r.type] = spare;
  }
  const latePurse = lateCaptain.money;
  const lateLogs: string[] = [];
  deliverToObjective(lateCaptain, engineObjective, lateLogs, filledBoard);
  check(
    engineObjective.resources.every(
      (r) => lateCaptain.inventory[r.type] === spare,
    ) &&
      lateCaptain.money === latePurse &&
      Object.keys(lateCaptain.objectiveDelivered).length === 0 &&
      lateLogs.some((line) =>
        line.includes("already filled, and nothing was taken"),
      ),
    `a handover to a commission the fleet has already filled takes nothing: the ${spare} of each good stays in the hold, no Gold is paid, and the captain is told the commission is filled`,
  );

  // More offered than is still owed. Every good but the last is already
  // filled by the fleet and the last has one left, so the take is that one
  // item and the rest of the hold stays aboard, which is the rule the
  // Supply Barge reaches its own ask by.
  const partialCaptain = voyageState();
  partialCaptain.phase = OBJECTIVE_DELIVERY_PHASE;
  for (const r of engineObjective.resources) {
    partialCaptain.inventory[r.type] = r.required;
  }
  const oneLeft: Record<string, number> = { ...filledBoard };
  oneLeft[owedLast.type] = owedLast.required - 1;
  const partialPurse = partialCaptain.money;
  const partialLogs: string[] = [];
  deliverToObjective(partialCaptain, engineObjective, partialLogs, oneLeft);
  check(
    partialCaptain.objectiveDelivered[owedLast.type] === 1 &&
      partialCaptain.inventory[owedLast.type] === owedLast.required - 1 &&
      partialCaptain.money - partialPurse === owedLast.price &&
      engineObjective.resources
        .filter((r) => r.type !== owedLast.type)
        .every((r) => partialCaptain.inventory[r.type] === r.required) &&
      partialLogs.some((line) => line.includes(`${owedLast.type}×1`)),
    `a captain offering ${owedLast.required} ${owedLast.type} where one is still owed has exactly that one taken and is paid for one, and the rest of the hold stays aboard`,
  );

  // The second captain of a pair handing over at the same instant, seen
  // one after the other, which is the order the harbor settles them in. The
  // first captain is the one above, whose press took the last item; this
  // one is judged against the board that press left rather than against the
  // board both of them read, so the commission the first captain filled
  // takes nothing from the second and its goods stay where they are.
  const secondCaptain = voyageState();
  secondCaptain.phase = OBJECTIVE_DELIVERY_PHASE;
  for (const r of engineObjective.resources) {
    secondCaptain.inventory[r.type] = r.required;
  }
  const sequentialLogs: string[] = [];
  deliverToObjective(secondCaptain, engineObjective, sequentialLogs, oneLeft);
  const afterFirst = secondCaptain.money;
  const secondLogs: string[] = [];
  deliverToObjective(secondCaptain, engineObjective, secondLogs, filledBoard);
  check(
    secondCaptain.objectiveDelivered[owedLast.type] === 1 &&
      secondCaptain.money === afterFirst &&
      secondCaptain.inventory[owedLast.type] === owedLast.required - 1 &&
      engineObjective.resources
        .filter((r) => r.type !== owedLast.type)
        .every((r) => secondCaptain.inventory[r.type] === r.required) &&
      secondLogs.some((line) =>
        line.includes("already filled, and nothing was taken"),
      ),
    "a second handover that arrives once the commission is filled is refused against the board the first one left, so two captains hand over one commission between them and not two",
  );

  // ========== A granted press, in the captain's own engine ==========
  // The room's half of the pair above is the board; this is the captain's
  // half, and it is the half the field report was about, because the goods
  // and the Gold move where the press was made. A press now carries the
  // accepted standing the room sent back (see recordObjectiveHandover in
  // @/server/realtime/objective and grantedTaking in
  // @/lib/game/engine/objectives), so each check below hands
  // deliverToObjective an answer of its own and reads what the hold did
  // with it.

  // An answer with no rows in it, which is what a press against a filled
  // commission comes back as (the check above). Nothing moves, no Gold is
  // paid, and the captain is told the commission is filled, which is the
  // sentence the local reading gives the same press rather than a second
  // wording for it.
  const answeredNothing = voyageState();
  answeredNothing.phase = OBJECTIVE_DELIVERY_PHASE;
  for (const r of engineObjective.resources) {
    answeredNothing.inventory[r.type] = r.required;
  }
  const answeredPurse = answeredNothing.money;
  const answeredLogs: string[] = [];
  deliverToObjective(
    answeredNothing,
    engineObjective,
    answeredLogs,
    filledBoard,
    {},
  );
  check(
    engineObjective.resources.every(
      (r) => answeredNothing.inventory[r.type] === r.required,
    ) &&
      answeredNothing.money === answeredPurse &&
      Object.keys(answeredNothing.objectiveDelivered).length === 0 &&
      answeredLogs.some((line) =>
        line.includes("already filled, and nothing was taken"),
      ),
    "a press the room answered with no rows takes nothing, pays nothing, and is told the commission is filled",
  );

  // The granted rows are cumulative, so what leaves the hold is the
  // difference between the answer and this captain's own record of it,
  // read here rather than there.
  const partWay = voyageState();
  partWay.phase = OBJECTIVE_DELIVERY_PHASE;
  const partGood = engineObjective.resources[0];
  const partStanding = 1;
  const partHold = { ...partWay.inventory };
  partWay.objectiveDelivered[partGood.type] = partStanding;
  partWay.inventory[partGood.type] = partGood.required;
  const partPurse = partWay.money;
  const partLogs: string[] = [];
  deliverToObjective(
    partWay,
    engineObjective,
    partLogs,
    {},
    {
      [partGood.type]: partStanding + 2,
    },
  );
  check(
    partWay.objectiveDelivered[partGood.type] === partStanding + 2 &&
      partWay.inventory[partGood.type] === partGood.required - 2 &&
      partWay.money - partPurse === 2 * partGood.price &&
      engineObjective.resources
        .filter((r) => r.type !== partGood.type)
        .every((r) => partWay.inventory[r.type] === partHold[r.type]),
    `a captain already standing at ${partStanding} ${partGood.type} who is granted ${partStanding + 2} hands over the difference, 2 items, is paid for 2, and moves nothing the answer did not name`,
  );

  // An answer for more than this captain still has aboard, which is the
  // race the answer is read against the hold for: the hold is read when
  // the answer lands rather than when the press was made, so a hold spent
  // in between hands over only what is left in it.
  const shrunk = voyageState();
  shrunk.phase = OBJECTIVE_DELIVERY_PHASE;
  const shrunkenGood = engineObjective.resources[0];
  const stillAboard = shrunkenGood.required - 1;
  shrunk.inventory[shrunkenGood.type] = stillAboard;
  const shrunkPurse = shrunk.money;
  const shrunkLogs: string[] = [];
  deliverToObjective(
    shrunk,
    engineObjective,
    shrunkLogs,
    {},
    {
      [shrunkenGood.type]: shrunkenGood.required,
    },
  );
  check(
    shrunk.objectiveDelivered[shrunkenGood.type] === stillAboard &&
      shrunk.inventory[shrunkenGood.type] === 0 &&
      shrunk.money - shrunkPurse === stillAboard * shrunkenGood.price &&
      shrunkLogs.some((line) =>
        line.includes(`${shrunkenGood.type}×${stillAboard}`),
      ),
    `an answer for ${shrunkenGood.required} ${shrunkenGood.type} to a captain holding ${stillAboard} takes the ${stillAboard} that are aboard and is paid for those alone`,
  );

  // And the answer applied twice, which is what a duplicated frame or a
  // listener installed twice produces. The rows are a standing rather than
  // a delta, so the second application finds this captain already at it
  // and the hold with nothing left the commission asks for.
  const doubled = voyageState();
  doubled.phase = OBJECTIVE_DELIVERY_PHASE;
  const grantedRows: Record<string, number> = {};
  for (const r of engineObjective.resources) {
    doubled.inventory[r.type] = r.required;
    grantedRows[r.type] = r.required;
  }
  const doubledLogs: string[] = [];
  deliverToObjective(doubled, engineObjective, doubledLogs, {}, grantedRows);
  const paidOnce = doubled.money;
  const againLogs: string[] = [];
  deliverToObjective(doubled, engineObjective, againLogs, {}, grantedRows);
  check(
    engineObjective.resources.every(
      (r) => doubled.objectiveDelivered[r.type] === r.required,
    ) &&
      engineObjective.resources.every((r) => doubled.inventory[r.type] === 0) &&
      doubled.money === paidOnce &&
      againLogs.some((line) =>
        line.includes("already filled, and nothing was taken"),
      ),
    "and an answer applied twice moves goods and Gold once: the second application finds the standing already reached and the hold empty of what the commission asks for",
  );

  // ---- What a concluded voyage leaves behind ----
  // The measurement half of the mode, and the one thing here no other
  // part of this file reaches: a voyage that ends writes the commission
  // onto its Chronicle rows, and a slice about telemetry that never
  // exercises the write would be claiming something it never checked.
  //
  // One captain ends holding a trace that met the commission and the
  // others end holding nothing. The fill is a fact about the fleet, so
  // the conclusion merges every record of it and writes one answer to
  // every row; the one record that has the fill is enough for all four,
  // which is the invariant this voyage holds down. The other branch, a
  // voyage where NO record exists and every row reads unmet, needs a
  // voyage of its own and is the sibling article's (see
  // 54-theFleetsOwnOutcome).
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
      chronicles.every((row) => row.objectiveMet === true),
    "reading the fleet's outcome once from the merged record, so the trace one client kept fills the commission on every row",
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
      verdictOf(gambitSecond.id)?.objectiveMet === true,
    "and a Broker who reached the target wins it beside them, on the same filled voyage the Honest captain reads",
  );
  check(
    verdictOf(gambitThird.id)?.won === false,
    "while a Broker one Gold short of the target wins nothing",
  );
  check(
    verdictOf(gambitFourth.id)?.won === false &&
      verdictOf(gambitFourth.id)?.objectiveMet === true,
    "and a Pirate wins nothing on a voyage the record shows filled, because the card only pays for a failure the fleet's own record does not show",
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
