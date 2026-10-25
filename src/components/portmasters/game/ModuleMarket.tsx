"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { PrivateOffer } from "@/components/portmasters/game/PrivateOffer";
import type { PublicUser } from "@/lib/api";
import { cardById, cardName, cardText } from "@/lib/game/cards";
import { HELD_POWER_CAP } from "@/lib/game/constants/cards";
import { STALE_OFFER, feeShortfallLine } from "@/lib/game/constants/copy";
import { MAX_SHIP_LEVEL } from "@/lib/game/constants/ships";
import { CONSENT_FEE_MIN } from "@/lib/game/constants/paths";
import {
  canPayFee,
  canSellModule,
  getOwnedAmount,
  moduleListedThisRound,
  moduleSlotsOpen,
  type ModuleTrade,
} from "@/lib/game/engine";
import { moduleTradesOn } from "@/lib/game/flags";
import { t } from "@/lib/game/i18n";
import { powerAfterTaking, powerBudgetAllows } from "@/lib/game/held-cards";
import type { GameState } from "@/lib/game/types";
import { RefusalLine } from "../shared";
import { MarketBlock, MarketEmpty, MarketPanel, OfferRow } from "./OfferBoard";
import type { ModuleTrades } from "./phases/PhaseShared";

// The fallback crest for a row whose module the pool cannot resolve, which
// is a row written by a build that knew a card this one does not. The post
// refuses such a row and both ends run the same pool, so this is the same
// unreachable corner applyModuleTradeSide writes its own honest branch for
// (see @/lib/game/engine/modules).
const UNKNOWN_MODULE_ICON = "🔧";

/**
 * * The module market, drawn at the Parley table beside the exchange and the
 * protection market because that is where the design puts it: a module bolted
 * to a captain's hull, sold to another captain at a price the two of them
 * agree, which gives the build layer its own liquidity and gives the table
 * a class of deal that is not about commodities.
 *
 * Everything a captain can do here is a socket frame and nothing else. The
 * Gold moves and the module changes hulls on the two clients that agreed to
 * it, through applyModuleTradeSide, and the board this panel draws is the
 * server's own view of who has listed what: a panel that decided any of
 * this by itself would be a second market the harbor could not see.
 *
 * The trade's own rule is the design's, and it is the seller's side of a
 * settle: a module traded away comes off the hull automatically rather than
 * being blocked (see the engine module's header). What this panel adds to
 * that is the buyer's side of the same thought, said before the click
 * rather than after it: a hull with every slot full reads its accept as
 * blocked, because a purchase settles onto the hull it was bought for and
 * a captain should not learn that from a corner the board has to argue its
 * way out of. Two more readings of the same kind stand beside it, the power
 * budget and the buyer's own purse, each stated on the row it blocks.
 * Unlike the two markets beside it, no seller's path gates the
 * form: a module is a thing bolted on, not an ability, so any captain with
 * one to spare may list it.
 *
 * An offer belongs to the round it was posted in, so a board that lags a
 * checkpoint shows the stale refusal before a click instead of after one.
 */
