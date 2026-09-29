export const PORTS_TIER0 = [
  "Quanzhou Port",
  "Guangzhou Port",
  "Ningbo Port",
  "Yangzhou Port",
  "Hangzhou Port",
] as const;
export const PORTS_TIER1 = ["Fuzhou Port", "Goryeo Port"] as const;
export const PORTS_TIER2 = ["Srivijaya Port", "Dashi Port"] as const;

// Broker's Favor: a Renown gated, once per voyage skill a captain invokes in
// Orders to summon one extra guaranteed trade order for a chosen quantity of
// a good they are already holding, so a hold full of otherwise unsellable
// stock still has a buyer. Unlocks at Renown Level 5 (the Trade Officer
// tier, see src/lib/game/legacy.ts). A captain may ask for any quantity up
// to their full hold; the Broker's commission (see brokersFavorCommission in
// engine.ts) is a saturating curve rather than a flat rate, so net payout
// approaches this cap but can never exceed it, no matter how large the ask.
export const BROKERS_FAVOR_UNLOCK_LEVEL = 5;
export const BROKERS_FAVOR_PAYOUT_CAP = 200;

// [MANIFEST 02: Word on the Docks] A room wide race, layered alongside the
// scheduled Imperial Mandates above rather than replacing them: whichever
// captain is first in the harbor to complete this many trade orders across
// the whole voyage (cumulative, not per round, see GameState.
// totalOrdersCompleted) wins a flat Gold reward, announced to the room the
// moment it happens. Deliberately tier independent, same reward and same
// threshold on every difficulty, since the point is a spontaneous race
// between real captains, not one more dial to retune per tier.
export const WORD_ON_THE_DOCKS_THRESHOLD = 5;
export const WORD_ON_THE_DOCKS_REWARD = 25;

// [MANIFEST 03: Tidewatch Alerts] Deliberately not a difficulty dial: this
// never changes voyage length, card count baseline, or which tier's content
// is visible, all of which stay entirely the host's choice (see
// difficulty.ts). Once every active captain's own reported Reputation
// (GameState.score) sums past this, room wide, the harbor takes notice of a
// bustling crew and every captain's Market board gets one extra card for
// the rest of the voyage. A one time, one direction flip per voyage, purely
// additive on top of whatever the difficulty tier's own charter schedule is
// already doing, and never subtracted back out. See the game:status handler
// in src/server/realtime/index.ts for where the combined total is actually read.
export const TIDEWATCH_SURGE_THRESHOLD = 500;

// [MANIFEST 04: Convoy Ventures] A pooled, multi captain investment: gold
// only (see the ConvoyVenture Prisma model), too large a target for one
// captain to fund comfortably alone, open to contributions from anyone in
// the room until its deadline round. Fills the instant contributions reach
// targetGold, splitting a reward (targetGold times the payout multiplier)
// across every contributor in exact proportion to what they put in. Missing
// the deadline instead pays every contributor back only a fraction of their
// own stake, so joining one is a real wager on the room finishing it, not a
// free favor with no downside. See src/server/realtime/index.ts for where a
// venture is actually posted, contributed to, and resolved.
export const CONVOY_VENTURE_MIN_TARGET = 150;
export const CONVOY_VENTURE_MAX_TARGET = 2000;
export const CONVOY_VENTURE_MIN_ROUNDS_AHEAD = 1;
export const CONVOY_VENTURE_MAX_ROUNDS_AHEAD = 6;
export const CONVOY_VENTURE_PAYOUT_MULTIPLIER = 1.5;
export const CONVOY_VENTURE_FAILURE_REFUND_RATE = 0.5;
// [MANIFEST 04 fix] No single captain may ever fund more than this share of
// a venture's own target, on their own. Without this, a captain could post
// a venture and instantly fill it entirely with their own Gold, alone,
// which is worse than the original repeat fill exploit: it still prints a
// bounded amount of free Gold, and it burns the whole room's one shared
// chance for the voyage in the process, locking every other captain out
// for personal gain instead of the room's. Capping each contributor's own
// share below half is what actually forces at least one other captain to
// genuinely take part before a venture can ever fill.
export const CONVOY_VENTURE_MAX_CONTRIBUTOR_SHARE = 0.5;
