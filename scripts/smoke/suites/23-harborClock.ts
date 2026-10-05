// PortMasters 2.2 Parallel Release, smoke run: The harbor clock.

import { loadServerConfig } from "@/lib/config";
import { db } from "@/lib/db";
import { DRAFT_AUTO_PICK } from "@/lib/game/draft";
import type { GameMode } from "@/lib/game/mode";
import { normalizePhase, phaseFace } from "@/lib/game/phases";
import { readStoredRecord } from "@/lib/game/telemetry";
import type { Phase } from "@/lib/game/types";
import { DraftView } from "@/types/realtime/draft";
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
  // laptop. Five harbors go through one window at once, because the
  // window is real time and a fact each would otherwise cost a minute of
  // it. Four of them sail the mode the clock belongs to, because the
  // clock is the mode's before it is the operator's: a Classic table has
  // no seat that ends on a timer whatever PHASE_CLOCK says, which is what
  // C, the one harbor below in the founding mode, is here to hold. What
  // A, B, Q and Y differ in is who is still working when the clock runs
  // out:
  //
  //   A: two captains, both aboard, and the leg seat answered by neither:
  //      the clock is the only thing in the room that can end it.
  //   B: two captains and one of them gone once the leg is under way, so
  //      the harbor is not hostage to the laptop that closed.
  //   Q: one captain who reports onto the leg seat and then leaves,
  //      because an empty room is not a table waiting on a straggler and
  //      its clock does not move it.
  //   Y: one captain standing in the yard's own screen when Dusk's clock
  //      runs out, because the fire used to move the room through the
  //      seat and cancel the work under them: this harbor holds the
  //      deadline out one budget, once, and the fire after that moves it.
  //   C: one captain under way in the founding mode, which the clock does
  //      not reach at all, on a server that is timing the others.
  //
  // [W2: the path draft] And all four Gambit harbors are dealt their
  // paths first, because that is where a Gambit voyage opens now: the
  // departure pins each room to the draft's seat, every seat lays its
  // first card the moment it is dealt (the keeper wired into
  // openClockRoom below), and the settle announces the seat's own
  // departure like any other move. The draft's seat carries no clock and
  // is shown none, which is the point of it, so the seats this section
  // times are the ones the leg owns: the first of them opens the moment
  // the room reports itself off the deal, which is the report below every
  // client sends after the settle's frame.
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
  // Dusk is the seat the yard holds the fire for, so its budget times the
  // two fires Y below waits out.
  const duskSeconds = clockSeconds("dusk");
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
      // [W2: the path draft] The deal's own answer, driven the way a
      // captain drives it: a card laid whenever a step this seat has not
      // answered is put in front of it. The card is the seat's own first
      // (DRAFT_AUTO_PICK), which is the card the room would lay for a seat
      // that went silent, and one keep per step is the honest count: a
      // second would come back refused as a card already laid. Laying it
      // here turns the three steps over in a breath, so the clocks this
      // section is about are the only things below that ever wait.
      let answered: string | null = null;
      socket.on("draft:update", (payload: DraftView | null) => {
        if (!payload || payload.roomId !== roomId) return;
        if (payload.step === "done" || payload.hand.length === 0) return;
        if (answered === payload.step) return;
        answered = payload.step;
        // The press names the step the hand was read off, which is the
        // frame this handler is holding: a keep without it is refused at
        // the door, because an index is only a card against one hand (see
        // takeDraftPick on the server).
        socket.emit("draft:keep", {
          roomId,
          pick: DRAFT_AUTO_PICK,
          step: payload.step,
        });
      });
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
    return { roomId, crew };
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
  // [field report, 2026-10-03] The yard's own harbor, seated solo so the
  // one captain in the room is the one standing in the draft below.
  const clockY = await openClockRoom("Y", "clky", 1, GAMBIT);
  // The mode boundary, on the same server and inside the same window: a
  // founding-mode harbor whose seat is walked by hand. Nothing is closed
  // on it below, because there is nothing to wait for.
  const clockC = await openClockRoom("C", "clkc", 1, CLASSIC);

  // The wire first, while the room is still standing at the seat it
  // opened at: both halves of what a countdown is drawn from, checked
  // together, because a moment drawn on one client and a budget drawn on
  // another is the frame disagreeing with itself.
  //
  // The frame read is the first one standing at a seat of the lap rather
  // than the first one on the socket, and the difference is not a detail:
  // joining a room hands the joiner the room's ready state as it stands
  // (src/server/realtime/index.ts:530), so a captain who walks into a
  // lobby is told about the pier first. That frame is the other half of
  // this pair rather than an obstacle to it, since the pier is the seat
  // with no clock, and a field that reads null there is the design: an
  // absence rather than a zero, which no client can draw as a countdown
  // that has already run out. The seat the deal opens at answers the same
  // way, and for its own reason: it is answered by the table rather than
  // hurried along by anything, so it has no countdown to publish.
  const readyStates = clockA.crew[0].frames.filter(
    (frame) => frame.event === "phase:ready_update",
  );
  const pier = readyStates.find((frame) => frame.phase === "harbor");
  const dealt = readyStates.find((frame) => frame.phase === "path_draft");
  check(
    pier !== undefined && pier.endsAt === null && pier.seconds === null,
    "the pier a harbor waits at publishes no clock at all, rather than a countdown of zero",
  );
  check(
    dealt !== undefined && dealt.endsAt === null && dealt.seconds === null,
    "and the seat a Gambit voyage opens at publishes no countdown either, because the deal is answered by the table rather than hurried along by a clock",
  );
  // The founding mode, on the same server, read beside the checks above
  // rather than on its own, because all three together are the claim: one
  // server, timing its legs, hands a clock to the seats of the leg and
  // none to the pier, to the deal, or to a harbor in the founding mode,
  // and the last two differences are the seat's and the mode's rather
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
    "a harbor in the founding mode opens straight at Dawn with no clock on it, on a server that is timing the other three",
  );

  // [W2: the path draft] And the deal's own end, on the wire rather than
  // in the room: every seat has laid its card, the settle walks the table
  // off the seat with the same frame a ready set or a run out clock
  // announces, and the frame names the seat the room is leaving. The
  // reports below are the pair of moves a real client runs after these
  // frames, which is why the drive here is the client's own rather than a
  // nudge.
  const settleFrames = await Promise.all(
    [clockA, clockB, clockQ, clockY].map((harbor) =>
      waitForFrame(
        harbor.crew[0],
        (frame) =>
          frame.event === "phase:advance" && frame.phase === "path_draft",
        10000,
      ),
    ),
  );
  check(
    settleFrames.every((frame) => frame !== null),
    "every dealt harbor hears its deal settle as a departure from the draft's own seat, announced rather than voted for",
  );
  check(
    clockA.crew.every((seat) =>
      seat.frames.some(
        (frame) =>
          frame.event === "phase:advance" && frame.phase === "path_draft",
      ),
    ),
    "and the announcement reaches every captain at the table rather than the seat that answered last",
  );

  // The one move a report makes in this section, written once because
  // five of them are sent below: a captain says where they stand, the
  // checkpoint follows the furthest report, and the seat it lands on gets
  // its clock. It is the same frame a client sends on every phase change,
  // and it is the reason the checks read ready states rather than reports:
  // the report is the question, and the ready state is the room's answer.
  const moveTo = (
    harbor: { roomId: string },
    seat: { socket: Socket },
    round: number,
    phase: Phase,
  ): void => {
    seat.socket.emit("game:status", {
      roomId: harbor.roomId,
      round,
      phase,
      phaseLabel: phaseFace(phase).label,
      gold: 100,
      reputation: 10,
      shipLevel: 0,
      gameOver: false,
      renownLevel: 3,
    });
  };

  // [field report, 2026-10-03] Y's captain walks into the yard and stays
  // there. The two reports below are the client's own two moves: onto the
  // seat the lap ends its work at (Dusk, where the module draft lives),
  // and then into the draft itself, which is a screen rather than a seat
  // (see seatOf). The answer to the second is waited for by count,
  // because the two ready states are otherwise indistinguishable and the
  // yard's occupancy is read off the status the server cached: the cache
  // is written by the report that answer follows.
  const yArmedAt = Date.now();
  moveTo(clockY, clockY.crew[0], 1, "dusk");
  const yArmed = await waitForFrame(
    clockY.crew[0],
    (frame) =>
      frame.event === "phase:ready_update" &&
      frame.round === 1 &&
      frame.phase === "dusk",
    8000,
  );
  moveTo(clockY, clockY.crew[0], 1, "module_draft");
  const yDuskReadies = () =>
    clockY.crew[0].frames.filter(
      (frame) =>
        frame.event === "phase:ready_update" &&
        frame.round === 1 &&
        frame.phase === "dusk",
    );
  for (
    let waited = 0;
    waited < 8000 && yDuskReadies().length < 2;
    waited += 250
  ) {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  check(
    yArmed !== null &&
      yArmed.seconds === duskSeconds &&
      typeof yArmed.endsAt === "number" &&
      yArmed.endsAt > yArmedAt &&
      yArmed.endsAt <= yArmedAt + duskSeconds * 1000 + 2000,
    `the captain who reports into the yard lands the room on the seat the draft lives in and starts its clock there (${duskSeconds}s of Dusk)`,
  );
  check(
    yDuskReadies().length >= 2 &&
      typeof yDuskReadies()[0].endsAt === "number" &&
      yDuskReadies()[1].endsAt === yDuskReadies()[0].endsAt,
    "and reporting into the draft itself neither moves the room nor touches the clock that is already running",
  );

  // A stands at the leg's first seat, and the same report is what starts
  // the seat's countdown: a clock is armed by the move rather than by the
  // departure, so the moment the report is sent is the moment the bound
  // below is anchored to.
  const aArmedAt = Date.now();
  moveTo(clockA, clockA.crew[0], 1, "dawn");
  const aDawn = await waitForFrame(
    clockA.crew[0],
    (frame) =>
      frame.event === "phase:ready_update" &&
      frame.round === 1 &&
      frame.phase === "dawn",
    8000,
  );
  check(
    aDawn !== null &&
      aDawn.seconds === dawnSeconds &&
      typeof aDawn.endsAt === "number" &&
      aDawn.endsAt > aArmedAt &&
      aDawn.endsAt <= aArmedAt + dawnSeconds * 1000 + 2000,
    `the report that follows the settle lands the room on the first seat of the leg and starts its countdown there (${dawnSeconds}s of Dawn)`,
  );

  // B takes the same two frames, and then the laptop closes: with the leg
  // under way rather than before it, because what this harbor holds down
  // is the clock's account of an absent captain, and an absence from
  // before the voyage began would be the departure grace's story rather
  // than this section's.
  moveTo(clockB, clockB.crew[0], 1, "dawn");
  clockB.crew[1].socket.close();

  // Q's single captain reports onto the same seat and only then closes,
  // because an empty room is only a fact about a clock if the room was
  // standing on one when it emptied. The ready state is waited for rather
  // than assumed: it is the room's own word that the report moved the
  // checkpoint and armed the seat it now stands at.
  moveTo(clockQ, clockQ.crew[0], 1, "dawn");
  const qDawn = await waitForFrame(
    clockQ.crew[0],
    (frame) =>
      frame.event === "phase:ready_update" &&
      frame.round === 1 &&
      frame.phase === "dawn",
    8000,
  );
  check(
    qDawn !== null && typeof qDawn.endsAt === "number",
    "the solo harbor reports its way onto a seat the clock is timing before its last socket closes",
  );
  clockQ.crew[0].socket.close();

  // The long wait, and the only one this section spends: every clock
  // above was armed within a couple of seconds of the others, so the
  // window A needs covers all three. The frame read is the advance that
  // names the leg's first seat rather than the first advance on the
  // socket, because the deal's settle is an advance as well and it is a
  // long way behind by now. The settle afterwards is for B, whose clock
  // was armed a second or two later than A's and has to be given that
  // much again before its silence is a fact.
  const windowMs = (dawnSeconds + 20) * 1000;
  const advancedA = await waitForFrame(
    clockA.crew[0],
    (frame) => frame.event === "phase:advance" && frame.phase === "dawn",
    windowMs,
  );
  await new Promise((resolve) => setTimeout(resolve, 5000));

  check(
    advancedA?.round === 1 && advancedA?.phase === "dawn",
    "a harbor nobody has voted in is moved on by the clock it was given",
  );
  // The other half of the boundary, taken at the only moment it can be:
  // the timed harbors beside it have now stood at Dawn for longer than its
  // whole budget, so a founding mode harbor that had a clock would have
  // been moved by now, and this one never was.
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
  moveTo(clockA, clockA.crew[0], 1, "market");
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
  // ran out on is not in it: the fire found no one to move and wrote
  // nothing, so a room the clock had moved would be readable here as the
  // tally it never wrote.
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

  // [field report, 2026-10-03] And the yard held the fire. Y's captain has
  // been standing in the module draft since the first seconds of this
  // section, so Dusk's clock ran out on a captain mid pick, which is the
  // field report's first symptom read at the wire: the fire used to move
  // the room through the yard's own seat and take the draft with it. What
  // the frames show instead is the hold: a later deadline and no advance.
  //
  // The order of the two fires is half the claim. The hold is a frame
  // that moves the deadline rather than the room, so the first advance
  // naming Dusk must land after it and not before, and the tide line
  // belongs to the second fire alone: the fire that was held said
  // nothing, because nothing happened at it.
  const yFrames = clockY.crew[0].frames;
  const yHeldFrom = typeof yArmed?.endsAt === "number" ? yArmed.endsAt : 0;
  const yHeld = await waitForFrame(
    clockY.crew[0],
    (frame) =>
      frame.event === "phase:ready_update" &&
      frame.round === 1 &&
      frame.phase === "dusk" &&
      typeof frame.endsAt === "number" &&
      frame.endsAt > yHeldFrom + 1000,
    (duskSeconds + 20) * 1000,
  );
  check(
    yHeld !== null &&
      typeof yHeld.endsAt === "number" &&
      yHeld.endsAt <= yHeldFrom + duskSeconds * 1000 + 5000,
    `the clock, running out on a captain who is drafting, moves the deadline out one more budget rather than the room (${duskSeconds}s of Dusk)`,
  );
  const yAdvanceAt = yFrames.findIndex(
    (frame) =>
      frame.event === "phase:advance" &&
      frame.round === 1 &&
      frame.phase === "dusk",
  );
  check(
    yHeld !== null &&
      (yAdvanceAt === -1 || yFrames.indexOf(yHeld) < yAdvanceAt),
    "and nothing is announced while the hold stands, so the draft in front of the captain is not cancelled under them",
  );
  const yFired = await waitForFrame(
    clockY.crew[0],
    (frame) =>
      frame.event === "phase:advance" &&
      frame.round === 1 &&
      frame.phase === "dusk",
    (duskSeconds + 20) * 1000,
  );
  check(
    yFired !== null,
    "and the fire after it moves the room anyway, because the hold is spent once rather than renewed",
  );
  const yTide = yFrames.filter(
    (frame) =>
      frame.event === "room:system" &&
      (frame.content ?? "").includes("tide has run out"),
  );
  check(
    yTide.length === 1 &&
      yHeld !== null &&
      yFrames.indexOf(yTide[0]) > yFrames.indexOf(yHeld),
    "with the tide line said once, at the fire that ended the seat rather than at the one that was held",
  );

  // And the same room's record, flushed the way A's was: the leg the
  // second fire ended is on it once, for the one captain the room waited
  // on, because the held fire wrote no record at all.
  clockY.crew[0].socket.emit("room:restart", { roomId: clockY.roomId });
  await waitForEvent<{ roomId?: string }>(
    clockY.crew[0].socket,
    "room:restarted",
    (payload) => payload?.roomId === clockY.roomId,
  );
  const yRecord = await clockRecord(clockY.roomId);
  const yTimedOuts = (yRecord?.record?.events ?? []).filter(
    (event) => event.name === "leg_timed_out" && event.leg === 1,
  );
  const yTally = yTimedOuts.find((event) => event.name === "leg_timed_out");
  check(
    yTimedOuts.length === 1 && yTally?.ready === 0 && yTally?.required === 1,
    "and the leg the second fire ended is on the record once, for the room the hold kept waiting (0 of 1 ready)",
  );
}
