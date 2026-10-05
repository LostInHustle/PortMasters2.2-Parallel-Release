"use client";

// =====================================================================
// The count, and who named whom, drawn once for the harbor's two votes.
//
// The Manifest Audit and the maroon vote both put a target to the table
// and both show the room the nominations as they come in. The rows are
// tallyRows' (see lib/voteTally.ts, which is where the two votes already
// share what a row is); this is the other half of that arrangement, the
// part that was still written twice: the same paragraph, the same two
// spans, the same muted count, in two panels.
//
// The count block landed beside the rows because the two are one reading
// and were once one bug. "AaronZ 1: AaronZ" is what this drew: a name, a
// bare number and the same name again, with no roster under either, so a
// captain could not tell whether the vote needed one more name or five.
// The block says it in words now. How many names are in of how many
// captains the vote is divided by, how many names carry it, each target
// with the names behind them, and who the room is still waiting on, all
// out of the census the server sends rather than out of arithmetic here:
// the roster this vote divides by is the server's active roster, which is
// not the member list a client can see (see AuditTally).
//
// Nothing is counted without a census. A room whose count has not arrived
// yet is told exactly that, because a count block guessing at its own
// denominator would be the same bug in a longer sentence. The shortfall
// line (how many more names the leading target needs) and the captain's
// own line (whether their name is in) are arithmetic over the same frame
// the rows come from, so there is no fourth number to keep in step.
// =====================================================================

import {
  captainName,
  leaderShortfall,
  nameCount,
  nameList,
  type TallyRow,
  type VoteCensus,
} from "@/lib/voteTally";
import type { PublicUser } from "@/lib/api";

export function VoteTallyRows({
  rows,
  census,
  members,
  myVote = null,
}: {
  rows: TallyRow[];
  /** The server's count for this leg, or null before its first word. */
  census: VoteCensus | null;
  /** The roster a name is read out of, for the captains still to speak. */
  members: PublicUser[];
  /** This captain's own nomination, so the block can say whose turn it is not. */
  myVote?: string | null;
}) {
  if (!census || census.roster <= 0) {
    return (
      <p className="mt-3 text-[11px] text-muted-foreground">
        The room&apos;s count has not arrived yet. It comes with this leg&apos;s
        vote.
      </p>
    );
  }
  const named = rows.reduce((count, row) => count + row.voters.length, 0);
  const waiting = census.awaiting.map((id) => captainName(members, id));
  const leader = leaderShortfall(rows, census.needed);
  const carryPhrase =
    census.needed === 1
      ? "1 name carries it"
      : `${census.needed} names carry it`;
  const inPhrase =
    census.roster === 1
      ? `${named} of 1 name is in`
      : `${named} of ${census.roster} names are in`;

  return (
    <div className="mt-3 space-y-1">
      <p className="text-[11px]">
        {inPhrase}, and {carryPhrase}.
      </p>
      {leader === null ? (
        <p className="text-[11px] text-muted-foreground">
          No name is in yet.{" "}
          {census.needed === 1
            ? "One name for one captain carries it."
            : `${census.needed} names for one captain carry it.`}
        </p>
      ) : leader.short > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {leader.short === 1
            ? `${leader.name} needs 1 more name. The next name for ${leader.name} carries it.`
            : `${leader.name} needs ${leader.short} more names to carry it.`}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {leader.name} has every name the vote needs.
        </p>
      )}
      {rows.length > 0 && (
        <div className="space-y-0.5">
          {rows.map((row) => (
            <p key={row.targetId} className="text-[11px]">
              <span className="font-medium">{row.name}</span>{" "}
              <span className="text-muted-foreground">
                has {nameCount(row.voters.length)}, from {nameList(row.voters)}.
              </span>
            </p>
          ))}
        </div>
      )}
      {myVote === null && (
        <p className="text-[11px] text-muted-foreground">
          Your name is not in yet. Pick a captain and press the button.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        {waiting.length > 0
          ? `Waiting on ${nameList(waiting)} to name a captain.`
          : "Every captain still sailing has named someone, so this leg's vote has run its course. A later leg can call it again."}
      </p>
    </div>
  );
}
