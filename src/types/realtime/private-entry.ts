// =====================================================================
// PortMasters 2.2 Parallel Release: the private channel.
//
// The private channel.
//
// One entry, addressed to one captain, delivered on `private:entry` to
// that captain's sockets and to nobody else. Everything hidden in this
// game travels this way and nothing hidden travels any other way: no
// broadcast payload carries a secret, which is a rule the realtime layer
// holds rather than a habit, and the smoke test asserts it by keeping
// every frame every socket in a room receives and reading them back.
//
// An entry is a line for a captain's own log rather than a state change,
// which is why it carries its own text: the server writes the line, and
// the interface prints what it was sent rather than assembling the same
// sentence out of fields on this side of the wire.
//
// role is the one field in the whole protocol that can name an alignment.
// It is optional because most entries will not have one, and it is typed
// rather than a string so that a second place to put an alignment would
// not compile.
// =====================================================================

import type { GambitRole } from "@/lib/game/gambit";

export type PrivateEntry = {
  /** What kind of entry this is. "card" is the dealt alignment. */
  kind: "card";
  /** The line the captain reads. */
  text: string;
  /** A hidden alignment, and the only wire field that can carry one. */
  role?: GambitRole;
  /**
   * The personal goal an Honest card carries, by id, out of the deck in
   * src/lib/game/gambit.ts. Private by the rule above rather than by a
   * different one: it is dealt with the card and it belongs to the one
   * captain holding it.
   */
  flourish?: string;
  /**
   * The other Pirate, at a table that dealt two of them.
   *
   * The one field in the protocol that names a captain other than the
   * receiver, and it is the design rather than a leak: a Pirate pair is
   * meant to know each other. It is shaped so it cannot say more than
   * that. There is no role in it, so a client reading it learns who its
   * ally is and nothing about anyone else, and it is delivered to the two
   * captains it names and to no other socket.
   */
  ally?: { userId: string; name: string };
};

export type PrivateEntryDelivery = {
  roomId: string;
  entry: PrivateEntry;
};
