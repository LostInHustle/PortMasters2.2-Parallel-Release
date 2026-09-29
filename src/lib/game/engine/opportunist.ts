// =====================================================================
// PortMasters 2.2 Parallel Release: the Free Captain's borrow.
//
// [D6: Free Captain: Opportunist] The plan hands this path the honest
// version of what the paywall was reaching for. Once a voyage, a Free
// Captain fills any one pathbound order without joining its path, at a
// forty percent payout penalty. The plan says why that is the right shape
// and it is worth keeping where the rule lives: the locked card stays
// tantalizing, it stays reachable, and the reach costs something real,
// while the cost is zero dollars. What the captain spends is a once a
// voyage allowance and a fifth of their payout on that one order, and a
// price that is not money is the whole reason the plan calls it honest.
//
// What is here: the allowance, who may spend it, what the payout becomes,
// the one line the board and the ledger both print, and the healing. What
// is not here: the order it is spent on. That is the order board's, and
// this module deliberately does not import it (see the note on the lock
// below), so the rule can be read without the board and the board can
// read the rule without a cycle.
//
// Pure: no socket, no database, no clock. The one switch this feature
// reads is the one its locked cards already read, and it is judged in
// ./flags, which is where the epic keeps that policy.
// =====================================================================
import { OPPORTUNIST_PENALTY, OPPORTUNIST_USES } from "../constants";
import { pathOrdersOn } from "../flags";
import type { PathId } from "../paths";
import type { GameState } from "../types";

/**
 * The path whose ability is the borrow, as a reading of the record rather
 * than a second name for it, the same way the escort's seller path, the
 * Loom's bench and the bazaar's desk are read.
 */
export const OPPORTUNIST_PATH: PathId = "free_captain";

/**
 * How many borrows this voyage has already spent.
 *
 * Floored and clamped at the reader rather than trusted from the save, the
 * reading every other tally in this tree takes (see floorTallies in
 * ./consent, which heals them at the load site): a fraction is read as the
 * whole borrows it can stand for, so a counter can never spend a borrow and
 * a half, and a negative reads as nothing spent, which is the direction
 * this clamp goes and the one worth naming out loud: the counter is the
 * captain's own saved voyage, so the most a doctored save buys is a borrow
 * its author already used, while clamping the other way would spend an
 * honest captain's allowance over a number they never wrote.
 */
export function opportunistBorrowsTaken(
  state: Pick<GameState, "opportunistBorrows">,
): number {
  return Math.max(0, Math.floor(state.opportunistBorrows));
}

/**
 * What is left of the allowance: OPPORTUNIST_USES minus what is spent,
 * floored at zero so a save that spent more than this build allows reads
 * as none left rather than as a debt. The number the board prints and the
 * number the borrow is actually bounded by, one reader for both.
 */
export function opportunistBorrowsLeft(
  state: Pick<GameState, "opportunistBorrows">,
): number {
  return Math.max(0, OPPORTUNIST_USES - opportunistBorrowsTaken(state));
}

/**
 * Whether this captain may set a given lock aside.
 *
 * The switch is read first and separately from the path, the reading every
 * other ability reader in this tree takes: the flag is the operator's
 * rollback and the path is the captain's identity, and a build with the
 * feature off must refuse a Free Captain as flatly as it refuses everyone
 * else. The rollback is D2's own switch, which is deliberate rather than a
 * shortcut: this ability exists only where a locked order does, so taking
 * the locks off the board (see pathOrdersOn) takes the borrow with them
 * and leaves nothing durable behind, exactly as the plan's rollback clause
 * asks.
 *
 * The lock is taken as an argument rather than looked up here, and that is
 * what keeps this module and ./engine/orders from importing each other:
 * the caller already holds the engine's own answer (lockedBehind) and
 * passes it in, so there is one reading of which path a card waits on and
 * no second copy of it. A null lock is not this captain's to borrow,
 * because it is not locked to them at all.
 *
 * The flag read is written out in full at this line rather than passed by
 * name, which is the browser's rule and not a taste in signatures: a
 * bundle is handed the values it was built with by a substitution that
 * only matches a read written where it happens (see flagOn).
 */
