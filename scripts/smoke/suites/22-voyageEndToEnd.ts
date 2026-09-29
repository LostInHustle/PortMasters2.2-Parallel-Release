// PortMasters 2.2 Parallel Release, smoke run: A voyage end to end on the six phase leg.

import { db } from "@/lib/db";
import { lapPhases } from "@/lib/game/checkpoint";
import type { GameMode } from "@/lib/game/mode";
import { voyageRoundsFor } from "@/lib/game/mode";
import { isLegPhase, normalizePhase, phaseFace } from "@/lib/game/phases";
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
import type { Captain, WireHistory } from "../wire";
import type { Socket } from "socket.io-client";
import type { SmokeRun } from "../run";

export async function voyageEndToEndSuite(run: SmokeRun): Promise<void> {
  // [B1: the six phase leg, as data] The plan's evaluation for this slice,
  // read over live sockets rather than off the tables. A whole voyage has
  // to reach every seat of the lap, and both captains have to be told the
  // same checkpoint at every transition. What this catches that no data
  // check can is a phase that does not register with the checkpoint
  // protocol at all: the room sits at it forever, and that shows up here
  // as a harbor that never arrived rather than as one that is quietly
  // wrong.
  //
  // Classic sails its whole voyage, which is the run the evaluation names.
  // Gambit sails one full round: enough to prove its own order drives the
  // same protocol, without spending twelve rounds of wall clock on a lap
  // the leg clock section above already holds to the data. Between them,
  // every seat of both laps is walked by the room itself.
  //
  // Each captain here is brand new and holds exactly one socket, which
  // matters rather than being tidy: the status handler ignores a frame
  // from any socket that is not its captain's newest, so a captain with an
  // older live socket would have every report dropped and the walk would
  // stall for a reason that has nothing to do with the lap. The tag is the
  // short half of the two usernames, which are capped well below what a
  // label like the one the checks print would fit in.
  type LapStep = { round: number; phase: Phase };
  type LapFrame = LapStep & {
    event: "phase:ready_update" | "phase:advance";
    required?: string[];
  };
  const sailTheLap = async (
    label: string,
    tag: string,
    mode: GameMode,
    rounds: number,
    unlock?: string,
  ) => {
    const opening = await signUp(`${tag}a`);
    const crewmate = await signUp(`${tag}b`);
    run.extraAccounts.push(opening, crewmate);
    const opened = await call<{ room: { id: string; code: string } }>(
      "/api/rooms",
      {
        method: "POST",
        cookie: opening.cookie,
        body: JSON.stringify({
          name: `Smoke ${label} lap ${suffix}`,
          isPublic: false,
          mode,
          ...(unlock ? { unlock } : {}),
        }),
      },
    );
    if (opened.status !== 200) {
      throw new Error(`No ${label} harbor to sail a lap in, stopping here.`);
    }
    const room = opened.body.room.id;
    run.lapRoomIds.push(room);
    const joined = await call<{ room: { id: string } }>("/api/rooms/join", {
      method: "POST",
      cookie: crewmate.cookie,
      body: JSON.stringify({ code: opened.body.room.code }),
    });
    check(
      joined.status === 200,
      `the second captain joins the ${label} harbor`,
    );

    const crew: Array<{
      captain: Captain;
      socket: Socket;
      frames: LapFrame[];
    }> = [];
    for (const captain of [opening, crewmate]) {
      const socket = await openAuthedSocket(captain);
      run.sockets.push(socket);
      const frames: LapFrame[] = [];
      const record =
        (event: LapFrame["event"]) =>
        (payload: {
          roomId?: string;
          round?: number;
          phase?: Phase;
          requiredUserIds?: string[];
        }) => {
          if (payload?.roomId !== room) return;
          frames.push({
            event,
            round: payload.round ?? 0,
            phase: normalizePhase(payload.phase),
            required: payload.requiredUserIds,
          });
        };
      socket.on("phase:ready_update", record("phase:ready_update"));
      socket.on("phase:advance", record("phase:advance"));
      const aboard = waitForEvent<WireHistory>(
        socket,
        "chat:history",
        (payload) => payload?.roomId === room,
      );
      socket.emit("room:join", { roomId: room });
      await aboard;
      crew.push({ captain, socket, frames });
    }

    const departures = crew.map((seat) =>
      waitForEvent<{ roomId?: string }>(
        seat.socket,
        "room:started",
        (payload) => payload?.roomId === room,
      ),
    );
    crew[0].socket.emit("room:start", { roomId: room });
    await Promise.all(departures);

    // The run this walk is here to make, written out of the mode's own
    // lap: every seat of the round, repeated for as many rounds as the
    // voyage is long. Nothing about the order is typed in below, so a lap
    // that changed order would change what the room is expected to walk.
    const lap = lapPhases(mode).filter(isLegPhase);
    const expected: LapStep[] = [];
    for (let round = 1; round <= rounds; round++) {
      for (const phase of lap) expected.push({ round, phase });
    }

    const send = (seat: (typeof crew)[number], step: LapStep) => {
      seat.socket.emit("game:status", {
        roomId: room,
        round: step.round,
        phase: step.phase,
        phaseLabel: phaseFace(step.phase).label,
        gold: 100,
        reputation: 10,
        shipLevel: 0,
        gameOver: false,
        renownLevel: 3,
      });
    };
    const ready = (seat: (typeof crew)[number], step: LapStep) => {
      seat.socket.emit("phase:ready", {
        roomId: room,
        round: step.round,
        phase: step.phase,
      });
    };
    // The room's whole protocol, in the order a client runs it: stand
    // where you are, hear the room standing there too, then say you are
    // done. The middle step is not politeness. A ready vote is judged
    // against the checkpoint the server is holding, so a vote that
    // overtakes the report which put the room at this seat is refused as
    // out of step: the harbor would be short a vote, and the walk would
    // have stalled on its own haste rather than on anything the lap does.
    const stand = async (step: LapStep) => {
      for (const seat of crew) send(seat, step);
      for (let waited = 0; waited < 15000; waited += 50) {
        if (
          crew.every((seat) =>
            seat.frames.some(
              (frame) =>
                frame.event === "phase:ready_update" &&
                frame.round === step.round &&
                frame.phase === step.phase,
            ),
          )
        ) {
          return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return false;
    };
    const arrived = async (step: LapStep) => {
      for (let waited = 0; waited < 15000; waited += 50) {
        if (
          crew.every((seat) =>
            seat.frames.some(
              (frame) =>
                frame.event === "phase:advance" &&
                frame.round === step.round &&
                frame.phase === step.phase,
            ),
          )
        ) {
          return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return false;
    };

    // The claim the ready check makes, held once at the voyage's first
    // seat: a vote from one captain alone does not move the room. Without
    // this the walk would pass on a build that advanced the harbor on any
    // vote at all, since every later step sends both. The voyage opens
    // with the room already standing at this seat, because room:start put
    // it there and said so, so the frame this waits on is already
    // recorded rather than still to come.
    const first = expected[0];
    const standing = await stand(first);
    ready(crew[0], first);
    await new Promise((resolve) => setTimeout(resolve, 600));
    check(
      !crew.some((seat) =>
        seat.frames.some((f) => f.event === "phase:advance"),
      ),
      `one captain's ready vote does not move the ${label} harbor on its own`,
    );
    ready(crew[1], first);
    let reached = 0;
    if (standing && (await arrived(first))) reached = 1;
    // The rest of the voyage is those two steps repeated, once per seat of
    // the lap, for as long as the voyage runs.
    //
    // Paced, because the harbor has a budget for what it will read. The
    // inbound budget (see src/server/realtime/inbound-limit.ts) earns a
    // socket ten frames a second back on top of its burst of thirty, and
    // one step here costs each seat two frames, the report that moves the
    // room and the vote that releases it. A walk that steps as fast as
    // the server answers runs at twice the rate the budget pays out: it
    // drains the burst, and every frame after that is refused without a
    // word, which on this side of the wire looks exactly like a lap that
    // stopped advancing. A third of a second a step holds the walk under
    // seven frames a second a seat, which is inside the budget a shipped
    // client lives inside too.
    const pace = () => new Promise((resolve) => setTimeout(resolve, 300));
    for (const step of expected.slice(1)) {
      await pace();
      if (!(await stand(step))) break;
      ready(crew[0], step);
      ready(crew[1], step);
      if (!(await arrived(step))) break;
      reached++;
    }
    check(
      reached === expected.length,
      `the ${label} harbor reached every seat of its lap (the walk reached ${reached} of ${expected.length})`,
    );

    // Where the room went, as the two captains heard it. The advance frames
    // are the server naming the checkpoint the room is leaving, once per
    // transition, so the sequence they form is the voyage's shape.
    const walked = (seat: (typeof crew)[number]) =>
      seat.frames
        .filter((frame) => frame.event === "phase:advance")
        .map((frame) => `${frame.round}:${frame.phase}`);
    const want = expected.map((step) => `${step.round}:${step.phase}`);
    check(
      walked(crew[0]).join(" ") === want.join(" "),
      `and walked it in the mode's own order, round after round (${walked(crew[0]).slice(0, 7).join(" ")}...)`,
    );
    check(
      walked(crew[1]).join(" ") === want.join(" "),
      "with the second captain told the same thing at every one of them",
    );
    // Not just the same phase, the same frames: every broadcast the room
    // made, in the order it made them. Two clients that agree on the
    // phase but heard a different number of transitions would mean one of
    // them was being carried by a catch up path rather than by the room,
    // which is the failure the rollback clause of [B1] is about.
    check(
      JSON.stringify(crew[0].frames) === JSON.stringify(crew[1].frames),
      `both captains heard the same ${label} frames, in the same order, for the whole voyage`,
    );
    // And the room waited for both of them at every seat rather than
    // advancing around a captain it had stopped counting.
    const requiredBoth = crew[0].frames
      .filter((frame) => frame.event === "phase:ready_update")
      .every(
        (frame) =>
          frame.required?.length === 2 &&
          frame.required.includes(opening.id) &&
          frame.required.includes(crewmate.id),
      );
    check(
      requiredBoth,
      `every ${label} transition waited for a full crew of two`,
    );

    // The terminal is not a seat. A voyage that has finished reports
    // endgame, which no lap lists, so the room's checkpoint stays on the
    // last phase it actually walked rather than following a captain onto a
    // screen the rest of the harbor is not standing on.
    const last = expected[expected.length - 1];
    crew[0].socket.emit("game:status", {
      roomId: room,
      round: last.round,
      phase: "endgame" as Phase,
      phaseLabel: phaseFace("endgame").label,
      gold: 100,
      reputation: 10,
      shipLevel: 0,
      gameOver: true,
      renownLevel: 3,
    });
    await new Promise((resolve) => setTimeout(resolve, 600));
    const settled = await db.room.findUnique({
      where: { id: room },
      select: { currentRound: true, currentPhase: true },
    });
    check(
      settled?.currentRound === last.round &&
        normalizePhase(settled?.currentPhase) === last.phase,
      `and a finished ${label} voyage leaves the room where the lap last stood rather than on the endgame screen`,
    );
  };

  await sailTheLap(
    "Classic",
    "lapc",
    "classic",
    voyageRoundsFor("classic", "fair_winds"),
  );
  await sailTheLap("Gambit", "lapg", "ocean_gambit", 1, LEDGER_PHRASE);
}
