// Realtime layer: the synchronized phase/round ready check and the harbor's
// phase clock.
//
// The server runs no game rules. It holds the checkpoint every captain is
// expected to be at, counts ready votes against it, and announces the
// advance; each client runs the same deterministic transition for its own
// seat. A clock expiry announces the same advance, and captains who never
// acted commit the phase's defaults on their clients.
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
import { tFor } from "@/lib/game/i18n";
import { computeHarborPulse } from "@/lib/game/harborPulse";
import { bazaarRumorsOn } from "@/lib/game/flags";
import { rumorLean } from "@/lib/game/engine";
import type { PortShift } from "@/lib/game/maroon";
import { unlockedResources } from "@/lib/game/pools";
import type { Phase } from "@/lib/game/types";
import { leftTheVoyage } from "@/lib/seatMarks";
import type { Checkpoint } from "./types";
import type {
  PhaseAdvanceFrame,
  PhaseReadyFrame,
} from "@/types/realtime/phase";
import { bazaarList, broadcastBazaar } from "./bazaar";
import { roomChannel } from "./channel";
import { portShiftFor } from "./maroon";
import { broadcastRoomSystem, roomMembers } from "./presence";
import { roomStatuses } from "./status";
import { noteTelemetry } from "./telemetry";
import { noteVoyageLog } from "./voyage-log";
import { roomPulseTallies } from "./pulse";

export { checkpointRank, openingPhase };

export const roomCheckpoints = new Map<string, Checkpoint>();

// Reads the checkpoint from cache, hydrating it from the harbor's
// currentRound/currentPhase columns on a miss. The stored phase goes through
// normalizePhase because a room row can hold an older value; hydrating it
// verbatim would leave a checkpoint no lap contains, every rank read null,
// and the harbor permanently stuck.
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
    mode: normalizeMode(room?.mode),
    readyUserIds: new Set(),
    advancing: false,
    yardHeld: false,
    // No deadline on hydration: the room row stores a seat, not a moment, so
    // a restarted process starts the seat's clock over at the first report.
    endsAt: null,
  };
  roomCheckpoints.set(roomId, cp);
  return cp;
}

// The checkpoint a captain's frame belongs to, or null when the harbor is
// not on the frame's round. The round is checked against the checkpoint
// rather than trusted from the payload, so a stale frame is refused. Null
// because every caller treats a wrong-round frame as silence.
export async function parleyCheckpoint(
  roomId: string,
  round: unknown,
): Promise<Checkpoint | null> {
  const cp = await getCheckpoint(roomId);
  if (cp.phase !== "parley" || cp.round !== round) return null;
  return cp;
}

// Harbor members still in the voyage: membership minus anyone bankrupt or at
// the endgame screen. Based on durable membership rather than live sockets,
// so a slow-loading captain still counts. leftTheVoyage reads the phase, not
// seat marks, so a written-off Ocean Gambit seat keeps its place at the
// table. Exported because the Manifest Audit and the maroon vote count
// against this roster.
export async function activeRosterSet(roomId: string): Promise<Set<string>> {
  const statuses = roomStatuses.get(roomId);
  const memberIds = await roomMemberIds(roomId);
  const out = new Set<string>();
  for (const id of memberIds) {
    if (!leftTheVoyage(statuses?.get(id))) out.add(id);
  }
  return out;
}

// The captains a seat's ready check waits on: the active roster narrowed to
// screens standing at a gated seat. This is a different question from
// activeRosterSet (who is still in the voyage); it decides who the harbor
// must hear from before moving, and both the vote and the progress bar use
// it so they cannot disagree.
//
// Screens fold through seatOf, so a captain in the shipyard draft or swap
// counts as being at Dusk and is waited on. Reading the raw screen name
// would drop them, and their client would then be carried out of a screen
// they are still using. A member with no status frame yet is also waited
// on; a newly joined captain has no seat to read.
async function waitingRosterSet(roomId: string): Promise<Set<string>> {
  const statuses = roomStatuses.get(roomId);
  const memberIds = await roomMemberIds(roomId);
  const cp = await getCheckpoint(roomId);
  const out = new Set<string>();
  for (const id of memberIds) {
    const ph = statuses?.get(id)?.phase;
    if (ph === undefined || isGatedPhase(cp.mode, seatOf(ph))) out.add(id);
  }
  return out;
}

