// =====================================================================
// Realtime layer: the bartering offer board.
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
// One board, two surfaces. The Captain's Exchange in the Bartering
// phase posts exchange offers, which are open to every captain at every
// Renown level and are never rationed. A chat composer posts flexible
// offers, which are the earned extra: gated at a Renown level, and only
// so many of one captain's own flexible offers may ever be taken. Each
// offer carries which of the two it is (see the flexible field on
// BarterOffer), and both kinds sit on the same board so a captain sees
// every swap on offer in one place whichever way it arrived.
//
// targetUserId is optional: unset for an ordinary open offer, anyone in
// the room can see and accept it. Set for a direct offer to one specific
// captain, a safeguard against exactly the failure mode an open board
// has (agreeing on a trade with someone in chat and then having a third
// captain accept it first). A direct offer is only ever visible to its
// poster and its one named target.
// =====================================================================
import type { Server } from "socket.io";
import type { BarterOffer } from "@/types/realtime";
import { sockets } from "./presence";

// The room's open offers. Module local on purpose: every reader and every
// writer sits in this file, and there is one meaning for a room's board
// being absent, so nothing outside should be reaching for the map itself.
const roomBarterOffers = new Map<string, BarterOffer[]>();

// Flexible offers of this captain's that somebody else has already taken,
// per room and then per captain. Held here rather than on a socket so a
// captain who reloads or reconnects midway keeps the allowance they have
// already spent, and held per room rather than per account because the
// allowance is a voyage's, not a lifetime's, which is also what the offer
// board itself is scoped to.
//
// Only flexible offers are counted. Accepting is never rationed, on
// either surface, and neither is posting, so this tally is the whole of
// the policy that barterAccess turns into "offers left".
//
// Deliberately not cleared by clearBarter. That runs every time the room's
// checkpoint moves off the bartering phase, which happens several times a
// voyage, and the allowance is a per voyage one: clearing it there would
// hand every captain a fresh set of flexible offers at each phase
// boundary. Only a voyage that restarts or concludes clears this,
// alongside the board it belongs to.
const roomFlexibleAccepted = new Map<string, Map<string, number>>();

export function flexibleOffersAccepted(roomId: string, userId: string): number {
  return roomFlexibleAccepted.get(roomId)?.get(userId) ?? 0;
}

export function recordFlexibleAccept(roomId: string, userId: string): void {
  const byUser = roomFlexibleAccepted.get(roomId) ?? new Map<string, number>();
  byUser.set(userId, (byUser.get(userId) ?? 0) + 1);
  roomFlexibleAccepted.set(roomId, byUser);
}

export function clearFlexibleAccepted(roomId: string): void {
  roomFlexibleAccepted.delete(roomId);
}

export function barterList(roomId: string): BarterOffer[] {
  return roomBarterOffers.get(roomId) ?? [];
}

// Writes a room's board back, dropping the map entry outright when the
// last offer has gone. Every change to the board goes through here, so
// "a room with an empty board" has one representation rather than an
// empty array in some paths and a missing key in others.
export function setBarterOffers(roomId: string, offers: BarterOffer[]): void {
  if (offers.length) roomBarterOffers.set(roomId, offers);
  else roomBarterOffers.delete(roomId);
}

// An open offer (no target) is visible to everyone; a direct offer is
// visible only to the two captains it actually involves, its poster and
// its named target, so the rest of the room never sees, and can never
// accept, a trade that was never meant for them.
//
// Module local on the same reasoning as the map above: the one caller is
// the payload builder below, and every board a captain is ever shown has
// been through that, so nothing outside this file has a board to filter.
function visibleBarterOffers(
  offers: BarterOffer[],
  userId: string,
): BarterOffer[] {
  return offers.filter(
    (o) =>
      !o.targetUserId || o.targetUserId === userId || o.fromUserId === userId,
  );
}

// The board as one named captain should see it, which is what every
// barter:update on the wire carries. All three places that send one go
// through here: the broadcast below, the answer to a state request, and
// the hydration a joining socket is handed.
//
// It is one function rather than three hand built objects because the
// three have to agree about every field, and they did not. The joining
// socket was sent the offers alone, so a captain who reloaded midway came
// back to a board that had forgotten the allowance already spent against
// them: the composer drew a post button and counted offers they no longer
// had, and the server refused the next one. There is nothing in a join to
// suggest it is a special case, which is exactly why it went unnoticed.
export function barterPayloadFor(roomId: string, userId: string) {
  return {
    roomId,
    // Personalized, because a direct offer is visible only to the two
    // captains it names.
    offers: visibleBarterOffers(barterList(roomId), userId),
    // How many of the receiving captain's own flexible offers others
    // have already taken this voyage. Carried on the board rather than
    // tallied on the client, because a client would have to rebuild the
    // tally after every reload and could only ever hold a second opinion
    // of it. The policy that turns this into "offers left" lives in
    // engine/barterAccess, so what travels here stays a plain fact.
    flexibleOffersAccepted: flexibleOffersAccepted(roomId, userId),
  };
}

// Personalized per connected socket, unlike every other room wide
// broadcast: a direct offer means two different captains in the same
// room can legitimately see two different boards. Iterates the presence
// map rather than asking Socket.IO's own room registry, so this stays a
// synchronous, in memory operation like the rest of the broadcasts.
export function broadcastBarter(io: Server, roomId: string): void {
  for (const [sid, state] of sockets.entries()) {
    if (state.roomId !== roomId || !state.authed) continue;
    io.to(sid).emit("barter:update", barterPayloadFor(roomId, state.userId));
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
  setBarterOffers(roomId, next);
  broadcastBarter(io, roomId);
}

// Takes one offer off the board without broadcasting, for the accept
// handler, which has a second change to fold in and would rather tell the
// room about both at once. It also drops every other flexible offer the
// poster still had up, in the harbor or in any private thread: a
// captain's flexible offers share the one allowance, so once one of them
// has gone through the rest could only ever be accepted into a refusal,
// and an offer nobody can take would sit holding its escrow for the rest
// of the voyage.
//
// The poster's exchange offers are deliberately left standing. Those are
// not rationed and the Captain's Exchange goes on working for them
// exactly as before, which is the whole point of the two being separate.
// Nobody loses goods to this either way: an offer that leaves the board
// returns its own escrow through the client that posted it, which is the
// same route a swept offer already takes.
export function consumeAcceptedOffer(roomId: string, offer: BarterOffer): void {
  const next = barterList(roomId).filter(
    (o) =>
      o.id !== offer.id && !(o.flexible && o.fromUserId === offer.fromUserId),
  );
  setBarterOffers(roomId, next);
}

// Wipes the board for a room without broadcasting. Called when the room
// itself is being torn down (last member departed) and there's nobody
// left in the channel to broadcast to.
export function clearBarterSilent(roomId: string): void {
  roomBarterOffers.delete(roomId);
}
