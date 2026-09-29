"use client";

import {
  basePriceRange,
  getCardFinalCost,
  priceRatio,
} from "@/lib/game/engine";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { Lightbulb, TrendingUp, ArrowUp, ArrowDown } from "lucide-react";
import { ItemIcon } from "../../shared";
import { HuePanel, PanelLabel } from "./PhaseShared";

/**
 * Trade Route Advisor. Analyzes the current market cards and ranks
 * them by value score: the cheapest goods (by unit price relative to
 * the typical range) rise to the top. A quick read on which cards
 * are the best deals this round.
 */
export function TradeAdvisor({
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
    <HuePanel tone="advisor">
      <PanelLabel tone="text-advisor">
        <Lightbulb className="h-3.5 w-3.5" /> Best Deals This Round
      </PanelLabel>
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
    </HuePanel>
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
export function MarketPulse({ game }: { game: GameState }) {
  const pulse = game.harborPulse ?? {};
  const entries = Object.entries(pulse).filter(([, v]) => Math.abs(v) > 0.01);

  if (entries.length === 0) return null;

  // Sort: the strongest lean first. A positive pulse means the price is up.
  const sorted = entries.sort(([, a], [, b]) => b - a);
  const pricier = sorted.filter(([, v]) => v > 0);
  const softer = sorted.filter(([, v]) => v < 0);

  return (
    <HuePanel tone="pulse">
      <PanelLabel tone="text-pulse" note="already priced into this board">
        <TrendingUp className="h-3.5 w-3.5" />
        Harbor Pulse
      </PanelLabel>
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
    </HuePanel>
  );
}

/**
 * Market Depth. Shows how many market cards offer each good this round.
 * A good with 3+ cards has high availability (more chances to buy),
 * while a good with 1 card is scarce. Helps a captain decide whether
 * to buy now or wait for a better card.
 */
export function MarketDepth({
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
    <HuePanel tone="depth" className="px-3.5 py-2 mb-3.5">
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
    </HuePanel>
  );
}
