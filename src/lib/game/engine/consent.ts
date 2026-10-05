// =====================================================================
// PortMasters 2.2 Parallel Release: the consent primitive.
//
// [D4: Loom: the Refit] D3's escort contract and D4's refit are the same
// transaction twice: one captain offers a service at a price, another
// captain accepts it, and each side then moves its own purse. The plan asks
// for one of these rather than two ("the two features share one consent
// primitive rather than growing two"), so this module is the shape itself
// and ./contracts and ./refits are the two things it is about.
//
// What is shared is the whole of the agreement's mechanics: what a fee is,
// which rows a captain sees, when an offer stops being one, what a second
// offer from one seller to one buyer means, what an accept sweeps off the
// board, and the ledger that keeps a reload from moving the same Gold
// twice. None of it names an escort or a refit, a raid or a garment, so a
// third agreement is a third binding rather than a third copy of this file.
//
// What is deliberately not shared is the four things that differ, and each
// one lives with its own kind: who may sell, what the two captains are
// trading (a leg of cover, a garment put right), what an agreement does to
// a state, and which side is bounded to one agreement a leg. A primitive
// that took those as parameters would be a thing every caller has to read
// before it can be used, which is the cost this module exists to avoid.
//
// It reads no switch. The rollback belongs to the kind, because a build
// with the escort off but the refit on is an ordinary build and the two
// switches answer for their own rows (see escortContractsOn in ../flags).
// =====================================================================
import { CONSENT_FEE_MAX, CONSENT_FEE_MIN } from "../constants/paths";
import type { GameState, Phase } from "../types";

/**
 * What every agreement carries, whichever kind it is.
 *
 * The row's own shape is the first thing the two kinds agree on, and it is
 * declared here for the reason the record below it is declared in the game
 * layer: both ends of the wire import this rather than each declaring a
 * shape the other has to be kept in step with. A kind adds its own term
 * (the cover a convoy sells, the garment a loom works on) and narrows the
 * status to the states its own life cycle has, and neither of those is
 * anything this module needs to know.
 *
 * `phase` is the phase the offer was made in, carried on the row rather
 * than compared against a constant, because an offer lives in the phase
 * that made it binding: D3's originally read "parley" where this now reads
 * the row, which is the same rule written once for two kinds that hold
 * their markets in different phases.
 */
export type ConsentTerms = {
  id: string;
  sellerUserId: string;
  sellerName: string;
  // Null on an open offer, which any captain but the seller may take.
  buyerUserId: string | null;
  buyerName: string | null;
  fee: number;
  // The leg the agreement was made for. An accepted agreement stands for
  // the round it was accepted in and is off the board the moment the
  // voyage stands in a later one.
  round: number;
  // The phase it was offered in, which is the phase it expires with.
  phase: Phase;
  // The kind's own life cycle, widened here so both fit under one type.
  status: string;
};

/**
 * A fee as the board will accept it, or null where the value cannot be one.
 *
 * One reader for the two places a fee arrives from outside the engine, the
 * form a seller types into and the payload a socket delivers, so the board
 * and the server cannot disagree about what a price is. A value that is not
 * a number at all, or that lands outside the bounds in ../constants,
 * answers null rather than being clamped: a fee somebody typed wrong is not
 * the fee they meant, and quietly charging a different one is the one
 * behaviour a market cannot have. A fraction is floored instead, because
 * Gold is counted in whole coins and a form that hands back a value a hair
 * over the number somebody typed is a form, not a cheat.
 */
export function consentFeeFor(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const fee = Math.floor(value);
  if (fee < CONSENT_FEE_MIN || fee > CONSENT_FEE_MAX) return null;
  return fee;
}

/**
 * The board as one captain should see it, which is a question about rows
 * rather than about their contents.
 *
 * An open offer is the market and everyone sees it. A direct offer is
 * addressed to one captain and is visible only to its two parties, the same
 * privacy the barter board gives a targeted offer. Anything past the offer
 * stage is public: the price was agreed in the open, and the record of what
 * was agreed is what lets the table read the trade back.
 *
 * What a kind carries *on* a row is its own business, which is why this
 * answers only for which rows come back. The contract above it takes one
 * more pass over what it returns, because the one field it carries that is
 * not public is a field only its own kind has (see visibleContracts in
 * ./contracts).
 */
