"use client";

import { Button } from "@/components/ui/button";
import {
  basePriceRange,
  explainCardPrice,
  getCardFinalCost,
  purchaseCard,
} from "@/lib/game/engine";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { Term } from "../../Term";
import { ItemIcon } from "../../shared";
import { PriceBreakdownTooltip, priceAwareTermContent } from "../PriceTooltips";
import { TradeCard, type PhasePanelProps } from "./PhaseShared";

type MarketCard = GameState["resourceCards"][number];

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
          <span>📍 {c.port}</span>
          <span className="text-muted-foreground">
            {c.isProductCard ? "Product" : "Raw Material"}
          </span>
        </>
      }
      footer={
        <Button
          className={cn("w-full rounded-lg", canAfford ? "pm-grad-market" : "")}
          variant={canAfford ? "default" : "secondary"}
          disabled={!canAfford}
          onClick={() => act((g, l) => purchaseCard(g, c.id, l))}
        >
          {purchased ? "✅ Purchased" : `🛒 Buy (${finalCost}💰)`}
        </Button>
      }
    >
      {c.resources.map((r, i) => {
        const pulse = game.harborPulse?.[r.type];
        const hasPulse = pulse !== undefined && Math.abs(pulse) > 0.01;
        // flex-wrap matters here: the good name, the Deal or Pricey
        // chip and the harbor pulse chip together are wider than a
        // narrow market card, and the card clips its overflow.
        return (
          <div
            key={i}
            className="flex flex-wrap items-center gap-y-1 text-[12px]"
          >
            <ItemIcon item={r.type} className="mr-1.5 h-4 w-4" />
            <Term term={r.type} content={priceAwareTermContent(game, r.type)}>
              <span className="font-medium" style={{ color: colorFor(r.type) }}>
                {r.type}
              </span>
            </Term>
            <span className="mx-1.5">×{r.quantity}</span>
            <span className="ml-auto text-muted-foreground">
              Unit: {r.price}💰
            </span>
            {(() => {
              const range = basePriceRange(r.type);
              if (!range) return null;
              const [min, max] = range;
              const price = r.price ?? 0;
              const isDeal = price < min;
              const isPricey = price > max;
              if (!isDeal && !isPricey) return null;
              return (
                <span
                  className={cn(
                    "ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                    isDeal ? "bg-gain/5 text-gain" : "bg-alarm/5 text-alarm",
                  )}
                  title={
                    isDeal
                      ? `Below the typical range of ${min} to ${max} Gold`
                      : `Above the typical range of ${min} to ${max} Gold`
                  }
                >
                  {isDeal ? "Deal" : "Pricey"}
                </span>
              );
            })()}
            {hasPulse && (
              <span
                className={cn(
                  "ml-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                  pulse > 0 ? "bg-alarm/5 text-alarm" : "bg-gain/5 text-gain",
                )}
                title={
                  pulse > 0
                    ? "The harbor leaned into this good last round, so prices are up"
                    : "The harbor ignored this good last round, so prices softened"
                }
              >
                {pulse > 0 ? "▲" : "▼"}
                {Math.abs(Math.round(pulse * 100))}%
              </span>
            )}
          </div>
        );
      })}
      {c.isProductCard && c.resources[0].materialCost ? (
        <div className="text-[10px] text-muted-foreground pl-6">
          📦 Mat Cost: {c.resources[0].materialCost} Gold (
          {c.resources[0].materialDetails})
        </div>
      ) : null}
      <div className="pt-2 mt-1 border-t border-dashed border-black/10 dark:border-white/10">
        <Term content={<PriceBreakdownTooltip breakdown={breakdown} />}>
          <span className="text-alarm font-bold text-sm">
            💰 Total: {finalCost} Gold
          </span>
        </Term>
        {finalCost < c.totalCost && (
          <span className="text-muted-foreground text-[10px] ml-1">
            (Was {c.totalCost})
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
 */
export function PurchaseBoard({
  game,
  act,
  colorFor,
}: Pick<PhasePanelProps, "game" | "act"> & {
  colorFor: (item: string) => string | undefined;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
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
