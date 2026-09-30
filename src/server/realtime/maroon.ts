// =====================================================================
// Realtime layer: the maroon vote, and the Harbormaster's hand.
//
// [H7: Maroon and the Harbormaster] The second thing in this game a
// majority of the room can do to one captain, and the only one that costs
// them anything. The audit opens a manifest; this takes a ship. So the
// rules below are all about what a majority is allowed to take and when.
//
// It may be called once a voyage, from the mode's rung (nine legs, see
// ModeConfig.maroonFrom), during the Parley checkpoint, and only for a
// captain the room still counts. It may not be called against a captain
// the harbor has already written off: a bankrupt captain has lost the
// race already, and handing them the Harbormaster's power would make the
// vote a way to arm an ally rather than a way to punish one. It may not
// be called twice, and the captain it names is not removed from the room,
// which is the point of the mode rather than a mercy (see ./game/seats).
//
// The power that comes with it is the one piece of another captain's
// state a client can move, so it is held here for the leg it was called
// in and delivered by the server on the advance that opens the port
// market, exactly as the Harbor Pulse is (see maybeAdvance in
// ./checkpoint). Nothing about it is priced off the notice that goes out
// when it is called.
//
// Like the audit, this module deliberately knows nothing about phases.
// The vote costs the table nothing and closes nothing: it is called at
// the table, in front of everyone, and the leg goes on. A marooned
// captain readies up for the next checkpoint with everyone else.
// =====================================================================

import {
  MaroonResult,
  MaroonTally,
  PortShiftNotice,
} from "@/types/realtime/maroon";
import type { Server } from "socket.io";
import { db } from "@/lib/db";
import { normalizeDifficulty, type Difficulty } from "@/lib/game/difficulty";
import { maroonCarried, type PortShift } from "@/lib/game/maroon";
import { modeConfig, voyageRoundsFor } from "@/lib/game/mode";
import { unlockedPorts } from "@/lib/game/pools";
import { activeRosterSet } from "./checkpoint";
import { roomStatuses } from "./status";
import { noteCaptainMarooned, noteTelemetry } from "./telemetry";
import { noteVoyageLog } from "./voyage-log";

// One room's maroon, for as long as the voyage lasts. The nominations
// belong to a leg and are replaced when the leg turns, like the audit's.
// The result and the shift do not: the result is the voyage's one vote,
// and the shift is the last call the Harbormaster made, which is read
// once, on the advance that opens the next market.
type RoomMaroon = {
  round: number;
  // voter id -> the captain they nominated, for the leg above.
  votes: Map<string, string>;
  // Set once the vote carries, and never cleared except by a restart. Both
  // the room's record to hand a joiner and the flag that makes this once
  // per voyage.
  result: MaroonResult | null;
  // The most recent call, stamped with the leg it was called in. Only the
  // call made in the leg before a market opens is delivered to that
  // market, which is what makes the power once a leg rather than forever.
  shift: PortShiftNotice | null;
};

const roomMaroons = new Map<string, RoomMaroon>();

// The room's maroon, moved on to this leg if it was sitting on another.
// A new leg clears the nominations and keeps everything else.
function maroonStateFor(roomId: string, round: number): RoomMaroon {
  const existing = roomMaroons.get(roomId);
  if (existing && existing.round === round) return existing;
  const moved: RoomMaroon = {
    round,
    votes: new Map(),
    result: existing?.result ?? null,
    shift: existing?.shift ?? null,
  };
  roomMaroons.set(roomId, moved);
  return moved;
}

// Who the harbor put ashore, for a joiner to be handed. Null for a harbor
// that has not voted, which is also what a restarted voyage reads as.
export function maroonResultFor(roomId: string): MaroonResult | null {
  return roomMaroons.get(roomId)?.result ?? null;
}

