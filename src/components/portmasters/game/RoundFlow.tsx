"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/lib/game/i18n";
import { phaseFace } from "@/lib/game/phases";
import type { BriefingPhase } from "@/lib/game/mode";
import { Term } from "../Term";

/**
 * One mode's round, drawn as the flow it is.
 *
 * Every round stands on the rail in the order the engine walks them,
 * wearing the fill of the phase it is, and the round a captain is reading
 * opens the line underneath: what that phase decides for the phases after it.
 *
 * The rail is deliberately complete rather than a stepper that shows one
 * round at a time. This panel is read before the voyage begins, to work out
 * what the mode is asking for, and a shape that has to be walked one
 * click at a time cannot be taken in at a glance or held in the head
 * while a decision is made. What the click buys is the consequence line,
 * and the reading is meant to move back and forth along the rail rather
 * than once down it.
 *
 * Every round's body is always shown, and only the consequence line is the
 * one the focus picks. Hiding a round's body behind a click would leave the
 * chart unreadable to a captain who never clicks, and this is the panel
 * they meet before they know what the mode is.
 *
 * Nothing here decides what a round is: the phases arrive from the mode
 * record, and the smoke suite holds them to the lap. See BriefingPhase.
 */
export function RoundFlow({
  phases,
  closes,
}: {
  phases: readonly BriefingPhase[];
  closes: string;
}) {
  // The first round is open on arrival, because some round has to be: a rail
  // with nothing under it opens as a list of rows and never shows a
  // captain that the rows answer to a click.
  const [focused, setFocused] = useState(0);
  const held = phases[focused];

  return (
    <div className="mt-2">
      <ol>
        {phases.map((phase, index) => {
          const open = index === focused;
          // A round stands for the phase the engine walks, and what a phase is
          // called, wears and shows is the phase's own business (see
          // PHASE_FACES). The mode record says what a phase decides; it does
          // not say what to call it a second time.
          const face = phaseFace(phase.phase);
          return (
            <li key={phase.phase}>
              {/* Three columns rather than a flex row, because the rail
                  below has to be told what to line up with and a column is
                  how it is told: the tile column is exactly as wide as the
                  tile, so the rail is centered on it by being centered in
                  its own column, with no offset arithmetic to rot.

                  The button carries no vertical padding for the same
                  reason. The padding lives on the words instead, so the
                  tile column spans the whole row and the rail is free to
                  run from one tile to the next rather than from one
                  padded box to the next, which is what left the line
                  floating short of both tiles when the two were measured
                  apart. */}
              <button
                type="button"
                onClick={() => setFocused(index)}
                aria-expanded={open}
                className={cn(
                  "grid w-full grid-cols-[1.25rem_1fr_auto] items-stretch gap-x-2.5 rounded-md px-1.5 text-left transition-colors",
                  open ? "bg-sea/[0.09]" : "hover:bg-sea/[0.05]",
                )}
              >
                <span className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold",
                      face.gradient,
                    )}
                  >
                    {index + 1}
                  </span>
                  {/* The rail between two phases, drawn rather than written,
                      so the phases read as one run instead of seven rows. It
                      is the rest of the tile column, less the 2px that
                      keeps the line off the tile's own edge, and it
                      reaches the row's bottom, which is where the next
                      tile's top is. */}
                  {index < phases.length - 1 && (
                    <span
                      aria-hidden
                      className="mt-0.5 w-px flex-1 bg-sea/25"
                    />
                  )}
                </span>
                <span className="min-w-0 py-1.5">
                  {/* The phase's name is a term wherever the rail draws it:
                      the four round names a captain meets before any briefing
                      (Dawn, Parley, Resolve, Dusk) carry their own entries
                      now, and a name without one falls back to plain text,
                      so the wrap is the rail saying these words are the
                      game's vocabulary rather than a second label. */}
                  <span className="font-semibold">
                    {face.icon}{" "}
                    <Term term={face.label} focusable={false}>
                      {t(face.label)}
                    </Term>
                  </span>
                  <span className="block text-xs leading-snug text-muted-foreground">
                    {t(phase.body)}
                  </span>
                </span>
                <ChevronRight
                  className={cn(
                    "mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                    open && "rotate-90",
                  )}
                />
              </button>
            </li>
          );
        })}
      </ol>

      {/* What the round in hand decides for the ones after it. The glyph
          says where the line came from, so the sentence does not have to
          carry a label on top of being a sentence. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={held.phase}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="mt-2 flex items-start gap-1.5 rounded-md border border-sea/15 bg-sea/[0.07] px-2.5 py-1.5 text-left text-xs leading-relaxed"
        >
          <span aria-hidden className="mt-px text-sea">
            ↳
          </span>
          <span>{t(held.setsUp)}</span>
        </motion.p>
      </AnimatePresence>

      <p className="mt-2 flex items-start gap-1.5 border-t border-sea/15 pt-1.5 text-left text-xs leading-relaxed text-muted-foreground">
        <span aria-hidden className="mt-px">
          ↺
        </span>
        <span>{t(closes)}</span>
      </p>
    </div>
  );
}
