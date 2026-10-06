"use client";

import { motion } from "framer-motion";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { renownTitleForLevel } from "@/lib/game/legacy";
import { pathConfig } from "@/lib/game/paths";
import type { DraftStep } from "@/types/realtime/draft";
import { Term } from "../../Term";
import { PhaseError, PhaseHeading, type PhasePanelProps } from "./PhaseShared";

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
//
// There is no fourth entry for a settled view, because a settled view is
// not a beat: it is the result, and the panel draws nothing for it (see
// DraftStep on the wire).
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

// The small facts a card prints under its own sentence, read off the same
// path record the rule reads (see @/lib/game/paths). The record is where a
// path's numbers live, so a retuned hold or ceiling is printed here the
// moment it is retuned there; nothing on this panel carries a number of its
// own.
//
// The hold line only appears where the record actually claims something
// (a factor other than one), because every path carries a factor and only
// two of them are worth printing: "Hold 100%" would be a line a reader
// learns to skip, which is the line the third of them would then be lost
// behind. The renown line prints the rung rather than the level number,
// which is the name the ladder itself gives it (see RENOWN_TITLES), and it
// draws Renown as a glossary term: the deal is the first place a captain
// meets the word, and the rung it names means nothing until the word does.
function cardFacts(
  card: NonNullable<ReturnType<typeof pathConfig>>,
): ReactNode[] {
  const facts: ReactNode[] = [];
  const hold = Math.round(card.cargoModifier * 100);
  if (hold !== 100) facts.push(`Hold ${hold}%`);
  facts.push(
    <>
      <Term>Renown</Term> to {renownTitleForLevel(card.renownCeiling)}
    </>,
  );
  if (card.orderPool.length > 0) {
    facts.push(`${card.orderPool.length} locked orders`);
  }
  return facts;
}

/**
 * [W2: the path draft] The deal, drawn as the stage a dealing Gambit
 * departure opens at.
 *
 * The plan asks for this interface by name: "Forty five seconds with a good
 * interface is the target, so the interface is not an afterthought on this
 * one." So the panel is built around the two things a captain needs and
 * nothing else: the cards, and what to do with them this beat. Each card
 * wears its crest, its name, its own signature sentence and the few numbers
 * the record carries, because the choice the plan wants measured ("taking
 * it is a choice somebody makes rather than a duty somebody gets assigned")
 * is only a choice if the captain can read what they are choosing between.
 *
 * Two things this panel deliberately does not have, and both were field
 * findings rather than taste. There is no countdown: the room waits at this
 * seat for its captains, each step turns over when every seat has answered,
 * and a clock face here was telling captains a timer was deciding for them
 * when nothing of the sort was true (see DRAFT_WATCH_MS, which is a
 * reconnect window nobody is shown). And the cards are full width rows
 * rather than a grid of tiles: the same three offers in one row of narrow
 * columns is what made the last two steps feel like the table was taking
 * the options away, and a row that holds one card with room to read it is
 * the shape a captain can actually weigh. A hand of two rows the same size
 * as a hand of three is the point rather than a side effect.
 *
 * A captain who has laid their card down sees the wait instead of the rows,
 * which is the shape the boon draft takes: the picker goes away so the same
 * card cannot be laid twice, and what is left is the count of the table
 * still choosing. The count is the room's own number (see DraftView.open)
 * and it is painted from the frames the server sends as the other seats
 * answer, so it moves while they do. The wait is the room's own reading of
 * the seat as well as this screen's (see DraftView.picked), which is what
 * carries it across a reconnect: a captain whose tab went dark mid step
 * comes back to the wait the room has been keeping for them, rather than
 * to cards whose press the room would refuse.
 */
