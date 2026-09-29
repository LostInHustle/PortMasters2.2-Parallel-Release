// =====================================================================
// Realtime layer: the synchronized phase/round ready check.
//
// The room's shared checkpoint: the round + phase every captain is
// expected to be at. This server never runs game rules, it only counts
// who has said ready for the checkpoint it already knows about and
// tells the room to go once everyone active has. Each client
// independently runs its own (identical, deterministic) transition
// when it gets the go, which is how they all land on the same next
// phase without this server needing to know what that phase is.
//
// checkpointRank and openingPhase are the shared helpers from
// ./game/checkpoint, forwarded so this module stays the single place
// server code reads anything about a checkpoint from, and lapSuccessor
// is read here directly to find the step that opens the port market.
// All three are a boundary, not a copy: the lap they read lives with the
// mode (see @/lib/game/mode), so there is nothing here that a change to
// that lap could leave stale.
//
// [B2: hard timers, the server as timekeeper] This module also owns the
// room's clock. A phase is a segment of real time, and a table where a
// captain has closed a laptop must not be held hostage by one: every seat
// of the leg carries a budget (PHASE_FACES.seconds in @/lib/game/phases),
// the room's checkpoint holds the moment that budget runs out, and the
// expiry announces the same advance a unanimous ready set announces,
// through the same emit. Nothing here runs game rules, on the clock's path
// or on any other: the server moves the room's own seat and each client
// runs its deterministic transition, exactly as it does for a vote. The
// one difference is that a captain who has not acted commits the phase's
// defaults instead of their own choice, which is the auto commit in the
// engine's lifecycle.
// =====================================================================
import type { Server } from "socket.io";
import { db } from "@/lib/db";
import { loadServerConfig } from "@/lib/config";
import { roomMemberIds } from "@/lib/rooms";
import {
  checkpointRank,
  lapSuccessor,
  openingPhase,
} from "@/lib/game/checkpoint";
import { normalizePhase, phaseFace } from "@/lib/game/phases";
import { computeHarborPulse } from "@/lib/game/harborPulse";
import { bazaarRumorsOn } from "@/lib/game/flags";
import { rumorLean } from "@/lib/game/engine";
import type { PortShift } from "@/lib/game/maroon";
import { unlockedResources } from "@/lib/game/pools";
import type { Phase } from "@/lib/game/types";
import type { Checkpoint } from "./types";
import { bazaarList, broadcastBazaar } from "./bazaar";
import { portShiftFor } from "./maroon";
import { roomMembers } from "./presence";
import { roomStatuses } from "./status";
import { noteTelemetry } from "./telemetry";
import { noteVoyageLog } from "./voyage-log";
import { roomPulseTallies } from "./pulse";

export { checkpointRank, openingPhase };

export const roomCheckpoints = new Map<string, Checkpoint>();

// Reads the checkpoint from the cache, or hydrates it from the room's
// currentRound/currentPhase columns on a cache miss. Persisted back to
// those columns whenever the checkpoint advances, so a process restart
// picks up where it left off.
//
// The stored phase goes through normalizePhase on the way in, for the same
// reason a save does: a room row written before [B1] holds one of the older
// checkpoint values, and a server that hydrated it verbatim would hold a
// checkpoint no lap contains. Every rank read against it would then be null,
// which the reporter below reads as "not a checkpoint", so the room would
// sit at that value and never advance again.
export async function getCheckpoint(roomId: string): Promise<Checkpoint> {
  let cp = roomCheckpoints.get(roomId);
  if (cp) return cp;
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { currentRound: true, currentPhase: true },
  });
  cp = {
    round: room?.currentRound ?? 1,
    phase: normalizePhase(room?.currentPhase),
    readyUserIds: new Set(),
    advancing: false,
    // The one checkpoint with no deadline behind it. The room's row holds a
    // seat, not a moment, so a process that restarts mid leg starts the
    // seat's clock over rather than guessing how much of it was already
    // spent; the game status handler arms one from this same value, which is
    // what puts a restarted server back on the clock at the first report.
    endsAt: null,
  };
  roomCheckpoints.set(roomId, cp);
  return cp;
}

