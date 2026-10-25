"use client";

import type { ReactNode } from "react";
import { PanelLabel } from "../shared";

// The two votes share one shape: a heading in the meaning color of what
// the vote costs, and the body of whichever state its window is in. Both
// votes live inside the one Harbor Business fold, so the fold owns the
// disclosure and the shell owns the heading and the section rhythm. The
// heading wears the same uppercase label the reveal strips wear, because
// the card and the strip are the same vote read at two moments.
//
// The label itself is the panel label (see PanelLabel), in caps and as a
// heading, because this is the one place on these screens where a label
// is the heading of a block rather than the name of a panel.
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
      <PanelLabel
        as="h4"
        tone={tone === "alarm" ? "text-alarm" : "text-intel"}
        className="uppercase mb-1.5"
      >
        <span aria-hidden>{icon}</span>
        {title}
      </PanelLabel>
      {children}
    </div>
  );
}
