// =====================================================================
// PortMasters 2.2 Parallel Release: the draft, and the switch.
//
// [D7: the draft, and switching] The plan's clause, and the whole of it:
// "Deal each captain three path cards face down from a deck seeded so at
// least two Quartermaster cards are in circulation. Keep one, pass two to
// the left, keep one of the two received, pass one, discard the last. Then
// switching: once per voyage, at a port, legs three through nine,
// forfeiting unfulfilled pathbound orders and paying a Refit fee scaled to
// Renown, and the switch is published to the fleet log where everyone
// sees it."
//
// This module is the rule half of that sentence and holds no state, no
// clock and no socket: the deck, the pass, the window (both the legs it
// spans and the seats it opens on) and the fee. The hand a captain is
// dealt is private information and is dealt by the server (see
// src/server/realtime/draft), which is the plan's own reason ("a hand of
// cards is private information and the client cannot be trusted to deal
// it"), and the one thing that crosses back into a save is the path a
// captain kept, written by the engine half (see applyDraftPath in
// ./engine/draft).
//
// The reading of the pass rule, written down here because the sentence
// carries two keeps and one discard and a reader is owed the arithmetic:
// a captain holds two cards when the passing is done, the one they kept
// from their dealt three and the one they kept from the two they received,
// and the last step is the discard that leaves them one path. Which of the
// two the captain keeps is the captain's own, and that is the reading
// rather than a taste: the other way to read "discard the last", as a
// discard prescribed to the second keep, would leave the dealt three
// unable to change the outcome if the first keep were held, and the
// received pair unable to change it if the second were, and the plan's own
// evaluation asks that "taking it is a choice somebody makes rather than a
// duty somebody gets assigned".
//
// Every function here is pure, so the suite can hold the whole rule
// without a server, which is the shape D6's opportunist module set.
// =====================================================================
import {
  DRAFT_DEAL,
  DRAFT_QUARTERMASTER_MIN,
  PATH_SWITCH_FEE_BASE,
  PATH_SWITCH_FEE_MAX,
  PATH_SWITCH_FEE_PER_LEVEL,
  PATH_SWITCH_FROM_ROUND,
  PATH_SWITCH_TO_ROUND,
} from "./constants/paths";
import { PATH_IDS, type PathId } from "./paths";
import { phaseFace } from "./phases";
import { type Rng } from "./rng";
import type { Phase } from "./types";

/**
 * How much of the deck each path is worth, as a weight.
 *
 * The plan's iteration note is why this is a table rather than a constant
 * in the deal: "Tune the deck composition separately from the pass rules,
 * because those are two different knobs and the proposal's balance targets
 * will move the first one repeatedly." The weights are level today, which
 * puts five paths on the plan's own twelve to twenty eight percent band by
 * construction rather than by tuning, and the entry a reader is looking
 * for is the one they would turn: a heavier weight is a path the fleet
 * meets more often.
 *
 * It is typed as a record of every path, so the day a sixth path lands in
 * ./paths this table is a compile error rather than a path that silently
 * never appears in a draft, which is the same property the id type itself
 * was built for.
 *
 * It is not exported, and that is the tuning knob's own reading rather than
 * a habit: this is the one table a balance pass turns, and a table is turned
 * where it is written. Nothing outside this module has an opinion about the
 * weights, which is what the composition below being their only reader says.
 */
const DRAFT_DECK_WEIGHTS: Record<PathId, number> = {
  convoy: 1,
  loom: 1,
  aroma: 1,
  free_captain: 1,
  quartermaster: 1,
};

/**
 * The deck's composition for a table of this size, by path.
 *
 * Three cards a captain, so the deck is dealt out entirely and the deal is
 * the deck: `DRAFT_DEAL` sizes it below and slices it in draftHands, which
 * is one number read in the two places that make a deck and a deal rather
 * than a size and a deal being two numbers that have to agree.
 *
 * The split is largest remainder over the weights, which is the method
 * that keeps the counts summing to the deck size for any table and any
 * weights, and the ties break in the record's own order so that the same
 * table size always produces the same composition.
 *
 * Then the floor, and it is taken last on purpose: the plan asks that the
 * Quartermaster card be "always physically present", which is a guarantee
 * rather than a lean, so whatever the weights say the deck carries at
 * least `DRAFT_QUARTERMASTER_MIN` of them. The cards come off the largest
 * count that is not the seat's, so the floor bends the composition as
 * little as it can, and it is deliberately not expressed as a weight: a
 * knob that can be tuned to zero is not a guarantee.
 */