// Every member of the room (straight from the membership table) minus
// anyone with nothing left to ready up for (bankrupt or already at the
// endgame screen). This is also what lets the rest of a room keep
// advancing once a captain goes bankrupt.
//
// Deliberately based on durable room membership, not on who currently
// has a live socket connected. A member who is just slow to load still
// correctly counts as someone the room needs to wait for.
//
// Exported for the one caller that is not an advance: the Manifest
// Audit's majority (see ./audit) is counted against this same roster, so
// the room the audit is put to and the room a phase waits for are the
// same set of captains. A second roster read that meant "who counts"
// would be a second answer to that question.
export async function activeRosterSet(roomId: string): Promise<Set<string>> {
  const statuses = roomStatuses.get(roomId);
  const memberIds = await roomMemberIds(roomId);
  const out = new Set<string>();
  for (const id of memberIds) {
    const ph = statuses?.get(id)?.phase;
    if (ph !== "bankruptcy" && ph !== "endgame") out.add(id);
  }
  return out;
}

// Builds the payload for phase:ready_update. readyUserIds is filtered
// against the active roster so a departed captain's stale vote doesn't
// linger in the broadcast.
//
// [B2: hard timers, the server as timekeeper] The clock rides along, in the
// two numbers a countdown is drawn from: the moment this seat runs out and
// how long the seat was given. Both are null on a seat with no clock, which
// is the same shape the phase field has, a value or the absence of one,
// rather than a zero a client would draw as a countdown that ran out before
// it started.
export async function readyStatePayload(roomId: string, cp: Checkpoint) {
  const roster = Array.from(await activeRosterSet(roomId));
  return {
    roomId,
    round: cp.round,
    phase: cp.phase,
    phaseEndsAt: cp.endsAt,
    phaseSeconds: phaseBudgetSeconds(cp.phase),
    readyUserIds: Array.from(cp.readyUserIds).filter((id) =>
      roster.includes(id),
    ),
    requiredUserIds: roster,
  };
}

export async function broadcastReadyState(
  io: Server,
  roomId: string,
  cp: Checkpoint,
): Promise<void> {
  io.to(`room:${roomId}`).emit(
    "phase:ready_update",
    await readyStatePayload(roomId, cp),
  );
}

