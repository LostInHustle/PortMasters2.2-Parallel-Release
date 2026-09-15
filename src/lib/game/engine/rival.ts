// =====================================================================
// Captain vs captain rivalry helpers.
//
// The engine itself is single captain: it never knows who else is in the
// harbor, only what its own captain is doing. The multiplayer layer tracks
// meetings between two captains separately, and to summarise "how did Lin
// and Wei do against each other across this voyage" it needs one shared
// shape for a recorded meeting and one fold over a list of them. Both live
// here so the rest of the engine never has to reason about pairs of ids.
//
// The pair stays as two ids rather than being collapsed into a single
// key. The one writer (recordRivalOutcomes in src/server/realtime/rival.ts)
// sorts the two ids and then has to map each side back to the captain it
// belongs to, so it needs them separately, and the one reader
// (src/app/api/rivals/route.ts) re orders the pair so the viewer is always
// "a". A merged key would have to be taken apart again at both ends.
// =====================================================================

// One recorded meeting. Exactly one of aWon / bWon / tie is true per
// outcome. The labels "a" and "b" are positional only and mean nothing on
// their own: each side is whichever id the caller put there. The writer
// sorts by id, the reader re sorts so the viewer is "a", and a caller that
// cares about names keeps its own mapping rather than trying to recover
// them from here.
export type RivalOutcome = {
  aWon: boolean;
  bWon: boolean;
  tie: boolean;
};

type RivalSummary = {
  meetings: number;
  aWins: number;
  bWins: number;
  ties: number;
};

// Folds a list of outcomes into the four counts the rivalry card shows.
// Pure and total: an empty list returns all zeros, which is what a pair
// that has met but never resolved a head to head contest should display
// rather than a "no data" placeholder.
//
// aWins counts position "a", so a caller that wants "my wins" has to put
// itself in "a" first. See the reader named above for that projection.
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
