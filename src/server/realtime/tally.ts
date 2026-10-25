// =====================================================================
// The count a harbor reads, told once.
//
// The Manifest Audit (see ./audit) and the maroon (see ./maroon) are the
// only two votes a harbor takes, and both of them end a nomination by
// recounting the same way: the roster as it stands now, the book pruned
// against that roster, and the count told to the harbor when the pruning
// moved it.
//
// That recount was written twice, once in each vote, and two copies of a
// recount can drift apart in the two places that matter. A copy that
// pruned after it compared would have told the harbor a count that
// included a captain the harbor had stopped counting, and a copy that
// compared before it pruned would have missed a captain who left and
// said nothing, which is the shape this walk exists to close. One helper
// holds the recount now, and each vote says only what its own frame
// carries.
// =====================================================================

import type { Server } from "socket.io";
import { pruneStaleVotes } from "@/lib/game/audit";
import { roomChannel } from "./channel";
import { activeRosterSet } from "./checkpoint";
import type { RoundState } from "./round-state";

/**
 * The count the harbor is told, recounted against the roster as it stands.
 *
 * The roster is read again rather than carried in, because a captain can
 * leave the harbor between the door's read of it and this one, and the
 * count has to be the count the harbor is left with. The book is pruned
 * against that roster, so a nomination from a captain the harbor has
 * stopped counting is out of the count and out of the names at once (see
 * pruneStaleVotes), and the pruned book is written back onto the state,
 * so the next pass prunes what this one left rather than what it found.
 *
 * The frame is the caller's, because the two votes tell the harbor
 * different things: the maroon's carries the result the voyage already
 * had and the audit's does not. The event is named by the caller for the
 * same reason, and the two counts are told apart by that name alone.
 *
 * `first` says this pass is the first of its settle, which follows an
 * accepted nomination and is therefore always news. Every pass after it
 * is a recount a refusal prompted, and the harbor is told only when the
 * book actually moved under it.
 */
export async function recountAndTell<T>(
  io: Server,
  roomId: string,
  state: RoundState,
  event: string,
  frame: (roster: ReadonlySet<string>, book: ReadonlyMap<string, string>) => T,
  first: boolean,
): Promise<{
  roster: ReadonlySet<string>;
  book: ReadonlyMap<string, string>;
}> {
  const roster = await activeRosterSet(roomId);
  const book = pruneStaleVotes(state.votes, roster);
  const moved = book.size !== state.votes.size;
  state.votes = book;
  if (first || moved) {
    io.to(roomChannel(roomId)).emit(event, frame(roster, book));
  }
  return { roster, book };
}
