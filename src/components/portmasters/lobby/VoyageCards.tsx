"use client";

// =====================================================================
// The voyage cards: which of the two voyages a harbor is opened as.
//
// Voyage and Waters are different kinds of question, so they are drawn as
// two different instruments rather than as one dial used twice.
//
// Mode is a choice between two whole voyages that differ in what the
// phases are and what order they run in, so it is drawn as a pair of
// cards a captain reads one at a time. Difficulty is the other half of
// that pair, a position on a ladder rather than a choice between two
// things, and it is drawn as the scale in ./WatersScale. Drawn as one
// dial each, both became rows of identical pills, which made the larger
// choice look the same size as the smaller one and left two of those rows
// stacked on the form.
//
// Neither control takes pm-pressable. Its hover lift scales a control by
// 1.04, which suits a 2rem tool in the masthead and not a card half a
// panel wide, where the growth would reach past its own gap and onto its
// neighbour. They take the focus ring the Button primitive uses instead.
// =====================================================================

import { AlertTriangle, KeyRound } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Pill } from "@/components/portmasters/shared";
import { cn } from "@/lib/utils";

// The shape of one card, private to this file: it is the props contract
// rather than a type any call site names, and the call sites pass their
// options in and are checked against it.
type VoyageOption<T extends string> = {
  key: T;
  icon: string;
  badge: string;
  tagline: string;
  summary: string;
  experimental: boolean;
  // [H9: the unlock code] Whether this voyage has to be opened with a
  // phrase. Read from the mode record rather than from the unlock table,
  // because the question the card answers is about the voyage it is
  // offering and the table only says which doorway that is.
  sealed: boolean;
};

export function VoyageCards<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly VoyageOption<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {/* items-start, because a card should be the size of what it says. The
          grid stretches its cells to the tallest row by default, and the
          experimental card always runs longer than the shipped one, so the
          shipped card was being handed a block of empty space under its own
          text every time. */}
      <div className="mt-1.5 grid gap-2 sm:grid-cols-2 sm:items-start">
        {options.map((option) => {
          const active = value === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange(option.key)}
              aria-pressed={active}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                active
                  ? "border-charter/50 bg-charter/[0.07]"
                  : "border-black/10 bg-background/40 hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.04]",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg",
                  active ? "pm-grad-charter" : "bg-black/5 dark:bg-white/10",
                )}
              >
                {option.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "font-display text-sm font-semibold",
                      active && "text-charter",
                    )}
                  >
                    {option.badge}
                  </span>
                  {option.experimental && (
                    <Pill tone="none" className="bg-warn/5 text-warn">
                      Experimental
                    </Pill>
                  )}
                  {/* [H9: the unlock code] The seal, beside the state above
                      rather than in it. A card can wear both, and they say
                      different things: one is how finished the voyage is
                      and one is how a host gets into it. The key is the
                      same glyph the room card uses for the table it opened,
                      so the pair reads as one idea in two places. */}
                  {option.sealed && <Pill tone="default">🔒 Sealed</Pill>}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                  {option.tagline}
                </span>
                {/* The summary shows on both cards, not only on the one that
                    carries a warning: it is what the voyage asks of a captain,
                    so it belongs to the choice rather than to the caution. */}
                <span className="mt-1 block text-[11px] leading-snug text-muted-foreground/70">
                  {option.summary}
                </span>
                {/* A captain who walks into an unfinished mode without being
                    told has been misled rather than tested, so the warning
                    belongs to the card that offers it rather than to a
                    paragraph under the control that moves when the choice
                    changes. The pill beside the badge names the state; this
                    line is the caution, so it does not name it twice. */}
                {option.experimental && (
                  <span className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-snug text-warn">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>Still being built.</span>
                  </span>
                )}
                {/* Not a caution, so not the caution's colour: a sealed
                    voyage is finished, and what it asks for is a phrase
                    rather than patience. The line names the ask and the
                    field under the cards is where it is answered. */}
                {option.sealed && (
                  <span className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
                    <KeyRound className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>Opens with a phrase.</span>
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
