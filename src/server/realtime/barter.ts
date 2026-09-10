// =====================================================================
// Realtime layer: the Bartering phase open offer board.
//
// The one piece of real cross player state this server owns besides
// loans and ventures. Everything else here is either a vote count or a
// relay; an open barter offer is an actual object two different
// captains' inventories need to agree happened, so unlike the rest of
// this file, this server is briefly authoritative over it. It still
// doesn't know what's in anyone's inventory or wallet though: posting
// and accepting are validated against each captain's own local state on
// their own client, this just makes sure only one captain can ever
// claim a given offer.
//
// targetUserId is optional: unset for an ordinary open offer, anyone in
// the room can see and accept it. Set for a direct offer to one specific
// captain, a safeguard against exactly the failure mode an open board
// has (agreeing on a trade with someone in chat and then having a third
// captain accept it first). A direct offer is only ever visible to its
// poster and its one named target.
// =====================================================================
import type { Server } from "socket.io";
import type { BarterOffer } from "./types";
import { sockets } from "./presence";

export const roomBarterOffers = new Map<string, BarterOffer[]>();

export function barterList(roomId: string): BarterOffer[] {
  return roomBarterOffers.get(roomId) ?? [];
}

// An open offer (no target) is visible to everyone; a direct offer is
// visible only to the two captains it actually involves, its poster and
// its named target, so the rest of the room never sees, and can never
// accept, a trade that was never meant for them.
export function visibleBarterOffers(
  offers: BarterOffer[],
  userId: string,
): BarterOffer[] {
  return offers.filter(
    (o) =>
      !o.targetUserId || o.targetUserId === userId || o.fromUserId === userId,
  );
}

// Personalized per connected socket, unlike every other room wide
// broadcast: a direct offer means two different captains in the same
// room can legitimately see two different boards. Iterates the presence
// map rather than asking Socket.IO's own room registry, so this stays a
// synchronous, in memory operation like the rest of the broadcasts.
export function broadcastBarter(io: Server, roomId: string): void {
  const offers = barterList(roomId);
  for (const [sid, state] of sockets.entries()) {
    if (state.roomId !== roomId || !state.authed) continue;
    io.to(sid).emit("barter:update", {
      roomId,
      offers: visibleBarterOffers(offers, state.userId),
    });
  }
}

// Drops every open offer for a room (phase moved on, or the room
// restarted) and tells everyone still in it the board is now empty.
export function clearBarter(io: Server, roomId: string): void {
  if (!roomBarterOffers.has(roomId)) return;
  roomBarterOffers.delete(roomId);
  broadcastBarter(io, roomId);
}

// Drops just one departed captain's own offers, so nobody can accept a
// dangling offer from someone who isn't in the room (or online) anymore.
export function removeUserBarterOffers(
  io: Server,
  roomId: string,
  userId: string,
): void {
  const list = roomBarterOffers.get(roomId);
  if (!list) return;
  const next = list.filter((o) => o.fromUserId !== userId);
  if (next.length === list.length) return;
  if (next.length) roomBarterOffers.set(roomId, next);
  else roomBarterOffers.delete(roomId);
  broadcastBarter(io, roomId);
}

// Wipes the board for a room without broadcasting. Called when the room
// itself is being torn down (last member departed) and there's nobody
// left in the channel to broadcast to.
export function clearBarterSilent(roomId: string): void {
  roomBarterOffers.delete(roomId);
}
