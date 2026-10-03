"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// The two votes share one shape: a card worth showing before its rung (a
// mode whose headline mechanic nobody has heard of is a mechanic nobody
// uses), actionable at its rung, and worth a line afterwards. The closed
// states used to spend a heading, a paragraph and a card's worth of
// padding each, at the top of the Parley board, which pushed the market
// itself under the fold. Closed now wears one row: the name, the one line
// that says what it is, and the chevron for the full explanation. Live is
// always open, because a vote a captain can cast is not a note to file.
//
// The tone is named for its meaning rather than its colour, the way the
// cards themselves name it: the audit wears intel because it reports what
// somebody knows, and the maroon wears alarm because it takes a ship.
const TONES = {
  intel: "border-intel/25 bg-intel/[0.04]",
  alarm: "border-alarm/25 bg-alarm/[0.04]",
} as const;

export function VoteCardShell({
  tone,
  icon,
  title,
  gist,
  live,
  children,
}: {
  tone: keyof typeof TONES;
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
    <div className={cn("rounded-xl border px-3 py-2.5 mb-4", TONES[tone])}>
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={!folded}
        onClick={() => setFolded((v) => !v)}
      >
        <span className="text-sm" aria-hidden>
          {icon}
        </span>
        <span className="text-sm font-semibold">{title}</span>
        <span className="ml-1 min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {gist}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            folded && "-rotate-90",
          )}
        />
      </button>
      {!folded && <div className="mt-2">{children}</div>}
    </div>
  );
}