// Payload for phase:ready_update. readyUserIds is filtered against the
// waiting roster so the bar can never exceed its denominator and votes from
// captains no longer waited on disappear.
//
// mode rides along because a rank only means something within one mode's
// lap order; the client adopts it on arrival. phaseEndsAt and phaseSeconds
// are null on a seat with no clock rather than zero, which would draw as a
// countdown that already expired.
export async function readyStatePayload(
  roomId: string,
  cp: Checkpoint,
): Promise<PhaseReadyFrame> {
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
  io.to(roomChannel(roomId)).emit(
    "phase:ready_update",
    await readyStatePayload(roomId, cp),
  );
}

// Runs an advance announcement under the watch that repays it. Both
// announcers take the advancing lock and then do fallible work (room read,
// pulse, shift, telemetry, emit) before the frame leaves. A throw there
// would leave advancing set with no watch armed, and nothing could clear it:
// later ready votes returned early, so the table was stuck with every screen
// saying ready. The watch is armed before that work, and the catch path hands
// the seat back through reportNeverArrived.
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
    // Read live: the repair only releases a lock on a harbor still standing
    // at this seat, and a report that raced ahead has already moved it.
    await reportNeverArrived(io, roomId, from);
  }
}

// Announces the transition out of one seat: the shared emit every client's
// transition hangs off. Shared by the ready vote, the clock expiry and the
// draft settle, so the frame cannot depend on which ending fired. Reachable
// only through announceGuarded.
//
// When the next seat is the market, the frame also carries the harbor pulse
// (the previous round's purchases), the Harbormaster's port shift and the
// bazaar lean. All three must land before genResourceCard runs, which is why
// they ride this frame instead of a later round trip. portShift null clears
// the previous round's shift; bazaarLean undefined means no lean on this
// advance.
async function announceAdvance(
  io: Server,
  roomId: string,
  from: { round: number; phase: Phase },
): Promise<void> {
  // The pulse belongs to the advance that opens the market. The lap decides
  // which checkpoint that is, so another mode's route still fires it.
  let harborPulse: Record<string, number> | undefined;
  let portShift: PortShift | null | undefined;
  // undefined and an empty object are different answers: undefined means no
  // bazaar lean on this advance, while an empty object is a bazaar nobody
  // spoke in and must reach clients as a clear.
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
  const frame: PhaseAdvanceFrame = {
    roomId,
    round: from.round,
    phase: from.phase,
    ...(harborPulse ? { harborPulse } : {}),
    ...(portShift !== undefined ? { portShift } : {}),
    ...(bazaarLean !== undefined ? { bazaarLean } : {}),
  };
  io.to(roomChannel(roomId)).emit("phase:advance", frame);
  // The reveal is honest only as the market opens, so it goes now.
  if (bazaarLean !== undefined) {
    broadcastBazaar(io, roomId, from.round);
  }
}

// The report an announcement is owed.
//
// Clients that hear an advance report the seat they landed on, and the first
// report further along moves the checkpoint. Three things leave that promise
// unpaid: a report lost in a sleeping tab, a departure that does not move its
// seat, or clients slower than the table's patience. The client heartbeat
// retries every eight seconds, so the grace below is longer than one
// heartbeat. A heartbeat cannot fix a client already standing where it was,
// so the harbor clears its own lock. This is not the phase clock: no seat
// rules are decided here, the seat simply goes back to the table, and a
// report that lands in time never sees any of it.
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
  // Never keep the process alive.
  timer.unref();
  advanceWatches.set(roomId, timer);
}