export function opportunistMayBorrow(
  state: Pick<GameState, "path" | "opportunistBorrows">,
  locked: PathId | null,
): boolean {
  if (!pathOrdersOn()) return false;
  if (state.path !== OPPORTUNIST_PATH) return false;
  if (locked === null) return false;
  return opportunistBorrowsLeft(state) > 0;
}

/**
 * What a borrowed order actually pays: the face value less the penalty,
 * with the deduction rounded rather than the remainder.
 *
 * `reward - round(reward * penalty)` and never `round(reward * (1 -
 * penalty))`, and the difference is the tree's own floating point lesson
 * read from the other end. The captain keeps what the house does not take,
 * so the deduction is the number that gets rounded, and rounding the
 * remainder instead would hand back the whole penalty on the smallest
 * orders: at a quarter penalty a two Gold order keeps `2 - round(0.5)`, a
 * coin, while `round(2 * 0.75)` is two and the borrow would have paid full
 * price. Forty percent happens to agree in both spellings today, which is
 * exactly why the spelling is not the thing to leave to chance: F6
 * retunes this number. The clamp at zero is for a penalty retuned past
 * one, where the arithmetic would otherwise owe the captain a negative
 * payout.
 */
export function opportunistPayout(reward: number): number {
  const face = Math.max(0, Math.floor(reward));
  return Math.max(0, face - Math.round(face * OPPORTUNIST_PENALTY));
}

/**
 * The one sentence the borrow is described with, printed on the card that
 * offers it and written into the ledger when it is spent.
 *
 * One carrier for the two, for the reason pathLockLine is one carrier for
 * the board and the refusal: a captain reading the card and a captain
 * reading the log are reading about one transaction, and two strings
 * would be two accounts of it. It names both numbers because the penalty
 * is the price of the ability and a reader who sees only the smaller one
 * has been told what they get and not what it cost.
 */
export function opportunistLine(reward: number, payout: number): string {
  return `🎭 Free Captain: ${payout} Gold instead of ${reward}. One order filled without joining the path.`;
}

/**
 * What the card owes a captain who still has the allowance: how much of it
 * is left.
 *
 * A sentence rather than a bare number on the card, and it is printed
 * before the press rather than after it, because a one shot ability a
 * captain discovers they had already used is a rule taught by surprise.
 * The count is opportunistBorrowsLeft's, so a card, a screen reader and
 * the guard that refuses the second borrow are one number.
 */
export function opportunistUsesLine(
  state: Pick<GameState, "opportunistBorrows">,
): string {
  return `🎭 Borrows left this voyage: ${opportunistBorrowsLeft(state)} of ${OPPORTUNIST_USES}.`;
}

/**
 * What the card owes a captain whose allowance is gone, printed where the
 * borrow button stood.
 *
 * It says the order stays locked rather than only that the borrow is
 * spent, because the two halves of that sentence are the whole of what
 * happened: the card is not theirs again, and the reason is the one they
 * spent.
 */
export const OPPORTUNIST_SPENT_LINE =
  "🎭 Your borrow is spent, and the order stays locked.";

/**
 * Heals the counter at the load site, the way every other field this build
 * added is healed, and no voyage saved before this feature carries one: a
 * save from before D6 reads as a captain who has never borrowed anything,
 * which is the right reading of a voyage that predates the ability.
 *
 * A value that is not a number heals to zero rather than to a guess, which
 * is the direction the healing goes: the failure this prevents is a save
 * that cannot be read handing back a fresh borrow on every reload, and the
 * failure it accepts is a captain who does not get to spend one. The
 * reader clamps anyway (see opportunistBorrowsTaken), so a value this
 * healing lets through cannot do arithmetic it should not.
 */
export function normalizeOpportunistBorrows(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw)
    ? Math.max(0, Math.floor(raw))
    : 0;
}
