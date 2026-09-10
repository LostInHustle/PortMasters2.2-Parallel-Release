// Pure functions for Manifest 05: Backing, extracted out of
// attachRealtime's aid:repay closure in src/server/realtime.ts for the same
// reason convoy.ts's functions were: so a regression in the shortfall and
// coverage math shows up in a fast, deterministic test, not only in a live
// multi captain run against a real server.

type BackingResolution = {
  calledAmount: number;
  refundAmount: number;
};

// Called once a debt is finally settled, whether repaid voluntarily or
// through the forced Round 8 settlement (see settleOutstandingDebts in
// src/lib/game/engine.ts). repaidAmount is whatever the borrower actually
// got to the lender directly; any gap below the loan's original amount is
// exactly what the backer, if any, is on the hook for, up to whatever they
// themselves pledged, never more.
export function computeBackingResolution(
  loanAmount: number,
  repaidAmount: number,
  backedAmount: number,
): BackingResolution {
  const shortfall = Math.max(0, loanAmount - repaidAmount);
  const calledAmount = Math.min(shortfall, backedAmount);
  const refundAmount = backedAmount - calledAmount;
  return { calledAmount, refundAmount };
}