// The seat's report never came, so the lock is cleared and the ready set is
// kept: those votes were honest, and clearing the lock lets the next vote
// announce the same transition again.
async function reportNeverArrived(
  io: Server,
  roomId: string,
  from: { round: number; phase: Phase },
): Promise<void> {
  advanceWatches.delete(roomId);
  const cp = roomCheckpoints.get(roomId);
  if (!cp) return;
  // The report landed and the harbor moved; this watch is stale. Healthy
  // announcements clear their watch well inside the grace.
  if (!cp.advancing) return;
  if (cp.round !== from.round || cp.phase !== from.phase) return;
  // Nothing moves an empty harbor; the next captain in is served by the
  // status handler arming a fresh clock.
  if (roomMembers(roomId).length === 0) return;
  // A draft seat owes no ready vote, so reopening the check is the wrong
  // repair here. Re-send the announcement plainly: clients that missed it
  // are still at the seat, and clients that got it ignore the stale frame by
  // rank. Calling announceDraftComplete would re-arm this same guard.
  if (cp.phase === "path_draft") {
    cp.advancing = false;
    await announceAdvance(io, roomId, from);
    return;
  }
  cp.advancing = false;
  // No telemetry or log line here: round_timed_out would misread this as a
  // phase that was too short, and "the tide ran out" would be false. The
  // harbor is told below, per captain, in their own language.
  broadcastRoomSystem(io, roomId, (locale) =>
    tFor(
      locale,
      "The harbor did not hear that round move, so the ready check is open again. Press ready when you are done here and the voyage will carry on.",
    ),
  );
  await broadcastReadyState(io, roomId, cp);
}

// Announces the move once every captain the seat waits on is ready.
// advancing prevents a second announcement while clients catch up.
export async function maybeAdvance(io: Server, roomId: string): Promise<void> {
  const cp = await getCheckpoint(roomId);
  if (cp.advancing) return;
  const roster = await waitingRosterSet(roomId);
  if (roster.size === 0) return;
  // Re-read the flag. The roster read above awaits a database call, so two
  // ready votes can both pass the first check; reading and setting with no
  // await between them makes the lock effective.
  if (cp.advancing) return;
  // A path draft leaves only through the settle. A vote that reaches here
  // anyway (a doctored client or a race) must not walk the table out of an
  // unsettled deal. The settle bypasses this function.
  if (cp.phase === "path_draft") return;
  for (const id of roster) {
    if (!cp.readyUserIds.has(id)) return;
  }
  cp.advancing = true;
  // Capture the seat being left before the announce awaits: a fast report
  // could otherwise move the checkpoint under the frame.
  const from = { round: cp.round, phase: cp.phase };
  await announceGuarded(io, roomId, from, () =>
    announceAdvance(io, roomId, from),
  );
}

// The clock's advance, announced like a unanimous ready set without the
// unanimity. Clients see the same frame and run the same rank guard;
// captains holding nothing commit the phase defaults through autoCommit.
// The tally is recorded before the frame so it measures the round that just
// ended. Whether to announce at all is the caller's decision.
async function forceAdvance(
  io: Server,
  roomId: string,
  cp: Checkpoint,
): Promise<void> {
  // Set before the first await so a ready vote in this window cannot
  // announce the same seat first.
  cp.advancing = true;
  const from = { round: cp.round, phase: cp.phase };
  // The clock's telemetry and log lines sit inside the guard too: they can
  // throw with the lock held.
  await announceGuarded(io, roomId, from, async () => {
    // Timed-out rounds are tuned against the active roster: a captain working
    // inside the yard's draft was still doing that seat's work.
    const roster = await activeRosterSet(roomId);
    const ready = Array.from(cp.readyUserIds).filter((id) =>
      roster.has(id),
    ).length;
    noteTelemetry(roomId, "round_timed_out", { ready, required: roster.size });
    // The log line names the seat and is written before the announcement, so
    // the reason precedes the move.
    noteVoyageLog(io, roomId, { kind: "round_timed_out", phase: cp.phase });
    // The harbor moved without a full ready set, so it owes the remaining
    // captains an explanation, each in their own language.
    broadcastRoomSystem(io, roomId, (locale) =>
      tFor(
        locale,
        "The tide has run out for this round, and the harbor moves on. Any captain who had not finished commits the phase's own defaults.",
      ),
    );
    await announceAdvance(io, roomId, from);
  });
}

// The draft's advance: leaves the draft seat once the deal has settled,
// with no ready vote and no telemetry (per-captain records were filed as
// paths settled). reportNeverArrived repairs a missed frame by re-sending
// the announcement, since this seat has no ready button.
export async function announceDraftComplete(
  io: Server,
  roomId: string,
): Promise<void> {
  const cp = roomCheckpoints.get(roomId);
  if (!cp) return;
  // The settle can race a restart or teardown, so confirm the seat and lock.
  if (cp.phase !== "path_draft" || cp.advancing) return;
  cp.advancing = true;
  const from = { round: cp.round, phase: cp.phase };
  await announceGuarded(io, roomId, from, () =>
    announceAdvance(io, roomId, from),
  );
}

