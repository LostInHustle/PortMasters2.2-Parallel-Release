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
// One board, two surfaces. The Captain's Exchange at the Parley
// posts exchange offers, which are open to every captain at every
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
import { db } from "@/lib/db";
import { FLEXIBLE_BARTER_UNLOCK_LEVEL } from "@/lib/game/constants";
import { DEFAULT_LEGACY_SUMMARY } from "@/lib/game/legacy";
import type { BarterOffer } from "@/types/realtime";
import { sockets, userSockets } from "./presence";

// ========== Flexible bartering gate ==========
// This gate stands in front of flexible bartering alone, the composer a
// chat carries. The Captain's Exchange in the Parley phase reads
// nothing here: it is open to every captain at every Renown level, and
// every branch that would have consulted a level for it is gone.
//
// Renown rides the roster as a client reported, optional number, which is
// fine for drawing a name and useless for deciding who may trade: a client
// could simply report level 21. The account row is the only authoritative
// source, so the gate reads that instead. Nothing is derived here, because
// the voyage conclusion writes the level column beside the XP it came
// from, so the two can never disagree about where the curve puts a
// captain.
//
// Returns null rather than a fallback level when the read itself fails, so
// a database hiccup is never mistaken for a captain who genuinely holds no
// Renown. A gate that fails open under load is not a gate, and a gate that
// tells somebody at level 20 that bartering "unlocks at level 10" sends
// them looking for a problem that does not exist.
export async function authoritativeRenownLevel(
  userId: string,
): Promise<number | null> {
  try {
    const row = await db.captainLegacy.findUnique({
      where: { userId },
      select: { renownLevel: true },
    });
    return row?.renownLevel ?? DEFAULT_LEGACY_SUMMARY.renownLevel;
  } catch {
    return null;
  }
}

// Everything that can stop an offer being accepted, gathered in one place
// so the accept handler can run the same checks on both sides of its
// database reads and be certain the second pass saw the board the first
// one did.
export type OfferInspection =
  { ok: true; offer: BarterOffer } | { ok: false; reason: string };

export function inspectOfferForAccept(
  roomId: string,
  userId: string,
  offerId: string,
): OfferInspection {
  const offer = barterList(roomId).find((o) => o.id === offerId);
  if (!offer)
    return { ok: false, reason: "That offer is no longer available." };
  if (offer.fromUserId === userId)
    return { ok: false, reason: "You can't accept your own offer." };
  if (offer.targetUserId && offer.targetUserId !== userId)
    return {
      ok: false,
      reason: "That offer is only open to a specific captain.",
    };
  // The poster has to be reachable, because a trade the poster is never
  // told about cannot be settled honestly on their side. Their client
  // holds the escrow and releases it when it sees the offer leave the
  // board, so an offer that vanished into a completed trade they never
  // heard about would hand the goods back to them as well as to whoever
  // accepted it. Refusing leaves the offer standing for the next attempt,
  // which costs a moment rather than a duplicate.
  if (!userSockets.get(offer.fromUserId)?.size)
    return {
      ok: false,
      reason:
        "That captain is not here right now. Try again when they are back.",
    };
  return { ok: true, offer };
}

// What a captain below the unlock level is told when the gate, rather
// than the offer, turned them away. It names the level to go and earn,
// because a refusal that only says no leaves them nothing to act on.
//
// There is no counterpart for the Captain's Exchange, since nothing there
// can refuse on these grounds any more.
export function flexibleLockedReason(): string {
  return `Flexible bartering unlocks at Renown Level ${FLEXIBLE_BARTER_UNLOCK_LEVEL}.`;
}

// What a captain is told when the account read behind the gate fails. It
// is deliberately not a refusal: nothing was decided, so the copy says the
// check did not run rather than pretending the captain failed it, and it
// tells them the attempt costs nothing. Written out three times across the
// two barter handlers before this existed, once per place a level is read.
export function renownUnavailableReason(): string {
  return "Could not check Renown just now. Try again in a moment.";
}

// What the poster is told when the captain they aimed a flexible offer at
// is below the unlock level themselves. Both ends are held to the same bar
// (see bothFlexibleBarterUnlocked), and this is the half of that answer
// that names the other captain rather than the asker, so the refusal does
// not send them looking at their own level.
export function otherCaptainLockedReason(): string {
  return "That captain has not unlocked flexible bartering yet.";
}

// What a captain is told once others have already taken every flexible
// offer this voyage allows them. It names the two things that still work
// so the refusal reads as an allowance running out rather than as a
// lockout, which is exactly the confusion the two surfaces were split
// apart to end.
export function flexibleSpentReason(): string {
  return "Every flexible trade this voyage allows you has already been taken. You can still use the Captain's Exchange and accept any offer.";
}

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