export function ModuleMarket({
  game,
  modules,
  me,
  members,
}: {
  game: GameState;
  modules: ModuleTrades;
  me: PublicUser;
  members: PublicUser[];
}) {
  // The drafts are held above the switch check so this component's hooks
  // never depend on the build it is in, the same shape the two markets
  // beside it take: a panel that returned before its own state would be a
  // component whose hook order is conditional on a constant.
  const [fee, setFee] = useState(CONSENT_FEE_MIN);
  const [moduleId, setModuleId] = useState("");
  const [targetId, setTargetId] = useState("");

  if (!moduleTradesOn(game.mode)) return null;

  const canSell = canSellModule(game);
  const others = members.filter((m) => m.id !== me.id);
  const roomOpen = moduleSlotsOpen(game);
  // What this captain may still list this round: the hull, less anything the
  // board already knows about, which is the kind's own bound read before a
  // click rather than after one (see moduleListedThisRound). A module already
  // standing on a row is not in the menu, so the one rule the form can
  // break is one it cannot break from here.
  const sellable = game.equippedModules.filter(
    (card) =>
      !moduleListedThisRound(
        modules.moduleTrades,
        me.id,
        card.id,
        game.currentRound,
      ),
  );
  // The menu reads the picker's own state against what is still listable,
  // so a module that leaves the list (because it was just listed) falls
  // back to the first that is still there rather than leaving the form
  // pointing at a module it can no longer sell.
  const chosen = sellable.some((card) => card.id === moduleId)
    ? moduleId
    : (sellable[0]?.id ?? "");

  return (
    <MarketPanel
      title={t("{UNKNOWN_MODULE_ICON} Module Market", {
        UNKNOWN_MODULE_ICON,
      })}
      intro={t(
        "A module bolted to a hull, sold at a price the two of you agree. It comes off the seller's hull and onto the buyer's the moment the two of you shake hands, so the buyer needs an open slot, and a hull's ladder tops out at {MAX_SHIP_LEVEL} slots at ship level {MAX_SHIP_LEVEL}. The fee is paid when you shake hands. One listing per module a round, one open listing per captain you name, and an offer nobody takes before the Parley closes is gone.",
        { MAX_SHIP_LEVEL },
      )}
    >
      {/* The listing form belongs to a captain with something to sell. A
          captain with an empty hull reads the board below it and nothing
          else, which is what makes this a market rather than a screen. */}
      {canSell && (
        <MarketBlock>
          {sellable.length === 0 ? (
            <p className="text-center text-[11px] text-muted-foreground">
              {t(
                "Every module on your hull is already on the board this round. The market opens again next round.",
              )}
            </p>
          ) : (
            <>
              <PrivateOffer
                lead={
                  <>
                    <span className="text-muted-foreground">{t("Sell")}</span>
                    <Select
                      value={chosen}
                      onChange={(e) => setModuleId(e.target.value)}
                      aria-label={t("The module this listing sells")}
                    >
                      {sellable.map((card) => (
                        <option key={card.id} value={card.id}>
                          {card.icon} {cardText(card).name}
                        </option>
                      ))}
                    </Select>
                    <span className="text-muted-foreground">{t("for")}</span>
                  </>
                }
                fee={fee}
                onFee={setFee}
                targetId={targetId}
                onTarget={setTargetId}
                others={others}
                audienceLabel={t("Offer this module to a specific captain")}
                deadline={t("before the Parley closes.")}
                action={
                  <Button
                    className="rounded-lg pm-grad-parley"
                    onClick={() =>
                      modules.post(fee, chosen, targetId || undefined)
                    }
                  >
                    {UNKNOWN_MODULE_ICON} {t("Offer the Module")}
                  </Button>
                }
              />
            </>
          )}
        </MarketBlock>
      )}

      <RefusalLine
        className="text-center mb-2"
        error={modules.error}
        onDismiss={modules.clearError}
      />

      {modules.moduleTrades.length === 0 ? (
        <MarketEmpty>
          {canSell
            ? t(
                "Nothing on the market yet. List a module and yours is the first row. A listing comes off the board when the round turns or the Parley closes, so a row you posted earlier may already be gone.",
              )
            : t(
                "No modules listed this Parley. Any captain with a module bolted on can list one, and a listing aimed at one captain waits on that captain.",
              )}
        </MarketEmpty>
      ) : (
        <div className="space-y-1.5">
          {modules.moduleTrades.map((trade) => (
            <ModuleRow
              key={trade.id}
              trade={trade}
              game={game}
              me={me}
              modules={modules}
              round={game.currentRound}
              roomOpen={roomOpen}
            />
          ))}
        </div>
      )}
    </MarketPanel>
  );
}

/**
 * One row of the board, read by its status and by which side of it this
 * captain is on.
 *
 * Two statuses and no third, for the bench's reason: a module trade settles
 * the moment it is agreed, because both halves of it are known at that
 * moment. The escort's claimed state exists because half of that trade,
 * what a raid would have taken, does not exist until Resolve.
 */
