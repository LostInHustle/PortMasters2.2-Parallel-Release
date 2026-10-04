"use client";

import { cardText } from "@/lib/game/cards";
import { answerCharter } from "@/lib/game/engine";
import { CHARTER_MOMENT } from "@/lib/game/constants/charters";
import { charterChoices, charterPending } from "@/lib/game/charters";
import { DraftCard, DraftGrid, PhaseHeading } from "./PhaseShared";
import type { PhasePanelProps } from "./PhaseShared";

/**
 * [F6: charters at leg four] The overlay the charter moment arrives on.
 *
 * The milestone draft's own shape, and the reading is that shape read
 * against a different question: the moment lands at the fourth leg, so a
 * phase would have to be re-entered from whichever seat the captain
 * stands at, and answering is a local act (one press takes the card,
 * writes the voyage's own copy and drops the moment, with no ready vote
 * and no phase gate), so it is drawn over the seat the captain already
 * stands at and the fleet's lap is untouched.
 *
 * It covers the stage rather than sitting beside the board, for the
 * draft's reason: the board below is live state, and a card floating
 * over clickable orders would be two screens claiming one press. The
 * one exit is a card, because the plan's moment has no decline and every
 * card is a gain, and the window never closes: a captain who sails to
 * the last leg without answering simply never answered, and the moment
 * is still there if they come back.
 *
 * The three cards are charterChoices and nothing else, the same table
 * the engine's answer path validates against (see answerCharter), so
 * the cards a captain presses are exactly the cards a press may take.
 * The trio is derived off a round-less seed, so a reload between the
 * moment becoming due and the answer cannot reshuffle the cards under
 * the captain's eyes.
 *
 * The copy is ./constants/charters' and not this file's, for the reason
 * the phase accents live in @/lib/game/phases: the moment's words are
 * read by the engine's ledger line and by this screen, and prose kept
 * here could not be named by the line. The card dress is the boon
 * drafts' own grid and card, so the charter is dealt exactly as every
 * other card in this voyage is and the captain's eye meets no new shape.
 */
export function CharterDraft({
  game,
  act,
}: Pick<PhasePanelProps, "game" | "act">) {
  // The same guard every renderer of the moment asks (see
  // charterPending), so the overlay draws nothing at all unless the
  // question is standing: switch on, a path held, the leg reached, no
  // answer given.
  if (!charterPending(game)) return null;
  const moment = CHARTER_MOMENT;
  const choices = charterChoices(game);
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
                actionLabel={`${moment.icon} Sail Under This`}
                actionClassName="pm-grad-dawn"
                onSelect={() => act((g, l) => answerCharter(g, card.id, l))}
              />
            );
          })}
        </DraftGrid>
      </div>
    </div>
  );
}
