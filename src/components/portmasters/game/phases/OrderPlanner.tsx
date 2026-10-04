"use client";

import { cargoCarriesTag } from "@/lib/game/cards";
import {
  brokersFavorCommission,
  calcTransportCost,
  explainVAT,
  lockedBehind,
} from "@/lib/game/engine";
import type { GameState } from "@/lib/game/types";
import { ClipboardList, CheckCircle2, Clock, Coins } from "lucide-react";
import { ItemIcon } from "../../shared";
import { HuePanel } from "./PhaseShared";

/**
 * Order Fulfillment Planner. A summary panel at the top of the Orders
 * phase that gives a captain a quick read on which orders are ready to
 * fill right now, which are close (missing 1 or 2 goods), and what the
 * total potential net profit is if every completable order is filled.
 *
 * Does not modify the game state. Pure read only analysis.
 */
export function OrderFulfillmentPlanner({ game }: { game: GameState }) {
  type Plan = {
    id: number;
    ready: boolean;
    missingGoods: { item: string; have: number; need: number }[];
    netProfit: number;
    reward: number;
  };

  const plans: Plan[] = game.customerCards
    .filter((o) => !game.completedOrders.includes(o.id))
    // [D2] Locked cards are left out of the plan, not listed as impossible
    // ones: this panel answers what to sail for, and a card waiting on a path
    // the captain does not hold is not a thing to sail for, whatever the hold
    // is carrying. The board already prints those three cards in full, so
    // nothing is being hidden here, only kept out of the arithmetic.
    .filter((o) => lockedBehind(game, o) === null)
    .map((o) => {
      const missing: { item: string; have: number; need: number }[] = [];
      for (const r of o.resources) {
        const have = game.inventory[r.type] || 0;
        const need = r.required ?? 0;
        if (have < need) {
          missing.push({ item: r.type, have, need });
        }
      }
      const hasWoven = cargoCarriesTag(o.resources, "woven");
      const transport = calcTransportCost(game, o.totalItems, hasWoven);
      let net = o.reward - transport;
      if (o.isProductOrder) {
        // The engine's own reading of the taxed line (see completeOrder):
        // a product card with no line, or a line with no count, adds no
        // VAT to the estimate rather than throwing the plan out with a
        // non null assertion.
        const productRef = o.resources[0];
        const productUnits = productRef?.required ?? 0;
        if (productRef && productUnits > 0) {
          const vat = explainVAT(
            game,
            productRef.type,
            o.reward / productUnits,
          );
          net -= vat.final * productUnits;
        }
      }
      if (o.isBrokerFavor) {
        net -= brokersFavorCommission(o.reward);
      }
      return {
        id: o.id,
        ready: missing.length === 0,
        missingGoods: missing,
        netProfit: net,
        reward: o.reward,
      };
    });

  // The two groups everything below is drawn from. Both were filtered out
  // of plans three times over on the way down the panel, which is five
  // walks of the order list to answer two questions, and the "close"
  // predicate was written out three times in a row, two of them for the
  // same use.
  const readyPlans = plans.filter((p) => p.ready);
  const closePlans = plans.filter(
    (p) => !p.ready && p.missingGoods.length <= 2,
  );

  const readyCount = readyPlans.length;
  const closeCount = closePlans.length;
  const totalPotential = readyPlans.reduce((sum, p) => sum + p.netProfit, 0);

  if (plans.length === 0) return null;

  return (
    <HuePanel tone="planner">
      <div className="flex items-center gap-3 flex-wrap text-[11px]">
        <span className="flex items-center gap-1 font-semibold text-planner">
          <ClipboardList className="h-3.5 w-3.5" />
          Fulfillment Plan
        </span>
        {readyCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gain/5 px-2 py-0.5 font-medium text-gain">
            <CheckCircle2 className="h-3 w-3" />
            {readyCount} ready
          </span>
        )}
        {closeCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-warn/5 px-2 py-0.5 font-medium text-warn">
            <Clock className="h-3 w-3" />
            {closeCount} close
          </span>
        )}
        {totalPotential > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 font-bold text-gain">
            <Coins className="h-3 w-3" />+{totalPotential} Gold
            <span className="font-normal text-muted-foreground">
              if all ready filled
            </span>
          </span>
        )}
      </div>
      {/* Missing goods for close orders */}
      {closeCount > 0 && (
        <div className="mt-2 border-t border-planner/10 pt-2 space-y-1">
          {closePlans.map((p) => (
            <div key={p.id} className="flex items-center gap-2 text-[10px]">
              <Clock className="h-3 w-3 text-warn" />
              <span className="text-muted-foreground">
                Order #{p.id} needs:
              </span>
              {p.missingGoods.map((m, i) => (
                <span key={i} className="inline-flex items-center gap-0.5">
                  <ItemIcon item={m.item} className="h-3 w-3" />
                  <span className="font-medium">{m.item}</span>
                  <span className="text-alarm">
                    {m.have}/{m.need}
                  </span>
                  {i < p.missingGoods.length - 1 && (
                    <span className="text-muted-foreground">,</span>
                  )}
                </span>
              ))}
              <span className="ml-auto text-gain font-medium">
                +{p.netProfit}g
              </span>
            </div>
          ))}
        </div>
      )}
    </HuePanel>
  );
}
