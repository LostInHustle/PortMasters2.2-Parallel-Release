"use client";

import { cardText } from "@/lib/game/cards";
import type { CardRecord } from "@/lib/game/constants/cards";
import { heldBoonCards, heldCharterCard } from "@/lib/game/held-cards";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { useState } from "react";

/**
 * One held card on the rail: the card's own glyph and name, read through
 * the pool by id so a retuned card is the card a captain holds on the
 * next frame (the same resolution the effects themselves use, see
 * heldBoonCards). The effect line is the card's own English description,
 * which is the sentence the overlay that dealt it printed.
 *
 * [W3: the status convention] The line lives on the tooltip and behind a
 * tap rather than in the row, because a rail counts its rows and five
 * full descriptions would be a paragraph in the middle of it. The tap is
 * the half a hover title cannot do: a touch screen never fires a title,
 * so the chip is a button that opens the line under the row, one card at
 * a time so the rail's height stays a reading rather than a wall.
 *
 * One chip for both kinds of held card, because the dress is the row's
 * rather than the card's: a boon and a charter sit side by side here and
 * a second copy of the same six classes is the file asking a reader to
 * diff two identical spans.
 */
function HeldChip({
  card,
  open,
  onToggle,
}: {
  card: CardRecord;
  open: boolean;
  onToggle: () => void;
}) {
  const text = cardText(card);
  return (
    <button
      type="button"
      title={text.desc}
      aria-expanded={open}
      onClick={onToggle}
      className={cn(
        "inline-flex min-w-0 cursor-pointer items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        open
          ? "border-dawn/50 bg-dawn/[0.14]"
          : "border-dawn/20 bg-dawn/[0.06]",
      )}
    >
      <span className="leading-none">{card.icon}</span>
      <span className="pm-truncate">{text.name}</span>
    </button>
  );
}

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
 * [F6: charters at leg four] The voyage's charter rides the same row,
 * read through the same held card readers (see heldCharterCard) and
 * wearing the same chip: it is a card this captain took and carries for
 * the rest of the voyage, which is exactly what this row answers. It is
 * deliberately not read through its own switch, for the boons' reason:
 * a held effect rides the voyage even in a build that rolled the moment
 * back (see chartersOn), so a chip hidden behind the switch would be the
 * rail lying about an effect the captain still holds. It is appended
 * rather than prepended, so it never pushes the boon chips sideways the
 * round a captain answers it.
 *
 * It draws nothing when nothing is held, which covers two ordinary
 * screens: a captain early in a voyage, and every screen in a harbor that
 * never arms a moment. The boons half is deliberately not read through
 * the switch either: the plan's rollback keeps held boons riding for the
 * voyage (see milestoneBoonsOn), so a row hidden behind it would be a
 * screen lying about effects the captain still holds.
 */
export function HeldBoons({ game }: { game: GameState }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const cards = heldBoonCards(game);
  const charter = heldCharterCard(game);
  if (cards.length === 0 && charter === null) return null;
  const all = charter !== null ? [...cards, charter] : cards;
  const openCard = all.find((card) => card.id === openId);
  return (
    <div className="shrink-0">
      <div className="flex flex-wrap gap-1.5">
        {cards.map((card) => (
          <HeldChip
            key={card.id}
            card={card}
            open={openId === card.id}
            onToggle={() => setOpenId(openId === card.id ? null : card.id)}
          />
        ))}
        {charter !== null && (
          <HeldChip
            card={charter}
            open={openId === charter.id}
            onToggle={() =>
              setOpenId(openId === charter.id ? null : charter.id)
            }
          />
        )}
      </div>
      {openCard && (
        <p className="mt-1 px-0.5 text-[11px] leading-snug text-muted-foreground">
          {cardText(openCard).desc}
        </p>
      )}
    </div>
  );
}
