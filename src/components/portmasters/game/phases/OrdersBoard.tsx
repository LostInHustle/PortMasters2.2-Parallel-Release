"use client";

import { Button } from "@/components/ui/button";
import {
  canFillOrder,
  cargoUnitsWithAllTags,
  cargoUnitsWithTag,
  completeOrder,
  explainTransportCost,
  fleetOfTreasuresUnits,
  lockedBehind,
  opportunistBorrowsLeft,
  opportunistIsBorrower,
  opportunistLine,
  opportunistMayBorrow,
  opportunistUsesLine,
  pathOrderOf,
  quoteOrder,
  OPPORTUNIST_SPENT_LINE,
} from "@/lib/game/engine";
import { t } from "@/lib/game/i18n";
import { pathConfig, pathLockLine } from "@/lib/game/paths";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { Term } from "../../Term";
import { ItemIcon, signInk } from "../../shared";
import { PriceBreakdownTooltip } from "../PriceTooltips";
import {
  TradeCard,
  type MarketBoardProps,
  type PhasePanelProps,
} from "./PhaseShared";

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
  // The three pathbound cards. `path` is the path that posted this
  // card, and it is null for an ordinary order; `locked` is the path
  // this card waits on for this captain, and it is null wherever the
  // card is theirs to fill, which is every ordinary card and every
  // marked card whose path they hold. Both are the engine's own readings
  // (pathOrderOf and lockedBehind), so a card grayed here is a card the
  // engine refuses there: the board and the guard cannot come apart.
  const path = pathConfig(pathOrderOf(o, game.mode));
  const locked = lockedBehind(game, o);
  const canComplete = canFillOrder(game, o);
  const completed = game.completedOrders.includes(o.id);
  // The one card on this board whose price this captain can move.
  // `mayBorrow` is the ability question, asked of the engine rather than
  // answered here (the path holds it, or the Factor does, and a borrow
  // is left), and everything the card quotes is priced off the payout
  // the borrow would actually pay. completeOrder runs the same
  // arithmetic on the same reduced number, so the net figure on the card
  // and the Gold that lands in the purse are one number; a card that
  // showed the face value would be advertising a sum the engine never
  // hands over. A captain with nothing to spend reads the card exactly
  // as everyone else at the table does.
  const mayBorrow = locked !== null && opportunistMayBorrow(game, locked);
  const canBorrow = canFillOrder(game, o, true);
  // The spent line is asked of the door reader rather than of a path, so
  // a Quartermaster whose Factor is spent reads the same sentence a spent
  // Free Captain reads. One reader for the board and the guard, the same
  // reading kept through the second door.
  const borrowSpent =
    opportunistIsBorrower(game) && opportunistBorrowsLeft(game) < 1;
  // The woven units, not a yes or no: the freight rungs take the woven
  // lines' share of the bill, so the tooltip and the fill need the same
  // count (see cargoUnitsWithTag).
  const wovenUnits = cargoUnitsWithTag(o.resources, "woven");
  // The Fleet of Treasures units, counted through the engine's own reader
  // (see fleetOfTreasuresUnits), and handed to the freight read the
  // tooltip shows, so the freight line on this card and the Gold the fill
  // takes are one number. The module's discount used to be subtracted
  // inside completeOrder alone, which is how this line came to quote the
  // pre discount freight on every card that carried it.
  const fleetUnits = fleetOfTreasuresUnits(game, o.resources);
  const transportBreakdown = explainTransportCost(
    game,
    o.totalItems,
    wovenUnits,
    fleetUnits,
    cargoUnitsWithAllTags(o.resources, "woven", "luxury"),
  );
  // What this order pays, read through the engine's own quote (see
  // quoteOrder), so the reward on this card is the reward the fill
  // credits and the net is the net the fill banks. The card used to
  // quote the face value, which puts the VAT back and leaves the
  // Broker's cut out, so a captain read one number here and was paid
  // another at the fill. A borrowed card is quoted off the payout the
  // borrow would pay, which is the number the fill's own quote starts
  // from.
  const quote = quoteOrder(game, o, { borrowed: mayBorrow });
  const netProfit = quote.net;
  // A locked card is asked first, because the lock is the
  // strongest thing a card can say: a card nobody may fill is
  // not a card to style as a prize. Dashed and muted is how this
  // board renders a thing that is visible but not pressable (the
  // same dress the Broker's Favor panel wears while it is shut),
  // and the card keeps its goods and its reward readable, since
  // the whole point of posting it is to show a captain what
  // holding the path would open.
  const tone = locked
    ? "border-dashed border-black/25 dark:border-white/25 bg-background/40 opacity-75"
    : // Harbor gold, filled rather than outlined. The intel
      // "Guaranteed" highlight wears the same hue as a thin outline,
      // so filled versus outlined keeps the two distinguishable
      // without relying on hue alone.
      o.isMandate
      ? "border-gold/70 bg-gradient-to-br from-gold/[0.18] to-gold/[0.06] ring-1 ring-gold/25"
      : o.isBrokerFavor
        ? "border-favor/45 bg-favor/[0.05]"
        : o.isGuaranteed
          ? "border-intel/40 bg-intel/[0.04]"
          : "border-black/10 dark:border-white/10 bg-background/50";
  return (
    <TradeCard
      tone={tone}
      headerClassName="gap-2"
      header={
        <>
          <span>
            {/* The port is a content name and reads at the print; the
                three demand labels are the card's own. */}
            📍 {t(o.demandPort)}{" "}
            <span className="text-muted-foreground">
              {o.isMandate
                ? t("· Imperial Commission")
                : o.isProductOrder
                  ? t("· Finished Product Demand")
                  : t("· Raw Material Demand")}
            </span>
          </span>
          {path ? (
            // The chip a pathbound card wears: the crest and the
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
              {path.crest}{" "}
              {t("{path.name} order", { "path.name": t(path.name) })}
            </span>
          ) : o.isMandate ? (
            <span className="text-orders shrink-0 font-bold">
              {t("📜 Imperial Mandate")}
            </span>
          ) : o.isBrokerFavor ? (
            <span className="text-favor shrink-0">
              {t("🤝 Broker's Favor")}
            </span>
          ) : (
            o.isGuaranteed && (
              <span className="text-intel shrink-0">{t("🔮 Guaranteed")}</span>
            )
          )}
        </>
      }
      footer={
        locked ? (
          // The lock line stands where the button stands, because
          // that is where a captain's eye already goes on every card
          // on this board. Deliberately not a disabled button: a
          // button that can never be pressed promises an action the
          // card does not have, and what a grayed card owes its
          // reader is a sentence about why rather than a gray shape.
          // The string is pathLockLine's, the same one the ledger
          // prints when a fill is refused.
          <div className="space-y-1.5">
            <div className="rounded-lg border border-dashed border-black/25 dark:border-white/25 px-3 py-2 text-[11px] text-muted-foreground leading-snug">
              🔒 {pathLockLine(locked)}
            </div>
            {completed || mayBorrow ? (
              // The Free Captain's reach, drawn under the lock it
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
                  {/* The sentence carries the credited reward, the same
                      number the Reward line below prints and the fill
                      banks (see quoteOrder), not the pre tax basis the
                      penalty was taken from. The two diverged whenever a
                      VAT or a bonus touched the order, and a captain
                      reading "60 instead of 100" beside "Reward: 66"
                      was reading two accounts of one fill. */}
                  {opportunistLine(game, o.reward, quote.reward)}
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
                  {completed ? t("✅ Completed") : t("🎭 Borrow this order")}
                </Button>
                <div className="text-[10px] text-muted-foreground">
                  {opportunistUsesLine(game)}
                </div>
              </>
            ) : borrowSpent ? (
              <div className="text-[11px] text-muted-foreground leading-snug">
                {/* The spent line is the engine's constant, so the read
                    happens where it is printed. */}
                {t(OPPORTUNIST_SPENT_LINE)}
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
            {completed
              ? t("✅ Completed")
              : t("🤝 Trade (Net {netProfit}💰)", { netProfit })}
          </Button>
        )
      }
    >
      {o.resources.map((r, i) => {
        // The engine's own reading of a missing count (canFillOrder takes
        // `?? 0`): a line with no count is a line needing nothing, so the
        // tick agrees with the button the engine arms. The non null
        // assertion this replaces read a doctored line as an impossible
        // one, graying a card the fill would have accepted.
        const has = (game.inventory[r.type] || 0) >= (r.required ?? 0);
        return (
          <div key={i} className="flex items-center text-[12px]">
            <span className="mr-1.5">{has ? "✅" : "❌"}</span>
            <ItemIcon item={r.type} className="mr-1.5 h-4 w-4" />
            <Term term={r.type}>
              {/* The good's name is data (the Term keeps the English as
                  its lookup key) and reads at the print. */}
              <span className="font-medium" style={{ color: colorFor(r.type) }}>
                {t(r.type)}
              </span>
            </Term>
            <span className="mx-1.5">×{r.required ?? 0}</span>
            <span
              className="ml-auto text-[10px]"
              style={{ color: has ? "var(--gain)" : "var(--alarm)" }}
            >
              {t("Inv: {count}", { count: game.inventory[r.type] || 0 })}
            </span>
          </div>
        );
      })}
      <div className="text-[11px] text-due mt-1.5">
        <Term
          content={<PriceBreakdownTooltip breakdown={transportBreakdown} />}
        >
          {t("⚓ Freight: {gold} Gold", { gold: quote.freight })}
        </Term>
      </div>
      <div
        className={cn("text-[13px] font-semibold mt-0.5", signInk(netProfit))}
      >
        {t("💰 Reward: {reward} Gold 📊 Net: {net} Gold", {
          reward: quote.reward,
          net: netProfit,
        })}
        {(() => {
          // The margin is the share of the reward that survives the run,
          // and the reward here is the one the harbor pays, so the two
          // figures on this line divide into it.
          const margin =
            quote.reward > 0 ? Math.round((netProfit / quote.reward) * 100) : 0;
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
              title={t(
                "Profit margin: {margin}% of reward is net profit after freight, VAT, and commission",
                { margin },
              )}
            >
              {margin}%
            </span>
          );
        })()}
      </div>
      {o.isBrokerFavor && (
        <div className="text-[10px] text-favor">
          <Term term="Commission">
            {t("🤝 Broker's cut ({pct}%): {gold} Gold", {
              pct: quote.commissionPct,
              gold: quote.commission,
            })}
          </Term>
        </div>
      )}
      {quote.vatBreakdown && (
        <div className="text-[10px] text-muted-foreground">
          <Term
            content={<PriceBreakdownTooltip breakdown={quote.vatBreakdown} />}
          >
            {t("🧾 Est. VAT: {totalVat} Gold (per unit shown on hover)", {
              totalVat: quote.vat,
            })}
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
          {path.crest} {t(path.signature)}
        </div>
      )}
    </TradeCard>
  );
}

/**
 * The manifest itself: every order the harbor is posting this round, in
 * the grid the trade manifest reads them in. It owns no state; each card
 * answers the engine's own questions about itself.
 *
 * The columns are the stage's rather than the window's, for the reason the
 * port board's are: a board drawn in the harbor's middle column that reads a
 * window breakpoint deals for a width it does not have. See the note on
 * PurchaseBoard, which deals the same ladder off the same container.
 */
export function OrdersBoard({ game, act, colorFor }: MarketBoardProps) {
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
