"use client";

import { useState } from "react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PrivateOffer } from "@/components/portmasters/game/PrivateOffer";
import type { PublicUser } from "@/lib/api";
import {
  MEND_GOLD_PER_POINT,
  MEND_POINTS,
  RAG_SCRAP_VALUE,
  REFIT_POINTS,
  REWEAVE_GOOD,
  REWEAVE_RAGS,
} from "@/lib/game/constants/garments";
import { ICONS } from "@/lib/game/constants/brand";
import { RAGS } from "@/lib/game/constants/goods";
import {
  REFIT_ALREADY_TAKEN,
  STALE_OFFER,
  feeShortfallLine,
} from "@/lib/game/constants/copy";
import { CONSENT_FEE_MIN } from "@/lib/game/constants/paths";
import {
  REFIT_SELLER_PATH,
  buyRag,
  canPayFee,
  canSellRefit,
  getOwnedAmount,
  mendGarment,
  ragsLeftAtPort,
  refitRoomFor,
  refitSellerBusy,
  refitsOn,
  reweaveRags,
  type RefitContract,
} from "@/lib/game/engine";
import { garmentRoom, garmentSpec } from "@/lib/game/garments";
import { t } from "@/lib/game/i18n";
import { pathConfig } from "@/lib/game/paths";
import type { GameState } from "@/lib/game/types";
import { MarketBlock, MarketEmpty, OfferRow } from "./OfferBoard";
import { RefusalLine } from "../shared";
import type { LedgerAct } from "@/lib/game/ledger";
import type { Refit } from "./phases/PhaseShared";

// The selling path's own record, resolved once at module load rather than on
// every row, the same way the escort market resolves its own (see
// pathConfig). Its `goods` field is the three garments, read off the
// wardrobe table, so the form's menu and the orders a Loom captain is
// offered are one list rather than two that agree today.
const SELLER_PATH = pathConfig(REFIT_SELLER_PATH);

// What the harbor tailors do, quoted rather than spelled into the two
// sentences that describe it. "One point" written as words is a second place
// the rule lives, and the one the engine reads (MEND_POINTS) is the one that
// would move. Both spellings are the pack's two rows, so a sentence built
// from the number alone never reads "1 points", and the read is here rather
// than at module load, where it would freeze the language the process
// started in. The plural row names the count this fills.
function tailorWorkText(): string {
  return MEND_POINTS === 1
    ? t("one point")
    : t("{MEND_POINTS} points", { MEND_POINTS });
}