// Announces the transition out of one seat of the lap: the room's own row,
// read for the pulse and the shift, and the one emit every client's
// transition hangs off.
//
// Shared by the two ways a seat ends, a unanimous ready set (maybeAdvance)
// and the clock running out (forceAdvance), because the frame a client
// receives must not depend on which of them it was: both name the seat being
// left and carry the same harbor pulse and port shift. A second emit naming
// the same seat would be a second place the room's transitions were
// described, which is the shape [B1] spent its whole refactor undoing.
//
// [MANIFEST 01: The Harbor Pulse] When the room is leaving Dawn (the boon
// draft, about to enter the market), the previous
// round's purchase tallies are folded into a harbor pulse and delivered
// alongside the advance, so every client's genResourceCard leans the
// new round's market toward whatever the harbor actually bought.
//
// [H7: Maroon and the Harbormaster] The Harbormaster's shift rides the
// same broadcast, for the same reason and by the same route: it is a
// per leg hand on the market that is about to be drawn, so it has to land
// before genResourceCard runs rather than as a round trip that could
// arrive after it. It is sent as null on a leg nobody leaned, which is
// what clears last leg's shift; see applyPortShift for why that has to be
// a value rather than an omission.
async function announceAdvance(
  io: Server,
  roomId: string,
  from: { round: number; phase: Phase },
): Promise<void> {
  // The harbor pulse belongs to the step that opens the port market, so
  // it rides along with the advance into it: last round's purchase
  // tallies lean the new round's card draw toward whatever the harbor
  // actually bought. Which checkpoint that is comes from the lap rather
  // than from the phase's name, so the pulse lands at the right moment in
  // a mode that reaches its market another way instead of quietly never
  // firing.
  //
  // The pulse is measured against the raw goods that round has unlocked
  // rather than against a fixed number (see computeHarborPulse). Read
  // only on the advance that opens a market.
  let harborPulse: Record<string, number> | undefined;
  let portShift: PortShift | null | undefined;
  // [D5: Aroma: the Bazaar Rumor] The third hand, computed on the same
  // turn and for the same reason: the bazaar's lean is a rule about the
  // market about to be drawn, so it has to land before genResourceCard
  // runs rather than as a round trip that could arrive after it. It is
  // the only one of the three that is summed from room state rather than
  // read off a record, so the rows are walked here rather than the answer
  // being fetched.
  //
  // `undefined` and an empty object are two different answers on this
  // frame and both are real: undefined is a build with the feature rolled
  // back (or an advance into a seat that is not the market), and an empty
  // object is a bazaar nobody spoke at, which has to reach the clients as
  // a clear rather than as silence (see applyBazaarLean).
  let bazaarLean: Record<string, number> | undefined;
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { difficulty: true, mode: true },
  });
  if (lapSuccessor(room?.mode, from.phase) === "market") {
    harborPulse = computeHarborPulse(
      roomPulseTallies.get(roomId)?.get(from.round - 1),
      unlockedResources(room?.difficulty, from.round),
    );
    portShift = portShiftFor(roomId, from.round);
    bazaarLean = bazaarRumorsOn()
      ? rumorLean(bazaarList(roomId), from.round)
      : undefined;
  }
  io.to(`room:${roomId}`).emit("phase:advance", {
    roomId,
    round: from.round,
    phase: from.phase,
    ...(harborPulse ? { harborPulse } : {}),
    ...(portShift !== undefined ? { portShift } : {}),
    ...(bazaarLean !== undefined ? { bazaarLean } : {}),
  });
  // [D5: Aroma: the Bazaar Rumor] And the reveal, at the one instant it
  // is honest: the market that just opened on every client is the market
  // the standing rumors moved, so this is the leg the directions become
  // public (see publicRumors). Sending the board on a later turn would
  // name a price move after the table had already had to guess at it,
  // which is the opposite of what the plan asks this reveal to do.
  if (bazaarLean !== undefined) {
    broadcastBazaar(io, roomId, from.round);
  }
}

// Once every active member has signaled ready for the checkpoint they're
// all sitting at, tell the room to go. advancing guards against firing
// twice while everyone's clients are still catching up to the new phase.
export async function maybeAdvance(io: Server, roomId: string): Promise<void> {
  const cp = await getCheckpoint(roomId);
  if (cp.advancing) return;
  const roster = await activeRosterSet(roomId);
  if (roster.size === 0) return;
  // Read a second time rather than trusted from the top. The roster read
  // above is a database call, and a database call is somewhere another
  // advance can get in: two ready votes arriving together both find
  // advancing false, both wait on that line, and both go on to announce the
  // same transition. The flag is only worth having if it is read and set
  // with nothing awaited in between, which is what this second read buys.
  // It costs a vote nothing: a full ready set belongs to the transition
  // about to be announced, and it is cleared when the room's checkpoint
  // moves, so a call that returns here is returning on a turn already
  // taken.
  if (cp.advancing) return;
  for (const id of roster) {
    if (!cp.readyUserIds.has(id)) return;
  }
  cp.advancing = true;
  // The checkpoint being left, taken here rather than read inside the
  // announce below. The pulse needs the room's row, and a row read is an
  // await, which is long enough for a report from a captain who raced ahead
  // to move the checkpoint out from under the frame. A transition names the
  // seat the room is leaving, and this is that seat.
  const from = { round: cp.round, phase: cp.phase };
  await announceAdvance(io, roomId, from);
}

