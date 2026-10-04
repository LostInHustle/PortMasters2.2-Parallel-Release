// PortMasters 2.2 Parallel Release, smoke run: the fleet's own outcome.
//
// The field report this article is for: the reveal put "Did not win" under
// a captain whose personal goal the voyage had cleared, while the ledger
// painted beside them both said the commission was Filled. The mechanism
// was one fact read in the wrong place. The met flag each row carried was
// decided from what that captain's own client had written down, and a
// client that missed the final leg, reloaded through it or joined late
// ends holding a record that stops short of the fill. The row then said
// unmet while the ledger under it, which merges every captain's record by
// max per good per leg, painted Filled. Read from the rule's own contract
// (see victory.ts), the flag was never a per captain fact: the card
// promises the fleet's goal, so the caller computes the answer once for
// the voyage and writes the same one to every row.
//
// The answer is readFleetMet (see conclusion/finishers.ts): the merge the
// ledger already draws, decided once and handed to every verdict and every
// row. This article holds down the arithmetic under it and both branches
// live:
//
//   - a voyage where exactly one client kept the leg that filled the
//     commission. Every row reads met, the captain whose own record stops
//     short wins the card the fix restored, and the frame, the rows and a
//     merge recomputed here by hand all tell one story;
//   - a voyage where no client kept a record at all. Every row reads
//     unmet, and the Pirate card pays for the first time in a concluded
//     voyage: a pirate who ends solvent and standing wins the failure,
//     which is the branch no earlier article's fixture could reach because
//     every one of them filled the commission.

import { db } from "@/lib/db";
import {
  drawObjective,
  fleetTrace,
  objectiveProgress,
  objectiveSeed,
  type Objective,
} from "@/lib/game/objectives";
import { flourishDeck } from "@/lib/game/gambit";
import { evaluateVictory, flourishMet, readEnding } from "@/lib/game/victory";
import type { ObjectiveTraceEntry } from "@/lib/game/types";
import type { RevealedCaptain, VoyageReveal } from "@/types/realtime/voyage";
import {
  LEDGER_PHRASE,
  call,
  check,
  openAuthedSocket,
  signUp,
  suffix,
  waitForEvent,
} from "../harness";
import type { Captain } from "../wire";
import type { Socket } from "socket.io-client";
import type { SmokeRun } from "../run";

type Seated = { captain: Captain; socket: Socket };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A save write, the way every article that hands a captain a fixture
// writes one: the real route, so what the conclusion reads is what the
// harbor stored rather than what this file remembers writing.
const writeSave = (
  cookie: string,
  roomId: string,
  data: Record<string, unknown>,
) =>
  call<{ ok: boolean }>("/api/game/state", {
    method: "PUT",
    cookie,
    body: JSON.stringify({ roomId, data }),
  });

// The chronicle rows the conclusion writes behind the last report, waited
// for rather than slept past, for the reason the fleet commission's article
// states: a fixed pause long enough on this machine is the kind of check
// that fails the first time it runs somewhere slower.
async function chronicleRows(roomId: string, count: number) {
  const read = () =>
    db.voyageChronicle.findMany({
      where: { roomId },
      select: {
        userId: true,
        won: true,
        objectiveMet: true,
        objectiveId: true,
        objectiveTrace: true,
      },
    });
  let rows = await read();
  for (let waited = 0; rows.length < count && waited < 10000; waited += 250) {
    await wait(250);
    rows = await read();
  }
  return rows;
}

