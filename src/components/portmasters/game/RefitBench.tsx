"use client";

import { useState } from "react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PrivateOffer } from "@/components/portmasters/game/PrivateOffer";
import type { PublicUser } from "@/lib/api";
import {
  CONSENT_FEE_MIN,
  MEND_GOLD_PER_POINT,
  MEND_POINTS,
  RAGS,
  RAG_SCRAP_VALUE,
  REFIT_POINTS,
  REWEAVE_GOOD,
  REWEAVE_RAGS,
} from "@/lib/game/constants";
import {
  REFIT_SELLER_PATH,
  buyRag,
  canSellRefit,
  mendGarment,
  ragsLeftAtPort,
  refitRoomFor,
  refitSellerBusy,
  refitsOn,
  reweaveRags,
  type RefitContract,
} from "@/lib/game/engine";
import { garmentRoom, garmentSpec } from "@/lib/game/garments";
import { pathConfig } from "@/lib/game/paths";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { Shirt } from "lucide-react";
import type { Refit } from "./phases/PhaseShared";

// The selling path's own record, resolved once at module load rather than on
// every row, the same way the escort market resolves its own (see
// pathConfig). Its `goods` field is the three garments, read off the
// wardrobe table, so the form's menu and the orders a Loom captain is
// offered are one list rather than two that agree today.
const SELLER_PATH = pathConfig(REFIT_SELLER_PATH)!;

// What the harbor tailors do, quoted rather than spelled into the two
// sentences that describe it. "One point" written as words is a second place
// the rule lives, and the one the engine reads (MEND_POINTS) is the one that
// would move. Both spellings are here because a sentence built from the
// number alone reads "1 points" the moment it is anything but one.
const TAILOR_WORK = MEND_POINTS === 1 ? "one point" : `${MEND_POINTS} points`;

/**
 * [D4: Loom: the Refit] The Loom's bench, drawn on the port board of the
 * Market phase because that is where the plan puts it: a garment put right
 * in one leg, sold by a Loom captain to another captain at a price the two
 * of them agree, and read by the room for the rest of the leg.
 *
 * Four things stand on this panel and they are one economy read from four
 * ends. The offer form is the trade itself. The harbor pile is the Loom's
 * supply, and it is also the reason to hold the path at all. The harbor
 * tailors are what every other captain can do alone, and without a price to
 * be cheaper than, "faster and cheaper than they could manage alone" would
 * be a sentence rather than a trade. And the board is the room's view of who
 * has offered what.
 *
 * Everything a captain can do here is a socket frame or an engine call on
 * their own state, and never a number this file worked out for itself. The
 * points an offer is worth are read through refitRoomFor, so the number the
 * row quotes and the number the customer's warmth moves by are one number;
 * the pile is read through ragsLeftAtPort; and the mend is the same
 * restoreGarment the refit runs, at a different price.
 *
 * The two rules the buttons carry are the server's, not this file's. A Loom
 * captain takes on one refit a leg, and an offer belongs to the leg it was
 * posted in, so a board that lags a checkpoint shows the refusal before a
 * click instead of after one.
 */