// The clock's way of moving a room: the announcement a unanimous ready set
// makes, without the unanimity.
//
// The two are one frame on purpose. Every client already knows how to take an
// advance it did not vote for, through the rank guard in
// src/lib/use-phase-sync.ts, and the only difference is what a captain who
// was holding nothing does with it: the engine's autoCommit, which leaves the
// seat by the seat's own defaults rather than by a choice nobody made.
//
// The tally goes to the spine before the frame goes out, because it reads the
// moment the clock fired: an event queued behind the room's own catch up
// would be measuring the leg after it.
//
// Whether to announce at all is the fire's decision and not this function's,
// which is why the flag is set here and only read elsewhere: a fire that
// already said this seat was over clears it before calling, so a room that
// lost its captains and got one back is told again rather than silenced for
// the rest of the voyage.
async function forceAdvance(
  io: Server,
  roomId: string,
  cp: Checkpoint,
): Promise<void> {
  cp.advancing = true;
  const from = { round: cp.round, phase: cp.phase };
  const roster = await activeRosterSet(roomId);
  const ready = Array.from(cp.readyUserIds).filter((id) =>
    roster.has(id),
  ).length;
  noteTelemetry(roomId, "leg_timed_out", { ready, required: roster.size });
  // [B4: the log surfaces] The fire's own line, for the room's log, and it
  // names the seat the tide ran out on rather than the leg's number: a
  // captain reads the log in order, and the line above it in that order is
  // the anchor line that carried them into this phase. It is written
  // before the announcement below, so the log carries the clock's own
  // reason for the move ahead of the move itself.
  noteVoyageLog(io, roomId, { kind: "leg_timed_out", phase: cp.phase });
  // Said out loud, because a room that moved without a full ready set owes
  // the captains still sitting in it an explanation of why. It is not a
  // chat message from a captain: it is the harbor talking, on the same
  // channel every other harbor announcement uses.
  io.to(`room:${roomId}`).emit("room:system", {
    roomId,
    content:
      "The tide has run out for this leg, and the harbor moves on. Any captain who had not finished commits the phase's own defaults.",
  });
  await announceAdvance(io, roomId, from);
}

// ---
//
// The room's clock.
//
// The checkpoint above carries a deadline as data (endsAt), because that is
// the half the clients are told about; this map holds the mechanism, which is
// the server's own business and never crosses the wire. A room appears in it
// only while a clock is running, and its entry is always the timer for the
// deadline the room's checkpoint is currently publishing, which is what lets
// a fire tell a live timer from a stale one.
const phaseClocks = new Map<string, NodeJS.Timeout>();

// The clock's scale, read once, the way the telemetry accumulator reads its
// sample rate: the whole environment is validated at boot (src/lib/config.ts),
// so this cannot fail in a running process, and caching it keeps a zod parse
// off a path that runs on every leg.
let cachedClockScale: number | null = null;
function clockScale(): number {
  if (cachedClockScale === null) {
    cachedClockScale = loadServerConfig().phaseClockScale;
  }
  return cachedClockScale;
}

// The budget, in whole seconds, of the seat a checkpoint is standing at: the
// phase's own authored seconds (PHASE_FACES in @/lib/game/phases) scaled by
// PHASE_CLOCK. Null when that seat has no clock at all, which is the pier,
// the phases that are not steps of the leg, and every seat on a server with
// the clock switched off.
//
// One second is the floor, and it is there for a scale small enough to round
// a budget away: a clock that fires on the next tick is not a shorter phase,
// it is no phase, and a table that asked for shorter legs did not ask for
// that. Switching the clock off entirely is what zero is for, and it is read
// before the arithmetic rather than after it.
function phaseBudgetSeconds(phase: Phase): number | null {
  const authored = phaseFace(phase).seconds;
  if (authored === null) return null;
  const scale = clockScale();
  if (scale <= 0) return null;
  return Math.max(1, Math.round(authored * scale));
}

