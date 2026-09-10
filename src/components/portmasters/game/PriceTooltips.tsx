"use client";

import {
  explainExpectedPrice,
  type ExpectedPrice,
  type PriceBreakdown,
} from "@/lib/game/engine";
import type { GameState } from "@/lib/game/types";
import { GLOSSARY } from "@/lib/game/glossary";
import { unlockedProducts, unlockedResources } from "@/lib/game/pools";

/**
 * Tooltip bodies for the two price explanation hovers in the game: an
 * exact step by step breakdown for a specific market card or trade order
 * (PriceBreakdownTooltip), and a general "what does this usually cost"
 * range for any raw material or product, on or off the current market
 * (ExpectedPriceTooltip, buying phase only, see the Term usages in
 * GameStatusPanel and GamePhasePanel).
 */
export function PriceBreakdownTooltip({
  breakdown,
}: {
  breakdown: PriceBreakdown;
}) {
  return (
    <div className="space-y-0.5 min-w-[160px]">
      <div className="flex justify-between gap-3">
        <span>Base</span>
        <span>{breakdown.base}g</span>
      </div>
      {breakdown.steps.map((s, i) => (
        <div key={i} className="flex justify-between gap-3">
          <span>{s.label}</span>
          <span>
            {s.delta >= 0 ? "+" : ""}
            {s.delta}g
          </span>
        </div>
      ))}
      <div className="flex justify-between gap-3 font-semibold border-t border-current/15 pt-0.5 mt-0.5">
        <span>Final</span>
        <span>{breakdown.final}g</span>
      </div>
    </div>
  );
}

export function ExpectedPriceTooltip({ price }: { price: ExpectedPrice }) {
  return (
    <div className="space-y-1 min-w-[170px]">
      <div className="font-semibold">
        Typically {price.min} to {price.max} Gold{" "}
        {price.isProduct ? "per item" : "per unit"}
      </div>
      {price.modifiers.map((m, i) => (
        <div key={i} className="text-[11px]">
          {m}
        </div>
      ))}
      {!price.isProduct && (
        <div className="text-[11px] opacity-80">
          ±1 Gold depending on the port
        </div>
      )}
      <div className="text-[11px] opacity-70 pt-0.5 border-t border-current/15 mt-1">
        Actual market cards this round can still vary
      </div>
    </div>
  );
}

// During the buying phase, a hover over any raw material or product name
// shows its glossary blurb plus the expected price, so the preview is
// available everywhere that name shows up (the cargo hold sidebar, the
// market reference strip, the cards themselves), not just where a price
// already happens to be printed. Outside the buying phase this returns
// undefined and the caller's <Term> falls back to its normal glossary
// lookup, since the user only wants this for the buying phase. Actual
// demand and prices later in the voyage can vary.
export function priceAwareTermContent(game: GameState, itemType: string) {
  if (game.phase !== 1) return undefined;
  // Gated on what this voyage has actually unlocked, not the whole catalogue.
  // Quoting a market price for a good no charter has opened advertises
  // something the captain cannot buy, and the figure would be meaningless
  // anyway since a locked good never appears on a market card.
  const openResources = unlockedResources(game.difficulty, game.currentRound);
  const openProducts = unlockedProducts(game.difficulty, game.currentRound);
  if (!openResources.includes(itemType) && !openProducts.includes(itemType))
    return undefined;
  const description = GLOSSARY[itemType];
  const price = explainExpectedPrice(game, itemType);
  return (
    <div className="space-y-1.5">
      {description && <div>{description}</div>}
      <div className="pt-1 border-t border-current/15">
        <ExpectedPriceTooltip price={price} />
      </div>
    </div>
  );
}
