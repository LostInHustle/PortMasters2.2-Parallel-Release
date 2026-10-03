// PortMasters 2.2 Parallel Release, smoke run: Public offers.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BOONS, MODULES } from "@/lib/game/constants/drafts";
import { MILESTONE_TRIGGERS } from "@/lib/game/constants/milestones";
import { lockInBoon, startBoonDrafting } from "@/lib/game/engine";
import { selectBoon } from "@/lib/game/engine/boons";
import {
  answerMilestone,
  queueMilestoneMoment,
} from "@/lib/game/engine/milestones";
import { milestoneChoices } from "@/lib/game/milestones";
import { healLoadedVoyage } from "@/lib/session/heal-save";
import type { BoonRecord } from "@/lib/game/types";
import { db } from "@/lib/db";
import type { BoonLedger } from "@/types/realtime/boons";
import {
  LEDGER_PHRASE,
  call,
  carriesADash,
  check,
  openAuthedSocket,
  suffix,
  voyageState,
  waitForEvent,
  withEnv,
} from "../harness";
import type { Captain, WireHistory } from "../wire";
import type { Socket } from "socket.io-client";
import type { SmokeRun } from "../run";

export async function publicOffersSuite(
  run: SmokeRun,
  inputs: { gambitHost: Captain; gambitSecond: Captain },
): Promise<void> {
  const { gambitHost, gambitSecond } = inputs;
  // [F5] The plan's sentence is one line: every offer is public, the whole
  // fleet sees the three cards a captain was shown and the one they kept.
  // Its rollback is a second line with teeth: this is the one build layer
  // feature that must not be quietly disabled, so there is no switch of
  // its own and the harbor's mode is the whole gate.
  //
  // The checks come in the halves the feature lives in. The record the two
  // pick sites write is engine state, so it is walked here in process; the
  // wire that publishes it is driven against a real harbor, because a
  // ledger that is not wired to the seat it is called from is a screen
  // that never fills; and the one seam neither half can reach, the socket
  // handler between the report and the module that stores it, is read
  // from the source the way the leg report's seam is, because it is
  // module private and a fake would prove nothing about it.

  // ========== A. The record the picks write ==========

  check(
    voyageState().boonRecord === null,
    "a voyage that has drafted nothing records nothing, which is the absence the panels draw rather than a placeholder",
  );

  // The round draft's pick, the way the standing orders and the dawn
  // fallback reach it: selectBoon is the one pick site the round's draft
  // has, so a record written there is true however the pick arrived.
  const drafting = voyageState();
  const draftLogs: string[] = [];
  startBoonDrafting(drafting, draftLogs);
  const firstTrio = drafting.boonChoices.map((card) => card.id);
  const firstKept = firstTrio[1];
  const took = selectBoon(drafting, firstKept, draftLogs);
  const roundRecord = drafting.boonRecord;
  check(
    took &&
      firstTrio.length === 3 &&
      roundRecord !== null &&
      roundRecord.round === 1 &&
      roundRecord.shown.join() === firstTrio.join() &&
      roundRecord.kept === firstKept &&
      !("moment" in roundRecord),
    "choosing from the round's draw records the leg, the three cards that were on the table and the one kept, and carries no moment because none was answered",
  );

  // A later pick replaces it rather than joining a history, through the
  // click path this time (lockInBoon is what the draft screen presses),
  // which is the plan's deferred iteration read as the shipped rule: the
  // record is the latest decision and losing the older one costs the
  // table the last thing it saw, not a mechanic.
  drafting.currentRound = 2;
  startBoonDrafting(drafting, draftLogs);
  const secondTrio = drafting.boonChoices.map((card) => card.id);
  const secondKept = secondTrio[0];
  lockInBoon(
    drafting,
    { seedBase: `smoke:offers:${suffix}`, harborId: "harbor-a" },
    secondKept,
    draftLogs,
  );
  const replaced = drafting.boonRecord;
  check(
    replaced !== null &&
      replaced.round === 2 &&
      replaced.shown.join() === secondTrio.join() &&
      replaced.kept === secondKept &&
      !("moment" in replaced),
    "and the record is this captain's latest decision rather than a history: the click path writes the same record the engine's own pick does, so whatever way a pick arrived, the fleet reads the one that actually happened",
  );

  // The moment's pick, which is the one the plan's evaluation argument is
  // practically about: passing on a boon that would advance the shared
  // objective is the thing the table argues over, and it is only
  // arguable if the record names the moment the pick answered.
  withEnv("NEXT_PUBLIC_MILESTONE_BOONS", "1", () => {
    const answering = voyageState();
    answering.crewLost = [{ name: "Old Salt", round: 1 }];
    const momentLogs: string[] = [];
    queueMilestoneMoment(answering, momentLogs, "crew_loss");
    const shownBefore = milestoneChoices(answering, "crew_loss").map(
      (card) => card.id,
    );
    const kept = shownBefore[0];
    const answered = answerMilestone(answering, kept, momentLogs);
    const momentRecord = answering.boonRecord;
    // The same reader run after the answer, which is the proof the record
    // was read before the mark moved: answering puts the kept card in the
    // held list, and a held card is out of the pool for every moment
    // after it, so a record written from a post answer table could not
    // have named this trio.
    const drawnAfter = milestoneChoices(answering, "crew_loss").map(
      (card) => card.id,
    );
    check(
      answered &&
        momentRecord !== null &&
        momentRecord.round === 1 &&
        momentRecord.shown.join() === shownBefore.join() &&
        momentRecord.kept === kept &&
        momentRecord.moment === "crew_loss" &&
        drawnAfter.every((id) => id !== kept),
      "the moment's pick lands in the same record, naming the moment it answered and the trio the captain was actually shown: the trio below is read after the mark moved, where the kept card is already out of the pool, so a record read a step too late could not have named it",
    );
  });

  const legacySave = voyageState();
  legacySave.boonRecord = undefined as unknown as BoonRecord | null;
  healLoadedVoyage(legacySave, { legacyRenownLevel: null });
  const carriedRecord: BoonRecord = {
    round: 4,
    shown: ["silk_wind", "favorable_tides", "merchant_charm"],
    kept: "favorable_tides",
  };
  const presentSave = voyageState();
  presentSave.boonRecord = carriedRecord;
  healLoadedVoyage(presentSave, { legacyRenownLevel: null });
  check(
    legacySave.boonRecord === null &&
      JSON.stringify(presentSave.boonRecord) === JSON.stringify(carriedRecord),
    "a save written before the record existed loads as a captain who has reported nothing, and a record already in a save rides the load untouched: the bare presence default has no rule behind it to enforce, because the wire is where every field is read back against the catalogue",
  );

  // ========== B. The two ends of the wire ==========

  // Read from the source rather than faked, for the reason the leg
  // report's seam is read the same way: the handler reaches its captain
  // through a listener map this suite cannot see, so a fake would prove
  // that a fake works.
  const repoRoot = join(import.meta.dirname, "..", "..", "..");
  const srcFile = (relative: string) =>
    readFileSync(join(repoRoot, relative), "utf8");
  const ledgerModule = srcFile("src/server/realtime/boon-ledger.ts");
  const wiring = srcFile("src/server/realtime/wiring/boons.ts");
  const hook = srcFile("src/lib/use-boon-ledger.ts");
  const joinHandout = srcFile("src/server/realtime/wiring/room-join.ts");
  const restartClear = srcFile("src/server/realtime/wiring/restart-voyage.ts");
  check(
    wiring.includes('"boon:report"') &&
      wiring.includes("readBoonReport") &&
      wiring.includes("recordBoonReport") &&
      hook.includes('"boon:report"') &&
      ledgerModule.includes('"boon:ledger"') &&
      joinHandout.includes("boonLedgerFor(") &&
      restartClear.includes("clearBoonLedger("),
    "the two ends of the wire name the frame each way, the joiner is handed the ledger beside the audit's reveal, and the restart clears it beside the audit's own clear, all held in the source because the socket seam between them is module private",
  );
  check(
    ledgerModule.includes("gambitSystemsOn") &&
      hook.includes("gambitSystemsOn") &&
      !ledgerModule.includes("NEXT_PUBLIC") &&
      !hook.includes("NEXT_PUBLIC"),
    "and both ends gate on the harbor's own mode rather than on a switch of the feature's own, which is the plan's rollback clause read as code: turning public offers off is turning the mode off, so there is no second lever for anyone to forget",
  );
  const parleyScreen = srcFile(
    "src/components/portmasters/game/phases/Parley.tsx",
  );
  const draftScreen = srcFile(
    "src/components/portmasters/game/phases/BoonDraft.tsx",
  );
  check(
    parleyScreen.includes("OpenBoons") && draftScreen.includes("OpenBoons"),
    "the two screens the plan's evaluation names read the ledger: the draft where the cards are drawn, and the Parley table where the table argues about what was passed on",
  );
  check(
    [
      "src/server/realtime/boon-ledger.ts",
      "src/server/realtime/wiring/boons.ts",
      "src/types/realtime/boons.ts",
      "src/lib/use-boon-ledger.ts",
      "src/components/portmasters/game/OpenBoons.tsx",
      "src/lib/game/engine/boons.ts",
      "src/lib/game/engine/milestones.ts",
      "src/lib/session/heal-save.ts",
    ].every((relative) => !carriesADash(relative)),
    "and the files the feature is written in hold the house rule too, comments included, because the directive is about the record the next maintainer reads and not only about the strings a captain meets",
  );

  // ========== C. The report, in a real harbor ==========

  const boonRoom = await call<{ room: { id: string; code: string } }>(
    "/api/rooms",
    {
      method: "POST",
      cookie: gambitHost.cookie,
      body: JSON.stringify({
        name: `Smoke boon ledger ${suffix}`,
        isPublic: false,
        mode: "ocean_gambit",
        unlock: LEDGER_PHRASE,
      }),
    },
  );
  if (boonRoom.status !== 200) {
    throw new Error("No harbor to publish a boon draft in, stopping here.");
  }
  const boonRoomId = boonRoom.body.room.id;
  // Registered with the run so the cleanup takes it down with the other
  // harbors this run opened, whether the suite passes or throws.
  run.lapRoomIds.push(boonRoomId);
  const secondSeat = await call<{ room: { id: string } }>("/api/rooms/join", {
    method: "POST",
    cookie: gambitSecond.cookie,
    body: JSON.stringify({ code: boonRoom.body.room.code }),
  });
  check(
    secondSeat.status === 200,
    "two captains can sit at the table the ledger is published to",
  );

  const ledgerSockets: Socket[] = [];
  for (const captain of [gambitHost, gambitSecond]) {
    const socket = await openAuthedSocket(captain);
    run.sockets.push(socket);
    const takenASeat = waitForEvent<WireHistory>(
      socket,
      "chat:history",
      (payload) => payload?.roomId === boonRoomId,
    );
    socket.emit("room:join", { roomId: boonRoomId });
    await takenASeat;
    ledgerSockets.push(socket);
  }
  const [hostLedgerSocket, secondLedgerSocket] = ledgerSockets;

  const boonFrames: Array<{ socket: number; ledger: BoonLedger }> = [];
  ledgerSockets.forEach((socket, index) => {
    socket.on("boon:ledger", (payload: BoonLedger) => {
      boonFrames.push({ socket: index, ledger: payload });
    });
  });
  const boonSettle = () => new Promise((resolve) => setTimeout(resolve, 400));

  // The cards the reports below put on the table, taken from the same
  // catalogue the server reads them against: three the round draft deals
  // and one module, which is the id a report must never dress up as a
  // boon.
  const roundBoons = BOONS.filter((card) => card.trigger === "boon_draft").map(
    (card) => card.id,
  );
  const trio = roundBoons.slice(0, 3);
  const kept = trio[1];
  const moduleId = MODULES[0].id;

  // The whole fleet sees the three cards and the one kept: one frame per
  // socket in the harbor, the same ledger on each, keyed by the captain
  // who picked and carrying the record and nothing else.
  secondLedgerSocket.emit("boon:report", {
    roomId: boonRoomId,
    round: 2,
    shown: trio,
    kept,
  });
  await boonSettle();
  check(
    boonFrames.length === 2 &&
      new Set(boonFrames.map((frame) => frame.socket)).size === 2 &&
      boonFrames.every(
        (frame) =>
          frame.ledger?.roomId === boonRoomId &&
          JSON.stringify(frame.ledger?.entries) ===
            JSON.stringify({
              [gambitSecond.id]: { round: 2, shown: trio, kept },
            }),
      ),
    "the whole fleet sees the three cards and the one kept: one frame per socket, the same ledger on each, keyed by the captain who picked",
  );

  // The second captain's report arrives as the whole map rather than as
  // one entry, which is what lets a client draw the board without ever
  // having received an earlier frame.
  const hostShown = roundBoons.slice(2, 5);
  hostLedgerSocket.emit("boon:report", {
    roomId: boonRoomId,
    round: 2,
    shown: hostShown,
    kept: hostShown[0],
  });
  await boonSettle();
  const bothKept = boonFrames[boonFrames.length - 1]?.ledger?.entries;
  check(
    boonFrames.length === 4 &&
      JSON.stringify(bothKept?.[gambitHost.id]) ===
        JSON.stringify({ round: 2, shown: hostShown, kept: hostShown[0] }) &&
      JSON.stringify(bothKept?.[gambitSecond.id]) ===
        JSON.stringify({ round: 2, shown: trio, kept }),
    "and the second captain's report arrives as the whole map rather than one entry, so the table reads every seat's latest keep rather than the newest line",
  );

  // A stale tab cannot rewind the table's picture of a captain who has
  // since picked, which is the one ordering rule the module judges.
  const beforeStale = boonFrames.length;
  secondLedgerSocket.emit("boon:report", {
    roomId: boonRoomId,
    round: 1,
    shown: trio,
    kept,
  });
  await boonSettle();
  check(
    boonFrames.length === beforeStale,
    "a stale tab cannot rewind the table's picture: a report from an older leg than the captain's own record is refused rather than stored",
  );

  // Every way a report can fail to make the claim, dropped whole. The
  // kept card off the table, a table wider than a draw, a card dealt
  // twice, a module where a boon belongs, a leg that is zero or
  // fractional or written as a word, and an empty table.
  const beforeMalformed = boonFrames.length;
  const malformed = [
    { roomId: boonRoomId, round: 2, shown: trio, kept: roundBoons[3] },
    { roomId: boonRoomId, round: 2, shown: [...trio, roundBoons[3]], kept },
    {
      roomId: boonRoomId,
      round: 2,
      shown: [trio[0], trio[0], trio[1]],
      kept: trio[0],
    },
    {
      roomId: boonRoomId,
      round: 2,
      shown: [trio[0], trio[1], moduleId],
      kept: trio[0],
    },
    { roomId: boonRoomId, round: 0, shown: trio, kept },
    { roomId: boonRoomId, round: 1.5, shown: trio, kept },
    { roomId: boonRoomId, round: "2", shown: trio, kept },
    { roomId: boonRoomId, round: 2, shown: [], kept },
  ];
  for (const report of malformed) {
    secondLedgerSocket.emit("boon:report", report);
  }
  await boonSettle();
  check(
    boonFrames.length === beforeMalformed,
    "and a report that cannot make the claim is dropped whole: a kept card off the table, a table of four, a card dealt twice, a module where a boon belongs, a leg that is zero or fractional or written as a word, and an empty table",
  );

  // A captain who is not seated in the harbor cannot report into it,
  // because the seat check reads the room off the socket rather than off
  // the frame.
  const bareSocket = await openAuthedSocket(gambitSecond);
  run.sockets.push(bareSocket);
  const beforeStranger = boonFrames.length;
  bareSocket.emit("boon:report", {
    roomId: boonRoomId,
    round: 2,
    shown: trio,
    kept,
  });
  await boonSettle();
  check(
    boonFrames.length === beforeStranger,
    "and a captain who is not seated in the harbor cannot report into it, because the seat check reads the room off the socket rather than off the frame",
  );

  // A pick that answered a moment rides out with the moment named, so
  // the table reads which moment the card answered rather than guessing
  // from the leg.
  const momentLabel = MILESTONE_TRIGGERS[0];
  const beforeMoment = boonFrames.length;
  hostLedgerSocket.emit("boon:report", {
    roomId: boonRoomId,
    round: 3,
    shown: hostShown,
    kept: hostShown[0],
    moment: momentLabel,
  });
  await boonSettle();
  const momentEntry =
    boonFrames[boonFrames.length - 1]?.ledger?.entries?.[gambitHost.id];
  check(
    boonFrames.length === beforeMoment + 2 &&
      JSON.stringify(momentEntry) ===
        JSON.stringify({
          round: 3,
          shown: hostShown,
          kept: hostShown[0],
          moment: momentLabel,
        }),
    "a pick that answered a moment rides out with the moment named on it, so the table reads which moment the card answered rather than guessing from the leg",
  );

  // An unreadable moment label is dropped rather than refused: it is a
  // caption for the panel and no rule reads it, so it can never cost a
  // captain the record of a real pick.
  const beforeLabeless = boonFrames.length;
  hostLedgerSocket.emit("boon:report", {
    roomId: boonRoomId,
    round: 4,
    shown: hostShown,
    kept: hostShown[0],
    moment: "losing_a_hand",
  });
  await boonSettle();
  const labelessEntry =
    boonFrames[boonFrames.length - 1]?.ledger?.entries?.[gambitHost.id];
  check(
    boonFrames.length === beforeLabeless + 2 &&
      JSON.stringify(labelessEntry) ===
        JSON.stringify({ round: 4, shown: hostShown, kept: hostShown[0] }) &&
      !("moment" in (labelessEntry ?? {})),
    "and an unreadable moment label is dropped rather than refused, so a caption can never cost a captain the record of a real pick",
  );

  // The frame's whole field list, which is a security property rather
  // than a shape preference: the same save these records came out of
  // holds this captain's Gold, their hold and their card, so the check
  // is that none of it came out with the picks.
  const finalBoonFrame = boonFrames[boonFrames.length - 1]?.ledger;
  const finalBoonBody = JSON.stringify(finalBoonFrame).toLowerCase();
  const boonForbidden = [
    "pirate",
    "broker",
    "honest",
    "role",
    "align",
    "flourish",
    "ally",
    "gold",
    "purse",
    "hold",
    "inventory",
    "money",
    "score",
    "card",
  ];
  check(
    Object.keys(finalBoonFrame ?? {})
      .sort()
      .join(",") === "entries,roomId" &&
      Object.values(finalBoonFrame?.entries ?? {}).every(
        (entry) => Object.keys(entry).sort().join(",") === "kept,round,shown",
      ),
    "the ledger's fields are the plan's allow list and nothing else: a room and a map of records, each record a leg, a trio and a kept card",
  );
  check(
    boonForbidden.every((word) => !finalBoonBody.includes(word)),
    "and nothing else rides with it: no alignment, no flourish, no Gold and no hold, word for word",
  );

  // A captain who reloads is handed the ledger as it stands, which is
  // also how the refused stale report is read back: the seat whose tab
  // tried to rewind still reads the leg its captain actually picked in.
  const ledgerReload = await openAuthedSocket(gambitSecond);
  run.sockets.push(ledgerReload);
  const handedLedger = waitForEvent<BoonLedger>(
    ledgerReload,
    "boon:ledger",
    (payload) => payload?.roomId === boonRoomId,
  );
  ledgerReload.emit("room:join", { roomId: boonRoomId });
  const reloaded = await handedLedger;
  check(
    JSON.stringify(reloaded?.entries?.[gambitSecond.id]) ===
      JSON.stringify({ round: 2, shown: trio, kept }) &&
      reloaded?.entries?.[gambitHost.id]?.round === 4,
    "a captain who reloads is handed the ledger as it stands, and the seat whose stale report was refused still reads the leg its captain actually picked in",
  );

  // ========== D. A Classic harbor ==========

  // The rollback read as code: a harbor on the founding mode runs no
  // ledger at all, so a well formed report is refused before anything is
  // stored and no frame ever reaches the room.
  const classicRoom = await call<{ room: { id: string; code: string } }>(
    "/api/rooms",
    {
      method: "POST",
      cookie: gambitHost.cookie,
      body: JSON.stringify({
        name: `Smoke classic offers ${suffix}`,
        isPublic: false,
      }),
    },
  );
  if (classicRoom.status !== 200) {
    throw new Error("No Classic harbor to read the silence in, stopping here.");
  }
  const classicRoomId = classicRoom.body.room.id;
  run.lapRoomIds.push(classicRoomId);
  const classicSeat = await call<{ room: { id: string } }>("/api/rooms/join", {
    method: "POST",
    cookie: gambitSecond.cookie,
    body: JSON.stringify({ code: classicRoom.body.room.code }),
  });
  const classicSocket = await openAuthedSocket(gambitSecond);
  run.sockets.push(classicSocket);
  const classicTaken = waitForEvent<WireHistory>(
    classicSocket,
    "chat:history",
    (payload) => payload?.roomId === classicRoomId,
  );
  classicSocket.emit("room:join", { roomId: classicRoomId });
  await classicTaken;
  const classicLedgers: BoonLedger[] = [];
  classicSocket.on("boon:ledger", (payload: BoonLedger) => {
    classicLedgers.push(payload);
  });
  classicSocket.emit("boon:report", {
    roomId: classicRoomId,
    round: 2,
    shown: trio,
    kept,
  });
  await boonSettle();
  check(
    classicSeat.status === 200 && classicLedgers.length === 0,
    "a Classic harbor runs no ledger: a well formed report is refused before anything is stored and no frame reaches the room, which is the plan's rollback read as code",
  );

  // ========== E. The restart ==========

  // A restarted voyage has drafted nothing, and the ledger of the old
  // voyage goes with it: a new fleet would otherwise start its first leg
  // reading the picks of a voyage it never sailed.
  const boonRoomRow = () =>
    db.room.findUnique({
      where: { id: boonRoomId },
      select: { currentRound: true, currentPhase: true },
    });
  hostLedgerSocket.emit("room:restart", { roomId: boonRoomId });
  let boonReopened = await boonRoomRow();
  for (
    let waited = 0;
    (boonReopened?.currentRound !== 1 ||
      boonReopened?.currentPhase !== "harbor") &&
    waited < 5000;
    waited += 250
  ) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    boonReopened = await boonRoomRow();
  }
  check(
    boonReopened?.currentRound === 1 && boonReopened?.currentPhase === "harbor",
    "restarting the voyage reopens the harbor at its first checkpoint",
  );
  const ledgerRejoin = await openAuthedSocket(gambitSecond);
  run.sockets.push(ledgerRejoin);
  const staleLedger = waitForEvent<BoonLedger>(
    ledgerRejoin,
    "boon:ledger",
    (payload) => payload?.roomId === boonRoomId,
    1200,
  );
  ledgerRejoin.emit("room:join", { roomId: boonRoomId });
  check(
    (await staleLedger) === null,
    "and the fleet's ledger of the old voyage is gone with it, because a harbor that has just reopened has drafted nothing yet",
  );
}
