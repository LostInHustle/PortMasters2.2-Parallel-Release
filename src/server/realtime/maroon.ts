// The maroon vote, and the Harbormaster's hand.
//
// The second thing a majority can do to one captain, and the only one that costs
// them anything. It may be called once a voyage, from the mode's rung, during
// Parley, only against a captain the harbor still counts and has not written off.
// The target is not removed from the harbor (see ./game/seats).
//
// The power travels with the vote: the target names a port for the market that
// opens after the round it was called in. Like the audit, this module knows nothing
// about phases; the vote costs the table nothing and the round goes on.

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
import { tFor, type Locale } from "@/lib/game/i18n";
import {
  maroonCarried,
  maroonNamesNeeded,
  type PortShift,
} from "@/lib/game/maroon";
import { modeConfig, voyageRoundsFor } from "@/lib/game/mode";
import { unlockedPorts } from "@/lib/game/pools";
import { writtenOff } from "@/lib/seatMarks";
import { roomChannel } from "./channel";
import { activeRosterSet } from "./checkpoint";
import { roundStateFor, type RoundState } from "./round-state";
import { roomStatuses } from "./status";
import { recountAndTell } from "./tally";
import { noteCaptainMarooned, noteTelemetry } from "./telemetry";
import { noteVoyageLog } from "./voyage-log";

// One harbor's maroon, for as long as the voyage lasts. Nominations belong to a
// round and are replaced when the round turns; the result and the shift belong to the
// voyage, the shift until the market that follows the round it was called in.
type RoomMaroon = RoundState & {
  // Set once the vote carries; cleared only by a restart. Both the harbor's
  // record for a joiner and the once per voyage flag.
  result: MaroonResult | null;
  // The most recent call, stamped with its round. Only a call from the round before
  // a market opens reaches that market, which makes the power once a round.
  shift: PortShiftNotice | null;
};

const roomMaroons = new Map<string, RoomMaroon>();

// The harbor's maroon, moved on to this round if it was sitting on another.
function maroonStateFor(roomId: string, round: number): RoomMaroon {
  return roundStateFor(roomMaroons, roomId, round, (existing, round) => ({
    ...round,
    result: existing?.result ?? null,
    shift: existing?.shift ?? null,
  }));
}

// Who the harbor put ashore, for a joiner. Null before a vote, and after a restart.
export function maroonResultFor(roomId: string): MaroonResult | null {
  return roomMaroons.get(roomId)?.result ?? null;
}

// The Harbormaster's last call, for a joiner's strip.
export function maroonShiftNoticeFor(roomId: string): PortShiftNotice | null {
  return roomMaroons.get(roomId)?.shift ?? null;
}

// The shift to price market `round` against: the call made in the round before it,
// or nothing.
//
// The one non-screen reader of the shift. A call two rounds old is not one the
// harbor is still under; leaning a market after its round would make the power
// permanent and invisible.
export function portShiftFor(roomId: string, round: number): PortShift | null {
  const shift = roomMaroons.get(roomId)?.shift;
  if (!shift || shift.round !== round - 1) return null;
  return { port: shift.port, direction: shift.direction };
}

// Wipes a harbor's maroon on room:restart and on deletion. The result is the
// once per voyage flag, so a voyage that inherited one would find the vote
// refused before it began.
export function clearMaroons(roomId: string): void {
  roomMaroons.delete(roomId);
}

// The harbor's facts as this file needs them: the mode's rung, the tier (which
// decides whether a port is visible this round), and the voyage's length. Read
// from the harbor, never from a payload.
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
    // The voyage's length, not the tier's: the guard below asks whether the
    // market a call would lean still opens on this voyage, which can differ from
    // the tier's number on a mode that pins a length.
    voyageRounds: voyageRoundsFor(room.mode, room.difficulty),
  };
}

