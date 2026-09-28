"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { QuantityInput } from "@/components/ui/quantity-input";
import type { PublicUser } from "@/lib/api";
import {
  ESCORT_CONTRACT_FEE_MAX,
  ESCORT_CONTRACT_FEE_MIN,
} from "@/lib/game/constants";
import {
  ESCORT_SELLER_PATH,
  canSellEscort,
  escortBuyerBusy,
  escortCoverage,
  type EscortContract,
} from "@/lib/game/engine";
import { escortContractsOn } from "@/lib/game/flags";
import { pathConfig } from "@/lib/game/paths";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import type { Escort } from "./phases/PhaseShared";

// The selling path's own record, resolved once at module load rather than
// on every row: the crest and the name a menu and a set of rows draw. The
// id is a constant the paths table carries, so the record is there in every
// build this compiles in, and the assertion is only the type checker asking
// for a proof it cannot see through a lookup by value (see pathConfig).
const SELLER_PATH = pathConfig(ESCORT_SELLER_PATH)!;

/**
 * [D3: Convoy: the Escort Contract] The protection market, drawn at the
 * Parley table beside the Captain's Exchange because that is where the plan
 * puts it: one leg of cover, sold by a Convoy captain to one other captain
 * at a price the two of them agree, and read by the room for the rest of
 * the leg.
 *
 * Everything a captain can do here is a socket frame and nothing else. The
 * Gold moves on the two clients that agreed to it, through applyEscortSide,
 * and the board this panel draws is the server's own view of who has
 * offered what: a panel that decided any of this by itself would be a
 * second market the room could not see.
 *
 * The two rules the buttons carry are the server's, not this file's. A
 * captain is covered once a leg (escortBuyerBusy), and an offer belongs to
 * the leg it was posted in, so a board that lags a checkpoint shows the
 * refusal before a click instead of after one.
 */
