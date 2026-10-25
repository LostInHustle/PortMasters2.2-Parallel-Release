"use client";

import { Button } from "@/components/ui/button";
import {
  basePriceRange,
  cardLineUnitPrice,
  explainCardPrice,
  getCardFinalCost,
  purchaseCard,
} from "@/lib/game/engine";
import { t } from "@/lib/game/i18n";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { Term } from "../../Term";
import { ItemIcon } from "../../shared";
import { PriceBreakdownTooltip, priceAwareTermContent } from "../PriceTooltips";
import { PanelNote } from "./PhasePanels";
import {
  TradeCard,
  type MarketBoardProps,
  type PhasePanelProps,
} from "./PhaseShared";

type MarketCard = GameState["resourceCards"][number];

// The recipe a product card was drawn from, named when the board is read
// rather than when the card was dealt. A save written before the card kept
// its recipe as a list still carries the rendered sentence, so that string
// is the fallback when there is no list to read.
function materialDetailsText(ref: MarketCard["resources"][number]): string {
  if (ref.materialList)
    return ref.materialList
      .map((m) => t("{m}×{a}", { m: t(m.type), a: m.amount }))
      .join(" + ");
  return ref.materialDetails ?? "";
}

/**
 * One card on the port board: a port's offer, its goods at this round's
 * prices, and the single action that buys it. It draws the shared card
 * frame every board in this directory draws, and it is the only place on
 * this screen that decides whether a card is affordable.
 */