export function RefitBench({
  game,
  act,
  refit,
  me,
  members,
}: {
  game: GameState;
  act: (fn: (g: GameState, logs: string[]) => void) => void;
  refit: Refit;
  me: PublicUser;
  members: PublicUser[];
}) {
  // The drafts are held above the switch check so this component's hooks
  // never depend on the build it is in, the same shape the escort market
  // takes: a panel that returned before its own state would be a component
  // whose hook order is conditional on a constant.
  const [fee, setFee] = useState(CONSENT_FEE_MIN);
  const [good, setGood] = useState<string>(SELLER_PATH.goods[0] ?? "");
  const [targetId, setTargetId] = useState("");

  if (!refitsOn()) return null;

  const canSell = canSellRefit(game);
  const others = members.filter((m) => m.id !== me.id);
  const takenOn = refitSellerBusy(refit.refits, me.id, game.currentRound);
  const pile = ragsLeftAtPort(game);
  const held = game.inventory[RAGS] ?? 0;
  const mendedThisLeg = game.mendRound === game.currentRound;
  // What the harbor tailors can work on, which is the crew's own wardrobe
  // read one good at a time: a captain means the thin coat, not a list of
  // durability numbers.
  const mendable = Array.from(
    new Set((game.garments ?? []).map((garment) => garment.good)),
  ).filter((worn) => garmentRoom(game, worn) > 0);

  return (
    <div className="rounded-xl border border-refit/15 bg-refit/[0.03] px-3.5 py-2.5 mb-3.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-refit mb-1.5">
        <Shirt className="h-3.5 w-3.5" />
        {SELLER_PATH.crest} Loom Refit Bench
        <span className="font-normal text-muted-foreground ml-1">
          a garment put right in one leg
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-2 max-w-2xl">
        Clothes lose a point of wear every leg and two on a cold one. A{" "}
        {SELLER_PATH.name} captain can put {REFIT_POINTS} points back in a
        single leg for whatever fee the two of you agree, and anyone can take{" "}
        {TAILOR_WORK} from the harbor tailors for {MEND_GOLD_PER_POINT} Gold.
      </p>

      {/* The offer form belongs to the path that sells the work. A captain
          who holds no path reads the board below it and the tailors' row,
          which is what makes this a market rather than a screen. */}
      {canSell && (
        <div className="rounded-lg border border-refit/15 bg-background/40 p-3 mb-3">
          {takenOn ? (
            <p className="text-center text-[11px] text-muted-foreground">
              You have already taken on a refit this leg, and one pair of hands
              works one garment. The bench opens again next leg.
            </p>
          ) : (
            <>
              <PrivateOffer
                lead={
                  <>
                    <span className="text-muted-foreground">Put right</span>
                    <Select
                      value={good}
                      onChange={(e) => setGood(e.target.value)}
                      aria-label="The garment this refit works on"
                    >
                      {SELLER_PATH.goods.map((option) => (
                        <option key={option} value={option}>
                          {option}
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
                audienceLabel="Offer this refit to a specific captain"
                deadline="before the Market closes."
                action={
                  <Button
                    className="rounded-lg"
                    onClick={() => refit.post(fee, good, targetId || undefined)}
                  >
                    {SELLER_PATH.crest} Offer a Refit
                  </Button>
                }
              />
              <p className="text-center text-[11px] text-muted-foreground mt-1.5">
                One open offer per captain you name, one refit taken on a leg,
                and an offer nobody takes before the Market closes is gone.
              </p>
            </>
          )}
        </div>
      )}

      {/* The harbor's pile. A Loom captain's supply is the scrap the fleet
          brought ashore, which is why this row is drawn for that path alone
          and why it reads the same weather the crew freezes in. */}
      {canSell && (
        <div className="rounded-lg border border-refit/15 bg-background/40 p-3 mb-3">
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px]">
            <span className="text-muted-foreground">Harbor pile</span>
            <span className="font-bold text-refit">{pile}</span>
            <span className="text-muted-foreground">
              {pile === 1
                ? "rag left for you this leg"
                : "rags left for you this leg"}
            </span>
            <span className="text-muted-foreground">· in the hold: {held}</span>
            <Button
              size="sm"
              className="h-7 rounded-lg px-2.5 text-[11px]"
              variant={pile > 0 ? "default" : "secondary"}
              disabled={pile <= 0}
              onClick={() => act((g, l) => buyRag(g, l))}
            >
              🪡 Buy a Rag ({RAG_SCRAP_VALUE}💰)
            </Button>
            <Button
              size="sm"
              className="h-7 rounded-lg px-2.5 text-[11px]"
              variant={held >= REWEAVE_RAGS ? "default" : "secondary"}
              disabled={held < REWEAVE_RAGS}
              onClick={() => act((g, l) => reweaveRags(g, l))}
            >
              {SELLER_PATH.crest} Reweave {REWEAVE_RAGS} Rags into{" "}
              {REWEAVE_GOOD}
            </Button>
          </div>
          <p className="text-center text-[11px] text-muted-foreground mt-1.5">
            {pile === 0
              ? "No rags came ashore this leg. The pile only fills after a cold one."
              : `The pile is what the fleet's scrap comes to after a cold leg, and it is drawn from the voyage's own weather. ${REWEAVE_RAGS} rags go back on the loom as one ${REWEAVE_GOOD}.`}
          </p>
        </div>
      )}

      {/* What every captain can do alone, and the price a refit is measured
          against. One point a leg, once, whatever the path. */}
      <div className="rounded-lg border border-black/5 dark:border-white/10 bg-background/40 p-3 mb-3">
        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px]">
          <span className="text-muted-foreground">Harbor tailors</span>
          {mendedThisLeg ? (
            <span className="text-muted-foreground">
              have already worked on the crew this leg. They take another
              garment tomorrow.
            </span>
          ) : mendable.length === 0 ? (
            <span className="text-muted-foreground">
              have nothing to put right. The crew's clothes are whole.
            </span>
          ) : (
            <>
              <span className="text-muted-foreground">
                will put {TAILOR_WORK} back for {MEND_GOLD_PER_POINT} Gold, once
                a leg.
              </span>
              {mendable.map((worn) => {
                const spec = garmentSpec(worn);
                const left = spec
                  ? spec.durability - garmentRoom(game, worn)
                  : 0;
                return (
                  <Button
                    key={worn}
                    size="sm"
                    className="h-7 rounded-lg px-2.5 text-[11px]"
                    onClick={() => act((g, l) => mendGarment(g, worn, l))}
                  >
                    🪡 Mend {worn} ({left}
                    {spec ? ` of ${spec.durability}` : ""},{" "}
                    {MEND_GOLD_PER_POINT}💰)
                  </Button>
                );
              })}
            </>
          )}
        </div>
      </div>

      {refit.error && (
        <p className="text-center text-[11px] text-alarm mb-2">
          {refit.error}{" "}
          <button
            type="button"
            onClick={refit.clearError}
            className="underline"
          >
            Dismiss
          </button>
        </p>
      )}

      {refit.refits.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-2">
          {canSell
            ? "Nothing on the bench yet. Your offer is the first."
            : "No refit work on offer this leg."}
        </p>
      ) : (
        <div className="space-y-1.5">
          {refit.refits.map((row) => (
            <RefitRow
              key={row.id}
              row={row}
              game={game}
              me={me}
              refit={refit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One row of the bench, read by its status and by which side of it this
 * captain is on.
 *
 * Two statuses and no third. A refit settles the moment it is agreed,
 * because both halves of it are known at that moment: the customer pays the
 * fee and their own garment gets the points back, on their own machine. The
 * escort's claimed state exists because half of that trade, what a raid
 * would have taken, does not exist until Resolve.
 */
function RefitRow({
  row,
  game,
  me,
  refit,
}: {
  row: RefitContract;
  game: GameState;
  me: PublicUser;
  refit: Refit;
}) {
  const mine = row.sellerUserId === me.id;
  const isBuyer = row.buyerUserId === me.id;
  const crest = SELLER_PATH.crest;
  const stale = row.round !== game.currentRound;
  const points = refitRoomFor(game, row.good);
  // The server's own refusals, shown before the click rather than after it.
  // The bound is read on the seller's side here because that is the side
  // this market bounds (see refitSellerBusy): a customer may buy a refit for
  // every garment they own, and a Loom has two hands and one leg.
  const blocked = stale
    ? "That offer belongs to an earlier leg."
    : points < 1
      ? `Nothing left to put right on your ${row.good}.`
      : refitSellerBusy(refit.refits, row.sellerUserId, game.currentRound)
        ? "That captain has already taken on a refit this leg."
        : null;

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md px-3 py-2 text-xs border gap-2",
        mine
          ? "bg-due/[0.06] border-due/20"
          : "bg-background/60 border-black/5 dark:border-white/10",
      )}
    >
      <span className="flex items-center gap-1.5 flex-wrap">
        <span className="font-medium">{refitLine(row, me)}</span>
        {row.status === "offered" && row.buyerUserId && (
          <span className="rounded-full bg-sea/5 px-1.5 py-0.5 text-[9px] font-medium text-sea">
            🔒 {isBuyer ? "Just for you" : `Just for ${row.buyerName}`}
          </span>
        )}
      </span>

      {row.status === "offered" &&
        (mine ? (
          <Button
            size="sm"
            variant="destructive"
            className="h-7 px-2.5 text-[10px] rounded shrink-0"
            onClick={() => refit.cancel(row.id)}
          >
            Cancel
          </Button>
        ) : (
          <span className="flex flex-col items-end gap-0.5 shrink-0">
            <Button
              size="sm"
              className="h-7 px-2.5 text-[10px] rounded"
              variant={blocked ? "secondary" : "default"}
              disabled={blocked !== null}
              onClick={() => refit.accept(row.id)}
            >
              {crest} Take It
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
 * captain's and the seller's name where it belongs to somebody else, written
 * as a function for the reason the escort's own row line is: the two
 * statuses read as two sentences about the same agreement, and the one thing
 * they have to agree on is who is speaking about whom.
 *
 * The work is named rather than counted. A refit is always the same amount
 * of it, so a number on this line would be the same number on every row of
 * the board and would only invite a reader to look for where it varies.
 */
function refitLine(row: RefitContract, me: PublicUser): string {
  const mine = row.sellerUserId === me.id;
  const isBuyer = row.buyerUserId === me.id;
  const who = isBuyer ? "you" : (row.buyerName ?? "a captain");
  const fee = `${row.fee} Gold`;
  if (row.status === "offered") {
    return mine
      ? `You are offering to put a ${row.good} right for ${fee}`
      : `${row.sellerName} offers to put a ${row.good} right for ${fee}`;
  }
  return mine
    ? `You put ${who === "you" ? "your" : `${who}'s`} ${row.good} right for ${fee}`
    : `${row.sellerName} put ${who === "you" ? "your" : `${who}'s`} ${row.good} right for ${fee}`;
}
