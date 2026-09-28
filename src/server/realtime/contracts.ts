// =====================================================================
// Realtime layer: the escort contract board.
//
// [D3: Convoy: the Escort Contract] The board Convoy captains sell from
// during Parley, held here for the reason the barter board is held here:
// an agreement between two captains is an object no single client can be
// the authority over, so the room keeps it and the two clients each apply
// their own side of it to their own state (see applyEscortSide in
// @/lib/game/engine/contracts).
//
// The two trust boundaries this module holds, stated here because they are
// decisions rather than omissions.
//
// The server does not know who holds the Convoy path, and it does not ask.
// A path lives in a captain's own save, beside their hold and their purse,
// and the server has never read one: this is the same line the barter board
// draws when it says posting and accepting are validated against each
// captain's local state and the server "still doesn't know what's in
// anyone's inventory". What the server can enforce it does enforce, and
// everything else about a post is a captain's own claim about themselves.
//
// The server does not price a claim, and it does not clamp one either. What
// a raid would have taken from the covered captain is that captain's own
// report, and what the guns ate is worked out on the seller's client
// against the seller's own purse (see escortEats), so there is no number
// here that this module could check a report against. The bounds that
// matter are the ones the seller already agreed to when they sold: the
// worst a claim can cost them is the hold they were standing in, which is
// what underwriting means and what the plan prices the path's poverty
// against. What the server does is keep the claim honest about its
// ordering: one claim per contract, only against a contract that was
// agreed, only from the captain whose name is on it, and only in the leg
// the contract was sold for.
//
// Transient by the plan's own instruction: "Contracts are transient room
// state rather than durable, so this rolls back cleanly." Nothing here is
// written down, and a save never carries a contract. It carries the tally
// of what already settled and the ledger of movements already applied,
// both of which are records of the past rather than live agreements.
// =====================================================================
import type { Server } from "socket.io";
import {
  expireContracts,
  visibleContracts,
  type EscortContract,
} from "@/lib/game/engine";
import type { Phase } from "@/lib/game/types";
import { sockets } from "./presence";

// The room's contract board. Module local on the same reasoning as the
// barter board's map: every reader and writer sits in this file, and there
// is one meaning for a room's board being absent.
const roomContracts = new Map<string, EscortContract[]>();

export function contractList(roomId: string): EscortContract[] {
  return roomContracts.get(roomId) ?? [];
}

// Writes a room's board back, dropping the map entry outright when the
// last contract has gone, so "a room with an empty board" has one
// representation rather than an empty array in some paths and a missing
// key in others.
export function setContracts(
  roomId: string,
  contracts: EscortContract[],
): void {
  if (contracts.length) roomContracts.set(roomId, contracts);
  else roomContracts.delete(roomId);
}

// The board as one named captain should see it, which is what every
// contract:update on the wire carries. All three places that send one go
// through here: the broadcast below, the answer to a state request, and the
// hydration a joining socket is handed. One function rather than three hand
// built objects, for the reason the barter board learned the hard way: the
// three have to agree about every field, including which rows a captain may
// read at all.
export function contractPayloadFor(roomId: string, userId: string) {
  return {
    roomId,
    // Personalized, because a direct offer belongs to two captains and a
    // claimed contract's raid figure belongs to its seller. Both rules
    // live in visibleContracts, beside the rest of the board's policy, so
    // this stays a plain read of the rows.
    contracts: visibleContracts(contractList(roomId), userId),
  };
}

// Personalized per connected socket, unlike every other room wide
// broadcast: two captains in one room can legitimately see two different
// boards. Iterates the presence map rather than asking Socket.IO's own
// room registry, so this stays a synchronous, in memory operation like the
// rest of the broadcasts.
export function broadcastContracts(io: Server, roomId: string): void {
  for (const [sid, state] of sockets.entries()) {
    if (state.roomId !== roomId || !state.authed) continue;
    io.to(sid).emit(
      "contract:update",
      contractPayloadFor(roomId, state.userId),
    );
  }
}

// Drops every contract for a room (the leg moved on, or the room
// restarted) and tells everyone still in it the board is now empty.
export function clearContracts(io: Server, roomId: string): void {
  if (!roomContracts.has(roomId)) return;
  roomContracts.delete(roomId);
  broadcastContracts(io, roomId);
}

// Drops a departed captain's contracts, so the room is never covered by a
// promise from someone who is not in it.
//
// Two conditions, and each answers a different danger. Everything they were
// selling is gone, because an offer nobody can take would sit holding its
// row against a seller who is not at the table, and a contract they had
// already agreed is gone too, because the cover is read off this board and
// a board that still carried it would leave the buyer protected by a
// captain whose guns are no longer in the harbor. What a departure
// therefore takes from the buyer is the protection they paid for, which is
// the plainest gap the plan means when it says betrayal lives in the gaps
// between contracts.
//
// And any offer addressed to the departed captain goes with them, since
// they are the only captain who could have accepted it.
//
// Deliberately not keyed on the buyer's departure: a contract the seller
// still owes on is the seller's to keep, and the buyer walking out of the
// harbor does not settle it.
export function removeUserContracts(
  io: Server,
  roomId: string,
  userId: string,
): void {
  const list = roomContracts.get(roomId);
  if (!list) return;
  const next = list.filter(
    (c) =>
      c.sellerUserId !== userId &&
      !(c.status === "offered" && c.buyerUserId === userId),
  );
  if (next.length === list.length) return;
  setContracts(roomId, next);
  broadcastContracts(io, roomId);
}

// Wipes the board for a room without broadcasting. Called when the room
// itself is being torn down (last member departed) and there's nobody left
// in the channel to broadcast to.
export function clearContractsSilent(roomId: string): void {
  roomContracts.delete(roomId);
}

// Applies the board's own expiry rules to a room whose checkpoint has
// moved, and tells the room only if something actually went.
//
// The rules are expireContracts in the game layer rather than a sweep
// written here, for the reason the board's other policies live there: what
// an offer is worth after the phase moves is a rule about contracts and
// not about sockets, and a rule that only exists inside a live server is
// one the suite cannot hold without opening one.
export function sweepContracts(
  io: Server,
  roomId: string,
  standing: { phase: Phase; round: number },
): void {
  const list = contractList(roomId);
  if (!list.length) return;
  const next = expireContracts(list, standing);
  if (next.length === list.length) return;
  setContracts(roomId, next);
  broadcastContracts(io, roomId);
}
