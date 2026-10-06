// =====================================================================
// Realtime layer: the fleet commission's tally.
//
// The objective is the one thing in Ocean Gambit that is public by
// design, so this is the one new thing in the mode that is meant to be
// broadcast to the whole room, and it is worth saying out loud how it
// differs from the alignment sitting next to it in this directory. The
// alignment is a secret defended all the way to the wire. This is a shared
// number nobody needs defending from, and the only two defences it gets
// are the ones a shared number needs: it cannot be double counted, and it
// cannot be inflated past what the commission asked for.
//
// In memory and never persisted, like the Harbor Pulse tallies. The
// difference is that losing these on a restart costs more than a neutral
// market, so the clients are the record: every captain holds their own
// contribution in their voyage state, and each one re-reports it on a
// heartbeat, which rebuilds the whole board from nothing within seconds.
//
// Reports are cumulative totals and are merged by max rather than summed,
// which is what makes all of that safe. A reload, a reconnect, a
// duplicated emit and a re-report after a restart all land on the same
// number, and a report that arrives out of order cannot walk the board
// backwards.
//
// The cap is applied where a report is accepted rather than where the
// board is read. What arrives is held to what the harbor has left of every
// good at that instant, and only that much of it is merged, so the fleet's
// record can never hold more than the commission named no matter how many
// captains press at once. That read, the judgement on it and the merge
// that follows are one synchronous stretch with nothing awaited inside
// them: this is a single Node process, so the second of two reports that
// arrive together is judged against the board the first one just wrote
// rather than against the board it also read. The clamp in objectiveTotalFor
// below still caps the sum it hands out, as the last line of defence a
// public number wants, but it is no longer the only one: a harbor whose
// tallies were somehow overfilled reads met rather than "17 of 12", and
// what rides the wire is what every client would have clamped for itself.
//
// Two frames reach this module and they are two ends of one press. A
// report is a captain's standing on the board, sent on a debounce and on a
// heartbeat, and the room hears a sum. A handover is the same standing
// offered by a press on the Deliver button: it is asked before the goods
// move rather than after, the accepted rows come back to that captain
// alone, and the room hears the same public board either way (see
// recordObjectiveHandover). Both go through the same acceptance, and both
// hold the room's claim while they settle, which is what makes two
// captains pressing in the same instant settle one after the other.
// =====================================================================

import { ObjectiveProgress } from "@/types/realtime/objectives";
import type { Server } from "socket.io";
import { db } from "@/lib/db";
import { normalizeMode } from "@/lib/game/mode";
import {
  clampObjectiveTally,
  drawObjective,
  objectiveSeed,
  type Objective,
} from "@/lib/game/objectives";
import { claimObjectiveRoom } from "./presence";

// room -> captain -> what the commission has accepted from that captain,
// by good. Accepted rather than claimed: a report past what the harbor had
// left is merged as the amount it could take (see acceptAgainstRemaining),
// so the sum of these lines is what the commission actually holds.
export const roomObjectiveTallies = new Map<
  string,
  Map<string, Record<string, number>>
>();

// One captain's cumulative report, merged in. Max per good and never a
// sum, because the report is a running total rather than a delta: a
// captain who reports the same number twice has done nothing twice.
function merge(roomId: string, userId: string, tally: Record<string, number>) {
  let byCaptain = roomObjectiveTallies.get(roomId);
  if (!byCaptain) {
    byCaptain = new Map();
    roomObjectiveTallies.set(roomId, byCaptain);
  }
  const existing = byCaptain.get(userId) ?? {};
  for (const [good, count] of Object.entries(tally)) {
    existing[good] = Math.max(existing[good] ?? 0, count);
  }
  byCaptain.set(userId, existing);
}

