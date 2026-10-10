"use client";

import { answerMilestone } from "@/lib/game/engine";
import { MILESTONE_MOMENTS } from "@/lib/game/constants/milestones";
import { milestoneChoices, milestonePending } from "@/lib/game/milestones";
import { MomentOverlay } from "./MomentOverlay";
import type { PhasePanelProps } from "./PhaseShared";

/**
 * [F4: boons at milestone moments] The milestone moment's own five
 * readings, on the one overlay a moment is answered on (see
 * ./MomentOverlay for the body and for why a moment is an overlay rather
 * than a phase).
 *
 * The moments are a queue rather than a single fixed seat, because
 * several can wait at once and the one being answered is the head of it:
 * both the moment's words and its three cards are read off
 * game.milestoneOffers[0], through the same readers the engine's arm
 * path and answer path use.
 *
 * The guard is milestonePending, and it refuses more than an empty
 * queue: the switch has to be on and the head has to still have a card
 * on its table, so a moment whose only table the power budget emptied is
 * left inert on the queue rather than drawn as a screen with no exit,
 * and it revives if the hull later lightens (see the field notes in
 * @/lib/game/milestones).
 *
 * The three cards are milestoneChoices, the same table the engine's
 * answer path validates against (see answerMilestone), so the cards a
 * captain presses are exactly the cards a press may take. The trio is
 * derived off the voyage's seed, so a reload between the moment becoming
 * due and the answer cannot reshuffle the cards under the captain's
 * eyes.
 *
 * The copy is ./constants/milestones' and not this file's, for the
 * reason the phase accents live in @/lib/game/phases: a moment's words
 * are read by the engine's ledger line and this screen, and prose kept
 * here could not be named by the line.
 */
export function MilestoneDraft({
  game,
  act,
}: Pick<PhasePanelProps, "game" | "act">) {
  return (
    <MomentOverlay
      game={game}
      act={act}
      pending={milestonePending}
      // Both readers ask the head of the queue, which is the moment the
      // guard just found waiting.
      moment={(g) => MILESTONE_MOMENTS[g.milestoneOffers[0]]}
      choices={(g) => milestoneChoices(g, g.milestoneOffers[0])}
      actionLabel="Take This Boon"
      answer={answerMilestone}
    />
  );
}
