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
//
// The last line is the one thing here the count cannot supply: what
// happens when the names the vote needs land on one captain, and who is
// still to act. Every word of it is the vote's own rather than the
// block's, because the audit and the maroon spend different things, so it
// arrives as a function of the threshold (see nextStep) rather than as
// copy this file would have to keep two versions of. It reads the
// threshold the census carries, so the number a line names and the number
// the server carries on are one rule (see auditNamesNeeded, and the
// maroon's own count).
//
// The count line is worded for its own number: one name is in, five
// captains have named someone, one name carries it. A block that printed
// "1 of 5 names are in" was the arithmetic of the old bug in a longer
// sentence, and the two singular branches below are the whole of the fix.
// =====================================================================

import {
  captainCount,
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
  nextStep,
}: {
  rows: TallyRow[];
  /** The server's count for this leg, or null before its first word. */
  census: VoteCensus | null;
  /** The roster a name is read out of, for the captains still to speak. */
  members: PublicUser[];
  /** This captain's own nomination, so the block can say whose turn it is not. */
  myVote?: string | null;
  /**
   * What this vote does with the names it needs, said in the vote's own
   * words and read off the threshold: the last line of the block. A
   * function rather than a sentence so the number in it is the census'
   * own, and not a second copy of the arithmetic kept beside the first.
   */
  nextStep: (needed: number) => string;
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
  // The count and the threshold in one line, each half worded for its own
  // number. Both the verb and the noun move with the count, which is the
  // one place this block used to read as arithmetic rather than as English.
  const countLine =
    `${named} of ${census.roster} captains ` +
    `${named === 1 ? "has" : "have"} named someone. ` +
    `${nameCount(census.needed)} ${census.needed === 1 ? "carries" : "carry"} it.`;

  return (
    <div className="mt-3 space-y-1">
      <p className="text-[11px]">{countLine}</p>
      {leader === null ? (
        <p className="text-[11px] text-muted-foreground">
          {`No name is in yet. ${nameCount(census.needed)} on one captain ${
            census.needed === 1 ? "carries" : "carry"
          } it.`}
        </p>
      ) : leader.short > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {`${leader.name} needs ${
            leader.short === 1 ? "1 more name" : `${leader.short} more names`
          } to carry it.`}
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
      <p className="text-[11px] text-muted-foreground">
        {myVote === null
          ? "Your name is not in yet. Pick a captain and press the button."
          : `Your name is in for ${captainName(members, myVote)}. Nothing else is asked of you this leg.`}
      </p>
      {/* Who is still to act, said as a count and as names, and then what
          the vote does with the names it needs. The two are one line
          because they are one question: the room reads how far the count
          has to travel and who is still walking it. */}
      <p className="text-[11px] text-muted-foreground">
        {waiting.length > 0
          ? `${captainCount(waiting.length)} ${
              waiting.length === 1 ? "has" : "have"
            } not named anyone: ${nameList(waiting)}. ${nextStep(census.needed)}`
          : "Every captain still sailing has named someone, so nothing more can land this leg. A later leg can call this vote again."}
      </p>
    </div>
  );
}
