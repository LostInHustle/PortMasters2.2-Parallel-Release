"use client";

// =====================================================================
// Who named whom, drawn once for the harbor's two votes.
//
// The Manifest Audit and the maroon vote both put a target to the table
// and both show the room the nominations as they come in. The rows are
// tallyRows' (see lib/voteTally.ts, which is where the two votes already
// share what a row is); this is the other half of that arrangement, the
// part that was still written twice: the same paragraph, the same two
// spans, the same muted count, in two panels.
//
// Drawing nothing for an empty tally rather than leaving the guard to the
// call sites, because a row list with no rows is nothing either way.
// =====================================================================

import type { TallyRow } from "@/lib/voteTally";

export function VoteTallyRows({ rows }: { rows: TallyRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-3 space-y-0.5">
      {rows.map((row) => (
        <p key={row.targetId} className="text-[11px]">
          <span className="font-medium">{row.name}</span>
          <span className="text-muted-foreground">
            {" "}
            {row.voters.length}: {row.voters.join(", ")}
          </span>
        </p>
      ))}
    </div>
  );
}
