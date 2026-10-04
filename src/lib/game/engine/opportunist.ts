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
// [F6: charters at leg four] The Factor is the borrow's second door. The
// plan's trio offers the charter to a Free Captain among their own pair,
// and every other path can draw it as its wildcard, and its text sells
// the borrow itself to whoever holds it: "Borrowing is open three times a
// voyage, and each borrow carries a 60% penalty." A charter the four
// other paths could take and gain nothing from would be a trap inside a
// trio, which is the dishonesty the plan's own Letter of Marque note
// warns about, so the charter opens the door to its holder and the
// readers below answer in its terms: the allowance becomes the charter's
// count rather than the path's one, the penalty becomes the charter's
// rate, and the borrow's lead names the door it came through. The Free
// Captain who takes it trades up in open doors and down in price, which
// is the same trade every other taker makes, and none of it writes a
// second field: the charter is one id on the state, and everything here
// is a reading of it.
//
// What is here: the allowance, who may spend it (the path, or the charter
// that buys the door), what the payout becomes, the one line the board
// and the ledger both print, and the healing. What is not here: the order
// it is spent on. That is the order board's, and this module deliberately
// does not import it (see the note on the lock below), so the rule can be
// read without the board and the board can read the rule without a cycle.
//
// Pure: no socket, no database, no clock. The one switch this feature
// reads is the one its locked cards already read, and it is judged in
// ./flags, which is where the epic keeps that policy.
// =====================================================================
import { cardByFlag, cardText } from "../cards";
import { OPPORTUNIST_PENALTY, OPPORTUNIST_USES } from "../constants/paths";
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
 * Whether the locked cards are this captain's to open at all.
 *
 * [F6: charters at leg four] Two doors, one reader: the path that owns
 * the ability, and the Factor, the charter whose text sells the borrow
 * itself to whoever holds it. Written here rather than at its two call
 * sites (the guard below and the board's spent line) because it is a
 * rule about who may borrow, and the board asking the rule module rather
 * than answering the question itself is what keeps a button and a
 * refusal from coming apart. A flag carrying no positive number is no
 * door, the same fallback opportunistAllowance takes.
 */
export function opportunistIsBorrower(
  state: Pick<GameState, "path" | "modifierFlags">,
): boolean {
  if (state.path === OPPORTUNIST_PATH) return true;
  return (state.modifierFlags.factor_borrows || 0) > 0;
}

/**
 * What this voyage's allowance is: the path's one borrow, or the three
 * the Factor opens.
 *
 * [F6: charters at leg four] The charter replaces the base count rather
 * than adding to it, because its text promises a number ("Borrowing is
 * open three times a voyage") rather than an increment, and the moment
 * is at leg four: a captain who spent the base borrow before the charter
 * arrived holds the same three after it, so the reading has to be one
 * number rather than a running sum. Zero or absent reads as the base
 * count, the fallback INCOME_TAX_RATE's own reader takes: a flag that
 * carries no number has not retuned anything, and a doctored save cannot
 * buy an allowance of nothing.
 */
export function opportunistAllowance(
  state: Pick<GameState, "modifierFlags">,
): number {
  return state.modifierFlags.factor_borrows || OPPORTUNIST_USES;
}

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
 * What is left of the allowance: opportunistAllowance above minus what is
 * spent, floored at zero so a save that spent more than this build allows
 * reads as none left rather than as a debt. The number the board prints
 * and the number the borrow is actually bounded by, one reader for both,
 * and the total it counts from is the allowance reader's, so the Factor's
 * three is the same number on the card and in the guard.
 */
export function opportunistBorrowsLeft(
  state: Pick<GameState, "opportunistBorrows" | "modifierFlags">,
): number {
  return Math.max(
    0,
    opportunistAllowance(state) - opportunistBorrowsTaken(state),
  );
}

/**
 * Whether this captain may set a given lock aside.
 *
 * The switch is read first and separately from the door, the reading every
 * other ability reader in this tree takes: the flag is the operator's
 * rollback and the door is the captain's own, and a build with the feature
 * off must refuse a Free Captain as flatly as it refuses everyone else.
 * The rollback is D2's own switch, which is deliberate rather than a
 * shortcut: this ability exists only where a locked order does, so taking
 * the locks off the board (see pathOrdersOn) takes the borrow with them
 * and leaves nothing durable behind, exactly as the plan's rollback clause
 * asks.
 *
 * The door itself is opportunistIsBorrower's answer and not a comparison
 * written here, because [F6: charters at leg four] gave the ability a
 * second way in: the Factor's holder borrows without holding the path,
 * and the board's spent line asks the same question of the same reader.
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
 * only matches a read written where it happens (see flagOnFor).
 */
export function opportunistMayBorrow(
  state: Pick<
    GameState,
    "path" | "opportunistBorrows" | "mode" | "modifierFlags"
  >,
  locked: PathId | null,
): boolean {
  if (!pathOrdersOn(state.mode)) return false;
  if (!opportunistIsBorrower(state)) return false;
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
 * exactly why the spelling is not the thing to leave to chance: [F6:
 * charters at leg four] retunes this number through the Factor, and the
 * reader takes the state so the retune moves the arithmetic without
 * writing a second copy of it here. The rate is read the way the
 * allowance is, the state's flag with the constant as the fallback, so a
 * captain whose books the Factor keeps pays the heavier sixty percent
 * everywhere this function is asked, which is the board and the fill.
 * The clamp at zero is for a penalty retuned past one, where the
 * arithmetic would otherwise owe the captain a negative payout.
 */
export function opportunistPayout(
  state: Pick<GameState, "modifierFlags">,
  reward: number,
): number {
  const penalty = state.modifierFlags.factor_penalty || OPPORTUNIST_PENALTY;
  const face = Math.max(0, Math.floor(reward));
  return Math.max(0, face - Math.round(face * penalty));
}

/**
 * The lead the borrow's one sentence is printed under: the name of the
 * door it came through.
 *
 * [F6: charters at leg four] Only one of the two doors is the Free
 * Captain's, so the lead cannot be typed: a Quartermaster borrowing on
 * the Factor's warrant is not a Free Captain, and a ledger line calling
 * them one would be a receipt contradicting the card that paid it. The
 * Factor's name is read off the record rather than typed, the same
 * reading every other card lead in this tree takes (see cardLead in
 * ../cards), and the bare word is the fallback for a flag a save carries
 * without the card to account for it.
 */
function borrowLead(state: Pick<GameState, "path" | "modifierFlags">): string {
  if (state.path === OPPORTUNIST_PATH) return "🎭 Free Captain";
  const factor = cardByFlag("factor_borrows");
  return factor === null ? "🎭 Borrow" : `🎭 ${cardText(factor).name}`;
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
export function opportunistLine(
  state: Pick<GameState, "path" | "modifierFlags">,
  reward: number,
  payout: number,
): string {
  return `${borrowLead(state)}: ${payout} Gold instead of ${reward}. One order filled without joining the path.`;
}

/**
 * What the card owes a captain who still has the allowance: how much of it
 * is left.
 *
 * A sentence rather than a bare number on the card, and it is printed
 * before the press rather than after it, because a one shot ability a
 * captain discovers they had already used is a rule taught by surprise.
 * The count is opportunistBorrowsLeft's and the total is
 * opportunistAllowance's, so a card, a screen reader and the guard that
 * refuses the next borrow are one number, and a Factor holder reads "of
 * 3" from the same reader the guard spends against.
 */
export function opportunistUsesLine(
  state: Pick<GameState, "opportunistBorrows" | "modifierFlags">,
): string {
  return `🎭 Borrows left this voyage: ${opportunistBorrowsLeft(state)} of ${opportunistAllowance(state)}.`;
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
