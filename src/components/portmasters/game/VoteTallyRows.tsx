"use client";

// =====================================================================
// The count, and who named whom, drawn once for the harbor's two votes.
//
// The Manifest Audit and the maroon vote both put a target to the table
// and both show the harbor the nominations as they come in. The rows are
// tallyRows' (see lib/voteTally.ts, which is where the two votes already
// share what a row is); this is the other half of that arrangement: the
// same paragraph, the same two spans, the same muted count, in two
// panels.
//
// The whole block reads out of the census the server sends rather than
// out of arithmetic here: the roster a vote divides by is the server's
// active roster, which is not the member list a client can see (see
// AuditTally). How many captains have named someone of how many the vote
// is divided by, how many names carry it, each target with the names
// behind them, and who the harbor is still waiting on.
//
// Nothing is counted without a census. A harbor whose count has not arrived
// yet is told exactly that, because a count block guessing at its own
// denominator would be a wrong count in a longer sentence. The shortfall
// line (how many more names the leading target needs) and the captain's
// own line (whether their name is in) are arithmetic over the same frame
// the rows come from, so there is no fourth number to keep in step.
//
// The count line is worded for its own number: one captain has named
// someone, five have, one name carries it. The count half is built by the
// shared builder (see namedCountLine in lib/voteTally.ts), so the two
// votes cannot word one number two ways.
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
// =====================================================================

import { t } from "@/lib/game/i18n";
import {
  captainCount,
  captainName,
  leaderShortfall,
  nameCount,
  nameList,
  namedCountLine,
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
  /** The server's count for this round, or null before its first word. */
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
        {t(
          "The harbor's count has not arrived yet. It comes with this round's vote.",
        )}
      </p>
    );
  }
  const named = rows.reduce((count, row) => count + row.voters.length, 0);
  const waiting = census.awaiting.map((id) => captainName(members, id));
  const leader = leaderShortfall(rows, census.needed);
  // The count and the threshold in one line, each half worded for its own
  // number: the count comes from the shared builder, and the verb of the
  // threshold half moves with the threshold.
  const countLine =
    `${namedCountLine(named, census.roster)} ` +
    t("{namesNeeded} {carryWord} it.", {
      namesNeeded: nameCount(census.needed),
      carryWord: census.needed === 1 ? "carries" : "carry",
    });

  return (
    <div className="mt-3 space-y-1">
      <p className="text-[11px]">{countLine}</p>
      {leader === null ? (
        <p className="text-[11px] text-muted-foreground">
          {t(
            "No name is in yet. {namesNeeded} on one captain {carryWord} it.",
            {
              namesNeeded: nameCount(census.needed),
              carryWord: census.needed === 1 ? "carries" : "carry",
            },
          )}
        </p>
      ) : leader.short > 0 ? (
        <p className="text-[11px] text-muted-foreground">
          {t("{leader.name} needs {namesShort} to carry it.", {
            "leader.name": leader.name,
            namesShort:
              leader.short === 1
                ? t("1 more name")
                : t("{count} more names", { count: leader.short }),
          })}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {t("{leader.name} has every name the vote needs.", {
            "leader.name": leader.name,
          })}
        </p>
      )}
      {rows.length > 0 && (
        <div className="space-y-0.5">
          {rows.map((row) => (
            <p key={row.targetId} className="text-[11px]">
              <span className="font-medium">{row.name}</span>{" "}
              <span className="text-muted-foreground">
                {t("has {namesNeeded}, from {nameList}.", {
                  namesNeeded: nameCount(row.voters.length),
                  nameList: nameList(row.voters),
                })}
              </span>
            </p>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        {myVote === null
          ? t("Your name is not in yet. Pick a captain and press the button.")
          : t(
              "Your name is in for {votedName}. Nothing else is asked of you this round.",
              { votedName: captainName(members, myVote) },
            )}
      </p>
      {/* Who is still to act, said as a count and as names, and then what
          the vote does with the names it needs. The two are one line
          because they are one question: the room reads how far the count
          has to travel and who is still walking it. */}
      <p className="text-[11px] text-muted-foreground">
        {waiting.length > 0
          ? t(
              "{captainTally} {haveWord} not named anyone: {nameList}. {nextStep}",
              {
                captainTally: captainCount(waiting.length),
                haveWord: waiting.length === 1 ? "has" : "have",
                nameList: nameList(waiting),
                nextStep: nextStep(census.needed),
              },
            )
          : t(
              "Every captain still sailing has named someone, so nothing more can land this round. A later round can call this vote again.",
            )}
      </p>
    </div>
  );
}
