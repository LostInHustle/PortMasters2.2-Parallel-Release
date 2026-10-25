"use client";

import { leavePhase } from "@/lib/game/engine";
import { t } from "@/lib/game/i18n";
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
        {t("Trade Manifest")}
      </PanelTitle>
      <OrderFulfillmentPlanner game={game} />
      {/* The banner prints the note it is given, so the read happens
          here, where the manifest names its own pointer. It only shows
          on a round with a whisper revealed: the label promises active
          whispers and the note a guaranteed match, and the engine grants
          neither when the list is empty (see the guarantee loop in
          engine/orders). */}
      {game.revealedIntel.length > 0 && (
        <IntelBanner
          game={game}
          tone="intel"
          note={t("(look for the 🔮 badge below).")}
        />
      )}
      <BrokerFavor game={game} act={act} />
      <OrdersBoard game={game} act={act} colorFor={resolveColor} />
      <ReadyFooter
        phaseSync={phaseSync}
        members={members}
        idleLabel={t("✅ Complete Trades, Continue")}
        onConfirm={() => phaseSync.markReady((g, l) => leavePhase(g, ctx, l))}
      />
    </div>
  );
}
