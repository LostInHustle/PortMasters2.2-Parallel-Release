"use client";

import { cardText } from "@/lib/game/cards";
import { answerMilestone } from "@/lib/game/engine";
import { MILESTONE_MOMENTS } from "@/lib/game/constants/milestones";
import { milestoneChoices, milestonePending } from "@/lib/game/milestones";
import { DraftCard, DraftGrid, PhaseHeading } from "./PhaseShared";
import type { PhasePanelProps } from "./PhaseShared";

/**
 * [F4: boons at milestone moments] The overlay a moment arrives on.
 *
 * An overlay rather than a phase, and both halves of that are the plan's
 * reading. The five moments land at three different seats of the lap, so
 * a phase would have to be re-entered from each of them and every other
 * captain's screen would have to move for one captain's moment: the
 * overlay is drawn over the seat the captain already stands at, and the
 * fleet's lap is untouched. And answering is a local act, the same shape
 * as the round boon's lock in: one press takes the card, writes the
 * voyage's own copy and drops the moment, with no ready vote and no
 * phase gate, so a captain can be mid order and answer without leaving
 * the board they were reading.
 *
 * It covers the stage it is drawn in rather than sitting beside the
 * board, because the board below is still live state and a card floating
 * over clickable orders would be two screens claiming one press. The one
 * exit is a card: the plan's moments have no decline, and every card is
 * a gain (see ./engine/milestones), so the grid is the whole screen.
 *
 * The copy is ./constants/milestones' and not this file's, for the
 * reason the phase accents live in @/lib/game/phases: a moment's words
 * are read by the engine's ledger line and this screen, and prose kept
 * here could not be named by the line. The card dress is the boon
 * draft's own grid and card, so a milestone boon is dealt exactly as the
 * round boons are and the captain's eye meets no new shape.
 */
export function MilestoneDraft({
  game,
  act,
}: Pick<PhasePanelProps, "game" | "act">) {
  // The same reader the engine's answer path validates against and the
  // same guard every renderer of the queue asks (see milestonePending),
  // so the three cards a captain presses are exactly the cards a press
  // may take.
  if (!milestonePending(game)) return null;
  const trigger = game.milestoneOffers[0];
  const moment = MILESTONE_MOMENTS[trigger];
  const choices = milestoneChoices(game, trigger);
  return (
    <div className="pm-glass-strong pm-scroll absolute inset-0 z-20 overflow-y-auto rounded-2xl p-4 sm:p-5">
      <div className="max-w-4xl mx-auto text-center py-2">
        <PhaseHeading layout="mb-1" tone="text-dawn">
          {moment.icon} {moment.title}
        </PhaseHeading>
        <p className="text-sm text-muted-foreground mb-4">{moment.line}</p>
        <DraftGrid>
          {choices.map((card) => {
            const text = cardText(card);
            return (
              <DraftCard
                key={card.id}
                tone="border-dawn/15"
                icon={card.icon}
                name={text.name}
                nameClassName="text-foreground"
                desc={text.desc}
                actionLabel={`${moment.icon} Take This Boon`}
                actionClassName="pm-grad-dawn"
                onSelect={() => act((g, l) => answerMilestone(g, card.id, l))}
              />
            );
          })}
        </DraftGrid>
      </div>
    </div>
  );
}
