"use client";

// The Manifest Audit's two surfaces: the card below is where a harbor
// decides to look, and the strip is what it found.
//
// The card lives inside the Parley phase, because that is the only place
// the vote can be called: the audit's price is the rest of that round's
// trading, so the button that spends it belongs on the board it spends.
// The strip is full width under the commission, because the finding is
// the whole harbor's and outlives the round it was made in.
//
// The frame both are drawn on belongs to the harbor rather than to the
// audit: the vote card (see VoteCard) and the strip a carried vote
// leaves (see VoteRevealStrip) are the ones the maroon wears too, since
// the two votes ask the harbor the same question in the same shape. What
// is left in this file is the audit's own: which window the vote opens
// in, and what it says when it does.
//
// It wears `intel`, which is a meaning color rather than a panel's own
// hue (see scripts/palette.ts). That is deliberate and it is the same
// choice the commission made with gold: a surface that reports what
// somebody knows is not chrome, and giving it a widget hue would put a
// thirteenth color on a wheel that already has twelve.

import { AuditReveal } from "@/types/realtime/audit";
import type { PublicUser } from "@/lib/api";
import {
  AUDIT_REVEAL_WORDS,
  AUDIT_VOTE_RULE,
  fulfillmentLine,
} from "@/lib/game/audit";
import { auditOpensAt } from "@/lib/game/mode";
import { t } from "@/lib/game/i18n";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { nameCount, tallyRows } from "@/lib/voteTally";
import { VoteTallyRows } from "@/components/portmasters/game/VoteTallyRows";
import { type Marks } from "@/components/portmasters/game/VoteSeatPicker";
import { VoteCard } from "./VoteCard";
import { VoteRevealStrip } from "./VoteRevealStrip";
import type { Audit } from "./phases/PhaseShared";
import { Utensils } from "lucide-react";

/**
 * The two questions the Parley board asks about this vote, answered once
 * beside the vote itself so the card and the Harbor Business fold that
 * holds it cannot disagree about when the harbor is voting (see
 * Parley.tsx).
 */
export function auditVoteOpen(game: GameState, audit: Audit): boolean {
  const opensAt = auditOpensAt(game.mode);
  return (
    opensAt !== null && audit.reveal === null && game.currentRound >= opensAt
  );
}

export function auditCardShown(game: GameState, audit: Audit): boolean {
  const opensAt = auditOpensAt(game.mode);
  if (opensAt === null || game.phase !== "parley") return false;
  // The open window, or a window this voyage can still reach. A spent
  // audit is neither, and it leaves the board because the reveal strip
  // carries the finding from there.
  return (
    auditVoteOpen(game, audit) ||
    (audit.reveal === null && opensAt <= game.maxRounds)
  );
}

export function AuditVoteCard({
  game,
  members,
  me,
  audit,
  statuses,
}: {
  game: GameState;
  members: PublicUser[];
  me: PublicUser;
  audit: Audit;
  statuses?: Marks;
}) {
  // The visibility rule is the reader's (auditCardShown): the open
  // window, or a window still ahead this voyage. The rung is read off
  // the mode's own record rather than compared against a constant, so
  // this panel and the server's vote ask one question: a mode whose rung
  // is null has no manifest to open, and that is what draws nothing here
  // (see auditOpensAt in @/lib/game/mode). The body still explains the
  // vote before the rung, because a mode whose headline mechanic nobody
  // has heard of is a mechanic nobody uses, and inside the Harbor
  // Business fold that explanation costs the board nothing (see
  // Parley.tsx).
  const opensAt = auditOpensAt(game.mode);
  if (opensAt === null) return null;
  if (!auditCardShown(game, audit)) return null;
  const open = auditVoteOpen(game, audit);
  const rows = tallyRows(audit.votes, members);

  return (
    <VoteCard
      game={game}
      members={members}
      me={me}
      statuses={statuses}
      tone="intel"
      icon="🔎"
      title={t("Manifest Audit")}
      open={open}
      // The rule in plain words.
      rule={
        <span>
          {t(
            "A majority of the captains still sailing can open one manifest. What comes back is a sample of what they filed. A carried vote ends this round's trading, and the voyage carries on at the next round. The count below names who is still to vote, and what the vote does when the names it needs land on one captain.",
          )}
        </span>
      }
      closed={t(
        "This vote opens at round {opensAt}, and this is round {game.currentRound}. A simple majority of the captains still sailing then opens one captain's manifest: {AUDIT_REVEAL_WORDS} of their most recent order fulfillments, and nothing else. A carried vote ends that round's trading, the voyage carries on at the next round, and the harbor opens one manifest a voyage.",
        {
          opensAt,
          "game.currentRound": game.currentRound,
          AUDIT_REVEAL_WORDS: t(AUDIT_REVEAL_WORDS),
        },
      )}
      picker={{
        selectLabel: t("Captain to audit"),
        callLabel: t("Call the audit"),
        pickLabel: (name) => t("Open {name}'s manifest", { name }),
        note: t("A captain the harbor has written off cannot be audited."),
        myVote: audit.myVote !== null,
        canVote: audit.canVote,
        onVote: (target) => audit.vote(target),
      }}
      refusal={{ error: audit.error, onDismiss: audit.clearError }}
      tally={
        <VoteTallyRows
          rows={rows}
          census={audit.census}
          members={members}
          myVote={audit.myVote}
          nextStep={(needed) =>
            t(
              "{namesNeeded} on one captain opens that captain's manifest to the whole harbor and closes this round's trading.",
              { namesNeeded: nameCount(needed) },
            )
          }
        />
      }
      footnote={t(AUDIT_VOTE_RULE)}
    />
  );
}