function ModuleRow({
  trade,
  game,
  me,
  modules,
  round,
  roomOpen,
}: {
  trade: ModuleTrade;
  game: GameState;
  me: PublicUser;
  modules: ModuleTrades;
  round: number;
  roomOpen: number;
}) {
  const mine = trade.sellerUserId === me.id;
  const isBuyer = trade.buyerUserId === me.id;
  const card = cardById(trade.module);
  const icon = card?.icon ?? UNKNOWN_MODULE_ICON;
  const stale = trade.round !== round;
  // The server's own refusals, shown before the click rather than after it,
  // plus the three this panel adds: a buyer with no open slot cannot bolt the
  // module on, and the board would settle it onto a full hull anyway rather
  // than lose it (see applyModuleTradeSide), so the honest path is told here
  // and the corner stays unreachable from this screen; a buyer whose hull the
  // module would push past the cap cannot take it, which is the budget's one
  // reachable guard on a purchase, since the server has never read a save and
  // the settle has to complete either way (both readings are
  // applyModuleTradeSide's own notes). The total that guard states is the
  // swap arithmetic's shared reader (see powerAfterTaking in
  // @/lib/game/held-cards), so the number on the row is the number the
  // engine's own refusal would print for the same hull. And a buyer whose
  // purse cannot cover the fee cannot take the offer, which is the escort
  // desk's own third refusal read through the predicate the bench reads too
  // (see canPayFee): the fee moves at the handshake on the buyer's
  // machine, and a settle that ran short would pay what the purse holds
  // while the seller is credited the agreed price, which mints the
  // difference rather than settling it. A trade the pool cannot resolve
  // blocks nothing: it is the unreachable corner the crest above stands in
  // for.
  const hold = getOwnedAmount(game, "Gold");
  const blocked = stale
    ? t(STALE_OFFER)
    : roomOpen < 1
      ? t("Every slot on your hull is full. Make room at the yard first.")
      : card !== null && game.equippedModules.some((m) => m.id === trade.module)
        ? // A hull reads a module as present or absent (hasModule), so a
          // second copy adds no effect but would add a slot, power and the
          // per copy surcharge the two costing modules carry. The trade
          // path is the one door that did not ask this question.
          t("That module is already bolted to your hull.")
        : card !== null && !powerBudgetAllows(game, card)
          ? t(
              "Taking it would put your hull at {newPower} power, and a hull carries at most {HELD_POWER_CAP}.",
              { newPower: powerAfterTaking(game, card), HELD_POWER_CAP },
            )
          : !canPayFee(game, trade.fee)
            ? feeShortfallLine(hold, trade.fee)
            : null;

  return (
    <OfferRow
      mine={mine}
      line={`${icon} ${moduleLine(trade, me)}`}
      // The market's own reading of whether this row is still an offer, which
      // is what draws the buttons on it: the aim is not the offer, and a row
      // listed to the whole table is an offer like any other (see OfferRow).
      standing={trade.status === "offered"}
      chip={
        trade.status === "offered" && trade.buyerUserId
          ? { forMe: isBuyer, name: trade.buyerName }
          : null
      }
      acceptLabel={t("{icon} Take It", { icon })}
      acceptClassName="pm-grad-parley"
      blocked={blocked}
      onCancel={() => modules.cancel(trade.id)}
      onAccept={() => modules.accept(trade.id)}
    />
  );
}

/**
 * The row's own sentence, in the second person where the row is this
 * captain's and the seller's name where it belongs to somebody else,
 * written as a function for the reason the two markets' own row lines are:
 * the two statuses read as two sentences about the same agreement, and the
 * one thing they have to agree on is who is speaking about whom.
 *
 * The module is named through the pool rather than off the row, which is
 * the same resolver the voyage log's own two lines read and what keeps a
 * row and a log line saying the same words about the same card.
 *
 * All five lines read through the pack here, which is the composition
 * boundary: the function is called at render and nowhere else, so the
 * language in force is the one the row is drawn in.
 */
function moduleLine(trade: ModuleTrade, me: PublicUser): string {
  const mine = trade.sellerUserId === me.id;
  const isBuyer = trade.buyerUserId === me.id;
  const name = cardName(trade.module);
  const other = trade.buyerName ?? t("a captain");
  const fee = t("{trade.fee} Gold", { "trade.fee": trade.fee });
  if (trade.status === "offered") {
    return mine
      ? t("You are selling {name} for {fee}", { name, fee })
      : t("{sellerName} sells {name} for {fee}", {
          sellerName: trade.sellerName,
          name,
          fee,
        });
  }
  if (mine) {
    return t("You sold {name} to {other} for {fee}", { name, other, fee });
  }
  return isBuyer
    ? t("{sellerName} sold you {name} for {fee}", {
        sellerName: trade.sellerName,
        name,
        fee,
      })
    : t("{sellerName} sold {name} to {other} for {fee}", {
        sellerName: trade.sellerName,
        name,
        other,
        fee,
      });
}
