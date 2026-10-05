// PortMasters 2.2 Parallel Release, smoke run: the ready check that stalls.
//
// The field report this article is for is one sentence long: both captains
// clicked ready in a Gambit harbor and the voyage did not proceed. The
// protocol answers that sentence with one shape, and this article holds
// both halves of it down.
//
// The first half is the vote. A room advances when every captain in the
// active roster has said ready, and what each vote promises is a
// departure: the client hears the room move, runs its transition and
// reports the seat it landed on, and that report is what moves the
// checkpoint. A vote whose departure cannot leave the seat it is cast
// from, or a departure whose report never lands, leaves the room holding
// a full ready set and a lock nobody can lift: the bar reads ready on
// every screen and nothing moves. So the engine's answer to "can this
// press leave this seat" is checked here seat by seat, against both laps,
// because that answer is what the bar and every panel's own button now
// gate their press on.
//
// The second half is the room's own cure, and it is the half that has to
// be watched over a live harbor rather than read: an announcement the
// room never hears answered is handed back to the table after a grace
// longer than the client's own heartbeat, with the honest votes kept and
// the lock cleared, so the next report can announce the same seat again.
// Both directions are checked, because the cure that fired on a healthy
// table would be a second bug: a room whose report lands is never spoken
// to at all.
//
// What this article deliberately does not check is the press sites
// themselves, which are React panels. The engine's answer they gate on is
// here, the server's half is here, and the two of them together are what
// the client model outside the repository was run against to prove the
// field report closed.

import { autoCommit, canLeavePhase, leavePhase } from "@/lib/game/engine";
import { lapPhases, lapSuccessor } from "@/lib/game/checkpoint";
import { type GameMode } from "@/lib/game/mode";
import { createInitialGameState, type Phase } from "@/lib/game/types";
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

// The two laps this release sails. Classic is here because the guard is
// the engine's and both modes read it, and because the seats are the same
// six: a guard written against one lap's order would be a guard that
// changed the other mode's seats without anybody noticing.
const LAPS: GameMode[] = ["ocean_gambit", "classic"];
const GAMBIT: GameMode = "ocean_gambit";

// The seats a press cannot leave, named rather than derived, because this
// is the list the bug was made of: the pier is the host's, Dawn is the
// draft's, the two module seats belong to the draft's own screens, and
// the last two are a voyage that is already over for that captain.
const NOT_A_DEPARTURE = [
  "harbor",
  "path_draft",
  "dawn",
  "module_draft",
  "module_swap",
  "bankruptcy",
  "endgame",
] as const;

// And the seats a press cannot leave that are nonetheless seats of the
// lap, which is the distinction this whole article turns on: the pier
// is not a step of the leg, the path draft is a step a captain leaves by
// laying their cards, and Dawn is a step a captain leaves by choosing a
// card rather than by pressing the bar. Everything else the lap walks is
// a departure by press.
const LEFT_BY_CHOOSING = ["harbor", "path_draft", "dawn"] as const;

// The cure's own sentence, read off the wire. Held as a fragment rather
// than as the whole line, so the article is checking that the harbor named
// the leg it did not hear move, which is the part a captain acts on, and
// not that somebody once wrote a particular sentence.
const THE_CURE = "did not hear that leg move";

type Seat = { round: number; phase: Phase };
type ReadyFrame = {
  roomId?: string;
  round?: number;
  phase?: Phase;
  readyUserIds?: string[];
  requiredUserIds?: string[];
};

