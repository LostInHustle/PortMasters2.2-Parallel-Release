"use client";

import { leavePhase } from "@/lib/game/engine";
import { itemColorResolver } from "@/lib/use-color-preference";
import { Coins } from "lucide-react";
import {
  ReadyFooter,
  IntelBanner,
  PanelTitle,
  type PhasePanelProps,
} from "./PhaseShared";
import { OrderFulfillmentPlanner } from "./OrderPlanner";
import { BrokerFavor } from "./OrdersFavor";
import { OrdersBoard } from "./OrdersBoard";

export function Orders({
  game,
  ctx,
  act,
  phaseSync,
  members,
  colorFor,
}: Pick<
  PhasePanelProps,
  "game" | "ctx" | "act" | "phaseSync" | "members" | "colorFor"
>) {
  const resolveColor = itemColorResolver(colorFor);
  return (
    <div>
      <PanelTitle className="mb-4">
        <Coins className="h-5 w-5 text-orders" />
        Trade Manifest
      </PanelTitle>
      <OrderFulfillmentPlanner game={game} />
      <IntelBanner
        game={game}
        tone="intel"
        note="(look for the 🔮 badge below)."
      />
      <BrokerFavor game={game} act={act} />
      <OrdersBoard game={game} act={act} colorFor={resolveColor} />
      <ReadyFooter
        phaseSync={phaseSync}
        members={members}
        idleLabel="✅ Complete Trades, Continue"
        onConfirm={() => phaseSync.markReady((g, l) => leavePhase(g, ctx, l))}
      />
    </div>
  );
}