export function visibleConsent<T extends ConsentTerms>(
  rows: T[],
  userId: string,
): T[] {
  return rows.filter(
    (c) =>
      c.status !== "offered" ||
      c.buyerUserId === null ||
      c.buyerUserId === userId ||
      c.sellerUserId === userId,
  );
}

/**
 * The board after the voyage moves, which is what makes an offer an offer
 * rather than a standing promise.
 *
 * Two expiries and one rule each. An offer lives in the phase it was posted
 * in, because everything offered in that phase is binding once both parties
 * accept, and an offer nobody accepted before the phase closed is not
 * binding on anyone. An accepted agreement lives exactly one leg, which is
 * the round it was made in, so the round it no longer matches is what takes
 * it off the board. Read as a pure function of the list and the checkpoint
 * so the suite can hold both boundaries without a server.
 */
export function expireConsent<T extends ConsentTerms>(
  rows: T[],
  standing: { phase: Phase; round: number },
): T[] {
  return rows.filter(
    (c) =>
      c.round === standing.round &&
      !(c.status === "offered" && standing.phase !== c.phase),
  );
}

/**
 * Whether this seller already has an offer standing for this buyer.
 *
 * One open offer per seller per buyer, where an open offer counts as its
 * own buyer: a seller who is selling to anyone has already said that, and a
 * second identical row would only be a second way to take the same thing.
 * The rule is the board's bound as well as its tidiness. Nothing else caps
 * how many rows a board can hold, and a post costs no escrow the way a
 * barter offer does, so without this a single client could paper the room.
 * With it, a seller's rows are bounded by the table: one open offer and one
 * named offer per other captain, which is the most a market of N captains
 * can mean anything by.
 */
export function consentOfferStanding<T extends ConsentTerms>(
  rows: T[],
  sellerUserId: string,
  buyerUserId: string | null,
): boolean {
  return rows.some(
    (c) =>
      c.status === "offered" &&
      c.sellerUserId === sellerUserId &&
      c.buyerUserId === buyerUserId,
  );
}

/**
 * Whether a row in this state has settled, which is the question every
 * reader of a status past the offer stage is really asking.
 *
 * Two names, and they are the two this tree's kinds produce: an agreement
 * for all of them, and the escort's spent cover, which is that agreement
 * one moment later. Written as the two states that commit rather than as
 * everything past the offer stage, which is how this read used to be
 * written and what it got wrong the moment a kind grew a third state: a row
 * its addressee turned down is every bit as far past the offer stage as an
 * agreement, and it commits nobody. A kind that grows a fourth state adds
 * it here rather than being read in by accident.
 *
 * The three places a status is judged rather than carried read it here: the
 * busy rule below, the escort's cover mirror (see coverFromBoard in
 * ./contracts), and the client relay that reports a settled row to the two
 * captains it names (see useConsentBoard, which fires on this answer rather
 * than on the status having changed at all, so a row that came back is
 * never handed to a machine as a movement to apply).
 */
export function consentSettled(status: string): boolean {
  return status === "agreed" || status === "claimed";
}

/**
 * Whether one side of the table is already committed for the round.
 *
 * Both kinds need this bound and they need it on different sides, which is
 * why the side is a parameter rather than the function being written twice.
 * A convoy's bound is on the buyer, because one captain's cover is one
 * field: a second accepted contract could not be honoured, so the server
 * refuses the second accept. A loom's bound is on the seller, because one
 * captain can put one garment right in a leg, and the second customer would
 * be paying for work that was never done. A seller who may write several
 * contracts wears several claims, which is the risk that path is priced on,
 * and a buyer who may take several refits is simply a customer.
 *
 * An offer is not a commitment, so only a row that settled counts, which is
 * the predicate above rather than the "not an offer" test this used to
 * read: a reader that asked whether a row had stopped being an offer would
 * answer that a captain who said no was covered for the leg.
 */
export function consentPartyBusy<T extends ConsentTerms>(
  rows: T[],
  side: "seller" | "buyer",
  userId: string,
  round: number,
): boolean {
  return rows.some(
    (c) =>
      consentSettled(c.status) &&
      c.round === round &&
      (side === "seller" ? c.sellerUserId : c.buyerUserId) === userId,
  );
}

/**
 * The board after a captain accepts an offer.
 *
 * Accepting writes the buyer onto the row and moves it past the offer
 * stage, and takes every other open offer that named this captain as its
 * buyer off the board in the same pass. That sweep is the one buyer rule
 * above seen from the other side, and it holds for both kinds rather than
 * only for the one that needs it: an offer a captain can no longer take
 * would otherwise sit on the board inviting a second accept the server
 * would have to refuse, and the table would be reading a row that is over.
 */
