"use client";

// =====================================================================
// The waters scale: how hard the voyage a harbor is opened at runs.
//
// Difficulty is a position rather than a choice between two things, and
// the tiers say so themselves: they run 8, 12 and 16 rounds, and the raid
// chance climbs with them. So Waters is one continuous rail whose fill
// deepens toward the storm end, with a stop per tier. It is the ladder
// half of the pair whose reasoning, including why neither control wears
// pm-pressable, is written at the top of ./VoyageCards.
//
// Every stop carries its own round count. The dial only ever showed that
// number for the tier already selected, which hid the plainest evidence
// that the three are a ladder rather than three unrelated settings.
// =====================================================================

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// The shape of one stop, private to this file: it is the props contract
// rather than a type any call site names, and the call sites pass their
// rungs in and are checked against it.
type WatersStop<T extends string> = {
  key: T;
  icon: string;
  badge: string;
  rounds: number;
};

// Rising fill, one step per tier. Built from bg-sea at stepped opacity rather
// than from a from-sea gradient, because opacity on the sea token is what the
// rest of the tree already leans on and a gradient on it is unproven here. The
// classes stay literal rather than built from a template, so the stylesheet
// can still see them.
const WATERS_FILL = ["bg-sea/20", "bg-sea/45", "bg-sea/70"] as const;

export function WatersScale<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly WatersStop<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {/* No gap between the cells, so the three rail segments meet and read as
          one band. Each cell keeps its own hit area and its own pressed state,
          which is what the three buttons the dial had also carried. */}
      <div className="mt-1.5 grid grid-cols-3">
        {options.map((option, index) => {
          const active = value === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange(option.key)}
              aria-pressed={active}
              className="flex flex-col items-center rounded-xl pb-1 pt-2 outline-none transition-colors hover:bg-sea/[0.06] focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <span aria-hidden className="text-lg leading-none">
                {option.icon}
              </span>
              <span className="relative mt-2 flex h-4 w-full items-center justify-center">
                <span
                  aria-hidden
                  className={cn("h-1 w-full", WATERS_FILL[index])}
                />
                <span
                  aria-hidden
                  className={cn(
                    "absolute h-3 w-3 rounded-full border-2 transition-colors",
                    active
                      ? "border-sea bg-sea ring-2 ring-sea/25"
                      : "border-sea/40 bg-background",
                  )}
                />
              </span>
              <span
                className={cn(
                  "mt-1.5 font-display text-xs font-semibold",
                  active ? "text-sea" : "text-muted-foreground",
                )}
              >
                {option.badge}
              </span>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {option.rounds} rounds
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
