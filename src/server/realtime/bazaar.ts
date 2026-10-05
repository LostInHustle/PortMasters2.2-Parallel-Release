// =====================================================================
// Realtime layer: the bazaar board.
//
// [D5: Aroma: the Bazaar Rumor] The board an Aroma captain speaks from
// during Parley. It is the third market this epic's paths hold in room
// state and it is the simplest of the three, because there is nothing to
// agree: an escort contract and a refit are both promises between two
// captains and need the consent machinery underneath them (see ./consent),
// and a rumor is one captain speaking and the room hearing it. So what
// this module keeps is a list of rows rather than a table of offers, and
// what it borrows from the other two is only the one thing all three
// share: every send is personalized, and the personalization is the
// feature rather than a courtesy.
//
// The rule being held here is that the direction a captain leaned stays
// with that captain until the market it moves has been drawn. Two captains
// in one room therefore read two different boards, so every payload is
// built for its reader (see publicRumors in @/lib/game/engine/bazaar,
// which is the rule itself) and every board a captain is ever shown has
// been through that one function.
//
// What this module deliberately does NOT do, and the reason is worth the
// lines it takes: a departing captain's rows stay on the board. The two
// consent boards drop a departed captain's rows, because a promise from
// someone who is not in the harbor is a promise nobody can settle, and
// the plan's own line is that betrayal lives in the gaps between
// contracts. A rumor is not a promise to anyone. It was published in the
// open, the harbor heard it, and the market it moves prices it whether or
// not the captain who said it is still ashore. Dropping the row when they
// leave would re price every good for the captains still sailing, which
// is the half applied settlement the plan's rollback note warns about
// dressed as a cleanup. The row goes when the voyage does.
//
// Transient by construction: nothing here is written down, and a save
// never carries a row. What a save carries is the lean those rows made,
// which is the market's own copy of it (see bazaarLean in
// @/lib/game/types).
// =====================================================================
import type { Server } from "socket.io";
import { publicRumors, rumorId, type BazaarRumor } from "@/lib/game/engine";
import { sockets } from "./presence";

// The room's rumors. Module local on the same reasoning as the barter
// board's map: every reader and writer in the room's socket layer goes
// through the functions below, and there is one meaning for a room's row
// list being absent.
const roomRumors = new Map<string, BazaarRumor[]>();

export function bazaarList(roomId: string): BazaarRumor[] {
  return roomRumors.get(roomId) ?? [];
}

// Writes a room's rows back, dropping the map entry outright when the last
// one has gone. The one writer, so "a room with no rumors" has one
// representation rather than an empty array in some paths and a missing
// key in others.
function setBazaarRumors(roomId: string, rows: BazaarRumor[]): void {
  if (rows.length) roomRumors.set(roomId, rows);
  else roomRumors.delete(roomId);
}

/**
 * Puts one rumor on the board and answers with the row as it was stored.
 *
 * The id is minted here rather than by the caller because it is the
 * board's own guarantee that it is worth anything: one captain publishes
 * at most one rumor in a leg, so a row's id is its publisher and its leg
 * together (see rumorId), and the board is where "no two rows share one"
 * has to hold. Every refusal that keeps that true is upstream, in the
 * handler that reads the cooldown before calling this.
 *
 * The caller is handed the row back because it is the fact the room is
 * about to be told about: the voyage log line and the broadcast both need
 * the stored shape, and neither should be rebuilding it from the request.
 */
export function publishBazaarRumor(
  roomId: string,
  row: Omit<BazaarRumor, "id">,
): BazaarRumor {
  const stored: BazaarRumor = {
    ...row,
    id: rumorId(row.publisherUserId, row.round),
  };
  setBazaarRumors(roomId, [...bazaarList(roomId), stored]);
  return stored;
}

/**
 * The board as one named captain should see it, which is what every
 * bazaar:update on the wire carries.
 *
 * The round is a parameter rather than read off the rows, because it is
 * the room's leg and not the row's: the same rows read one leg later are
 * a different board, since the leg is what decides which of them have
 * landed and whose directions are therefore public. Every site that sends
 * a board has the room's checkpoint in hand, and this is the one place
 * that turns it into the visibility rule.
 */
export function bazaarPayloadFor(
  roomId: string,
  userId: string,
  round: number,
) {
  return {
    roomId,
    // Personalized, because a standing rumor's direction belongs to its
    // publisher alone.
    rumors: publicRumors(bazaarList(roomId), userId, round),
  };
}

// Personalized per connected socket, one captain at a time, the way the
// barter board and both consent boards are: a standing rumor means two
// captains in the same room legitimately see two different boards, and
// the whole feature depends on them being handed the two they are owed.
//
// The delivery is a rule rather than a habit, and it is held by the
// private scan rather than by this comment: bazaar:update is its eighth
// rule, which refuses a board that reaches a room channel at all (see
// scripts/private-scan.ts). A later broadcast added here would be caught
// by that rule rather than by a reader of this header.
//
// Iterates the presence map rather than asking Socket.IO's own room
// registry, so this stays a synchronous, in memory operation like the
// rest of the broadcasts.
export function broadcastBazaar(
  io: Server,
  roomId: string,
  round: number,
): void {
  for (const [sid, state] of sockets.entries()) {
    if (state.roomId !== roomId || !state.authed) continue;
    io.to(sid).emit(
      "bazaar:update",
      bazaarPayloadFor(roomId, state.userId, round),
    );
  }
}

/**
 * Drops the board for a room and tells the captains still in it, which is
 * what the end of a voyage gets.
 *
 * A voyage is the whole life of a rumor: rows are kept from the first leg
 * to the last so a captain's cooldown can be read off them, and the leg
 * after a voyage ends is a leg of a different voyage, where nothing
 * anybody said here means anything.
 */
export function clearBazaar(io: Server, roomId: string, round: number): void {
  if (!roomRumors.has(roomId)) return;
  roomRumors.delete(roomId);
  broadcastBazaar(io, roomId, round);
}

// Wipes the board for a room without broadcasting. Called when the room
// itself is being torn down (last member departed) and there is nobody
// left in the channel to broadcast to.
export function clearBazaarSilent(roomId: string): void {
  roomRumors.delete(roomId);
}
