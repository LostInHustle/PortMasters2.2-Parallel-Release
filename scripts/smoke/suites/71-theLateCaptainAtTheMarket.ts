// PortMasters 2.2 Parallel Release, smoke run: the late captain at the market.
//
// The market is the one seat whose board is drawn from numbers the advance
// carries: the harbor pulse from the round before, the Harbormaster's port
// shift and the bazaar lean. A captain who misses that advance catches up
// through the ready frame the harbor rebroadcasts, and if that frame did not
// carry the same three numbers, the catch-up transition would draw a board
// priced from the previous round while the rest of the table shopped at the
// new one.
//
// This article holds both halves of the cure. The server half is walked on a
// live Gambit harbor: the advance out of Dawn is read off the wire, the ready
// frame a captain requests at the Market is read after it, and the two must
// name the same three leans. Then the harbor leaves the Market and the same
// request must come back without them, because a frame that kept handing out
// last round's leans would price a board nobody else is shopping at.
//
// The client half is a React hook, so it is read off its own file rather than
// driven: both catch-up transitions apply the frame's leans on the line before
// they run, which is the order the bug turned on.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Socket } from "socket.io-client";

import type { Phase } from "@/lib/game/types";
import {
  LEDGER_PHRASE,
  call,
  check,
  openAuthedSocket,
  signUp,
  sleep,
  suffix,
  waitForEvent,
} from "../harness";
import type { Captain } from "../wire";
import type { SmokeRun } from "../run";

type Seat = { round: number; phase: Phase };

// The three leans as they ride the advance, and the same three as they ride
// the ready frame. Kept structural rather than imported, because this article
// reads them off the wire and a type from the engine would let a shape change
// pass unread.
type Leans = {
  harborPulse?: Record<string, number>;
  portShift?: unknown;
  bazaarLean?: Record<string, number>;
};

type AdvanceFrame = Leans & {
  roomId?: string;
  round?: number;
  phase?: Phase;
};

type ReadyFrame = Leans & {
  roomId?: string;
  round?: number;
  phase?: Phase;
  readyUserIds?: string[];
  requiredUserIds?: string[];
  marketLeans?: Leans;
};

const GAMBIT = "ocean_gambit";