// The Harbormaster's last call, for a joiner to be handed so the strip on
// their screen says what the room is already trading against.
export function maroonShiftNoticeFor(roomId: string): PortShiftNotice | null {
  return roomMaroons.get(roomId)?.shift ?? null;
}

// The shift to price the market `round` against: the call made in the leg
// before it, or nothing.
//
// This is the one reader of the shift that is not a screen, and the reason
// the record carries its own leg. A call made two legs ago is not a call
// the harbor is still under, and a market that went on leaning after its
// leg would make the power permanent and invisible, which is the opposite
// of what the mode asks for.
export function portShiftFor(roomId: string, round: number): PortShift | null {
  const shift = roomMaroons.get(roomId)?.shift;
  if (!shift || shift.round !== round - 1) return null;
  return { port: shift.port, direction: shift.direction };
}

// Wipes a room's maroon. Called on room:restart and when a room is deleted
// after its last member departs.
//
// Load bearing rather than tidy, for the reason clearAudits is: the result
// is the once per voyage flag, so a voyage that inherited one would have
// spent its maroon before it began and its harbor would find the vote
// refused with nothing on screen to explain it.
export function clearMaroons(roomId: string): void {
  roomMaroons.delete(roomId);
}

// The room's facts as this file needs them: the rung the mode sets, the
// tier, which is what decides whether a port name is one the room can
// actually see this leg, and the length of the voyage the guard below is
// counting down. Read from the room and never from a payload, for the
// reason the audit reads its own: a client cannot call a vote in a harbor
// that is playing Classic, or name a port that does not exist yet.
type MaroonRoom = {
  maroonFrom: number;
  difficulty: Difficulty;
  voyageRounds: number;
};

async function maroonRoomFacts(roomId: string): Promise<MaroonRoom | null> {
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { mode: true, difficulty: true },
  });
  if (!room) return null;
  const { maroonFrom } = modeConfig(room.mode);
  if (maroonFrom === null) return null;
  return {
    maroonFrom,
    difficulty: normalizeDifficulty(room.difficulty),
    // The voyage's length, not the tier's: the guard below asks whether
    // the market a call would lean is one this voyage still opens, and on
    // a mode with a length of its own the tier's number answers a
    // different voyage than the one in front of it (see voyageLegs in
    // src/lib/game/mode).
    voyageRounds: voyageRoundsFor(room.mode, room.difficulty),
  };
}

/**
 * One captain's nomination, all the way to the room.
 *
 * Everything the vote is judged against comes from the room rather than
 * from the vote: the mode and the rung from the room row, the roster from
 * the durable membership table, and the leg from the caller, which reads
 * it off the checkpoint rather than off the payload. A nomination that
 * arrives for a captain the room has stopped counting is dropped rather
 * than counted, because the arithmetic below divides by that roster and a
 * vote outside it would move a majority with nobody behind it.
 *
 * The tally goes out after every vote including the last one, and the
 * result only ever goes out once.
 */
