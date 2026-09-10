// =====================================================================
// Bartering: swapping goods and Gold directly with another captain,
// outside the market entirely.
//
// The escrow on post design is the important part. Posting an offer takes
// the offered goods out of the hold immediately rather than at accept
// time, which is what stops a captain from posting the same stock in two
// offers and having both accepted. Everything that follows (cancel,
// expiry at the end of the phase, and the accepting side) is built around
// that: goods are always in exactly one place, never promised twice.
//
// The offer board itself is shared room state and lives on the server
// (see the barter:* handlers in src/server/realtime.ts). These functions
// are only the local half, moving goods on whichever client they run on.
// Covered by scripts/tests/unit.barter.ts, including the conservation
// invariant across both sides of a completed trade.
// =====================================================================
import type { GameState } from "../types";
import { addOwnedAmount, getOwnedAmount } from "./core";

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

// Returns an escrowed offer to its owner: a canceled offer, or one swept
// up unaccepted when the bartering phase ends.
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
  return true;
}

// The posting side of a completed trade: the offered item was already
// escrowed away in postBarterOffer, so all that's left is to receive
// whatever was requested in return.
export function settleBarterTrade(
  state: GameState,
  requestItem: string,
  requestAmount: number,
  logs: string[],
) {
  addOwnedAmount(state, requestItem, requestAmount);
  logs.push(
    `🤝 Barter offer accepted, received ${requestAmount} ${requestItem}`,
  );
}

export function completeBarterPhase(
  state: GameState,
  refunds: { item: string; amount: number }[],
  logs: string[],
) {
  for (const r of refunds) refundBarterOffer(state, r.item, r.amount, logs);
  logs.push(
    refunds.length
      ? "✅ Bartering ended, unmatched offers returned"
      : "⏭️ Bartering ended",
  );
  state.phase = "worker_mgmt";
}