export function PathDraft({ draft }: Pick<PhasePanelProps, "draft">) {
  // The beat this captain has answered, stamped with the room and the step
  // so no reset logic is needed anywhere: a new step is a new stamp, and a
  // step this captain answered is simply not this one any more.
  const [picked, setPicked] = useState<{
    roomId: string;
    step: DraftStep;
  } | null>(null);

  const view = draft.view;
  // The beat between the room moving to this seat and this captain's hand
  // landing, which is a socket hop wide. A captain who was not dealt in (a
  // late arrival) never sees a view either, and reads the empty state the
  // identity chip in the rail draws for them; here the stage only has to
  // keep standing rather than shout.
  if (!view) {
    return (
      <div className="flex min-h-[clamp(280px,44dvh,420px)] items-center justify-center px-6 text-center">
        <p className="text-sm text-muted-foreground">
          The cards are being cut. Your hand lands in a moment.
        </p>
      </div>
    );
  }
  // A settled view is the result rather than a beat (see DraftStep), so
  // this panel draws nothing for it: the identity it carries is read off
  // the chip on the captain's own rail, and off the ledger line the server
  // writes for the fleet. The seat itself lasts one announcement longer.
  if (view.step === "done") return null;

  const face = STEP_FACE[view.step];
  // The wait a captain reads is the room's own answer first and this
  // screen's own stamp second. The view's `picked` is what carries it
  // across a reconnect, where the press that laid the card was not this
  // screen's: a seat whose card the room laid while they were gone comes
  // back to the wait rather than to cards that would refuse the press
  // (see DraftView.picked). The local stamp covers the beat between a
  // press and the frame confirming it, which is a socket hop wide.
  const answered =
    view.picked ||
    (picked?.roomId === view.roomId && picked.step === view.step);
  // The count is of the cards still in front of somebody, and this captain
  // is one of them until they answer: the caption says which of the two
  // readings it is rather than leaving the number to be interpreted.
  const caption = answered
    ? view.open === 0
      ? "The table is in. The step closes now."
      : `Waiting on ${view.open} more.`
    : `Cards still out: ${view.open}`;

  return (
    <div className="mx-auto max-w-3xl py-2">
      <PhaseHeading layout="mb-1" tone="text-path-draft">
        🃏 The Path Draft
      </PhaseHeading>
      <p className="mb-3 text-center text-sm text-muted-foreground">
        Three cards each, dealt face down. What you hold at the end is the path
        you sail this voyage.
      </p>

      {draft.error && (
        <PhaseError
          message={draft.error}
          onDismiss={draft.clearError}
          className="mb-3"
        />
      )}

      {/* The beat's own banner: the step, and the sentence that says what
          this step is asking for. */}
      <div className="mb-3 rounded-xl border border-path-draft/20 bg-path-draft/[0.04] px-3.5 py-2.5 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-path-draft">
          {face.title}
        </div>
        {!answered && (
          <p className="mt-1 text-xs text-foreground">{face.line}</p>
        )}
      </div>

      {answered ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Your card is down. {caption}
        </p>
      ) : (
        <>
          {/* One card per row, full width, however many are left. The row
              keeps the same shape at two cards as at three, which is the
              whole of what the layout is for: the step that takes an option
              away takes nothing else away with it. */}
          <div className="space-y-2.5">
            {view.hand.map((path, index) => {
              // The cards in a hand are PathIds, the reader above having
              // answered null for anything else (see readDraftView in
              // @/lib/use-path-draft), so this lookup always answers.
              const card = pathConfig(path)!;
              const facts = cardFacts(card);
              return (
                <motion.div
                  // A deck with a floor can deal one captain two cards of
                  // the same path, so the index is what makes the key
                  // unique rather than the card.
                  key={`${path}:${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.2,
                    ease: "easeOut",
                    delay: index * 0.05,
                  }}
                  className="pm-glass flex flex-col gap-3 rounded-xl border border-path-draft/20 p-3.5 @xl:flex-row @xl:items-center @xl:gap-4 @xl:p-4"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span aria-hidden className="text-3xl leading-none">
                      {card.crest}
                    </span>
                    <div className="min-w-0">
                      <div className="font-display text-sm font-semibold text-foreground">
                        {card.name}
                      </div>
                      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                        {card.signature}
                      </p>
                      {facts.length > 0 && (
                        <p className="mt-1.5 text-[10px] text-muted-foreground">
                          {facts.map((fact, index) => (
                            <span key={index}>
                              {index > 0 && " · "}
                              {fact}
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="pm-grad-path-draft w-full shrink-0 rounded-lg font-semibold @xl:w-auto"
                    onClick={() => {
                      setPicked({ roomId: view.roomId, step: view.step });
                      draft.keep(index);
                    }}
                  >
                    {face.keep}
                  </Button>
                </motion.div>
              );
            })}
          </div>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            {caption}
          </p>
        </>
      )}
    </div>
  );
}
