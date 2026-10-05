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
import { pruneStaleVotes } from "@/lib/game/audit";
import {
  SEAT_NOT_COUNTED,
  TARGET_NOT_COUNTED,
} from "@/lib/game/constants/copy";
import { normalizeDifficulty, type Difficulty } from "@/lib/game/difficulty";
import {
  maroonCarried,
  maroonNamesNeeded,
  type PortShift,
} from "@/lib/game/maroon";
import { modeConfig, voyageRoundsFor } from "@/lib/game/mode";
import { unlockedPorts } from "@/lib/game/pools";
import { writtenOff } from "@/lib/seatMarks";
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
 * The room's count of the vote, built in one place.
 *
 * One builder for the two moments a frame about this vote goes out: the
 * count after a nomination, and the count a card is answered with when it
 * opens. One builder because the numbers have to agree whichever way a
 * captain hears them, and because this vote reached the count later than
 * the audit did: the book is re-derived against the room that exists now,
 * exactly as the audit's is (see pruneStaleVotes, which lives with the
 * audit's arithmetic and is read here rather than copied, since both
 * books are divided by the same roster), and the captains still to speak
 * are the roster's own walk rather than a second subtraction.
 */
function maroonTallyFrame(
  roomId: string,
  round: number,
  roster: ReadonlySet<string>,
  book: ReadonlyMap<string, string>,
  carried: MaroonTally["carried"],
): MaroonTally {
  const votes = pruneStaleVotes(book, roster);
  const named = new Set(votes.keys());
  return {
    roomId,
    round,
    votes: Object.fromEntries(votes),
    roster: roster.size,
    needed: maroonNamesNeeded(roster.size),
    awaiting: [...roster].filter((id) => !named.has(id)),
    // The vote this voyage already had, when it has one. Handed on with
    // the count because the nominations die with the vote that carried:
    // without it an answer landing after the carry would read exactly
    // like a fresh leg, and the card would offer a press the door has
    // already closed (see carried in @/types/realtime/maroon).
    carried,
  };
}

/**
 * One accepted nomination, carried as far as it goes: the count the room is
 * owed, and the one result a voyage gets.
 *
 * The mirror of the audit's settle (see ./audit), and a mirror rather than
 * a shared function because the two votes differ in exactly the three
 * places this file already differs from that one: the majority, the frame
 * and the fact written when it carries. What happens before that commit is
 * shared rather than copied (the re-derived book and the walk that decides
 * it, see pruneStaleVotes and carriedTarget in @/lib/game/audit), and what
 * a shared settle would have to take as parameters is everything after it:
 * a reveal read out of the target's own save against a display name read
 * out of their membership row, a mark written onto the target's line here
 * and nothing written there, and an exactly once check each walk makes on
 * its own state after an await, which is the line suites 28 and 29 hold by
 * frame count. One function carrying all of that would put that check
 * further from the state it guards than the mirror costs. The shape of the
 * walk is the same because the race it closes is the same, and it is worth
 * saying plainly what that race is, since this is the vote that costs a
 * captain their ship:
 *
 * The book is re-derived against the room that exists now, which is a
 * second read rather than the door's, so a captain who leaves the harbor
 * in the gap between the carry being decided and the result's own read of
 * the membership row cannot lose the carry. Returning there would leave
 * the harbor having been shown the tally that carried and never having
 * been shown the result, which is the worst shape this vote can fail in: a
 * majority visibly voted a captain ashore and nothing happened. The loop
 * re-derives instead, which takes the departed captain's nominations out of
 * the book and decides the carry again on what is left, and the room is
 * told whenever the count it is reading moves. It turns at most once per
 * nomination dropped, so it cannot spin.
 *
 * The other half is the same-tick pair: two ballots that arrive together
 * can both decide the same carry, and the second to resume finds the room
 * already answered here and stops, so one carry is one result, one mark on
 * the target's line, one log line and one frame.
 *
 * `tell` is the caller's answer to whether the room is owed a frame for
 * this pass: true for an accepted nomination, which is always news, and
 * false for the re-derive a refusal was made of, which tells the room only
 * when the book actually moved under it.
 */
