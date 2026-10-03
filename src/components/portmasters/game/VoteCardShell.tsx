"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FoldRow, TONES } from "./FoldRow";

// The two votes share one shape: a card worth showing before its rung (a
// mode whose headline mechanic nobody has heard of is a mechanic nobody
// uses), actionable at its rung, and worth a line afterwards. The closed
// states used to spend a heading, a paragraph and a card's worth of
// padding each, at the top of the Parley board, which pushed the market
// itself under the fold. Closed now wears one row of the shared fold (see
// FoldRow, which owns the tones): the name, the one line that says what
// it is, and the chevron for the full explanation. Live is always open,
// because a vote a captain can cast is not a note to file.
export function VoteCardShell({
  tone,
  icon,
  title,
  gist,
  live,
  children,
}: {
  tone: "intel" | "alarm";
  icon: string;
  title: string;
  gist: string;
  live: boolean;
  children: ReactNode;
}) {
  const [folded, setFolded] = useState(true);

  if (live) {
    return (
      <div className={cn("rounded-xl border p-4 mb-4", TONES[tone])}>
        <h3 className="text-center font-semibold mb-1 text-sm">
          {icon} {title}
        </h3>
        {children}
      </div>
    );
  }

  return (
    <FoldRow
      tone={tone}
      icon={icon}
      title={title}
      gist={gist}
      open={!folded}
      onToggle={() => setFolded((v) => !v)}
      className="mb-4"
    >
      {children}
    </FoldRow>
  );
}