/**
 * The Loom's bench, drawn on the port board of the
 * Market phase because that is where the design puts it: a garment put right
 * in one round, sold by a Loom captain to another captain at a price the two
 * of them agree, and read by the harbor for the rest of the round.
 *
 * Four things stand on this panel and they are one economy read from four
 * ends. The offer form is the trade itself. The harbor pile is the Loom's
 * supply, and it is also the reason to hold the path at all. The harbor
 * tailors are what every other captain can do alone, and without a price to
 * be cheaper than, "faster and cheaper than they could manage alone" would
 * be a sentence rather than a trade. And the board is the harbor's view of who
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
 * captain takes on one refit a round, and an offer belongs to the round it was
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
  act: LedgerAct;
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

  if (!refitsOn(game.mode)) return null;

  const canSell = canSellRefit(game);
  const others = members.filter((m) => m.id !== me.id);
  const takenOn = refitSellerBusy(refit.refits, me.id, game.currentRound);
  const pile = ragsLeftAtPort(game);
  const held = game.inventory[RAGS] ?? 0;
  const mendedThisRound = game.mendRound === game.currentRound;
  // What the harbor tailors can work on, which is the crew's own wardrobe
  // read one good at a time: a captain means the thin coat, not a list of
  // durability numbers.
  const mendable = Array.from(
    new Set((game.garments ?? []).map((garment) => garment.good)),
  ).filter((worn) => garmentRoom(game, worn) > 0);

  return (
    <div className="rounded-xl border border-refit/15 bg-refit/[0.03] px-3.5 py-2.5">
      {/* No heading line of its own on the bench: the fold row above
          it already names the desk, and a header here would add a third
          repetition of the same sentence between the row and the
          paragraph that explains the trade. */}
      <p className="text-[11px] text-muted-foreground mb-2 max-w-2xl">
        {t(
          "Clothes lose a point of wear every round and two on a cold one. A {SELLER_PATH.name} captain can put {REFIT_POINTS} points back in a single round for whatever fee the two of you agree, and anyone can take {TAILOR_WORK} from the harbor tailors for {MEND_GOLD_PER_POINT} Gold. One open offer per captain you name, one refit taken on a round, and an offer nobody takes before the Market closes is gone.",
          {
            "SELLER_PATH.name": t(SELLER_PATH.name),
            REFIT_POINTS,
            TAILOR_WORK: tailorWorkText(),
            MEND_GOLD_PER_POINT,
          },
        )}
      </p>

      {/* The offer form belongs to the path that sells the work. A captain
          who holds no path reads the board below it and the tailors' row,
          which is what makes this a market rather than a screen. */}
      {canSell && (
        <MarketBlock tone="refit">
          {takenOn ? (
            <p className="text-center text-[11px] text-muted-foreground">
              {t(
                "You have already taken on a refit this round, and one pair of hands works one garment. The bench opens again next round.",
              )}
            </p>
          ) : (
            <PrivateOffer
              lead={
                <>
                  <span className="text-muted-foreground">
                    {t("Put right")}
                  </span>
                  <Select
                    value={good}
                    onChange={(e) => setGood(e.target.value)}
                    aria-label={t("The garment this refit works on")}
                  >
                    {SELLER_PATH.goods.map((option) => (
                      <option key={option} value={option}>
                        {t(option)}
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
              audienceLabel={t("Offer this refit to a specific captain")}
              deadline={t("before the Market closes.")}
              action={
                <Button
                  className="rounded-lg"
                  onClick={() => refit.post(fee, good, targetId || undefined)}
                >
                  {SELLER_PATH.crest} {t("Offer a Refit")}
                </Button>
              }
            />
          )}
        </MarketBlock>
      )}

      {/* The harbor's pile. A Loom captain's supply is the scrap the fleet
          brought ashore, which is why this row is drawn for that path alone
          and why it reads the same weather the crew freezes in. */}
      {canSell && (
        <MarketBlock tone="refit">
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px]">
            <span className="text-muted-foreground">{t("Harbor pile")}</span>
            <span className="font-bold text-refit">{pile}</span>
            <span className="text-muted-foreground">
              {pile === 1
                ? t("rag left for you this round")
                : t("rags left for you this round")}
            </span>
            <span className="text-muted-foreground">
              {t("· in the hold: {held}", { held })}
            </span>
            <Button
              size="sm"
              className="h-7 rounded-lg px-2.5 text-[11px]"
              variant={pile > 0 ? "default" : "secondary"}
              disabled={pile <= 0}
              onClick={() => act((g, l) => buyRag(g, l))}
            >
              {ICONS.Rags}{" "}
              {t("Buy a Rag ({RAG_SCRAP_VALUE}💰)", { RAG_SCRAP_VALUE })}
            </Button>
            <Button
              size="sm"
              className="h-7 rounded-lg px-2.5 text-[11px]"
              variant={held >= REWEAVE_RAGS ? "default" : "secondary"}
              disabled={held < REWEAVE_RAGS}
              onClick={() => act((g, l) => reweaveRags(g, l))}
            >
              {SELLER_PATH.crest}{" "}
              {t("Reweave {rags} Rags into {good}", {
                rags: REWEAVE_RAGS,
                good: t(REWEAVE_GOOD),
              })}
            </Button>
          </div>
          <p className="text-center text-[11px] text-muted-foreground mt-1.5">
            {pile === 0
              ? t(
                  "No rags came ashore this round. The pile only fills after a cold one.",
                )
              : t(
                  "The pile is what the fleet's scrap comes to after a cold round, and it is drawn from the voyage's own weather. {REWEAVE_RAGS} rags go back on the loom as one {REWEAVE_GOOD}.",
                  {
                    REWEAVE_RAGS,
                    REWEAVE_GOOD: t(REWEAVE_GOOD),
                  },
                )}
          </p>
        </MarketBlock>
      )}

      {/* What every captain can do alone, and the price a refit is measured
          against. One point a round, once, whatever the path.

          A round whose mend is spent keeps the whole row on screen rather
          than swapping it for a sentence: the field read the row vanishing
          as every button having fired, and no panel that deletes its own
          record can argue with that. The worked garment's number has moved
          and the others' have not, which is the receipt, and the disabled
          press says tomorrow without taking the numbers down. */}
      <MarketBlock tone="plain">
        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px]">
          <span className="text-muted-foreground">{t("Harbor tailors")}</span>
          {mendedThisRound ? (
            <span className="text-muted-foreground">
              {t(
                "have already worked on the crew this round. Another garment waits for tomorrow.",
              )}
            </span>
          ) : mendable.length === 0 ? (
            <span className="text-muted-foreground">
              {(game.garments ?? []).length === 0
                ? t(
                    "have nothing to put right. Nobody in the crew is wearing anything.",
                  )
                : t("have nothing to put right. The crew's clothes are whole.")}
            </span>
          ) : (
            <span className="text-muted-foreground">
              {t("will put {points} back for {gold} Gold, once a round.", {
                points: tailorWorkText(),
                gold: MEND_GOLD_PER_POINT,
              })}
            </span>
          )}
          {/* The row of buttons stays a row after the mend: the same
              buttons, grayed, with the numbers the mend left behind. The
              spent round reads the whole wardrobe, because a garment already
              whole has no room to mend and would otherwise vanish from a
              row whose whole job is to account for where the points went. */}
          {(mendedThisRound
            ? Array.from(
                new Set((game.garments ?? []).map((garment) => garment.good)),
              )
            : mendable
          ).map((worn) => {
            const spec = garmentSpec(worn);
            const left = spec ? spec.durability - garmentRoom(game, worn) : 0;
            return (
              <Button
                key={worn}
                size="sm"
                className="h-7 rounded-lg px-2.5 text-[11px]"
                variant={mendedThisRound ? "secondary" : "default"}
                disabled={mendedThisRound}
                onClick={() => act((g, l) => mendGarment(g, worn, l))}
              >
                {ICONS.Rags}{" "}
                {spec
                  ? t("Mend {worn} ({left} of {durability}, {gold}💰)", {
                      worn: t(worn),
                      left,
                      durability: spec.durability,
                      gold: MEND_GOLD_PER_POINT,
                    })
                  : t("Mend {worn} ({left}, {gold}💰)", {
                      worn: t(worn),
                      left,
                      gold: MEND_GOLD_PER_POINT,
                    })}
              </Button>
            );
          })}
        </div>
      </MarketBlock>

      <RefusalLine
        className="text-center mb-2"
        error={refit.error}
        onDismiss={refit.clearError}
      />

      {refit.refits.length === 0 ? (
        <MarketEmpty className="py-2">
          {canSell
            ? t("Nothing on the bench yet. Your offer is the first.")
            : t("No refit work on offer this round.")}
        </MarketEmpty>
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
  // every garment they own, and a Loom has two hands and one round. The
  // customer's own side is the purse, and it is the last condition for the
  // reason the escort's row gives it last: the fee moves at the handshake on
  // the customer's machine, and a settle that ran short would pay what the
  // purse holds while the seller is credited the agreed price (see
  // canPayFee).
  const hold = getOwnedAmount(game, "Gold");
  const blocked = stale
    ? t(STALE_OFFER)
    : points < 1
      ? t("Nothing left to put right on your {row.good}.", {
          "row.good": t(row.good),
        })
      : refitSellerBusy(refit.refits, row.sellerUserId, game.currentRound)
        ? t(REFIT_ALREADY_TAKEN)
        : !canPayFee(game, row.fee)
          ? feeShortfallLine(hold, row.fee)
          : null;

  return (
    <OfferRow
      mine={mine}
      line={refitLine(row, me)}
      // The bench's own reading of whether this row is still an offer, which
      // is what draws the buttons on it: the aim is not the offer, and a row
      // posted to the whole harbor is an offer like any other (see OfferRow).
      standing={row.status === "offered"}
      chip={
        row.status === "offered" && row.buyerUserId
          ? { forMe: isBuyer, name: row.buyerName }
          : null
      }
      acceptLabel={t("{crest} Take It", { crest })}
      blocked={blocked}
      onCancel={() => refit.cancel(row.id)}
      onAccept={() => refit.accept(row.id)}
    />
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
  // The possessive is the pack's own pair: "your" where the row speaks about
  // this captain, and the buyer's name with its possessive token where it
  // speaks about somebody else.
  const possessive = isBuyer
    ? t("your")
    : t("{who}'s", { who: row.buyerName ?? t("a captain") });
  const good = t(row.good);
  const fee = t("{row.fee} Gold", { "row.fee": row.fee });
  if (row.status === "offered") {
    return mine
      ? t("You are offering to put a {row.good} right for {fee}", {
          "row.good": good,
          fee,
        })
      : t("{row.sellerName} offers to put a {row.good} right for {fee}", {
          "row.sellerName": row.sellerName,
          "row.good": good,
          fee,
        });
  }
  return mine
    ? t("You put {possessive} {row.good} right for {fee}", {
        possessive,
        "row.good": good,
        fee,
      })
    : t("{row.sellerName} put {possessive} {row.good} right for {fee}", {
        "row.sellerName": row.sellerName,
        possessive,
        "row.good": good,
        fee,
      });
}
