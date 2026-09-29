// Reputation a captain gains for lending Gold to another captain short on
// funds, scaled to the amount so a token loan doesn't pay the same as
// bailing someone out completely. Floored at 1 so even a small loan is
// worth something.
export const AID_REPUTATION_PER_GOLD = 1 / 5;

// The most Reputation one captain can earn in a single voyage from helping
// others, counting lending (AID_REPUTATION_PER_GOLD above) and backing
// (BACKING_REPUTATION_PER_GOLD below) together.
//
// Why there is a ceiling at all: without one this was the only exploit in
// the game that needed no tampering. Two captains agree in chat, one
// requests a large loan, the other grants it and banks a fifth of it as
// Reputation, and the borrower hands the Gold straight back. aid:post
// accepts any whole number, so the pair could repeat that until Reputation
// stopped meaning anything. Capping the total rather than a single loan is
// what closes it: splitting one large loan into ten small ones earns
// exactly the same.
//
// Why it is derived rather than written down: a sixteen round Monsoon
// voyage offers twice the chances to help that an eight round Fair Winds
// one does, and holds far more Gold by its midpoint. One fixed number for
// all three tiers is either mean to the long voyage or generous to the
// short one. Scaling with the tier's own length lets the ceiling breathe,
// and means a tier added later gets a sensible allowance without anyone
// remembering to come back here.
//
// The base covers a captain who is generous early in a short voyage; the
// per round term is what a long voyage adds on top. At the shipped tiers
// that works out to 96, 120 and 144, each worth five times its own number
// in Gold lent, or ten times in Gold pledged and returned whole.
//
// On the longest tier this does pass 100, the Successful Merchant rating.
// That is deliberate and not the loophole it looks like: Reputation earned
// this way requires Gold, and Gold has to be traded for first. A captain
// cannot lend their way up the ladder without having earned the stake to
// lend, so the ladder still measures trading.
const HELPER_REPUTATION_BASE = 48;
const HELPER_REPUTATION_PER_ROUND = 6;

// The cap takes the voyage's own length rather than the room's tier, and
// the caller passes the length the voyage was pinned to (GameState.maxRounds
// through ./engine/aid). Reading the tier here was right while a tier and a
// voyage were the same number of rounds and wrong the moment they were not:
// a Gambit voyage is twelve legs on every tier, so a tier read would hand a
// Fair Winds crew the cap of an eight round voyage and cut them off at
// eighty percent of what they had honestly earned.
export function helperReputationCapFor(voyageRounds: number): number {
  return HELPER_REPUTATION_BASE + HELPER_REPUTATION_PER_ROUND * voyageRounds;
}

// How a single voyage's final Reputation reads on the Endgame screen (see
// merchantRatingForScore below). Ordered highest threshold first so the
// lookup is a plain first match scan; the last entry's minScore of 0
// is the catch all floor. The top entry also doubles as the threshold for
// the "king_of_silk_road" merit in src/lib/game/merits.ts, so retuning it
// here moves both places at once instead of drifting apart.
type MerchantRating = { minScore: number; icon: string; label: string };
export const MERCHANT_RATINGS: MerchantRating[] = [
  { minScore: 300, icon: "👑", label: "King of Silk Road" },
  { minScore: 200, icon: "🏆", label: "Maritime Tycoon" },
  { minScore: 100, icon: "⭐", label: "Successful Merchant" },
  { minScore: 50, icon: "👍", label: "Qualified Trader" },
  { minScore: 0, icon: "🌊", label: "Novice Merchant" },
];

// The single lookup behind both the Endgame log line (see endGame in
// ./engine/lifecycle.ts) and the Endgame screen's rating badge (see
// GamePhasePanel.tsx), so the two never drift the way they briefly did
// before this was pulled out: the screen was missing the "defaulted on a
// loan" case entirely, still showing a captain's score tier as if nothing
// had happened.
//
// Lives here in constants rather than in the engine, since it is a pure
// lookup over MERCHANT_RATINGS above with no dependency on any engine
// state, and MERCHANT_RATINGS is the table the top entry also doubles as
// the threshold for the "king_of_silk_road" merit in ./merits.ts, so
// retuning it here moves both places at once instead of drifting apart.
// MERCHANT_RATINGS is ordered highest threshold first, so the first match
// scanning down the list is always the correct tier.
export function merchantRatingForScore(score: number): MerchantRating {
  return (
    MERCHANT_RATINGS.find((r) => score >= r.minScore) ??
    MERCHANT_RATINGS[MERCHANT_RATINGS.length - 1]
  );
}

// [MANIFEST 05: Backing] A third captain can co sign part of an existing
// loan between two others, pledging their own Gold as a safety net for the
// lender. The pledge is escrowed immediately, the same moment every other
// commitment in this game is (a barter offer, an aid loan, a Convoy
// Venture contribution), and is only ever spent if the loan actually
// defaults, up to whatever the backer pledged. If the loan is repaid in
// full and the backing is never called on, the backer gets their whole
// pledge back, plus a small Reputation bonus for having genuinely put
// Gold at risk that paid off, half of what the lender themselves earns per
// Gold lent (see AID_REPUTATION_PER_GOLD), since backing is a supporting
// role, not the primary loan.
export const BACKING_REPUTATION_PER_GOLD = AID_REPUTATION_PER_GOLD / 2;