export function draftComposition(captains: number): Record<PathId, number> {
  const size = Math.max(1, Math.floor(captains)) * DRAFT_DEAL;
  const totalWeight = PATH_IDS.reduce(
    (sum, id) => sum + DRAFT_DECK_WEIGHTS[id],
    0,
  );
  const counts = {} as Record<PathId, number>;
  let placed = 0;
  for (const id of PATH_IDS) {
    counts[id] = Math.floor((size * DRAFT_DECK_WEIGHTS[id]) / totalWeight);
    placed += counts[id];
  }
  // The remainder goes to the largest fractional parts, ties to whichever
  // path comes first in the record, so the composition is a function of the
  // table size alone.
  const byRemainder = [...PATH_IDS].sort((a, b) => {
    const left = (size * DRAFT_DECK_WEIGHTS[a]) / totalWeight - counts[a];
    const right = (size * DRAFT_DECK_WEIGHTS[b]) / totalWeight - counts[b];
    return right - left || PATH_IDS.indexOf(a) - PATH_IDS.indexOf(b);
  });
  for (let i = 0; placed < size; i += 1, placed += 1) {
    counts[byRemainder[i % byRemainder.length]] += 1;
  }
  while (counts.quartermaster < DRAFT_QUARTERMASTER_MIN) {
    let heaviest: PathId | null = null;
    for (const id of PATH_IDS) {
      if (id === "quartermaster") continue;
      if (heaviest === null || counts[id] > counts[heaviest]) heaviest = id;
    }
    if (heaviest === null || counts[heaviest] === 0) break;
    counts[heaviest] -= 1;
    counts.quartermaster += 1;
  }
  return counts;
}

/**
 * The deck, shuffled, in the order it will be dealt.
 *
 * Fisher Yates, written out here the way ./gambit writes it at its own
 * draw, because ./rng carries the generator and not a shuffle and a second
 * shuffle algorithm in the tree would be a second answer to one question.
 * The deck is the composition above, so the Quartermaster floor holds
 * through the shuffle: shuffling is what hides the order, not what decides
 * the counts.
 */
export function draftDeck(captains: number, rng: Rng): PathId[] {
  const counts = draftComposition(captains);
  const deck: PathId[] = [];
  for (const id of PATH_IDS) {
    for (let i = 0; i < counts[id]; i += 1) deck.push(id);
  }
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const held = deck[i];
    deck[i] = deck[j];
    deck[j] = held;
  }
  return deck;
}

/**
 * The hands one deal produces, one hand a captain, in seating order.
 *
 * The deck is dealt out entirely, so a caller that passes the wrong
 * number of seats gets hands that do not sum to the deck rather than hands
 * that quietly repeat a card: the last hand takes what is left, and the
 * deck is sized for the table by draftComposition above.
 */
export function draftHands(
  deck: readonly PathId[],
  captains: number,
): PathId[][] {
  const seats = Math.max(1, Math.floor(captains));
  const hands: PathId[][] = [];
  for (let seat = 0; seat < seats; seat += 1) {
    hands.push(deck.slice(seat * DRAFT_DEAL, (seat + 1) * DRAFT_DEAL));
  }
  return hands;
}

/**
 * The card a captain keeps out of their hand, and what is left of it.
 *
 * A pick is an index rather than a card, and that is not a wire detail: a
 * deck with a floor can hand one captain two cards of the same path, so
 * "keep the Quartermaster" does not name a card. Null is the answer for a
 * pick that is not in the hand, which every caller reads as a refusal
 * rather than as a default, the way normalizePath refuses a path this
 * build does not have.
 */
export function keepFrom(
  hand: readonly PathId[],
  pick: unknown,
): { kept: PathId; rest: PathId[] } | null {
  if (typeof pick !== "number" || !Number.isInteger(pick)) return null;
  if (pick < 0 || pick >= hand.length) return null;
  return {
    kept: hand[pick],
    rest: hand.filter((_, index) => index !== pick),
  };
}

/**
 * What each captain passes, handed to the seat on their left.
 *
 * The plan's direction is "pass two to the left", and left is the next
 * seat in the order the draft was opened with, wrapping at the table's
 * end. The rests are a list in seating order, so the caller never zips two
 * lists by hand and a table of one passes to itself, which is the honest
 * shape of a solo voyage rather than a case to special case.
 */
export function passLeft(rests: readonly PathId[][]): PathId[][] {
  const seats = rests.length;
  return rests.map((_, seat) => rests[(seat - 1 + seats) % seats]);
}

/**
 * The card the server keeps for a captain who let the clock run out.
 *
 * The first card in that captain's own hand, which is a card they were
 * dealt rather than a card the server liked, so a captain who walks away
 * still sails with something from their own deal and the table is not held
 * for them. See the clock in src/server/realtime/draft.
 */
export const DRAFT_AUTO_PICK = 0;

