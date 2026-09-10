"use client";

import { Button } from "@/components/ui/button";
import {
  COMMODITIES,
  PRODUCT_PRICES,
  PRODUCTS,
  RESOURCES,
} from "@/lib/game/constants";
import {
  completePhase1,
  explainCardPrice,
  explainExpectedPrice,
  getCardFinalCost,
  purchaseCard,
} from "@/lib/game/engine";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { itemColorResolver } from "@/lib/use-color-preference";
import {
  Anchor,
  Lightbulb,
  TrendingUp,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Term } from "../../Term";
import { ItemIcon } from "../../shared";
import { Sparkline } from "../../Sparkline";
import {
  PriceBreakdownTooltip,
  ExpectedPriceTooltip,
  priceAwareTermContent,
} from "../PriceTooltips";
import { ReadyFooter, type PhasePanelProps } from "./PhaseShared";

// Every raw material and product gets a price preview here, not just the
// ones that happened to roll onto one of this round's five market cards.
// A captain planning ahead for Tea or Brocade should be able to check
// the going rate even when nobody's currently selling it.
function MarketPriceReference({
  game,
  colorFor,
}: {
  game: GameState;
  colorFor: (item: string) => string | undefined;
}) {
  return (
    <div className="rounded-xl border border-teal-500/15 bg-teal-500/[0.03] px-3.5 py-2.5 mb-3.5">
      <div className="text-[10px] font-semibold tracking-wide text-muted-foreground/80 mb-1.5">
        ━━ MARKET PRICE REFERENCE (hover for details) ━━
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {[...RESOURCES, ...PRODUCTS].map((item) => {
          const history = game.priceHistory?.[item] ?? [];
          const hasHistory = history.length > 0;
          return (
            <Term
              key={item}
              term={item}
              content={
                <ExpectedPriceTooltip
                  price={explainExpectedPrice(game, item)}
                />
              }
            >
              <span
                className="inline-flex items-center gap-1 text-[11px]"
                style={{ color: colorFor(item) }}
              >
                <ItemIcon item={item} className="h-3 w-3" /> {item}
                {hasHistory && (
                  <Sparkline
                    data={history}
                    width={40}
                    height={14}
                    className="align-middle opacity-70"
                    strokeClassName="stroke-current"
                    fillClassName="fill-current"
                    showArea={false}
                    strokeWidth={1}
                  />
                )}
              </span>
            </Term>
          );
        })}
      </div>
      {/* Price history heatmap */}
      {(() => {
        const goodsWithHistory = [...RESOURCES, ...PRODUCTS].filter(
          (item) => (game.priceHistory?.[item]?.length ?? 0) > 0,
        );
        if (goodsWithHistory.length === 0) return null;
        const maxRound = Math.max(
          ...goodsWithHistory.map((g) => game.priceHistory[g].length),
        );
        return (
          <div className="mt-2 border-t border-teal-500/10 pt-2">
            <div className="text-[9px] text-muted-foreground/70 mb-1">
              Price History Heatmap
            </div>
            <div className="overflow-x-auto pm-scroll">
              <table className="text-[9px]">
                <thead>
                  <tr>
                    <th className="pr-1.5 text-left font-normal text-muted-foreground/60">
                      Good
                    </th>
                    {Array.from({ length: maxRound }, (_, i) => (
                      <th
                        key={i}
                        className="px-0.5 text-center font-normal text-muted-foreground/50"
                      >
                        R{i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {goodsWithHistory.map((item) => {
                    const history = game.priceHistory[item];
                    const range = COMMODITIES[item]?.basePrice ??
                      PRODUCT_PRICES[item] ?? [0, 100];
                    return (
                      <tr key={item}>
                        <td
                          className="pr-1.5 whitespace-nowrap font-medium"
                          style={{ color: colorFor(item) }}
                        >
                          {item}
                        </td>
                        {Array.from({ length: maxRound }, (_, i) => {
                          const price = history[i];
                          if (price === undefined) {
                            return (
                              <td key={i} className="px-0.5 text-center">
                                <span className="inline-block h-3 w-3 rounded-sm bg-black/5 dark:bg-white/5" />
                              </td>
                            );
                          }
                          const [min, max] = range;
                          const ratio = (price - min) / (max - min || 1);
                          const clamped = Math.max(0, Math.min(1, ratio));
                          const hue = clamped < 0.5 ? 150 : 25;
                          return (
                            <td key={i} className="px-0.5 text-center">
                              <span
                                className="inline-block h-3 w-5 rounded-sm font-bold text-white leading-3"
                                style={{
                                  backgroundColor: `oklch(0.55 0.12 ${hue} / ${0.4 + clamped * 0.5})`,
                                  fontSize: "7px",
                                }}
                                title={`R${i + 1}: ${price} Gold (range ${min} to ${max})`}
                              >
                                {price}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

/**
 * Trade Route Advisor. Analyzes the current market cards and ranks
 * them by value score: the cheapest goods (by unit price relative to
 * the typical range) rise to the top. A quick read on which cards
 * are the best deals this round.
 */
function TradeAdvisor({
  game,
  colorFor,
}: {
  game: GameState;
  colorFor: (item: string) => string | undefined;
}) {
  type Scored = {
    cardId: number;
    port: string;
    goodName: string;
    unitPrice: number;
    qty: number;
    totalCost: number;
    isProduct: boolean;
    score: number;
    range: [number, number];
  };

  const scored: Scored[] = game.resourceCards
    .filter((c) => !game.purchasedCards.includes(c.id))
    .flatMap((c) => {
      const finalCost = getCardFinalCost(game, c);
      return c.resources.map((r) => {
        const range = COMMODITIES[r.type]?.basePrice ??
          PRODUCT_PRICES[r.type] ?? [0, 100];
        const unit = r.price ?? 0;
        const qty = r.quantity ?? 0;
        const [min, max] = range;
        const ratio = (unit - min) / (max - min || 1);
        const clamped = Math.max(0, Math.min(1, ratio));
        const baseScore = 1 - clamped;
        // Boost score for goods that match revealed intel (guaranteed
        // orders in Phase 2), since buying them now secures a known
        // future reward.
        const matchesIntel = game.revealedIntel.some((i) => i.item === r.type);
        const score = matchesIntel ? Math.min(1, baseScore + 0.2) : baseScore;
        return {
          cardId: c.id,
          port: c.port,
          goodName: r.type,
          unitPrice: unit,
          qty,
          totalCost: finalCost,
          isProduct: c.isProductCard,
          score,
          range: range as [number, number],
        };
      });
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (scored.length === 0) return null;

  return (
    <div className="rounded-xl border border-indigo-500/15 bg-indigo-500/[0.03] px-3.5 py-2.5 mb-3.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-indigo-600 dark:text-indigo-400/80 mb-1.5">
        <Lightbulb className="h-3.5 w-3.5" /> Best Deals This Round
      </div>
      <div className="flex flex-wrap gap-2">
        {scored.map((s, i) => {
          const matchesIntel = game.revealedIntel.some(
            (intel) => intel.item === s.goodName,
          );
          return (
            <div
              key={i}
              className="flex items-center gap-1.5 rounded-lg bg-background/60 px-2 py-1 text-[11px]"
            >
              <span className="font-bold text-indigo-600 dark:text-indigo-400">
                {i + 1}.
              </span>
              <ItemIcon item={s.goodName} className="h-3.5 w-3.5" />
              <span style={{ color: colorFor(s.goodName) }}>{s.goodName}</span>
              <span className="text-muted-foreground">x{s.qty}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {s.unitPrice}
              </span>
              <span className="text-[9px] text-muted-foreground">g</span>
              {matchesIntel && (
                <span
                  className="rounded-full bg-amber-500/20 px-1 py-0.5 text-[7px] font-bold text-amber-700 dark:text-amber-300"
                  title="Matches a Broker's Whisper, guaranteed order in Phase 2"
                >
                  Intel
                </span>
              )}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[8px] font-bold text-white",
                  s.score > 0.6
                    ? "bg-emerald-500"
                    : s.score > 0.3
                      ? "bg-amber-500"
                      : "bg-rose-400",
                )}
              >
                {Math.round(s.score * 100)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Market Pulse. Explains why the board in front of the captain is priced
 * the way it is.
 *
 * The pulse is built from the round the room just finished: a good the
 * crews leaned into harder than an even three way split comes out pricier,
 * one nobody touched comes out softer. The server computes it the moment
 * the room advances into Phase 1, and startPhase1 hands it straight to
 * genResourceCard, so by the time this panel draws, the lean is already in
 * the numbers on the cards. It is a reading of the board, not a prediction
 * about the round to come, and saying so plainly matters: a captain who
 * takes it for a forecast waits for a good to soften when it has already
 * settled.
 *
 * The lean is deliberately small. PULSE_CAP holds it to twelve percent
 * either way, so it tilts a decision without dictating one.
 */
function MarketPulse({ game }: { game: GameState }) {
  const pulse = game.harborPulse ?? {};
  const entries = Object.entries(pulse).filter(([, v]) => Math.abs(v) > 0.01);

  if (entries.length === 0) return null;

  // Sort: the strongest lean first. A positive pulse means the price is up.
  const sorted = entries.sort(([, a], [, b]) => b - a);
  const pricier = sorted.filter(([, v]) => v > 0);
  const softer = sorted.filter(([, v]) => v < 0);

  return (
    <div className="rounded-xl border border-violet-500/15 bg-violet-500/[0.03] px-3.5 py-2.5 mb-3.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-violet-600 dark:text-violet-400/80 mb-1.5">
        <TrendingUp className="h-3.5 w-3.5" />
        Harbor Pulse
        <span className="font-normal text-muted-foreground/60 ml-1">
          already priced into this board
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {pricier.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-rose-500 font-semibold">
              Pricier
            </span>
            {pricier.map(([good, v]) => (
              <span
                key={good}
                className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-300"
                title={`${good} is about ${Math.round(v * 100)} percent above its usual price this round`}
              >
                <ArrowUp className="h-2.5 w-2.5" />
                {good}
              </span>
            ))}
          </div>
        )}
        {softer.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-emerald-500 font-semibold">
              Softer
            </span>
            {softer.map(([good, v]) => (
              <span
                key={good}
                className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-300"
                title={`${good} is about ${Math.round(Math.abs(v) * 100)} percent below its usual price this round`}
              >
                <ArrowDown className="h-2.5 w-2.5" />
                {good}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Market Depth. Shows how many market cards offer each good this round.
 * A good with 3+ cards has high availability (more chances to buy),
 * while a good with 1 card is scarce. Helps a captain decide whether
 * to buy now or wait for a better card.
 */
function MarketDepth({
  game,
  colorFor,
}: {
  game: GameState;
  colorFor: (item: string) => string | undefined;
}) {
  // Count how many unpurchased cards offer each good
  const depth: Record<string, number> = {};
  for (const card of game.resourceCards) {
    if (game.purchasedCards.includes(card.id)) continue;
    for (const r of card.resources) {
      depth[r.type] = (depth[r.type] ?? 0) + 1;
    }
  }

  const entries = Object.entries(depth).filter(([, count]) => count > 0);
  if (entries.length === 0) return null;

  // Sort by depth descending
  entries.sort((a, b) => b[1] - a[1]);

  return (
    <div className="rounded-xl border border-teal-500/10 bg-teal-500/[0.02] px-3.5 py-2 mb-3.5">
      <div className="text-[9px] font-semibold tracking-wide text-muted-foreground/70 mb-1">
        Market Depth
      </div>
      <div className="flex flex-wrap gap-1.5">
        {entries.map(([good, count]) => (
          <div
            key={good}
            className="inline-flex items-center gap-1 rounded-md bg-black/5 dark:bg-white/5 px-1.5 py-0.5 text-[10px]"
            title={`${count} card${count === 1 ? "" : "s"} offering ${good} this round`}
          >
            <ItemIcon item={good} className="h-3 w-3" />
            <span style={{ color: colorFor(good) }}>{good}</span>
            <span
              className={cn(
                "rounded px-1 text-[8px] font-bold text-white",
                count >= 3
                  ? "bg-emerald-500"
                  : count === 2
                    ? "bg-amber-500"
                    : "bg-rose-400",
              )}
            >
              {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Purchase({
  game,
  act,
  phaseSync,
  members,
  colorFor,
  onRumorBoardOpen,
}: Pick<
  PhasePanelProps,
  "game" | "act" | "phaseSync" | "members" | "colorFor" | "onRumorBoardOpen"
>) {
  const resolveColor = itemColorResolver(colorFor);
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Anchor className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          Port Merchant Exchange
        </h2>
        <Button
          variant="secondary"
          size="sm"
          className="rounded-lg"
          onClick={onRumorBoardOpen}
        >
          🔮 Broker's Rumor Board
        </Button>
      </div>
      {game.revealedIntel.length > 0 && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3.5 py-2.5 mb-3.5 text-xs">
          <strong>🗣️ Broker's Whispers active this round:</strong>{" "}
          {game.revealedIntel.map((i, idx) => (
            <span key={idx}>
              {idx > 0 && ", "}
              <ItemIcon item={i.item} className="h-3.5 w-3.5" /> {i.item} (
              {i.port})
            </span>
          ))}
          <span className="text-muted-foreground">
            {" "}
            (a matching order is guaranteed in Phase 2, buy accordingly).
          </span>
        </div>
      )}
      <MarketPriceReference game={game} colorFor={resolveColor} />
      <TradeAdvisor game={game} colorFor={resolveColor} />
      <MarketPulse game={game} />
      <MarketDepth game={game} colorFor={resolveColor} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {game.resourceCards.map((c) => {
          const finalCost = getCardFinalCost(game, c);
          const breakdown = explainCardPrice(game, c);
          const purchased = game.purchasedCards.includes(c.id);
          const canAfford = game.money >= finalCost && !purchased;
          return (
            <div
              key={c.id}
              className={cn(
                "rounded-xl border overflow-hidden flex flex-col",
                purchased
                  ? "border-emerald-500/30 bg-emerald-500/[0.04]"
                  : "border-black/10 dark:border-white/10 bg-background/50",
              )}
            >
              <div className="px-3.5 py-2 text-xs font-semibold border-b border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] flex items-center justify-between">
                <span>📍 {c.port}</span>
                <span className="text-muted-foreground">
                  {c.isProductCard ? "Product" : "Raw Material"}
                </span>
              </div>
              <div className="p-3.5 flex-1 space-y-1.5">
                {c.resources.map((r, i) => {
                  const pulse = game.harborPulse?.[r.type];
                  const hasPulse =
                    pulse !== undefined && Math.abs(pulse) > 0.01;
                  // flex-wrap matters here: the good name, the Deal or Pricey
                  // chip and the harbor pulse chip together are wider than a
                  // narrow market card, and the card clips its overflow.
                  return (
                    <div
                      key={i}
                      className="flex flex-wrap items-center gap-y-1 text-[12px]"
                    >
                      <ItemIcon item={r.type} className="mr-1.5 h-4 w-4" />
                      <Term
                        term={r.type}
                        content={priceAwareTermContent(game, r.type)}
                      >
                        <span
                          className="font-medium"
                          style={{ color: resolveColor(r.type) }}
                        >
                          {r.type}
                        </span>
                      </Term>
                      <span className="mx-1.5">×{r.quantity}</span>
                      <span className="ml-auto text-muted-foreground">
                        Unit: {r.price}💰
                      </span>
                      {(() => {
                        const range =
                          COMMODITIES[r.type]?.basePrice ??
                          PRODUCT_PRICES[r.type];
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
                              isDeal
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
                                : "bg-rose-500/15 text-rose-600 dark:text-rose-300",
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
                            pulse > 0
                              ? "bg-rose-500/15 text-rose-600 dark:text-rose-300"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
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
                  <Term
                    content={<PriceBreakdownTooltip breakdown={breakdown} />}
                  >
                    <span className="text-rose-600 dark:text-rose-400 font-bold text-sm">
                      💰 Total: {finalCost} Gold
                    </span>
                  </Term>
                  {finalCost < c.totalCost && (
                    <span className="text-muted-foreground text-[10px] ml-1">
                      (Was {c.totalCost})
                    </span>
                  )}
                </div>
              </div>
              <div className="p-3 pt-0">
                <Button
                  className={cn(
                    "w-full rounded-lg",
                    canAfford ? "pm-grad-jade text-white" : "",
                  )}
                  variant={canAfford ? "default" : "secondary"}
                  disabled={!canAfford}
                  onClick={() => act((g, l) => purchaseCard(g, c.id, l))}
                >
                  {purchased ? "✅ Purchased" : `🛒 Buy (${finalCost}💰)`}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <ReadyFooter
        phaseSync={phaseSync}
        members={members}
        idleLabel="✅ Complete Purchase, Continue"
        onConfirm={() => phaseSync.markReady((g, l) => completePhase1(g, l))}
      />
    </div>
  );
}