function PurchaseCard({
  game,
  act,
  colorFor,
  card: c,
}: {
  game: GameState;
  act: PhasePanelProps["act"];
  colorFor: (item: string) => string | undefined;
  card: MarketCard;
}) {
  const finalCost = getCardFinalCost(game, c);
  const breakdown = explainCardPrice(game, c);
  const purchased = game.purchasedCards.includes(c.id);
  const canAfford = game.money >= finalCost && !purchased;
  return (
    <TradeCard
      tone={
        purchased
          ? "border-gain/30 bg-gain/[0.04]"
          : "border-black/10 dark:border-white/10 bg-background/50"
      }
      header={
        <>
          <span>📍 {t(c.port)}</span>
          <span className="text-muted-foreground">
            {c.isProductCard ? t("Product") : t("Raw Material")}
          </span>
        </>
      }
      footer={
        <>
          <Button
            className={cn(
              "w-full rounded-lg",
              canAfford ? "pm-grad-market" : "",
            )}
            variant={canAfford ? "default" : "secondary"}
            disabled={!canAfford}
            onClick={() => act((g, l) => purchaseCard(g, c.id, l))}
          >
            {purchased
              ? t("✅ Purchased")
              : t("🛒 Buy ({cost}💰)", { cost: finalCost })}
          </Button>
          {/* Why a grayed Buy is grayed, said beside it. The one reason a
              card refuses that is not already on the button is the purse,
              and the shortfall is a number this card can read: the price
              it already printed and the purse it already checked. A
              captain should not have to open a tooltip or do subtraction
              to learn why a button will not take their press. */}
          {!purchased && game.money < finalCost && (
            <PanelNote tone="alarm" className="mt-1.5 text-[10px] text-center">
              {t("Need {gold} more Gold.", { gold: finalCost - game.money })}
            </PanelNote>
          )}
        </>
      }
    >
      {c.resources.map((r, i) => {
        const pulse = game.harborPulse?.[r.type];
        const hasPulse = pulse !== undefined && Math.abs(pulse) > 0.01;
        // The deal mark and its range. The range is printed under the
        // price rather than kept in a hover title, because "Deal"
        // without the range it is a deal against is a word a captain
        // has to trust rather than a fact they can weigh. The pulse
        // chip keeps its place and its words: the arrow says the
        // direction and "price" says what moved, so nothing on this
        // board needs a hover.
        const range = basePriceRange(r.type);
        // The line's settled unit price, not the list price: the stack
        // charges the card total, so a boon or module can bring the
        // captain's price below the harbor's list while the Unit line
        // still showed the list. The Deal mark reads the same settled
        // number the Buy button will charge for this line's share.
        const unitPrice = Math.round(cardLineUnitPrice(game, c, i) * 10) / 10;
        const isDeal = range !== undefined && unitPrice < range[0];
        const isPricey = range !== undefined && unitPrice > range[1];
        // flex-wrap matters here: the good name and the mark chips
        // together are wider than a narrow market card, and the card
        // clips its overflow.
        return (
          <div
            key={i}
            className="flex flex-wrap items-center gap-y-1 text-[12px]"
          >
            <ItemIcon item={r.type} className="mr-1.5 h-4 w-4" />
            <Term term={r.type} content={priceAwareTermContent(game, r.type)}>
              <span className="font-medium" style={{ color: colorFor(r.type) }}>
                {t(r.type)}
              </span>
            </Term>
            <span className="mx-1.5">×{r.quantity}</span>
            <span className="ml-auto text-right text-muted-foreground">
              <span className="block">
                {t("Unit: {price}💰", { price: unitPrice })}
              </span>
              {range !== undefined && (isDeal || isPricey) && (
                <span
                  className={cn(
                    "block text-[9px]",
                    isDeal ? "text-gain" : "text-alarm",
                  )}
                >
                  {isDeal ? t("Deal") : t("Pricey")}
                  {t(": {low} to {high} typical", {
                    low: range[0],
                    high: range[1],
                  })}
                </span>
              )}
            </span>
            {hasPulse && (
              <span
                className={cn(
                  "ml-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                  pulse > 0 ? "bg-alarm/5 text-alarm" : "bg-gain/5 text-gain",
                )}
              >
                {pulse > 0 ? "▲" : "▼"}
                {Math.abs(Math.round(pulse * 100))}
                {t("% price")}
              </span>
            )}
          </div>
        );
      })}
      {c.isProductCard && c.resources[0]?.materialCost ? (
        <div className="text-[10px] text-muted-foreground pl-6">
          {t("📦 Mat Cost: {gold} Gold ({details})", {
            gold: c.resources[0].materialCost,
            details: materialDetailsText(c.resources[0]),
          })}
        </div>
      ) : null}
      <div className="pt-2 mt-1 border-t border-dashed border-black/10 dark:border-white/10">
        <Term content={<PriceBreakdownTooltip breakdown={breakdown} />}>
          <span className="text-alarm font-bold text-sm">
            {t("💰 Total: {gold} Gold", { gold: finalCost })}
          </span>
        </Term>
        {finalCost < c.totalCost && (
          <span className="text-muted-foreground text-[10px] ml-1">
            {t("(Was {gold})", { gold: c.totalCost })}
          </span>
        )}
      </div>
    </TradeCard>
  );
}

/**
 * The port board itself: every card this round's market is offering, in
 * the grid the port merchant exchange reads them in. It owns no state and
 * asks the game nothing the cards do not answer for themselves, which is
 * why it is a map and a grid and very little else.
 *
 * The columns it deals are the stage's, not the window's. The board is
 * drawn in the middle column of the harbor, so a breakpoint read off the
 * window answers a question nobody asked: at a window wide enough for the
 * old three across rule the stage is still a single column of the harbor, and
 * three cards dealt into it wrapped every goods line and every chip they
 * had. The stage is a container (see the harbor's own note), so this measures
 * the harbor it is actually drawn in: one column while the stage cannot hold
 * two cards, two while it can, and three once each card still has the width
 * the goods rows want. The bottom margin is the panel rhythm the rest of
 * this screen keeps, because each panel here carries its own.
 */
export function PurchaseBoard({ game, act, colorFor }: MarketBoardProps) {
  return (
    <div className="mb-3.5 grid grid-cols-1 gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
      {game.resourceCards.map((c) => (
        <PurchaseCard
          key={c.id}
          game={game}
          act={act}
          colorFor={colorFor}
          card={c}
        />
      ))}
    </div>
  );
}
