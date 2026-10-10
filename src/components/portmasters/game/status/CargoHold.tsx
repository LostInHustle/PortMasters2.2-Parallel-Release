"use client";

import { basePriceRange } from "@/lib/game/engine";
import { unlockedProducts, unlockedResources } from "@/lib/game/pools";
import { SHORT_RATIONS_YIELD } from "@/lib/game/constants/supplies";
import type { GameState } from "@/lib/game/types";
import { itemColorResolver } from "@/lib/use-color-preference";
import { Term } from "../../Term";
import { ItemIcon } from "../../shared";
import { priceAwareTermContent } from "../PriceTooltips";
import { Coins } from "lucide-react";
import type { RosterEntry } from "../GameStatusPanel";

/**
 * The Cargo tab: what is in the hold, split into the two halves it is
 * bought and sold in, then what the whole of it is worth and how it breaks
 * down between the halves. The artisan rows are the crew aboard, counted
 * from the same roster the Dues tab prices.
 */
export function CargoHold({
  game,
  roster,
  workerCount,
  colorFor,
}: {
  game: GameState;
  roster: RosterEntry[];
  workerCount: number;
  colorFor?: (item: string) => string | undefined;
}) {
  const resolveColor = itemColorResolver(colorFor);
  // The two halves of the hold, resolved once each. Both are pure lookups
  // off the difficulty and the round, and the Cargo tab draws them as two
  // lists and then counts them again for the composition bar at the
  // bottom, which had the pair being asked for four times per render.
  const cargoResources = unlockedResources(game.difficulty, game.currentRound);
  const cargoProducts = unlockedProducts(game.difficulty, game.currentRound);
  // Only what is aboard is drawn. A good a captain does not hold is a row
  // their eye reads again to learn nothing, and printing every unlocked good
  // at zero would be a column of nothing said eleven times on a rail that
  // counts its rows. The Hold Value estimator and the composition bar below
  // draw nothing at zero too, which is the same reading applied to the rows.
  const heldResources = cargoResources.filter(
    (r) => (game.inventory[r] || 0) > 0,
  );
  const heldProducts = cargoProducts.filter(
    (p) => (game.inventory[p] || 0) > 0,
  );

  return (
    <>
      {/* Cargo Value Estimator */}
      {(() => {
        let totalValue = 0;
        let totalItems = 0;
        for (const item of Object.keys(game.inventory)) {
          const qty = game.inventory[item] || 0;
          if (qty <= 0) continue;
          const range = basePriceRange(item);
          if (range) {
            const avg = (range[0] + range[1]) / 2;
            totalValue += avg * qty;
            totalItems += qty;
          }
        }
        totalValue = Math.round(totalValue);
        if (totalItems === 0) return null;
        return (
          <div className="mb-2 rounded-lg border border-ship/15 bg-ship/[0.04] px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Coins className="h-3 w-3 text-gold-ink" />
              Hold Value
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">
                {totalItems} items
              </span>
              <span className="font-display text-sm font-bold text-gold-ink tabular-nums">
                ~{totalValue}g
              </span>
            </div>
          </div>
        );
      })()}
      {heldResources.length > 0 && (
        <>
          <div className="text-[10px] font-semibold tracking-wide text-muted-foreground mb-0.5">
            ━━ Raw Materials ━━
          </div>
          {heldResources.map((r) => (
            <InvItem
              key={r}
              icon={<ItemIcon item={r} className="h-3.5 w-3.5" />}
              name={r}
              color={resolveColor(r)}
              count={game.inventory[r] || 0}
              priceContent={priceAwareTermContent(game, r)}
            />
          ))}
        </>
      )}
      {heldProducts.length > 0 && (
        <>
          <div className="text-[10px] font-semibold tracking-wide text-muted-foreground mt-2 mb-0.5">
            ━━ Finished Goods ━━
          </div>
          {heldProducts.map((p) => (
            <InvItem
              key={p}
              icon={<ItemIcon item={p} className="h-3.5 w-3.5" />}
              name={p}
              color={resolveColor(p)}
              count={game.inventory[p] || 0}
              priceContent={priceAwareTermContent(game, p)}
            />
          ))}
        </>
      )}
      {heldResources.length === 0 && heldProducts.length === 0 && (
        <p className="text-[10px] text-muted-foreground">
          Nothing in the hold yet.
        </p>
      )}
      {workerCount > 0 ? (
        <>
          <div className="text-[10px] font-semibold tracking-wide text-muted-foreground mt-2 mb-0.5">
            ━━ Artisans ━━
          </div>
          {roster
            .filter((r) => r.list.length > 0)
            .map((r) => (
              <InvItem
                key={r.id}
                icon={r.icon}
                name={r.plural}
                term={r.label}
                count={r.list.length}
                skilled={r.list.filter((x) => x.isSkilled).length}
                muted
              />
            ))}
        </>
      ) : null}
      {/* Cargo composition bar */}
      {(() => {
        const rawCount = cargoResources.reduce(
          (s, r) => s + (game.inventory[r] || 0),
          0,
        );
        const productCount = cargoProducts.reduce(
          (s, p) => s + (game.inventory[p] || 0),
          0,
        );
        const total = rawCount + productCount;
        if (total === 0) return null;
        const rawPct = Math.round((rawCount / total) * 100);
        const productPct = 100 - rawPct;
        return (
          <div className="mt-2 rounded-lg border border-border/30 bg-black/[0.02] p-2 dark:bg-white/[0.02]">
            <div className="mb-1 flex items-center justify-between text-[9px] text-muted-foreground">
              <span>Cargo Composition</span>
              <span>{total} items</span>
            </div>
            <div className="flex h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div
                className="bg-sea transition-all duration-300"
                style={{ width: `${rawPct}%` }}
                title={`Raw Materials: ${rawCount} (${rawPct}%)`}
              />
              <div
                className="bg-warn transition-all duration-300"
                style={{ width: `${productPct}%` }}
                title={`Finished Goods: ${productCount} (${productPct}%)`}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[9px]">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-sea" />
                <span className="text-muted-foreground">Raw {rawCount}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-muted-foreground">
                  Products {productCount}
                </span>
                <span className="inline-block h-2 w-2 rounded-full bg-warn" />
              </span>
            </div>
          </div>
        );
      })()}
    </>
  );
}