export async function recordMaroonVote(
  io: Server,
  roomId: string,
  voterId: string,
  round: number,
  targetUserId: string,
): Promise<void> {
  const facts = await maroonRoomFacts(roomId);
  if (!facts) return;
  if (round < facts.maroonFrom) return;
  const state = maroonStateFor(roomId, round);
  if (state.result) return;
  const roster = await activeRosterSet(roomId);
  if (!roster.has(voterId) || !roster.has(targetUserId)) return;
  // A captain the harbor has already written off is not a captain the
  // harbor may put ashore. Both marks are read from the status the room
  // holds for them rather than from the caller, so a vote cannot be
  // aimed at somebody whose own client says otherwise.
  const marked = roomStatuses.get(roomId)?.get(targetUserId);
  if (marked?.bankrupt || marked?.marooned) return;
  state.votes.set(voterId, targetUserId);
  // [I1: the telemetry spine] The nomination, recorded where the vote is
  // accepted and before the tally goes out, so the record and the room
  // cannot disagree about whether it happened.
  noteTelemetry(roomId, "maroon_asked", {
    actor: voterId,
    target: targetUserId,
  });

  const tally: MaroonTally = {
    roomId,
    round,
    votes: Object.fromEntries(state.votes),
  };
  io.to(`room:${roomId}`).emit("maroon:tally", tally);

  const carried = maroonCarried(state.votes, roster.size);
  if (!carried) return;
  const member = await db.roomMember.findUnique({
    where: { userId_roomId: { userId: carried, roomId } },
    select: { user: { select: { displayName: true } } },
  });
  if (!member) return;
  const result: MaroonResult = {
    roomId,
    round,
    target: { userId: carried, name: member.user.displayName },
  };
  state.result = result;
  // [I1: the telemetry spine] The harbor put one of its own ashore. The
  // plan's retention figure is not this line: it is whether the captain
  // named here was still in the harbor when the voyage ended, which the
  // record answers by putting this target beside its own captain lines.
  noteTelemetry(roomId, "maroon_carried", { target: carried });
  // [I2: the two measurements most likely to be skipped] The same
  // observation, written onto the target's own line rather than left for a
  // reader to join out of the events. The mark is the server's fact and it
  // outlives a voyage that ends by a wipe or by the harbor emptying, which
  // are the two endings with no conclusion to read it from.
  noteCaptainMarooned(roomId, carried);
  // [B4: the log surfaces] The room's line for the same vote, written
  // before the result goes out so the log never trails the screen it
  // explains. It names the captain off the result above rather than off a
  // second lookup, which is the same discipline the audit's line keeps: a
  // log that named a captain the frame beside it did not is a log that
  // read the roster twice and got two answers.
  noteVoyageLog(io, roomId, {
    kind: "maroon_carried",
    target: result.target.name,
  });
  // The nominations die with the vote they carried: the room's answer is
  // the result now, and leaving the tally standing would put the count
  // that got there on the same screen as the thing it did.
  state.votes.clear();
  io.to(`room:${roomId}`).emit("maroon:result", result);
}

/**
 * The Harbormaster names a port, and the room reads it.
 *
 * Only the captain the harbor marooned may call this, and the server
 * decides that from its own record of the vote rather than from anything
 * the caller says about itself. The port has to be one the room has
 * unlocked by the leg the market lands on, which is the round after the
 * one this is called in, since a market opens at the top of a leg and this
 * is called from the middle of one.
 *
 * A second call in the same leg replaces the first rather than being
 * refused, and both are broadcast: the power is public, the market has
 * not drawn yet, and a Harbormaster who changes their mind in front of
 * the table has done exactly what the mode asked them to do. The last
 * word before the market opens is the one that lands.
 */
export async function recordPortShift(
  io: Server,
  roomId: string,
  userId: string,
  round: number,
  port: string,
  direction: unknown,
): Promise<void> {
  const facts = await maroonRoomFacts(roomId);
  if (!facts) return;
  if (round < facts.maroonFrom) return;
  // A call leans the market that opens after the leg it was made in, so a
  // call made in the closing leg would lean a market that never opens. The
  // console is hidden there for the same reason; refused here as well so
  // the rule has one authority rather than a screen's opinion.
  if (round >= facts.voyageRounds) return;
  if (direction !== 1 && direction !== -1) return;
  if (typeof port !== "string" || !port) return;
  const state = maroonStateFor(roomId, round);
  if (state.result?.target.userId !== userId) return;
  if (!unlockedPorts(facts.difficulty, round + 1).includes(port)) return;

  const member = await db.roomMember.findUnique({
    where: { userId_roomId: { userId, roomId } },
    select: { user: { select: { displayName: true } } },
  });
  if (!member) return;
  const notice: PortShiftNotice = {
    roomId,
    round,
    port,
    direction,
    by: { userId, name: member.user.displayName },
  };
  state.shift = notice;
  io.to(`room:${roomId}`).emit("maroon:shift", notice);
}