/**
 * The harbor's count of the vote, built in one place. Used for the count after a
 * nomination and the count a card is answered with, so both cannot disagree.
 *
 * The book is derived again against the current roster (see pruneStaleVotes,
 * shared with the audit since both divide by the same roster), and captains still
 * to speak are the roster's walk rather than a second subtraction.
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
    // Handed on with the count because the nominations die with the vote that
    // carried: otherwise a late answer reads like a fresh round.
    carried,
  };
}

/**
 * One accepted nomination, carried as far as it goes: the count the harbor is
 * owed, and the one result a voyage gets.
 *
 * The mirror of the audit's settle rather than a shared function: the two votes
 * differ in the majority, the frame, and the fact written on carry. What precedes
 * the commit is shared (see pruneStaleVotes and carriedTarget).
 *
 * The book is derived again after the await because a captain can leave in the
 * gap. Returning there would leave the harbor having seen the tally carry and
 * never the result, a majority visibly voting and nothing happening. The loop
 * turns at most once per dropped nomination, so it cannot spin. The result check
 * after the await makes two ballots in one tick produce one carry.
 *
 * The first pass is always told, since it follows a nomination; later passes are
 * recount passes and tell only when the book actually moved.
 */
async function settleMaroon(
  io: Server,
  roomId: string,
  round: number,
  state: RoomMaroon,
): Promise<void> {
  let first = true;
  for (;;) {
    // The count, recounted and told by the shared walk (see ./tally).
    const tally = await recountAndTell(
      io,
      roomId,
      state,
      "maroon:tally",
      (roster, book) =>
        maroonTallyFrame(
          roomId,
          round,
          roster,
          book,
          state.result?.target ?? null,
        ),
      first,
    );
    // Later passes recount only, so only a moved count is worth a frame.
    first = false;
    const carried = maroonCarried(tally.book, tally.roster.size);
    if (!carried) return;
    const member = await db.roomMember.findUnique({
      where: { userId_roomId: { userId: carried, roomId } },
      select: { user: { select: { displayName: true } } },
    });
    if (!member) continue;
    // The second of two ballots carrying in one tick stops here.
    if (state.result) return;
    const result: MaroonResult = {
      roomId,
      round,
      target: { userId: carried, name: member.user.displayName },
    };
    state.result = result;
    // The record and the mark are the same observation, written from one call.
    noteTelemetry(roomId, "maroon_carried", { target: carried });
    // The mark outlives a voyage that ends by a wipe or an emptying, which are
    // the endings with no conclusion to read it from.
    noteCaptainMarooned(roomId, carried);
    // The log line before the result goes out, so it never trails the screen it
    // explains. It names the captain off the result rather than a second lookup.
    noteVoyageLog(io, roomId, {
      kind: "maroon_carried",
      target: result.target.name,
    });
    // Nominations die with the vote: leaving the tally standing would put the
    // count that got there beside the thing it did.
    state.votes.clear();
    io.to(roomChannel(roomId)).emit("maroon:result", result);
    return;
  }
}

/**
 * One captain's nomination, all the way to the harbor.
 *
 * Everything judged comes from the harbor, never the payload: the mode and rung
 * from the room row, the roster from the membership table, and the round from the
 * caller. A nomination outside the roster is refused, since the arithmetic
 * divides by that roster and the same roster prunes old votes.
 *
 * A captain names one captain a round; the check and the write share an
 * uninterrupted step, so two presses cannot both find the seat empty. Returns
 * null on acceptance and a sentence otherwise, in the sender's language.
 *
 * The tally goes out after every vote, the result once. The carry itself and its
 * two race guards are in settleMaroon above.
 */