/**
 * Whether a leg is inside the plan's window for a switch: "legs three
 * through nine".
 *
 * Two constants rather than a comparison written out twice, because the
 * panel that offers the switch and the handler that accepts it have to
 * agree about the window and the surest way for that to stay true is one
 * predicate they both call (the shape legIsCold and maroonFrom already
 * take).
 */
export function pathSwitchWindow(round: number): boolean {
  const leg = Math.floor(round);
  return (
    Number.isFinite(leg) &&
    leg >= PATH_SWITCH_FROM_ROUND &&
    leg <= PATH_SWITCH_TO_ROUND
  );
}

// The three seats a captain may change their papers in: the seats where the
// fleet is at the port with its books open.
//
// That is what the plan's "at a port" is read as here, and it is a division
// the lap already makes: Dawn is the anchor coming up, Resolve is the raid
// and the settling of accounts, and Dusk is the yard and the module draft,
// while Market, Orders and Parley are the seats where a captain buys,
// commits to a manifest and talks to the table. A path is what a captain
// does with those three seats, so it is changed among them, and the
// forfeiture a switch costs can bite: the manifest is either not yet dealt
// (Market) or still open (Orders).
//
// This is the port half of the window above, and it is a predicate rather
// than an exported list for the same reason that one is: the handler that
// publishes a switch and the engine that charges for it have to agree about
// where a switch may happen, and the surest way for that to stay true is
// one function they both call. The server reads it because a switch it
// publishes is a fact the whole fleet is shown (see recordPathSwitch in
// src/server/realtime/draft); the engine reads it because the fee and the
// forfeiture are paid in a seat the port allows. What is exported is
// pathSwitchPortsList below and not this list: same three seats, said the
// way the port says them, so a refusal can name them without a second copy
// of them existing to drift.
const PATH_SWITCH_PHASES: readonly Phase[] = ["market", "orders", "parley"];

/**
 * Whether a seat is one a captain may change their papers in.
 *
 * Tolerant about what it is handed, the way every reader of a value that
 * came off the wire is: a phase no lap contains is not a port, and neither
 * is anything that is not a phase at all.
 */
export function pathSwitchPhase(phase: unknown): boolean {
  return (
    typeof phase === "string" &&
    (PATH_SWITCH_PHASES as readonly string[]).includes(phase)
  );
}

/**
 * The seats above, named the way the port names them.
 *
 * The sentence that turns a switch away outside the port is written where
 * the refusals live (see pathSwitchOpenLine in ./engine/draft), and it has
 * to name these three seats. It reads them from here rather than writing
 * them out a second time, because the list above is the one the predicate
 * itself reads: a sentence naming a seat the predicate does not open, or
 * missing one it does, would be a harbor lying about its own rules. The
 * words come from ./phases, which is where every screen reads a seat's
 * name from (see phaseFace), so a captain is refused in the same words the
 * seat is drawn under.
 *
 * It stays here rather than in the engine because this is where the list
 * is. The join is the shape DifficultyAdvisor's own list takes, and the
 * three seats are the plan's clause rather than a count this function has
 * to defend: a phrase of one or two would read as oddly as the clause
 * would.
 */
export function pathSwitchPortsList(): string {
  const names = PATH_SWITCH_PHASES.map((phase) => phaseFace(phase).label);
  return `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
}

/**
 * What a switch costs, in Gold, for a captain of this Renown.
 *
 * Linear in the ladder with a ceiling, the shape renownStartingGoldBonus
 * takes and for its reason: further sailed is dearer, and the ceiling keeps
 * the price inside what a mid voyage purse can answer. The base is what the
 * first rung pays, so the ladder's own floor is the cheapest a switch can
 * be, and the ceiling is reached partway up the ladder and holds for every
 * rung above it, which is what makes it a bound rather than a number
 * nothing reaches (the suite walks the ladder to read it).
 *
 * The level is floored and floored at one, because the ladder's first rung
 * is where every captain starts: a save that reads zero, or a fraction,
 * pays the base rather than less than it.
 */
export function pathSwitchFee(renownLevel: number): number {
  const rung = Math.max(1, Math.floor(renownLevel) || 1);
  return Math.min(
    PATH_SWITCH_FEE_MAX,
    PATH_SWITCH_FEE_BASE + PATH_SWITCH_FEE_PER_LEVEL * (rung - 1),
  );
}

/**
 * The leg a save says this captain switched on, or zero for never.
 *
 * Zero is the absence of a switch rather than a leg, and the reader is
 * strict for the reason every counter this build added is: a save carrying
 * nonsense where the stamp belongs reads as a captain who has not switched
 * rather than as one who has, which is the reading that keeps a corrupt
 * field from refusing a captain the one switch the voyage allows them.
 */
export function normalizePathSwitchLeg(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}
