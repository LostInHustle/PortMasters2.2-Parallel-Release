// =====================================================================
// Bartering: swapping goods and Gold directly with another captain,
// outside the market entirely.
//
// The escrow on post design is the important part. Posting an offer takes
// the offered goods out of the hold immediately rather than at accept
// time, which is what stops a captain from posting the same stock in two
// offers and having both accepted. Everything that follows (withdrawal,
// the sweep when the voyage moves on, and the accepting side) is built
// around that: goods are always in exactly one place, never promised
// twice.
//
// The offer board itself is shared room state and lives on the server
// (see the barter:* handlers in src/server/realtime/index.ts), and the
// board outlives any single phase now that a captain can post from a chat
// at any point in the voyage. So the release of escrow cannot be decided
// here either: it happens on the one client owned by the captain whose
// offer left the board, reported through useBarter's onRefund the moment
// the board stops listing it. These functions are only the local half,
// moving goods on whichever client they run on.
// =====================================================================
import type { GameState } from "../types";
import { ageBarterReputation } from "./ages";
import { addOwnedAmount, getOwnedAmount } from "./core";

// [MANIFEST 10: Ages of the Ledger] The Trader's Age lands Reputation on
// every completed trade, and a trade has two completing sides. Both call
// this so the Age pays them the same: it is the trade that earns it, not
// whichever captain happened to be the one posting the offer.
function awardBarterReputation(state: GameState, logs: string[]) {
  const gain = ageBarterReputation();
  if (gain <= 0) return;
  state.score += gain;
  logs.push(
    `⚖️ Age of the Trader: +${gain} Reputation for the completed trade.`,
  );
}

// [H4: the Broker] The peer ledger: coin that changed hands with another
// captain, net of coin paid to them. The Broker's card is measured on this
// and nothing else, which is why it is counted here rather than where the
// trade is reported. Both sides of every completed trade run through
// exactly one of the two functions below, and nothing else in the engine
// can touch it: a port sale, a wage, a tax, a fine, a loan and a convoy
// payout all move Gold without ever reaching this file, which is exactly
// the distinction the role is made of.
//
// Escrow is deliberately not counted. Posting an offer and having it
// refunded moves Gold and is not a trade, so only settlement counts, and
// the two counted sides read their amounts off the same trade: whatever
// one captain counts as profit the other counts as loss. That zero sum
// property is what the epic's evaluation leans on, and the smoke suite
// asserts it rather than trusting this comment.
//
// Nothing is logged. A line naming this figure would put a Broker's
// progress into the ledger tail another captain can open from the roster
// (see PlayerDetailData), and the card already tells its holder what the
// number is and where it stands.
function awardPeerTradeProfit(
  state: GameState,
  paidItem: string,
  paidAmount: number,
  receivedItem: string,
  receivedAmount: number,
) {
  const paid = paidItem === "Gold" ? paidAmount : 0;
  const received = receivedItem === "Gold" ? receivedAmount : 0;
  if (paid === 0 && received === 0) return;
  state.peerTradeProfit += received - paid;
}

// Posting an offer escrows the offered amount immediately (deducted on the
// spot, the same way buying a card spends gold right away), so a captain
// can't post the same Hemp in two offers at once and double spend it once
// both get accepted. Returns true on success; false (with a log line, no
// state change) if any of the four barter constraints are violated.
export function postBarterOffer(
  state: GameState,
  offerItem: string,
  offerAmount: number,
  requestItem: string,
  requestAmount: number,
  logs: string[],
): boolean {
  if (offerItem === requestItem) {
    logs.push("❌ Can't barter an item for itself");
    return false;
  }
  if (
    !Number.isInteger(offerAmount) ||
    !Number.isInteger(requestAmount) ||
    offerAmount < 1 ||
    requestAmount < 1
  ) {
    logs.push("❌ Barter amounts must be whole numbers of at least 1");
    return false;
  }
  const owned = getOwnedAmount(state, offerItem);
  if (offerAmount > owned) {
    logs.push(`❌ Can't offer ${offerAmount} ${offerItem}, only have ${owned}`);
    return false;
  }
  addOwnedAmount(state, offerItem, -offerAmount);
  logs.push(
    `🤝 Posted a barter offer: ${offerAmount} ${offerItem} for ${requestAmount} ${requestItem}`,
  );
  return true;
}

// Returns an escrowed offer to its owner. Called for a withdrawal the
// captain made, and for an offer the server swept off the board when the
// voyage moved on without anyone taking it.
export function refundBarterOffer(
  state: GameState,
  offerItem: string,
  offerAmount: number,
  logs: string[],
) {
  addOwnedAmount(state, offerItem, offerAmount);
  logs.push(`↩️ Barter offer withdrawn, ${offerAmount} ${offerItem} returned`);
}

// The accepting side of a completed trade: pay the requested item, then
// receive the offered one. The offer's own amounts were already validated
// when it was posted, so the only thing left to check here is that this
// captain actually has enough of the requested item to pay it.
export function acceptBarterOffer(
  state: GameState,
  requestItem: string,
  requestAmount: number,
  offerItem: string,
  offerAmount: number,
  logs: string[],
): boolean {
  const owned = getOwnedAmount(state, requestItem);
  if (requestAmount > owned) {
    logs.push(
      `❌ Can't pay ${requestAmount} ${requestItem}, only have ${owned}`,
    );
    return false;
  }
  addOwnedAmount(state, requestItem, -requestAmount);
  addOwnedAmount(state, offerItem, offerAmount);
  logs.push(
    `🤝 Traded ${requestAmount} ${requestItem} for ${offerAmount} ${offerItem}`,
  );
  awardBarterReputation(state, logs);
  awardPeerTradeProfit(
    state,
    requestItem,
    requestAmount,
    offerItem,
    offerAmount,
  );
  return true;
}

// The posting side of a completed trade: the offered item was already
// escrowed away in postBarterOffer, so all that's left is to receive
// whatever was requested in return.
//
// The escrowed side is passed in rather than read back off the state
// because escrow left no trace there: the goods were taken at post time,
// the offer lives on the server's board, and this is the moment the board
// stops listing it. Both sides of the trade are therefore read off one
// offer, which is what keeps the two captains' ledgers exact mirrors.
export function settleBarterTrade(
  state: GameState,
  requestItem: string,
  requestAmount: number,
  offerItem: string,
  offerAmount: number,
  logs: string[],
) {
  addOwnedAmount(state, requestItem, requestAmount);
  logs.push(
    `🤝 Barter offer accepted, received ${requestAmount} ${requestItem}`,
  );
  awardBarterReputation(state, logs);
  awardPeerTradeProfit(
    state,
    offerItem,
    offerAmount,
    requestItem,
    requestAmount,
  );
}

// Takes the ledger and nothing else, because that is genuinely all the work
// this departure does now: settling the board is no longer part of it, and
// where the phase leads belongs to the lap. The signature used to carry the
// whole game state, and dropping it is the honest reading of what is left.
export function completeBarterPhase(logs: string[]) {
  logs.push("⏭️ Bartering ended");
  // The successor is not named here on purpose. The trade board sits between
  // the same two phases in the founding mode, but the experimental one runs
  // it after the manifest instead of before, so a hardcoded next phase would
  // be the one line in the engine that quietly pinned this board to one
  // voyage's leg. See nextPhase in ./lifecycle.
}