function clearPhaseTimer(roomId: string): void {
  const armed = phaseClocks.get(roomId);
  if (armed !== undefined) {
    clearTimeout(armed);
    phaseClocks.delete(roomId);
  }
}

/**
 * Arms the room's clock for the seat its checkpoint is standing at, and
 * clears whatever was armed before: a clock belongs to one seat of one round,
 * so moving the checkpoint replaces it rather than adding to it.
 *
 * Called from the two places a seat begins: the departure that sets the room
 * sailing, and the report that moves the checkpoint. A seat with no budget,
 * or a server with the clock switched off, disarms instead, which is what
 * leaves a room on manual advance.
 */
export function armPhaseClock(
  io: Server,
  roomId: string,
  cp: Checkpoint,
): void {
  const seconds = phaseBudgetSeconds(cp.phase);
  if (seconds === null) {
    disarmPhaseClock(roomId);
    return;
  }
  const endsAt = Date.now() + seconds * 1000;
  cp.endsAt = endsAt;
  clearPhaseTimer(roomId);
  const timer = setTimeout(() => {
    void firePhaseClock(io, roomId, endsAt);
  }, seconds * 1000);
  // A clock must never be the reason a process stays up. Nothing about a
  // room's deadline should hold a shutting down server open, and a running
  // one is held open by its own listener rather than by this.
  timer.unref();
  phaseClocks.set(roomId, timer);
}

/**
 * Stops the room's clock and forgets the deadline, so the room reads as one
 * with no clock running until something arms another.
 *
 * Reached three ways, and all three are the same fact. A seat's budget can
 * run out (see firePhaseClock below), a harbor can empty out (a room nobody
 * is sitting in is not a table waiting on a straggler, it is an empty room,
 * and nothing moves an empty room), and a room can leave the clock's reach
 * entirely, which is the host wiping the voyage and the teardown that empties
 * a room's maps.
 *
 * What starts one again is a report: a captain sending a game status is the
 * one event that always happens when somebody is sitting in a seat, and the
 * handler that reads it arms a fresh budget for the seat the room is standing
 * at (see [B2] in ./index.ts). A room that stopped its clock is therefore not
 * a room that lost its clock.
 */
export function disarmPhaseClock(roomId: string): void {
  clearPhaseTimer(roomId);
  const cp = roomCheckpoints.get(roomId);
  if (cp) cp.endsAt = null;
}

// The clock's fire: one seat's budget ran out.
//
// The checkpoint is read from the map rather than through getCheckpoint,
// because this path must never hydrate one: a timer outlives the room it was
// armed for only through a teardown, and a fire that recreated the checkpoint
// of a room nobody is in would leave a checkpoint behind for a room that no
// longer exists.
//
// The announced advance is an announcement, not a move: the checkpoint moves
// when a client reports the new seat, exactly as it does after a ready vote.
// What this fire does with the deadline is spend it. A seat is timed once, so
// the room is left on manual advance from here, and the reports the announce
// draws are what arm the next seat's clock. A room whose clients never report
// anything is then a room on manual advance rather than a room holding a
// deadline that has passed and a timer that will never fire again, and the
// next sign of life from a captain starts it over.
async function firePhaseClock(
  io: Server,
  roomId: string,
  armedFor: number,
): Promise<void> {
  phaseClocks.delete(roomId);
  const cp = roomCheckpoints.get(roomId);
  if (!cp || cp.endsAt !== armedFor) return;
  disarmPhaseClock(roomId);
  if (roomMembers(roomId).length === 0) return;
  // The announce flag is cleared rather than waited on. It means "an
  // announcement is out", and this fire is that announcement having drawn no
  // report: the next fire of this same seat, if a report ever arms one, has
  // to be allowed to say it again, or the room would hold a flag no report
  // will ever clear and stop announcing altogether.
  cp.advancing = false;
  await forceAdvance(io, roomId, cp);
}
