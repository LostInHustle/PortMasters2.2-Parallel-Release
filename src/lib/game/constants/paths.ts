// Path and subsystem constants. Values stay here rather than in prose so
// the rules and the screens that quote them share one source.

/** Bazaar rumor cooldown, in rounds, and the price shift one rumor applies. */
export const RUMOR_COOLDOWN_ROUNDS = 3;
export const RUMOR_SHIFT_FRACTION = 0.1;

/** The shift as the whole number the rumor copy prints. */
export const RUMOR_SHIFT_PERCENT = Math.round(RUMOR_SHIFT_FRACTION * 100);

/**
 * Convoy cannons occupy cargo slots. The Quartermaster carries half again
 * the base hold. Both feed the one capacity read in ./larder.
 */
export const CONVOY_CANNON_SLOTS = 6;
export const QUARTERMASTER_HOLD_GAIN = 0.5;

/** Pathbound order slots added beside the tier's own board draw. */
export const PATH_ORDER_SLOTS = 3;

/**
 * Free Captain uses per voyage and the share of the payout the house keeps.
 * The penalty is stored as a deduction so the payout can subtract it.
 */
export const OPPORTUNIST_USES = 1;
export const OPPORTUNIST_PENALTY = 0.4;

/**
 * Convoy raid coverage, and the bounds shared by every consent-based sale
 * (escort contracts and refit work). Fees are whole Gold.
 */
export const CONVOY_RAID_COVERAGE = 0.4;
export const CONSENT_FEE_MIN = 1;
export const CONSENT_FEE_MAX = 1000;

/**
 * Path draft: cards per hand, the guaranteed Quartermaster floor, and the
 * reconnect window before an absent captain's first card is laid for them.
 */
export const DRAFT_DEAL = 3;
export const DRAFT_QUARTERMASTER_MIN = 2;
export const DRAFT_WATCH_MS = 15_000;

/** The one path switch, its round window, and its linear Renown fee. */
export const PATH_SWITCH_FROM_ROUND = 3;
export const PATH_SWITCH_TO_ROUND = 9;
export const PATH_SWITCH_FEE_BASE = 30;
export const PATH_SWITCH_FEE_PER_LEVEL = 8;
export const PATH_SWITCH_FEE_MAX = 150;
