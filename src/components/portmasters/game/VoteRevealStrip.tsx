"use client";

// =====================================================================
// The strip a carried vote leaves behind, drawn once for the two votes.
//
// The audit's finding and the maroon's result are the same shape on
// screen: the vote's name, the round it was made in, the captain it names,
// and a cross to put it away. The two strips were written out twice, and
// a strip is what the harbor reads for the rest of the voyage once a vote
// has landed, so two copies of it are two ways to read one finding.
//
// The frame is here and the body is handed in, because the two votes
// reveal different things: one opens a manifest and the other puts a
// captain ashore, and neither of those is a frame.
//
// The frame wears the meaning color of the vote that made it: the
// audit's is the color of what somebody knows, the maroon's is the
// color of money out at its worst.
// =====================================================================

import { useState, type ReactNode } from "react";
import { t } from "@/lib/game/i18n";
import { cn } from "@/lib/utils";

// One wash per vote, read by name: the border, the fill and the ring of
// the strip, and the ink of its title.
const STRIP_TONES = {
  intel: {
    wash: "border-intel/40 bg-intel/[0.06] ring-intel/20",
    ink: "text-intel",
  },
  alarm: {
    wash: "border-alarm/40 bg-alarm/[0.06] ring-alarm/20",
    ink: "text-alarm",
  },
} as const;

/**
 * The strip a carried vote leaves on the table.
 *
 * The finding is the vote's own, and only the two things the frame needs
 * are read off it: the round it was made in and the captain it was made
 * of. Everything the frame prints about the finding is the finding's
 * own wording, handed in.
 */
export function VoteRevealStrip({
  tone,
  icon,
  title,
  finding,
  headline,
  dismissLabel,
  children,
}: {
  /** The meaning color of the vote that made this finding. */
  tone: "intel" | "alarm";
  /** The glyph the strip leads with. */
  icon: string;
  /** The vote's own name. */
  title: string;
  /** The finding the strip is about, or null when there is none. */
  finding: { round: number; target: { userId: string } } | null;
  /** The line that names the captain the finding is about. */
  headline: ReactNode;
  /** The cross's own label. */
  dismissLabel: string;
  children?: ReactNode;
}) {
  // Held by the finding it applies to rather than as a flag, so a
  // dismissed finding cannot silence the next voyage's.
  const [dismissed, setDismissed] = useState<string | null>(null);
  if (!finding) return null;
  const key = `${finding.round}:${finding.target.userId}`;
  if (dismissed === key) return null;

  return (
    <div
      className={cn(
        "rounded-2xl px-3 py-2 border ring-1",
        STRIP_TONES[tone].wash,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm leading-none" aria-hidden>
          {icon}
        </span>
        <span
          className={cn(
            "text-[10px] font-semibold uppercase tracking-wide",
            STRIP_TONES[tone].ink,
          )}
        >
          {title} · {t("Round {round}", { round: finding.round })}
        </span>
        <span className="font-display text-sm font-semibold">{headline}</span>
        <button
          type="button"
          className="ml-auto text-muted-foreground hover:text-foreground"
          onClick={() => setDismissed(key)}
          aria-label={dismissLabel}
        >
          ✕
        </button>
      </div>
      {children}
    </div>
  );
}
