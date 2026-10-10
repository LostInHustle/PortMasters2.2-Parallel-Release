"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PrivateOffer } from "@/components/portmasters/game/PrivateOffer";
import type { PublicUser } from "@/lib/api";
import {
  ESCORT_OFFER_DEATH,
  LEG_ALREADY_COVERED,
  STALE_OFFER,
  consentFeeRule,
  feeShortfallLine,
} from "@/lib/game/constants/copy";
import { CONSENT_FEE_MIN } from "@/lib/game/constants/paths";
import {
  ESCORT_SELLER_PATH,
  canPayFee,
  canSellEscort,
  consentPartyBusy,
  escortCoverage,
  getOwnedAmount,
  type EscortContract,
} from "@/lib/game/engine";
import { escortContractsOn } from "@/lib/game/flags";
import { pathConfig } from "@/lib/game/paths";
import type { GameState } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import { Term } from "../Term";
import { Pill, RefusalLine } from "../shared";
import { MarketBlock, MarketEmpty, MarketPanel, OfferRow } from "./OfferBoard";
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
 * The three things this panel owes a captain are the three the market kept
 * failing to say, and each is read rather than written twice. What the deal
 * is and what it does at Resolve come from the engine's own numbers (see
 * escortCoverage, which is the one reading of the constants the raid roll
 * also reads). What this captain can do about it comes from the board: the
 * rows carry the state each offer is in, and the buttons on them are drawn
 * for every offer that is still an offer, aimed or open, because an offer
 * the whole table may take is the one a seller posts by default (see
 * OfferRow, which read the aim as the offer and left the open one with no
 * controls at all). And whether a press landed is answered by the seat line
 * below, which is read off that same board rather than remembered from a
 * press, so it cannot go stale and cannot claim an action the server
 * refused.
 *
 * The rules the buttons carry are the server's, not this file's. A captain
 * is covered once a leg, which is the shared primitive's bound read
 * on the buyer's side (see consentPartyBusy); a fee is paid by the buyer at
 * the handshake, which is the one condition this market asks of a purse
 * (see canPayFee); and an offer belongs to the leg it was posted in,
 * so a board that lags a checkpoint shows the refusal before a click
 * instead of after one.
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
  const [fee, setFee] = useState(CONSENT_FEE_MIN);
  const [targetId, setTargetId] = useState("");

  // A refusal belongs to the leg it was answered in. The board hook keeps
  // the last one it heard (see use-consent-board), and a leg's board is
  // replaced wholesale where its error line is not, so a refusal from the
  // Parley that just closed would sit over the next one: the leg is the
  // key, and the line goes when it turns.
  useEffect(() => {
    escort.clearError();
  }, [game.currentRound, escort.clearError]);

  if (!escortContractsOn(game.mode)) return null;

  const canSell = canSellEscort(game);
  const covered = consentPartyBusy(
    escort.contracts,
    "buyer",
    me.id,
    game.currentRound,
  );
  const others = members.filter((m) => m.id !== me.id);
  // The two shares of a raid, both read from the one number the raid roll
  // reads rather than spelled into the sentence below: the guns beat off
  // escortCoverage of it and the seller's Gold answers the rest, which is
  // the plan's "your cannons decide how much you actually eat" said as two
  // readings of one constant.
  const beatenOff = `${Math.round(escortCoverage() * 100)}%`;
  const eaten = `${Math.round((1 - escortCoverage()) * 100)}%`;
  const seat = seatLine(escort.contracts, me, game.currentRound);

  return (
    <MarketPanel
      title={
        <>
          {SELLER_PATH.crest} {SELLER_PATH.name}{" "}
          <Term term="Escort Market">Escort Market</Term>
        </>
      }
      intro={
        <>
          One leg of protection, sold by a Convoy captain at a price the two of
          them agree. The buyer pays the fee at the handshake, and it is the
          seller&apos;s cannons that answer the raid: {beatenOff} of it is
          beaten off, and the remaining {eaten} is deducted from the
          seller&apos;s Gold. The cover lasts the leg it was sold for and no
          other, and a raid that never comes costs the seller nothing.{" "}
          {ESCORT_OFFER_DEATH}
        </>
      }
    >
      {/* The posting form belongs to the path that sells the protection. A
          captain who holds no path reads the board below it and nothing
          else, which is what makes this a market rather than a screen. */}
      {canSell && (
        <MarketBlock>
          <PrivateOffer
            lead={
              <span className="text-muted-foreground">
                One leg of cover for
              </span>
            }
            fee={fee}
            onFee={setFee}
            targetId={targetId}
            onTarget={setTargetId}
            others={others}
            audienceLabel="Offer this contract to a specific captain"
            deadline="before the Parley closes."
            action={
              <Button
                className={cn("rounded-lg pm-grad-parley")}
                onClick={() => escort.post(fee, targetId || undefined)}
              >
                {SELLER_PATH.crest} Offer Protection
              </Button>
            }
          />
          <p className="text-center text-[11px] text-muted-foreground mt-1.5">
            You are the seller here, so the price is yours to name: the buyer
            pays it at the handshake, and your own Gold answers whatever your
            guns do not beat off, which is {eaten} of a raid, down to the bottom
            of your hold. {consentFeeRule()} An open offer is any captain&apos;s
            to take, while a named one waits on the captain you named, and one
            open offer plus one per captain named is the most this market holds
            from you.
          </p>
        </MarketBlock>
      )}

      <RefusalLine
        className="text-center mb-2"
        error={escort.error}
        onDismiss={escort.clearError}
      />

      {/* This captain's own seat at the market, which is the answer to
          "did my press land" as well as to "what am I waiting on": both are
          the same fact read off the same board, and a line read rather than
          remembered cannot say a refused offer was posted. */}
      {seat && (
        <p className="text-center text-[11px] mb-2 text-foreground">{seat}</p>
      )}

      {escort.contracts.length === 0 ? (
        <MarketEmpty>
          {canSell
            ? "Nothing is on the market yet. Name a price and post the first offer, or wait and let a buyer come to you."
            : "No protection is on offer this Parley. Only a Convoy captain at this table can sell one leg of cover, so their offer is what you are waiting for. An offer aimed at one captain waits on that captain, and an offer aimed at the table is any captain's to take."}
        </MarketEmpty>
      ) : (
        <div className="space-y-1.5">
          {escort.contracts.map((contract) => (
            <ContractRow
              key={contract.id}
              contract={contract}
              me={me}
              escort={escort}
              game={game}
              covered={covered}
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
 * Four statuses and no fifth, and each says what a reader may do about it.
 * A standing offer is the only one with a button on it, and the button
 * belongs to the captain the row is waiting on: the seller cancels, and the
 * captain it was addressed to takes it or turns it down. An open offer is
 * taken by whoever presses first, which is the whole of what "offered to
 * the harbor" means. An agreement is the leg's cover, and a claim is that
 * cover spent, and neither has anything left to press. A row that was
 * turned down stays for the seller to read (see the handler in
 * src/server/realtime/wiring/escort-contracts.ts) and carries no action at
 * all.
 *
 * Three refusals, in the order the server asks them, shown before the click
 * rather than after it: the leg moved, this captain is already covered, or
 * this captain cannot pay the fee. The last one is the market's one
 * condition on a purse, and it is asked here because the purse is this
 * client's own and the server has never read one: a buyer who pressed
 * anyway would pay what they hold while the seller credits the price they
 * agreed, which mints the difference rather than settling it (see
 * canPayFee).
 */
function ContractRow({
  contract,
  me,
  escort,
  game,
  covered,
}: {
  contract: EscortContract;
  me: PublicUser;
  escort: Escort;
  game: GameState;
  covered: boolean;
}) {
  const mine = contract.sellerUserId === me.id;
  const isBuyer = contract.buyerUserId === me.id;
  // The seller wears the path's crest on their own rows, since those are the
  // rows this captain is being paid for.
  const crest = SELLER_PATH.crest;
  const standing = contract.status === "offered";
  const stale = contract.round !== game.currentRound;
  // The one reading of this captain's purse, spent twice below: the guard
  // and the sentence that explains it say the same number, because two
  // readings of a purse that can move between them is two answers.
  const hold = getOwnedAmount(game, "Gold");
  const blocked = !standing
    ? null
    : stale
      ? STALE_OFFER
      : covered
        ? LEG_ALREADY_COVERED
        : !canPayFee(game, contract.fee)
          ? feeShortfallLine(hold, contract.fee)
          : null;

  return (
    <OfferRow
      mine={mine}
      className={cn(
        (contract.status === "claimed" || contract.status === "declined") &&
          "opacity-70",
      )}
      line={`${crest} ${contractLine(contract, me)}`}
      state={<RowState state={stateOf(contract, me, stale)} />}
      chip={
        standing && contract.buyerUserId
          ? { forMe: isBuyer, name: contract.buyerName }
          : null
      }
      standing={standing}
      acceptLabel={`${crest} Take Cover`}
      acceptClassName="pm-grad-parley"
      declineLabel="Turn It Down"
      blocked={blocked}
      onCancel={() => escort.cancel(contract.id)}
      onDecline={isBuyer ? () => escort.decline(contract.id) : undefined}
      onAccept={() => escort.accept(contract.id)}
    />
  );
}

// =====================================================================
// The words a row and a seat are read by: the state one offer stands in,
// the sentence that says whose it is and what it costs, and the line that
// tells this captain what they are waiting on.
// =====================================================================

/**
 * The state one row is in, as the label and the tone the row wears.
 *
 * It is one reading per status and per side rather than a sentence built
 * out of the status name, because the four statuses read as four different
 * answers to the question a captain actually has, which is what may I do
 * about this: an offer addressed to me waits on my press, an offer of mine
 * waits on somebody else's, an agreement is done, and a claim is spent.
 * The tone is the panel's only bit of colour of its own, and it answers the
 * same question: due when the next move is this captain's, sea otherwise.
 *
 * The leg is read before the status, because an offer is the one row whose
 * whole life is a leg and a Parley rather than a handshake: a board that
 * arrives a frame behind the checkpoint carries the row an offer that was
 * never taken expires as, and a row that still said it was waiting on
 * somebody would be inviting a press the market would refuse.
 */
function stateOf(
  contract: EscortContract,
  me: PublicUser,
  expired: boolean,
): { label: string; waits: boolean } {
  const mine = contract.sellerUserId === me.id;
  const isBuyer = contract.buyerUserId === me.id;
  const who = contract.buyerName ?? "a captain";
  if (contract.status === "offered") {
    if (expired) {
      return { label: "Expired with the leg", waits: false };
    }
    if (mine) {
      return {
        label: contract.buyerUserId
          ? `Waiting on ${who}`
          : "Waiting on the table",
        waits: false,
      };
    }
    return {
      label: isBuyer ? "Waiting on you" : "Open to the table",
      waits: isBuyer,
    };
  }
  if (contract.status === "agreed") {
    return {
      label: mine
        ? "Agreed: you are covering"
        : isBuyer
          ? "Agreed: you are covered"
          : "Agreed",
      waits: false,
    };
  }
  if (contract.status === "claimed") {
    return {
      label: mine ? "Cover spent: your guns answered" : "Cover spent",
      waits: false,
    };
  }
  return {
    label: isBuyer ? "You turned it down" : `Turned down by ${who}`,
    waits: false,
  };
}

/**
 * The state label, drawn beside the row's own sentence.
 *
 * A Pill rather than a span of this panel's own, so a status on this desk
 * is the same shape and the same wash as a status anywhere else in the
 * harbor, and the two tones are the shared meaning half of the palette
 * read by name (see TONE_WASH): due for the row the next move belongs to,
 * sea for every row that is waiting on somebody else. The size is pinned
 * back down to the row's own measure, because a board of five rows is not
 * five headlines.
 */
function RowState({ state }: { state: { label: string; waits: boolean } }) {
  return (
    <Pill tone={state.waits ? "due" : "sea"} className="px-1.5 py-0 text-[9px]">
      {state.label}
    </Pill>
  );
}

/**
 * The captain's own seat at this market, read off the board.
 *
 * One line for all seven things a captain can be at this desk, in the
 * order they matter to whoever is standing there: an offer waiting on
 * their answer, the cover they hold, the cover they spent, the contract
 * they are carrying, the offer they are waiting to have taken, and the
 * offer that came back. The sentences are derived rather than remembered,
 * which is what makes this a confirmation: the moment the server's board
 * carries the row a press asked for, the line says so, and a press the
 * server refused never reaches it at all.
 *
 * The percentages are not in it. What a raid does to a purse is said once
 * in the panel's own paragraph, in the numbers the engine reads, and a
 * second reading here would be a second place for those numbers to be
 * wrong.
 */
function seatLine(
  contracts: EscortContract[],
  me: PublicUser,
  round: number,
): string | null {
  const forLeg = contracts.filter((c) => c.round === round);
  const waiting = forLeg.find(
    (c) => c.status === "offered" && c.buyerUserId === me.id,
  );
  if (waiting) {
    return `⏳ ${waiting.sellerName} offers you one leg of cover for ${waiting.fee} Gold. You are the one who answers: taking it pays the fee at the handshake, and turning it down leaves the row for them to read.`;
  }
  // The cover is read in its two moments rather than in one, because a
  // spent cover is not a standing one: the buyer of a claimed contract
  // reads what the guns did rather than a line that still says they are
  // being covered for a raid that already came.
  const spent = forLeg.find(
    (c) => c.buyerUserId === me.id && c.status === "claimed",
  );
  if (spent) {
    return `✅ Your cover was spent this leg: ${spent.sellerName}'s guns answered the raid and your Gold stayed where it was.`;
  }
  const covered = forLeg.find(
    (c) => c.buyerUserId === me.id && c.status === "agreed",
  );
  if (covered) {
    return `✅ You are covered this leg by ${covered.sellerName} for ${covered.fee} Gold, paid at the handshake. A raid on your hold meets their cannons, and what their guns do not beat off comes out of their Gold.`;
  }
  const carrying = forLeg.find(
    (c) =>
      c.sellerUserId === me.id &&
      (c.status === "agreed" || c.status === "claimed"),
  );
  if (carrying) {
    return `🛡️ You are covering ${carrying.buyerName ?? "a captain"} this leg for ${carrying.fee} Gold, already paid to you. Your Gold answers the raid their hold does not.`;
  }
  const standing = forLeg.filter(
    (c) => c.status === "offered" && c.sellerUserId === me.id,
  );
  if (standing.length === 1) {
    const [one] = standing;
    return one.buyerUserId
      ? `🛡️ Your offer stands: ${one.fee} Gold for one leg of cover for ${one.buyerName ?? "a captain"}. It waits on them.`
      : `🛡️ Your offer stands: ${one.fee} Gold for one leg of cover, open to every captain here. The first to take it gets it.`;
  }
  if (standing.length > 1) {
    return `🛡️ ${standing.length} offers of yours stand this Parley, the newest at ${standing[standing.length - 1].fee} Gold. Each waits on the captain it names, or on the first captain to take an open one.`;
  }
  const refused = forLeg.find(
    (c) => c.status === "declined" && c.sellerUserId === me.id,
  );
  if (refused) {
    return `🚫 ${refused.buyerName ?? "A captain"} turned down your offer of ${refused.fee} Gold. Nothing is owed either way, and the row stays until the leg turns.`;
  }
  return null;
}

/**
 * The row's own sentence, in the second person where the row is this
 * captain's and the seller's name where it belongs to somebody else.
 *
 * Written as a function rather than a stack of conditional JSX because the
 * four statuses read as four different sentences about the same contract,
 * and the one thing all four have to agree on is who is speaking about
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
  if (contract.status === "claimed") {
    return mine
      ? `Your guns answered a raid meant for ${other}`
      : `${contract.sellerName}'s guns answered a raid meant for ${who}`;
  }
  return mine
    ? `${other} turned down your offer of ${fee}`
    : `You turned down ${contract.sellerName}'s offer of ${fee}`;
}
