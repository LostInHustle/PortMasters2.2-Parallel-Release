// =====================================================================
// PortMasters 2.2 Parallel Release: settling money, once.
//
// Two shapes of money move in this tree that were written out twice and
// are written once here.
//
// The first is an agreed trade settling its fee. The escort contract, the
// refit bench and the module trade are one transaction three times: a captain
// offers a service or a thing at a price, another captain takes it, and
// each side then moves its own purse on its own machine. What the three
// agree on is the whole of the settlement: the switch that says the market
// is running, the status that says the row was shaken on, the movement key
// that keeps a reload from moving the same Gold twice, the fee leaving the
// buyer and landing in the seller, and the four counters each kind keeps of
// its own trades. What they do not agree on is which of them it is: the
// flag, the counters, the sentences and the thing itself, a round of cover, a
// garment put right or a module bolted to a hull.
//
// The second is a captain putting their own Gold into something that is not
// a trade at all: a pledge backing a loan, a contribution to a venture.
// Both are one debit and one refusal when the purse is short, and the only
// thing that differs is the sentence each of them writes.
//
// What is deliberately not here is the money a settlement does not own: the
// escort's absorbed raid, which is priced by the guns rather than by an
// agreement, and the barter and market trades, which move goods as well as
// Gold and answer a purse with their own rules.
// =====================================================================
import type { LedgerLine } from "@/lib/game/ledger";
import type { GameState } from "../types";
import { markMovement, movementApplied } from "./consent";
import { addOwnedAmount, paidFee } from "./core";

/**
 * The part of a row a settlement reads, which every kind of agreement
 * carries: the id that names the movement, the status that says whether the
 * row was shaken on, the two captains it names and the fee they agreed.
 *
 * The kinds declare their own rows (see ModuleTrade, RefitContract and
 * EscortContract) and this is the part of those rows the settlement has to
 * be able to read. It is written out here rather than imported from the
 * kinds so that the settlement does not have to know which kinds exist.
 */
type SettleRow = {
  id: string;
  status: string;
  sellerUserId: string;
  buyerUserId: string | null;
  fee: number;
};

/**
 * The four counters a kind of market keeps of its own trades: how many it
 * sold and how many it bought, and what it earned and what it paid.
 *
 * Named rather than typed, because the names are the whole of what differs
 * about them: the escort keeps escortSold and escortBought, the bench keeps
 * refitsSold and refitsBought, and the shipyard keeps modulesSold and
 * modulesBought. A settlement that knew the fields would be a settlement
 * that knew the kinds, and a fourth kind would be a fourth copy of it.
 */
type SettleCounters = {
  bought: string;
  feesPaid: string;
  sold: string;
  feesEarned: string;
};

/**
 * What a settlement needs to know about the kind it is settling: the switch
 * that says the market is running, the status that says the row was shaken
 * on, the row itself, the captain whose own side this is, the four counters
 * to move, the two sentences to write, and the kind's own effect on the
 * thing being traded.
 */
type SettleTerms = {
  /** The switch that says this kind of market is running. */
  on: (mode: unknown) => boolean;
  /** The status a row must read before its fee settles. */
  status: string;
  /** The row the two captains agreed. */
  row: SettleRow;
  /** The captain whose own side this is. */
  meId: string;
  /** The four counters this kind keeps. */
  counters: SettleCounters;
  /** The sentences the two sides write. */
  copy: {
    /** The buyer's line, written with what they actually paid. */
    buyer: (paid: number) => LedgerLine;
    /** The seller's line, written with the fee that was agreed. */
    seller: (fee: number) => LedgerLine;
  };
  /**
   * What the buyer's side does with what it bought, once the fee has moved.
   */
  onBuy?: (state: GameState, logs: LedgerLine[]) => void;
  /**
   * What the seller's side does with what it sold, before the fee lands.
   */
  onSell?: (state: GameState, logs: LedgerLine[]) => void;
  /**
   * What the seller's side records about the sale, once the counters have
   * moved.
   */
  onSold?: (state: GameState, logs: LedgerLine[]) => void;
};