// Two captains, a private Gambit harbor, and the voyage under way: what
// every live half below starts from. The commission is drawn here exactly
// as the server draws it at conclusion, from the room's own id, the epoch
// it sails under and the seat count pinned at departure, which is what
// makes the rows' objectiveId a check rather than a hope.
async function openVoyage(
  run: SmokeRun,
  sailPlan: string,
  labels: [string, string],
): Promise<{ crew: [Seated, Seated]; roomId: string; objective: Objective }> {
  const first = await signUp(labels[0]);
  const second = await signUp(labels[1]);
  run.extraAccounts.push(first, second);
  const opened = await call<{ room: { id: string; code: string } }>(
    "/api/rooms",
    {
      method: "POST",
      cookie: first.cookie,
      body: JSON.stringify({
        name: `Smoke fleet outcome ${suffix}`,
        isPublic: false,
        mode: "ocean_gambit",
        unlock: LEDGER_PHRASE,
      }),
    },
  );
  if (opened.status !== 200) {
    throw new Error(`No Gambit harbor to sail ${sailPlan} in, stopping here.`);
  }
  const roomId = opened.body.room.id;
  run.lapRoomIds.push(roomId);
  const joined = await call("/api/rooms/join", {
    method: "POST",
    cookie: second.cookie,
    body: JSON.stringify({ code: opened.body.room.code }),
  });
  check(
    joined.status === 200,
    `the mate joins the harbor ${sailPlan} is sailed in`,
  );
  const crew: Seated[] = [];
  for (const captain of [first, second]) {
    const socket = await openAuthedSocket(captain);
    run.sockets.push(socket);
    const aboard = waitForEvent(socket, "chat:history", undefined, 15000);
    socket.emit("room:join", { roomId });
    if (!(await aboard)) {
      throw new Error("A captain never boarded the harbor this article opens.");
    }
    crew.push({ captain, socket });
  }
  const departures = crew.map((seat) =>
    waitForEvent(seat.socket, "room:started", undefined, 15000),
  );
  crew[0].socket.emit("room:start", { roomId });
  await Promise.all(departures);
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { voyageEpoch: true, voyageSeats: true },
  });
  const seats = room?.voyageSeats ?? 0;
  const objective = drawObjective(
    objectiveSeed(roomId, room?.voyageEpoch ?? 0, seats),
    seats,
  );
  return { crew: crew as [Seated, Seated], roomId, objective };
}

// One captain's finish report, the frame the conclusion waits on.
const finish = (
  seat: Seated,
  roomId: string,
  gold: number,
  reputation: number,
) =>
  seat.socket.emit("game:status", {
    roomId,
    round: 6,
    phase: "endgame",
    phaseLabel: "Voyage Complete",
    gold,
    reputation,
    shipLevel: 2,
    gameOver: true,
  });