/** Reads two wire values as JSON, with an absent key and a null alike. */
function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export async function theLateCaptainAtTheMarketSuite(
  run: SmokeRun,
): Promise<void> {
  // The client half, read off its file. Each application has to sit on the
  // line before the transition it guards: applying the leans after the
  // transition would be the same bug with a different shape, because the
  // board is drawn inside that transition.
  const repoRoot = join(import.meta.dirname, "..", "..", "..");
  const sync = readFileSync(
    join(repoRoot, "src", "lib", "use-phase-sync.ts"),
    "utf8",
  );
  const guarded =
    sync.match(
      /if \(data\.marketLeans\) applyMarketLeans\(state, data\.marketLeans\);\n\s+(fn\(state, logs\);|autoCommit\(state, ctx, logs\);)/g,
    ) ?? [];
  check(
    guarded.length === 2 &&
      guarded.some((pair) => pair.includes("fn(state, logs);")) &&
      guarded.some((pair) => pair.includes("autoCommit(state, ctx, logs);")),
    "both catch-up transitions in the phase sync apply the ready frame's market leans on the line before they run, so a captain who missed the advance prices the board from the same numbers the rest of the table is shopping at",
  );

  const tag = "lean";
  const opening = await signUp(`${tag}a`);
  const crewmate = await signUp(`${tag}b`);
  run.extraAccounts.push(opening, crewmate);
  const opened = await call<{ room: { id: string; code: string } }>(
    "/api/rooms",
    {
      method: "POST",
      cookie: opening.cookie,
      body: JSON.stringify({
        name: `Smoke market leans ${suffix}`,
        isPublic: false,
        mode: GAMBIT,
        unlock: LEDGER_PHRASE,
      }),
    },
  );
  if (opened.status !== 200) {
    throw new Error(
      "No Gambit harbor to carry market leans into, stopping here.",
    );
  }
  const room = opened.body.room.id;
  run.lapRoomIds.push(room);
  const joined = await call("/api/rooms/join", {
    method: "POST",
    cookie: crewmate.cookie,
    body: JSON.stringify({ code: opened.body.room.code }),
  });
  if (joined.status !== 200) {
    throw new Error(
      "The second captain never joined the harbor, stopping here.",
    );
  }

  const crew: Array<{ captain: Captain; socket: Socket }> = [];
  const standing = new Map<Socket, Seat>();
  for (const captain of [opening, crewmate]) {
    const socket = await openAuthedSocket(captain);
    run.sockets.push(socket);
    socket.on("phase:ready_update", (payload: ReadyFrame) => {
      if (payload?.roomId !== room || !payload.round) return;
      standing.set(socket, {
        round: payload.round,
        phase: (payload.phase ?? "harbor") as Phase,
      });
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
  const at = (step: Seat) =>
    crew.every((seat) => {
      const held = standing.get(seat.socket);
      return held?.round === step.round && held?.phase === step.phase;
    });
  const stand = async (step: Seat): Promise<boolean> => {
    for (let waited = 0; waited < 15000; waited += 50) {
      if (at(step)) return true;
      if (waited % 500 === 0) for (const seat of crew) report(seat, step);
      await sleep(50);
    }
    return at(step);
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
      await sleep(100);
    }
    return read();
  };

  // Dawn is the seat whose departure opens the market, so this is the frame
  // the rest of the table priced its board from.
  const stoodAtDawn = await stand({ round: 1, phase: "dawn" });
  if (!stoodAtDawn) {
    throw new Error("The crew never stood at Dawn, stopping here.");
  }
  const advanceSeen = waitForEvent<AdvanceFrame>(
    crew[0].socket,
    "phase:advance",
    (payload) =>
      payload?.roomId === room &&
      payload.round === 1 &&
      payload.phase === "dawn",
    15000,
  );
  ready({ round: 1, phase: "dawn" });
  const advance = await advanceSeen;
  check(
    advance !== null &&
      advance.harborPulse !== undefined &&
      advance.portShift !== undefined &&
      advance.bazaarLean !== undefined,
    "the advance out of Dawn carries the harbor pulse, the port shift and the bazaar lean, so there is a set of numbers for a late captain's frame to match",
  );

  const stoodAtMarket = await stand({ round: 1, phase: "market" });
  if (!stoodAtMarket) {
    throw new Error("The crew never stood at the Market, stopping here.");
  }

  // The ask a client makes when it has no advance to work from. The answer is
  // the frame its catch-up transition runs on.
  const asked = waitForEvent<ReadyFrame>(
    crew[0].socket,
    "phase:ready_update",
    (payload) =>
      payload?.roomId === room &&
      payload.round === 1 &&
      payload.phase === "market",
    8000,
  );
  crew[0].socket.emit("phase:state:request", { roomId: room });
  const late = await asked;
  check(
    advance !== null &&
      late !== null &&
      late.marketLeans !== undefined &&
      same(late.marketLeans.harborPulse, advance.harborPulse) &&
      same(late.marketLeans.portShift, advance.portShift) &&
      same(late.marketLeans.bazaarLean, advance.bazaarLean),
    "the ready frame a captain reads at the Market carries the same three leans the advance did, so a client that missed the announcement draws the board the rest of the table is shopping at",
  );

  // Leave the Market and ask again. The checkpoint may still remember the
  // leans, but the frame must not hand them out on a seat that draws no
  // board, or a catch-up somewhere else would price from the last market.
  ready({ round: 1, phase: "market" });
  report(crew[0], { round: 1, phase: "orders" });
  const leftMarket = await settled(
    () => standing.get(crew[0].socket)?.phase === "orders",
    8000,
  );
  if (!leftMarket) {
    throw new Error("The harbor never left the Market, stopping here.");
  }
  const after = waitForEvent<ReadyFrame>(
    crew[0].socket,
    "phase:ready_update",
    (payload) =>
      payload?.roomId === room &&
      payload.round === 1 &&
      payload.phase === "orders",
    8000,
  );
  crew[0].socket.emit("phase:state:request", { roomId: room });
  const later = await after;
  check(
    later !== null && later.marketLeans === undefined,
    "and the same request past the Market comes back without leans, so the numbers a market opened under cannot be handed to a seat that draws no board",
  );
}
