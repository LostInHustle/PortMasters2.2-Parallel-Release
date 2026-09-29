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
      {/* The offer leads, because it is the screen. It used to sit under
          every reading of it, which put the six cards a captain came here
          to buy two and a half screens down a column that scrolls, behind
          the price table, the deal ranks, the depth strip, the larder and
          the bench. Each card answers for itself (it prices its own goods,
          marks what is a deal and what is dear, and says whether this
          captain can afford it), so it does not need to be introduced by
          the panels that read it. What those panels are, now that they
          follow it, is the second pass: what this is worth against the
          usual price, which of the six is the best of them, and how many
          cards are carrying each good. */}
      <PurchaseBoard game={game} act={act} colorFor={resolveColor} />
      {/* The four readings of the board, wrapped into a row rather than
          stacked: each one is a strip of chips, and four stacked strips of
          chips read as four screens of small print in front of the cards.
          They take the width the stage has and share it between as many as
          fit at a readable width, so a wide window draws the price table
          beside the deal ranks and a narrow one keeps them one under the
          other. Each panel keeps the bottom margin the rest of this screen
          spaces itself with, which is what separates two wrapped rows. */}
      <div className="flex flex-wrap items-stretch gap-x-3 [&>*]:grow [&>*]:basis-[320px]">
        <MarketPriceReference game={game} colorFor={resolveColor} />
        <TradeAdvisor game={game} colorFor={resolveColor} />
        <MarketPulse game={game} />
        <MarketDepth game={game} colorFor={resolveColor} />
      </div>
      <Provisions game={game} act={act} />
      {/* [D4: Loom: the Refit] The bench stands at the foot of the merchant's
          own panels, because a captain reads what the harbor is selling
          before they read what a neighbour is. It draws itself out of the
          tree wherever the refit switch is off, so this line costs a build
          without the bench nothing. */}
      <RefitBench
        game={game}
        act={act}
        refit={refit}
        me={me}
        members={members}
      />
      <div className="mt-5 text-center">
        <Button className="rounded-xl px-6" onClick={onContinue}>
          ✅ Board Done, to the Artisan Bench
        </Button>
      </div>
    </div>
  );
}
