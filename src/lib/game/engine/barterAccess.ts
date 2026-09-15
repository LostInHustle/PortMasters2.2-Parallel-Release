// =====================================================================
// Who may barter, and how often.
//
// The offer board in ./barter.ts owns the local half of a trade: escrow
// on post, goods moving on a completed swap. This module owns the rule for
// who is allowed to trade at all, and it sits beside ./partialSight.ts for
// the same reason that one does. It is a single small policy decision that
// both a client and the realtime layer have to ask in exactly the same
// way, and neither of them should be reimplementing it at the call site.
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

// How many completed trades this captain is allowed this voyage: none
// below the unlock level, one from level 10, a second from level 15.
export function barterAttemptsFor(renownLevel: number): number {
  if (renownLevel >= FLEXIBLE_BARTER_SECOND_ATTEMPT_LEVEL) return 2;
  if (renownLevel >= FLEXIBLE_BARTER_UNLOCK_LEVEL) return 1;
  return 0;
}

// Whether these two captains are allowed to complete a trade with each
// other. Both ends are checked, so this answers the same way whoever is
// asking: the captain posting and the captain accepting are held to one
// standard.
export function canBarterWith(
  myRenownLevel: number,
  theirRenownLevel: number,
): boolean {
  return (
    myRenownLevel >= FLEXIBLE_BARTER_UNLOCK_LEVEL &&
    theirRenownLevel >= FLEXIBLE_BARTER_UNLOCK_LEVEL
  );
}

// Whether a captain who has already spent attemptsUsed trades this voyage
// may still put an offer up. Posting itself is free and spends nothing,
// since an attempt is only ever spent by a completed trade, but a captain
// with none left has already taken every trade this voyage allows, so a
// fresh offer could only sit on the board and be refused when somebody
// finally clicked it.
export function canPostBarter(
  renownLevel: number,
  attemptsUsed: number,
): boolean {
  return attemptsUsed < barterAttemptsFor(renownLevel);
}

// How many trades this captain has left, floored at zero so a captain
// whose level dropped between voyages can never read a negative count.
export function barterAttemptsRemaining(
  renownLevel: number,
  attemptsUsed: number,
): number {
  return Math.max(0, barterAttemptsFor(renownLevel) - attemptsUsed);
}
