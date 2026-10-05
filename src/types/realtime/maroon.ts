// =====================================================================
// PortMasters 2.2 Parallel Release: the harbor's second vote and the Harbormaster.
//
// [H7: Maroon and the Harbormaster] The harbor's second vote, and the one
// action in the protocol by which a captain moves another captain's books.
//
// Laid out like the audit block above, and for the same reason: the vote
// and its running tally are public because the argument that follows is
// the feature, and the result is public because it is a thing the harbor
// did out loud to a captain standing at its table. Nothing private lives
// in any of these payloads and there is nowhere in them to put anything
// private. The result names a captain and a leg; the shift names a port
// and a direction.
//
// The shift is the one worth describing. It is a client's action whose
// effect lands on other clients' books, since every captain in the harbor
// prices their own market against it, so it travels the road the Harbor
// Pulse already travels rather than a second road built beside it: the
// server holds it for the leg, broadcasts the notice below, and includes
// the bare shift on the advance that opens a port market (see
// maybeAdvance in src/server/realtime/checkpoint.ts). Nothing prices a
// market off the notice. The notice is what the room reads.
// =====================================================================

/** One captain's nomination, sent to the server. */
export type MaroonVote = {
  roomId: string;
  /** The round the vote belongs to, checked against the room's checkpoint. */
  round: number;
  targetUserId: string;
};

/**
 * The nominations so far this round, broadcast after every vote including
 * the one that carries, and answered to the captain whose card asks (see
 * maroon:state:request in src/server/realtime/wiring/maroon.ts). The same
 * frame the audit's tally carries, fields and all, and for the same
 * reason: the count is arithmetic the client can do and the names are the
 * part it cannot reconstruct, while the roster the vote is divided by is
 * the server's own reading and travels with them (see AuditTally for why
 * a card cannot work it out from the members it can see).
 */
export type MaroonTally = {
  roomId: string;
  round: number;
  /** voter id -> the captain they nominated. */
  votes: Record<string, string>;
  /** How many captains the vote is divided by: the roster still sailing. */
  roster: number;
  /** How many names one captain needs to carry it (see maroonNamesNeeded). */
  needed: number;
  /**
   * The captains the count is divided by who have not named anyone yet
   * this leg, which is who the room is waiting on. Ids, so the reader
   * names them from the roster it already has.
   */
  awaiting: string[];
  /**
   * The captain the vote named once it has carried, or null while the
   * vote is live. The nominations die with the vote that carried, so
   * without this the empty book reads exactly like a fresh leg and a
   * captain whose ask lands after the carry would be offered a press
   * that is already spent. It is the server's own record of the vote,
   * which is what a state request is asking about.
   */
  carried: { userId: string; name: string } | null;
};

/**
 * Who the harbor put ashore, once two thirds carried.
 *
 * Broadcast once and kept for the voyage on the server's side, so a
 * captain who reloads into a harbor that has already voted is handed the
 * same frame they would have seen live. There is nothing else in it: not
 * what was taken, not where the captain stands now. Those are facts about
 * one captain's books, and they travel the way every other fact about a
 * captain's books travels, on their own screen.
 */
export type MaroonResult = {
  roomId: string;
  round: number;
  target: { userId: string; name: string };
};

/**
 * The Harbormaster's call, sent to the server: one port, one direction.
 *
 * The leg and the harbor are read off the room rather than trusted from
 * here, the same way an audit nomination's are, so a client cannot lean a
 * market it is not standing in or name a port the room has not unlocked.
 */
export type PortShiftCall = {
  roomId: string;
  round: number;
  port: string;
  direction: 1 | -1;
};

/**
 * The same call as the room receives it, with the hand that made it.
 *
 * The name is in the frame because the power is public by design: a
 * captain who moves every price in a harbor has to be nameable at the
 * moment they do it, not reconstructed from a state field later. It comes
 * from the server's own roster rather than from the caller, for the
 * reason every name in this file does.
 */
export type PortShiftNotice = {
  roomId: string;
  round: number;
  port: string;
  direction: 1 | -1;
  by: { userId: string; name: string };
};
