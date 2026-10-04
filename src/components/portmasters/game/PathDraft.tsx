"use client";

import { DraftStep, DraftView } from "@/types/realtime/draft";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { pathConfig } from "@/lib/game/paths";
import { phaseClockLabel, secondsRemaining } from "@/lib/phase-clock";
import { PhaseError } from "./phases/PhaseShared";

// The three beats, in the words a captain reads them in.
//
// One table rather than three lists, because the title, the line and the
// button label are one beat told three ways and a reader editing a beat has
// to see all three at once. The keys are the wire's own step names, so a
// fourth beat would be a compile error here rather than a blank card.
//
// The lines are the plan's deal read out loud: "Keep one, pass two to the
// left, keep one of the two received, pass one, discard the last." The last
// beat says what the choice actually is, which is the reading this build
// settled on (see the header of src/lib/game/draft.ts): the two papers in
// front of a captain are their own two keeps, and the voyage is sailed on
// whichever of them they hold on to.
const STEP_FACE: Record<
  Exclude<DraftStep, "done">,
  { title: string; line: string; keep: string }
> = {
  first: {
    title: "Step 1 of 3: Keep One",
    line: "Your three cards. Keep one, and the other two pass to the left.",
    keep: "Keep This One",
  },
  second: {
    title: "Step 2 of 3: Keep One Of Two",
    line: "Two cards arrived from your right. Keep one, and the other goes face down.",
    keep: "Keep This One",
  },
  last: {
    title: "Step 3 of 3: Discard One",
    line: "Your two papers. Keep the one you sail on, and the other goes over the side.",
    keep: "Sail As This One",
  },
};

/**
 * [D7: the draft, and switching] The deal, drawn over the table.
 *
 * The plan asks for this interface by name: "Forty five seconds with a good
 * interface is the target, so the interface is not an afterthought on this
 * one." So the panel is built around the three things a captain needs and
 * nothing else: the cards, what to do with them this beat, and how long is
 * left. Each card wears its crest, its name and its own signature sentence,
 * because the choice the plan wants measured ("taking it is a choice
 * somebody makes rather than a duty somebody gets assigned") is only a
 * choice if the captain can read what they are choosing between.
 *
 * A captain who has laid their card down sees the wait instead of the
 * cards, which is the shape the boon draft takes: the picker goes away so
 * the same card cannot be laid twice, and what is left is the count of the
 * table still choosing.
 *
 * The clock is the server's deadline read against the browser's own clock,
 * through the same two helpers the phase clock uses (see @/lib/phase-clock
 * for why reading a countdown against a local clock decides nothing). A
 * step that runs out is answered for whoever has not chosen, by the server,
 * so nothing on this screen has to act when the number reaches zero.
 *
 * The view is held by the draft's own hook rather than by the room, and one
 * of the four steps is not drawn here at all: a settled view is the result
 * rather than a beat (see DraftStep), so this panel draws nothing for it
 * and the identity it carries is read off the chip below the controls, and
 * off the ledger line the server writes for the fleet.
 */
export function PathDraft({
  view,
  error,
  onKeep,
  onDismissError,
}: {
  view: DraftView;
  error: string | null;
  onKeep: (pick: number) => void;
  onDismissError: () => void;
}) {
  // The reading the countdown is drawn against, as state rather than a
  // Date.now() taken in the render, for the reason the phase clock gives:
  // a render has to happen for a number to change. The ticker runs only
  // while this panel is drawing a beat, which is the whole of the time a
  // draft is on screen.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (view.step === "done") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [view.step, view.deadline]);

  // The beat this captain has answered, stamped with the room and the step
  // so no reset logic is needed anywhere: a new step is a new stamp, and a
  // step this captain answered is simply not this one any more.
  const [picked, setPicked] = useState<{
    roomId: string;
    step: DraftStep;
  } | null>(null);

  if (view.step === "done") return null;
  const face = STEP_FACE[view.step];
  const answered = picked?.roomId === view.roomId && picked.step === view.step;
  const secondsLeft = secondsRemaining(view.deadline, now) ?? 0;
  // The count is of the cards still in front of somebody, and this captain
  // is one of them until they answer: the caption says which of the two
  // readings it is rather than leaving the number to be interpreted.
  const caption = answered
    ? view.open === 0
      ? "The table is in. The step closes now."
      : `Waiting on ${view.open} more.`
    : `Cards still out: ${view.open}`;

  return (
    // Capped and centred, because this panel is a strip across the whole
    // table while its contents are three cards and two lines. Left to the
    // full width of a desktop the caption sits on one edge and the step
    // counter on the other, with nothing between them, which reads as a
    // broken row rather than as a deal. The cap is the width the three
    // cards need, so the header sits over them instead of beside them.
    <div className="pm-glass mx-auto mb-3 max-w-3xl rounded-2xl border border-voyage/15 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold">
            🧭 The Path Draft
          </h2>
          {/* The explainer rides only while the choice is live. A captain
              whose card is down has read it, and the band holds this row
              open for the rest of the step while the table finishes, so
              it is the one reading the wait does not need. */}
          {!answered && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Three cards each, dealt face down. What you hold at the end is the
              path you sail this voyage.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="font-semibold uppercase tracking-wide text-voyage">
            {face.title}
          </span>
          <span className="pm-glass-strong rounded-lg px-2 py-0.5 font-semibold">
            {phaseClockLabel(secondsLeft)}
          </span>
        </div>
      </div>

      {error && (
        <PhaseError
          message={error}
          onDismiss={onDismissError}
          className="mt-2"
        />
      )}

      {!answered && <p className="mt-2 text-xs text-foreground">{face.line}</p>}

      {answered ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Your card is down. {caption}
        </p>
      ) : (
        <>
          {/* Three cards in one row wherever there is a row to put them
              in. The panel this row sits in is capped to the width the
              three want, so nothing here repeats that cap: a second one
              would be the same number written twice, and the panel's is
              the one that binds. */}
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {view.hand.map((path, index) => {
              // The cards in a hand are PathIds, the reader above having
              // answered null for anything else (see readDraftView in
              // @/lib/use-path-draft), so this lookup always answers.
              const card = pathConfig(path)!;
              return (
                <motion.div
                  // A deck with a floor can deal one captain two cards of
                  // the same path, so the index is what makes the key
                  // unique rather than the card.
                  key={`${path}:${index}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.2,
                    ease: "easeOut",
                    delay: index * 0.05,
                  }}
                  whileHover={{ y: -4 }}
                  className="pm-glass flex flex-col items-center rounded-xl border border-voyage/15 p-2.5 text-center sm:p-3"
                >
                  {/* The crest rides beside the name rather than above it:
                      a line of its own costs a line on every card, and on
                      a phone the three cards are stacked, so that line is
                      paid three times. */}
                  <div className="flex items-center justify-center gap-2">
                    <span aria-hidden className="text-2xl">
                      {card.crest}
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {card.name}
                    </span>
                  </div>
                  <div className="mt-1 flex-1 text-[11px] leading-snug text-muted-foreground">
                    {card.signature}
                  </div>
                  <Button
                    size="sm"
                    className="pm-grad-voyage mt-2 w-full rounded-lg font-semibold"
                    onClick={() => {
                      setPicked({ roomId: view.roomId, step: view.step });
                      onKeep(index);
                    }}
                  >
                    {face.keep}
                  </Button>
                </motion.div>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">{caption}</p>
        </>
      )}
    </div>
  );
}
