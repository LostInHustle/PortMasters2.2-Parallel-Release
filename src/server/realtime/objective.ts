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
// =====================================================================

import type { Server } from "socket.io";
import { db } from "@/lib/db";
import { normalizeMode } from "@/lib/game/mode";
import {
  clampObjectiveTally,
  drawObjective,
  objectiveSeed,
  type Objective,
} from "@/lib/game/objectives";
import type { ObjectiveProgress } from "@/types/realtime";

// room -> captain -> what that captain has handed over, by good.
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
// The cap is on the sum and not on the parts, which is the one place this
// number can go wrong. Every captain is capped at the whole commission
// rather than at a share of it, because a share is not knowable from
// inside one client, so two captains filling the same good can together
// hand over more than it names. Clamping here is what makes the public
// board read "met" rather than "17 of 12", and it means the number on the
// wire is already the one every client would have clamped for itself.
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
    select: { mode: true, voyageEpoch: true },
  });
  if (!room || normalizeMode(room.mode) !== "ocean_gambit") return null;
  return drawObjective(objectiveSeed(roomId, room.voyageEpoch));
}

/**
 * One captain's report, all the way to the room.
 *
 * Everything a report has to be judged against comes from the room rather
 * than from the report: the mode, the voyage epoch, and from those the
 * commission itself. The clamp is what a public number needs and a private
 * one does not. A captain can lie about their own hold and it costs nobody
 * anything, but this number is on everyone's screen, so what reaches the
 * room is what the commission actually asked for and nothing more.
 */
export async function recordObjectiveReport(
  io: Server,
  roomId: string,
  userId: string,
  delivered: Record<string, number>,
): Promise<void> {
  const objective = await objectiveForRoom(roomId);
  if (!objective) return;

  merge(roomId, userId, clampObjectiveTally(objective, delivered));

  // Always broadcast, including when the merged total is empty. An empty
  // board is a fact about the room and the room is entitled to hear it.
  const payload: ObjectiveProgress = {
    roomId,
    total: objectiveTotalFor(roomId, objective),
  };
  io.to(`room:${roomId}`).emit("objective:progress", payload);
}
