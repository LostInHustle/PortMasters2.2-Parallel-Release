// =====================================================================
// PortMasters 2.2 Parallel Release: Maroon, and the Harbormaster's hand.
//
// [H7: Maroon and the Harbormaster] The harbor's second vote, and the
// heavier one. From the mode's rung, once a voyage, two thirds of the
// captains still sailing may put one captain ashore: they lose the ship
// and everything on it, keep half their Gold, and are handed the one
// power in the mode that is not about their own books. From then on,
// once a leg, they may name a port and lean every price at it by a tenth
// in either direction, in front of the whole table.
//
// The vote is modeled on the Manifest Audit's (see ./audit) and the
// difference between them is the whole point of the pair. The audit is
// one round of evidence at a simple majority and costs the table its
// trading; marooning is a two thirds majority from late in the voyage,
// costs one captain everything they own, and is deliberately the harder
// of the two to call. A harbor that can open a manifest will not
// necessarily be able to put anyone ashore, and the arithmetic below is
// where that shows.
//
// What is NOT here is as deliberate. This module does not decide whether
// the power is available: the rung lives on the mode (see ModeConfig in
// ./mode, and maroonFrom in particular), beside the other rule that
// decides a seat's fate. It does not run the vote or hold the room's
// record of it either, for the reason nothing else in this tree splits a
// rule across two owners: the arithmetic is here so it can be tested
// without a socket, and the room state is next to the socket that needs
// it (see src/server/realtime/maroon.ts).
//
// Pure: no socket, no database, no clock.
// =====================================================================

import { carriedTarget } from "./audit";

// The share of their Gold a marooned captain keeps. The rest goes to the
// harbor with the ship, which is the price of the vote being real: a
// captain who loses nothing but a title has not been marooned.
export const MAROON_SHARE = 0.5;

// How far the Harbormaster moves a port's prices, in either direction.
// A tenth is small enough that a market stays readable and large enough
// that a whole leg of buying at one port is a decision rather than a
// rounding error, which is the same band the mode's other multipliers
// work in (see the Harbor Pulse's own per good nudge).
export const PORT_SHIFT_FRACTION = 0.1;

// The share of the roster a maroon vote carries, in the words the vote
// card and the Harbormaster's hand state it in. It lives here, beside the
// threshold in maroonCarried, because that threshold is the arithmetic
// these words render: it is counted in whole names (maroonNamesNeeded
// below, the smallest count at or above two thirds) rather than against a
// floating share, so a retune that moved the vote would have to move this
// string in the same breath, and the panels quote it rather than
// restating it.
export const MAROON_VOTE_SHARE = "Two thirds";

// One port, and which way the Harbormaster leaned it. The durable shape
// of the power: it is what a client stamps onto its own state when the
// market opens, and what every price at that port is read against until
// the next market opens.
export type PortShift = {
  port: string;
  direction: 1 | -1;
};

/**
 * The Gold a marooned captain keeps, floored to whole coins.
 *
 * Here rather than in the engine that takes the ship, because it is the
 * plan's number and the smoke suite holds it to the sentence a captain
 * reads: "keep half their gold" is a rule, and a rule written out at the
 * place the subtraction happens is a rule that drifts from its own
 * description.
 */
export function maroonKeptGold(gold: number): number {
  if (!Number.isFinite(gold) || gold <= 0) return 0;
  return Math.floor(gold * MAROON_SHARE);
}

/**
 * Whether the nominations carry, and for whom.
 *
 * Two thirds of the active roster, counted from the roster rather than
 * from the votes, exactly as the audit's majority is: a captain who is
 * not in the room's calculation is not a vote the room is waiting on.
 *
 * The count is inclusive, and that is the only reading that means
 * anything at the sizes a harbor is dealt. Strictly more than two thirds
 * of a table of three is three votes, which is unanimity and therefore
 * not a vote at all; two thirds of three is two, and a two thirds
 * majority is what the plan asks for. At six the fraction lands on a
 * whole seat and both readings agree. It is that inclusive two thirds
 * that maroonNamesNeeded below writes as a whole count of names, so the
 * card that quotes the share and the server that decides on it answer
 * out of one arithmetic.
 *
 * Two captains cannot both hold two thirds of one roster, since two
 * disjoint two thirds do not fit inside a whole for any table this game
 * deals, so the walk itself cannot be order dependent: whichever target
 * the map is walked to first is the only one that can be over the
 * threshold. The walk is the audit's own rather than a second copy of it
 * (see carriedTarget in ./audit): the two votes count the same books at
 * different thresholds, and the counting is the part that has to agree.
 */
export function maroonCarried(
  votes: ReadonlyMap<string, string>,
  roster: number,
): string | null {
  return carriedTarget(votes, roster, maroonNamesNeeded(roster));
}

/**
 * How many names carry the maroon vote, for a roster of any size.
 *
 * The smallest whole count of captains that is two thirds, and the
 * threshold maroonCarried carries on: one name fewer never carries and
 * this many always does. Rounded up rather than down, because a share of
 * a roster that does not divide in three is a count of captains and half
 * a captain cannot raise their hand. Written as arithmetic rather than as
 * a sentence for the reason the audit's own count is: the card that
 * states it and the comparison that decides it are one rule, and the
 * smoke suite holds the two together at every roster this game deals.
 *
 * A roster of nobody needs nobody: an empty room has no vote to carry.
 */
export function maroonNamesNeeded(roster: number): number {
  if (roster <= 0) return 0;
  return Math.ceil((roster * 2) / 3);
}

/**
 * A save's port shift, made safe to read.
 *
 * A shift is a client's blob like everything else in a save, and it is
 * read by a pricing function rather than by a screen, so a damaged one
 * would not look wrong: it would price a market. Anything that is not a
 * named port and a direction of exactly one or minus one reads as no
 * shift at all, and the market then prices every card the way it prices
 * one on a voyage where nothing was ever called.
 */
export function normalizePortShift(value: unknown): PortShift | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.port !== "string" || !v.port) return null;
  if (v.direction !== 1 && v.direction !== -1) return null;
  return { port: v.port, direction: v.direction };
}

/**
 * What every price at one port is multiplied by this leg.
 *
 * A multiplier rather than a mutation of the card, so a market drawn
 * before a shift arrived is never rewritten after the fact and a shift
 * that expires simply stops being applied. Callers multiply, which keeps
 * the floor at one Gold and the pulse's own nudge in the same
 * arithmetic: this is one more hand on the same price, not a second
 * pricing path.
 */
export function portShiftMultiplier(
  shift: PortShift | null,
  port: string,
): number {
  if (!shift || shift.port !== port) return 1;
  return 1 + shift.direction * PORT_SHIFT_FRACTION;
}

/**
 * The shift as the room reads it, which is the only rendering there is.
 *
 * A clause rather than a sentence, exactly as a manifest line is (see
 * fulfillmentLine in ./audit): whoever shows it frames it with the leg and
 * the hand that made it, and the clause itself then reads the same in
 * every frame. A sentence would have to pick a tense, and the two frames
 * this appears in need different ones: a call made this leg has not
 * landed yet, and a call made last leg is the one the market on screen was
 * priced against.
 *
 * The percent is rounded because a tenth of a hundred is not
 * arithmetically a whole number in this language, and "10.000000000000002
 * percent" is a clause no captain should ever be shown.
 */
export function portShiftLine(shift: PortShift): string {
  const percent = Math.round(PORT_SHIFT_FRACTION * 100);
  const way = shift.direction > 0 ? "higher" : "lower";
  return `${shift.port}: every price ${percent} percent ${way}`;
}
