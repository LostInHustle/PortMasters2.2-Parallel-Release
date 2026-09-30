"use client";

import { Button } from "@/components/ui/button";
import { SILK_GOODS } from "@/lib/game/constants/goods";
import {
  brokersFavorCommission,
  calcTransportCost,
  canFillOrder,
  completeOrder,
  explainTransportCost,
  explainVAT,
  lockedBehind,
  opportunistBorrowsLeft,
  opportunistLine,
  opportunistMayBorrow,
  opportunistPayout,
  opportunistUsesLine,
  pathOrderOf,
  OPPORTUNIST_PATH,
  OPPORTUNIST_SPENT_LINE,
  type PriceBreakdown,
} from "@/lib/game/engine";
import { pathConfig, pathLockLine } from "@/lib/game/paths";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { Term } from "../../Term";
import { ItemIcon } from "../../shared";
import { PriceBreakdownTooltip } from "../PriceTooltips";
import { TradeCard, type PhasePanelProps } from "./PhaseShared";

type CustomerCard = GameState["customerCards"][number];

/**
 * One order on the manifest: the port that wants it, the goods it wants,
 * what the run nets after freight, VAT and the Broker's cut, and the one
 * button that fills it. A card waiting on a path this captain does not
 * hold says so in place of that button instead.
 */