export async function theFleetsOwnOutcomeSuite(run: SmokeRun): Promise<void> {
  // ---- The arithmetic, against a commission of this article's own ----
  // The flag the fix decides is the last leg of this merge, so the
  // merge's four load bearing properties are held down first, off a
  // commission drawn for them and no harbor at all.
  const commission = drawObjective("the-fleets-own-outcome");
  const fullBoard: Record<string, number> = {};
  const oneShort: Record<string, number> = {};
  for (const r of commission.resources) {
    fullBoard[r.type] = r.required;
    oneShort[r.type] = Math.max(0, r.required - 1);
  }
  const leg = (
    round: number,
    delivered: Record<string, number>,
  ): ObjectiveTraceEntry => ({
    round,
    at: 1_756_000_000_000 + round,
    delivered,
  });
  const staleRecord = [leg(5, oneShort)];
  const filledRecord = [leg(6, fullBoard)];
  const lastMet = (traces: ObjectiveTraceEntry[][]): boolean => {
    const merged = fleetTrace(traces);
    return objectiveProgress(
      commission,
      merged[merged.length - 1]?.delivered ?? {},
    ).met;
  };
  check(
    lastMet([staleRecord, filledRecord]),
    "one client's record of the fill fills the merge even when every other record of the voyage stops a leg short",
  );
  check(
    !lastMet([staleRecord]),
    "and the same record reads short when it is the only one there is, which is the shape the per captain reading was deciding on",
  );
  check(
    !lastMet([]),
    "while a voyage nobody kept a record of is an empty merge and an unmet commission rather than a default either way",
  );
  const sameLeg = fleetTrace([staleRecord, [leg(5, fullBoard)]]);
  check(
    sameLeg.length === 1 &&
      objectiveProgress(commission, sameLeg[0]?.delivered ?? {}).met,
    "and two records of one leg are one leg carrying the larger of the two, so a client that reloaded cannot walk the fleet's record backwards",
  );
  check(
    JSON.stringify(fleetTrace([staleRecord, filledRecord])) ===
      JSON.stringify(fleetTrace([filledRecord, staleRecord])),
    "and the merge answers the same whichever order the records arrive in, because the reveal is read after the last report rather than in arrival order",
  );

  // ---- A record that stops short, beside one that filled ----
  // The field report's own shape: one client missed the final leg and the
  // other kept it. The first captain's own goal is a purse or standing
  // goal their finish clears outright, so the only thing between them and
  // their card is which record the flag is read from, which is exactly
  // the verdict the report lost.
  const stale = await openVoyage(run, "the stale record's voyage", [
    "missed",
    "kept",
  ]);
  const deck = flourishDeck(stale.objective.id);
  const carried =
    deck.find((f) => f.kind === "purse") ??
    deck.find((f) => f.kind === "reputation");
  const held = deck.find((f) => f.kind === "stock");
  if (!carried || !held) {
    throw new Error(
      `the deck for ${stale.objective.id} dealt no pair this article can sail on, stopping here.`,
    );
  }
  const missedLeg = stale.crew[0];
  const keptLeg = stale.crew[1];

  // The two records the voyage leaves. The short one stops one short of
  // every good, so it can never be the record a fill is read from, and
  // both properties are checked rather than assumed: a commission with a
  // good of one owed would otherwise collapse the article's premise.
  const full: Record<string, number> = {};
  const short: Record<string, number> = {};
  for (const r of stale.objective.resources) {
    full[r.type] = r.required;
    short[r.type] = Math.max(0, r.required - 1);
  }
  const missedSave = {
    objectiveDelivered: short,
    objectiveTrace: [{ round: 5, at: Date.now(), delivered: short }],
  };
  const keptSave = {
    objectiveDelivered: full,
    objectiveTrace: [{ round: 6, at: Date.now(), delivered: full }],
    inventory: { [held.good ?? ""]: held.amount },
  };
  const missedGold = carried.kind === "purse" ? carried.amount + 10 : 446;
  const missedRep = carried.kind === "reputation" ? carried.amount + 10 : 1531;
  const keptGold = 550;
  const keptRep = 1224;

  check(
    objectiveProgress(stale.objective, full).met &&
      !objectiveProgress(stale.objective, short).met &&
      !objectiveProgress(
        stale.objective,
        missedSave.objectiveTrace[0].delivered,
      ).met,
    "the records this voyage writes are a fill and a record that stops short of one on its own",
  );

  // The hand and the saves, written the way the harbor would have them:
  // the two cards off the drawn deck, and each captain's own record of
  // the commission, one of them ending a leg short of the other.
  await db.voyageRole.upsert({
    where: {
      roomId_userId: { roomId: stale.roomId, userId: missedLeg.captain.id },
    },
    create: {
      roomId: stale.roomId,
      userId: missedLeg.captain.id,
      role: "honest",
      flourish: carried.id,
    },
    update: { role: "honest", flourish: carried.id },
  });
  await db.voyageRole.upsert({
    where: {
      roomId_userId: { roomId: stale.roomId, userId: keptLeg.captain.id },
    },
    create: {
      roomId: stale.roomId,
      userId: keptLeg.captain.id,
      role: "honest",
      flourish: held.id,
    },
    update: { role: "honest", flourish: held.id },
  });
  const wroteMissed = await writeSave(
    missedLeg.captain.cookie,
    stale.roomId,
    missedSave,
  );
  const wroteKept = await writeSave(
    keptLeg.captain.cookie,
    stale.roomId,
    keptSave,
  );
  check(
    wroteMissed.status === 200 && wroteKept.status === 200,
    "and both records land in the harbor's saves rather than only in this article",
  );

  const revealed = waitForEvent<VoyageReveal>(
    missedLeg.socket,
    "voyage:reveal",
    (p) => p?.roomId === stale.roomId,
    30000,
  );
  finish(missedLeg, stale.roomId, missedGold, missedRep);
  await wait(300);
  finish(keptLeg, stale.roomId, keptGold, keptRep);
  const frame = await revealed;
  check(frame !== null, "the voyage concludes and the reveal is announced");

  const rows = await chronicleRows(stale.roomId, 2);
  check(
    rows.length === 2,
    "and writes one chronicle row per captain behind it",
  );
  check(
    rows.every((row) => row.objectiveId === stale.objective.id),
    "every row naming the commission the voyage was actually sailed on",
  );
  check(
    rows.every((row) => row.objectiveMet === true),
    "and every row reading the fill, because the fleet's outcome is one answer rather than each client's own view of it",
  );
  const missedRow = rows.find((row) => row.userId === missedLeg.captain.id);
  const keptRow = rows.find((row) => row.userId === keptLeg.captain.id);
  check(
    missedRow?.won === true,
    "the captain whose client missed the last leg wins the card they were dealt, which is the verdict the field report lost",
  );
  check(
    keptRow?.won === true,
    "and the captain whose record carried the fill wins beside them",
  );
  // The row keeps the observation its own client made: the merge belongs
  // to the verdict, and a record rewritten by it would be the ship's log
  // claiming a leg its keeper never saw.
  check(
    JSON.parse(missedRow?.objectiveTrace ?? "[]").length === 1 &&
      JSON.parse(missedRow?.objectiveTrace ?? "[]")[0]?.round === 5,
    "while the row still carries the short record as the client wrote it, because the merge is the verdict's and not the record's",
  );

  // The frame, and the independent recomputation both rows are held to.
  const frameCaptains: RevealedCaptain[] = frame?.captains ?? [];
  const missedReveal = frameCaptains.find(
    (c) => c.userId === missedLeg.captain.id,
  );
  const keptReveal = frameCaptains.find((c) => c.userId === keptLeg.captain.id);
  check(
    missedReveal?.won === missedRow?.won && keptReveal?.won === keptRow?.won,
    "the reveal frame and the rows agree about both verdicts, because they were written from the one answer",
  );
  const mergedByHand: Record<string, number> = {};
  for (const entry of [
    ...missedSave.objectiveTrace,
    ...keptSave.objectiveTrace,
  ]) {
    for (const [good, count] of Object.entries(entry.delivered)) {
      mergedByHand[good] = Math.max(mergedByHand[good] ?? 0, count);
    }
  }
  const metByHand = stale.objective.resources.every(
    (r) => (mergedByHand[r.type] ?? 0) >= r.required,
  );
  check(
    metByHand,
    "and a merge recomputed here by hand from the two records reads the fill the conclusion read",
  );
  const ledger = frame?.fleetTrace ?? [];
  check(
    ledger.length === 2,
    "the ledger carries the voyage leg by leg rather than only its ending, one entry per leg the two records between them saw",
  );
  check(
    objectiveProgress(
      stale.objective,
      ledger[ledger.length - 1]?.delivered ?? {},
    ).met,
    "with the last leg the frame carries painting the commission filled under both verdicts",
  );
  const missedEnding = readEnding(missedSave, {
    gold: missedGold,
    reputation: missedRep,
    bankrupt: false,
  });
  const keptEnding = readEnding(keptSave, {
    gold: keptGold,
    reputation: keptRep,
    bankrupt: false,
  });
  check(
    missedRow?.won ===
      evaluateVictory({
        role: "honest",
        objective: stale.objective,
        objectiveMet: metByHand,
        flourish: carried,
        ending: missedEnding,
      }) &&
      keptRow?.won ===
        evaluateVictory({
          role: "honest",
          objective: stale.objective,
          objectiveMet: metByHand,
          flourish: held,
          ending: keptEnding,
        }),
    "and both verdicts are the rule's own answer, read from the hand merge rather than from either client's view",
  );

  // ---- A voyage nobody kept a record of ----
  // The other branch, which needs a voyage of its own: no client recorded
  // anything, so the merge is empty and every row reads unmet. The Pirate
  // card pays on this branch and only this one, and no concluded voyage in
  // this run has ever reached it, because every other article's fixture
  // fills the commission.
  const empty = await openVoyage(run, "the empty record's voyage", [
    "pirate",
    "honest",
  ]);
  const emptyDeck = flourishDeck(empty.objective.id);
  const holdGoal = emptyDeck.find((f) => f.kind === "stock");
  if (!holdGoal) {
    throw new Error(
      `the deck for ${empty.objective.id} dealt no hold goal this article can sail on, stopping here.`,
    );
  }
  const pirate = empty.crew[0];
  const honest = empty.crew[1];
  const pirateSave = { objectiveDelivered: {}, objectiveTrace: [] };
  const honestSave = {
    objectiveDelivered: {},
    objectiveTrace: [],
    inventory: { [holdGoal.good ?? ""]: holdGoal.amount },
  };
  const pirateGold = 120;
  const pirateRep = 60;
  const honestGold = 300;
  const honestRep = 400;

  await db.voyageRole.upsert({
    where: {
      roomId_userId: { roomId: empty.roomId, userId: pirate.captain.id },
    },
    create: {
      roomId: empty.roomId,
      userId: pirate.captain.id,
      role: "pirate",
      flourish: null,
    },
    update: { role: "pirate", flourish: null },
  });
  await db.voyageRole.upsert({
    where: {
      roomId_userId: { roomId: empty.roomId, userId: honest.captain.id },
    },
    create: {
      roomId: empty.roomId,
      userId: honest.captain.id,
      role: "honest",
      flourish: holdGoal.id,
    },
    update: { role: "honest", flourish: holdGoal.id },
  });
  const wrotePirate = await writeSave(
    pirate.captain.cookie,
    empty.roomId,
    pirateSave,
  );
  const wroteHonest = await writeSave(
    honest.captain.cookie,
    empty.roomId,
    honestSave,
  );
  check(
    wrotePirate.status === 200 && wroteHonest.status === 200,
    "the empty records land in the harbor's saves",
  );

  const emptyRevealed = waitForEvent<VoyageReveal>(
    pirate.socket,
    "voyage:reveal",
    (p) => p?.roomId === empty.roomId,
    30000,
  );
  finish(pirate, empty.roomId, pirateGold, pirateRep);
  await wait(300);
  finish(honest, empty.roomId, honestGold, honestRep);
  const emptyFrame = await emptyRevealed;
  check(
    emptyFrame !== null,
    "the second voyage concludes and its reveal is announced",
  );

  const emptyRows = await chronicleRows(empty.roomId, 2);
  check(emptyRows.length === 2, "with one chronicle row per captain");
  check(
    emptyRows.every((row) => row.objectiveMet === false),
    "and every row reading the commission unmet, because no client recorded anything to fill it with",
  );
  const pirateRow = emptyRows.find((row) => row.userId === pirate.captain.id);
  const honestRow = emptyRows.find((row) => row.userId === honest.captain.id);
  check(
    pirateRow?.won === true && pirateRow?.objectiveMet === false,
    "a Pirate who ends solvent and standing wins the voyage the fleet did not fill, which is the branch no concluded voyage in this run could reach before",
  );
  const honestEnding = readEnding(honestSave, {
    gold: honestGold,
    reputation: honestRep,
    bankrupt: false,
  });
  check(
    flourishMet(holdGoal, honestEnding, empty.objective) === true,
    "while the honest captain beside them ends holding the goods their own card asked for",
  );
  check(
    honestRow?.won === false,
    "and wins nothing from it, because the honest card promises the fleet's commission and the fleet fell short",
  );
  const emptyCaptains = emptyFrame?.captains ?? [];
  check(
    pirateRow?.won ===
      emptyCaptains.find((c) => c.userId === pirate.captain.id)?.won &&
      honestRow?.won ===
        emptyCaptains.find((c) => c.userId === honest.captain.id)?.won,
    "with the reveal frame agreeing with both rows again",
  );
  check(
    (emptyFrame?.fleetTrace ?? []).length === 0,
    "and the ledger empty under them, because a voyage nobody kept a record of has no legs to draw",
  );
  const pirateEnding = readEnding(pirateSave, {
    gold: pirateGold,
    reputation: pirateRep,
    bankrupt: false,
  });
  check(
    pirateRow?.won ===
      evaluateVictory({
        role: "pirate",
        objective: empty.objective,
        objectiveMet: false,
        flourish: null,
        ending: pirateEnding,
      }) &&
      honestRow?.won ===
        evaluateVictory({
          role: "honest",
          objective: empty.objective,
          objectiveMet: false,
          flourish: holdGoal,
          ending: honestEnding,
        }),
    "and both verdicts are the rule's own answer on the empty record, read from the commission neither client filled",
  );
}