// The harbor's clock timers. endsAt on the checkpoint is what clients see;
// this map holds the server side. An entry exists only while a clock runs
// and always matches the deadline the checkpoint publishes.
const phaseClocks = new Map<string, NodeJS.Timeout>();

// Config is validated at boot, so the cached scale cannot fail at runtime;
// caching keeps a zod parse off every round.
let cachedClockScale: number | null = null;
function clockScale(): number {
  if (cachedClockScale === null) {
    cachedClockScale = loadServerConfig().phaseClockScale;
  }
  return cachedClockScale;
}

// Budget in whole seconds for the seat: authored phase seconds scaled by
// PHASE_CLOCK, or null when the seat has no clock (the pier, phases that are
// not round steps, a mode without a clock, or the clock switched off). Mode is
// checked first because a hand-walked lap has no clock regardless of the
// environment. The floor of one second prevents a small scale from rounding
// a phase away; a scale of zero disables the clock entirely.
function phaseBudgetSeconds(phase: Phase, mode: unknown): number | null {
  if (!modeConfig(mode).phaseClock) return null;
  const authored = phaseFace(phase).seconds;
  if (authored === null) return null;
  const scale = clockScale();
  if (scale <= 0) return null;
  return Math.max(1, Math.round(authored * scale));
}

// Removes and clears a timer in one place; forgetting the delete would leak
// the harbor's slot for the life of the process.
export function disarmTimer(
  timers: Map<string, NodeJS.Timeout>,
  roomId: string,
): void {
  const armed = timers.get(roomId);
  if (armed !== undefined) {
    clearTimeout(armed);
    timers.delete(roomId);
  }
}

function clearPhaseTimer(roomId: string): void {
  disarmTimer(phaseClocks, roomId);
}

// Arms the clock for the checkpoint's current seat, replacing any previous
// timer. Called when a seat begins and when a report moves the checkpoint.
// A seat without a budget disarms instead, leaving the harbor on manual
// advance.
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
  // Never keep the process alive for a harbor deadline.
  timer.unref();
  phaseClocks.set(roomId, timer);
}

// Stops the clock and clears endsAt. Reached when a budget expires, when a
// harbor empties, and when a voyage is wiped. The next status report that
// moves the checkpoint arms a new clock.
export function disarmPhaseClock(roomId: string): void {
  clearPhaseTimer(roomId);
  const cp = roomCheckpoints.get(roomId);
  if (cp) cp.endsAt = null;
}

// Stops the watch on an announcement's report. Called when the report
// lands, when a voyage restarts, and when a harbor is torn down.
export function clearAdvanceWatch(roomId: string): void {
  disarmTimer(advanceWatches, roomId);
}

// Whether any live captain is in the module draft or swap screens. Firing
// through would cancel the draft under them, so the clock holds once.
function yardOccupied(roomId: string): boolean {
  const statuses = roomStatuses.get(roomId);
  if (!statuses) return false;
  return roomMembers(roomId).some((m) => {
    const phase = statuses.get(m.id)?.phase;
    return phase === "module_draft" || phase === "module_swap";
  });
}

// One seat's budget expired. The checkpoint is read from the map rather than
// hydrated: a timer must not recreate a checkpoint for a torn-down harbor.
// The announcement does not move the checkpoint; reports do. The seat is
// timed once, so without a report the harbor stays on manual advance.
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
  // A captain in the module draft is at Dusk and still owes a pick, so
  // moving the harbor would cancel the draft under them. Spend the single
  // hold instead: extend one budget and tell the harbor. The next fire
  // advances regardless.
  if (!cp.yardHeld && yardOccupied(roomId)) {
    cp.yardHeld = true;
    armPhaseClock(io, roomId, cp);
    await broadcastReadyState(io, roomId, cp);
    return;
  }
  // This fire is the previous announcement having drawn no report, so allow
  // the seat to be announced again.
  cp.advancing = false;
  await forceAdvance(io, roomId, cp);
}
