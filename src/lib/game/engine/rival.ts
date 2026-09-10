// =====================================================================
// Captain vs captain rivalry helpers.
//
// The engine itself is single captain: it never knows who else is in the
// harbor, only what its own captain is doing. The multiplayer layer tracks
// meetings between two captains separately, and when it wants to summarise
// "how did Lin and Wei do against each other across this voyage" it needs
// two small utilities that don't belong to any one subsystem. Both live
// here so the rest of the engine never has to reason about pairs of ids.
//
// Determinism contract: rivalKey is a pure function of its two inputs and
// the same pair always produces the same key, regardless of argument
// order. That's what lets a meeting recorded as (Lin, Wei) be looked up
// later as (Wei, Lin) without keeping a second record around.
// =====================================================================

// The stable identifier for a pair of captains. The lexicographically
// smaller id always comes first, joined to the larger by a single "|", so
// rivalKey("wei", "lin") and rivalKey("lin", "wei") both return "lin|wei".
// A captain paired with themselves (a === b) collapses to the single id
// with no delimiter, which is harmless: no real meeting ever records the
// same captain twice, and a key that uniquely identifies "just Lin" can't
// collide with any genuine pair.
export function rivalKey(a: string, b: string): string {
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  return a === b ? a : `${lo}|${hi}`;
}

// One recorded meeting between the two captains identified by rivalKey.
// Exactly one of aWon / bWon / tie is true per outcome. The labels "a" and
// "b" are positional only: whoever was passed first to rivalKey is "a",
// whoever was passed second is "b", and callers that care about names
// should keep their own mapping rather than trying to recover them here.
export type RivalOutcome = {
  aWon: boolean;
  bWon: boolean;
  tie: boolean;
};

export type RivalSummary = {
  meetings: number;
  aWins: number;
  bWins: number;
  ties: number;
};

// Folds a list of outcomes into the four counts the rivalry card shows.
// Pure and total: an empty list returns all zeros, which is what a pair
// that has met but never resolved a head to head contest should display
// rather than a "no data" placeholder.
export function rivalSummary(outcomes: RivalOutcome[]): RivalSummary {
  let aWins = 0;
  let bWins = 0;
  let ties = 0;
  for (const o of outcomes) {
    if (o.tie) ties++;
    else if (o.aWon) aWins++;
    else if (o.bWon) bWins++;
  }
  return { meetings: outcomes.length, aWins, bWins, ties };
}