export function agreeConsent<T extends ConsentTerms>(
  rows: T[],
  contractId: string,
  buyer: { userId: string; name: string },
): T[] {
  return rows
    .filter(
      (c) =>
        c.id === contractId ||
        !(c.status === "offered" && c.buyerUserId === buyer.userId),
    )
    .map((c) =>
      c.id === contractId
        ? {
            ...c,
            status: "agreed",
            buyerUserId: buyer.userId,
            buyerName: buyer.name,
          }
        : c,
    );
}

// =====================================================================
// The ledger: what this captain has already applied to their own purse.
// =====================================================================

/**
 * Whether this movement has already been applied, read through the leg
 * stamp.
 *
 * A ledger left over from an earlier leg answers for nothing: the keys are
 * agreement ids, a leg's agreements are off the board by the next Dawn, and
 * a list that only ever grows is weight in every save the voyage writes.
 * The stamp is what lets the list be emptied at each roll without ever
 * losing a movement that has not settled yet, since both movements of an
 * agreement land in the leg it was agreed in.
 *
 * It is one ledger for both kinds rather than one each, because the two
 * answer the same question about the same count of Gold and the keys are
 * already namespaced by the row's own id. Two ledgers would be two heals,
 * two stamps and two things to remember at the next Dawn, for no fact the
 * first one does not already hold.
 */
export function movementApplied(state: GameState, key: string): boolean {
  return (
    state.settledRound === state.currentRound &&
    state.settledMovements.includes(key)
  );
}

/** Records a movement as applied, on this leg's ledger. */
export function markMovement(state: GameState, key: string): void {
  if (state.settledRound !== state.currentRound) {
    state.settledMovements = [];
    state.settledRound = state.currentRound;
  }
  state.settledMovements = [...state.settledMovements, key];
}

/**
 * The ledger at the top of a leg: emptied, and stamped with the leg it was
 * emptied for.
 *
 * Called where every other per leg fact is cleared (startBoonDrafting, see
 * the call there), and the stamp is written rather than left alone so the
 * list is emptied here rather than at the next movement, which is what
 * keeps the saving small on a voyage where nothing more is agreed.
 */
export function resetConsentLedger(state: GameState): void {
  state.settledMovements = [];
  state.settledRound = state.currentRound;
}

/**
 * Heals a set of save counts, which is a loop both kinds need and neither
 * should own.
 *
 * The fields are the kind's own and the arithmetic is the same for both: a
 * count is floored, and anything that is not a number at all reads as none.
 * It is written once because the second copy of it would be the one that
 * forgot the finite check, and a NaN tally is not merely wrong: it is added
 * straight into a captain's score, and the Ledger Integrity Pass reads an
 * impossible score as a forged one.
 */
export function floorTallies(
  state: GameState,
  fields: readonly string[],
): void {
  const tally = state as unknown as Record<string, unknown>;
  for (const field of fields) {
    const value = tally[field];
    tally[field] =
      typeof value === "number" && Number.isFinite(value)
        ? Math.max(0, Math.floor(value))
        : 0;
  }
}

/**
 * Heals the ledger at the load site, the way every other saved field this
 * build added is healed.
 *
 * The old name is read here for the one save that can carry it: a voyage
 * saved by the build before this one, mid leg, with an agreement already
 * applied. That ledger is exactly what keeps a reload from moving the same
 * Gold twice, so losing it to a rename would be losing the protection
 * rather than tidying a field. The migration reads the field the previous
 * build wrote and the new field wins where both are present, which is the
 * shape every other heal in this tree takes.
 *
 * The list is filtered to strings because it is compared by value: a number
 * in it would never match a key and would silently re-apply a movement.
 */
export function normalizeConsentLedger(
  state: GameState,
  legacy?: { escortSettled?: unknown; escortSettledRound?: unknown },
): void {
  const moved = Array.isArray(state.settledMovements)
    ? state.settledMovements
    : legacy?.escortSettled;
  const round = Number.isFinite(state.settledRound)
    ? state.settledRound
    : legacy?.escortSettledRound;
  state.settledMovements = Array.isArray(moved)
    ? moved.filter((key): key is string => typeof key === "string")
    : [];
  state.settledRound =
    typeof round === "number" && Number.isFinite(round)
      ? Math.max(0, Math.floor(round))
      : 0;
}
