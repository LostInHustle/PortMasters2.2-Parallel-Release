// =====================================================================
// Who may barter flexibly, and how often.
//
// Two surfaces reach the offer board and they are not held to the same
// rule. The Captain's Exchange, the board the Bartering phase draws, is
// the standing way to trade: it is open to every captain from their
// first voyage and nothing in this module touches it. Flexible bartering
// is the extra, the composer a chat carries, which puts a swap in front
// of one captain or the whole harbor at any point in a voyage whether or
// not the board is on screen. That one is earned, and this module is its
// whole policy.
//
// Everything here takes a Renown Level as a plain number and imports
// nothing but constants, so the identical functions run on a client
// deciding whether to draw a button and on the server deciding whether to
// honour the click.
//
// An unknown level is always passed in as a number that fails, never left
// undefined. The roster on the wire carries a captain whose client never
// reported a level as unknown rather than as a confident zero (see the
// renownLevel fallthrough in src/server/realtime/index.ts), so every
// caller has to turn that unknown into a number before it reaches this
// module, and the only safe direction to round is down.
// =====================================================================
import {
  FLEXIBLE_BARTER_SECOND_ATTEMPT_LEVEL,
  FLEXIBLE_BARTER_UNLOCK_LEVEL,
} from "../constants";

// Whether this captain has reached flexible bartering at all. A captain
// below the level still trades freely through the Captain's Exchange, so
// this answers about the chat composer alone and never about the board.
export function flexibleBarterUnlocked(renownLevel: number): boolean {
  return renownLevel >= FLEXIBLE_BARTER_UNLOCK_LEVEL;
}

// How many of this captain's own flexible offers may ever be taken by
// somebody else in one voyage: one from the unlock level, a second from
// level 15.
//
// It is deliberately a cap on being taken, not on taking. Accepting is
// never rationed on either surface: a captain may take as many offers
// from other captains as they like, at any time and without limit, and
// nothing here is spent by doing so.
//
// Posting is refused once the allowance is gone, but only as the
// allowance's own consequence: a flexible offer that could never be
// accepted would sit on the board holding escrow it can never release.
// While any of the allowance is left there is no limit on how many offers
// a captain may have standing at once, which is what lets them advertise
// the same intent in several places and take whichever answer arrives
// first. Only the poster's own allowance is ever consulted; the captain
// accepting is never asked about theirs.
//
// The half that is counted is the half that moves goods out of a hold on
// somebody else's say so.
function flexibleOffersAllowed(renownLevel: number): number {
  if (renownLevel >= FLEXIBLE_BARTER_SECOND_ATTEMPT_LEVEL) return 2;
  if (renownLevel >= FLEXIBLE_BARTER_UNLOCK_LEVEL) return 1;
  return 0;
}

// How many more of this captain's flexible offers may still be taken,
// floored at zero so a captain whose level dropped between voyages can
// never read a negative count.
export function flexibleOffersLeft(
  renownLevel: number,
  accepted: number,
): number {
  return Math.max(0, flexibleOffersAllowed(renownLevel) - accepted);
}

// Whether these two captains are both far enough along for a flexible
// trade to happen between them. Both ends are checked, so this answers
// the same way whoever is asking: the captain posting and the captain
// accepting are held to one standard, which is what keeps the feature
// alive in a mixed room rather than letting the least established captain
// at the table veto it for everyone.
export function bothFlexibleBarterUnlocked(
  myRenownLevel: number,
  theirRenownLevel: number,
): boolean {
  return (
    flexibleBarterUnlocked(myRenownLevel) &&
    flexibleBarterUnlocked(theirRenownLevel)
  );
}
