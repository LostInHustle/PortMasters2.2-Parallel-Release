"use client";

// The picker both of the harbor's votes draw: the list of captains a name
// may be put to, and the press that puts it. The audit and the maroon ask
// the same two questions of a captain (which seat, and is your own name
// already in), so the two cards draw one control rather than two that
// drift. Each card hands in its own verbs (the select's label, the press
// with no seat chosen, the press with a seat chosen) and keeps the rest of
// its own telling: its sentence, its refusal block, its tally and its next
// step.
//
// The list is drawn through the one predicate the server refuses on (see
// writtenOff in @/lib/seatMarks): a captain the voyage has written off is
// never offered as a name, because an option that quietly does nothing is
// worse than no option. The press reads which of the two moments the
// captain is standing in rather than the state of the list: a name already
// in reads a button that says so instead of one that offers the press a
// second time.
//
// The seat this vote is aimed at is held by the caller with the leg it was
// chosen in (see the pick state on each card), so the picker takes the
// target it should show and hands back every change rather than keeping a
// choice of its own that a phase change would have to clear.

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { PublicUser } from "@/lib/api";
import { seatMarks, type SeatStatus } from "@/lib/seatMarks";
import { captainName } from "@/lib/voteTally";

/**
 * The room's live statuses, read for the mark a vote may not be aimed at.
 * Structural rather than the roster hook's whole record, the same shape
 * the two cards take, so a card cannot reach for anything it has no
 * business reading.
 */
export type Marks = Record<string, SeatStatus>;

export function VoteSeatPicker({
  selectLabel,
  target,
  onPick,
  members,
  me,
  statuses,
  myVote,
  canVote,
  onVote,
  callLabel,
  pickLabel,
  note,
}: {
  /** The select's own label, which names the vote it picks for. */
  selectLabel: string;
  /** The captain picked this leg, or an empty string for none. */
  target: string;
  onPick: (targetId: string) => void;
  /** The roster the list is drawn from. */
  members: PublicUser[];
  /** This captain, so their own row can say so. */
  me: PublicUser;
  statuses?: Marks;
  /** Whether this captain's own name is already in. */
  myVote: boolean;
  /** Whether the server would take a name from this captain at all. */
  canVote: boolean;
  onVote: () => void;
  /** The press while no seat is chosen, in the vote's own words. */
  callLabel: string;
  /** The press once a seat is chosen, built from the vote's own verb. */
  pickLabel: (name: string) => string;
  /** The vote's own sentence under the row, drawn once a seat is spent. */
  note?: ReactNode;
}) {
  const marked = (id: string) => seatMarks(statuses?.[id]).writtenOff;
  const nameOf = (id: string) => captainName(members, id);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Select
          value={target}
          onChange={(e) => onPick(e.target.value)}
          aria-label={selectLabel}
        >
          <option value="">Choose a captain</option>
          {members
            .filter((m) => !marked(m.id))
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.id === me.id ? `${m.displayName} (you)` : m.displayName}
              </option>
            ))}
        </Select>
        <Button
          variant="outline"
          disabled={!target || !canVote}
          onClick={onVote}
        >
          {myVote
            ? "Your name is in"
            : target
              ? pickLabel(nameOf(target))
              : callLabel}
        </Button>
      </div>
      {note && members.some((m) => marked(m.id)) && (
        <p className="text-[10px] text-muted-foreground/80 mt-2">{note}</p>
      )}
    </>
  );
}
