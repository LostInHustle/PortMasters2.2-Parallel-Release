// PortMasters 2.2 Parallel Release, smoke run: The Manifest Audit.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AuditReveal, AuditTally } from "@/types/realtime/audit";
import type { PublicUser } from "@/lib/api";
import { db } from "@/lib/db";
import {
  AUDIT_FROM_ROUND,
  AUDIT_REVEAL_COUNT,
  AUDIT_WINDOW,
  auditCarried,
  auditNamesNeeded,
  auditSeed,
  drawAudit,
  fulfillmentLine,
  normalizeOrderFills,
  pruneStaleVotes,
} from "@/lib/game/audit";
import { LARDER_MAX } from "@/lib/game/constants/supplies";
import { checkSave, snapshotFromSave } from "@/lib/game/integrity";
import { maroonCarried, maroonNamesNeeded } from "@/lib/game/maroon";
import type { OrderFill } from "@/lib/game/types";
import { leaderShortfall, tallyRows } from "@/lib/voteTally";
import {
  CARRIES_A_DASH,
  LEDGER_PHRASE,
  call,
  carriesADash,
  check,
  openAuthedSocket,
  suffix,
  waitForEvent,
  withoutComments,
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

  // The count a card prints, held against the comparison that decides the
  // vote rather than against a second statement of the same rule. A card
  // that told the room one name fewer was enough, or one more, would be a
  // card the table argued with instead of each other, and the two were
  // written apart: the walk below is the one that keeps them one rule.
  const neededCarries = (roster: number) => {
    const needed = auditNamesNeeded(roster);
    return (
      auditCarried(
        votesFor(Array.from({ length: needed }, () => "a")),
        roster,
      ) === "a" &&
      (needed === 0 ||
        auditCarried(
          votesFor(Array.from({ length: needed - 1 }, () => "a")),
          roster,
        ) === null)
    );
  };
  check(
    Array.from({ length: 12 }, (_, i) => i + 1).every(neededCarries) &&
      auditNamesNeeded(0) === 0,
    "the count a card prints is the count the vote carries on: at every roster from one to twelve, one name fewer carries nothing and the count carries",
  );
  check(
    auditNamesNeeded(4) === 3 &&
      auditNamesNeeded(5) === 3 &&
      auditNamesNeeded(6) === 4,
    "which is more than half read as whole names: three of four, three of five and four of six",
  );

  // The other half of what a card prints, and the question a captain
  // actually asks of a running count: how many more names the leading
  // target needs before it carries (see leaderShortfall in
  // @/lib/voteTally). It reads off the same rows the count block draws
  // and the same threshold the walk above carries on, so the sentence a
  // captain reads and the arithmetic the server decides on cannot come
  // apart, and a book with no names in it has no leader to be short.
  const shortfallMembers: PublicUser[] = [
    {
      id: "captain-a",
      username: "captain-a",
      displayName: "AaronZ",
      avatarHue: 10,
    },
    {
      id: "captain-b",
      username: "captain-b",
      displayName: "Bess",
      avatarHue: 200,
    },
  ];
  const shortfallRows = (names: number, target = "captain-a") =>
    tallyRows(
      Object.fromEntries(
        Array.from({ length: names }, (_, i) => [`voter-${i}`, target]),
      ),
      shortfallMembers,
    );
  check(
    leaderShortfall(tallyRows({}, []), 3) === null &&
      leaderShortfall([], 1) === null,
    "a book with no names in it has no leader, so the count prints no shortfall for a vote nobody has spoken in rather than a leader short by the whole of it",
  );
  const shortfallAt = (roster: number) => {
    const needed = auditNamesNeeded(roster);
    const full = leaderShortfall(shortfallRows(needed), needed);
    const oneShort = leaderShortfall(shortfallRows(needed - 1), needed);
    return (
      full?.short === 0 &&
      (needed === 1 ? oneShort === null : oneShort?.short === 1)
    );
  };
  check(
    Array.from({ length: 12 }, (_, i) => i + 1).every(shortfallAt),
    "at every roster from one to twelve the leading name is short by nothing once the book holds the names the vote needs, and by one name when one fewer is in, which is the line the count prints rather than a second sum",
  );
  const loneLeader = leaderShortfall(shortfallRows(1), auditNamesNeeded(7));
  check(
    auditNamesNeeded(7) === 4 &&
      loneLeader?.name === "AaronZ" &&
      loneLeader?.short === 3,
    "and a lone name in a four name vote is short by three, so the line counts the names still missing rather than always saying one more",
  );
  const splitLeader = leaderShortfall(
    tallyRows(
      {
        "voter-0": "captain-a",
        "voter-1": "captain-b",
        "voter-2": "captain-a",
      },
      shortfallMembers,
    ),
    3,
  );
  check(
    splitLeader?.name === "AaronZ" && splitLeader?.short === 1,
    "a book split across two names reports the shortfall of the one it is standing behind: two names for AaronZ against one for Bess leaves AaronZ one short of the three",
  );
  const tiedLeader = leaderShortfall(
    tallyRows(
      { "voter-0": "captain-a", "voter-1": "captain-b" },
      shortfallMembers,
    ),
    2,
  );
  check(
    tiedLeader?.name === "AaronZ" && tiedLeader?.short === 1,
    "and a tie goes to the row the map yielded first, which is the order the nominations arrived in on this side rather than a winner settled by name",
  );

  // The other threshold the same walk carries, pinned beside this one
  // because the two votes are one count read at two thresholds rather than
  // two counts (see carriedTarget in @/lib/game/audit). The band is the
  // sizes this mode deals, and it is walked through both votes at once so
  // a change to either threshold, or to the walk under both, is a failure
  // here rather than a difference found by playing: at five seats the plan
  // reads four votes against three.
  const carriesExactlyAt = (
    carried: (
      votes: ReadonlyMap<string, string>,
      roster: number,
    ) => string | null,
    needed: (roster: number) => number,
    roster: number,
  ) => {
    const at = needed(roster);
    return (
      carried(votesFor(Array.from({ length: at }, () => "a")), roster) ===
        "a" &&
      (at === 0 ||
        carried(votesFor(Array.from({ length: at - 1 }, () => "a")), roster) ===
          null)
    );
  };
  check(
    [3, 4, 5, 6, 7].every(
      (roster) =>
        carriesExactlyAt(auditCarried, auditNamesNeeded, roster) &&
        carriesExactlyAt(maroonCarried, maroonNamesNeeded, roster),
    ),
    "the audit's majority and the maroon's two thirds are one walk read at two thresholds: at every table from three seats to seven each vote carries at its own whole count of names, and one name fewer carries neither",
  );
  check(
    auditNamesNeeded(5) === 3 &&
      maroonNamesNeeded(5) === 4 &&
      auditNamesNeeded(7) === 4 &&
      maroonNamesNeeded(7) === 5,
    "which at a five seat harbor is four votes against three and at seven is five against four, so the maroon stays the deliberately harder of the two to call",
  );

  // The book of nominations, judged again against the room that exists now.
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
  // The tally is read for its whole frame rather than for the map alone:
  // the roster the vote is divided by, the count that carries it and the
  // captains still to name someone all ride with the names, and a card
  // that printed a threshold of its own would print one the server does
  // not agree with (see AuditTally).
  const tallyFrames: Array<{
    votes: Record<string, string>;
    roster: number;
    needed: number;
    awaiting: string[];
  }> = [];
  const revealFrames: Array<{ socket: number; reveal: AuditReveal }> = [];
  auditSockets.forEach((socket, index) => {
    socket.on("audit:tally", (payload: AuditTally) => {
      tallyFrames.push({
        votes: payload?.votes ?? {},
        roster: payload?.roster ?? 0,
        needed: payload?.needed ?? 0,
        awaiting: payload?.awaiting ?? [],
      });
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
  // What the card needs to say out loud, on the frame rather than worked
  // out on the client: five captains still sailing, three names to carry
  // it, and the four who have not named anyone yet. The captain who is not
  // in this harbor is not among the four, because the roster behind the
  // count is the room's own and not the account list.
  const firstTally = tallyFrames[0];
  const firstAwaiting = firstTally?.awaiting ?? [];
  check(
    firstTally?.roster === auditSockets.length &&
      firstTally?.needed === auditNamesNeeded(auditSockets.length) &&
      firstTally?.needed === 3 &&
      firstAwaiting.length === auditSockets.length - 1 &&
      !firstAwaiting.includes(gambitSecond.id) &&
      [gambitHost.id, gambitThird.id, gambitFourth.id, gambitFifth.id].every(
        (id) => firstAwaiting.includes(id),
      ),
    "and the count travels with the names: five still sailing, three names to carry, and the four captains the room is still waiting on",
  );
  // The shortfall the card prints, derived from the frame the card is
  // reading rather than sent as a fourth number on it: the census still
  // balances against the names in the book, so the roster, the threshold
  // and the captains still to speak are all there to read, and one name
  // in leaves the leader exactly one short of the count that carries.
  const firstRows = tallyRows(firstTally?.votes ?? {}, []);
  const firstLeader = leaderShortfall(firstRows, firstTally?.needed ?? 0);
  check(
    firstTally?.awaiting.length ===
      (firstTally?.roster ?? -1) -
        firstRows.reduce((count, row) => count + row.voters.length, 0) &&
      firstLeader?.short === (firstTally?.needed ?? -1) - 1,
    "and the shortfall read off that frame is the frame's own arithmetic: one name in leaves two more needed, and the census it was read against still balances the captains still to speak against the names in the book",
  );

  // A captain names one captain a leg. Both ways a second press can arrive
  // are refused here at the door: the same name again, and a different
  // name, which is the press that could move the table's count after the
  // table was shown it. The refusal is a sentence, because a captain whose
  // press did not land is owed the reason rather than silence.
  const auditRefusals: string[] = [];
  auditSockets[1].on("audit:error", (payload: { error?: string }) => {
    if (typeof payload?.error === "string") auditRefusals.push(payload.error);
  });
  auditSockets[1].emit("audit:vote", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    targetUserId: auditTargetId,
  });
  auditSockets[1].emit("audit:vote", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    targetUserId: gambitHost.id,
  });
  await auditSettle();
  check(
    auditRefusals.length === 2 &&
      auditRefusals.every(
        (line) => line.length > 0 && !CARRIES_A_DASH.test(line),
      ),
    "a captain votes once: a second press, for the same name or for another, is refused with a sentence a captain can read",
  );
  check(
    tallyFrames.length === auditSockets.length &&
      tallyFrames.every(
        (frame) =>
          Object.keys(frame.votes).length === 1 &&
          frame.votes[gambitSecond.id] === auditTargetId,
      ) &&
      revealFrames.length === 0,
    "and the count does not move: the book still holds the one name the table was shown, whatever the refused presses asked for",
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

  // A nomination of a captain this harbor is not counting is refused
  // rather than tallied: a majority is a share of this table, and a vote
  // counted for someone outside it would move a number with nobody
  // behind it. The refusal is a sentence for the captain who sent it,
  // which is what keeps a nomination that did not land from reading as a
  // nomination that did.
  const strangerRefusals: string[] = [];
  auditSockets[3].on("audit:error", (payload: { error?: string }) => {
    if (typeof payload?.error === "string")
      strangerRefusals.push(payload.error);
  });
  auditSockets[3].emit("audit:vote", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    targetUserId: gambitSixth.id,
  });
  await auditSettle();
  check(
    tallyFrames.length === auditSockets.length * 2 &&
      strangerRefusals.length === 1 &&
      !CARRIES_A_DASH.test(strangerRefusals[0] ?? ""),
    "a captain who is not in this harbor cannot be nominated into one, and the captain who tried is told so",
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

  // One audit a voyage. The room watched it carry, so the card is gone
  // from every screen; a frame that names another captain anyway is
  // refused at the door and answered with the reason, because a captain
  // whose press did nothing is owed the sentence rather than a silence
  // there is nothing to read.
  const spentRefusals: string[] = [];
  auditSockets[4].on("audit:error", (payload: { error?: string }) => {
    if (typeof payload?.error === "string") spentRefusals.push(payload.error);
  });
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
  check(
    spentRefusals.length === 1 && !CARRIES_A_DASH.test(spentRefusals[0] ?? ""),
    "and the captain who sent it is told the voyage's audit has carried rather than left watching a count that never moved",
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
  // The reload is the path this handoff actually serves, and the check
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
  // is the handoff declining rather than the server refusing a stranger
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
  // The count before anyone has voted, which is the one count no
  // broadcast carries: a leg's book is built by the captains in it, so
  // the empty one is never sent, and a card that opens first has to ask
  // (see audit:state:request in src/server/realtime/wiring/audit.ts). The
  // answer is the tally frame itself, so the numbers a card reads before
  // the first vote are the numbers it reads after it.
  const askedTally = waitForEvent<AuditTally>(
    auditSockets[0],
    "audit:tally",
    (payload) => payload?.roomId === auditRoomId,
  );
  auditSockets[0].emit("audit:state:request", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
  });
  const auditBoard = await askedTally;
  check(
    auditBoard?.round === AUDIT_FROM_ROUND &&
      Object.keys(auditBoard?.votes ?? {}).length === 0 &&
      auditBoard?.roster === auditSockets.length &&
      auditBoard?.needed === 3 &&
      auditBoard?.awaiting.length === auditSockets.length,
    "a card that has just opened can read the count before anyone has voted: five still sailing, three names to carry, nobody named yet and every captain still to name someone",
  );

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
  // the book until the next one forces the book to be read again.
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
  const prunedAwaiting = prunedTally?.awaiting ?? [];
  check(
    prunedTally?.roster === auditSockets.length - 1 &&
      prunedTally?.needed === 3 &&
      prunedAwaiting.length === 2 &&
      !prunedAwaiting.includes(gambitSecond.id) &&
      [gambitFourth.id, gambitFifth.id].every((id) =>
        prunedAwaiting.includes(id),
      ),
    "and the count the card reads agrees with the book: four still sailing, three names to carry, the captain who left not among the two the room is waiting on",
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

  // ---- The two halves of a carry ----
  // The fourth walk, and the two ways a carry can fall through; both of
  // them are about a room that moves while the vote is standing rather
  // than about the arithmetic, which is why they are read on the wire.
  //
  // The first is the membership row. A captain who walks out gives up
  // their seat through the route the Leave button posts to, and that row
  // is what the roster is read from, so a nomination they cast a moment
  // earlier is a vote the room has stopped counting. The socket is left
  // open on purpose: no room:leave is sent, which is the shape a client
  // that walked out without cleaning up leaves behind, and it is also the
  // shape the frame counts below are read in, since a socket stays in the
  // harbor's broadcast room until it says otherwise, so one broadcast is
  // still one frame on each of the five.
  //
  // The second is the pair of presses that arrive together once the count
  // is one short of carrying. Both handlers read a book that already
  // carries, so both decide the same carry and both go looking for the
  // same manifest; what the room must see is one manifest per socket,
  // which is the check that fails when the second write is not refused.
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
  const auditVoyageFour = auditSockets.map((socket) =>
    waitForEvent<{ roomId: string }>(
      socket,
      "room:started",
      (payload) => payload?.roomId === auditRoomId,
    ),
  );
  auditSockets[0].emit("room:start", { roomId: auditRoomId });
  await Promise.all(auditVoyageFour);
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

  const leftRefusals: string[] = [];
  auditSockets[4].on("audit:error", (payload: { error?: string }) => {
    if (typeof payload?.error === "string") leftRefusals.push(payload.error);
  });
  const carryTallyBase = tallyFrames.length;
  const carryRevealBase = revealFrames.length;

  // The two names the table is shown before the captain walks out.
  auditSockets[1].emit("audit:vote", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    targetUserId: auditTargetId,
  });
  await auditSettle();
  auditSockets[4].emit("audit:vote", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    targetUserId: auditTargetId,
  });
  await auditSettle();
  check(
    tallyFrames.length === carryTallyBase + auditSockets.length * 2 &&
      revealFrames.length === carryRevealBase &&
      Object.keys(tallyFrames[carryTallyBase]?.votes ?? {}).length === 1,
    "two of the five sailing is still not this voyage's majority, so the count goes out twice and nothing opens",
  );

  // The seat goes by the route the Leave button uses, and only the seat.
  const walkedOut = await call<{ ok: boolean }>(
    `/api/rooms/${auditRoomId}/leave`,
    { method: "POST", cookie: gambitFifth.cookie },
  );
  const walkedOutRow = await db.roomMember.findUnique({
    where: {
      userId_roomId: { userId: gambitFifth.id, roomId: auditRoomId },
    },
    select: { id: true },
  });
  check(
    walkedOut.status === 200 && walkedOutRow === null,
    "a captain gives up their seat in the middle of a vote, which is the row the roster is read from and not the socket",
  );

  // The ballot from the seat that is gone. It is refused, and the refusal
  // is also the moment the room learns that the count it is reading has
  // moved: the nomination the captain cast while they still held the seat
  // is out of the book, and the four still sailing are what the count is
  // divided by now.
  auditSockets[4].emit("audit:vote", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    targetUserId: auditTargetId,
  });
  await auditSettle();
  const movedTally = tallyFrames[tallyFrames.length - 1];
  const movedAwaiting = movedTally?.awaiting ?? [];
  check(
    leftRefusals.length === 1 &&
      !CARRIES_A_DASH.test(leftRefusals[0] ?? "") &&
      tallyFrames.length === carryTallyBase + auditSockets.length * 3 &&
      Object.keys(movedTally?.votes ?? {}).length === 1 &&
      !(gambitFifth.id in (movedTally?.votes ?? {})) &&
      movedTally?.votes[gambitSecond.id] === auditTargetId &&
      revealFrames.length === carryRevealBase,
    "a ballot from a captain who left the harbor is refused with a sentence rather than counted, and the count the room was reading goes out corrected with it: the name they cast is out of the book",
  );
  check(
    movedTally?.roster === auditSockets.length - 1 &&
      movedTally?.needed === auditNamesNeeded(auditSockets.length - 1) &&
      movedAwaiting.length === auditSockets.length - 2 &&
      !movedAwaiting.includes(gambitFifth.id),
    "and the numbers behind it are the four still sailing rather than the five the last count was divided by, with the captain who left not among the captains the room is waiting on",
  );

  // A standing exchange offer, posted while the leg's Parley is still
  // open. The accept checks below need a membership the post refusals
  // cannot reach, because a captain can carry an offer across the spend
  // rather than only make one inside it. Cloth is the offered side so the
  // spent window's own board check, which watches that no Wood listing
  // arrived, reads the refusal it is about rather than this setup.
  const standingOffer = { id: "" };
  auditSockets[1].on(
    "barter:update",
    (payload: { offers?: Array<{ id?: string; offerItem?: string }> }) => {
      const mine = (payload?.offers ?? []).find(
        (offer) => offer?.offerItem === "Cloth",
      );
      if (mine?.id) standingOffer.id = mine.id;
    },
  );
  auditSockets[1].emit("barter:post", {
    roomId: auditRoomId,
    offerItem: "Cloth",
    offerAmount: 1,
    requestItem: "Wood",
    requestAmount: 1,
  });
  await auditSettle();
  check(
    standingOffer.id !== "",
    "a captain can hold an offer across the spend: one is posted while the leg's parley is open and the room reads it back by id",
  );

  // Two names in, one short of the three that carry. The pair below is the
  // same tick: both presses are in the book by the time either decides the
  // carry, so both of them carry it.
  auditSockets[2].emit("audit:vote", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    targetUserId: auditTargetId,
  });
  await auditSettle();
  auditSockets[0].emit("audit:vote", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    targetUserId: auditTargetId,
  });
  auditSockets[3].emit("audit:vote", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    targetUserId: auditTargetId,
  });
  await auditSettle();
  const carriedFrames = revealFrames.slice(carryRevealBase);
  check(
    tallyFrames.length === carryTallyBase + auditSockets.length * 6 &&
      carriedFrames.length === auditSockets.length &&
      new Set(carriedFrames.map((frame) => frame.socket)).size ===
        auditSockets.length &&
      carriedFrames.every(
        (frame) =>
          frame.reveal?.roomId === auditRoomId &&
          frame.reveal?.round === AUDIT_FROM_ROUND &&
          frame.reveal?.target?.userId === auditTargetId,
      ),
    "and the two ballots that arrive together carry it exactly once: the count goes out for both and the manifest opens once on every socket, rather than once per ballot",
  );
  const carriedTallies = tallyFrames.slice(
    carryTallyBase + auditSockets.length * 3,
  );
  check(
    tallyFrames.length === carryTallyBase + auditSockets.length * 6 &&
      carriedTallies.length === auditSockets.length * 3 &&
      carriedTallies.every(
        (frame) =>
          frame.roster === auditSockets.length - 1 &&
          frame.needed === auditNamesNeeded(auditSockets.length - 1),
      ) &&
      carriedTallies.some((frame) => Object.keys(frame.votes).length === 4),
    "and every count from there on is divided by the four still sailing rather than the five the leg started with, the last of them holding the four names that carried it",
  );

  // The spend closes the boards on the tick the count carries, while the
  // room still stands in the Parley: a trade posted into that window is
  // refused as spent rather than as out of phase, which is the sentence
  // the phase gate alone would never write. The gate is auditSpentLeg
  // (src/server/realtime/audit.ts), asked beside the phase by the wires
  // that trade.
  const spentTradeRefusals: string[] = [];
  const spent = {
    board: null as { offers?: Array<{ offerItem?: string }> } | null,
  };
  auditSockets[0].on("barter:error", (payload: { error?: string }) => {
    if (typeof payload?.error === "string") {
      spentTradeRefusals.push(payload.error);
    }
  });
  auditSockets[0].on(
    "barter:update",
    (payload: { offers?: Array<{ offerItem?: string }> }) => {
      spent.board = payload;
    },
  );
  auditSockets[0].emit("barter:post", {
    roomId: auditRoomId,
    offerItem: "Wood",
    offerAmount: 1,
    requestItem: "Cloth",
    requestAmount: 1,
  });
  await auditSettle();
  auditSockets[0].emit("barter:state:request", { roomId: auditRoomId });
  await auditSettle();
  check(
    spentTradeRefusals.length === 1 &&
      (spentTradeRefusals[0] ?? "").includes("spent this leg's Parley") &&
      !CARRIES_A_DASH.test(spentTradeRefusals[0] ?? ""),
    "a trade posted into the spent parley is refused with its own sentence rather than the phase's",
  );
  check(
    (spent.board?.offers ?? []).every((offer) => offer?.offerItem !== "Wood"),
    "and nothing of it reaches the board",
  );

  // The escort desk reads the same predicate beside its own phase gate,
  // so the same window is closed there: protection posted into the spent
  // parley is refused as spent rather than as out of phase.
  const spentEscortRefusals: string[] = [];
  auditSockets[0].on("contract:error", (payload: { error?: string }) => {
    if (typeof payload?.error === "string") {
      spentEscortRefusals.push(payload.error);
    }
  });
  auditSockets[0].emit("contract:post", { roomId: auditRoomId, fee: 8 });
  await auditSettle();
  check(
    spentEscortRefusals.length === 1 &&
      (spentEscortRefusals[0] ?? "").includes("spent this leg's Parley"),
    "the escort desk refuses a post into the spent parley with the same sentence",
  );

  // And the module market, the third wire trading this leg, reads the
  // same predicate beside its own phase gate.
  const spentModuleRefusals: string[] = [];
  auditSockets[0].on("module:error", (payload: { error?: string }) => {
    if (typeof payload?.error === "string") {
      spentModuleRefusals.push(payload.error);
    }
  });
  auditSockets[0].emit("module:post", {
    roomId: auditRoomId,
    fee: 8,
    module: "salvage_crane",
  });
  await auditSettle();
  check(
    spentModuleRefusals.length === 1 &&
      (spentModuleRefusals[0] ?? "").includes("spent this leg's Parley"),
    "and the module market refuses its listing into the spent parley the same way",
  );

  // And the standing offer from the parley above, still open, is not a door
  // either: accepting it is trading this leg the same as posting one, so
  // the accept wire reads auditSpentLeg as well, and the offer stays where
  // it stands rather than settling into the very leg the room voted to
  // close.
  const spentAcceptFails: string[] = [];
  auditSockets[0].on(
    "barter:accept:fail",
    (payload: { offerId?: string; reason?: string }) => {
      if (typeof payload?.reason === "string") {
        spentAcceptFails.push(payload.reason);
      }
    },
  );
  auditSockets[0].emit("barter:accept", {
    roomId: auditRoomId,
    offerId: standingOffer.id,
  });
  await auditSettle();
  check(
    spentAcceptFails.length === 1 &&
      (spentAcceptFails[0] ?? "").includes("spent this leg's Parley") &&
      !CARRIES_A_DASH.test(spentAcceptFails[0] ?? ""),
    "a standing offer accepted into the spent parley is refused with the spend's own sentence rather than settling",
  );
  const standingBoard = {
    offers: null as Array<{ id?: string }> | null,
  };
  auditSockets[0].on(
    "barter:update",
    (payload: { offers?: Array<{ id?: string }> }) => {
      standingBoard.offers = payload?.offers ?? null;
    },
  );
  auditSockets[0].emit("barter:state:request", { roomId: auditRoomId });
  await auditSettle();
  check(
    (standingBoard.offers ?? []).some(
      (offer) => offer?.id === standingOffer.id,
    ),
    "and the offer is still standing afterwards, because the refusal is a door rather than a sweep",
  );

  // The pair of presses that arrive together, which is the pair the
  // door's own comment is about (see recordAuditVote). The fourth walk
  // above holds the pair that arrives from two sockets; this one holds
  // the pair from a single socket, which is the shape a bounce on the
  // button or a doubled client takes. The door's check and its write are
  // one uninterrupted step, so one of the two lands and the other is
  // refused, and the count the room is shown never holds the same
  // captain's name twice. A fresh voyage is what makes the book below
  // empty and the audit unspent.
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
  const auditVoyageFive = auditSockets.map((socket) =>
    waitForEvent<{ roomId: string }>(
      socket,
      "room:started",
      (payload) => payload?.roomId === auditRoomId,
    ),
  );
  auditSockets[0].emit("room:start", { roomId: auditRoomId });
  await Promise.all(auditVoyageFive);
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

  const pairRefusals: string[] = [];
  auditSockets[0].on("audit:error", (payload: { error?: string }) => {
    if (typeof payload?.error === "string") pairRefusals.push(payload.error);
  });
  const pairTallyBase = tallyFrames.length;
  const pairRevealBase = revealFrames.length;
  auditSockets[0].emit("audit:vote", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    targetUserId: auditTargetId,
  });
  auditSockets[0].emit("audit:vote", {
    roomId: auditRoomId,
    round: AUDIT_FROM_ROUND,
    targetUserId: auditTargetId,
  });
  await auditSettle();
  const pairTally = tallyFrames[tallyFrames.length - 1];
  check(
    pairRefusals.length === 1 &&
      pairRefusals[0] === "Your name is already in for this leg's audit." &&
      tallyFrames.length === pairTallyBase + auditSockets.length &&
      Object.keys(pairTally?.votes ?? {}).length === 1 &&
      pairTally?.votes[gambitHost.id] === auditTargetId &&
      revealFrames.length === pairRevealBase,
    "two ballots from one socket in the same tick are one nomination: exactly one lands in the book, the count goes out once rather than twice, and the second press is answered with the sentence that says the name is already in",
  );

  // ===== The seams a socket cannot reach =====
  // The count and the two cards are React files this run has no browser to
  // mount, so what the count renders and how the two hooks lift a press
  // are held in source the way suite 38 holds its relay: the line is read
  // off the file that draws it, and the guard is read off the hook rather
  // than trusted to a frame nobody here can deliver twice. The house rule
  // over the same files is read whole, comments included, because the
  // notes in them are the record the next reader works from.
  check(
    !carriesADash("src/components/portmasters/game/VoteTallyRows.tsx") &&
      !carriesADash("src/components/portmasters/game/AuditPanel.tsx") &&
      !carriesADash("src/components/portmasters/game/MaroonPanel.tsx") &&
      !carriesADash("src/components/portmasters/game/VoteSeatPicker.tsx"),
    "the two vote cards, the picker they draw their captain list through and the count under them read free of en dashes, em dashes and doubled hyphens, which is the house rule for every string a captain reads",
  );

  const repoRoot = join(import.meta.dirname, "..", "..", "..");
  const readSrc = (relative: string) =>
    withoutComments(readFileSync(join(repoRoot, relative), "utf8"));
  const tallyRowCode = readSrc(
    "src/components/portmasters/game/VoteTallyRows.tsx",
  );
  const seatPickerCode = readSrc(
    "src/components/portmasters/game/VoteSeatPicker.tsx",
  );
  const auditPanelCode = readSrc(
    "src/components/portmasters/game/AuditPanel.tsx",
  );
  const auditHookCode = readSrc("src/lib/use-audit.ts");
  const maroonHookCode = readSrc("src/lib/use-maroon.ts");
  const maroonPanelCode = readSrc(
    "src/components/portmasters/game/MaroonPanel.tsx",
  );

  check(
    tallyRowCode.includes("leaderShortfall(rows, census.needed)") &&
      tallyRowCode.includes("leader.short === 1") &&
      tallyRowCode.includes("has every name the vote needs") &&
      !tallyRowCode.includes("needed -"),
    "the shared count renders its leader line off leaderShortfall and works out no subtraction of its own, so the sentence a captain reads and the count the server carries the vote on cannot come apart",
  );
  check(
    tallyRowCode.includes("count has not arrived yet") &&
      tallyRowCode.includes('"carries" : "carry"') &&
      tallyRowCode.includes('"has" : "have"') &&
      tallyRowCode.includes("No name is in yet") &&
      tallyRowCode.includes("Your name is not in yet"),
    "and the block says what it does not have: a room whose census has not arrived is told that rather than shown a count of zero, a book with nobody in it is given a line of its own rather than a leader drawn from nothing, a captain whose own name is not in is told it is their turn, and the names that carry the vote and the captains who have named one are both counted and worded for their own number",
  );
  check(
    tallyRowCode.includes("namedCountLine(named, census.roster)") &&
      tallyRowCode.includes("nameCount(census.needed)") &&
      tallyRowCode.includes('"carries" : "carry"') &&
      !tallyRowCode.includes("captains ${") &&
      !tallyRowCode.includes("names are in"),
    "the count line states the count and the threshold in one sentence, the count half built by the shared builder (see namedCountLine in @/lib/voteTally) rather than worded here, so the block can never print the grammar of the old bug, a bare 1 of 5 names are in over a book that holds one, and the two votes cannot word one number two ways",
  );
  check(
    tallyRowCode.includes("nextStep(census.needed)") &&
      auditPanelCode.includes("closes this leg's trading") &&
      maroonPanelCode.includes("puts that captain ashore") &&
      !auditPanelCode.includes("puts that captain ashore") &&
      !maroonPanelCode.includes("census.needed -") &&
      !auditPanelCode.includes("census.needed -"),
    "and the sentence that says what the vote does with the names it needs belongs to the vote rather than to the block: the audit's card names the manifest, the maroon's card names the shore, and neither panel works out a shortfall of its own to say how far off the count is",
  );
  check(
    tallyRowCode.includes("captainCount(waiting.length)") &&
      tallyRowCode.includes('"has" : "have"') &&
      tallyRowCode.includes("not named anyone") &&
      tallyRowCode.includes("nameList(waiting)"),
    "and the line that says who still has to act names them and counts them, so a captain reads how many of the harbor has yet to name someone rather than a list of names with no length on it",
  );
  check(
    !auditPanelCode.includes("There is nothing else to press") &&
      !maroonPanelCode.includes("There is nothing else to press") &&
      tallyRowCode.includes("Your name is in for") &&
      auditPanelCode.includes("audit.myVote") &&
      maroonPanelCode.includes("maroon.myVote") &&
      seatPickerCode.includes('"Your name is in"') &&
      !auditPanelCode.includes('"Your name is in"') &&
      !maroonPanelCode.includes('"Your name is in"'),
    "the captain's own line belongs to the one block rather than to a paragraph in each card, the button beside it belongs to the one picker both cards draw rather than to either card, and that button says which of the two moments the captain is standing in: a name already in reads a press that tells them so",
  );
  check(
    auditPanelCode.includes("<VoteTallyRows") &&
      maroonPanelCode.includes("<VoteTallyRows") &&
      !auditPanelCode.includes("named someone") &&
      !maroonPanelCode.includes("named someone") &&
      !auditPanelCode.includes("namedCountLine") &&
      !maroonPanelCode.includes("namedCountLine"),
    "both vote cards read their count off the one block rather than printing a line of their own, and the line that block prints is the shared builder's: how many captains have named someone is worded once, under the audit and the maroon alike",
  );
  check(
    Array.from({ length: 12 }, (_, i) => i + 1).every((roster) => {
      const needed = auditNamesNeeded(roster);
      return Array.from({ length: needed + 1 }, (_, k) => k).every((k) => {
        const rows = shortfallRows(k);
        const short = leaderShortfall(rows, needed)?.short ?? needed;
        return (
          short === needed - k &&
          rows.reduce((count, row) => count + row.voters.length, 0) === k
        );
      });
    }),
    "the count the card prints and the shortfall it prints always sum to the threshold the server carries on, at every roster this game deals and every book from empty to one name over the line, and the rows hold exactly the names the book holds",
  );
  const pairMembers: PublicUser[] = Object.keys(pairTally?.votes ?? {}).map(
    (id, i) => ({ id, username: id, displayName: id, avatarHue: i }),
  );
  const pairVoters = tallyRows(pairTally?.votes ?? {}, pairMembers).flatMap(
    (row) => row.voters,
  );
  check(
    pairVoters.length === Object.keys(pairTally?.votes ?? {}).length &&
      new Set(pairVoters).size === pairVoters.length,
    "and the rows of the count hold every name in the book exactly once, so the pair of presses that arrived in one tick cannot put the same captain's name under two targets or twice under one",
  );
  check(
    auditHookCode.includes("if (data.votes?.[myUserId]) setPressed(null)") &&
      maroonHookCode.includes("if (data.votes?.[myUserId]) setPressed(null)") &&
      auditHookCode.includes("pressed !== game.currentRound") &&
      maroonHookCode.includes("pressed !== game.currentRound") &&
      auditHookCode.includes("[socket, roomId, myUserId]") &&
      maroonHookCode.includes("[socket, roomId, myUserId]"),
    "both vote hooks lift the press that is still in flight only on the frame that carries this captain's own name, so another captain's ballot cannot put the button back while the first press is on its way, and the id the guard reads is a dependency of the effect that reads it",
  );
  check(
    seatPickerCode.includes("import { seatMarks, type SeatStatus }") &&
      seatPickerCode.includes("!marked(m.id)") &&
      seatPickerCode.includes("seatMarks(statuses?.[id]).writtenOff") &&
      !auditPanelCode.includes("seatMarks") &&
      !maroonPanelCode.includes("seatMarks") &&
      auditPanelCode.includes(
        "A captain the harbor has written off cannot be audited.",
      ),
    "the list of captains a vote offers is drawn through the one predicate the server refuses on (see writtenOff in @/lib/seatMarks): a captain the harbor has written off is never offered as a name, the predicate belongs to the one picker rather than to a card, and the audit's card says so instead of leaving the short list unexplained",
  );
  check(
    auditPanelCode.includes("audit.reveal === null") &&
      auditHookCode.includes("thisReveal ? null :") &&
      auditHookCode.includes("!thisReveal &&"),
    "the audit card is gone the moment the reveal is in hand: the reader that draws it closes on the reveal and the hook stops offering a press on the same term, so a count that still holds the names the vote carried on cannot draw the card again",
  );
}
