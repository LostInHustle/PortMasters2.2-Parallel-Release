"use client";

import { cardText } from "@/lib/game/cards";
import type { CardRecord } from "@/lib/game/constants/cards";
import type { GameState } from "@/lib/game/types";
import { DraftCard, DraftGrid, PhaseHeading } from "./PhaseShared";
import type { PhasePanelProps } from "./PhaseShared";

/**
 * [F4: boons at milestone moments] [F6: charters at leg four] The one
 * overlay a moment is answered on, printed by the milestone draft and
 * the charter draft alike.
 *
 * The milestone draft and the charter draft share this body: the same
 * stage covering card, the same heading block, the same grid, and the
 * same per card markup down to its dress and its classes. What the two
 * differ in is what this component takes as props, and there are five of
 * them:
 * the guard that decides whether a question is standing at all, the
 * moment it is standing for, the three cards the question deals, the
 * words on the action button, and the answer a press writes. Everything
 * else lives here once, so a change to the dress is one edit rather than
 * two that can drift apart.
 *
 * An overlay rather than a phase, and both halves of that are the plan's
 * reading. A moment lands at a seat the captain already stands at (one
 * fixed leg for the charter, up to five triggers at three different
 * seats for the milestones), so a phase would have to be restarted from
 * each of them and every other captain's screen would have to move for
 * one captain's moment: the overlay is drawn over that seat, and the
 * fleet's lap is untouched. And answering is a local act, the same shape
 * as the round boon's lock in: one press takes the card, writes the
 * voyage's own copy and drops the moment, with no ready vote and no
 * phase gate, so a captain can be mid order and answer without leaving
 * the board they were reading.
 *
 * It covers the stage it is drawn in rather than sitting beside the
 * board, because the board below is still live state and a card floating
 * over clickable orders would be two screens claiming one press. The one
 * exit is a card: a moment has no decline and every card is a gain, so
 * the grid is the whole screen, and the moment's own window never closes
 * on it. A captain who sails past the seat without answering simply
 * never answered, and the moment is still there if they come back.
 *
 * The guard is asked before anything else is read, so a moment that is
 * not standing costs no read and draws nothing at all. Each caller
 * passes the same guard and the same card table its own answer path
 * validates against (see answerMilestone and answerCharter in
 * @/lib/game/engine), so the cards a captain presses are exactly the
 * cards a press may take, and both tables are derived off the voyage's
 * seed, so a reload between the moment becoming due and the answer
 * cannot reshuffle the cards under the captain's eyes.
 *
 * The copy is each moment's own (see @/lib/game/constants/milestones and
 * @/lib/game/constants/charters) and not this file's, for the reason the
 * phase accents live in @/lib/game/phases: a moment's words are read by
 * the engine's ledger line and by this screen, and prose kept here could
 * not be named by the line. The card dress is the boon drafts' own grid
 * and card, so a moment is dealt exactly as every other card in the
 * voyage is and the captain's eye meets no new shape.
 */

// The three fields both moment vocabularies carry and this overlay
// prints: the glyph, the title and the line under it (see the two
// vocabularies in @/lib/game/constants).
type MomentFace = { icon: string; title: string; line: string };

export function MomentOverlay({
  game,
  act,
  pending,
  moment,
  choices,
  actionLabel,
  answer,
}: {
  // The state being drawn, and the same act every phase panel writes
  // through.
  game: GameState;
  act: PhasePanelProps["act"];
  // The guard: whether a moment is standing for this captain at all. It
  // is asked first, so everything below reads only a question that is
  // actually on the table.
  pending: (game: GameState) => boolean;
  // The moment's own words, read off the same state the guard read.
  moment: (game: GameState) => MomentFace;
  // The three cards the moment deals, from the same table the engine's
  // answer path validates against.
  choices: (game: GameState) => CardRecord[];
  // The words on the action button, after the moment's own glyph; each
  // moment names its own act.
  actionLabel: string;
  // The answer a press writes: the card's id goes to the engine, which
  // derives the trio again and refuses a stale click.
  answer: (game: GameState, cardId: string, logs: string[]) => void;
}) {
  // Nothing at all rather than an empty frame: a question that is not
  // standing is an absence, and the board under this overlay is the
  // whole screen until one arrives.
  if (!pending(game)) return null;
  const face = moment(game);
  const cards = choices(game);
  return (
    <div className="pm-glass-strong pm-scroll absolute inset-0 z-20 overflow-y-auto rounded-2xl p-4 sm:p-5">
      <div className="max-w-4xl mx-auto text-center py-2">
        <PhaseHeading layout="mb-1" tone="text-dawn">
          {face.icon} {face.title}
        </PhaseHeading>
        <p className="text-sm text-muted-foreground mb-4">{face.line}</p>
        <DraftGrid>
          {cards.map((card) => {
            const text = cardText(card);
            return (
              <DraftCard
                key={card.id}
                tone="border-dawn/15"
                icon={card.icon}
                name={text.name}
                nameClassName="text-foreground"
                desc={text.desc}
                actionLabel={`${face.icon} ${actionLabel}`}
                actionClassName="pm-grad-dawn"
                onSelect={() => act((g, l) => answer(g, card.id, l))}
              />
            );
          })}
        </DraftGrid>
      </div>
    </div>
  );
}
