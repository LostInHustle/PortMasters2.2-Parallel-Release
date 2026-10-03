"use client";

import { cardText } from "@/lib/game/cards";
import { heldBoonCards } from "@/lib/game/milestones";
import type { GameState } from "@/lib/game/types";

/**
 * [F4: boons at milestone moments] What the moments have left in this
 * captain's hands, at the top of the captain's own rail.
 *
 * A row on the rail rather than a card in the stage, for the reason the
 * path chip beside it gives: these are readings about this captain, and
 * the stage belongs to the board the fleet is working. The row sits under
 * the chip because the two answer the same question in the same words,
 * what this captain carries for the rest of the voyage.
 *
 * Each chip is the card's own glyph and name, read through the pool by
 * id so a retuned card is the card a captain holds on the next frame (the
 * same resolution the effects themselves use, see heldBoonCards), and the
 * effect line rides the tooltip rather than the rail: a rail counts its
 * rows, and five full descriptions would be a paragraph in the middle of
 * it. The line shown on hover is the card's own English description,
 * which is the sentence the overlay that dealt it printed.
 *
 * It draws nothing when nothing is held, which covers two ordinary
 * screens: a captain early in a voyage, and every screen in a harbor that
 * never arms a moment. It is deliberately not read through the switch:
 * the plan's rollback keeps held boons riding for the voyage (see
 * milestoneBoonsOn), so a row hidden behind it would be a screen lying
 * about effects the captain still holds.
 */
export function HeldBoons({ game }: { game: GameState }) {
  const cards = heldBoonCards(game);
  if (cards.length === 0) return null;
  return (
    <div className="shrink-0">
      <div className="flex flex-wrap gap-1.5">
        {cards.map((card) => {
          const text = cardText(card);
          return (
            <span
              key={card.id}
              title={text.desc}
              className="inline-flex min-w-0 items-center gap-1 rounded-md border border-dawn/20 bg-dawn/[0.06] px-1.5 py-0.5 text-[11px] font-medium"
            >
              <span className="leading-none">{card.icon}</span>
              <span className="pm-truncate">{text.name}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
