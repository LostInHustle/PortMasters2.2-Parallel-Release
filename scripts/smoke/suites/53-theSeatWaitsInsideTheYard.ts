// PortMasters 2.2 Parallel Release, smoke run: the seat that waits inside
// the yard.
//
// The field report this article is for: upgrading the ship or changing
// modules incorrectly progresses the voyage to the next phase. The
// mechanism was one missing fold in one roster. A captain inside the
// shipyard's draft or swap screens reports the screen's own phase, and the
// waiting roster asked the lap whether that phase was gated without first
// folding it onto the seat the screen stands inside. A name the lap does
// not list answers no, so the draft captain was dropped from the ready
// check; the moment every remaining captain had voted, the room announced
// the departure, and the draft captain's own client, which folds the seat
// the other way in every guard it has (checkpointRank and the advance
// guard both read seatOf), followed the announcement and autoCommit
// cancelled the draft and left Dusk under their hands. Read from the other
// seat the same frame is the upgrade half of the report: a captain readied
// and the room moved while the mate was still changing modules.
//
// The answer is the fold the lap already states. A captain in the draft or
// the swap is standing at Dusk (PHASE_FACES places both screens inside
// it), so the roster waits on them exactly as it waits on a captain
// standing at the seat itself. The two screens draw the room's bar, so
// the captain being waited on can see the wait and its countdown, and the
// clock still moves a table whose captain never comes back (the fire
// counts the active roster, not this one).
//
// This article holds down both directions, engine first and then over a
// live harbor: the fold reads the way the lap says in both modes, the
// pier and both terminals stay excluded, a ready set minus the draft
// captain moves nothing and keeps the bar whole, an act at the seat
// itself moves nothing, and both votes at the seat still move the room.

import { isGatedPhase } from "@/lib/game/checkpoint";
import { seatOf } from "@/lib/game/phases";
import type { GameMode } from "@/lib/game/mode";
import type { Phase } from "@/lib/game/types";
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

// Both laps, because the fold is the registry's and both modes read the
// same registry, and the seats are the same six.
const LAPS: GameMode[] = ["ocean_gambit", "classic"];
const GAMBIT: GameMode = "ocean_gambit";

// The two screens the report was made of, named rather than derived,
// because they are the only two phases in the union that are a screen
// inside another seat.
const YARD_SCREENS: Phase[] = ["module_draft", "module_swap"];

type Seat = { round: number; phase: Phase };
type ReadyFrame = {
  roomId?: string;
  round?: number;
  phase?: Phase;
  readyUserIds?: string[];
  requiredUserIds?: string[];
};

