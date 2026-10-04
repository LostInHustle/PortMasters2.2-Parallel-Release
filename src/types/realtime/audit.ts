// =====================================================================
// PortMasters 2.2 Parallel Release: the Manifest Audit.
//
// The Manifest Audit, which is neither of the two above.
//
// The private entry is a secret defended to the wire and the commission
// is a number nobody needs defending from. This is a third thing: one
// captain's own business, opened to the whole harbor by a vote of the
// harbor. It is therefore the one broadcast in the protocol that names a
// captain, and the only reason that is safe is what it is allowed to name
// them for. The reveal is built out of the manifest record (see OrderFill
// in @/lib/game/types) and the shape below is the whole of it, so the
// same property that protects the private channel protects this one from
// the other side: there is nowhere in these three payloads to put an
// alignment, a hold, a purse or a card, so no version of a reveal can
// leak one. The smoke suite reads every frame the room receives back and
// checks that, rather than trusting the types.
//
// The vote and its running tally are public by design. A nomination is
// made out loud, like a ready check: the room is meant to see who is
// accusing whom, because the argument that follows is the feature. What
// is not public is the manifest itself, which only the carried reveal
// carries, and only for the one captain the majority named.
// =====================================================================

import type { OrderFill } from "@/lib/game/types";

/** One captain's nomination, sent to the server. */
export type AuditVote = {
  roomId: string;
  /** The leg the vote belongs to, checked against the room's checkpoint. */
  round: number;
  targetUserId: string;
};

/**
 * The nominations so far this leg, broadcast after every vote including
 * the one that carries. Keyed by voter rather than counted, because the
 * count is arithmetic the client can do and the names are the part it
 * cannot reconstruct.
 */
export type AuditTally = {
  roomId: string;
  round: number;
  /** voter id -> the captain they nominated. */
  votes: Record<string, string>;
};

/**
 * What the harbor was shown, once the majority carried.
 *
 * `fulfillments` is the sample drawn out of the target's manifest: the
 * lines themselves rather than a summary, so the room reads what the
 * captain did instead of being told what to conclude about it. It can be
 * shorter than the reveal count, and it is empty for a captain who has
 * filled nothing, which is a finding rather than a failure.
 */
export type AuditReveal = {
  roomId: string;
  round: number;
  /**
   * Who was audited. The same shape the private channel uses to name an
   * ally, and here as there it is a name and an id and nothing else.
   */
  target: { userId: string; name: string };
  fulfillments: OrderFill[];
  /**
   * [C1: the Larder and Short Rations] The audited captain's Larder, which
   * the plan's audit clause opens alongside the sample.
   *
   * It is on this frame and on no other, and that is the design rather than
   * an accident of where it was easy to read. The Larder count travels to
   * the server in the captain's own save, so the reveal can read it without
   * the room being handed it continuously: what the fleet sees all voyage
   * is whether a crew is hungry (see GameStatusUpdate.shortRations, which
   * the plan does ask to be public), and the count itself is opened by the
   * majority that voted for it. Servering it on the status frame instead
   * would have made this clause a number the room already had.
   *
   * Undefined when the provisions layer is switched off, for the same
   * reason the badge above is: a voyage with the switch off carries a
   * Larder field that no rule moves, and printing it would put a number in
   * front of the table that means nothing. A reader draws the line on a
   * number and never on a placeholder.
   */
  larder?: number;
  /**
   * Whether the engine's own short rations rule reads true for this
   * captain, carried beside the count because the count alone cannot
   * answer it: the rule is an empty Larder aboard a crew with somebody on
   * it (see onShortRations in @/lib/game/larder), so a captain who lost
   * every hand and carries an empty hold is not on short rations, and a
   * sentence drawn from the count alone told the room they were. The
   * sentence and the badge print from this field, so the reveal says what
   * the rule says rather than what the number suggests.
   *
   * Undefined wherever larder is.
   */
  shortRations?: boolean;
  /**
   * Whether the harbor's own ledger checks had already marked this
   * captain's books when the vote carried.
   *
   * A marked save is one the Ledger Integrity Pass judged impossible (see
   * @/lib/game/integrity), and every report in it is exactly as
   * trustworthy as the number that failed the check. So a reveal for a
   * marked row withholds the manifest and the Larder rather than printing
   * evidence the harbor already knows is unsound, the same choice the
   * finish ledger makes for a forged voyage (see revealRow), and the flag
   * is the one thing such a reveal carries instead. It is a boolean
   * rather than the finding on purpose: the note behind it names the four
   * aggregate fields the pass reads, which is the operator's reading and
   * not the table's.
   *
   * Absent on every ordinary reveal, so a frame without it is the shape
   * this wire has always had, and the smoke suite asserts both shapes.
   */
  flagged?: boolean;
};
