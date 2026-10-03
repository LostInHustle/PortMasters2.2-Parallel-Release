"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { PrivateOffer } from "@/components/portmasters/game/PrivateOffer";
import type { PublicUser } from "@/lib/api";
import { cardById, cardName, cardText } from "@/lib/game/cards";
import { CONSENT_FEE_MIN } from "@/lib/game/constants/paths";
import {
  canSellModule,
  moduleListedThisLeg,
  moduleSlotsOpen,
  type ModuleTrade,
} from "@/lib/game/engine";
import { moduleTradesOn } from "@/lib/game/flags";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { JustForChip, PathDeskRow } from "./phases/PhaseShared";
import type { ModuleTrades } from "./phases/PhaseShared";

// The fallback crest for a row whose module the pool cannot resolve, which
// is a row written by a build that knew a card this one does not. The post
// refuses such a row and both ends run the same pool, so this is the same
// unreachable corner applyModuleTradeSide writes its own honest branch for
// (see @/lib/game/engine/modules).
const UNKNOWN_MODULE_ICON = "🔧";

/**
 * [F3: modules in the shipyard ladder, and trading them between captains]
 * The module market, drawn at the Parley table beside the exchange and the
 * protection market because that is where the plan puts it: a module bolted
 * to a captain's hull, sold to another captain at a price the two of them
 * agree, which gives the build layer its own liquidity and gives the table
 * a class of deal that is not about commodities.
 *
 * Everything a captain can do here is a socket frame and nothing else. The
 * Gold moves and the module changes hulls on the two clients that agreed to
 * it, through applyModuleTradeSide, and the board this panel draws is the
 * server's own view of who has listed what: a panel that decided any of
 * this by itself would be a second market the room could not see.
 *
 * The trade's own rule is the plan's, and it is the seller's side of a
 * settle: a module traded away comes off the hull automatically rather than
 * being blocked (see the engine module's header). What this panel adds to
 * that is the buyer's side of the same thought, said before the click
 * rather than after it: a hull with every slot full reads its accept as
 * blocked, because a purchase settles onto the hull it was bought for and
 * a captain should not learn that from a corner the board has to argue its
 * way out of. Unlike the two markets beside it, no seller's path gates the
 * form: a module is a thing bolted on, not an ability, so any captain with
 * one to spare may list it.
 *
 * An offer belongs to the leg it was posted in, so a board that lags a
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
  // What this captain may still list this leg: the hull, less anything the
  // board already knows about, which is the kind's own bound read before a
  // click rather than after one (see moduleListedThisLeg). A module already
  // standing on a row is not in the menu, so the one rule the form can
  // break is one it cannot break from here.
  const sellable = game.equippedModules.filter(
    (card) =>
      !moduleListedThisLeg(
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
    <div className="rounded-xl border border-parley/15 bg-parley/[0.03] p-4 mb-4">
      <h3 className="text-center font-semibold mb-1 text-sm">
        {UNKNOWN_MODULE_ICON} Module Market
      </h3>
      <p className="text-center text-[11px] text-muted-foreground mb-3 max-w-xl mx-auto">
        A module bolted to a hull, sold at a price the two of you agree. It
        comes off the seller&apos;s hull and onto the buyer&apos;s the moment
        the two of you shake hands, so the buyer needs an open slot: three at
        ship level three, four at four and five at five. The fee is paid when
        you shake hands.
      </p>

      {/* The listing form belongs to a captain with something to sell. A
          captain with an empty hull reads the board below it and nothing
          else, which is what makes this a market rather than a screen. */}
      {canSell && (
        <div className="rounded-lg border border-parley/15 bg-background/40 p-3 mb-3">
          {sellable.length === 0 ? (
            <p className="text-center text-[11px] text-muted-foreground">
              Every module on your hull is already on the board this leg. The
              market opens again next leg.
            </p>
          ) : (
            <>
              <PrivateOffer
                lead={
                  <>
                    <span className="text-muted-foreground">Sell</span>
                    <Select
                      value={chosen}
                      onChange={(e) => setModuleId(e.target.value)}
                      aria-label="The module this listing sells"
                    >
                      {sellable.map((card) => (
                        <option key={card.id} value={card.id}>
                          {card.icon} {cardText(card).name}
                        </option>
                      ))}
                    </Select>
                    <span className="text-muted-foreground">for</span>
                  </>
                }
                fee={fee}
                onFee={setFee}
                targetId={targetId}
                onTarget={setTargetId}
                others={others}
                audienceLabel="Offer this module to a specific captain"
                deadline="before the Parley closes."
                action={
                  <Button
                    className="rounded-lg pm-grad-parley"
                    onClick={() =>
                      modules.post(fee, chosen, targetId || undefined)
                    }
                  >
                    {UNKNOWN_MODULE_ICON} Offer the Module
                  </Button>
                }
              />
              <p className="text-center text-[11px] text-muted-foreground mt-1.5">
                One listing per module a leg, one open offer per captain you
                name, and an offer nobody takes before the Parley closes is
                gone.
              </p>
            </>
          )}
        </div>
      )}

      {modules.error && (
        <p className="text-center text-[11px] text-alarm mb-2">
          {modules.error}{" "}
          <button
            type="button"
            onClick={modules.clearError}
            className="underline"
          >
            Dismiss
          </button>
        </p>
      )}

      {modules.moduleTrades.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-3">
          {canSell
            ? "Nothing on the market yet. Your listing is the first."
            : "No modules on offer this Parley."}
        </p>
      ) : (
        <div className="space-y-1.5">
          {modules.moduleTrades.map((trade) => (
            <ModuleRow
              key={trade.id}
              trade={trade}
              me={me}
              modules={modules}
              round={game.currentRound}
              roomOpen={roomOpen}
            />
          ))}
        </div>
      )}
    </div>
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
  me,
  modules,
  round,
  roomOpen,
}: {
  trade: ModuleTrade;
  me: PublicUser;
  modules: ModuleTrades;
  round: number;
  roomOpen: number;
}) {
  const mine = trade.sellerUserId === me.id;
  const isBuyer = trade.buyerUserId === me.id;
  const icon = cardById(trade.module)?.icon ?? UNKNOWN_MODULE_ICON;
  const stale = trade.round !== round;
  // The server's own refusals, shown before the click rather than after it,
  // plus the one this panel adds: a buyer with no open slot cannot bolt the
  // module on, and the board would settle it onto a full hull anyway rather
  // than lose it (see applyModuleTradeSide), so the honest path is told here
  // and the corner stays unreachable from this screen.
  const blocked = stale
    ? "That offer belongs to an earlier leg."
    : roomOpen < 1
      ? "Every slot on your hull is full. Make room at the yard first."
      : null;

  return (
    <PathDeskRow mine={mine}>
      <span className="flex items-center gap-1.5 flex-wrap">
        <span className="font-medium">
          {icon} {moduleLine(trade, me)}
        </span>
        {trade.status === "offered" && trade.buyerUserId && (
          <JustForChip forMe={isBuyer} name={trade.buyerName} />
        )}
      </span>

      {trade.status === "offered" &&
        (mine ? (
          <Button
            size="sm"
            variant="destructive"
            className="h-7 px-2.5 text-[10px] rounded shrink-0"
            onClick={() => modules.cancel(trade.id)}
          >
            Cancel
          </Button>
        ) : (
          <span className="flex flex-col items-end gap-0.5 shrink-0">
            <Button
              size="sm"
              className={cn(
                "h-7 px-2.5 text-[10px] rounded",
                !blocked && "pm-grad-parley",
              )}
              variant={blocked ? "secondary" : "default"}
              disabled={blocked !== null}
              onClick={() => modules.accept(trade.id)}
            >
              {icon} Take It
            </Button>
            {blocked && (
              <span className="text-[9px] text-muted-foreground">
                {blocked}
              </span>
            )}
          </span>
        ))}
    </PathDeskRow>
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
 */
function moduleLine(trade: ModuleTrade, me: PublicUser): string {
  const mine = trade.sellerUserId === me.id;
  const isBuyer = trade.buyerUserId === me.id;
  const name = cardName(trade.module);
  const other = trade.buyerName ?? "a captain";
  const fee = `${trade.fee} Gold`;
  if (trade.status === "offered") {
    return mine
      ? `You are selling ${name} for ${fee}`
      : `${trade.sellerName} sells ${name} for ${fee}`;
  }
  if (mine) {
    return `You sold ${name} to ${other} for ${fee}`;
  }
  return isBuyer
    ? `${trade.sellerName} sold you ${name} for ${fee}`
    : `${trade.sellerName} sold ${name} to ${other} for ${fee}`;
}
