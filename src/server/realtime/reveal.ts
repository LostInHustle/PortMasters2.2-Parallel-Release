// =====================================================================
// Realtime layer: the reveal, and the room's record of it.
//
// [H8: the reveal and the replay ledger] The end of an Ocean Gambit
// voyage is the one moment the mode's central secret stops being one. The
// cards were dealt at departure, defended all the way to the wire, and
// every rule in the mode was written so that no frame carried an
// alignment; this is the frame that carries all of them, and the only
// reason it is allowed to is that there is no voyage left to spoil. It is
// built by the conclusion, once, out of the verdicts and the readings that
// conclusion has already made, and it is emitted from here.
//
// In memory, like every other per room record in this directory, and for
// the same reason: the voyage it describes has ended, so it is read by
// captains who reload onto a finished table and by nobody during play. The
// durable record is the Chronicle row each captain already has, written in
// the same pass, so losing this map costs a reloading captain the ledger
// and never a result.
// =====================================================================

import type { Server } from "socket.io";
import type { VoyageReveal } from "@/types/realtime";

// One room's reveal, for as long as the finished voyage stands. There is
// exactly one per room: a voyage concludes once, and only a restart, which
// begins a new voyage, can put a different one here.
const roomReveals = new Map<string, VoyageReveal>();

/**
 * The reveal reaches the room, and is kept for everyone who arrives after.
 *
 * Both halves are the feature rather than one being a courtesy. The
 * broadcast is the moment the table has been waiting an hour for, and the
 * record is what a captain who reloads onto the finished voyage is handed
 * instead of a blank screen: the reveal is the last thing that happens to
 * a voyage, so a client that comes back to it has nowhere else to get it.
 */
export function recordReveal(io: Server, reveal: VoyageReveal): void {
  roomReveals.set(reveal.roomId, reveal);
  io.to(`room:${reveal.roomId}`).emit("voyage:reveal", reveal);
}

// The room's reveal, for a joiner to be handed. Null for a harbor whose
// voyage has not concluded, which is what a restarted voyage reads as and
// what every Classic harbor is, since no cards were dealt there and the
// conclusion builds nothing.
export function revealFor(roomId: string): VoyageReveal | null {
  return roomReveals.get(roomId) ?? null;
}

// Wipes a room's reveal. Called on room:restart and when a room is deleted
// after its last member departs.
//
// Not load bearing the way clearAudits and clearMaroons are, since a
// reveal carries no flag and refuses nothing. It is cleared anyway, and in
// both places, because the map is read by a hand out: a new voyage that
// kept the old ledger would hand it to its first joiner, and every captain
// at that table would read the previous voyage's cards as their own.
export function clearReveals(roomId: string): void {
  roomReveals.delete(roomId);
}
