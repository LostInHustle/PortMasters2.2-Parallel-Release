// =====================================================================
// Realtime layer: the board a consent market is held on.
//
// [D4: Loom: the Refit] A board is room state, because an agreement between
// two captains is an object no single client can be the authority over, and
// the room keeps it while the two clients each apply their own side of it to
// their own state. D3 wrote that module for the escort contract and D4's
// refit needs the same one, so what D3 wrote is here once, as a factory, and
// ./contracts and ./refits are two bindings of it.
//
// What a binding supplies is the two things that differ between kinds: the
// event a board broadcasts on and the shape of the payload it broadcasts,
// which include the one place the two kinds' visibility rules part company
// (see visibleContracts in @/lib/game/engine/contracts, which reads the
// shared filter and then drops the one field only an escort carries). What
// the factory supplies is everything else, and it is the whole of the
// board's life: writing it back, personalizing every send, dropping a
// departed captain's rows, sweeping a moved checkpoint, and the silent wipe
// a torn down room gets.
//
// The two trust boundaries every consent board holds are worth restating
// here, because they are decisions rather than omissions and they are now
// held by two features instead of one.
//
// The server does not know who holds a path, and it does not ask. A path
// lives in a captain's own save, beside their hold and their purse, and the
// server has never read one: this is the same line the barter board draws
// when it says posting and accepting are validated against each captain's
// local state and the server "still doesn't know what's in anyone's
// inventory". What the server can enforce it does enforce, and everything
// else about a post is a captain's own claim about themselves.
//
// The server does not price a term, and it does not clamp one either. What
// a raid would have taken from a covered captain is that captain's own
// report, and what the guns ate is worked out on the seller's client against
// the seller's own purse; the points a refit puts back are worked out on the
// customer's client against the customer's own wardrobe. There is no number
// here that this module could check either against, and the bounds that
// matter are the ones both captains already agreed to. What the server does
// is keep a row honest about its ordering: one term per agreement, only
// against a row that was agreed, only from the captain whose name is on it,
// and only in the leg it was sold for.
//
// Transient by the plan's own instruction: "Contracts are transient room
// state rather than durable, so this rolls back cleanly." Nothing here is
// written down, and a save never carries an agreement. It carries the tally
// of what already settled and the ledger of movements already applied, both
// of which are records of the past rather than live agreements.
// =====================================================================
import type { Server } from "socket.io";
import { expireConsent, type ConsentTerms } from "@/lib/game/engine";
import type { Phase } from "@/lib/game/types";
import { sockets } from "./presence";

export type ConsentBoard<T extends ConsentTerms> = {
  /** The room's rows. An absent key and an empty list mean the same thing. */
  list(roomId: string): T[];
  /** Writes the list back, keeping one representation of an empty board. */
  set(roomId: string, rows: T[]): void;
  /** The rows one named captain may read, which is the personal part. */
  visibleFor(roomId: string, userId: string): T[];
  /**
   * What one captain is sent, which is their rows in the shape this kind
   * speaks on the wire. The answer is deliberately untyped here: the payload
   * is a contract with the client rather than a shape the server reasons
   * about, and the client declares the type it reads.
   */
  payloadFor(roomId: string, userId: string): unknown;
  /** Sends every connected captain in the room the board as they may read it. */
  broadcast(io: Server, roomId: string): void;
  /** Drops the board and tells the room it is empty. */
  clear(io: Server, roomId: string): void;
  /** Drops the board without a broadcast, for a room with nobody left in it. */
  clearSilent(roomId: string): void;
  /** Drops a departed captain's rows. */
  removeUser(io: Server, roomId: string, userId: string): void;
  /** Applies the board's expiry rules to a moved checkpoint. */
  sweep(
    io: Server,
    roomId: string,
    standing: { phase: Phase; round: number },
  ): void;
};

/**
 * One board per kind of agreement, bound to the event and payload that kind
 * speaks on the wire.
 *
 * `pack` is the payload builder rather than a fixed shape because the two
 * kinds name their rows differently on the wire, and a wire field name is a
 * contract with every client already connected: `{roomId, contracts}` for
 * the market D3 shipped and `{roomId, refits}` for D4's bench, so a tab left
 * open across the deploy reads the same field it was built to read.
 */
export function consentBoard<T extends ConsentTerms>(options: {
  event: string;
  visible: (rows: T[], userId: string) => T[];
  pack: (roomId: string, rows: T[]) => unknown;
}): ConsentBoard<T> {
  // Module local on the same reasoning as the barter board's map: every
  // reader and writer goes through the returned object, and there is one
  // meaning for a room's board being absent.
  const rooms = new Map<string, T[]>();

  const board: ConsentBoard<T> = {
    list(roomId) {
      return rooms.get(roomId) ?? [];
    },

    set(roomId, rows) {
      if (rows.length) rooms.set(roomId, rows);
      else rooms.delete(roomId);
    },

    visibleFor(roomId, userId) {
      return options.visible(board.list(roomId), userId);
    },

    payloadFor(roomId, userId) {
      return options.pack(roomId, board.visibleFor(roomId, userId));
    },

    broadcast(io, roomId) {
      // Personalized per connected socket, unlike every other room wide
      // broadcast: two captains in one room can legitimately see two
      // different boards. Iterates the presence map rather than asking
      // Socket.IO's own room registry, so this stays a synchronous, in
      // memory operation like the rest of the broadcasts.
      for (const [sid, state] of sockets.entries()) {
        if (state.roomId !== roomId || !state.authed) continue;
        io.to(sid).emit(options.event, board.payloadFor(roomId, state.userId));
      }
    },

    clear(io, roomId) {
      if (!rooms.has(roomId)) return;
      rooms.delete(roomId);
      board.broadcast(io, roomId);
    },

    clearSilent(roomId) {
      rooms.delete(roomId);
    },

    removeUser(io, roomId, userId) {
      // Drops a departed captain's rows, so the room is never bound by a
      // promise from someone who is not in it.
      //
      // Two conditions, and each answers a different danger. Everything they
      // were selling is gone, because an offer nobody can take would sit
      // holding its row against a seller who is not at the table, and an
      // agreement they had already made is gone too, because what a buyer
      // bought is read off this board and a board that still carried it
      // would leave them holding a promise from a captain who is no longer
      // in the harbor. What a departure therefore takes from the buyer is
      // what they paid for, which is the plainest gap the plan means when it
      // says betrayal lives in the gaps between contracts.
      //
      // And any offer addressed to the departed captain goes with them,
      // since they are the only captain who could have accepted it.
      //
      // Deliberately not keyed on the buyer's departure: what the seller
      // still owes on is the seller's to keep, and the buyer walking out of
      // the harbor does not settle it.
      const list = rooms.get(roomId);
      if (!list) return;
      const next = list.filter(
        (c) =>
          c.sellerUserId !== userId &&
          !(c.status === "offered" && c.buyerUserId === userId),
      );
      if (next.length === list.length) return;
      board.set(roomId, next);
      board.broadcast(io, roomId);
    },

    sweep(io, roomId, standing) {
      // The expiry itself is a rule in the game layer rather than a sweep
      // written here, for the reason the board's other policies live there:
      // what an offer is worth after the phase moves is a rule about
      // agreements and not about sockets, and a rule that only exists inside
      // a live server is one the suite cannot hold without opening one.
      const list = board.list(roomId);
      if (!list.length) return;
      const next = expireConsent(list, standing);
      if (next.length === list.length) return;
      board.set(roomId, next);
      board.broadcast(io, roomId);
    },
  };

  return board;
}
