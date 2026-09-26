"use client";

// The voyage's public objective, in a Gambit harbor.
//
// This is the surface that answers "which game am I playing". It sits full
// width under the fleet ticker, above every column, from the first phase
// through the last, because the commission is owed by the whole harbor and
// a fact the whole harbor shares does not belong in one captain's column.
//
// It wears gold, and gold specifically. The commission is an imperial
// one, so it wears the colour the Imperial Mandate already wears on the
// orders board, and it shares that card's classes rather than its own so
// the two read as the same kind of object. It is not a widget in the
// palette's table and takes no hue of its own: gold is a meaning token,
// not a rung on the ladder, which is why a full width surface can wear it
// without disturbing the distance between anything else on screen.
//
// Nothing here renders in Classic. There is no objective to draw there, so
// the hook returns null and this returns null with it.

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ICONS } from "@/lib/game/constants";
import { modeConfig } from "@/lib/game/mode";
import type { Objective, ObjectiveProgress } from "@/lib/game/objectives";
import { OBJECTIVE_DELIVERY_PHASE } from "@/lib/game/engine";
import type { GameState } from "@/lib/game/types";

export function ObjectivePanel({
  game,
  objective,
  progress,
  deliverable,
  onDeliver,
}: {
  game: GameState;
  objective: Objective | null;
  progress: ObjectiveProgress | null;
  deliverable: number;
  onDeliver: () => void;
}) {
  if (!objective || !progress) return null;
  const mode = modeConfig(game.mode);
  // What is still owed, and what it is worth. The one number a captain
  // needs before deciding to hand anything over, and it is not derivable
  // from the bar: a bar says how far along the fleet is, not what the rest
  // of the commission is worth to the captain holding the goods.
  const outstanding = progress.rows.reduce(
    (sum, row) => sum + Math.max(0, row.required - row.delivered) * row.price,
    0,
  );
  const open = game.phase === OBJECTIVE_DELIVERY_PHASE;

  return (
    <div className="rounded-2xl px-3 py-2 mb-3 border border-gold/70 bg-gradient-to-br from-gold/[0.18] to-gold/[0.06] ring-1 ring-gold/25">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm leading-none" aria-hidden>
          {mode.icon}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gold-ink">
          {mode.badge} · Fleet Commission
        </span>
        <span className="font-display text-sm font-semibold">
          {objective.name}
        </span>
        <span className="hidden sm:inline text-xs text-muted-foreground truncate">
          {objective.line}
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        {progress.rows.map((row) => (
          <span
            key={row.type}
            className={cn(
              "text-[11px] font-medium rounded-lg px-1.5 py-0.5 border tabular-nums",
              row.met
                ? "border-gain/40 text-gain"
                : "border-black/10 dark:border-white/10 text-muted-foreground",
            )}
          >
            {ICONS[row.type]}
            {row.type} {row.delivered} of {row.required}
          </span>
        ))}
        <span className="text-[11px] font-semibold tabular-nums">
          {progress.delivered} of {progress.required} handed over
        </span>
        {!progress.met && (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {outstanding} Gold still on the table
          </span>
        )}
        {open && deliverable > 0 && (
          <Button size="sm" variant="outline" onClick={onDeliver}>
            Deliver {deliverable}
          </Button>
        )}
      </div>

      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/80">
        No win condition is in force yet. The Emperor pays for what you hand
        over, and nothing else reads it.
      </p>
    </div>
  );
}