/**
 * One agreed trade settling its fee, on the machine of the captain it
 * belongs to.
 *
 * One function for both sides, and the reason is the reason all three
 * kinds share: the two cases differ in who they are and in which direction
 * the Gold moves, and they agree on everything else, which is who they
 * are, whether the movement has already been applied, and the rule that
 * only the holder of a purse writes to it. What the kind adds is the thing
 * itself, and that is what the three hooks are for: a module leaves a hull
 * before its fee lands and lands on another one after, a garment takes its
 * points back on the buyer's own machine, and an escort covers a round and
 * moves no cargo at all.
 *
 * The ledger is the idempotence: a reload between the agreement and the
 * broadcast that carries it must not move the same Gold twice, and a board
 * that reports the same row again must not move it again either (see
 * movementApplied in ./consent). The key is the row's own id and the word
 * fee, and it is one key for all three kinds because the ids are the rows'
 * own and the round stamp empties the list at each Dawn.
 *
 * The buyer's payment is allowed to be short and the seller is credited
 * the agreed price rather than the payment, and the asymmetry is
 * deliberate. The guard that keeps an honest buyer out of this branch is
 * one layer up, on the desks a captain clicks from, where it is the same
 * predicate every market reads (see canPayFee in ./core). The server has
 * never read a purse, and a sale has to complete on both machines whether
 * the buyer's can cover the fee or not, so a shortfall that reaches this
 * line is a purse that moved between the press and the settle, and the
 * honest answer is the Gold that is actually there rather than a negative
 * hold. What the two captains shook hands on is the price, not the
 * payment.
 *
 * Returns whether the state changed, which is what the React layer reads
 * to decide whether it owes the captain a fresh render.
 */
export function settleConsentTrade(
  state: GameState,
  logs: LedgerLine[],
  terms: SettleTerms,
): boolean {
  if (!terms.on(state.mode)) return false;
  const row = terms.row;
  if (row.status !== terms.status) return false;
  const isSeller = row.sellerUserId === terms.meId;
  const isBuyer = row.buyerUserId === terms.meId;
  if (!isSeller && !isBuyer) return false;
  const key = `${row.id}:fee`;
  if (movementApplied(state, key)) return false;

  // The counters are reached by name because the names are what the kinds
  // differ about, and the read is the same one the heal uses (see
  // floorTallies in ./consent): a count is a count, whatever it is called.
  const tally = state as unknown as Record<string, number>;

  if (isBuyer) {
    const paid = paidFee(state, row.fee);
    addOwnedAmount(state, "Gold", -paid);
    tally[terms.counters.bought] += 1;
    tally[terms.counters.feesPaid] += paid;
    logs.push(terms.copy.buyer(paid));
    terms.onBuy?.(state, logs);
  } else {
    terms.onSell?.(state, logs);
    addOwnedAmount(state, "Gold", row.fee);
    tally[terms.counters.sold] += 1;
    tally[terms.counters.feesEarned] += row.fee;
    terms.onSold?.(state, logs);
    logs.push(terms.copy.seller(row.fee));
  }
  markMovement(state, key);
  return true;
}

/**
 * The two sentences a debit writes: the one that says the purse is short,
 * and the one that says the Gold has gone.
 */
type GoldDebitCopy = {
  /** The line that says the purse cannot cover it. */
  short: LedgerLine;
  /** The line that says the Gold has been committed. */
  taken: LedgerLine;
};

/**
 * A captain committing their own Gold to something, and the refusal when
 * they cannot.
 *
 * A pledge and a venture contribution are the same debit, and the only
 * thing that differs between them is the sentence each writes, so the
 * debit is written once. The refusal is the half that matters: a captain
 * who cannot cover it is told what they have and what they need rather
 * than being left to find out, and nothing is taken from a purse that
 * cannot cover it, because a captain who was refused a pledge still holds
 * the Gold they meant to pledge.
 *
 * A pledge of nothing is not a debit and writes no line at all: the server
 * has already sized the loan and the venture has already been accepted, so
 * the amount that arrives here is either a real figure or nothing, and
 * nothing is nothing.
 */
export function debitGold(
  state: GameState,
  amount: number,
  logs: LedgerLine[],
  copy: GoldDebitCopy,
): void {
  if (amount <= 0) return;
  if (state.money < amount) {
    logs.push(copy.short);
    return;
  }
  state.money -= amount;
  logs.push(copy.taken);
}
