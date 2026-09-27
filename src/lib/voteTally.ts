// =====================================================================
// The one tally renderer the harbor's two votes share.
//
// The Manifest Audit and the maroon vote both put a target to the table
// and both show the room who named whom, so both read their nominations
// through this. Not folded into either panel because a second copy of it
// would be a second answer to what a tally row looks like, and the two
// panels would drift the first time one of them learned something the
// other did not: neither of them needs anything this does not do.
//
// Grouped by target rather than counted server side, the same way it was
// when it lived in the audit panel: the names are the part the room
// reads, and the count is arithmetic on a map already in hand. A voter
// who has left the room is not dropped, they are named as a captain,
// which is honest about a name this side no longer has.
// =====================================================================

import type { PublicUser } from "@/lib/api";

export type TallyRow = {
  targetId: string;
  name: string;
  voters: string[];
};

export function tallyRows(
  votes: Record<string, string>,
  members: PublicUser[],
): TallyRow[] {
  const nameFor = (id: string) =>
    members.find((m) => m.id === id)?.displayName ?? "A captain";
  const rows = new Map<string, string[]>();
  for (const [voterId, targetId] of Object.entries(votes)) {
    rows.set(targetId, [...(rows.get(targetId) ?? []), nameFor(voterId)]);
  }
  return [...rows].map(([targetId, voters]) => ({
    targetId,
    name: nameFor(targetId),
    voters,
  }));
}
