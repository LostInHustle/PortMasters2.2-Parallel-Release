"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { itemColorResolver } from "@/lib/use-color-preference";
import { Anchor } from "lucide-react";
import { ICONS } from "@/lib/game/constants/brand";
import { refitsOn } from "@/lib/game/engine";
import { FoldRow } from "../FoldRow";
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
  const [readingsOpen, setReadingsOpen] = useState(false);
  const [benchOpen, setBenchOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <PanelTitle>
          <Anchor className="h-5 w-5 text-market" />
          Port Board
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
      {/* The offer leads, because it is the screen: each card answers for
          itself (it prices its own goods, marks what is a deal and what is
          dear, and says whether this captain can afford it), so it does
          not need to be introduced by the panels that read it. Sitting
          under every reading of it would put the six cards a captain came
          here to buy two and a half screens down a column that scrolls,
          behind the price table, the deal ranks, the depth strip, the
          larder and the bench. Those panels follow it as the second pass:
          what this is worth against the usual price, which of the six is
          the best of them, and how many cards are carrying each good. */}
      <PurchaseBoard game={game} act={act} colorFor={resolveColor} />
      {/* The four readings of the board, folded to one row until asked
          for. They are the second pass rather than the screen: what this
          is worth against the usual price, which of the six is the best
          of them, and how many cards are carrying each good. Open they
          were four strips of chips in front of the cards, which read as
          four screens of small print to a captain who came here to buy;
          a captain pricing a lot opens the row, a captain buying does
          not. Opened, they wrap into a row rather than stacking: each
          one is a strip of chips, and they take the width the stage has
          and share it between as many as fit at a readable width. */}
      <FoldRow
        tone="intel"
        icon="📊"
        title="Market Readings"
        gist="What the board is worth: usual prices, the best of the six, and how deep each good runs."
        open={readingsOpen}
        onToggle={() => setReadingsOpen((v) => !v)}
        className="mb-4"
      >
        <div className="flex flex-wrap items-stretch gap-x-3 [&>*]:grow [&>*]:basis-[320px]">
          <MarketPriceReference game={game} colorFor={resolveColor} />
          <TradeAdvisor game={game} colorFor={resolveColor} />
          <MarketPulse game={game} />
          <MarketDepth game={game} colorFor={resolveColor} />
        </div>
      </FoldRow>
      <Provisions game={game} act={act} />
      {/* [D4: Loom: the Refit] The bench folds, because it is a desk a
          captain visits rather than the screen they buy on: the board and
          the larder lead, and a Loom captain or a captain shopping for a
          mend opens one row. It draws itself out of the tree wherever the
          refit switch is off, so this line costs a build without the
          bench nothing. */}
      {refitsOn(game.mode) && (
        <FoldRow
          tone="refit"
          icon={ICONS.Rags}
          title="Refit Bench"
          gist="A Loom captain's work: a garment put right in one leg, at a fee the two of you agree."
          open={benchOpen}
          onToggle={() => setBenchOpen((v) => !v)}
          className="mb-3.5"
        >
          <RefitBench
            game={game}
            act={act}
            refit={refit}
            me={me}
            members={members}
          />
        </FoldRow>
      )}
      <div className="mt-5 text-center">
        <Button className="rounded-xl px-6" onClick={onContinue}>
          ✅ Board Done, to the Artisan Bench
        </Button>
      </div>
    </div>
  );
}
