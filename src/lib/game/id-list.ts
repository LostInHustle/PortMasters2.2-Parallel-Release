// =====================================================================
// PortMasters 2.2 Parallel Release: the reading of a saved list of ids.
//
// A few fields in a save hold a list of ids rather than a single one: the
// boons a captain is holding (see ./held-cards), the moments a voyage has
// queued (see ./milestones). Each of them is healed on load, and each
// healing has to answer the same two questions before its own: is this a
// list at all, and is every entry a string that has not already been
// said.
//
// Those two answers are here, because a list that keeps a repeat and a
// list that keeps a number are both lists that do not say what they were
// written to say, and two healings that each answered the question their
// own way are two healings that can drift.
//
// This module is the same shape as ./json, which holds the one other
// defensive read two callers share: neither of them decides what a field
// means, they only decide what the field is made of.
// =====================================================================

/**
 * Whatever a save says about a list of ids, read back as the ids it
 * holds, each one said once.
 *
 * A value that is not a list is no list at all, so the answer is empty
 * rather than a guess. An entry that is not a string is a write that
 * never came from the answer path. A repeat is dropped because the list
 * is a set of things rather than a count of them: a second copy of a
 * thing in it is a save that would read as two of whatever it names, and
 * a boon or a moment counted twice is a boon or a moment the captain is
 * owed once.
 */
export function normalizeIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids: string[] = [];
  for (const value of raw) {
    if (typeof value !== "string" || ids.includes(value)) continue;
    ids.push(value);
  }
  return ids;
}
