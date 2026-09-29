// PortMasters 2.2 Parallel Release, smoke run: The harbor clock.

import { loadServerConfig } from "@/lib/config";
import { db } from "@/lib/db";
import type { GameMode } from "@/lib/game/mode";
import { normalizePhase, phaseFace } from "@/lib/game/phases";
import { readStoredRecord } from "@/lib/game/telemetry";
import type { Phase } from "@/lib/game/types";
import {
  CLASSIC,
  GAMBIT,
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

export async function harborClockSuite(run: SmokeRun): Promise<void> {
  // [B2: hard timers, the server as timekeeper] A leg is a segment of real
  // time, and a table is not held hostage to a captain who closed a
  // laptop. Four harbors go through one window at once, because the
  // window is real time and a fact each would otherwise cost a minute of
  // it. The first three sail the mode the clock belongs to, because the
  // clock is the mode's before it is the operator's: a Classic table has
  // no seat that ends on a timer whatever PHASE_CLOCK says, which is what
  // the fourth harbor below is here to hold. What A, B and Q differ in is
  // who is still sitting in the room when the clock runs out:
  //
  //   A: two captains, both aboard and neither doing anything, so the
  //      clock is the only thing in the room that can end the leg.
  //   B: two captains and one of them gone, so the harbor is not hostage
  //      to the laptop that closed.
  //   Q: nobody at all, because an empty room is not a table waiting on a
  //      straggler and its clock does not move it.
  //   C: one captain under way in the founding mode, which the clock does
  //      not reach at all, on a server that is timing the other three.
  //
  // What only this section can hold is that the expiry announces the same
  // advance a unanimous ready set announces. The captains here are raw
  // sockets with no engine behind them, so the frame is all this side of
  // the wire can see; the auto commit that frame draws out of a client is
  // held by the browser check, where a page that never clicks still leaves
  // the leg.
  //
  // The budget is read from the phase table and the server's own scale
  // rather than typed in, for the same reason the lap walk reads the lap
  // rather than restating it. Deliberately read as the two inputs rather
  // than through the server's own helper: a budget this section shared
  // with the code under test would move with it, and a clock that fired at
  // the wrong moment would pass.
  if (loadServerConfig().phaseClockScale <= 0) {
    throw new Error(
      "The clock checks need the server under test to be timing its legs, so PHASE_CLOCK must be a number above zero.\n" +
        "It is off unless it is asked for, and the section below is the asking, so start the server and this script with the same value, or run them in the same shell.",
    );
  }
  const clockSeconds = (phase: Phase) =>
    Math.max(
      1,
      Math.round(
        (phaseFace(phase).seconds ?? 0) * loadServerConfig().phaseClockScale,
      ),
    );
  const dawnSeconds = clockSeconds("dawn");
  const marketSeconds = clockSeconds("market");
  // The empty harbor is judged on the clock's own branch rather than on a
  // room whose last seat was reaped, and those two are only
  // distinguishable while the budget runs out first. A closed socket is
  // reclaimed after thirty seconds (DEPARTURE_GRACE_MS in
  // ./src/server/realtime/presence.ts), and a room whose last seat is
  // taken is deleted with its voyage closed, which ends a clock for a
  // reason that has nothing to do with this slice.
  const GRACE_SECONDS = 30;
  if (dawnSeconds >= GRACE_SECONDS) {
    throw new Error(
      `The clock checks need a phase budget shorter than the ${GRACE_SECONDS} second departure grace, so a room nobody is sitting in is still a room when its clock runs out.\n` +
        `This run reads PHASE_CLOCK=${loadServerConfig().phaseClockScale}, which puts Dawn at ${dawnSeconds} seconds.`,
    );
  }

  // Enough of a frame to make a claim about it: the two numbers a
  // countdown is drawn from, and the tally a seat was left with. Named
  // only by the fields the checks below read, so nothing here can quietly
  // depend on something the server never promised.
  type ClockFrame = {
    event: "phase:advance" | "phase:ready_update" | "room:system";
    round?: number;
    phase?: Phase;
    endsAt?: number | null;
    seconds?: number | null;
    content?: string;
  };

  // One chartered harbor, seated and under way, with every frame of its
  // clock recorded as it arrives. The same shape the lap walk uses to get
  // a voyage sailing, since a harbor reaches the clock the way it reaches
  // anything else: by being started.
  const openClockRoom = async (
    label: string,
    tag: string,
    seats: number,
    mode: GameMode,
  ) => {
    const captains: Captain[] = [];
    for (let seat = 0; seat < seats; seat++) {
      captains.push(await signUp(`${tag}${seat}`));
    }
    run.extraAccounts.push(...captains);
    const opened = await call<{ room: { id: string; code: string } }>(
      "/api/rooms",
      {
        method: "POST",
        cookie: captains[0].cookie,
        body: JSON.stringify({
          name: `Smoke clock ${label} ${suffix}`,
          isPublic: false,
          mode,
          // The experimental voyage is sealed behind its phrase, the way
          // the lap walk opens one: a room that could not be chartered
          // would otherwise fail here as a harbor that does not exist
          // rather than as a door that was not opened.
          ...(mode === "ocean_gambit" ? { unlock: LEDGER_PHRASE } : {}),
        }),
      },
    );
    if (opened.status !== 200) {
      throw new Error(
        `No ${label} harbor to run a clock in, stopping here (${opened.status}).`,
      );
    }
    const roomId = opened.body.room.id;
    run.lapRoomIds.push(roomId);
    for (const captain of captains.slice(1)) {
      const seated = await call("/api/rooms/join", {
        method: "POST",
        cookie: captain.cookie,
        body: JSON.stringify({ code: opened.body.room.code }),
      });
      if (seated.status !== 200) {
        throw new Error(`A captain could not sit in the ${label} harbor.`);
      }
    }
    const crew: Array<{
      captain: Captain;
      socket: Socket;
      frames: ClockFrame[];
    }> = [];
    for (const captain of captains) {
      const socket = await openAuthedSocket(captain);
      run.sockets.push(socket);
      const frames: ClockFrame[] = [];
      socket.on(
        "phase:advance",
        (payload: { roomId?: string; round?: number; phase?: Phase }) => {
          if (payload?.roomId !== roomId) return;
          frames.push({
            event: "phase:advance",
            round: payload.round,
            phase: normalizePhase(payload.phase),
          });
        },
      );
      socket.on(
        "phase:ready_update",
        (payload: {
          roomId?: string;
          round?: number;
          phase?: Phase;
          phaseEndsAt?: number | null;
          phaseSeconds?: number | null;
        }) => {
          if (payload?.roomId !== roomId) return;
          frames.push({
            event: "phase:ready_update",
            round: payload.round,
            phase: normalizePhase(payload.phase),
            endsAt: payload.phaseEndsAt ?? null,
            seconds: payload.phaseSeconds ?? null,
          });
        },
      );
      socket.on(
        "room:system",
        (payload: { roomId?: string; content?: string }) => {
          if (payload?.roomId !== roomId) return;
          frames.push({
            event: "room:system",
            content: payload.content ?? "",
          });
        },
      );
      const aboard = waitForEvent<WireHistory>(
        socket,
        "chat:history",
        (payload) => payload?.roomId === roomId,
      );
      socket.emit("room:join", { roomId });
      await aboard;
      crew.push({ captain, socket, frames });
    }
    const departures = crew.map((seat) =>
      waitForEvent<{ roomId?: string }>(
        seat.socket,
        "room:started",
        (payload) => payload?.roomId === roomId,
      ),
    );
    crew[0].socket.emit("room:start", { roomId });
    await Promise.all(departures);
    return { roomId, crew, sailedAt: Date.now() };
  };

  // Waits for a frame a socket has already recorded rather than for the
  // next one to arrive, because the clock's frames can land between two
  // steps of this file and a listener registered after the fact would
  // wait out its window on news it had already missed.
  const waitForFrame = async (
    seat: { frames: ClockFrame[] },
    match: (frame: ClockFrame) => boolean,
    windowMs: number,
  ): Promise<ClockFrame | null> => {
    for (let waited = 0; waited < windowMs; waited += 250) {
      const found = seat.frames.find(match);
      if (found) return found;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return seat.frames.find(match) ?? null;
  };

  // The voyage a room left behind, read the way a later reader reads it,
  // or null if none was ever written.
  const clockRecord = async (roomId: string) => {
    for (let waited = 0; waited < 25000; waited += 250) {
      const row = await db.voyageTelemetry.findFirst({
        where: { roomId: roomId },
        select: { outcome: true, record: true },
      });
      if (row) {
        return { outcome: row.outcome, record: readStoredRecord(row.record) };
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return null;
  };

  const clockA = await openClockRoom("A", "clka", 2, GAMBIT);
  const clockB = await openClockRoom("B", "clkb", 2, GAMBIT);
  const clockQ = await openClockRoom("Q", "clkq", 1, GAMBIT);
  // The mode boundary, on the same server and inside the same window: a
  // founding-mode harbor whose seat is walked by hand. Nothing is closed
  // on it below, because there is nothing to wait for.
  const clockC = await openClockRoom("C", "clkc", 1, CLASSIC);
  // The two absences a clock has to survive: a captain who closed the tab
  // (B's crewmate) and a harbor with nobody left in it at all (Q's only
  // captain). Both are a socket closing, and neither is a vote.
  clockB.crew[1].socket.close();
  clockQ.crew[0].socket.close();

  // The wire first, while the room is still standing at the seat it
  // opened at: both halves of what a countdown is drawn from, checked
  // together, because a moment drawn on one client and a budget drawn on
  // another is the frame disagreeing with itself. The gap allowed is the
  // two seconds it takes the departure frame to reach this side.
  //
  // The frame read is the first one standing at a seat of the leg rather
  // than the first one on the socket, and the difference is not a detail:
  // joining a room hands the joiner the room's ready state as it stands
  // (src/server/realtime/index.ts:530), so a captain who walks into a
  // lobby is told about the pier first. That frame is the other half of
  // this pair rather than an obstacle to it, since the pier is the seat
  // with no clock, and a field that reads null there is the design: an
  // absence rather than a zero, which no client can draw as a countdown
  // that has already run out.
  const readyStates = clockA.crew[0].frames.filter(
    (frame) => frame.event === "phase:ready_update",
  );
  const pier = readyStates.find((frame) => frame.phase === "harbor");
  const opening = readyStates.find((frame) => frame.phase !== "harbor");
  check(
    pier !== undefined && pier.endsAt === null && pier.seconds === null,
    "the pier a harbor waits at publishes no clock at all, rather than a countdown of zero",
  );
  check(
    opening?.phase === "dawn" &&
      opening.seconds === dawnSeconds &&
      typeof opening.endsAt === "number" &&
      opening.endsAt > clockA.sailedAt &&
      opening.endsAt <= clockA.sailedAt + dawnSeconds * 1000 + 2000,
    `the seat a voyage opens at publishes both halves of its countdown (${dawnSeconds}s of Dawn)`,
  );
  // The same seat, on the same server, in the other mode. Read beside the
  // check above rather than on its own, because the two together are the
  // claim: one server, timing its legs, hands a clock to one harbor and
  // none to the other, and the difference between them is the mode rather
  // than anything the operator set.
  const cOpening = await waitForFrame(
    clockC.crew[0],
    (frame) => frame.event === "phase:ready_update" && frame.phase !== "harbor",
    5000,
  );
  check(
    cOpening?.phase === "dawn" &&
      cOpening.endsAt === null &&
      cOpening.seconds === null,
    "a harbor in the founding mode stands at the same seat with no clock on it, on a server that is timing the other three",
  );

  // The long wait, and the only one this section spends: every clock
  // above was armed within a couple of seconds of the others, so the
  // window A needs covers all three. The settle afterwards is for B, whose
  // clock was armed a second or two later than A's and has to be given
  // that much again before its silence is a fact.
  const windowMs = (dawnSeconds + 20) * 1000;
  const advancedA = await waitForFrame(
    clockA.crew[0],
    (frame) => frame.event === "phase:advance",
    windowMs,
  );
  await new Promise((resolve) => setTimeout(resolve, 5000));

  check(
    advancedA?.round === 1 && advancedA?.phase === "dawn",
    "a harbor nobody has voted in is moved on by the clock it was given",
  );
  // The other half of the boundary, taken at the only moment it can be:
  // the other three harbors have now been standing at Dawn for longer
  // than its whole budget, so a founding mode harbor that had a clock
  // would have been moved by now, and this one never was.
  check(
    clockC.crew.every((seat) =>
      seat.frames.every((frame) => frame.event !== "phase:advance"),
    ),
    "and a harbor in the founding mode is not moved by it at all, however long it is left standing",
  );
  check(
    clockA.crew.every((seat) =>
      seat.frames.some(
        (frame) =>
          frame.event === "phase:advance" &&
          frame.round === 1 &&
          frame.phase === "dawn",
      ),
    ),
    "and both of its captains were told what the room was doing",
  );
  check(
    clockA.crew[0].frames.some(
      (frame) =>
        frame.event === "room:system" &&
        (frame.content ?? "").includes("tide has run out"),
    ),
    "with the harbor saying why, on the channel it says everything else on",
  );
  check(
    clockB.crew[0].frames.some(
      (frame) =>
        frame.event === "phase:advance" &&
        frame.round === 1 &&
        frame.phase === "dawn",
    ),
    "a captain who closed a laptop mid leg does not hold the harbor to their socket",
  );
  // And the announcement is an announcement rather than a move. The
  // server still runs no game rules: the room's row is where the last
  // report put it, and a client that hears the frame is the one that
  // takes the room forward.
  const fired = await db.room.findUnique({
    where: { id: clockA.roomId },
    select: { currentRound: true, currentPhase: true },
  });
  check(
    fired?.currentRound === 1 && normalizePhase(fired?.currentPhase) === "dawn",
    "the clock moved the room's captains without moving its checkpoint",
  );
  // The other half of spending the deadline: the seat is timed once, and
  // the next sign of life arms a fresh budget for the seat the room is
  // actually standing at. This is the path a returning captain takes,
  // since the report that moves the checkpoint is the same report that
  // puts the room back on the clock.
  clockA.crew[0].socket.emit("game:status", {
    roomId: clockA.roomId,
    round: 1,
    phase: "market" as Phase,
    phaseLabel: phaseFace("market").label,
    gold: 100,
    reputation: 10,
    shipLevel: 0,
    gameOver: false,
    renownLevel: 3,
  });
  const rearmed = await waitForFrame(
    clockA.crew[0],
    (frame) =>
      frame.event === "phase:ready_update" &&
      frame.round === 1 &&
      frame.phase === "market",
    8000,
  );
  check(
    rearmed?.seconds === marketSeconds &&
      typeof rearmed.endsAt === "number" &&
      rearmed.endsAt > Date.now() &&
      rearmed.endsAt <= Date.now() + marketSeconds * 1000,
    `and the first report after it puts the room back on the clock (${marketSeconds}s of Market)`,
  );

  // The empty harbor, read off the voyage it leaves behind. It is closed
  // as an emptied one when its last seat is reclaimed, which is the only
  // record a harbor nobody is sitting in can have, and the leg its clock
  // ran out on is not in it: the tally rides the spine the moment the
  // clock fires, so a room that had been moved would be readable here.
  const abandoned = await clockRecord(clockQ.roomId);
  check(
    abandoned?.outcome === "emptied",
    "a harbor abandoned by its last captain closes its voyage as an emptied one",
  );
  check(
    (abandoned?.record?.events ?? []).every(
      (event) => event.name !== "leg_timed_out",
    ),
    "and no leg of it was timed out, because a room nobody is sitting in is not moved by its clock",
  );

  // Room A's own record, flushed the way a host flushes one: restarting
  // the voyage the clock just moved, which closes the record as restarted
  // and leaves it readable.
  clockA.crew[0].socket.emit("room:restart", { roomId: clockA.roomId });
  await waitForEvent<{ roomId?: string }>(
    clockA.crew[0].socket,
    "room:restarted",
    (payload) => payload?.roomId === clockA.roomId,
  );
  const timedOut = await clockRecord(clockA.roomId);
  const tally = (timedOut?.record?.events ?? []).find(
    (event) => event.name === "leg_timed_out",
  );
  check(
    tally?.name === "leg_timed_out" &&
      tally.leg === 1 &&
      tally.ready === 0 &&
      tally.required === 2,
    "the leg the clock ended is on the record with the room it found (0 of 2 ready)",
  );
}
