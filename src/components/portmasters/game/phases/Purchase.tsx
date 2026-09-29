"use client";

import { Button } from "@/components/ui/button";
import { itemColorResolver } from "@/lib/use-color-preference";
import { Anchor } from "lucide-react";
import { RefitBench } from "../RefitBench";
import { IntelBanner, PanelTitle, type PhasePanelProps } from "./PhaseShared";
import { MarketPriceReference } from "./PurchasePriceReference";
import { MarketDepth, MarketPulse, TradeAdvisor } from "./PurchaseInsights";
import { Provisions } from "./PurchaseProvisions";
import { PurchaseBoard } from "./PurchaseBoard";

export function Purchase({
  game,
  act,
  colorFor,
  refit,
  me,
  members,
  onRumorBoardOpen,
  onContinue,
}: Pick<
  PhasePanelProps,
  "game" | "act" | "colorFor" | "refit" | "me" | "members" | "onRumorBoardOpen"
> & {
  /**
   * Walks to the artisan bench, the second station of this phase. Handed in
   * by the Market container rather than named here: which station follows
   * this board is the phase's business, and this board has no ready vote of
   * its own to spend on it. A captain is not done with Market when they are
   * done with the board. It also means the harbor is never waited on from
   * here. The member list is the bench's, which names the captains a
   * private offer may be made to, and not a ready vote's.
   */
  onContinue: () => void;
}) {
  const resolveColor = itemColorResolver(colorFor);
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <PanelTitle>
          <Anchor className="h-5 w-5 text-market" />
          Port Merchant Exchange
        </PanelTitle>
        <Button
          variant="secondary"
          size="sm"
          className="rounded-lg"
          onClick={onRumorBoardOpen}
        >
          🔮 Broker's Rumor Board
        </Button>
      </div>
      <IntelBanner
        game={game}
        tone="warn"
        note="(a matching order is guaranteed at Orders, buy accordingly)."
      />
      {/* The sub panels no longer share one shell. The price reference,
          the trade advisor, the pulse and the depth each wear the hue of
          their own widget, so a captain can tell at a glance which one is
          speaking. */}
      <MarketPriceReference game={game} colorFor={resolveColor} />
      <TradeAdvisor game={game} colorFor={resolveColor} />
      <MarketPulse game={game} />
      <MarketDepth game={game} colorFor={resolveColor} />
      <Provisions game={game} act={act} />
      {/* [D4: Loom: the Refit] The bench stands on the port board at the foot
          of the merchant's own panels, because a captain reads what the
          harbor is selling before they read what a neighbour is. It draws
          itself out of the tree wherever the refit switch is off, so this
          line costs a build without the bench nothing. */}
      <RefitBench
        game={game}
        act={act}
        refit={refit}
        me={me}
        members={members}
      />
      <PurchaseBoard game={game} act={act} colorFor={resolveColor} />
      <div className="mt-5 text-center">
        <Button className="rounded-xl px-6" onClick={onContinue}>
          ✅ Board Done, to the Artisan Bench
        </Button>
      </div>
    </div>
  );
}