export async function recordMaroonVote(
  io: Server,
  roomId: string,
  voterId: string,
  round: number,
  targetUserId: string,
  locale: Locale,
): Promise<string | null> {
  const facts = await maroonRoomFacts(roomId);
  // Silence where the harbor itself is wrong: a mode with no rung has no vote
  // to explain.
  if (!facts) return null;
  if (round < facts.maroonFrom)
    return tFor(
      locale,
      "The maroon vote opens from round {facts.maroonFrom}.",
      {
        "facts.maroonFrom": facts.maroonFrom,
      },
    );
  const state = maroonStateFor(roomId, round);
  if (state.result)
    return tFor(
      locale,
      "The harbor has already voted one of its own ashore this voyage.",
    );
  const roster = await activeRosterSet(roomId);
  // The book is derived again before the door, so a refusal caused by a
  // captain leaving still leaves the harbor with the count that produced.
  const book = pruneStaleVotes(state.votes, roster);
  const moved = book.size !== state.votes.size;
  state.votes = book;
  // The count is owed only where the recount moved it.
  const refuse = (sentence: string): string => {
    if (moved)
      io.to(roomChannel(roomId)).emit(
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
  if (!roster.has(voterId)) return refuse(tFor(locale, SEAT_NOT_COUNTED));
  // A captain written off is not a captain the harbor may put ashore. The marks
  // come from the harbor's status cache through the same predicate the vote's
  // list uses (see writtenOff), so a bankrupt phase or either flag is refused.
  // Read before the roster check so a written off captain is refused for what
  // they are; a bankrupt Ocean Gambit captain is still counted by the roster.
  const marked = roomStatuses.get(roomId)?.get(targetUserId);
  if (writtenOff(marked))
    return refuse(
      tFor(locale, "The harbor has already written that captain off."),
    );
  if (!roster.has(targetUserId))
    return refuse(tFor(locale, TARGET_NOT_COUNTED));
  if (state.votes.has(voterId))
    return refuse(
      tFor(locale, "Your name is already in for this round's maroon vote."),
    );
  state.votes.set(voterId, targetUserId);
  // Recorded where the vote is accepted, before the tally goes out. A nomination
  // refused at the door files nothing.
  noteTelemetry(roomId, "maroon_asked", {
    actor: voterId,
    target: targetUserId,
  });
  await settleMaroon(io, roomId, round, state);
  return null;
}

/**
 * The harbor's count as it stands, for a card that has just opened. A round's book
 * is built by the captains in it and an empty one is never broadcast, so the card
 * asks. The answer has the same shape as the broadcast, so the first vote arriving
 * changes numbers in place.
 *
 * Read only: no nomination spent, no telemetry, no book written. It answers even
 * after the vote carried, though the card is not drawn once the result is in.
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
 * The Harbormaster names a port, and the harbor reads it.
 *
 * Only the captain the harbor marooned may call this, decided from the server's
 * own record. The port must be unlocked by the market's round, which is the round
 * after this one, since a market opens at the top of a round.
 *
 * A second call in the same round replaces the first and both are broadcast: the
 * power is public and the last word before the market opens is the one that lands.
 * Every refusal returns a sentence in the caller's language, except a harbor whose
 * mode deals no such hand, which stays silent.
 */
export async function recordPortShift(
  io: Server,
  roomId: string,
  userId: string,
  round: number,
  port: unknown,
  direction: unknown,
  locale: Locale,
): Promise<string | null> {
  const facts = await maroonRoomFacts(roomId);
  if (!facts) return null;
  if (round < facts.maroonFrom)
    return tFor(
      locale,
      "The Harbormaster's hand is not dealt before round {facts.maroonFrom}.",
      { "facts.maroonFrom": facts.maroonFrom },
    );
  // A call leans the market after its round, so a call in the closing round would
  // lean a market that never opens. Refused here as well as hidden on the console.
  if (round >= facts.voyageRounds)
    return tFor(
      locale,
      "A call in the closing round would lean a market this voyage never opens.",
    );
  if (direction !== 1 && direction !== -1)
    return tFor(
      locale,
      "A call leans a market up or down, and that frame named neither direction.",
    );
  if (typeof port !== "string" || !port)
    return tFor(locale, "A call has to name a port.");
  const state = maroonStateFor(roomId, round);
  if (state.result?.target.userId !== userId)
    return tFor(
      locale,
      "The Harbormaster's hand belongs to the captain the harbor put ashore.",
    );
  if (!unlockedPorts(facts.difficulty, round + 1).includes(port))
    return tFor(
      locale,
      "The market this call lands on has not unlocked that port.",
    );

  const member = await db.roomMember.findUnique({
    where: { userId_roomId: { userId, roomId } },
    select: { user: { select: { displayName: true } } },
  });
  if (!member) return tFor(locale, SEAT_NOT_COUNTED);
  const notice: PortShiftNotice = {
    roomId,
    round,
    port,
    direction,
    by: { userId, name: member.user.displayName },
  };
  state.shift = notice;
  io.to(roomChannel(roomId)).emit("maroon:shift", notice);
  return null;
}