export function EscortMarket({
  game,
  escort,
  me,
  members,
}: {
  game: GameState;
  escort: Escort;
  me: PublicUser;
  members: PublicUser[];
}) {
  // The draft is held above the switch check so this component's hooks
  // never depend on the build it is in. A panel that returned before its
  // own state would be a component whose hook order is conditional on a
  // constant, which is the shape the rules of hooks exist to forbid.
  const [fee, setFee] = useState(ESCORT_CONTRACT_FEE_MIN);
  const [targetId, setTargetId] = useState("");

  if (!escortContractsOn()) return null;

  const canSell = canSellEscort(game);
  const covered = escortBuyerBusy(escort.contracts, me.id, game.currentRound);
  const others = members.filter((m) => m.id !== me.id);
  const beatenOff = `${Math.round(escortCoverage() * 100)}%`;
  const selectClass =
    "h-9 rounded-md border border-input bg-transparent px-2 text-sm";

  return (
    <div className="rounded-xl border border-parley/15 bg-parley/[0.03] p-4 mb-4">
      <h3 className="text-center font-semibold mb-1 text-sm">
        {SELLER_PATH.crest} {SELLER_PATH.name} Escort Market
      </h3>
      <p className="text-center text-[11px] text-muted-foreground mb-3 max-w-xl mx-auto">
        One leg of protection, at a price the two of you agree. A raid that
        would have taken the buyer's hold meets the seller's cannons instead:
        the guns beat off {beatenOff} of it, and whatever is left lands on the
        seller's own Gold. The fee is paid when you shake hands, and the cover
        lasts the leg it was sold for.
      </p>

      {/* The posting form belongs to the path that sells the protection. A
          captain who holds no path reads the board below it and nothing
          else, which is what makes this a market rather than a screen. */}
      {canSell && (
        <div className="rounded-lg border border-parley/15 bg-background/40 p-3 mb-3">
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="text-muted-foreground">One leg of cover for</span>
            <QuantityInput
              value={fee}
              onCommit={setFee}
              min={ESCORT_CONTRACT_FEE_MIN}
              max={ESCORT_CONTRACT_FEE_MAX}
              aria-label="Fee in Gold"
              className="w-20 h-9"
            />
            <span className="text-muted-foreground">Gold, offered to</span>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className={selectClass}
              aria-label="Offer this contract to a specific captain"
            >
              <option value="">🌊 Anyone in the harbor</option>
              {others.map((m) => (
                <option key={m.id} value={m.id}>
                  🔒 {m.displayName} only
                </option>
              ))}
            </select>
            <Button
              className={cn("rounded-lg pm-grad-parley")}
              onClick={() => escort.post(fee, targetId || undefined)}
            >
              {SELLER_PATH.crest} Offer Protection
            </Button>
          </div>
          {targetId && (
            <p className="text-center text-[11px] text-muted-foreground mt-1.5">
              Only {others.find((m) => m.id === targetId)?.displayName} will see
              this offer, so nobody else can take it first. It still has to be
              taken in this Parley.
            </p>
          )}
          <p className="text-center text-[11px] text-muted-foreground mt-1.5">
            One open offer per captain you name, and an offer nobody takes
            before the Parley closes is gone.
          </p>
        </div>
      )}

      {escort.error && (
        <p className="text-center text-[11px] text-alarm mb-2">
          {escort.error}{" "}
          <button
            type="button"
            onClick={escort.clearError}
            className="underline"
          >
            Dismiss
          </button>
        </p>
      )}

      {escort.contracts.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-3">
          {canSell
            ? "Nothing on the market yet. Your offer is the first."
            : "No protection on offer this Parley."}
        </p>
      ) : (
        <div className="space-y-1.5">
          {escort.contracts.map((contract) => (
            <ContractRow
              key={contract.id}
              contract={contract}
              me={me}
              escort={escort}
              round={game.currentRound}
              covered={covered}
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
 * Three statuses and no fourth: an offer is a price somebody is asking, an
 * agreed contract is the leg's cover, and a claimed one is that cover having
 * been spent. Nothing about the absorbed Gold is printed here, because the
 * seller already reads it in their own log and in their own tally, and a
 * second place for the same number is a second place for it to be wrong.
 */
function ContractRow({
  contract,
  me,
  escort,
  round,
  covered,
}: {
  contract: EscortContract;
  me: PublicUser;
  escort: Escort;
  round: number;
  covered: boolean;
}) {
  const mine = contract.sellerUserId === me.id;
  const isBuyer = contract.buyerUserId === me.id;
  // The seller wears the path's crest on their own rows, since those are the
  // rows this captain is being paid for.
  const crest = SELLER_PATH.crest;
  const stale = contract.round !== round;
  // One of the server's two refusals, shown before the click rather than
  // after it. Both sentences are the room's own.
  const blocked = covered
    ? "You are already covered for this leg."
    : stale
      ? "That offer belongs to an earlier leg."
      : null;

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md px-3 py-2 text-xs border gap-2",
        mine
          ? "bg-due/[0.06] border-due/20"
          : "bg-background/60 border-black/5 dark:border-white/10",
        contract.status === "claimed" && "opacity-70",
      )}
    >
      <span className="flex items-center gap-1.5 flex-wrap">
        <span className="font-medium">
          {crest} {contractLine(contract, me)}
        </span>
        {contract.status === "offered" && contract.buyerUserId && (
          <span className="rounded-full bg-sea/5 px-1.5 py-0.5 text-[9px] font-medium text-sea">
            🔒 {isBuyer ? "Just for you" : `Just for ${contract.buyerName}`}
          </span>
        )}
      </span>

      {contract.status === "offered" &&
        (mine ? (
          <Button
            size="sm"
            variant="destructive"
            className="h-7 px-2.5 text-[10px] rounded shrink-0"
            onClick={() => escort.cancel(contract.id)}
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
              onClick={() => escort.accept(contract.id)}
            >
              {crest} Take Cover
            </Button>
            {blocked && (
              <span className="text-[9px] text-muted-foreground">
                {blocked}
              </span>
            )}
          </span>
        ))}
    </div>
  );
}

/**
 * The row's own sentence, in the second person where the row is this
 * captain's and the seller's name where it belongs to somebody else.
 *
 * Written as a function rather than a stack of conditional JSX because the
 * three statuses read as three different sentences about the same contract,
 * and the one thing all three have to agree on is who is speaking about
 * whom: a row that said "You" about another captain's contract would be the
 * kind of mistake that only shows up in a screenshot.
 */
function contractLine(contract: EscortContract, me: PublicUser): string {
  const mine = contract.sellerUserId === me.id;
  const isBuyer = contract.buyerUserId === me.id;
  const who = isBuyer ? "you" : (contract.buyerName ?? "a captain");
  const other = contract.buyerName ?? "a captain";
  const fee = `${contract.fee} Gold`;
  if (contract.status === "offered") {
    return mine
      ? `You are selling one leg of cover for ${fee}`
      : `${contract.sellerName} sells one leg of cover for ${fee}`;
  }
  if (contract.status === "agreed") {
    return mine
      ? `You are covering ${other} for ${fee} this leg`
      : `${contract.sellerName} is covering ${who} for ${fee} this leg`;
  }
  return mine
    ? `Your guns answered a raid meant for ${other}`
    : `${contract.sellerName}'s guns answered a raid meant for ${who}`;
}
