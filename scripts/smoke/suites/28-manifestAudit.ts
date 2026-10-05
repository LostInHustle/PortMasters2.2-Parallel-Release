// PortMasters 2.2 Parallel Release, smoke run: The Manifest Audit.

import { AuditReveal } from "@/types/realtime/audit";
import { db } from "@/lib/db";
import {
  AUDIT_FROM_ROUND,
  AUDIT_REVEAL_COUNT,
  AUDIT_WINDOW,
  auditCarried,
  auditSeed,
  drawAudit,
  fulfillmentLine,
  normalizeOrderFills,
  pruneStaleVotes,
} from "@/lib/game/audit";
import { LARDER_MAX } from "@/lib/game/constants/supplies";
import { checkSave, snapshotFromSave } from "@/lib/game/integrity";
import type { OrderFill } from "@/lib/game/types";
import {
  CARRIES_A_DASH,
  LEDGER_PHRASE,
  call,
  check,
  openAuthedSocket,
  suffix,
  waitForEvent,
} from "../harness";
import type { WireHistory } from "../wire";
import type { Socket } from "socket.io-client";
import type { SmokeRun } from "../run";

export async function manifestAuditSuite(
  run: SmokeRun,
  inputs: {
    gambitFifth: {
      id: string;
      token: string;
      cookie: string;
      username: string;
    };
    gambitFourth: {
      id: string;
      token: string;
      cookie: string;
      username: string;
    };
    gambitHost: { id: string; token: string; cookie: string; username: string };
    gambitSecond: {
      id: string;
      token: string;
      cookie: string;
      username: string;
    };
    gambitSixth: {
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
  },
): Promise<void> {
  const {
    gambitFifth,
    gambitFourth,
    gambitHost,
    gambitSecond,
    gambitSixth,
    gambitThird,
  } = inputs;
  // [H6] The fleet's one evidence tool, and the only majority vote in
  // the game: from leg five, once a voyage, more than half of the
  // captains still sailing may open one captain's manifest and see two
  // of their last five order fulfillments.
  //
  // The checks come in the two halves the feature lives in. The sample
  // and the majority are pure arithmetic, so they are checked directly;
  // the vote itself is checked over the wire against a real harbor,
  // because a majority rule that is not wired to the checkpoint it is
  // called from is a rule that never fires.

  // ---- The sample, and the majority that asks for it ----
  const manifestFill = (
    round: number,
    port: string,
    type: string,
    qty: number,
    reward: number,
  ): OrderFill => ({ round, port, items: [{ type, qty }], reward });
  const sixFills: OrderFill[] = [
    manifestFill(1, "Quanzhou Port", "Tea", 2, 40),
    manifestFill(2, "Ningbo Port", "Silk", 1, 55),
    manifestFill(3, "Fuzhou Port", "Porcelain Clay", 3, 30),
    manifestFill(4, "Guangzhou Port", "Copper Ore", 2, 70),
    manifestFill(5, "Quanzhou Port", "Linen Clothes", 1, 90),
    manifestFill(6, "Ningbo Port", "Brocade", 2, 120),
  ];
  const auditKey = auditSeed("harbor-a", 1, 5, "captain-a");
  const drawnAudit = drawAudit(auditKey, sixFills);
  check(
    drawnAudit.length === AUDIT_REVEAL_COUNT &&
      JSON.stringify(drawAudit(auditKey, sixFills)) ===
        JSON.stringify(drawnAudit),
    `an audit of a full manifest reveals ${AUDIT_REVEAL_COUNT} lines, and the same seed draws the same ones every time`,
  );
  check(
    drawnAudit.every(
      (fill) =>
        sixFills.slice(-AUDIT_WINDOW).includes(fill) && fill.round !== 1,
    ) && new Set(drawnAudit).size === drawnAudit.length,
    `so a reveal can be checked against the record, and every line in it is a distinct one out of the last ${AUDIT_WINDOW}`,
  );
  check(
    new Set(
      Array.from({ length: 40 }, (_, i) =>
        JSON.stringify(drawAudit(`${auditKey}:${i}`, sixFills)),
      ),
    ).size > 1,
    "and it is a sample rather than the newest lines: different seeds draw different pairs out of the same five",
  );
  check(
    drawAudit(auditKey, sixFills.slice(0, 1)).length === 1 &&
      drawAudit(auditKey, []).length === 0,
    "a captain who has filed one order is shown one line, and a captain who has filed none is shown none",
  );
  check(
    auditSeed("harbor-a", 1, 5, "captain-a") !==
      auditSeed("harbor-a", 2, 5, "captain-a") &&
      auditSeed("harbor-a", 1, 6, "captain-a") !==
        auditSeed("harbor-a", 1, 5, "captain-a") &&
      auditSeed("harbor-a", 1, 5, "captain-b") !==
        auditSeed("harbor-a", 1, 5, "captain-a"),
    "the seed carries the voyage, the leg and the captain, so no two audits sample the same way",
  );

  // The majority. Strictly more than half, which is the plan's simple
  // majority read the only way it can be read: two captains cannot both
  // hold one, so there is no tie to break and the answer does not depend
  // on who answered first.
  const votesFor = (targets: string[]) =>
    new Map(targets.map((target, i) => [`voter-${i}`, target]));
  check(
    auditCarried(votesFor(["a", "a"]), 5) === null &&
      auditCarried(votesFor(["a", "a", "a"]), 5) === "a",
    "two of five is not a majority and three is",
  );
  check(
    auditCarried(votesFor(["a", "a", "a"]), 4) === "a" &&
      auditCarried(votesFor(["a", "a"]), 4) === null,
    "a table of four needs the same three, which is what a simple majority means at the smaller size",
  );
  check(
    auditCarried(votesFor(["a", "a", "a"]), 6) === null &&
      auditCarried(votesFor(["a", "a", "b", "a", "a"]), 6) === "a",
    "a table of six needs four, counted for whoever reaches it",
  );
  check(
    auditCarried(votesFor(["a", "b", "b"]), 5) === null &&
      auditCarried(new Map(), 5) === null,
    "a room split across two captains carries nothing, and neither does a room with no votes in it",
  );

  // The book of nominations, re-judged against the room that exists now.
  // A nomination is cast by one captain and for another, so both ends are
  // the roster's: a vote either of them has left behind is dropped rather
  // than counted under a shrunken roster, which is the same flaw the door
  // check closes for fresh votes, read on the votes already in the book.
  const liveRoster = new Set(["voter-0", "voter-1", "voter-2"]);
  const prunedBook = pruneStaleVotes(
    new Map([
      ["voter-0", "voter-1"],
      ["voter-1", "voter-0"],
      ["voter-2", "gone-captain"],
    ]),
    liveRoster,
  );
  check(
    prunedBook.size === 2 &&
      prunedBook.get("voter-0") === "voter-1" &&
      prunedBook.get("voter-1") === "voter-0" &&
      !prunedBook.has("voter-2"),
    "a nomination for a captain the room has stopped counting is dropped from the book, and one between counted captains stays",
  );
  check(
    pruneStaleVotes(new Map([["gone-captain", "voter-0"]]), liveRoster).size ===
      0 && pruneStaleVotes(new Map(), liveRoster).size === 0,
    "and a nomination cast by a captain the room has stopped counting goes the same way",
  );

  // The record behind the sample, which is the one thing in the mode a
  // whole table reads and believes, so its shape is judged here rather
  // than trusted.
  const messyManifest = normalizeOrderFills([
    manifestFill(1, "Quanzhou Port", "Tea", 2, 40),
    { round: 2, port: "Ningbo Port", items: [], reward: 10 },
    {
      round: 3,
      port: "Fuzhou Port",
      items: [{ type: "Tea", qty: 0 }],
      reward: 10,
    },
    { round: 4, port: "", items: [{ type: "Tea", qty: 1 }], reward: 10 },
    {
      round: 5,
      port: "Guangzhou Port",
      items: [{ type: "Tea", qty: 2 }],
      reward: -1,
    },
    {
      round: 5.8,
      port: "Ningbo Port",
      items: [{ type: "Tea", qty: 2 }],
      reward: 22.9,
    },
    "Leg 6: two Bundles of Tea to nowhere, 10 Gold",
  ]);
  check(
    messyManifest.length === 2 &&
      messyManifest[0].round === 1 &&
      messyManifest[1].round === 5 &&
      messyManifest[1].reward === 22,
    "a manifest is read for what it can hold: an empty line, a blank port, a zero count and a negative payout are dropped, and a fractional leg is floored",
  );
  const nineFills = Array.from({ length: 9 }, (_, i) =>
    manifestFill(i + 1, "Quanzhou Port", "Tea", 1, 10),
  );
  check(
    normalizeOrderFills(nineFills).length === AUDIT_WINDOW &&
      normalizeOrderFills(nineFills)[0].round === 9 - AUDIT_WINDOW + 1,
    `and a manifest of nine keeps the last ${AUDIT_WINDOW}, so the record the sample reads has a ceiling as well as a floor`,
  );
  check(
    normalizeOrderFills(undefined).length === 0 &&
      normalizeOrderFills("a manifest").length === 0 &&
      normalizeOrderFills([
        { round: 1, port: "Quanzhou Port", items: [{ type: "Tea", qty: 1 }] },
      ]).length === 0,
    "a save with no manifest, or with lines that are not one, reads as a captain who has filed nothing",
  );
  // The leg bound, which landed with the bug audit: a fill dated past the
  // leg the room itself has reached cannot be a thing the captain did, so
  // a reader that knows the room's leg drops it. Read from both sides
  // here, because both readers exist and they disagree on purpose: the
  // audit reveal passes the leg the vote carried in, the finish ledger
  // passes the voyage's own length, and the load path passes nothing,
  // because a save being healed has no room to be read against yet.
  const futureFills = [
    manifestFill(4, "Quanzhou Port", "Tea", 1, 10),
    manifestFill(5, "Ningbo Port", "Silk", 1, 10),
    manifestFill(6, "Fuzhou Port", "Porcelain Clay", 1, 10),
  ];
  check(
    normalizeOrderFills(futureFills, 5).length === 2 &&
      normalizeOrderFills(futureFills, 5).every((fill) => fill.round <= 5) &&
      normalizeOrderFills(futureFills).length === 3,
    "a fill dated past the leg the room has reached is dropped by the reader that knows the leg, and kept by the one that does not",
  );

  // [J1: the private information review] The bounds the review put on a
  // fill, read from both sides. A fill is printed to the whole table in
  // an audit reveal and in the ledger at the end of a voyage, and until
  // this pass the only bound on its text and its width was the client
  // that wrote it, so a doctored save could put a paragraph of its
  // choosing in front of six captains at the moment they were watching.
  // Each bound is deliberately generous, which is why both halves are
  // read here: what a real voyage produces survives, and what only a
  // doctored save could is dropped.
  const overlongPort = "A Port With A Name Long Enough To Fill A Line";
  const overlongGood = "A Good Named In A Sentence Rather Than In A Word";
  const longText = normalizeOrderFills([
    manifestFill(1, overlongPort, "Tea", 1, 10),
    manifestFill(2, "Ningbo Port", overlongGood, 1, 10),
    manifestFill(3, "Fuzhou Port", "Tea", 1, 10),
  ]);
  check(
    longText.length === 1 && longText[0].round === 3,
    "a port or a good named at a length no catalogue prints takes its whole line with it, and the ordinary line beside it stays",
  );
  const wideLines = normalizeOrderFills([
    {
      round: 1,
      port: "Quanzhou Port",
      items: Array.from({ length: 5 }, (_, i) => ({
        type: `Good ${i}`,
        qty: 1,
      })),
      reward: 10,
    },
    {
      round: 2,
      port: "Quanzhou Port",
      items: [{ type: "Tea", qty: 1000 }],
      reward: 10,
    },
    manifestFill(3, "Quanzhou Port", "Tea", 4, 10),
  ]);
  check(
    wideLines.length === 1 && wideLines[0].round === 3,
    "a line of five kinds of good and a line claiming a thousand units are dropped too, while four units of one good, the widest a real order asks for, is kept",
  );

  // The same list, read by the pass that guards every other number in a
  // save. It matters most here: this is the one record a room reads and
  // believes, so a save that could stuff it could lie to a whole table
  // at once.
  check(
    snapshotFromSave({ orderFills: sixFills.slice(-AUDIT_WINDOW) })
      ?.orderFills === AUDIT_WINDOW,
    "the Ledger Integrity Pass reads a manifest as the length of the list",
  );
  check(
    checkSave({ orderFills: 100000 }, 1).findings.some(
      (finding) => finding.field === "orderFills",
    ) && checkSave({ orderFills: AUDIT_WINDOW }, 5).severity === "ok",
    "so a manifest nobody could have filed is impossible and a full one is not",
  );

  // One manifest line, which is the reveal's whole vocabulary and the
  // only part of it a captain reads in words.
  const manifestLine = fulfillmentLine(
    manifestFill(6, "Ningbo Port", "Brocade", 2, 120),
  );
  check(
    manifestLine === "Leg 6: 2 Brocade to Ningbo Port, 120 Gold",
    "a manifest line names the leg, the goods, the port and what the order paid",
  );
  // Read with the same rule the briefings are read with, defined once at
  // the top of this file for the reason it is built out of code points:
  // a dash check should not be where the dashes are kept.
  check(
    !CARRIES_A_DASH.test(manifestLine),
    "and carries no dash of any kind, which is the house rule for every string a captain reads",
  );

  // ---- The vote, in a real harbor ----
  // Five captains, because five is the smallest table where a majority
  // is neither nearly everyone nor a coin toss: three carry and two do
  // not.
  const auditRoom = await call<{ room: { id: string; code: string } }>(
    "/api/rooms",
    {
      method: "POST",
      cookie: gambitHost.cookie,
      body: JSON.stringify({
        name: `Smoke audit ${suffix}`,
        isPublic: false,
        mode: "ocean_gambit",
        unlock: LEDGER_PHRASE,
      }),
    },
  );
  if (auditRoom.status !== 200) {
    throw new Error("No five captain harbor to call an audit in.");
  }
  const auditRoomId = auditRoom.body.room.id;
  const auditCrew = [gambitSecond, gambitThird, gambitFourth, gambitFifth];
  const auditSeats = await Promise.all(
    auditCrew.map((captain) =>
      call<{ room: { id: string } }>("/api/rooms/join", {
        method: "POST",
        cookie: captain.cookie,
        body: JSON.stringify({ code: auditRoom.body.room.code }),
      }),
    ),
  );
  check(
    auditSeats.every((join) => join.status === 200),
    "five captains can sit at the table an audit is called from",
  );

  const auditSockets: Socket[] = [];
  for (const captain of [gambitHost, ...auditCrew]) {
    const socket = await openAuthedSocket(captain);
    run.sockets.push(socket);
    const takenASeat = waitForEvent<WireHistory>(
      socket,
      "chat:history",
      (payload) => payload?.roomId === auditRoomId,
    );
    socket.emit("room:join", { roomId: auditRoomId });
    await takenASeat;
    auditSockets.push(socket);
  }

  const auditTargetId = gambitFourth.id;
  const tallyFrames: Array<{ votes: Record<string, string> }> = [];
  const revealFrames: Array<{ socket: number; reveal: AuditReveal }> = [];
  auditSockets.forEach((socket, index) => {
    socket.on("audit:tally", (payload: { votes?: Record<string, string> }) => {
      tallyFrames.push({ votes: payload?.votes ?? {} });
    });
    socket.on("audit:reveal", (payload: AuditReveal) => {
      revealFrames.push({ socket: index, reveal: payload });
    });
  });
  const auditSettle = () => new Promise((resolve) => setTimeout(resolve, 400));

  // Before the harbor has sailed there is no checkpoint to call a vote
  // from, which is the first of the three ways a nomination is refused.
  auditSockets[1].emit("audit:vote", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    targetUserId: auditTargetId,
  });
  await auditSettle();
  check(
    tallyFrames.length === 0,
    "a nomination in a harbor that has not set sail is refused",
  );

  const auditDeparture = auditSockets.map((socket) =>
    waitForEvent<{ roomId: string }>(
      socket,
      "room:started",
      (payload) => payload?.roomId === auditRoomId,
    ),
  );
  auditSockets[0].emit("room:start", { roomId: auditRoomId });
  await Promise.all(auditDeparture);

  // And once it has sailed, the vote belongs to one checkpoint: the leg
  // five Parley. Anywhere else it is refused, which is what keeps the
  // audit's price (the rest of that leg's trading) a price for the audit
  // rather than a tax on the voyage.
  auditSockets[1].emit("audit:vote", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    targetUserId: auditTargetId,
  });
  await auditSettle();
  check(
    tallyFrames.length === 0,
    "and one called from a checkpoint that is not the leg five Parley is refused",
  );

  // A harbor reaches leg five the way it reaches every leg: a captain
  // reports where they are standing and the room's checkpoint follows the
  // furthest report. Nothing here is special to the audit.
  auditSockets[1].emit("game:status", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    phase: "parley",
    phaseLabel: "Parley",
    gold: 120,
    reputation: 12,
    shipLevel: 0,
    gameOver: false,
    renownLevel: 3,
  });
  const auditRoomRow = () =>
    db.room.findUnique({
      where: { id: auditRoomId },
      select: { currentRound: true, currentPhase: true, voyageEpoch: true },
    });
  let auditCheckpoint = await auditRoomRow();
  for (
    let waited = 0;
    (auditCheckpoint?.currentRound !== AUDIT_FROM_ROUND ||
      auditCheckpoint?.currentPhase !== "parley") &&
    waited < 5000;
    waited += 250
  ) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    auditCheckpoint = await auditRoomRow();
  }
  check(
    auditCheckpoint?.currentRound === AUDIT_FROM_ROUND &&
      auditCheckpoint?.currentPhase === "parley",
    `the room's checkpoint is at leg ${AUDIT_FROM_ROUND}'s Parley, where the vote is called from`,
  );
  const auditVoyage = auditCheckpoint?.voyageEpoch ?? 0;

  // The manifest the audit is judged against, written through the route
  // a client saves through rather than into the row directly, so what the
  // reveal below is compared against arrived the way a captain's record
  // arrives. Five lines, so the window the sample reads is exactly what
  // was filed here and the reveal can be read line for line.
  const auditFills: OrderFill[] = [
    manifestFill(1, "Quanzhou Port", "Tea", 2, 40),
    manifestFill(2, "Ningbo Port", "Silk", 1, 55),
    manifestFill(3, "Fuzhou Port", "Porcelain Clay", 3, 30),
    manifestFill(4, "Guangzhou Port", "Copper Ore", 2, 70),
    manifestFill(5, "Quanzhou Port", "Linen Clothes", 1, 90),
  ];
  const auditSeeded = await call<{ ok: boolean }>("/api/game/state", {
    method: "PUT",
    cookie: gambitFourth.cookie,
    body: JSON.stringify({
      roomId: auditRoomId,
      data: { orderFills: auditFills },
    }),
  });
  const auditSeededRow = await db.gameState.findUnique({
    where: { userId_roomId: { userId: auditTargetId, roomId: auditRoomId } },
    select: { data: true },
  });
  const auditSeededData = auditSeededRow?.data
    ? (JSON.parse(auditSeededRow.data) as { orderFills?: unknown[] })
    : null;
  check(
    auditSeeded.status === 200 &&
      auditSeededData?.orderFills?.length === AUDIT_WINDOW,
    "the harness can hand a captain the manifest their audit is read from",
  );

  // A nomination is public: the room watches the count. Two of five is
  // not a majority, so the room hears who was named and no manifest
  // opens.
  auditSockets[1].emit("audit:vote", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    targetUserId: auditTargetId,
  });
  await auditSettle();
  check(
    tallyFrames.length === auditSockets.length &&
      tallyFrames.every(
        (frame) => frame.votes[gambitSecond.id] === auditTargetId,
      ) &&
      revealFrames.length === 0,
    "a nomination reaches every captain in the harbor, and one of five opens nothing",
  );

  auditSockets[2].emit("audit:vote", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    targetUserId: auditTargetId,
  });
  await auditSettle();
  check(
    tallyFrames.length === auditSockets.length * 2 && revealFrames.length === 0,
    "two of five is still not a majority, so the count moves and the manifest stays shut",
  );

  // A nomination of a captain this harbor is not counting is dropped
  // rather than tallied: a majority is a share of this table, and a vote
  // counted for someone outside it would move a number with nobody
  // behind it.
  auditSockets[3].emit("audit:vote", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    targetUserId: gambitSixth.id,
  });
  await auditSettle();
  check(
    tallyFrames.length === auditSockets.length * 2,
    "and a captain who is not in this harbor cannot be nominated into one",
  );

  // The third of five carries. What opens is the sample the seed draws
  // out of the manifest the captain filed, which is the property that
  // makes a reveal checkable rather than trusted: the server is the only
  // party that can read the record, but anyone holding it can arrive at
  // the identical two lines.
  const auditExpected = drawAudit(
    auditSeed(auditRoomId, auditVoyage, AUDIT_FROM_ROUND, auditTargetId),
    auditFills,
  );
  auditSockets[3].emit("audit:vote", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    targetUserId: auditTargetId,
  });
  await auditSettle();
  check(
    tallyFrames.length === auditSockets.length * 3 &&
      revealFrames.length === auditSockets.length &&
      new Set(revealFrames.map((frame) => frame.socket)).size ===
        auditSockets.length,
    "the third of five carries: the count goes out and the manifest opens once on every socket",
  );
  check(
    revealFrames.every(
      (frame) =>
        JSON.stringify(frame.reveal?.fulfillments) ===
        JSON.stringify(auditExpected),
    ),
    "and the lines it opens are the sample the seed draws out of the record the captain filed",
  );
  check(
    revealFrames.every(
      (frame) =>
        frame.reveal?.roomId === auditRoomId &&
        frame.reveal?.round === AUDIT_FROM_ROUND &&
        frame.reveal?.target?.userId === auditTargetId &&
        frame.reveal?.target?.name === "Smoke gamb_d",
    ),
    "naming the harbor, the leg and the captain the majority named, by the name the table knows them by",
  );

  // What the reveal carries is its allow list read the other way round,
  // and that is a security property rather than a shape preference: the
  // same save holds this captain's Gold, their hold and their card, so
  // the check is that none of it came out with the manifest.
  //
  // [C1: the Larder and Short Rations] `larder` came out of this list
  // when C1 landed, and the change is worth reading closely because
  // pulling a word out of a sweep is exactly how a real leak would be
  // smuggled past one. The plan's audit clause names the Larder: the
  // reveal is two fulfillments plus the audited captain's current Larder,
  // and never the card, the Gold or the hold. So the word belongs in the
  // reveal and it is asserted below, positively and by shape, rather than
  // deleted and forgotten. Every other private word stays forbidden, and
  // the key list under this one is still exact, so a third field arriving
  // in the reveal is a failure whether or not anyone remembered to add
  // its name here.
  const auditBody = JSON.stringify({
    round: revealFrames[0]?.reveal?.round,
    target: revealFrames[0]?.reveal?.target,
    fulfillments: revealFrames[0]?.reveal?.fulfillments,
  }).toLowerCase();
  const auditForbidden = [
    "pirate",
    "broker",
    "honest",
    "traitor",
    "loyal",
    "role",
    "align",
    "card",
    "flourish",
    "ally",
    "gold",
    "purse",
    "hold",
    "inventory",
    "money",
    "score",
  ];
  check(
    auditForbidden.every((word) => !auditBody.includes(word)),
    "the reveal carries no alignment, no card, no Gold and no hold, word for word",
  );
  const auditRevealFrame = revealFrames[0]?.reveal;
  // The reveal's whole field list, one of exactly two shapes and never a
  // third. Which one depends on the provisions layer, which is read from
  // the frame itself rather than from this process's environment: the
  // harness and the server it is pointed at are two processes, and a
  // suite that assumed they shared a switch would pass here while lying
  // about a live deployment.
  const hasLarder = auditRevealFrame?.larder !== undefined;
  // The provisions pair rides together or not at all: the count the badge
  // prints and the engine's own short rations reading the sentence prints
  // (see AuditReveal.shortRations). Both are the same disclosure, so the
  // shape below has two forms rather than three.
  check(
    Object.keys(auditRevealFrame ?? {})
      .sort()
      .join(",") ===
      (hasLarder
        ? "fulfillments,larder,roomId,round,shortRations,target"
        : "fulfillments,roomId,round,target"),
    "the reveal's fields are the plan's allow list and nothing else, with the Larder pair on it when the provisions layer is on: the count the badge prints and the engine's own short rations reading the sentence prints, so the reveal says what the rule says rather than what the number suggests",
  );
  check(
    !hasLarder || typeof auditRevealFrame?.shortRations === "boolean",
    "and the reading beside the count is that rule's own answer as a boolean, where a sentence drawn from the count alone used to describe a captain who lost every hand as a crew on short rations",
  );
  check(
    !hasLarder ||
      (Number.isInteger(auditRevealFrame?.larder) &&
        (auditRevealFrame?.larder ?? -1) >= 0 &&
        (auditRevealFrame?.larder ?? -1) <= LARDER_MAX),
    "and the one number the reveal was always meant to open is a whole count inside the hold's own ends",
  );
  check(
    Object.keys(auditRevealFrame?.target ?? {})
      .sort()
      .join(",") === "name,userId" &&
      Object.keys(auditRevealFrame?.fulfillments?.[0] ?? {})
        .sort()
        .join(",") === "items,port,reward,round" &&
      Object.keys(auditRevealFrame?.fulfillments?.[0]?.items?.[0] ?? {})
        .sort()
        .join(",") === "qty,type",
    "and the frame's shape is that allow list, field for field",
  );

  // One audit a voyage. Nothing tells the room it is spent: a later
  // nomination, of anyone, is simply not the first one.
  auditSockets[4].emit("audit:vote", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    targetUserId: gambitHost.id,
  });
  await auditSettle();
  check(
    tallyFrames.length === auditSockets.length * 3 &&
      revealFrames.length === auditSockets.length,
    "a harbor gets one audit a voyage: a later nomination changes nothing",
  );

  // The audit spends the leg's Parley, and the room leaves it the way a
  // room leaves every leg: every captain marks ready. What the server
  // does is tell the room what it found; the leaving is the clients',
  // and the ready votes below stand in for them. A server that emptied
  // the checkpoint's ready set on the room's behalf would move the
  // checkpoint while every client sat waiting to be told to move, which
  // is the one way to leave a harbor stuck forever, so what this
  // actually proves is that the vote left the room able to advance.
  const auditAdvances = auditSockets.map((socket) =>
    waitForEvent<{ roomId: string; round: number; phase: string }>(
      socket,
      "phase:advance",
      (payload) => payload?.roomId === auditRoomId,
    ),
  );
  for (const socket of auditSockets) {
    socket.emit("phase:ready", {
      roomId: auditRoomId,
      round: AUDIT_FROM_ROUND,
      phase: "parley",
    });
  }
  const auditLeft = await Promise.all(auditAdvances);
  check(
    auditLeft.every(
      (frame) => frame?.round === AUDIT_FROM_ROUND && frame?.phase === "parley",
    ),
    "the room leaves the Parley the audit spent, carrying the checkpoint it was leaving",
  );

  // A captain who comes back after the vote sees what the harbor saw.
  // The finding is public because the room voted for it, and a table
  // arguing about an audit one of them cannot see is a table arguing
  // past each other.
  //
  // The reload is the path this hand-out actually serves, and the check
  // is written as one because a voyage in flight is closed to new seats
  // (see roomLockedFor): the same captain, a fresh socket, which is
  // what a client that comes back mid voyage opens.
  const auditReloadSocket = await openAuthedSocket(gambitFifth);
  run.sockets.push(auditReloadSocket);
  const handedReveal = waitForEvent<AuditReveal>(
    auditReloadSocket,
    "audit:reveal",
    (payload) => payload?.roomId === auditRoomId,
  );
  auditReloadSocket.emit("room:join", { roomId: auditRoomId });
  const auditHanded = await handedReveal;
  check(
    auditHanded?.target?.userId === auditTargetId &&
      JSON.stringify(auditHanded?.fulfillments) ===
        JSON.stringify(auditExpected),
    "a captain who reloads after the vote is handed the finding the harbor was shown",
  );
  await auditSettle();
  check(
    revealFrames.length === auditSockets.length,
    "and the captains who already saw it are not shown it twice",
  );

  // A restarted voyage has audited nobody, and that is the load bearing
  // half of the once per voyage rule: the reveal is the flag that spends
  // the audit, so a voyage that inherited one would find its own spent
  // before it began, and its first vote would vanish with no frame to
  // explain why.
  auditSockets[0].emit("room:restart", { roomId: auditRoomId });
  let auditReopened = await auditRoomRow();
  for (
    let waited = 0;
    (auditReopened?.currentRound !== 1 ||
      auditReopened?.currentPhase !== "harbor") &&
    waited < 5000;
    waited += 250
  ) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    auditReopened = await auditRoomRow();
  }
  check(
    auditReopened?.currentRound === 1 &&
      auditReopened?.currentPhase === "harbor",
    "restarting the voyage reopens the harbor at its first checkpoint",
  );
  // The captain asking is one of the harbor's own, so the absence below
  // is the hand-out declining rather than the server refusing a stranger
  // the door: a captain who is not a member is turned away before any of
  // this and would prove nothing about the reveal.
  const auditRejoin = await openAuthedSocket(gambitFifth);
  run.sockets.push(auditRejoin);
  const staleReveal = waitForEvent<AuditReveal>(
    auditRejoin,
    "audit:reveal",
    (payload) => payload?.roomId === auditRoomId,
    1200,
  );
  auditRejoin.emit("room:join", { roomId: auditRoomId });
  check(
    (await staleReveal) === null,
    "and a harbor that has just reopened hands nobody the last voyage's finding",
  );

  // [bug audit] The room that reopens is the room the two walks below
  // sail. The first is the stale nomination: a vote the book still holds
  // from a captain the room has stopped counting must not carry a
  // majority with nobody behind it. The book below holds two, the second
  // captain goes bankrupt mid leg, and the room is four. Without the
  // prune the third nomination would be the third vote in the book and
  // the manifest would open two captains early; with it, the third vote
  // is two of four and the fourth is what opens.
  const auditVoyageTwo = auditSockets.map((socket) =>
    waitForEvent<{ roomId: string }>(
      socket,
      "room:started",
      (payload) => payload?.roomId === auditRoomId,
    ),
  );
  auditSockets[0].emit("room:start", { roomId: auditRoomId });
  await Promise.all(auditVoyageTwo);
  auditSockets[1].emit("game:status", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    phase: "parley",
    phaseLabel: "Parley",
    gold: 120,
    reputation: 12,
    shipLevel: 0,
    gameOver: false,
    renownLevel: 3,
  });
  for (
    let waited = 0;
    ((await auditRoomRow())?.currentRound !== AUDIT_FROM_ROUND ||
      (await auditRoomRow())?.currentPhase !== "parley") &&
    waited < 5000;
    waited += 250
  ) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const revealBase = revealFrames.length;
  const tallyBase = tallyFrames.length;
  auditSockets[0].emit("audit:vote", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    targetUserId: auditTargetId,
  });
  auditSockets[1].emit("audit:vote", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    targetUserId: auditTargetId,
  });
  await auditSettle();
  // The second captain goes bankrupt mid leg. The room stops counting
  // them there and then, and the nomination they already cast stays in
  // the book until the next one forces the book to be re-read.
  auditSockets[1].emit("game:status", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    phase: "bankruptcy",
    phaseLabel: "Bankrupt",
    gold: 0,
    reputation: 0,
    shipLevel: 0,
    gameOver: false,
    renownLevel: 3,
  });
  await auditSettle();
  auditSockets[2].emit("audit:vote", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    targetUserId: auditTargetId,
  });
  await auditSettle();
  const prunedTally = tallyFrames[tallyFrames.length - 1];
  check(
    // A tally reaches every captain, so one vote is one frame per socket.
    tallyFrames.length === tallyBase + auditSockets.length * 3 &&
      revealFrames.length === revealBase &&
      Object.keys(prunedTally?.votes ?? {}).length === 2 &&
      !(gambitSecond.id in (prunedTally?.votes ?? {})) &&
      prunedTally?.votes[gambitHost.id] === auditTargetId &&
      prunedTally?.votes[gambitThird.id] === auditTargetId,
    "a nomination from a captain the room has stopped counting leaves the book when the next one lands, so two of the four still sailing open nothing",
  );
  auditSockets[3].emit("audit:vote", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    targetUserId: auditTargetId,
  });
  await auditSettle();
  check(
    tallyFrames.length === tallyBase + auditSockets.length * 4 &&
      revealFrames.length === revealBase + auditSockets.length &&
      revealFrames[revealFrames.length - 1]?.reveal?.target?.userId ===
        auditTargetId,
    "and the fourth nomination is the majority of four, so the pruned book carries for real",
  );

  // The second walk is the marked manifest: a row the Ledger Integrity
  // Pass has judged impossible is the one save the room must not read
  // anything out of, because every number in it is exactly as
  // trustworthy as the number that failed. The reveal for it withholds
  // the lines and the Larder and carries the flag instead, the same
  // choice the finish ledger makes for a forged voyage. The lines are
  // filed below on purpose: an empty manifest would read the same way
  // whether or not the withholding worked, so the check is that a
  // manifest this captain filed did not come out.
  auditSockets[0].emit("room:restart", { roomId: auditRoomId });
  for (
    let waited = 0;
    ((await auditRoomRow())?.currentRound !== 1 ||
      (await auditRoomRow())?.currentPhase !== "harbor") &&
    waited < 5000;
    waited += 250
  ) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const auditVoyageThree = auditSockets.map((socket) =>
    waitForEvent<{ roomId: string }>(
      socket,
      "room:started",
      (payload) => payload?.roomId === auditRoomId,
    ),
  );
  auditSockets[0].emit("room:start", { roomId: auditRoomId });
  await Promise.all(auditVoyageThree);
  auditSockets[1].emit("game:status", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    phase: "parley",
    phaseLabel: "Parley",
    gold: 120,
    reputation: 12,
    shipLevel: 0,
    gameOver: false,
    renownLevel: 3,
  });
  for (
    let waited = 0;
    ((await auditRoomRow())?.currentRound !== AUDIT_FROM_ROUND ||
      (await auditRoomRow())?.currentPhase !== "parley") &&
    waited < 5000;
    waited += 250
  ) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const flaggedSeeded = await call<{ ok: boolean }>("/api/game/state", {
    method: "PUT",
    cookie: gambitFourth.cookie,
    body: JSON.stringify({
      roomId: auditRoomId,
      data: { orderFills: auditFills, money: 9_999_999_999 },
    }),
  });
  const flaggedRow = await db.gameState.findUnique({
    where: { userId_roomId: { userId: auditTargetId, roomId: auditRoomId } },
    select: { integritySeverity: true },
  });
  check(
    flaggedSeeded.status === 200 &&
      flaggedRow?.integritySeverity === "impossible",
    "a save whose books the Ledger Integrity Pass cannot reconcile is marked before the room ever looks at it",
  );
  const flaggedBase = revealFrames.length;
  for (const voter of [auditSockets[0], auditSockets[2], auditSockets[4]]) {
    voter.emit("audit:vote", {
      roomId: auditRoomId,
      round: AUDIT_FROM_ROUND,
      targetUserId: auditTargetId,
    });
  }
  await auditSettle();
  const flaggedFrame = revealFrames[revealFrames.length - 1]?.reveal;
  check(
    revealFrames.length === flaggedBase + auditSockets.length &&
      flaggedFrame?.flagged === true &&
      (flaggedFrame?.fulfillments?.length ?? -1) === 0 &&
      flaggedFrame?.larder === undefined,
    "and the marked manifest opens withheld: the flag instead of the lines, and the Larder off the frame rather than zeroed",
  );
  check(
    Object.keys(flaggedFrame ?? {})
      .sort()
      .join(",") === "flagged,fulfillments,roomId,round,target",
    "with the reveal's exact field list one word longer than the ordinary one, and nothing else on it",
  );
}
