"use client";

import { answerCharter } from "@/lib/game/engine";
import { CHARTER_MOMENT } from "@/lib/game/constants/charters";
import { charterChoices, charterPending } from "@/lib/game/charters";
import { MomentOverlay } from "./MomentOverlay";
import type { PhasePanelProps } from "./PhaseShared";

/**
 * [F6: charters at leg four] The charter moment's own five readings, on
 * the one overlay a moment is answered on (see ./MomentOverlay for the
 * body and for why the moment is an overlay rather than a phase).
 *
 * The moment is one fixed leg rather than a queue: it lands at the
 * fourth leg, and "waiting" is that leg reached with the state's own
 * charter field still null, which is what charterPending reads. The
 * words are the single CHARTER_MOMENT record for the same reason.
 *
 * The three cards are charterChoices and nothing else, the same table
 * the engine's answer path validates against (see answerCharter), so the
 * cards a captain presses are exactly the cards a press may take. The
 * trio is derived off a round-less seed, so a reload between the moment
 * becoming due and the answer cannot reshuffle the cards under the
 * captain's eyes.
 *
 * The copy is ./constants/charters' and not this file's, for the reason
 * the phase accents live in @/lib/game/phases: the moment's words are
 * read by the engine's ledger line and by this screen, and prose kept
 * here could not be named by the line.
 */
export function CharterDraft({
  game,
  act,
}: Pick<PhasePanelProps, "game" | "act">) {
  return (
    <MomentOverlay
      game={game}
      act={act}
      // The same guard every renderer of the moment asks, so the overlay
      // draws nothing at all unless the question is standing: switch on,
      // a path held, the leg reached, no answer given.
      pending={charterPending}
      moment={() => CHARTER_MOMENT}
      choices={charterChoices}
      actionLabel="Sail Under This"
      answer={answerCharter}
    />
  );
}
