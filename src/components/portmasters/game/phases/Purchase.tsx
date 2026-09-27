"use client";

import { Button } from "@/components/ui/button";
import { ITEMS, LARDER_MAX, RATION_PRICE } from "@/lib/game/constants";
import {
  basePriceRange,
  priceRatio,
  explainCardPrice,
  explainExpectedPrice,
  getCardFinalCost,
  purchaseCard,
} from "@/lib/game/engine";
import {
  crewSize,
  larderRoomLegs,
  onShortRations,
  provisionCrew,
  survivalLayerOn,
} from "@/lib/game/larder";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { itemColorResolver } from "@/lib/use-color-preference";
import {
  Anchor,
  Lightbulb,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Utensils,
} from "lucide-react";
import { Term } from "../../Term";
import { ItemIcon } from "../../shared";
import { Sparkline } from "../../Sparkline";
import {
  PriceBreakdownTooltip,
  ExpectedPriceTooltip,
  priceAwareTermContent,
} from "../PriceTooltips";
import { type PhasePanelProps } from "./PhaseShared";

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
    <div className="rounded-xl border border-market/15 bg-market/[0.03] px-3.5 py-2.5 mb-3.5">
      <div className="text-[10px] font-semibold tracking-wide text-muted-foreground mb-1.5">
        ━━ MARKET PRICE REFERENCE (hover for details) ━━
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {ITEMS.map((item) => {
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
        const goodsWithHistory = ITEMS.filter(
          (item) => (game.priceHistory?.[item]?.length ?? 0) > 0,
        );
        if (goodsWithHistory.length === 0) return null;
        const maxRound = Math.max(
          ...goodsWithHistory.map((g) => game.priceHistory[g].length),
        );
        return (
          <div className="mt-2 border-t border-market/10 pt-2">
            <div className="text-[9px] text-muted-foreground mb-1">
              Price History Heatmap
            </div>
            <div className="overflow-x-auto pm-scroll">
              <table className="text-[9px]">
                <thead>
                  <tr>
                    <th className="pr-1.5 text-left font-normal text-muted-foreground">
                      Good
                    </th>
                    {Array.from({ length: maxRound }, (_, i) => (
                      <th
                        key={i}
                        className="px-0.5 text-center font-normal text-muted-foreground"
                      >
                        R{i + 1}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {goodsWithHistory.map((item) => {
                    const history = game.priceHistory[item];
                    const range = basePriceRange(item) ?? [0, 100];
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
                          const clamped = priceRatio(price, range);
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
    matchesIntel: boolean;
    score: number;
    range: [number, number];
  };

  const scored: Scored[] = game.resourceCards
    .filter((c) => !game.purchasedCards.includes(c.id))
    .flatMap((c) => {
      const finalCost = getCardFinalCost(game, c);
      return c.resources.map((r) => {
        const range = basePriceRange(r.type) ?? [0, 100];
        const unit = r.price ?? 0;
        const qty = r.quantity ?? 0;
        const baseScore = 1 - priceRatio(unit, range);
        // Boost score for goods that match revealed intel (guaranteed
        // orders at Orders), since buying them now secures a known
        // future reward. The flag rides along on the scored row, because
        // the badge below is drawn from it and the alternative was asking
        // the intel list the same question a second time about a good
        // that had already been scored.
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
          matchesIntel,
          score,
          range: range as [number, number],
        };
      });
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (scored.length === 0) return null;

  return (
    <div className="rounded-xl border border-advisor/15 bg-advisor/[0.03] px-3.5 py-2.5 mb-3.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-advisor mb-1.5">
        <Lightbulb className="h-3.5 w-3.5" /> Best Deals This Round
      </div>
      <div className="flex flex-wrap gap-2">
        {scored.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 rounded-lg bg-background/60 px-2 py-1 text-[11px]"
          >
            <span className="font-bold text-intel">{i + 1}.</span>
            <ItemIcon item={s.goodName} className="h-3.5 w-3.5" />
            <span style={{ color: colorFor(s.goodName) }}>{s.goodName}</span>
            <span className="text-muted-foreground">x{s.qty}</span>
            <span className="font-bold text-gain">{s.unitPrice}</span>
            <span className="text-[9px] text-muted-foreground">g</span>
            {s.matchesIntel && (
              <span
                className="rounded-full bg-intel/5 px-1 py-0.5 text-[7px] font-bold text-intel"
                title="Matches a Broker's Whisper, guaranteed order at Orders"
              >
                Intel
              </span>
            )}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[8px] font-bold text-white",
                s.score > 0.6
                  ? "bg-gain"
                  : s.score > 0.3
                    ? "bg-warn"
                    : "bg-alarm",
              )}
            >
              {Math.round(s.score * 100)}%
            </span>
          </div>
        ))}
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
 * the room advances into Market, and startMarket hands it straight to
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
    <div className="rounded-xl border border-pulse/15 bg-pulse/[0.03] px-3.5 py-2.5 mb-3.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-pulse mb-1.5">
        <TrendingUp className="h-3.5 w-3.5" />
        Harbor Pulse
        <span className="font-normal text-muted-foreground ml-1">
          already priced into this board
        </span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {pricier.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-alarm font-semibold">Pricier</span>
            {pricier.map(([good, v]) => (
              <span
                key={good}
                className="inline-flex items-center gap-0.5 rounded-full bg-alarm/5 px-1.5 py-0.5 text-[10px] font-medium text-alarm"
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
            <span className="text-[9px] text-gain font-semibold">Softer</span>
            {softer.map(([good, v]) => (
              <span
                key={good}
                className="inline-flex items-center gap-0.5 rounded-full bg-gain/5 px-1.5 py-0.5 text-[10px] font-medium text-gain"
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
    <div className="rounded-xl border border-depth/15 bg-depth/[0.03] px-3.5 py-2 mb-3.5">
      <div className="text-[9px] font-semibold tracking-wide text-muted-foreground mb-1">
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
                count >= 3 ? "bg-gain" : count === 2 ? "bg-warn" : "bg-alarm",
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

/**
 * Provisions. The Larder, and the rations that fill it.
 *
 * The crew is the artisan roster, and this is where it eats. The panel sits
 * on the market board rather than in a corner of its own because a ration
 * is bought like anything else here, and it sits above the cards rather
 * than under them so the cost of feeding the crew is read before the purse
 * goes into goods: a captain who fills the hold and only then finds they
 * cannot feed the people who will work it was ordered into that mistake by
 * the screen rather than by a decision they made.
 *
 * It buys in legs, and a leg is the whole unit: the same one the crew eats
 * one of at each Dawn, and the same one this phase is. Asking for a leg the
 * larder has no room for or the purse cannot cover buys as much of it as it
 * can rather than refusing outright (see provisionCrew), so the buttons
 * below describe what is about to happen instead of gating on it. The one
 * case that is refused is a purchase that would come to nothing, and that
 * is written on the button rather than left as a click with no answer.
 *
 * Runs only when the layer is on. With the switch off the panel is not
 * drawn at all, the larder is not read and no button is offered, which is
 * the base game.
 */
function Provisions({ game, act }: Pick<PhasePanelProps, "game" | "act">) {
  if (!survivalLayerOn()) return null;
  const crew = crewSize(game);
  const room = larderRoomLegs(game);
  const legCost = crew * RATION_PRICE;
  // What a press of each button would actually buy, held to the same two
  // ceilings provisionCrew applies, so the cost printed on the button is
  // the cost the captain is charged.
  const affordable = legCost > 0 ? Math.floor(game.money / legCost) : 0;
  const oneLeg = Math.min(1, room, affordable);
  const fillLegs = Math.min(room, affordable);
  const short = onShortRations(game);

  return (
    <div className="rounded-xl border border-larder/15 bg-larder/[0.03] px-3.5 py-2.5 mb-3.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-larder mb-1.5">
        <Utensils className="h-3.5 w-3.5" />
        Provisions
        <span className="font-normal text-muted-foreground ml-1">
          one ration a head, eaten at each Dawn
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="text-[11px]">
          <span className="text-muted-foreground">Larder </span>
          <span
            className={cn("font-bold", short ? "text-alarm" : "text-larder")}
          >
            {game.larder}
          </span>
          <span className="text-muted-foreground"> / {LARDER_MAX}</span>
        </span>
        <span className="text-[11px]">
          <span className="text-muted-foreground">Crew </span>
          <span className="font-bold">{crew}</span>
        </span>
        {crew > 0 && (
          <span className="text-[11px] text-muted-foreground">
            a leg of rations costs{" "}
            <span className="font-bold text-foreground">{legCost}</span> Gold
          </span>
        )}
      </div>
      {short && (
        <div className="mt-1.5 text-[10px] text-alarm">
          ⚠️ The larder is empty and the crew is working hungry: every artisan
          produces less until this is filled.
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {/* The buttons wear the theme's own primary rather than the market
            fill the card buttons below wear. A fill is a widget claiming a
            rung, and this panel already has one of its own: painting its
            controls in the phase's green would say the Larder is part of
            the market board rather than the fourth panel on it. */}
        <Button
          size="sm"
          className="rounded-lg"
          variant={oneLeg > 0 ? "default" : "secondary"}
          disabled={oneLeg <= 0}
          onClick={() => act((g, l) => provisionCrew(g, 1, l))}
        >
          🧺 Buy {oneLeg > 0 ? `1 Leg (${legCost}💰)` : "Rations"}
        </Button>
        <Button
          size="sm"
          className="rounded-lg"
          variant={fillLegs > 1 ? "default" : "secondary"}
          disabled={fillLegs <= 1}
          onClick={() => act((g, l) => provisionCrew(g, fillLegs, l))}
        >
          🧺 Fill the Larder
          {fillLegs > 1 ? ` (${fillLegs} Legs, ${fillLegs * legCost}💰)` : ""}
        </Button>
      </div>
      {crew === 0 && (
        <div className="mt-1.5 text-[10px] text-muted-foreground">
          No crew aboard, so there is nobody to feed. Hire artisans and the
          larder starts to matter.
        </div>
      )}
      {crew > 0 && room === 0 && (
        <div className="mt-1.5 text-[10px] text-muted-foreground">
          The larder is full, so there is nothing more to buy here.
        </div>
      )}
      {crew > 0 && room > 0 && fillLegs === 0 && (
        <div className="mt-1.5 text-[10px] text-alarm">
          Not enough Gold for a leg of rations.
        </div>
      )}
    </div>
  );
}

export function Purchase({
  game,
  act,
  colorFor,
  onRumorBoardOpen,
  onContinue,
}: Pick<PhasePanelProps, "game" | "act" | "colorFor" | "onRumorBoardOpen"> & {
  /**
   * Walks to the artisan bench, the second station of this phase. Handed in
   * by the Market container rather than named here: which station follows
   * this board is the phase's business, and this board has no ready vote of
   * its own to spend on it. A captain is not done with Market when they are
   * done with the board. It also means the harbor is not waited on from
   * here, which is why this panel no longer takes the room's member list.
   */
  onContinue: () => void;
}) {
  const resolveColor = itemColorResolver(colorFor);
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Anchor className="h-5 w-5 text-market" />
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
        <div className="rounded-lg border border-warn/25 bg-warn/[0.06] px-3.5 py-2.5 mb-3.5 text-xs">
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
            (a matching order is guaranteed at Orders, buy accordingly).
          </span>
        </div>
      )}
      {/* The sub panels no longer share one shell. The price reference,
          the trade advisor, the pulse and the depth each wear the hue of
          their own widget, so a captain can tell at a glance which one is
          speaking. */}
      <MarketPriceReference game={game} colorFor={resolveColor} />
      <TradeAdvisor game={game} colorFor={resolveColor} />
      <MarketPulse game={game} />
      <MarketDepth game={game} colorFor={resolveColor} />
      <Provisions game={game} act={act} />
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
                  ? "border-gain/30 bg-gain/[0.04]"
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
                              isDeal
                                ? "bg-gain/5 text-gain"
                                : "bg-alarm/5 text-alarm",
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
                              ? "bg-alarm/5 text-alarm"
                              : "bg-gain/5 text-gain",
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
              </div>
              <div className="p-3 pt-0">
                <Button
                  className={cn(
                    "w-full rounded-lg",
                    canAfford ? "pm-grad-market" : "",
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
      <div className="mt-5 text-center">
        <Button className="rounded-xl px-6" onClick={onContinue}>
          ✅ Board Done, to the Artisan Bench
        </Button>
      </div>
    </div>
  );
}
