"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// The one fold this game wears: a row that names what it holds, the one
// line that says what that is, and the chevron for the rest. It began as
// VoteCardShell's closed half and was promoted to its own file the day
// two more surfaces wanted the same row (see Purchase.tsx's readings and
// Welcome.tsx's briefing), because three copies of one disclosure is
// three places to fix a chevron. The caller keeps the state, since the
// three callers mean three different things by open.
//
// The tone is named for its meaning rather than its colour, the way the
// cards themselves name it: the audit wears intel because it reports what
// somebody knows, the maroon wears alarm because it takes a ship, and the
// briefing wears harbor because it is what the pier hands a captain
// before sail. The table is module scope rather than an export: the tone
// is a parameter of this row, so every caller names it on the fold it
// draws and nobody needs the table itself.
const TONES = {
  intel: "border-intel/25 bg-intel/[0.04]",
  alarm: "border-alarm/25 bg-alarm/[0.04]",
  harbor: "border-harbor/25 bg-harbor/[0.04]",
  // Two desks of the Market phase wear their own hue on the fold itself
  // (W4): the Loom's bench and the larder's barge are panels a captain
  // finds by their colour before reading their name, so the row that
  // holds them open wears the same tone at the fold's strength.
  refit: "border-refit/25 bg-refit/[0.04]",
  larder: "border-larder/25 bg-larder/[0.04]",
  // The shipyard's rig, for the same reason: a hull's fit is read in the
  // dusk hue wherever it is drawn (W4).
  dusk: "border-dusk/25 bg-dusk/[0.04]",
  // The captain profile's reference half wears the profile hue (W4): the
  // popup's own blocks and the roster bar that opens it already draw in
  // that token, and the fold that now holds them is the same surface.
  profile: "border-profile/25 bg-profile/[0.04]",
} as const;

export function FoldRow({
  tone,
  icon,
  title,
  gist,
  open,
  onToggle,
  className,
  children,
}: {
  tone: keyof typeof TONES;
  icon: string;
  title: string;
  gist: string;
  open: boolean;
  onToggle: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("rounded-xl border px-3 py-2.5", TONES[tone], className)}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={open}
        onClick={onToggle}
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
            !open && "-rotate-90",
          )}
        />
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}
