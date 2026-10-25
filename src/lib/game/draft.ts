// The path draft and the mid voyage switch. This module is pure and holds
// no state: the deck, the pass, the switch window, and the fee. The hand
// is private and dealt by the server (src/server/realtime/draft); only the
// kept path crosses back, written by applyDraftPath in ./engine/draft.
import {
  DRAFT_DEAL,
  DRAFT_QUARTERMASTER_MIN,
  PATH_SWITCH_FEE_BASE,
  PATH_SWITCH_FEE_MAX,
  PATH_SWITCH_FEE_PER_LEVEL,
  PATH_SWITCH_FROM_ROUND,
  PATH_SWITCH_TO_ROUND,
} from "./constants/paths";
// The ports list is composed at read time, so the refusal follows the
// reader's language.
import { listJoiner, t, tFor, type Locale } from "./i18n";
import { PATH_IDS, type PathId } from "./paths";
import { phaseFace } from "./phases";
import { type Rng } from "./rng";
import type { Phase } from "./types";

// Deck weight per path, the one table a balance pass turns. Typed over
// every path, so a new path is a compile error rather than a silent
// omission.
const DRAFT_DECK_WEIGHTS: Record<PathId, number> = {
  convoy: 1,
  loom: 1,
  aroma: 1,
  free_captain: 1,
  quartermaster: 1,
};

/**
 * The deck's composition for a table size. Three cards a captain, so the
 * deck is dealt out entirely. Largest remainder over the weights keeps the
 * counts summing to the deck size, with ties in record order.
 *
 * The Quartermaster floor is applied last by moving cards from the largest
 * other count. It is a guarantee, not a weight that could be tuned to zero.
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
  // Largest fractional parts first, ties in record order.
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
 * The deck shuffled, matching ./gambit's Fisher-Yates. The shuffle hides
 * the order; the composition above already fixed the counts.
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
 * One hand per seat, in seating order. The last hand takes what is left,
 * so a wrong seat count does not repeat a card.
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
 * The card kept and the rest of the hand. The pick is an index because a
 * floor can deal duplicate paths; an invalid pick returns null, which
 * callers read as a refusal.
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
 * Each rest passed to the seat on its left, wrapping at the table's end.
 * A solo table passes to itself.
 */
export function passLeft(rests: readonly PathId[][]): PathId[][] {
  const seats = rests.length;
  return rests.map((_, seat) => rests[(seat - 1 + seats) % seats]);
}

/**
 * The first card of a silent seat's own hand. Only used once the seat's
 * last socket is gone (see src/server/realtime/draft); a live connection
 * holds the table.
 */
export const DRAFT_AUTO_PICK = 0;

// Rounds three through nine, shared by the panel and the handler.
export function pathSwitchWindow(round: number): boolean {
  const roundNumber = Math.floor(round);
  return (
    Number.isFinite(roundNumber) &&
    roundNumber >= PATH_SWITCH_FROM_ROUND &&
    roundNumber <= PATH_SWITCH_TO_ROUND
  );
}

// The port seats, where the books are open: Market, Orders, Parley. The
// predicate is shared by the handler that publishes a switch and the
// engine that charges for one. The list itself is not exported; refusals
// use pathSwitchPortsList below.
const PATH_SWITCH_PHASES: readonly Phase[] = ["market", "orders", "parley"];

/**
 * Whether a wire value is one of the switch seats. Unknown phases are
 * refused, not guessed at.
 */
export function pathSwitchPhase(phase: unknown): boolean {
  return (
    typeof phase === "string" &&
    (PATH_SWITCH_PHASES as readonly string[]).includes(phase)
  );
}

/**
 * The seats above, named for the refusal that turns a switch away. Reads
 * the same list as the predicate and the same phase names as every screen,
 * so a refusal cannot name a seat the rule does not open.
 */
export function pathSwitchPortsList(locale?: Locale): string {
  const names = PATH_SWITCH_PHASES.map((phase) =>
    locale === undefined
      ? t(phaseFace(phase).label)
      : tFor(locale, phaseFace(phase).label),
  );
  return locale === undefined
    ? t("{nameList} or {lastName}", {
        nameList: names.slice(0, -1).join(listJoiner()),
        lastName: names[names.length - 1],
      })
    : tFor(locale, "{nameList} or {lastName}", {
        nameList: names.slice(0, -1).join(listJoiner(locale)),
        lastName: names[names.length - 1],
      });
}

/**
 * Linear in Renown with a ceiling, matching renownStartingGoldBonus. The
 * first rung pays the base; the level is floored to at least one, so a
 * damaged save pays the base rather than less.
 */
export function pathSwitchFee(renownLevel: number): number {
  const rung = Math.max(1, Math.floor(renownLevel) || 1);
  return Math.min(
    PATH_SWITCH_FEE_MAX,
    PATH_SWITCH_FEE_BASE + PATH_SWITCH_FEE_PER_LEVEL * (rung - 1),
  );
}

/**
 * The switch round, or zero for never. Nonsense reads as never, so a corrupt
 * field cannot spend the voyage's one switch.
 */
export function normalizePathSwitchRound(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.floor(value);
}
