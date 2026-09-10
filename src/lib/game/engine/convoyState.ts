// =====================================================================
// [MANIFEST 04: Convoy Ventures] The client side Gold effects of backing
// and settling a convoy venture. The venture's own math (contribution
// caps, deadline windows, payout rates) is pure and already lives in
// ../convoy.ts; this file is only the part that moves money.
// =====================================================================
import type { GameState } from "../types";

// [MANIFEST 04: Convoy Ventures] Escrows a contribution immediately, the
// same moment barter posting escrows an offer (see postBarterOffer) rather
// than waiting for the venture to actually resolve. The server (see
// src/server/realtime.ts) is the one authority on whether this contribution
// actually landed (a venture that filled or expired between the click and
// the server's response never reaches this call at all), so this only ever
// runs once the server has already confirmed the contribution was accepted.
export function contributeToVenture(
  state: GameState,
  amount: number,
  logs: string[],
) {
  if (amount <= 0) return;
  if (state.money < amount) {
    logs.push(
      `❌ Need ${amount} Gold to back that Convoy Venture, have ${state.money}`,
    );
    return;
  }
  state.money -= amount;
  logs.push(`⚓ Backed a Convoy Venture with ${amount} Gold`);
}

// [MANIFEST 04: Convoy Ventures] The payout side, for any of three outcomes.
// Fired once per contributor, by the server, the moment a venture resolves:
// "filled" (amount is this contributor's proportional share of targetGold
// times CONVOY_VENTURE_PAYOUT_MULTIPLIER), "failed" (amount is
// CONVOY_VENTURE_FAILURE_REFUND_RATE of what they originally put in, their
// own venture ran out its own deadline round short of target), or
// "destroyed" (amount is their full original contribution back, untouched:
// a different venture in the same harbor reached its target first and
// claimed this voyage's one shared chance, so this one never got to run its
// own course and nobody who backed it is penalized for that). Only one
// venture can ever end "filled" in a single voyage; see venture:post and
// venture:contribute in src/server/realtime.ts for where that's enforced.
export function receiveVentureSettlement(
  state: GameState,
  amount: number,
  logs: string[],
  outcome: "filled" | "failed" | "destroyed",
) {
  state.money += amount;
  logs.push(
    outcome === "filled"
      ? `⚓ Convoy Venture filled! Your share: ${amount} Gold`
      : outcome === "failed"
        ? `⚓ Convoy Venture missed its deadline. Partial refund: ${amount} Gold`
        : `⚓ Convoy Venture cancelled: another venture in the harbor already claimed this voyage's one chance. Full refund: ${amount} Gold`,
  );
}
