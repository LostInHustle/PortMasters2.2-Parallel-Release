"use client";

import { cardText } from "@/lib/game/cards";
import type { CardRecord } from "@/lib/game/constants/cards";
import { SHIP_DISCOUNT_PER_LEVEL } from "@/lib/game/constants/ships";
import { t } from "@/lib/game/i18n";
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
      {/* The glossary key stays the English term (see Term), and the two
          labels a captain reads are read here. */}
      <Row label={<Term term="Ship Level">{t("Class")}</Term>}>
        <b>{t("Level {n}", { n: shipLevel })}</b>
      </Row>
      <Row label={<Term term="Freight">{t("Freight")}</Term>}>
        <span className="text-[10px] text-muted-foreground">
          {t("2 Gold per item, minus {discount} Gold per bill (minimum 5)", {
            discount,
          })}
        </span>
      </Row>
      <Row label={t("Modules")}>
        <b>
          {shipLevel === 1
            ? t("{filled} of {total} module slot", {
                filled: modules.length,
                total: shipLevel,
              })
            : t("{filled} of {total} module slots", {
                filled: modules.length,
                total: shipLevel,
              })}
        </b>
      </Row>
      {modules.length === 0 ? (
        <p className="pt-1 text-[10px] text-muted-foreground">
          {t(
            "No modules installed. Upgrade the hull in the Shipyard to unlock slots.",
          )}
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
