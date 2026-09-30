// PortMasters 2.2 Parallel Release, smoke run: The unlock code.

import { db } from "@/lib/db";
import { checkSave } from "@/lib/game/integrity";
import { MODES, MODE_ORDER } from "@/lib/game/mode";
import {
  UNLOCKS,
  UNLOCK_EARNED_AT,
  UNLOCK_ORDER,
  normalizePhrase,
  unlockForPhrase,
  unlockLineFor,
} from "@/lib/unlock";
import {
  CARRIES_A_DASH,
  LEDGER_PHRASE,
  MANUAL,
  call,
  check,
  openAuthedSocket,
  signUp,
  suffix,
  waitForEvent,
} from "../harness";
import type { WireHistory } from "../wire";
import type { Socket } from "socket.io-client";
import type { SmokeRun } from "../run";

export async function unlockCodeSuite(run: SmokeRun): Promise<void> {
  // [H9] The harbor's one locked door, and the reason it is a phrase
  // rather than a permission: what the phrase buys a captain is a moment,
  // not a fence, and an entitlement kept per account would make the first
  // question at every table an administrative check. This section walks
  // the whole loop the plan asks for. It reads the table first, because a
  // suite that spelled the words itself would be testing its own copy of
  // them. Then it earns the phrase the way a captain does, on a tenth
  // completed voyage, reads it back out of the log that voyage left
  // behind, and opens a sealed table with it from an account that has
  // never sailed ten of anything.

  // ---- The table, read before anything is typed ----
  for (const id of UNLOCK_ORDER) {
    const unlock = UNLOCKS[id];
    check(
      normalizePhrase(unlock.phrase) === unlock.phrase &&
        unlockForPhrase(unlock.phrase) === id,
      `${unlock.label} keeps its phrase in the one form the normalizer produces, so the words in the table are words a host can type back into it`,
    );
    check(
      unlockForPhrase(`  ${unlock.phrase.toUpperCase()}.  `) === id &&
        unlockForPhrase(`${unlock.phrase} and more`) === null,
      "and a host who pastes it out of the manual in capitals with the full stop still opens the same door, while a phrase that is merely close opens nothing",
    );
    check(
      !CARRIES_A_DASH.test(unlock.label + unlock.phrase + unlock.manual),
      `and the copy on ${unlock.label} is free of every dash, which is the rule every line a captain reads is held to`,
    );
    check(
      unlock.manual.includes(unlock.phrase) &&
        MANUAL.includes(unlock.phrase) &&
        MODES[unlock.mode].sealed,
      `and the manual prints the phrase for the sealed ${MODES[unlock.mode].badge} voyage, on both the page the repo ships and the page a captain can open`,
    );
  }
  const sealedModes = MODE_ORDER.filter((mode) => MODES[mode].sealed);
  check(
    sealedModes.length === UNLOCK_ORDER.length &&
      sealedModes.every((mode) =>
        UNLOCK_ORDER.some((id) => UNLOCKS[id].mode === mode),
      ),
    "every sealed voyage has a phrase behind it and every phrase opens a sealed voyage, so neither record can be changed without the other being read",
  );
  const earnedLine = unlockLineFor(UNLOCK_EARNED_AT);
  check(
    unlockLineFor(UNLOCK_EARNED_AT - 1) === null &&
      earnedLine !== null &&
      earnedLine.includes(LEDGER_PHRASE) &&
      earnedLine.includes(String(UNLOCK_EARNED_AT)) &&
      unlockLineFor(UNLOCK_EARNED_AT + 1) === null,
    `the harbor's line is handed over on the voyage that reaches ${UNLOCK_EARNED_AT} and on no other, and it carries both the count it was granted at and the phrase itself rather than a hint at it`,
  );

  // ---- The voyage that earns it ----
  // Three seats, because the line has three cases to tell apart: the
  // captain whose tenth voyage this is, a captain on their first voyage
  // who must not be handed it, and a captain sitting at ten who forges
  // this finish, which the integrity pass refuses to bank and the line
  // has to refuse with it.
  //
  // The two counts are written rather than sailed, the way the barter
  // gate's own section writes the level it needs: nine voyages behind the
  // first captain are what makes this one the tenth, and ten behind the
  // forger are what makes the refusal the rule deciding rather than a
  // count that happened to be short.
  const unlHome = await signUp("unlhome");
  const unlNew = await signUp("unlnew");
  const unlFake = await signUp("unlfake");
  run.extraAccounts.push(unlHome, unlNew, unlFake);
  await db.captainLegacy.create({
    data: { userId: unlHome.id, voyagesCompleted: UNLOCK_EARNED_AT - 1 },
  });
  await db.captainLegacy.create({
    data: { userId: unlFake.id, voyagesCompleted: UNLOCK_EARNED_AT },
  });

  const unlLog = await call<{
    room: { id: string; code: string; unlock?: unknown };
  }>("/api/rooms", {
    method: "POST",
    cookie: unlHome.cookie,
    body: JSON.stringify({
      name: `Smoke unlock log ${suffix}`,
      isPublic: false,
    }),
  });
  check(
    unlLog.status === 200 && unlLog.body.room.unlock === null,
    "the harbor the tenth voyage is sailed in asks for no phrase at all, which is every harbor the game ever shipped with",
  );
  const unlLogId = unlLog.body.room.id;
  const unlSeats = await Promise.all(
    [unlNew, unlFake].map((captain) =>
      call<{ room: { id: string } }>("/api/rooms/join", {
        method: "POST",
        cookie: captain.cookie,
        body: JSON.stringify({ code: unlLog.body.room.code }),
      }),
    ),
  );
  check(
    unlSeats.every((seat) => seat.status === 200),
    "and three captains take it, one on a first voyage and one already at ten",
  );

  const unlCrew = [unlHome, unlNew, unlFake];
  const unlSockets: Socket[] = [];
  for (const captain of unlCrew) {
    const socket = await openAuthedSocket(captain);
    run.sockets.push(socket);
    const seatedHere = waitForEvent<WireHistory>(
      socket,
      "chat:history",
      (payload) => payload?.roomId === unlLogId,
    );
    socket.emit("room:join", { roomId: unlLogId });
    await seatedHere;
    unlSockets.push(socket);
  }
  unlSockets[0].emit("room:start", { roomId: unlLogId });
  await new Promise((resolve) => setTimeout(resolve, 800));

  // The forger's finish is one no voyage could have paid, proved here
  // rather than assumed, the way the reveal's own fixture proves its own:
  // the number below is this fixture's, and it is orders of magnitude
  // over any ceiling the integrity pass derives from live game data.
  check(
    checkSave({ money: 99_999_999 }, 8).severity === "impossible",
    "the finish the forger reports in this harbor is one no harbor could have paid",
  );
  const unlReports = [
    { gold: 140, reputation: 34, bankrupt: false },
    { gold: 90, reputation: 18, bankrupt: false },
    { gold: 99_999_999, reputation: 40, bankrupt: false },
  ];
  unlCrew.forEach((_captain, index) =>
    unlSockets[index].emit("game:status", {
      roomId: unlLogId,
      round: 8,
      phase: "endgame",
      phaseLabel: "Voyage Complete",
      shipLevel: 1,
      gameOver: true,
      marooned: false,
      ...unlReports[index],
    }),
  );

  // The log is written behind the last report rather than inside it, so
  // the rows are waited for rather than slept past, and the wait is for
  // all three: reading the first one to land and counting the others
  // would be asserting on a race.
  const readUnlLog = () =>
    db.voyageChronicle.findMany({
      where: { roomId: unlLogId },
      select: { userId: true, body: true },
    });
  let unlRows = await readUnlLog();
  for (
    let waited = 0;
    unlRows.length < unlCrew.length && waited < 10000;
    waited += 250
  ) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    unlRows = await readUnlLog();
  }
  const unlRowFor = (userId: string) =>
    unlRows.find((row) => row.userId === userId);
  const unlHomeRow = unlRowFor(unlHome.id);
  const unlNewRow = unlRowFor(unlNew.id);
  const unlFakeRow = unlRowFor(unlFake.id);
  const unlHomeLegacy = await db.captainLegacy.findUnique({
    where: { userId: unlHome.id },
    select: { voyagesCompleted: true },
  });
  const unlNewLegacy = await db.captainLegacy.findUnique({
    where: { userId: unlNew.id },
    select: { voyagesCompleted: true },
  });
  const unlFakeLegacy = await db.captainLegacy.findUnique({
    where: { userId: unlFake.id },
    select: { voyagesCompleted: true },
  });
  check(
    unlHomeLegacy?.voyagesCompleted === UNLOCK_EARNED_AT &&
      earnedLine !== null &&
      (unlHomeRow?.body ?? "").includes(earnedLine),
    "the tenth completed voyage counts as one and the log it leaves behind carries the harbor's line, so a captain is handed the phrase by the game they played",
  );
  check(
    unlNewRow !== undefined &&
      !unlNewRow.body.includes(LEDGER_PHRASE) &&
      unlNewLegacy?.voyagesCompleted === 1,
    "while a captain on their first voyage reads nothing about any door, because the line belongs to the voyage that crossed the count rather than to the log at large",
  );
  check(
    unlFakeRow !== undefined && !unlFakeRow.body.includes(LEDGER_PHRASE),
    "and a forged finish is handed nothing, even from a count that already stands at ten, since the account the integrity pass writes off keeps no memory of the voyage and the line is part of it",
  );
  check(
    unlFakeLegacy?.voyagesCompleted === UNLOCK_EARNED_AT,
    "which the count behind it says first: a forged voyage leaves the count exactly where it found it",
  );

  // ---- The door ----
  const unlAsk = (cookie: string, body: Record<string, unknown>) =>
    call<{
      room?: {
        id: string;
        code: string;
        mode?: string;
        unlock?: string | null;
      };
      error?: string;
    }>("/api/rooms", {
      method: "POST",
      cookie,
      body: JSON.stringify({
        name: `Smoke unlock door ${suffix}`,
        isPublic: false,
        ...body,
      }),
    });
  const unlSealed = await unlAsk(unlNew.cookie, { mode: "ocean_gambit" });
  check(
    unlSealed.status === 403 && typeof unlSealed.body?.error === "string",
    "a sealed voyage refuses a host who brought no phrase, with an answer rather than a room",
  );
  const unlMistyped = await unlAsk(unlNew.cookie, {
    mode: "ocean_gambit",
    unlock: "the first ledger",
  });
  check(
    unlMistyped.status === 403 &&
      unlMistyped.body.error !== unlSealed.body.error,
    "and a host whose words were wrong is told something else, so a mistyped phrase is never reported as a missing one",
  );
  const unlOtherDoor = await unlAsk(unlNew.cookie, {
    mode: "classic",
    unlock: LEDGER_PHRASE,
  });
  check(
    unlOtherDoor.status === 403,
    "while a phrase that opens another voyage is refused rather than quietly dropped, since a host who typed it is owed the door it opens rather than the one they clicked",
  );
  const unlOpened = await unlAsk(unlNew.cookie, {
    mode: "ocean_gambit",
    // The messy paste, because that is the honest way a host who read the
    // phrase out of a guide types it, and the route's own normalizer is
    // the only reason it opens anything.
    unlock: `  ${LEDGER_PHRASE.toUpperCase()}.  `,
  });
  check(
    unlOpened.status === 200 &&
      unlOpened.body.room?.mode === "ocean_gambit" &&
      unlOpened.body.room?.unlock === "second_ledger",
    "and the phrase opens the table for a captain with one voyage to their name, because the harbor reads the words rather than the account that typed them",
  );
  if (unlOpened.status !== 200 || !unlOpened.body.room) {
    throw new Error("No sealed harbor to test with, stopping here.");
  }
  const unlGate = unlOpened.body.room;
  const unlTaken = await call<{ room: { unlock?: string | null } }>(
    "/api/rooms/join",
    {
      method: "POST",
      cookie: unlHome.cookie,
      body: JSON.stringify({ code: unlGate.code }),
    },
  );
  check(
    unlTaken.status === 200 && unlTaken.body.room.unlock === "second_ledger",
    "and every captain who walks in afterwards is told which door the room was opened through, because the door belongs to the room rather than to whoever opened it",
  );

  // The voyage runs and then restarts, which is the one handler that
  // rewrites the room's voyage settings. The door is not one of them, so a
  // harbor that reopens is still the harbor it was opened as, which is
  // what the lobby card a captain reads it off promises either way.
  const unlGateSocket = await openAuthedSocket(unlNew);
  run.sockets.push(unlGateSocket);
  const unlGateSeated = waitForEvent<WireHistory>(
    unlGateSocket,
    "chat:history",
    (payload) => payload?.roomId === unlGate.id,
  );
  unlGateSocket.emit("room:join", { roomId: unlGate.id });
  await unlGateSeated;
  unlGateSocket.emit("room:start", { roomId: unlGate.id });
  await new Promise((resolve) => setTimeout(resolve, 800));
  const unlRestartFrame = waitForEvent<{ roomId?: string }>(
    unlGateSocket,
    "room:restarted",
    (payload) => payload?.roomId === unlGate.id,
    4000,
  );
  unlGateSocket.emit("room:restart", { roomId: unlGate.id });
  const unlReopened = await unlRestartFrame;
  const unlAfter = await call<{
    room: { mode?: string; unlock?: string | null };
  }>(`/api/rooms/${unlGate.id}`, { cookie: unlNew.cookie });
  check(
    unlReopened !== null &&
      unlAfter.body.room?.mode === "ocean_gambit" &&
      unlAfter.body.room?.unlock === "second_ledger",
    "and a harbor that has restarted its voyage is still the sealed one it was chartered as, phrase and all",
  );

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
}
