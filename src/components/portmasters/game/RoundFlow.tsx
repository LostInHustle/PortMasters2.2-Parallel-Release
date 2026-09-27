"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { phaseFace } from "@/lib/game/phases";
import type { RoundLeg } from "@/lib/game/mode";

/**
 * One mode's round, drawn as the flow it is.
 *
 * Every leg stands on the rail in the order the engine walks them,
 * wearing the fill of the phase it is, and the leg a captain is reading
 * opens the line underneath: what that leg decides for the legs after it.
 *
 * The rail is deliberately complete rather than a stepper that shows one
 * leg at a time. This panel is read before the voyage begins, to work out
 * what the mode is asking for, and a shape that has to be walked one
 * click at a time cannot be taken in at a glance or held in the head
 * while a decision is made. What the click buys is the consequence line,
 * and the reading is meant to move back and forth along the rail rather
 * than once down it.
 *
 * Every leg's body is always shown, and only the consequence line is the
 * one the focus picks. Hiding a leg's body behind a click would leave the
 * chart unreadable to a captain who never clicks, and this is the panel
 * they meet before they know what the mode is.
 *
 * Nothing here decides what a round is: the legs arrive from the mode
 * record, and the smoke suite holds them to the lap. See RoundLeg.
 */
export function RoundFlow({
  legs,
  closes,
}: {
  legs: readonly RoundLeg[];
  closes: string;
}) {
  // The first leg is open on arrival, because some leg has to be: a rail
  // with nothing under it opens as a list of rows and never shows a
  // captain that the rows answer to a click.
  const [focused, setFocused] = useState(0);
  const held = legs[focused];

  return (
    <div className="mt-2">
      <ol>
        {legs.map((leg, index) => {
          const open = index === focused;
          // A leg stands for the phase the engine walks, and what a phase is
          // called, wears and shows is the phase's own business (see
          // PHASE_FACES). The mode record says what a phase decides; it does
          // not say what to call it a second time.
          const face = phaseFace(leg.phase);
          return (
            <li key={leg.phase}>
              <button
                type="button"
                onClick={() => setFocused(index)}
                aria-expanded={open}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-md px-1.5 py-1 text-left transition-colors",
                  open ? "bg-sea/[0.09]" : "hover:bg-sea/[0.05]",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold",
                    face.gradient,
                  )}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">
                    {face.icon} {face.label}
                  </span>
                  <span className="block text-[11px] leading-snug text-muted-foreground">
                    {leg.body}
                  </span>
                </span>
                <ChevronRight
                  className={cn(
                    "mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                    open && "rotate-90",
                  )}
                />
              </button>
              {/* The rail between two legs, drawn rather than written, so
                  the legs read as one run instead of seven rows. The
                  offset is the number tile's centre: the button pads by
                  1.5 and the tile is 5 wide. */}
              {index < legs.length - 1 && (
                <span aria-hidden className="ml-4 block h-2.5 w-px bg-sea/25" />
              )}
            </li>
          );
        })}
      </ol>

      {/* What the leg in hand decides for the ones after it. The glyph
          says where the line came from, so the sentence does not have to
          carry a label on top of being a sentence. */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={held.phase}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="mt-2 flex items-start gap-1.5 rounded-md border border-sea/15 bg-sea/[0.07] px-2.5 py-1.5 text-left text-[11px] leading-relaxed"
        >
          <span aria-hidden className="mt-px text-sea">
            ↳
          </span>
          <span>{held.setsUp}</span>
        </motion.p>
      </AnimatePresence>

      <p className="mt-2 flex items-start gap-1.5 border-t border-sea/15 pt-1.5 text-left text-[11px] leading-relaxed text-muted-foreground">
        <span aria-hidden className="mt-px">
          ↺
        </span>
        <span>{closes}</span>
      </p>
    </div>
  );
}
