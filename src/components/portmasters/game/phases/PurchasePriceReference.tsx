"use client";

import { MARKET_GOODS } from "@/lib/game/constants/goods";
import {
  basePriceRange,
  explainExpectedPrice,
  priceRatio,
} from "@/lib/game/engine";
import type { GameState } from "@/lib/game/types";
import { Term } from "../../Term";
import { ItemIcon } from "../../shared";
import { Sparkline } from "../../Sparkline";
import { ExpectedPriceTooltip } from "../PriceTooltips";
import { HuePanel } from "./PhaseShared";

// Every raw material and product gets a price preview here, not just the
// ones that happened to roll onto one of this round's five market cards.
// A captain planning ahead for Tea or Brocade should be able to check
// the going rate even when nobody's currently selling it.
export function MarketPriceReference({
  game,
  colorFor,
}: {
  game: GameState;
  colorFor: (item: string) => string | undefined;
}) {
  return (
    <HuePanel tone="market">
      <div className="text-[10px] font-semibold tracking-wide text-muted-foreground mb-1.5">
        ━━ MARKET PRICE REFERENCE (hover for details) ━━
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {MARKET_GOODS.map((item) => {
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
        const goodsWithHistory = MARKET_GOODS.filter(
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
                            // The same footprint as a filled cell, so a
                            // row of missing rounds reads as a row of
                            // empty slots rather than shifting the
                            // columns beside it.
                            return (
                              <td key={i} className="px-0.5 text-center">
                                <span className="inline-block h-4 w-7 rounded-sm bg-black/5 dark:bg-white/5" />
                              </td>
                            );
                          }
                          const [min, max] = range;
                          const clamped = priceRatio(price, range);
                          const hue = clamped < 0.5 ? 150 : 25;
                          // Where the price sits in its range is carried
                          // by the fill's own lightness, and the fill is
                          // opaque so the ink can be picked against it
                          // rather than against a tint of whatever the
                          // panel's background happens to be. White reads
                          // on the deep half and black on the pale half,
                          // switching where the two inks' contrast is
                          // equal: around Y 0.18, which is lightness 0.56
                          // on these fills. The old cell set white ink on
                          // a half-transparent tint at seven pixels, which
                          // is the one combination a reader can neither
                          // resolve nor select, and the number is the
                          // whole point of the cell.
                          const lightness = 0.45 + clamped * 0.35;
                          return (
                            <td key={i} className="px-0.5 text-center">
                              <span
                                className={`inline-block h-4 w-7 rounded-sm text-center text-[10px] font-bold leading-4 ${
                                  lightness < 0.56 ? "text-white" : "text-black"
                                }`}
                                style={{
                                  backgroundColor: `oklch(${lightness.toFixed(3)} 0.12 ${hue})`,
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
    </HuePanel>
  );
}
