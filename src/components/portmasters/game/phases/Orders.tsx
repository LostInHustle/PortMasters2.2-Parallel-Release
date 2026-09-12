"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { QuantityInput } from "@/components/ui/quantity-input";
import {
  BROKERS_FAVOR_UNLOCK_LEVEL,
  PRODUCTS,
  RESOURCES,
} from "@/lib/game/constants";
import {
  brokersFavorCommission,
  calcTransportCost,
  callBrokersFavor,
  completeOrder,
  completePhase2,
  explainTransportCost,
  explainVAT,
  type PriceBreakdown,
} from "@/lib/game/engine";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { itemColorResolver } from "@/lib/use-color-preference";
import { Coins, ClipboardList, CheckCircle2, Clock } from "lucide-react";
import { Term } from "../../Term";
import { ItemIcon } from "../../shared";
import { PriceBreakdownTooltip } from "../PriceTooltips";
import { ReadyFooter, type PhasePanelProps } from "./PhaseShared";

export function Orders({
  game,
  act,
  phaseSync,
  members,
  colorFor,
}: Pick<
  PhasePanelProps,
  "game" | "act" | "phaseSync" | "members" | "colorFor"
>) {
  const resolveColor = itemColorResolver(colorFor);
  const [favorOpen, setFavorOpen] = useState(false);
  const [favorItem, setFavorItem] = useState<string | null>(null);
  const [favorQty, setFavorQty] = useState(1);
  const favorUnlocked = game.renownLevel >= BROKERS_FAVOR_UNLOCK_LEVEL;
  const sellableGoods = [...RESOURCES, ...PRODUCTS].filter(
    (it) => (game.inventory[it] || 0) > 0,
  );
  const favorHeld = favorItem ? game.inventory[favorItem] || 0 : 0;
  const closeFavor = () => {
    setFavorOpen(false);
    setFavorItem(null);
  };
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Coins className="h-5 w-5 text-orders" />
        Trade Manifest
      </h2>
      <OrderFulfillmentPlanner game={game} />
      {game.revealedIntel.length > 0 && (
        <div className="rounded-lg border border-intel/25 bg-intel/[0.06] px-3.5 py-2.5 mb-3.5 text-xs">
          <strong>🗣️ Broker&apos;s Whispers active this round:</strong>{" "}
          {game.revealedIntel.map((i, idx) => (
            <span key={idx}>
              {idx > 0 && ", "}
              <ItemIcon item={i.item} className="h-3.5 w-3.5" /> {i.item} (
              {i.port})
            </span>
          ))}
          <span className="text-muted-foreground">
            {" "}
            (look for the 🔮 badge below).
          </span>
        </div>
      )}
      {!favorUnlocked && (
        <div className="rounded-lg border border-dashed border-favor/25 bg-favor/[0.04] px-3.5 py-2.5 mb-3.5 text-xs text-muted-foreground">
          🔒 <strong className="text-foreground">Broker&apos;s Favor</strong>{" "}
          unlocks at Renown Level {BROKERS_FAVOR_UNLOCK_LEVEL}: call one in once
          per voyage to summon a guaranteed buyer for a good already in your
          hold. You are Renown Level {game.renownLevel} now,{" "}
          {BROKERS_FAVOR_UNLOCK_LEVEL - game.renownLevel} to go.
        </div>
      )}
      {favorUnlocked && !game.brokersFavorUsed && (
        <div className="rounded-lg border border-favor/30 bg-favor/[0.07] px-3.5 py-2.5 mb-3.5 text-xs">
          {!favorOpen ? (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span>
                <strong>🤝 Broker&apos;s Favor</strong> (once per voyage):
                summon a guaranteed buyer for as much of a good as you choose
                from your hold. The bigger the ask, the bigger the Broker&apos;s
                cut.
              </span>
              <Button
                size="sm"
                className="pm-grad-orders font-semibold rounded-lg shrink-0"
                onClick={() => setFavorOpen(true)}
              >
                Call in a Favor
              </Button>
            </div>
          ) : !favorItem ? (
            <div className="space-y-2">
              <div className="font-semibold">🤝 Which good needs a buyer?</div>
              {sellableGoods.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {sellableGoods.map((it) => (
                    <Button
                      key={it}
                      size="sm"
                      variant="secondary"
                      className="rounded-lg"
                      onClick={() => {
                        setFavorItem(it);
                        setFavorQty(game.inventory[it] || 1);
                      }}
                    >
                      <ItemIcon item={it} className="h-3.5 w-3.5" /> {it} (
                      {game.inventory[it]})
                    </Button>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground">
                  Your hold is empty, so there is nothing for the Broker to sell
                  right now.
                </div>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="rounded-lg"
                onClick={closeFavor}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="font-semibold">
                <ItemIcon item={favorItem} className="h-4 w-4" /> How much{" "}
                {favorItem} should the Broker sell?
              </div>
              <div className="flex items-center gap-2">
                <QuantityInput
                  value={favorQty}
                  onCommit={setFavorQty}
                  min={1}
                  max={favorHeld}
                  aria-label={`How much ${favorItem} to sell`}
                  className="w-20 h-9"
                />
                <span className="text-muted-foreground">
                  of {favorHeld} in your hold
                </span>
              </div>
              <p className="text-muted-foreground">
                A bigger ask pays out more, but the Broker&apos;s cut grows with
                it too, so a single favor can never swing the whole voyage.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="pm-grad-orders font-semibold rounded-lg"
                  onClick={() => {
                    act((g, l) => callBrokersFavor(g, favorItem, favorQty, l));
                    closeFavor();
                  }}
                >
                  Call in the Favor
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-lg"
                  onClick={() => setFavorItem(null)}
                >
                  Back
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {game.customerCards.map((o) => {
          const canComplete = o.resources.every(
            (r) => (game.inventory[r.type] || 0) >= r.required!,
          );
          const completed = game.completedOrders.includes(o.id);
          const hasSilk = o.resources.some((r) =>
            ["Silk", "Brocade", "Sachet", "Cotton Clothes"].includes(r.type),
          );
          const transport = calcTransportCost(game, o.totalItems, hasSilk);
          const transportBreakdown = explainTransportCost(
            game,
            o.totalItems,
            hasSilk,
          );
          let netProfit = o.reward - transport;
          let totalVat = 0;
          let vatBreakdown: PriceBreakdown | null = null;
          if (o.isProductOrder) {
            const product = o.resources[0].type;
            vatBreakdown = explainVAT(
              game,
              product,
              o.reward / o.resources[0].required!,
            );
            totalVat = vatBreakdown.final * o.resources[0].required!;
            netProfit -= totalVat;
          }
          const brokerCommission = o.isBrokerFavor
            ? brokersFavorCommission(o.reward)
            : 0;
          const brokerCommissionPct =
            o.reward > 0 ? Math.round((brokerCommission / o.reward) * 100) : 0;
          netProfit -= brokerCommission;
          const matchesIntel = game.revealedIntel.some((i) =>
            o.resources.some((r) => r.type === i.item),
          );
          return (
            <div
              key={o.id}
              className={cn(
                "rounded-xl border overflow-hidden flex flex-col",
                // Harbour gold, filled rather than outlined. The intel
                // "Guaranteed" highlight wears the same hue as a thin outline,
                // so filled versus outlined keeps the two distinguishable
                // without relying on hue alone.
                o.isMandate
                  ? "border-gold/70 bg-gradient-to-br from-gold/[0.18] to-gold/[0.06] ring-1 ring-gold/25"
                  : o.isBrokerFavor
                    ? "border-favor/45 bg-favor/[0.05]"
                    : matchesIntel
                      ? "border-intel/40 bg-intel/[0.04]"
                      : "border-black/10 dark:border-white/10 bg-background/50",
              )}
            >
              <div className="px-3.5 py-2 text-xs font-semibold border-b border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] flex items-center justify-between gap-2">
                <span>
                  📍 {o.demandPort}{" "}
                  <span className="text-muted-foreground">
                    {o.isMandate
                      ? "· Imperial Commission"
                      : o.isProductOrder
                        ? "· Finished Product Demand"
                        : "· Raw Material Demand"}
                  </span>
                </span>
                {o.isMandate ? (
                  <span className="text-orders shrink-0 font-bold">
                    📜 Imperial Mandate
                  </span>
                ) : o.isBrokerFavor ? (
                  <span className="text-favor shrink-0">
                    🤝 Broker&apos;s Favor
                  </span>
                ) : (
                  matchesIntel && (
                    <span className="text-intel shrink-0">🔮 Guaranteed</span>
                  )
                )}
              </div>
              <div className="p-3.5 flex-1 space-y-1.5">
                {o.resources.map((r, i) => {
                  const has = (game.inventory[r.type] || 0) >= r.required!;
                  return (
                    <div key={i} className="flex items-center text-[12px]">
                      <span className="mr-1.5">{has ? "✅" : "❌"}</span>
                      <ItemIcon item={r.type} className="mr-1.5 h-4 w-4" />
                      <Term term={r.type}>
                        <span
                          className="font-medium"
                          style={{ color: resolveColor(r.type) }}
                        >
                          {r.type}
                        </span>
                      </Term>
                      <span className="mx-1.5">×{r.required}</span>
                      <span
                        className="ml-auto text-[10px]"
                        style={{ color: has ? "var(--gain)" : "var(--alarm)" }}
                      >
                        Inv: {game.inventory[r.type] || 0}
                      </span>
                    </div>
                  );
                })}
                <div className="text-[11px] text-due mt-1.5">
                  <Term
                    content={
                      <PriceBreakdownTooltip breakdown={transportBreakdown} />
                    }
                  >
                    ⚓ Freight: {transport} Gold
                  </Term>
                </div>
                <div
                  className={cn(
                    "text-[13px] font-semibold mt-0.5",
                    netProfit >= 0 ? "text-gain" : "text-alarm",
                  )}
                >
                  💰 Reward: {o.reward} Gold 📊 Net: {netProfit} Gold
                  {(() => {
                    const margin =
                      o.reward > 0
                        ? Math.round((netProfit / o.reward) * 100)
                        : 0;
                    return (
                      <span
                        className={cn(
                          "ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold text-background",
                          margin >= 70
                            ? "bg-gain"
                            : margin >= 50
                              ? "bg-warn"
                              : "bg-alarm",
                        )}
                        title={`Profit margin: ${margin}% of reward is net profit after transport, VAT, and commission`}
                      >
                        {margin}%
                      </span>
                    );
                  })()}
                </div>
                {o.isBrokerFavor && (
                  <div className="text-[10px] text-favor">
                    🤝 Broker&apos;s cut ({brokerCommissionPct}%):{" "}
                    {brokerCommission} Gold
                  </div>
                )}
                {o.isProductOrder && vatBreakdown && (
                  <div className="text-[10px] text-muted-foreground">
                    <Term
                      content={
                        <PriceBreakdownTooltip breakdown={vatBreakdown} />
                      }
                    >
                      🧾 Est. VAT: {totalVat} Gold (per unit shown on hover)
                    </Term>
                  </div>
                )}
              </div>
              <div className="p-3 pt-0">
                <Button
                  className={cn(
                    "w-full rounded-lg",
                    canComplete && !completed ? "pm-grad-orders" : "",
                  )}
                  variant={canComplete && !completed ? "default" : "secondary"}
                  disabled={!canComplete || completed}
                  onClick={() => act((g, l) => completeOrder(g, o.id, l))}
                >
                  {completed ? "✅ Completed" : `🤝 Trade (Net ${netProfit}💰)`}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <ReadyFooter
        phaseSync={phaseSync}
        members={members}
        idleLabel="✅ Complete Trades, Continue"
        onConfirm={() => phaseSync.markReady((g, l) => completePhase2(g, l))}
      />
    </div>
  );
}

/**
 * Order Fulfillment Planner. A summary panel at the top of the Orders
 * phase that gives a captain a quick read on which orders are ready to
 * fill right now, which are close (missing 1 or 2 goods), and what the
 * total potential net profit is if every completable order is filled.
 *
 * Does not modify the game state. Pure read only analysis.
 */
function OrderFulfillmentPlanner({ game }: { game: GameState }) {
  type Plan = {
    id: number;
    ready: boolean;
    missingGoods: { item: string; have: number; need: number }[];
    netProfit: number;
    reward: number;
  };

  const plans: Plan[] = game.customerCards
    .filter((o) => !game.completedOrders.includes(o.id))
    .map((o) => {
      const missing: { item: string; have: number; need: number }[] = [];
      for (const r of o.resources) {
        const have = game.inventory[r.type] || 0;
        const need = r.required ?? 0;
        if (have < need) {
          missing.push({ item: r.type, have, need });
        }
      }
      const hasSilk = o.resources.some((r) =>
        ["Silk", "Brocade", "Sachet", "Cotton Clothes"].includes(r.type),
      );
      const transport = calcTransportCost(game, o.totalItems, hasSilk);
      let net = o.reward - transport;
      if (o.isProductOrder) {
        const product = o.resources[0].type;
        const vat = explainVAT(
          game,
          product,
          o.reward / o.resources[0].required!,
        );
        net -= vat.final * o.resources[0].required!;
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

  const readyCount = plans.filter((p) => p.ready).length;
  const closeCount = plans.filter(
    (p) => !p.ready && p.missingGoods.length <= 2,
  ).length;
  const totalPotential = plans
    .filter((p) => p.ready)
    .reduce((sum, p) => sum + p.netProfit, 0);

  if (plans.length === 0) return null;

  return (
    <div className="rounded-xl border border-planner/15 bg-planner/[0.03] px-3.5 py-2.5 mb-3.5">
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
      {plans.filter((p) => !p.ready && p.missingGoods.length <= 2).length >
        0 && (
        <div className="mt-2 border-t border-planner/10 pt-2 space-y-1">
          {plans
            .filter((p) => !p.ready && p.missingGoods.length <= 2)
            .map((p) => (
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
    </div>
  );
}