export async function theSeatWaitsInsideTheYardSuite(
  run: SmokeRun,
): Promise<void> {
  // The fold itself, read off the registry both sides read: the screens
  // are not gates of their own, and the seat they fold to is.
  for (const mode of LAPS) {
    for (const screen of YARD_SCREENS) {
      check(
        seatOf(screen) === "dusk",
        `${mode} places ${screen} inside Dusk, which is the seat the ready check folds it to`,
      );
      check(
        isGatedPhase(mode, screen) === false &&
          isGatedPhase(mode, seatOf(screen)) === true,
        `${mode} waits on the seat rather than the screen's own name: ${screen} is not a gate, and the seat it folds to is`,
      );
    }
    check(
      isGatedPhase(mode, seatOf("harbor")) === false &&
        isGatedPhase(mode, seatOf("endgame")) === false &&
        isGatedPhase(mode, seatOf("bankruptcy")) === false,
      `${mode} still excludes the pier and both terminals, which fold to themselves`,
    );
  }

  // The live half. Two captains, a private Gambit harbor, and raw sockets
  // on purpose: this article measures the room's own frames.
  const tag = "yard";
  const first = await signUp(`${tag}a`);
  const second = await signUp(`${tag}b`);
  run.extraAccounts.push(first, second);
  const opened = await call<{ room: { id: string; code: string } }>(
    "/api/rooms",
    {
      method: "POST",
      cookie: first.cookie,
      body: JSON.stringify({
        name: `Smoke yard seat ${suffix}`,
        isPublic: false,
        mode: GAMBIT,
        unlock: LEDGER_PHRASE,
      }),
    },
  );
  if (opened.status !== 200) {
    throw new Error("No Gambit harbor to hold a draft in, stopping here.");
  }
  const room = opened.body.room.id;
  run.lapRoomIds.push(room);
  const joined = await call("/api/rooms/join", {
    method: "POST",
    cookie: second.cookie,
    body: JSON.stringify({ code: opened.body.room.code }),
  });
  check(
    joined.status === 200,
    "the second captain joins the harbor this article holds a draft in",
  );

  const heard: Array<{ advances: Seat[]; standing: ReadyFrame | null }> = [];
  const crew: Array<{ captain: Captain; socket: Socket }> = [];
  for (const captain of [first, second]) {
    const socket = await openAuthedSocket(captain);
    run.sockets.push(socket);
    const mine = {
      advances: [] as Seat[],
      standing: null as ReadyFrame | null,
    };
    heard.push(mine);
    socket.on("phase:advance", (payload: ReadyFrame) => {
      if (payload?.roomId !== room) return;
      mine.advances.push({
        round: payload.round ?? 0,
        phase: (payload.phase ?? "harbor") as Phase,
      });
    });
    socket.on("phase:ready_update", (payload: ReadyFrame) => {
      if (payload?.roomId !== room) return;
      mine.standing = payload;
    });
    const aboard = waitForEvent(socket, "chat:history", undefined, 15000);
    socket.emit("room:join", { roomId: room });
    if (!(await aboard)) {
      throw new Error("A captain never boarded the harbor this article opens.");
    }
    crew.push({ captain, socket });
  }
  const departures = crew.map((seat) =>
    waitForEvent(seat.socket, "room:started", undefined, 15000),
  );
  crew[0].socket.emit("room:start", { roomId: room });
  await Promise.all(departures);

  const report = (seat: (typeof crew)[number], step: Seat, gold = 100) => {
    seat.socket.emit("game:status", {
      roomId: room,
      round: step.round,
      phase: step.phase,
      phaseLabel: step.phase,
      gold,
      reputation: 10,
      shipLevel: 0,
      gameOver: false,
    });
  };
  const standing = (step: Seat) =>
    heard[0].standing?.round === step.round &&
    heard[0].standing?.phase === step.phase;
  const stand = async (step: Seat): Promise<boolean> => {
    for (let waited = 0; waited < 15000; waited += 50) {
      if (standing(step)) return true;
      if (waited % 500 === 0) for (const seat of crew) report(seat, step);
      await new Promise((r) => setTimeout(r, 50));
    }
    return standing(step);
  };
  const settled = async (read: () => boolean, ms: number) => {
    for (let waited = 0; waited < ms; waited += 100) {
      if (read()) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return read();
  };
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  // Every read below is a count against what it was a moment ago rather
  // than against zero, so a frame from an earlier step can never stand in
  // for one this step is watching for.
  const counts = () => heard.map((mine) => mine.advances.length);
  const roster = () => heard[0].standing?.requiredUserIds ?? [];

  const stood = await stand({ round: 1, phase: "dusk" });
  check(stood, "both captains stand at Dusk, the seat the yard hangs off");

  // The mate votes. The room must hold for the captain still at the seat,
  // which the checkout above already kept whole before the fold landed.
  const beforeMate = counts();
  crew[1].socket.emit("phase:ready", { roomId: room, round: 1, phase: "dusk" });
  await settled(
    () => (heard[0].standing?.readyUserIds ?? []).length === 1,
    4000,
  );
  await wait(1500);
  check(
    counts().every((count, i) => count === beforeMate[i]),
    "one ready vote at Dusk moves nothing while the other captain stands at the seat",
  );
  check(
    roster().length === 2,
    "and the bar keeps both captains in its denominator",
  );

  // The field report's first half: one captain opens the module draft
  // while the vote stands.
  const beforeDraft = counts();
  report(crew[0], { round: 1, phase: "module_draft" });
  await wait(2500);
  check(
    counts().every((count, i) => count === beforeDraft[i]),
    "opening the module draft moves nothing, because the room waits on the captain inside the yard",
  );
  check(
    roster().length === 2 && roster().includes(crew[0].captain.id),
    "and the bar still names the captain inside the draft, because the seat is where that captain is standing",
  );

  // The swap screen folds the same way, and is checked because the two
  // screens are two names a fix could have covered one of.
  const beforeSwap = counts();
  report(crew[0], { round: 1, phase: "module_swap" });
  await wait(2000);
  check(
    counts().every((count, i) => count === beforeSwap[i]),
    "and the swap screen is the same wait for the same reason",
  );
  check(roster().length === 2, "with the bar still whole over the swap too");

  // The field report's other half: an act at the seat itself, same phase,
  // moved numbers. This is the upgrade shape, and it was never the cause,
  // which is what this holds down.
  const beforeAct = counts();
  report(crew[0], { round: 1, phase: "dusk" }, 140);
  await wait(1500);
  check(
    counts().every((count, i) => count === beforeAct[i]),
    "an upgrade at the seat moves nothing either, so neither half of the report was a gap in the seat's own rules",
  );

  // Liveness: the draft captain is back, both vote, and the room moves.
  const expected = counts().map((count) => count + 1);
  crew[0].socket.emit("phase:ready", { roomId: room, round: 1, phase: "dusk" });
  await settled(
    () => heard.every((mine, i) => mine.advances.length === expected[i]),
    8000,
  );
  check(
    heard.every((mine, i) => mine.advances.length === expected[i]) &&
      heard.every(
        (mine) => mine.advances[mine.advances.length - 1].phase === "dusk",
      ),
    "with both votes in and both captains at the seat, the departure is announced to every captain as it always was",
  );

  // the vote the reload left standing, and the screen that withdraws it
  //
  // The fold above is what makes the room wait on a captain inside the
  // yard, and read on its own it also counted a captain who had already
  // voted at the seat and then walked back into the yard: the room left
  // the moment the rest of the table had voted, and the draft captain's
  // own client ran the catch up every client runs for a seat the room has
  // moved past, which cancels a module draft under the hands of the
  // captain still reading it. That is the field report again, one seat
  // over from the one above, and the way in is the path a captain can
  // walk without a doctored client: a vote lives on the server while the
  // client that cast it can come back with no memory of the wait, so a
  // captain who readies, reloads their tab and walks back into the yard
  // is standing in the draft with a vote the room is still holding.
  //
  // The room's answer is that the newer of the two things a captain has
  // said wins: a report naming the yard's own screen withdraws the vote
  // that was cast at the seat, and the vote comes back the way every vote
  // at a seat does (see withdrawVoteForAScreen). The leg below is walked
  // on reports rather than on votes, so the departure above is behind it
  // and this seat starts with a clear ready set.
  const nextLeg: Seat = { round: 2, phase: "dusk" };
  report(crew[0], nextLeg);
  const stoodAgain = await stand(nextLeg);
  check(
    stoodAgain &&
      heard.every((mine, i) => mine.advances.length === expected[i]),
    "reporting onto the next leg's seat moves the room the way any report does and announces nothing, because a report is a captain saying where they stand rather than a vote they cast",
  );

  crew[0].socket.emit("phase:ready", { roomId: room, round: 2, phase: "dusk" });
  await settled(
    () => (heard[0].standing?.readyUserIds ?? []).includes(crew[0].captain.id),
    4000,
  );
  check(
    (heard[0].standing?.readyUserIds ?? []).join() === crew[0].captain.id,
    "a captain readies at the seat and the bar counts exactly that one vote, with the other captain still to answer",
  );

  const beforeTheYard = counts();
  report(crew[0], { round: 2, phase: "module_draft" });
  await settled(
    () => (heard[0].standing?.readyUserIds ?? []).length === 0,
    4000,
  );
  check(
    (heard[0].standing?.readyUserIds ?? []).length === 0 &&
      roster().length === 2 &&
      roster().includes(crew[0].captain.id),
    "a captain who voted and then reloaded back into the yard has that vote withdrawn the moment the screen is reported: the bar keeps them in its denominator and reads nothing from them, because the newer of the two things they have said is that they are back at work",
  );

  crew[1].socket.emit("phase:ready", { roomId: room, round: 2, phase: "dusk" });
  await settled(
    () => (heard[0].standing?.readyUserIds ?? []).length === 1,
    4000,
  );
  await wait(1500);
  check(
    counts().every((count, i) => count === beforeTheYard[i]),
    "so the mate's vote moves nothing while the draft captain is inside the yard, which is the half of the report a vote left standing used to walk straight past",
  );

  // And the release, which is the other half of the claim: the yard is
  // done, the captain is back at the seat, and their vote carries the
  // room out. The vote is cast at the seat after the report that puts
  // them there, which is the order every client runs (see the stand
  // helper in the lap walk of scripts/smoke.ts).
  const released = counts().map((count) => count + 1);
  report(crew[0], nextLeg);
  crew[0].socket.emit("phase:ready", { roomId: room, round: 2, phase: "dusk" });
  await settled(
    () => heard.every((mine, i) => mine.advances.length === released[i]),
    8000,
  );
  check(
    heard.every((mine, i) => mine.advances.length === released[i]) &&
      heard.every(
        (mine) => mine.advances[mine.advances.length - 1].phase === "dusk",
      ),
    "and a swap that completes releases the room: with the captain back at the seat and both votes standing, the departure the yard held is announced to every captain",
  );
}
