"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/game/i18n";
import { pathFactText, pathGuide } from "@/lib/game/paths";
import type { DraftStep } from "@/types/realtime/draft";
import { PhaseHeading, type PhasePanelProps } from "./PhaseShared";
import { Notice } from "../../shared";

// The three beats, in the words a captain reads them in.
//
// One table rather than three lists, because the title, the line and the
// button label are one beat told three ways and a reader editing a beat has
// to see all three at once. The keys are the wire's own step names, so a
// fourth beat would be a compile error here rather than a blank card.
//
// The table keeps the English the pack is keyed on; the reads happen where
// the beat is drawn, because a t() call up here would freeze at whatever
// language the process started in.
//
// The lines are the design's deal read out loud: "Keep one, pass two to the
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

// The guide rows, keyed by id and built once at module load: the small
// facts a card prints under its own sentence are the record's own reading
// (see pathGuide in @/lib/game/paths), the same rows the tutorial's path
// page and the manual's path page print. This panel carries no arithmetic
// of its own about them, so a retuned hold or ceiling reaches the cards,
// the two pages and nothing else has to move.
const PATH_GUIDE = new Map(pathGuide().map((entry) => [entry.id, entry]));

/**
 * The deal, drawn as the stage a dealing Gambit
 * departure opens at.
 *
 * The design asks for this interface by name: "Forty five seconds with a good
 * interface is the target, so the interface is not an afterthought on this
 * one." So the panel is built around the two things a captain needs and
 * nothing else: the cards, and what to do with them this beat. Each card
 * wears its crest, its name, its own signature sentence and the few numbers
 * the record carries, because the choice the design wants measured ("taking
 * it is a choice somebody makes rather than a duty somebody gets assigned")
 * is only a choice if the captain can read what they are choosing between.
 *
 * Two things this panel deliberately does not have, and both were field
 * findings rather than taste. There is no countdown: the harbor waits at this
 * seat for its captains, each step turns over when every seat has answered,
 * and a clock face here was telling captains a timer was deciding for them
 * when nothing of the sort was true (see DRAFT_WATCH_MS, which is a
 * reconnect window nobody is shown). And the cards are full width rows
 * rather than a grid of tiles: the same three offers in one row of narrow
 * columns is what made the last two steps feel like the table was taking
 * the options away, and a row that holds one card with harbor to read it is
 * the shape a captain can actually weigh. A hand of two rows the same size
 * as a hand of three is the point rather than a side effect.
 *
 * A captain who has laid their card down sees the wait instead of the rows,
 * which is the shape the boon draft takes: the picker goes away so the same
 * card cannot be laid twice, and what is left is the count of the table
 * still choosing. The count is the harbor's own number (see DraftView.open)
 * and it is painted from the frames the server sends as the other seats
 * answer, so it moves while they do. The wait is the harbor's own reading of
 * the seat as well as this screen's (see DraftView.picked), which is what
 * carries it across a reconnect: a captain whose tab went dark mid step
 * comes back to the wait the harbor has been keeping for them, rather than
 * to cards whose press the harbor would refuse.
 */
export function PathDraft({ draft }: Pick<PhasePanelProps, "draft">) {
  // The beat this captain has answered, stamped with the harbor and the step
  // so no reset logic is needed anywhere: a new step is a new stamp, and a
  // step this captain answered is simply not this one any more.
  const [picked, setPicked] = useState<{
    roomId: string;
    step: DraftStep;
  } | null>(null);

  const view = draft.view;
  // The beat between the harbor moving to this seat and this captain's hand
  // landing, which is a socket hop wide. A captain who was not dealt in (a
  // late arrival) never sees a view either, and reads the empty state the
  // identity chip in the rail draws for them; here the stage only has to
  // keep standing rather than shout, which is why the sentence below names
  // a dealt hand rather than an arrival: for a late arrival no hand was
  // dealt, and the chip is the surface that says so.
  if (!view) {
    return (
      <div className="flex min-h-[clamp(280px,44dvh,420px)] items-center justify-center px-6 text-center">
        <p className="text-sm text-muted-foreground">
          {t(
            "The cards are being cut. If a hand was dealt to you, it lands here.",
          )}
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
  // The wait a captain reads is the harbor's own answer first and this
  // screen's own stamp second. The view's `picked` is what carries it
  // across a reconnect, where the press that laid the card was not this
  // screen's: a seat whose card the harbor laid while they were gone comes
  // back to the wait rather than to cards that would refuse the press
  // (see DraftView.picked). The local stamp covers the beat between a
  // press and the frame confirming it, which is a socket hop wide.
  const answered =
    view.picked ||
    (picked?.roomId === view.roomId && picked.step === view.step);
  // The count is of the cards still in front of somebody, and this captain
  // is one of them until they answer: the caption says which of the two
  // readings it is rather than leaving the number to be interpreted. Each
  // reading is this card's own words, so the sentence that carries the
  // caption below takes it as it arrives.
  const caption = answered
    ? view.open === 0
      ? t("The table is in. The step closes now.")
      : t("Waiting on {view.open} more.", { "view.open": view.open })
    : t("Cards still out: {view.open}", { "view.open": view.open });

  return (
    <div className="mx-auto max-w-3xl py-2">
      <PhaseHeading layout="mb-1" tone="text-path-draft">
        {t("🃏 The Path Draft")}
      </PhaseHeading>
      <p className="mb-3 text-center text-sm text-muted-foreground">
        {t(
          "Three cards each, dealt face down. What you hold at the end is the path you sail this voyage, and the deal comes first because every stop after it reads your path: your hold, your Renown ceiling and the orders that lock to you.",
        )}
      </p>

      {draft.error && (
        <Notice
          message={draft.error}
          onDismiss={draft.clearError}
          className="mb-3"
          size="sm"
        />
      )}

      {/* The beat's own banner: the step, and the sentence that says what
          this step is asking for. */}
      <div className="mb-3 rounded-xl border border-path-draft/20 bg-path-draft/[0.04] px-3.5 py-2.5 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-path-draft">
          {t(face.title)}
        </div>
        {!answered && (
          <p className="mt-1 text-xs text-foreground">{t(face.line)}</p>
        )}
      </div>

      {answered ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("Your card is down. {caption}", { caption })}
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
              const entry = PATH_GUIDE.get(path)!;
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
                      {entry.crest}
                    </span>
                    <div className="min-w-0">
                      <div className="font-display text-sm font-semibold text-foreground">
                        {t(entry.name)}
                      </div>
                      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                        {t(entry.signature)}
                      </p>
                      {entry.facts.length > 0 && (
                        <p className="mt-1.5 text-[10px] text-muted-foreground">
                          {entry.facts.map((fact, index) => (
                            <span key={index}>
                              {index > 0 && " · "}
                              {/* Every reading is composed at this read
                                  by the record's own reader (see
                                  pathFactText in @/lib/game/paths): the
                                  sentence is built here rather than
                                  when the guide above is built, which
                                  is what lets the language of this
                                  visit decide the words, and what
                                  keeps the readings out of the
                                  module-load table. */}
                              {pathFactText(fact)}
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
                    {t(face.keep)}
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
