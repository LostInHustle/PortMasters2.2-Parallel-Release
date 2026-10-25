"use client";

// =====================================================================
// The harbor's vote card, drawn once for the two votes.
//
// The Manifest Audit and the maroon vote are the same interaction read
// twice: a captain is named, a count runs, and the harbor is told what the
// vote spends when it carries. The two cards were written out twice, and
// a card is where a captain looks to be told what a vote does, so two
// copies of it are two answers to one question.
//
// So the card is here, and each vote hands in its own words: the verbs
// its picker is pressed with, the sentence its rule is printed in, the
// line its count ends on, and what it spends. What the card owns is the
// shape: the shell, the picker, the refusal line, the count's place and
// the note under it.
//
// The parts that differ stay with the vote that owns them. The audit
// reveals a manifest and the maroon puts a captain ashore, and neither
// panel's file decides anything about the other.
// =====================================================================

import { useState, type ReactNode } from "react";
import type { PublicUser } from "@/lib/api";
import type { GameState } from "@/lib/game/types";
import { RefusalLine } from "../shared";
import { VoteCardShell } from "./VoteCardShell";
import { VoteSeatPicker, type Marks } from "./VoteSeatPicker";

/**
 * The card the harbor's two votes are drawn on.
 *
 * The window is the caller's to read: a vote that is not open, or a
 * card the harbor should not see at all, is decided in the panel that owns
 * the vote, because the rule that decides it is the mode's own (see
 * auditOpensAt, and the maroon's rung). What arrives here is the answer,
 * so the card cannot be open in one vote and closed in the other.
 */
export function VoteCard({
  game,
  members,
  me,
  statuses,
  tone,
  icon,
  title,
  open,
  carried,
  rule,
  closed,
  picker,
  refusal,
  tally,
  footnote,
}: {
  game: GameState;
  members: PublicUser[];
  me: PublicUser;
  statuses?: Marks;
  /** The meaning color of what this vote costs. */
  tone: "intel" | "alarm";
  /** The glyph the card leads with. */
  icon: string;
  /** The card's own name. */
  title: string;
  /** Whether the vote's window is open. */
  open: boolean;
  /**
   * The line that replaces the whole vote once it has been spent. A vote
   * that has already been carried is not a vote with fewer things in it,
   * it is a vote that is over, and the card says so in place of the
   * press rather than beside it.
   */
  carried?: ReactNode;
  /** The rule in plain words, printed above the picker. */
  rule: ReactNode;
  /** The line printed before the window opens. */
  closed: ReactNode;
  /** The vote's own verbs: who a captain is picked for, and what the press says. */
  picker: {
    selectLabel: string;
    callLabel: string;
    pickLabel: (name: string) => string;
    note?: ReactNode;
    /** Whether this captain's own name is already in. */
    myVote: boolean;
    /** Whether the server would take a name from this captain at all. */
    canVote: boolean;
    onVote: (target: string) => void;
  };
  /** The vote's own refusal, and the hand that clears it. */
  refusal: { error: string | null; onDismiss: () => void };
  /** The count under the picker. */
  tally: ReactNode;
  /** The note under the count. */
  footnote: ReactNode;
}) {
  // The round is carried with the pick rather than reset by an effect: a
  // target chosen in a round the vote fell short in is not a target this
  // round's card keeps one press away, and a reading that cannot represent
  // a stale choice beats one cleared a frame after it showed.
  const [pick, setPick] = useState({ round: -1, target: "" });
  const target = pick.round === game.currentRound ? pick.target : "";

  return (
    <VoteCardShell tone={tone} icon={icon} title={title}>
      {open ? (
        carried ? (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {carried}
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              {rule}
            </p>
            {/* The press and the list of seats it may be aimed at are the
                shared picker's (see VoteSeatPicker), and the note it
                carries is the vote's own: a captain the harbor has written
                off cannot be named, and the list says why rather than
                leaving its short length unexplained. */}
            <VoteSeatPicker
              selectLabel={picker.selectLabel}
              target={target}
              onPick={(id) => setPick({ round: game.currentRound, target: id })}
              members={members}
              me={me}
              statuses={statuses}
              myVote={picker.myVote}
              canVote={picker.canVote}
              onVote={() => picker.onVote(target)}
              callLabel={picker.callLabel}
              pickLabel={picker.pickLabel}
              note={picker.note}
            />
            <RefusalLine
              className="mt-2"
              error={refusal.error}
              onDismiss={refusal.onDismiss}
            />
            {/* The block below owns every word of what this captain said,
                whose turn it is, and what the vote does with the names it
                needs: a panel's own half of that count would be a second
                answer to one question. */}
            {tally}
            <p className="text-[10px] text-muted-foreground/80 mt-2">
              {footnote}
            </p>
          </>
        )
      ) : (
        <p className="text-xs text-muted-foreground leading-relaxed">
          {closed}
        </p>
      )}
    </VoteCardShell>
  );
}
