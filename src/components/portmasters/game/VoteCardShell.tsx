"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// The two votes share one shape: a heading in the meaning colour of what
// the vote costs, and the body of whichever state its window is in. The
// shell used to choose between a full card and a fold of its own, one per
// vote, stacked at the top of the Parley board; both votes live inside
// the one Harbor Business fold now (W4, UX-3 in docs/STUDIO_AUDIT.md), so
// the fold owns the disclosure and the shell owns the heading and the
// section rhythm. The heading wears the same uppercase label the reveal
// strips wear, because the card and the strip are the same vote read at
// two moments.
export function VoteCardShell({
  tone,
  icon,
  title,
  children,
}: {
  tone: "intel" | "alarm";
  icon: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <h4
        className={cn(
          "mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide",
          tone === "alarm" ? "text-alarm" : "text-intel",
        )}
      >
        <span aria-hidden>{icon}</span>
        {title}
      </h4>
      {children}
    </div>
  );
}