// What the whole harbor has handed over, summed across captains and capped
// at what the commission asked for. Sent to a joiner so a late arrival sees
// the board as it stands rather than waiting for someone else to move.
//
// The sum is the truth here and the clamp is the belt to its braces: what
// is merged below was already held to the harbor's remaining, so a sum past
// the requirement would mean a tally was written twice rather than that the
// fleet handed over too much. Capping it anyway is what makes the public
// board read "met" rather than "17 of 12" whatever the lines under it hold,
// and it means the number on the wire is already the one every client would
// have clamped for itself.
export function objectiveTotalFor(
  roomId: string,
  objective: Objective,
): Record<string, number> {
  const total: Record<string, number> = {};
  for (const tally of roomObjectiveTallies.get(roomId)?.values() ?? []) {
    for (const [good, count] of Object.entries(tally)) {
      total[good] = (total[good] ?? 0) + count;
    }
  }
  return clampObjectiveTally(objective, total);
}

// What the whole harbor still has room for, good by good, read off the
// tallies as they stand at this instant.
//
// Not exported: the acceptance below is the one reader, and it is read
// inside the synchronous stretch that judges a report, so the remaining a
// report is held to is the remaining the report before it left behind. A
// client works its own remaining out from the board it is sent, against
// the same commission, with no new frame and no second copy of it here.
function objectiveRemainingFor(
  roomId: string,
  objective: Objective,
): Record<string, number> {
  const taken = objectiveTotalFor(roomId, objective);
  const remaining: Record<string, number> = {};
  for (const r of objective.resources) {
    const left = r.required - (taken[r.type] ?? 0);
    if (left > 0) remaining[r.type] = left;
  }
  return remaining;
}

/**
 * A report read down to what the commission can still take from it.
 *
 * This is the acceptance, and it is the whole of "the commission can never
 * be overfilled". A captain's report is their own running total rather than
 * a delta, so what it is held to is what this captain's line may reach
 * rather than what may be added to it: their standing on the board plus
 * what the harbor has left of that good, which is the same number read from
 * the other end. So a captain whose report is inside that ceiling is
 * believed, one whose report is past it has their line raised to the
 * ceiling and no further, and a commission already filled has a ceiling of
 * nothing for everyone, which is what refuses a handover to a filled
 * commission rather than banking it and clamping it later.
 *
 * Everything the honesty of the board rests on is the same shape it was:
 * the goods the deck does not name are dropped, counts that are not whole
 * numbers are dropped, and a report below what is already merged is merged
 * by max like any other, so a re-report, a duplicate emit and an out of
 * order frame all still land on the number already standing.
 */
function acceptAgainstRemaining(
  roomId: string,
  objective: Objective,
  userId: string,
  delivered: Record<string, number>,
): Record<string, number> {
  const remaining = objectiveRemainingFor(roomId, objective);
  const standing = roomObjectiveTallies.get(roomId)?.get(userId) ?? {};
  const accepted: Record<string, number> = {};
  for (const r of objective.resources) {
    const raw = delivered[r.type];
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    const whole = Math.floor(raw);
    const ceiling = (standing[r.type] ?? 0) + (remaining[r.type] ?? 0);
    const take = Math.min(whole, ceiling);
    if (take > 0) accepted[r.type] = take;
  }
  return accepted;
}

// Wipes a room's board. Called on room:restart and when a room is deleted
// after its last member departs.
//
// The restart call is not a tidy up, it is load bearing: a report of zero
// cannot clear a max merged tally, because max(old, 0) is old. So a new
// voyage clears this map here or it broadcasts the dead voyage's total
// until every captain happens to report a lower number, which none of them
// ever will.
export function clearObjectiveTallies(roomId: string): void {
  roomObjectiveTallies.delete(roomId);
}

/**
 * The commission a room is working on, or null if the room is not on the
 * Gambit lap.
 *
 * Both entry points need this and both need it read from the room rather
 * than from the report, so it is defined once: a client cannot report
 * against an objective of its own invention, and a Classic room cannot
 * carry a board at all, whatever it is sent.
 */
export async function objectiveForRoom(
  roomId: string,
): Promise<Objective | null> {
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { mode: true, voyageEpoch: true, voyageSeats: true },
  });
  if (!room || normalizeMode(room.mode) !== "ocean_gambit") return null;
  // The rung's two inputs, read from the room for the same reason the epoch
  // is: they are facts of the voyage in progress rather than of the report,
  // so a client cannot report against a commission of its own invention, at
  // its own table size, and have it stand.
  return drawObjective(
    objectiveSeed(roomId, room.voyageEpoch, room.voyageSeats),
    room.voyageSeats,
  );
}

