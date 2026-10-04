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
  isGatedPhase,
  lapSuccessor,
  openingPhase,
} from "@/lib/game/checkpoint";
import { normalizePhase, phaseFace, seatOf } from "@/lib/game/phases";
import { modeConfig, normalizeMode } from "@/lib/game/mode";
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
    select: { currentRound: true, currentPhase: true, mode: true },
  });
  cp = {
    round: room?.currentRound ?? 1,
    phase: normalizePhase(room?.currentPhase),
    // Normalized rather than trusted, on the same terms as the phase above
    // and for the same reason: this is a column read straight out of the
    // database, and a row written before the mode existed holds nothing at
    // all. The founding mode is what a missing one reads as.
    mode: normalizeMode(room?.mode),
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

// The checkpoint a captain's frame belongs to, or null where the room is
// not on the round that frame names. The room's three vote handlers open
// this way (the audit's vote, the maroon's, and the marooned captain's own
// port shift), and they opened it by hand until this existed: three copies
// of one two clause gate is three chances to write the phase half without
// the round half, which is the hole a stale round reaches the room through.
//
// The round is read against the checkpoint rather than trusted from the
// payload, so a frame that names a round the room has already left is
// refused. Null rather than a thrown refusal, because every caller answers
// a frame from the wrong round with the same silence: it is not the room's
// business that somebody is a round behind.
export async function parleyCheckpoint(
  roomId: string,
  round: unknown,
): Promise<Checkpoint | null> {
  const cp = await getCheckpoint(roomId);
  if (cp.phase !== "parley" || cp.round !== round) return null;
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

// The captains a seat's ready check actually waits on: the room's active
// roster, narrowed to the captains whose own screen is at a seat the ready
// check gates.
//
// The two rosters are two questions and were one function until this
// existed. activeRosterSet asks who is still in the voyage, which is what
// the maroon mark and the audit's majority are counted against, and its
// answer is a fact about people. This asks who the room has to hear from
// before it can move, which is a fact about the seat, and it is the roster
// the vote in maybeAdvance is counted against and the one the bar's
// denominator is drawn from so the two never disagree.
//
// A captain inside the shipyard's draft or swap screens is waited on, and
// the seat their screen folds to is what says so: the phase registry places
// those screens inside Dusk (see seatOf in @/lib/game/phases), so the
// question below is asked of the seat a screen is a screen inside rather
// than of the screen's own name. Reading the raw name was the field report:
// it dropped the draft captain from the roster, so the moment every
// remaining captain had voted the room announced the departure, and the
// draft captain's own client, which folds its seat the same way in every
// guard it has, followed the announcement out of a screen they were still
// using (autoCommit cancels the draft and leaves Dusk). The two screens draw
// the room's own bar now, so the captain the table is waiting on can see the
// wait and its countdown, and a captain who never comes back is moved by the
// clock like any other, whose fire counts the active roster and never this
// one (see forceAdvance).
//
// A member with no status frame yet is waited on rather than skipped, which
// is the one case not read off a seat: a captain who has just joined has no
// seat to read, and the frame that places them lands within a heartbeat of
// their socket. Waiting for them is what the room did before this existed
// and is the safe direction to be wrong in, where skipping a captain who is
// standing at the seat but has not been heard from is not.
//
// Not exported: the two readers are the two places a seat's vote is counted,
// both of them here, and a third reader outside this module would be a
// second answer to who a seat waits on. activeRosterSet above is exported
// because the audit genuinely reads it; this one has no such reader.
async function waitingRosterSet(roomId: string): Promise<Set<string>> {
  const statuses = roomStatuses.get(roomId);
  const memberIds = await roomMemberIds(roomId);
  const cp = await getCheckpoint(roomId);
  const out = new Set<string>();
  for (const id of memberIds) {
    const ph = statuses?.get(id)?.phase;
    // Folded to the seat the screen stands inside before the lap is asked,
    // so the draft and the swap wait like the Dusk seat they are drawn on
    // top of, and a terminal (which folds to itself) is still excluded by
    // the same read.
    if (ph === undefined || isGatedPhase(cp.mode, seatOf(ph))) out.add(id);
  }
  return out;
}

// Builds the payload for phase:ready_update. readyUserIds is filtered
// against the waiting roster so the bar's fraction can never read past its
// own denominator, and so a vote from a captain the seat is no longer
// waiting on (they opened the draft, or they went bankrupt) leaves the
// payload with the roster that no longer wants it.
//
// The room's mode rides along for the reason the round and the phase do: it
// is one of the three things a captain has to be reading the room's way for
// a position to mean anything. A rank is an index inside one mode's lap
// order, so a client comparing its own seat against this frame's seat is
// only comparing like with like while its own mode is the room's. The client
// adopts it on arrival (see use-phase-sync), which is the authority rule the
// load path already applies to a save. No event changes a room's mode after
// creation, so in a healthy room this field never differs from what the
// client already holds; carrying it is what makes that a checked assumption
// rather than an assumed one.
//
// [B2: hard timers, the server as timekeeper] The clock rides along, in the
// two numbers a countdown is drawn from: the moment this seat runs out and
// how long the seat was given. Both are null on a seat with no clock, which
// is the same shape the phase field has, a value or the absence of one,
// rather than a zero a client would draw as a countdown that ran out before
// it started.
export async function readyStatePayload(roomId: string, cp: Checkpoint) {
  const roster = Array.from(await waitingRosterSet(roomId));
  return {
    roomId,
    round: cp.round,
    phase: cp.phase,
    mode: cp.mode,
    phaseEndsAt: cp.endsAt,
    phaseSeconds: phaseBudgetSeconds(cp.phase, cp.mode),
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

// One seat's announcement, held to its promise: whatever the work below
// does, a room that took the advance lock is never left holding it in
// silence.
//
// Both announcers take the lock, then do fallible work before the frame is
// out (a room row read for the pulse, the shift and the lean, the clock's
// own telemetry and log lines, and the emit itself). A throw anywhere in
// that window used to leave the room with advancing set and no watch armed,
// and that state has no cure at all: reportNeverArrived can only fire from
// the timer, the timer is armed at the end of the work that threw, so no
// cure was ever coming. Every later ready vote found the lock already taken
// and returned, so no press could help, and the room's bar sat at a full
// ready set while nothing moved. No captain can see the lock and no frame
// clears it, which is why the table was dead with every screen on it
// showing that everyone was ready.
//
// The invariant that closes it: a room whose checkpoint is advancing has a
// watch armed for the seat it is leaving. Armed here, before any of that
// work, and the failure path hands the seat back through the cure an
// unanswered announcement already takes, so the state above is not
// reachable rather than merely unlikely.
//
// The frame may or may not have reached the room when this catches, since
// the emit is one of the steps inside it, and both readings give a captain
// the same instruction: the ready check is open again, press when you are
// done here. That is the same sentence, from the same function, that a
// dropped report produces, which is why it is the repair here rather than a
// second message saying almost the same thing.
async function announceGuarded(
  io: Server,
  roomId: string,
  from: { round: number; phase: Phase },
  build: () => Promise<void>,
): Promise<void> {
  watchForReports(io, roomId, from);
  try {
    await build();
  } catch (err) {
    console.error("[realtime] the advance announcement failed to go out:", err);
    // Read live rather than handed the checkpoint, because the repair only
    // releases a lock on a room still standing at the seat this named: a
    // report that arrived from a captain who raced ahead has already moved
    // the checkpoint and cleared the lock, and that room is sailing.
    // reportNeverArrived reads the map and decides that for itself.
    await reportNeverArrived(io, roomId, from);
  }
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
// Reached only through announceGuarded, which is what arms the watch this
// frame's report is owed and repairs the lock if the work below throws. The
// body is handed to it as the work rather than arming its own watch because
// the promise the room makes has to be guarded from the moment it is made,
// and the frame is the last thing built rather than the first.
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
    bazaarLean = bazaarRumorsOn(room?.mode)
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

// ---
//
// The report an announcement is owed.
//
// A seat moves when a client reports the seat it moved to, so an announcement
// is a promise the room has made and the reports are what keep it. Every
// client that hears the frame runs the transition it was holding and reports
// the seat it landed on, and the first report naming somewhere further along
// moves the checkpoint (see advanceCheckpointFromReport in
// ./wiring/status-heartbeat).
//
// That promise can go unpaid, and this is the half of the protocol that says
// what happens when it does. Three ways it happens in the field, and one shape
// covers all three: a report that never leaves a captain's browser (a dropped
// frame, a tab that was asleep, a connection that died between the announce
// and the answer), a departure that does not move the seat it is run from (a
// client one build out of date, or an engine seat that returns without
// handing off), and a room where every captain's client is simply slower than
// the table's patience. In all three the room holds a full ready set, every
// captain's screen says the table is ready, and nothing moves: every later
// ready vote finds the lock already taken and returns, so no amount of
// pressing ready can free it.
//
// The client's own heartbeat is the first cure and it is not enough. It
// re-sends a captain's status every eight seconds, which lands a report that
// never left, and that is why the grace below is longer than one heartbeat
// rather than shorter: an honest but slow client gets its own retry in before
// the room decides anything. What the heartbeat cannot do is anything about a
// captain whose client is standing where it already was, which is exactly the
// state a dead departure leaves behind, and no client can see the room's lock
// to clear it. So the room clears its own.
//
// The deadline is not a second clock. The clock is a seat's budget, authored
// per phase and switched on per table, and its expiry is a move: it announces
// the advance itself and commits every captain who was holding nothing. This
// is the other thing entirely, an answer to an announcement the room already
// made, and what it does is hand the seat back to the table: the lock is
// cleared, the room is told, and the ready check is open again for a vote the
// captains can actually keep. Nothing about the seat's own rules is decided
// here, and a room whose report lands in time never sees any of it.
const ADVANCE_REPORT_GRACE_MS = 12000;

const advanceWatches = new Map<string, NodeJS.Timeout>();

function watchForReports(
  io: Server,
  roomId: string,
  from: { round: number; phase: Phase },
): void {
  clearAdvanceWatch(roomId);
  const timer = setTimeout(() => {
    void reportNeverArrived(io, roomId, from);
  }, ADVANCE_REPORT_GRACE_MS);
  // Like the clock's, this must never be the reason a process stays up.
  timer.unref();
  advanceWatches.set(roomId, timer);
}

// The announcement's report never came, so the seat goes back to the table.
//
// The lock is what is cleared and the ready set is not, and the difference is
// the point: those votes were honest, and throwing them away would make every
// captain vote again for something they already said. What they were votes for
// was an announcement that drew no move, so clearing the lock is what lets the
// next vote announce it again.
async function reportNeverArrived(
  io: Server,
  roomId: string,
  from: { round: number; phase: Phase },
): Promise<void> {
  advanceWatches.delete(roomId);
  const cp = roomCheckpoints.get(roomId);
  if (!cp) return;
  // A report landed and the room is somewhere else now, so this watch is
  // stale rather than unheeded. It is the ordinary case: every healthy
  // announcement is followed by its report well inside the grace, and the
  // watch is cleared by that report; a timer that survives to here with the
  // lock already down is a leak rather than a stall, so it leaves quietly.
  if (!cp.advancing) return;
  if (cp.round !== from.round || cp.phase !== from.phase) return;
  // A harbor nobody is sitting in is an empty room rather than a table
  // waiting on a straggler, which is the same rule the clock's fire applies
  // and for the same reason: nothing moves an empty room, and the next
  // captain to walk in is served by the status handler arming a fresh seat.
  if (roomMembers(roomId).length === 0) return;
  cp.advancing = false;
  // Nothing is recorded here, and the two records that could have taken this
  // are why. The spine's leg_timed_out is a phase length being read against
  // how many captains were still working when the clock ran out, and a report
  // that never arrived would be counted into exactly that tuning number as if
  // the seat were too short. The log's line for it says the tide ran out,
  // which is a sentence a captain reads and would be a false one. The room is
  // told below, which is what a captain needs; the record is left to the
  // voyages that actually did something.
  io.to(`room:${roomId}`).emit("room:system", {
    roomId,
    content:
      "The harbor did not hear that leg move, so the ready check is open again. Press ready when you are done here and the voyage will carry on.",
  });
  await broadcastReadyState(io, roomId, cp);
}

// Once every captain the seat is waiting on has signaled ready for the
// checkpoint they're all sitting at, tell the room to go. advancing guards
// against firing twice while everyone's clients are still catching up to
// the new phase.
export async function maybeAdvance(io: Server, roomId: string): Promise<void> {
  const cp = await getCheckpoint(roomId);
  if (cp.advancing) return;
  const roster = await waitingRosterSet(roomId);
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
  await announceGuarded(io, roomId, from, () =>
    announceAdvance(io, roomId, from),
  );
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
  // Taken before the first await below, which is the whole point of it: the
  // fire cleared this flag a moment ago (see firePhaseClock), and a ready
  // vote arriving in the window between those two lines would otherwise
  // announce this same seat first.
  cp.advancing = true;
  const from = { round: cp.round, phase: cp.phase };
  // The clock's accounting and its two lines sit inside the same guard as
  // the frame itself. Every one of them is work that can throw with the lock
  // held, and announceGuarded is what makes the lock survivable rather than
  // a stall.
  await announceGuarded(io, roomId, from, async () => {
    // The spine's roster is the active one rather than the waiting one, and
    // the difference is the question this number answers: leg_timed_out is
    // read to tune a phase's budget, and a captain who spent the seat inside
    // the yard's own draft was doing the work of that seat, so a full clock
    // over them is exactly the reading that says the seat was too short.
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
  });
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
// the phases that are not steps of the leg, a room whose mode keeps no clock,
// and every seat on a server with the clock switched off.
//
// The mode is read first and it is the outer question, because it is the
// one that cannot be answered by an operator: a mode whose lap is walked by
// hand has no clock whatever the environment says, and PHASE_CLOCK is left
// to mean only what it always meant on a mode that has one (see phaseClock
// on the mode record).
//
// One second is the floor, and it is there for a scale small enough to round
// a budget away: a clock that fires on the next tick is not a shorter phase,
// it is no phase, and a table that asked for shorter legs did not ask for
// that. Switching the clock off entirely is what zero is for, and it is read
// before the arithmetic rather than after it.
function phaseBudgetSeconds(phase: Phase, mode: unknown): number | null {
  if (!modeConfig(mode).phaseClock) return null;
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
  const seconds = phaseBudgetSeconds(cp.phase, cp.mode);
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

/**
 * Stops the room's watch on an announcement's report, if one is armed.
 *
 * Reached by every path that ends the promise the announcement made: the
 * report that lands it, a voyage starting over, and a room being torn down.
 * It is exported because two of those three live outside this module, and it
 * is called rather than left to the timer's own guards so the map holds only
 * rooms that are actually waiting on a report.
 */
export function clearAdvanceWatch(roomId: string): void {
  const armed = advanceWatches.get(roomId);
  if (armed !== undefined) {
    clearTimeout(armed);
    advanceWatches.delete(roomId);
  }
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
