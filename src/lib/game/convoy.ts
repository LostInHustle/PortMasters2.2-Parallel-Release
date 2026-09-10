// =====================================================================
// [MANIFEST 04: Convoy Ventures] Pure decision logic, split out of
// src/server/realtime.ts for the same reason computeHarborPulse was split
// out into harborPulse.ts: this is real Gold math and the one exploit
// prevention rule (one filled venture per voyage, room wide) that a
// doctored client or a race between two captains has to actually be safe
// against, and none of it can be unit tested while it sits nested inside
// attachRealtime's socket closures, where nothing outside a live server
// with a live database could import or exercise it.
//
// The server (src/server/realtime.ts) is still the one authority over
// *when* each of these run and over the one check that genuinely can't be
// pure, hasRoomClaimedVenture, which has to ask the database whether any
// venture in this room's voyage has ever reached "filled". Everything here
// is a plain function of its arguments: parse a stored JSON blob, total a
// contribution map, decide how much of a contribution a venture can
// actually use, decide a settlement's payout rate and per contributor
// amounts, and decide the valid deadline window for a fresh post.
// =====================================================================
import {
  CONVOY_VENTURE_FAILURE_REFUND_RATE,
  CONVOY_VENTURE_PAYOUT_MULTIPLIER,
} from "./constants";

type VentureContribution = { name: string; amount: number };
type VentureContributions = Record<string, VentureContribution>;
export type VentureOutcome = "filled" | "failed" | "destroyed";
export type VentureSettlement = {
  userId: string;
  name: string;
  amount: number;
};

// Deliberately defensive: this parses a JSON column written by this same
// server, but a malformed or hand edited row should degrade to "nobody
// contributed" rather than throw inside a socket handler every other
// captain in the room is waiting on.
export function parseVentureContributions(raw: string): VentureContributions {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    const out: VentureContributions = {};
    for (const [userId, value] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (!value || typeof value !== "object") continue;
      const v = value as { name?: unknown; amount?: unknown };
      if (typeof v.name !== "string" || typeof v.amount !== "number") continue;
      out[userId] = { name: v.name, amount: v.amount };
    }
    return out;
  } catch {
    return {};
  }
}

export function ventureTotal(contributions: VentureContributions): number {
  return Object.values(contributions).reduce((sum, c) => sum + c.amount, 0);
}

// [MANIFEST 04 fix] Two caps stack here, both bounding the same
// contribution request from above:
//
// The overflow cap: a contribution can never push a venture's pooled total
// past its own target. This is what keeps the settlement math exact (a
// filled venture's contributions always sum to precisely targetGold, so
// paying each contributor contribution times CONVOY_VENTURE_PAYOUT_
// MULTIPLIER never needs a proportional share calculation at all) and what
// stops a captain from being charged more Gold than a venture could
// actually use.
//
// The per contributor cap: no single captain may hold more than
// CONVOY_VENTURE_MAX_CONTRIBUTOR_SHARE of a venture's own target across
// every contribution they've made to it. Without this, a captain could
// post a venture and fill the entire target alone in one contribution,
// which both prints free Gold and burns the room's one shared chance for
// personal gain instead of the room's; requiring real headroom to remain
// for someone else is what actually forces genuine multi captain
// participation before a venture can ever fill. Rounded up (not down) so
// two contributors splitting an odd targetGold in half still have exactly
// enough combined room to reach it; rounding down would occasionally leave
// a venture mathematically impossible to ever fill at all.
export function computeAcceptedContribution(
  currentTotal: number,
  targetGold: number,
  requestedAmount: number,
  contributorAlreadyContributed: number,
  maxContributorShare: number,
): number {
  const remainingInTarget = targetGold - currentTotal;
  if (remainingInTarget <= 0) return 0;
  const maxPerContributor = Math.ceil(targetGold * maxContributorShare);
  const remainingForContributor =
    maxPerContributor - contributorAlreadyContributed;
  if (remainingForContributor <= 0) return 0;
  return Math.min(requestedAmount, remainingInTarget, remainingForContributor);
}

// The payout rate for each of the three ways a venture can end. "filled"
// pays out more than was put in; "failed" (a venture's own deadline ran
// out short of target) and "destroyed" (a different venture in the same
// voyage claimed the one shared chance first) both refund, "destroyed" in
// full since the contributor did nothing wrong, "failed" only partially
// since the venture had a real, costly attempt that simply came up short.
function settlementRateFor(outcome: VentureOutcome): number {
  if (outcome === "filled") return CONVOY_VENTURE_PAYOUT_MULTIPLIER;
  if (outcome === "failed") return CONVOY_VENTURE_FAILURE_REFUND_RATE;
  return 1;
}

export function computeSettlements(
  contributions: VentureContributions,
  outcome: VentureOutcome,
): VentureSettlement[] {
  const rate = settlementRateFor(outcome);
  return Object.entries(contributions).map(([userId, c]) => ({
    userId,
    name: c.name,
    amount: Math.round(c.amount * rate),
  }));
}

// [MANIFEST 04 fix] The valid deadline window for a fresh post: never
// sooner than CONVOY_VENTURE_MIN_ROUNDS_AHEAD, and never later than either
// CONVOY_VENTURE_MAX_ROUNDS_AHEAD rounds out or one round short of the
// voyage's own final round, whichever is sooner. A venture that filled on
// the true final round would hand its contributors Gold with no round left
// in which spending it could still raise their final Reputation, so the
// cap always leaves at least one full round free. Returns null when no
// valid deadline remains at all, meaning a fresh post should be refused
// outright rather than offered a window that can't actually exist.
export function computeVentureDeadlineBounds(
  currentRound: number,
  voyageRounds: number,
  minRoundsAhead: number,
  maxRoundsAhead: number,
): { minRound: number; maxRound: number } | null {
  const minRound = currentRound + minRoundsAhead;
  const maxRound = Math.min(currentRound + maxRoundsAhead, voyageRounds - 1);
  if (minRound > maxRound) return null;
  return { minRound, maxRound };
}

// The room wide chat announcement for each outcome, kept alongside the
// settlement math so the two can never quietly drift out of sync with each
// other, the same reasoning WORD_ON_THE_DOCKS_REWARD and its own guide
// copy are both derived from one constant rather than two separate numbers.
export function ventureAnnouncementFor(outcome: VentureOutcome): string {
  if (outcome === "filled") {
    return `⚓ A Convoy Venture filled! Every contributor is paid their share, times ${CONVOY_VENTURE_PAYOUT_MULTIPLIER}x. This harbor's one Convoy Venture chance for this voyage has now been used.`;
  }
  if (outcome === "failed") {
    return `⚓ A Convoy Venture missed its deadline. Every contributor gets back a partial refund.`;
  }
  return `⚓ A Convoy Venture was cancelled: another venture in the harbor already claimed this voyage's one chance. Every contributor gets back their full stake.`;
}
