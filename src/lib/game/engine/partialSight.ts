// =====================================================================
// Partial sight.
//
// In multiplayer, the harbor knows things about other captains that a
// given captain should only partly see, depending on how established both
// of them are. A Deckhand looking at a Silk Road Legend sees the headline
// numbers (Renown level, title) but not the detail (current Gold, current
// cargo); two Trade Officers looking at each other see the detail too.
// This module owns the two small helpers that draw that line, kept here
// so the rest of the engine never has to reason about visibility rules.
//
// The trust threshold mirrors the implicit threshold Backing already
// uses: a captain needs to be at least Renown Level 5 (Trade Officer) to
// co sign a loan, and the captain they are looking at needs to be at
// least Renown Level 3 (Able Seaman) for the detail to be worth showing.
// Keeping the two thresholds aligned means a captain who can back a loan
// is also a captain who can see the detail they would need to decide
// whether to.
// =====================================================================

// The minimum Renown a viewer needs to see another captain's detail.
export const DETAIL_VIEWER_MIN_LEVEL = 5;
// The minimum Renown the viewed captain needs before their detail is
// shown at all. Below this, the viewer sees only the headline regardless
// of their own level.
export const DETAIL_SUBJECT_MIN_LEVEL = 3;

// A plain language band for a count, used wherever a captain is shown a
// quantity about another captain they aren't allowed to see exactly.
// Returns "none" for zero so an empty hold reads as empty rather than as
// a missing field; the other bands widen deliberately so a viewer can
// tell "a few" from "a haul" without learning the precise number.
export function bandFor(count: number): string {
  if (count <= 0) return "none";
  if (count <= 3) return "a few";
  if (count <= 8) return "some";
  if (count <= 15) return "plenty";
  return "a haul";
}

// Whether a captain at myRenownLevel is allowed to see the detail of a
// captain at theirRenownLevel. True only when both thresholds are met:
// the viewer needs to be at least a Trade Officer, and the subject needs
// to be at least an Able Seaman. Anything below either falls back to the
// headline view.
export function canSeeDetail(
  myRenownLevel: number,
  theirRenownLevel: number,
): boolean {
  return (
    myRenownLevel >= DETAIL_VIEWER_MIN_LEVEL &&
    theirRenownLevel >= DETAIL_SUBJECT_MIN_LEVEL
  );
}
