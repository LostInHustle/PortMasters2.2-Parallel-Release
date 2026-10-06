"use client";

import { cardText } from "@/lib/game/cards";
import type { CardRecord } from "@/lib/game/constants/cards";
import { SHIP_DISCOUNT_PER_LEVEL } from "@/lib/game/constants/ships";
import { Term } from "../../Term";
import { Row } from "./Rows";

/**
 * The Ship tab: what class the hull is at, what that buys in the freight
 * she can carry, and the modules bolted into her slots. A ship with no
 * modules says so rather than drawing an empty list.
 */
export function ShipTab({
  shipLevel,
  modules,
}: {
  shipLevel: number;
  modules: CardRecord[];
}) {
  const discount = shipLevel * SHIP_DISCOUNT_PER_LEVEL;
  return (
    <>
      <Row label={<Term term="Ship Level">Class</Term>}>
        <b>Level {shipLevel}</b>
      </Row>
      <Row label={<Term term="Freight">Freight</Term>}>
        <span className="text-[10px] text-muted-foreground">
          max(5, n×2 minus {discount})
        </span>
      </Row>
      <Row label="Modules">
        <b>
          {modules.length} of {shipLevel}{" "}
          {shipLevel === 1 ? "module slot" : "module slots"}
        </b>
      </Row>
      {modules.length === 0 ? (
        <p className="pt-1 text-[10px] text-muted-foreground">
          No modules installed. Upgrade the ship in the Shipyard to unlock
          slots.
        </p>
      ) : (
        modules.map((card) => {
          const text = cardText(card);
          return (
            <div key={card.id} className="py-0.5 text-[11px]">
              <span className="mr-1">{card.icon}</span>
              <span className="text-foreground">{text.name}</span>
              <div className="pl-5 text-[10px] text-muted-foreground">
                {text.desc}
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