/**
 * One commission read down to what it can still take from this captain,
 * merged, and told to the room. The one settlement both frames share.
 *
 * This is the synchronous stretch and there is nothing awaited in it: the
 * remaining is read here, the acceptance is judged here and the merge
 * happens here, so the second of two frames that arrive together is judged
 * against the board the first one just wrote rather than against the board
 * it also read. That is the whole of "simultaneous handovers settle one
 * after the other", and it is why both callers hold the room's claim from
 * before the room read: a frame cannot reach this function with another
 * frame's read still open behind it.
 *
 * The accepted rows come back because a handover owes its captain an
 * answer. Merging them is idempotent per captain line whatever those rows
 * are: the merge takes the higher of the line and the accepted total, and
 * an accepted total is a cumulative standing rather than a delta, so the
 * same press sent twice lands on the number the first one set.
 */
function settleObjective(
  io: Server,
  roomId: string,
  objective: Objective,
  userId: string,
  delivered: Record<string, number>,
): Record<string, number> {
  const accepted = acceptAgainstRemaining(roomId, objective, userId, delivered);
  merge(roomId, userId, accepted);

  // Always broadcast, including when the merged total is empty and
  // including when a report was accepted as nothing. An empty board is a
  // fact about the room and the room is entitled to hear it, and the
  // broadcast is also how the captain whose handover was refused finds out
  // what the commission actually holds rather than only what they claim.
  const payload: ObjectiveProgress = {
    roomId,
    total: objectiveTotalFor(roomId, objective),
  };
  io.to(`room:${roomId}`).emit("objective:progress", payload);
  return accepted;
}

/**
 * One captain's report, all the way to the room.
 *
 * Everything a report has to be judged against comes from the room rather
 * than from the report: the mode, the voyage epoch, and from those the
 * commission itself. The acceptance is what a public number needs and a
 * private one does not. A captain can lie about their own hold and it costs
 * nobody anything, but this number is on everyone's screen, so what reaches
 * the room is what the commission actually asked for and nothing more.
 *
 * The claim is taken first and the room read inside it, so the whole of
 * this call sits between one report and the next, and a restart that has
 * to clear the board for a new voyage waits here rather than clearing it
 * out from under a line this call is about to raise (see
 * claimObjectiveRoom in ./presence).
 */
export async function recordObjectiveReport(
  io: Server,
  roomId: string,
  userId: string,
  delivered: Record<string, number>,
): Promise<void> {
  const release = await claimObjectiveRoom(roomId);
  try {
    const objective = await objectiveForRoom(roomId);
    if (!objective) return;
    settleObjective(io, roomId, objective, userId, delivered);
  } finally {
    release();
  }
}

/**
 * One captain's press on the Deliver button, answered to that captain.
 *
 * The press is asked before the goods move rather than after it, and this
 * is the whole reason the frame exists: the take a press would make is
 * worked out in that captain's own client, against the board that client
 * last heard, and two boards that were heard before either press are the
 * same board. So a client proposes what it would take, the room holds the
 * proposal to what the commission has left at this instant, and the goods
 * move only for what came back (see deliverToObjective in
 * src/lib/game/engine/objectives.ts). A commission that is already filled
 * therefore answers nothing, to everyone, however many captains press at
 * once, and the answer is private because it is about one captain's press:
 * the room hears the board move and not who moved it.
 *
 * The rows handed back are this captain's accepted standing, good by good,
 * rather than a delta, which is the same shape acceptAgainstRemaining
 * already answers in and the same shape the board is carried in. A caller
 * with no commission to answer against (a Classic harbor, whatever it is
 * sent) gets null and sends nothing: the press could not have been offered
 * in a room that draws no board.
 */
export async function recordObjectiveHandover(
  io: Server,
  roomId: string,
  userId: string,
  proposed: Record<string, number>,
): Promise<Record<string, number> | null> {
  const release = await claimObjectiveRoom(roomId);
  try {
    const objective = await objectiveForRoom(roomId);
    if (!objective) return null;
    return settleObjective(io, roomId, objective, userId, proposed);
  } finally {
    release();
  }
}