async function settleMaroon(
  io: Server,
  roomId: string,
  round: number,
  state: RoomMaroon,
  tell: boolean,
): Promise<void> {
  for (;;) {
    const roster = await activeRosterSet(roomId);
    const book = pruneStaleVotes(state.votes, roster);
    const moved = book.size !== state.votes.size;
    state.votes = book;
    if (tell || moved) {
      io.to(`room:${roomId}`).emit(
        "maroon:tally",
        maroonTallyFrame(
          roomId,
          round,
          roster,
          book,
          state.result?.target ?? null,
        ),
      );
    }
    // Every pass after this one is a re-derive rather than a nomination, so
    // only a count that actually moved is worth a second frame.
    tell = false;
    const carried = maroonCarried(book, roster.size);
    if (!carried) return;
    const member = await db.roomMember.findUnique({
      where: { userId_roomId: { userId: carried, roomId } },
      select: { user: { select: { displayName: true } } },
    });
    if (!member) continue;
    // The second of two ballots that carried in the same tick finds the
    // harbor already answered here and stops, which is what makes one
    // carry exactly one result.
    if (state.result) return;
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
    return;
  }
}

/**
 * One captain's nomination, all the way to the room.
 *
 * Everything the vote is judged against comes from the room rather than
 * from the vote: the mode and the rung from the room row, the roster from
 * the durable membership table, and the leg from the caller, which reads
 * it off the checkpoint rather than off the payload. A nomination that
 * arrives for a captain the room has stopped counting is refused rather
 * than counted, because the arithmetic below divides by that roster and a
 * vote outside it would move a majority with nobody behind it, and the
 * same roster re-judges the votes already in the book, so a nomination
 * the room has stopped counting is out of the tally whether it was cast
 * before or after its captain left.
 *
 * A captain names one captain a leg, checked and written in the same
 * uninterrupted step so two presses cannot both find the seat empty: a
 * count that could move after the table was shown it is a count nobody
 * can argue against, and the vote is the one thing in the mode that has
 * to be arguable. The second press, whether it repeats the first or asks
 * for a different captain, is refused.
 *
 * The shapes this hands back are the audit's own: null where the
 * nomination was accepted, and a sentence for the captain who sent it
 * wherever it was refused.
 *
 * The tally goes out after every vote including the last one, and the
 * result only ever goes out once. The carry itself is the walk in
 * settleMaroon above, which is also where the two ways a carry could be
 * lost or doubled are closed, and which runs for a refusal as well: a
 * refusal tells the room nothing unless the re-derive behind it moved the
 * book, so a captain pressing twice cannot move the count the table is
 * arguing over.
 */
export async function recordMaroonVote(
  io: Server,
  roomId: string,
  voterId: string,
  round: number,
  targetUserId: string,
): Promise<string | null> {
  const facts = await maroonRoomFacts(roomId);
  // Silence where the harbor itself is wrong, the same call the audit
  // makes: a mode with no rung has no vote, so there is nothing to explain
  // to a captain who asked for one.
  if (!facts) return null;
  if (round < facts.maroonFrom)
    return `The maroon vote opens from leg ${facts.maroonFrom}.`;
  const state = maroonStateFor(roomId, round);
  if (state.result)
    return "The harbor has already voted one of its own ashore this voyage.";
  const roster = await activeRosterSet(roomId);
  // The book is re-derived before the door rather than after it, for the
  // reason the audit's is: a nomination the prune drops is the room's news
  // rather than this ballot's, and a refusal made because a captain left
  // still leaves the room with the count that captain's leaving produced.
  const book = pruneStaleVotes(state.votes, roster);
  const moved = book.size !== state.votes.size;
  state.votes = book;
  // The room's count, owed only where the re-derive moved it: a refused
  // ballot leaves the book alone otherwise, and the count the room is
  // already reading is still the count.
  const refuse = (sentence: string): string => {
    if (moved)
      io.to(`room:${roomId}`).emit(
        "maroon:tally",
        maroonTallyFrame(
          roomId,
          round,
          roster,
          state.votes,
          state.result?.target ?? null,
        ),
      );
    return sentence;
  };
  if (!roster.has(voterId)) return refuse(SEAT_NOT_COUNTED);
  // A captain the harbor has already written off is not a captain the
  // harbor may put ashore. The marks are read from the status the room
  // holds for them rather than from the caller, so a vote cannot be aimed
  // at somebody whose own client says otherwise, and they are read
  // through the one predicate the vote's own list is drawn with (see
  // writtenOff in @/lib/seatMarks): the bankruptcy phase counts there as
  // well as the two flags, so a status from a client older than the flags
  // is refused for what it is too. Read before the roster check below so
  // a written off captain is refused for what they are rather than for
  // the roster arithmetic that also excludes them. The two are not one
  // question and the roster stays where it is: an Ocean Gambit bankrupt
  // is written off and is still counted by the roster, which is exactly
  // why this door has to read the mark for itself.
  const marked = roomStatuses.get(roomId)?.get(targetUserId);
  if (writtenOff(marked))
    return refuse("The harbor has already written that captain off.");
  if (!roster.has(targetUserId)) return refuse(TARGET_NOT_COUNTED);
  if (state.votes.has(voterId))
    return refuse("Your name is already in for this leg's maroon vote.");
  state.votes.set(voterId, targetUserId);
  // [I1: the telemetry spine] The nomination, recorded where the vote is
  // accepted and before the tally goes out, so the record and the room
  // cannot disagree about whether it happened. A nomination refused at the
  // door files nothing, the same rule the audit keeps: the record counts
  // what the table saw happen, and the table was shown a refusal.
  noteTelemetry(roomId, "maroon_asked", {
    actor: voterId,
    target: targetUserId,
  });
  await settleMaroon(io, roomId, round, state, true);
  return null;
}