export function AuditRevealStrip({ reveal }: { reveal: AuditReveal | null }) {
  return (
    <VoteRevealStrip
      tone="intel"
      icon="🔎"
      title={t("Manifest Audit")}
      finding={reveal}
      headline={
        reveal ? t("{name}'s manifest", { name: reveal.target.name }) : null
      }
      dismissLabel={t("Hide the audit")}
    >
      {reveal ? (
        <>
          {/* A flagged reveal prints no lines at all, because there are none to
              print: the server withholds a marked manifest rather than handing
              the table evidence it has already judged unsound (see AuditReveal
              .flagged). The flag is then the strip's whole finding, and it is
              read off the reveal rather than counted from an empty list so it
              cannot be confused with a captain who filed nothing. */}
          {reveal.flagged ? null : reveal.fulfillments.length === 0 ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("No order fulfillments filed this voyage.")}
            </p>
          ) : (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              {reveal.fulfillments.map((fill) => (
                <span
                  key={`${fill.round}:${fill.port}:${fill.items
                    .map((i) => i.type)
                    .join("+")}`}
                  className="text-[11px] font-medium rounded-lg px-1.5 py-0.5 border border-intel/25 tabular-nums"
                >
                  {fulfillmentLine(fill)}
                </span>
              ))}
            </div>
          )}

          {/* The second half of the design's
              audit clause: the sample of fulfillments, plus the captain's
              current Larder. Drawn only when the layer reports one, so a
              voyage with the provisions switch off shows the reveal this strip
              has always shown rather than a number nothing moves. The red is
              the meaning red rather than the strip's own hue, because an empty
              larder is the finding the room is looking for and it should be
              readable before the count is. */}
          {reveal.larder !== undefined && (
            <div className="mt-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                  reveal.shortRations
                    ? "border-alarm/30 bg-alarm/5 text-alarm"
                    : "border-intel/25 text-foreground",
                )}
              >
                <Utensils className="h-3 w-3" />
                {t("Larder")} {reveal.larder}
              </span>
              <span className="ml-1.5 text-[10px] text-muted-foreground/80">
                {reveal.shortRations
                  ? t(
                      "an empty larder: this captain's crew is on short rations.",
                    )
                  : reveal.larder === 0
                    ? t("an empty larder, with no crew aboard to go hungry.")
                    : t("rations aboard, eaten one a head each round.")}
              </span>
            </div>
          )}

          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/80">
            {t(
              "{manifestLine} Opened by a majority in round {reveal.round}, which closed that round's trading; the finding stays on the table for the rest of the voyage.",
              {
                manifestLine: reveal.flagged
                  ? t(
                      "The harbor's own checks could not reconcile this manifest, so its lines are withheld.",
                    )
                  : t(
                      "A random sample of this captain's most recent order fulfillments, opened by a vote of the harbor. Their card, their Gold and the rest of their hold were not opened.",
                    ),
                "reveal.round": reveal.round,
              },
            )}
          </p>
        </>
      ) : null}
    </VoteRevealStrip>
  );
}
