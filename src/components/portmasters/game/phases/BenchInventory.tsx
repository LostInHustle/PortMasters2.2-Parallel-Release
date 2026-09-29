"use client";

import { unlockedResources } from "@/lib/game/pools";
import type { GameState } from "@/lib/game/types";
import { itemColorResolver } from "@/lib/use-color-preference";
import { ItemIcon } from "../../shared";
import { HuePanel, PanelHeading, type PhasePanelProps } from "./PhaseShared";

// One column of the inventory block: a heading and the goods under it, each
// row a glyph, a name and the count, in the good's own colour. The block
// above the bench had been written out twice with nothing but the heading
// and the list differing between the two.
function InventoryColumn({
  title,
  items,
  inventory,
  colorFor,
}: {
  title: string;
  items: string[];
  inventory: GameState["inventory"];
  colorFor: (item: string) => string | undefined;
}) {
  return (
    <div>
      <strong className="text-xs text-ship">{title}</strong>
      {items.map((r) => (
        <div key={r} className="flex items-center text-[11px] py-0.5">
          <ItemIcon item={r} className="mr-1.5 h-3.5 w-3.5" />
          <span className="flex-1" style={{ color: colorFor(r) }}>
            {r}
          </span>
          <b style={{ color: colorFor(r) }}>{inventory[r] || 0}</b>
        </div>
      ))}
    </div>
  );
}

/**
 * The hold as the bench reads it: the raw materials unlocked so far beside
 * the finished goods this bench can make. It is here rather than on the
 * port board because the two halves of the wardrobe's decision (the crew
 * and the hold) are read together on this screen.
 */
export function BenchInventory({
  game,
  products,
  colorFor,
}: Pick<PhasePanelProps, "game" | "colorFor"> & { products: string[] }) {
  const resolveColor = itemColorResolver(colorFor);
  return (
    <HuePanel tone="ship" className="p-4 mb-4">
      <PanelHeading>📦 Current Inventory</PanelHeading>
      <div className="grid grid-cols-2 gap-4">
        <InventoryColumn
          title="Raw Materials:"
          items={unlockedResources(game.difficulty, game.currentRound)}
          inventory={game.inventory}
          colorFor={resolveColor}
        />
        <InventoryColumn
          title="Finished Goods:"
          items={products}
          inventory={game.inventory}
          colorFor={resolveColor}
        />
      </div>
    </HuePanel>
  );
}