export async function readyCheckThatStallsSuite(run: SmokeRun): Promise<void> {
  const ctx = { seedBase: "smoke:ready-check", harborId: "smoke-ready-check" };
  const logs: string[] = [];
  const fresh = (mode: GameMode) =>
    createInitialGameState({ mode, difficulty: "fair_winds" });

  // The engine's answer, read for every seat of both laps. The pressable
  // seats of the lap are departures and every other seat in the union is
  // not, so the two loops below are the whole question rather than a
  // sample of it.
  for (const mode of LAPS) {
    const pressable = lapPhases(mode).filter(
      (phase) => !LEFT_BY_CHOOSING.includes(phase as "harbor"),
    );
    for (const phase of pressable) {
      check(
        canLeavePhase({ mode, phase, gameOver: false }) === true,
        `${mode} sails out of ${phase} by pressing, since it is a seat the leg walks through`,
      );
    }
    for (const phase of NOT_A_DEPARTURE) {
      check(
        canLeavePhase({ mode, phase, gameOver: false }) === false,
        `${mode} refuses a press at ${phase}, so a ready vote for a departure that cannot be made is never sent`,
      );
    }
  }
  check(
    canLeavePhase({ mode: GAMBIT, phase: "market", gameOver: true }) === false,
    "and a captain whose voyage is over cannot ready anywhere, whatever seat they are standing in",
  );

  // A press at Dawn, run rather than asked about: it has to report that it
  // did nothing AND leave the round where it was, because a press that
  // settled something on its way to refusing would be worse than one that
  // moves.
  const dawn = fresh(GAMBIT);
  dawn.phase = "dawn";
  const dawnRound = dawn.currentRound;
  check(
    leavePhase(dawn, ctx, logs) === false &&
      dawn.phase === "dawn" &&
      dawn.currentRound === dawnRound,
    "a departure pressed at Dawn refuses and moves nothing, which is the press every Ctrl+N in a Gambit harbor used to send",
  );

  // The same press at a seat that IS a departure, in both laps, read
  // against the lap's own successor rather than a name typed here.
  for (const mode of LAPS) {
    const state = fresh(mode);
    state.phase = "market";
    const moved = leavePhase(state, ctx, logs);
    check(
      moved === true && state.phase === lapSuccessor(mode, "market"),
      `${mode} leaves the Market for the seat its own lap names next when the same press is made there`,
    );
  }

  // And the auto path, which is what a captain who missed the announcement
  // runs: it takes the seat's defaults and leaves in one call, so a room
  // that moves without a vote is not left standing where it was.
  const auto = fresh(GAMBIT);
  auto.phase = "market";
  autoCommit(auto, ctx, logs);
  check(
    auto.phase === lapSuccessor(GAMBIT, "market"),
    "a captain who never voted still leaves the seat when the room moves on without them",
  );

  // The live half. Two captains, a private Gambit harbor, and two sockets
  // that are raw on purpose: nothing in this article runs a client, so the
  // room's own grace is the only thing that can answer an announcement
  // here.
  const tag = "rchk";
  const opening = await signUp(`${tag}a`);
  const crewmate = await signUp(`${tag}b`);
  run.extraAccounts.push(opening, crewmate);
  const opened = await call<{ room: { id: string; code: string } }>(
    "/api/rooms",
    {
      method: "POST",
      cookie: opening.cookie,
      body: JSON.stringify({
        name: `Smoke ready check ${suffix}`,
        isPublic: false,
        mode: GAMBIT,
        unlock: LEDGER_PHRASE,
      }),
    },
  );
  if (opened.status !== 200) {
    throw new Error(
      "No Gambit harbor to stall a ready check in, stopping here.",
    );
  }
  const room = opened.body.room.id;
  run.lapRoomIds.push(room);
  const joined = await call("/api/rooms/join", {
    method: "POST",
    cookie: crewmate.cookie,
    body: JSON.stringify({ code: opened.body.room.code }),
  });
  check(
    joined.status === 200,
    "the second captain joins the harbor this article stalls",
  );

  // What each socket heard, kept apart. Every frame below is the room's,
  // so both captains in the harbor hear the same one, and the checks read
  // both lists: a frame that reached one socket and not the other is a
  // difference this article exists to see rather than to average away.
  //
  // Only the cure's own lines are collected. The harbor talks to its room
  // about other things on this channel, a captain walking in being the
  // loudest of them, and a list that held those would count a hello as a
  // stalled leg.
  const heard: Array<{
    advances: Seat[];
    rescues: string[];
    standing: ReadyFrame | null;
    errors: string[];
  }> = [];
  const crew: Array<{ captain: Captain; socket: Socket }> = [];
  for (const captain of [opening, crewmate]) {
    const socket = await openAuthedSocket(captain);
    run.sockets.push(socket);
    const mine = {
      advances: [] as Seat[],
      rescues: [] as string[],
      standing: null as ReadyFrame | null,
      errors: [] as string[],
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
    socket.on(
      "room:system",
      (payload: { roomId?: string; content?: string }) => {
        if (payload?.roomId !== room) return;
        const line = String(payload.content ?? "");
        if (line.includes(THE_CURE)) mine.rescues.push(line);
      },
    );
    socket.on("room:error", (payload: { roomId?: string; error?: string }) => {
      if (payload?.roomId !== room) return;
      mine.errors.push(String(payload.error ?? ""));
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

  const report = (seat: (typeof crew)[number], step: Seat) => {
    seat.socket.emit("game:status", {
      roomId: room,
      round: step.round,
      phase: step.phase,
      phaseLabel: step.phase,
      gold: 100,
      reputation: 10,
      shipLevel: 0,
      gameOver: false,
    });
  };
  const standing = (step: Seat) =>
    heard[0].standing?.round === step.round &&
    heard[0].standing?.phase === step.phase;
  // Both captains stand where the article says they stand, and the room
  // says so back before anything else happens: a vote is judged against
  // the checkpoint the server is holding, so a vote that overtook the
  // report behind it would stall this article on its own haste rather
  // than on anything the harbor does.
  const stand = async (step: Seat): Promise<boolean> => {
    for (let waited = 0; waited < 15000; waited += 50) {
      if (standing(step)) return true;
      if (waited % 500 === 0) for (const seat of crew) report(seat, step);
      await new Promise((r) => setTimeout(r, 50));
    }
    return standing(step);
  };
  const ready = (step: Seat) => {
    for (const seat of crew) {
      seat.socket.emit("phase:ready", {
        roomId: room,
        round: step.round,
        phase: step.phase,
      });
    }
  };
  const settled = async (read: () => boolean, ms: number) => {
    for (let waited = 0; waited < ms; waited += 100) {
      if (read()) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return read();
  };
  const bothHeard = (
    count: (mine: (typeof heard)[number]) => number,
    want: number,
  ) => heard.length === 2 && heard.every((mine) => count(mine) === want);

  const stood = await stand({ round: 1, phase: "dawn" });
  check(
    stood,
    "both captains stand at the first seat of the leg in the harbor this article opened",
  );
  ready({ round: 1, phase: "dawn" });
  await settled(() => bothHeard((mine) => mine.advances.length, 1), 8000);
  check(
    bothHeard((mine) => mine.advances.length, 1) &&
      heard.every((mine) => mine.advances[0].phase === "dawn"),
    "a full ready set at Dawn announces the departure to every captain in the harbor, which is the frame both captains in the field report were waiting for",
  );
  check(
    heard.every((mine) => mine.advances[0].round === 1),
    "and the announcement names the seat being left rather than the one being entered",
  );

  // The healthy direction: one captain reports the seat the announcement
  // was about, the checkpoint moves, and the room must then say nothing at
  // all. The wait is longer than the room's own grace, so a watch left
  // armed by a report that landed would be caught here as a harbor
  // talking to itself.
  report(crew[0], { round: 1, phase: "market" });
  await settled(() => standing({ round: 1, phase: "market" }), 8000);
  check(
    standing({ round: 1, phase: "market" }),
    "the room stands at the seat that report named, so the departure was answered",
  );
  await new Promise((r) => setTimeout(r, 14000));
  check(
    heard.every((mine) => mine.rescues.length === 0),
    "a room whose departure was reported is never told the harbor did not hear it, since a cure that fired on a healthy table would be its own bug",
  );

  // The stalled direction: both captains ready at the Market and then
  // nobody reports. This is every captain's transport dying between the
  // announcement and the answer, and it is the shape the field report
  // describes from the other side of the screen.
  const stoodAgain = await stand({ round: 1, phase: "market" });
  check(stoodAgain, "both captains stand at the seat the harbor moved them to");
  ready({ round: 1, phase: "market" });
  await settled(() => bothHeard((mine) => mine.advances.length, 2), 8000);
  check(
    bothHeard((mine) => mine.advances.length, 2),
    "the ready set at the Market announces its departure as well",
  );
  await settled(() => bothHeard((mine) => mine.rescues.length, 1), 20000);
  check(
    bothHeard((mine) => mine.rescues.length, 1),
    "and an announcement nobody answers is handed back to the room after its grace, which is the cure for the stall the field report describes",
  );
  check(
    heard[0].rescues[0] === heard[1].rescues[0] &&
      String(heard[0].rescues[0]).includes("ready check is open again"),
    "and it is one line said to the room rather than one per socket in it, naming the ready check rather than a leg the harbor moved",
  );

  // The cure with its two halves held apart: the votes that were cast are
  // still counted, and the lock is gone. The first is read off the ready
  // state the room rebroadcasts, and the second can only be read off the
  // behavior it exists for, so a captain reports the seat again and the
  // harbor has to announce it a second time.
  check(
    heard[0].standing?.round === 1 &&
      heard[0].standing?.phase === "market" &&
      heard[0].standing?.readyUserIds?.length === 2 &&
      heard[0].standing?.requiredUserIds?.length === 2,
    "the ready check is open again on the same seat with both votes still counted, because the votes were honest and what was missing was the move",
  );
  report(crew[0], { round: 1, phase: "market" });
  await settled(() => bothHeard((mine) => mine.advances.length, 3), 8000);
  check(
    bothHeard((mine) => mine.advances.length, 3),
    "so the very next report announces the same seat again, which is the harbor carrying on rather than waiting on a lock nobody can see",
  );

  // And the voyage lands: the other side of the same promise, which is a
  // report naming somewhere further along moving the room there.
  report(crew[1], { round: 1, phase: "orders" });
  await settled(() => standing({ round: 1, phase: "orders" }), 8000);
  check(
    standing({ round: 1, phase: "orders" }),
    "and the harbor stands where that report put it, with the leg behind it settled rather than re opened",
  );
  check(
    heard.every((mine) => mine.errors.length === 0),
    "with nothing in this article refused along the way, so none of the above was the harbor declining to be spoken to",
  );
}