function InvItem({
  icon,
  name,
  term,
  color,
  count,
  muted,
  skilled,
  priceContent,
}: {
  icon: React.ReactNode;
  name: string;
  term?: string;
  color?: string;
  count: number;
  muted?: boolean;
  skilled?: number;
  priceContent?: React.ReactNode;
}) {
  return (
    <div className="flex items-center py-0.5 text-[11px]">
      <span className="mr-1.5 inline-flex items-center text-[14px]">
        {icon}
      </span>
      <span className="flex-1" style={{ color: muted ? undefined : color }}>
        <Term term={term ?? name} content={priceContent}>
          {name}
        </Term>
      </span>
      {skilled !== undefined && skilled > 0 && (
        <span
          className="mr-1.5 text-[10px] text-warn"
          /* The hungry case is named here because the engine's own lesson
             is that a trained hand on short rations makes one, not two
             (see the yield comment in engine/workers.ts), and a tooltip
             promising the full two over a hold that gained one is the
             ledger lying about work the captain can count. The pace is
             the constant's own, the same percentage the larder's own
             short rations line carries. */
          title={`${skilled} of ${count} trained: each produces 2 per round, working at ${Math.round(SHORT_RATIONS_YIELD * 100)}% pace while the crew goes hungry`}
        >
          ⭐{skilled}
        </span>
      )}
      <span
        className="min-w-[30px] text-right font-bold"
        style={{ color: muted ? undefined : color }}
      >
        {count}
      </span>
    </div>
  );
}