function OrderCard({
  game,
  act,
  colorFor,
  card: o,
}: {
  game: GameState;
  act: PhasePanelProps["act"];
  colorFor: (item: string) => string | undefined;
  card: CustomerCard;
}) {
  // [D2: the nine slot order board] The three pathbound cards. `path`
  // is the path that posted this card, and it is null for an ordinary
  // order; `locked` is the path this card waits on for this captain,
  // and it is null wherever the card is theirs to fill, which is every
  // ordinary card and every marked card whose path they hold. Both are
  // the engine's own readings (pathOrderOf and lockedBehind), so a
  // card greyed here is a card the engine refuses there: the board and
  // the guard cannot come apart.
  const path = pathConfig(pathOrderOf(o, game.mode));
  const locked = lockedBehind(game, o);
  const canComplete = canFillOrder(game, o);
  const completed = game.completedOrders.includes(o.id);
  // [D6: Free Captain: Opportunist] The one card on this board whose
  // price this captain can move. `mayBorrow` is the ability question,
  // asked of the engine rather than answered here (the path holds it
  // and a borrow is left), and everything the card quotes is priced
  // off the payout the borrow would actually pay. completeOrder runs
  // the same arithmetic on the same reduced number, so the net figure
  // on the card and the Gold that lands in the purse are one number;
  // a card that showed the face value would be advertising a sum the
  // engine never hands over. A captain with nothing to spend reads
  // the card exactly as everyone else at the table does.
  const mayBorrow = locked !== null && opportunistMayBorrow(game, locked);
  const borrowPayout = opportunistPayout(o.reward);
  const rewardBasis = mayBorrow ? borrowPayout : o.reward;
  const canBorrow = canFillOrder(game, o, true);
  const borrowSpent =
    game.path === OPPORTUNIST_PATH && opportunistBorrowsLeft(game) < 1;
  const hasSilk = o.resources.some((r) => SILK_GOODS.includes(r.type));
  const transport = calcTransportCost(game, o.totalItems, hasSilk);
  const transportBreakdown = explainTransportCost(game, o.totalItems, hasSilk);
  let netProfit = rewardBasis - transport;
  let totalVat = 0;
  let vatBreakdown: PriceBreakdown | null = null;
  if (o.isProductOrder) {
    const product = o.resources[0].type;
    vatBreakdown = explainVAT(
      game,
      product,
      rewardBasis / o.resources[0].required!,
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
  // [D2] A locked card is asked first, because the lock is the
  // strongest thing a card can say: a card nobody may fill is
  // not a card to style as a prize. Dashed and muted is how this
  // board renders a thing that is visible but not pressable (the
  // same dress the Broker's Favor panel wears while it is shut),
  // and the card keeps its goods and its reward readable, since
  // the whole point of posting it is to show a captain what
  // holding the path would open.
  const tone = locked
    ? "border-dashed border-black/25 dark:border-white/25 bg-background/40 opacity-75"
    : // Harbour gold, filled rather than outlined. The intel
      // "Guaranteed" highlight wears the same hue as a thin outline,
      // so filled versus outlined keeps the two distinguishable
      // without relying on hue alone.
      o.isMandate
      ? "border-gold/70 bg-gradient-to-br from-gold/[0.18] to-gold/[0.06] ring-1 ring-gold/25"
      : o.isBrokerFavor
        ? "border-favor/45 bg-favor/[0.05]"
        : matchesIntel
          ? "border-intel/40 bg-intel/[0.04]"
          : "border-black/10 dark:border-white/10 bg-background/50";
  return (
    <TradeCard
      tone={tone}
      headerClassName="gap-2"
      header={
        <>
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
          {path ? (
            // [D2] The chip a pathbound card wears: the crest and the
            // name, both read off the path record rather than written
            // onto the card, so a path renamed in ./paths renames here.
            // Muted where the card is locked, which keeps the two ends
            // of the card saying the same thing.
            <span
              className={cn(
                "shrink-0",
                locked ? "text-muted-foreground" : "text-orders",
              )}
            >
              {path.crest} {path.name} order
            </span>
          ) : o.isMandate ? (
            <span className="text-orders shrink-0 font-bold">
              📜 Imperial Mandate
            </span>
          ) : o.isBrokerFavor ? (
            <span className="text-favor shrink-0">🤝 Broker&apos;s Favor</span>
          ) : (
            matchesIntel && (
              <span className="text-intel shrink-0">🔮 Guaranteed</span>
            )
          )}
        </>
      }
      footer={
        locked ? (
          // [D2] The lock line stands where the button stands, because
          // that is where a captain's eye already goes on every card
          // on this board. Deliberately not a disabled button: a
          // button that can never be pressed promises an action the
          // card does not have, and what a greyed card owes its
          // reader is a sentence about why rather than a grey shape.
          // The string is pathLockLine's, the same one the ledger
          // prints when a fill is refused.
          <div className="space-y-1.5">
            <div className="rounded-lg border border-dashed border-black/25 dark:border-white/25 px-3 py-2 text-[11px] text-muted-foreground leading-snug">
              🔒 {pathLockLine(locked)}
            </div>
            {completed || mayBorrow ? (
              // [D6] The Free Captain's reach, drawn under the lock it
              // reaches through. The lock line stays above it because
              // the lock is still the truth about every other captain;
              // what this captain gets is a price, and the price is
              // stated twice on the card, once in the sentence and
              // once in the card's own arithmetic above, which is
              // already reading the reduced payout. The sentences
              // themselves are the module's, so the board and the
              // ledger describe one transaction in one voice, and the
              // count of what is left is printed before the press
              // rather than after it: a one shot ability a captain
              // discovers they had used is a rule taught by surprise.
              <>
                <div className="text-[11px] text-orders leading-snug">
                  {opportunistLine(o.reward, borrowPayout)}
                </div>
                <Button
                  className={cn(
                    "w-full rounded-lg",
                    canBorrow && !completed ? "pm-grad-orders" : "",
                  )}
                  variant={canBorrow && !completed ? "default" : "secondary"}
                  disabled={!canBorrow || completed}
                  onClick={() => act((g, l) => completeOrder(g, o.id, l, true))}
                >
                  {completed ? "✅ Completed" : "🎭 Borrow this order"}
                </Button>
                <div className="text-[10px] text-muted-foreground">
                  {opportunistUsesLine(game)}
                </div>
              </>
            ) : borrowSpent ? (
              <div className="text-[11px] text-muted-foreground leading-snug">
                {OPPORTUNIST_SPENT_LINE}
              </div>
            ) : null}
          </div>
        ) : (
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
        )
      }
    >
      {o.resources.map((r, i) => {
        const has = (game.inventory[r.type] || 0) >= r.required!;
        return (
          <div key={i} className="flex items-center text-[12px]">
            <span className="mr-1.5">{has ? "✅" : "❌"}</span>
            <ItemIcon item={r.type} className="mr-1.5 h-4 w-4" />
            <Term term={r.type}>
              <span className="font-medium" style={{ color: colorFor(r.type) }}>
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
          content={<PriceBreakdownTooltip breakdown={transportBreakdown} />}
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
        💰 Reward: {rewardBasis} Gold 📊 Net: {netProfit} Gold
        {(() => {
          const margin =
            rewardBasis > 0 ? Math.round((netProfit / rewardBasis) * 100) : 0;
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
          🤝 Broker&apos;s cut ({brokerCommissionPct}%): {brokerCommission} Gold
        </div>
      )}
      {o.isProductOrder && vatBreakdown && (
        <div className="text-[10px] text-muted-foreground">
          <Term content={<PriceBreakdownTooltip breakdown={vatBreakdown} />}>
            🧾 Est. VAT: {totalVat} Gold (per unit shown on hover)
          </Term>
        </div>
      )}
      {path && (
        // What the path is, in the record's own words. Printed on
        // the cards that wait on a path so the board explains the
        // path rather than only naming it, and printed on the open
        // ones too, so a captain holding a path sees the same card
        // their tablemates see with the lock taken off.
        <div className="text-[11px] text-muted-foreground leading-snug mt-2 pt-1.5 border-t border-black/5 dark:border-white/10">
          {path.crest} {path.signature}
        </div>
      )}
    </TradeCard>
  );
}

/**
 * The manifest itself: every order the harbour is posting this round, in
 * the grid the trade manifest reads them in. It owns no state; each card
 * answers the engine's own questions about itself.
 *
 * The columns are the stage's rather than the window's, for the reason the
 * port board's are: a board drawn in the room's middle column that reads a
 * window breakpoint deals for a width it does not have. See the note on
 * PurchaseBoard, which deals the same ladder off the same container.
 */
export function OrdersBoard({
  game,
  act,
  colorFor,
}: Pick<PhasePanelProps, "game" | "act"> & {
  colorFor: (item: string) => string | undefined;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
      {game.customerCards.map((o) => (
        <OrderCard
          key={o.id}
          game={game}
          act={act}
          colorFor={colorFor}
          card={o}
        />
      ))}
    </div>
  );
}
