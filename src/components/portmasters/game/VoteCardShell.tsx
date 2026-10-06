"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// The two votes share one shape: a heading in the meaning colour of what
// the vote costs, and the body of whichever state its window is in. Both
// votes live inside the one Harbor Business fold, so the fold owns the
// disclosure and the shell owns the heading and the section rhythm. The
// heading wears the same uppercase label the reveal strips wear, because
// the card and the strip are the same vote read at two moments.
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

/**
 * Where a vote's refusal lands: the server's own sentence and a dismiss
 * press, one block for both votes so a refused nomination reads the same
 * whichever vote it came back from. It is the market desks' block (see
 * MarketError in ./OfferBoard) rather than a second look for the same kind
 * of line, and it is drawn only where there is something to read: a
 * refusal is per captain and is never the room's news, so it is not a
 * strip and not a toast.
 */
export function VoteRefusal({
  error,
  onDismiss,
}: {
  error: string | null;
  onDismiss: () => void;
}) {
  if (!error) return null;
  return (
    <p className="text-[11px] text-alarm mt-2">
      {error}{" "}
      <button type="button" onClick={onDismiss} className="underline">
        Dismiss
      </button>
    </p>
  );
}