/**
 * The room's count as it stands, for the captain whose card has just
 * opened.
 *
 * A leg's book is built by the captains in it and the empty one is never
 * broadcast, so a card opened before anyone has nominated has no frame to
 * read: it asks, and this answers in the same shape the broadcast carries
 * so the first vote a captain sees arrive changes the numbers in place
 * rather than redrawing the block around them. Read only, the same as the
 * audit's: nothing here spends a nomination, records telemetry or writes
 * a book.
 *
 * A harbor whose voyage has already carried the vote is answered all the
 * same. The card is not drawn once the result is in (see maroonCardShown,
 * which the result strip takes over from), so the answer is only ever read
 * by a screen that has a use for it, and refusing to answer here would be
 * a second rule about a vote that already ran.
 */
export async function maroonTallyFor(
  roomId: string,
  round: number,
): Promise<MaroonTally | null> {
  const facts = await maroonRoomFacts(roomId);
  if (!facts) return null;
  const state = roomMaroons.get(roomId);
  const book = state && state.round === round ? state.votes : new Map();
  const roster = await activeRosterSet(roomId);
  return maroonTallyFrame(
    roomId,
    round,
    roster,
    book,
    state?.result?.target ?? null,
  );
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
 *
 * Every refusal hands back a sentence, in the shape the two votes above
 * hand theirs back and for the reason the plan gives the whole mode's
 * refusals: the captain holding this lever is the one captain in the
 * harbor whose presses move other captains' books, so a press that did
 * nothing has to say what it was missing rather than disappear. The one
 * silence left is the harbor itself being wrong, which is the same silence
 * the votes keep: a room whose mode deals no such hand has nothing to
 * explain about it.
 */
export async function recordPortShift(
  io: Server,
  roomId: string,
  userId: string,
  round: number,
  port: unknown,
  direction: unknown,
): Promise<string | null> {
  const facts = await maroonRoomFacts(roomId);
  if (!facts) return null;
  if (round < facts.maroonFrom)
    return `The Harbormaster's hand is not dealt before leg ${facts.maroonFrom}.`;
  // A call leans the market that opens after the leg it was made in, so a
  // call made in the closing leg would lean a market that never opens. The
  // console is hidden there for the same reason; refused here as well so
  // the rule has one authority rather than a screen's opinion.
  if (round >= facts.voyageRounds)
    return "A call in the closing leg would lean a market this voyage never opens.";
  if (direction !== 1 && direction !== -1)
    return "A call leans a market up or down, and that frame named neither direction.";
  if (typeof port !== "string" || !port) return "A call has to name a port.";
  const state = maroonStateFor(roomId, round);
  if (state.result?.target.userId !== userId)
    return "The Harbormaster's hand belongs to the captain the harbor put ashore.";
  if (!unlockedPorts(facts.difficulty, round + 1).includes(port))
    return "The market this call lands on has not unlocked that port.";

  const member = await db.roomMember.findUnique({
    where: { userId_roomId: { userId, roomId } },
    select: { user: { select: { displayName: true } } },
  });
  if (!member) return SEAT_NOT_COUNTED;
  const notice: PortShiftNotice = {
    roomId,
    round,
    port,
    direction,
    by: { userId, name: member.user.displayName },
  };
  state.shift = notice;
  io.to(`room:${roomId}`).emit("maroon:shift", notice);
  return null;
}
