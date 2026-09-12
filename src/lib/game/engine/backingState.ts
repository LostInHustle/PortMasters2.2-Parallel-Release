// =====================================================================
// [MANIFEST 05: Backing] The client side Gold effects of backing another
// captain's loan. The resolution math itself (how much of a pledge is
// actually called on versus returned) is pure and already lives in
// ../backing.ts; this file is only the part that moves money on whichever
// client it runs on.
//
// grantHelperReputation is imported from ./aid rather than duplicated,
// because lending and backing share one per voyage Reputation ceiling.
// =====================================================================
import { BACKING_REPUTATION_PER_GOLD } from "../constants";
import type { GameState } from "../types";
import { ageBackingReputationMultiplier } from "./ages";
import { grantHelperReputation } from "./aid";

// [MANIFEST 05: Backing] Escrows a pledge immediately, the same escrow on
// commitment timing every other cross player commitment in this game
// already uses. The server (see backing:offer in src/server/realtime.ts)
// is what actually decided how much of the requested pledge a loan still
// has room for, the same relationship venture contributions have with
// their own overflow cap, so amount here is always already the correct,
// server confirmed figure, never the raw request.
export function pledgeBacking(
  state: GameState,
  amount: number,
  logs: string[],
) {
  if (amount <= 0) return;
  if (state.money < amount) {
    logs.push(`❌ Need ${amount} Gold to back that loan, have ${state.money}`);
    return;
  }
  state.money -= amount;
  logs.push(`🛡️ Pledged ${amount} Gold to back a fellow captain's loan`);
}

// [MANIFEST 05: Backing] The backer's own side of however the loan they
// backed actually resolved. refundAmount is whatever was never called on
// and comes back untouched; calledAmount is whatever genuinely went to
// cover the lender's shortfall and is gone for good. The Reputation bonus
// only applies when nothing at all was called, since that's the case the
// backer's own real risk never actually needed catching, see
// BACKING_REPUTATION_PER_GOLD.
export function receiveBackingOutcome(
  state: GameState,
  refundAmount: number,
  calledAmount: number,
  logs: string[],
) {
  if (refundAmount > 0) state.money += refundAmount;
  if (calledAmount <= 0) {
    // [MANIFEST 10: Ages of the Ledger] The Lender's Age pays half again
    // for a pledge that came home whole. The multiplier is applied to the
    // raw figure, before the shared helper ceiling inside
    // grantHelperReputation, which is what stops an Age from lifting a
    // captain past the one ceiling lending and backing answer to together.
    const base = Math.floor(refundAmount * BACKING_REPUTATION_PER_GOLD);
    const multiplier = ageBackingReputationMultiplier();
    const repGain = grantHelperReputation(
      state,
      Math.floor(base * multiplier),
      logs,
    );
    if (multiplier > 1 && base > 0)
      logs.push(
        `⚖️ Age of the Lender: a pledge that comes home whole pays ${Math.round((multiplier - 1) * 100)}% more while it holds the harbor.`,
      );
    logs.push(
      repGain > 0
        ? `🛡️ Your backing was never called on. Pledge returned in full: ${refundAmount} Gold. Reputation +${repGain} for the risk paying off.`
        : `🛡️ Your backing was never called on. Pledge returned in full: ${refundAmount} Gold.`,
    );
  } else if (refundAmount > 0) {
    logs.push(
      `🛡️ Your backing partially covered a captain's shortfall: ${calledAmount} Gold spent, ${refundAmount} Gold returned.`,
    );
  } else {
    logs.push(
      `🛡️ Your backing fully covered a captain's shortfall: all ${calledAmount} Gold pledged was spent helping the lender.`,
    );
  }
}

// [MANIFEST 05: Backing] The lender's side of a called backing pledge,
// arriving separately from, and in addition to, whatever the borrower
// themselves managed to pay through the ordinary receiveRepayment above.
// From the lender's perspective these are two distinct, unrelated
// captains paying them, so they arrive as two distinct calls rather than
// one merged figure.
export function receiveBackedCoverage(
  state: GameState,
  amount: number,
  backerName: string,
  borrowerName: string,
  logs: string[],
) {
  state.money += amount;
  logs.push(
    `🛡️ ${backerName} covered ${amount} Gold of ${borrowerName}'s shortfall as a backer.`,
  );
}
