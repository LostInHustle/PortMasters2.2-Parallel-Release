// The Loom's refit. A Loom captain puts another captain's garment right,
// holds the reweave chain and is the only one who may buy the harbor's
// rags.
//
// This is the engine's cross captain mutation, so authorization is the
// point: a mutual acceptance on the consent primitive the escort contract
// uses (see ./consent). The Loom offers, the customer accepts, and the
// customer's own client applies the change. No captain's state is written
// by another captain's machine: the server brokers, the owner applies.
//
// Kind specific rules live here: the seller is a path, the term is a good
// rather than a round of cover, the effect puts points back into a garment,
// the seller is bounded to one refit a round, and the harbor's own mend is
// the baseline the refit is priced against.
import {
  MEND_GOLD_PER_POINT,
  MEND_POINTS,
  RAGS_AT_PORT_COLD,
  RAG_SCRAP_VALUE,
  REFIT_POINTS,
  REWEAVE_GOOD,
  REWEAVE_RAGS,
} from "../constants/garments";
import { ICONS } from "../constants/brand";
import { RAGS } from "../constants/goods";
import { flagOnFor } from "../flags";
import {
  garmentsLayerOn,
  garmentRoom,
  garmentSpec,
  legIsCold,
  restoreGarment,
} from "../garments";
import { cargoRoom } from "../larder";
import type { PathId } from "../paths";
import { createRng } from "../rng";
import { wholeStamp, type GameState } from "../types";
import { line, type LedgerLine } from "@/lib/game/ledger";
import { consentPartyBusy, floorTallies, type ConsentTerms } from "./consent";
import { addOwnedAmount, getOwnedAmount } from "./core";
import { settleConsentTrade } from "./settlement";

/** The path whose ability is the refit bench. */
export const REFIT_SELLER_PATH: PathId = "loom";

/**
 * Whether the bench is open: the refit, the mend and the rag trade. Stands
 * on the garments layer as well as its own flag, since there is nothing to
 * mend on a table with no clothes.
 *
 * The env read is written inline because the browser bundle substitutes
 * only reads written where they happen (see flagOnFor). Mode is read
 * first, so Classic never reaches the other two.
 */
export function refitsOn(mode: unknown): boolean {
  return (
    flagOnFor(mode, process.env.NEXT_PUBLIC_REFITS) && garmentsLayerOn(mode)
  );
}

/**
 * Switch first, then path: with the feature off a Loom captain is refused
 * as flatly as everyone else.
 */
export function canSellRefit(state: Pick<GameState, "path" | "mode">): boolean {
  return refitsOn(state.mode) && state.path === REFIT_SELLER_PATH;
}

/** The seller's half of "one garment a round". */
export function refitSellerBusy(
  contracts: RefitContract[],
  userId: string,
  round: number,
): boolean {
  return consentPartyBusy(contracts, "seller", userId, round);
}

/**
 * Points a refit would put back, from the garment arithmetic so the board
 * and the crew's warmth read one number.
 */
export function refitRoomFor(
  state: Pick<GameState, "garments" | "mode">,
  good: unknown,
): number {
  if (!refitsOn(state.mode)) return 0;
  return Math.min(REFIT_POINTS, garmentRoom(state, good));
}

/**
 * The harbor's pile, which bounds this path's supply. Drawn from the
 * voyage's own numbers like the weather (see legIsCold in ../garments), so
 * every captain sees the same pile without a server message and a reload
 * answers the same way. There is no pile on a warm round.
 *
 * It is not a shared shelf: each Loom reads the same pile and takes their
 * own share, so the number that bounds the trade is one both captains can
 * read.
 */
export function ragsAtPort(
  state: Pick<
    GameState,
    "voyageEpoch" | "mode" | "difficulty" | "currentRound"
  >,
): number {
  if (!refitsOn(state.mode)) return 0;
  // Ask the weather rather than drawing a second cold round, or the two
  // answers drift.
  if (!legIsCold(state)) return 0;
  const seed = `${state.voyageEpoch}:${state.mode}:${state.difficulty}:rags:${state.currentRound}`;
  return 1 + Math.floor(createRng(seed)() * RAGS_AT_PORT_COLD);
}

/**
 * What is left of this captain's share this round. A stamp that no longer
 * matches means nothing has been taken yet.
 */
export function ragsLeftAtPort(state: GameState): number {
  const taken = state.ragsRound === state.currentRound ? state.ragsTaken : 0;
  return Math.max(0, ragsAtPort(state) - Math.max(0, taken));
}

/**
 * One rag at the scrap it is worth when a garment wears through. The path
 * is checked here as well as in the panel, because a rule that lived only
 * in a button could be pressed through by a doctored client. Room comes
 * from cargoRoom, so a rag takes a slot like any cargo.
 */
export function buyRag(state: GameState, logs: LedgerLine[]): boolean {
  if (!refitsOn(state.mode)) return false;
  if (state.path !== REFIT_SELLER_PATH) {
    logs.push(line("❌ Only a Loom captain buys rags off the harbor pile."));
    return false;
  }
  const left = ragsLeftAtPort(state);
  if (left < 1) {
    logs.push(line("❌ The harbor has no rags left for you this round."));
    return false;
  }
  if (getOwnedAmount(state, "Gold") < RAG_SCRAP_VALUE) {
    logs.push(
      line("❌ {RAG_SCRAP_VALUE} Gold buys a rag, and the purse is short.", {
        RAG_SCRAP_VALUE,
      }),
    );
    return false;
  }
  if (cargoRoom(state) < 1) {
    logs.push(line("❌ There is no room in the hold for another rag."));
    return false;
  }
  addOwnedAmount(state, "Gold", -RAG_SCRAP_VALUE);
  state.inventory[RAGS] = (state.inventory[RAGS] ?? 0) + 1;
  state.ragsBought += 1;
  if (state.ragsRound !== state.currentRound) {
    state.ragsRound = state.currentRound;
    state.ragsTaken = 0;
  }
  state.ragsTaken += 1;
  logs.push(
    line(
      "{ICONS.Rags} Bought a rag off the harbor pile for {RAG_SCRAP_VALUE} Gold. {scrapsLeft} left for you this round.",
      {
        "ICONS.Rags": ICONS.Rags,
        RAG_SCRAP_VALUE,
        scrapsLeft: left - 1,
      },
    ),
  );
  return true;
}

/**
 * Rags back into cloth. The hold's room is deliberately unchecked: the
 * rags are already aboard and the coat takes less space, so refusing for
 * room would refuse to make room.
 */
export function reweaveRags(state: GameState, logs: LedgerLine[]): boolean {
  if (!refitsOn(state.mode)) return false;
  if (state.path !== REFIT_SELLER_PATH) {
    logs.push(
      line("❌ Only a Loom captain knows how to work rags back into cloth."),
    );
    return false;
  }
  if ((state.inventory[RAGS] ?? 0) < REWEAVE_RAGS) {
    logs.push(
      line("❌ A reweave takes {REWEAVE_RAGS} rags and the hold has fewer.", {
        REWEAVE_RAGS,
      }),
    );
    return false;
  }
  state.inventory[RAGS] -= REWEAVE_RAGS;
  state.inventory[REWEAVE_GOOD] = (state.inventory[REWEAVE_GOOD] ?? 0) + 1;
  state.ragsRewoven += 1;
  logs.push(
    line(
      "🧵 {REWEAVE_RAGS} rags go back on the loom and come off as one {REWEAVE_GOOD}.",
      { REWEAVE_RAGS, REWEAVE_GOOD: line(REWEAVE_GOOD) },
    ),
  );
  return true;
}

/**
 * The port mend: one point for five Gold, once a round, open to every path.
 * This is the baseline the refit is priced against. Charged only for work
 * that happened; a whole garment is refused rather than sold.
 */
export function mendGarment(
  state: GameState,
  good: unknown,
  logs: LedgerLine[],
): boolean {
  if (!refitsOn(state.mode)) return false;
  const spec = garmentSpec(good);
  if (!spec || typeof good !== "string") {
    logs.push(line("❌ That is not something the harbor can put right."));
    return false;
  }
  if (state.mendRound === state.currentRound) {
    logs.push(
      line("❌ The harbor tailors have already worked on the crew this round."),
    );
    return false;
  }
  if (garmentRoom(state, good) < 1) {
    logs.push(
      line("❌ The crew is wearing no worn {good} for the harbor to mend.", {
        good: line(good),
      }),
    );
    return false;
  }
  if (getOwnedAmount(state, "Gold") < MEND_GOLD_PER_POINT) {
    logs.push(
      line(
        "❌ A mend costs {MEND_GOLD_PER_POINT} Gold and the purse is short.",
        {
          MEND_GOLD_PER_POINT,
        },
      ),
    );
    return false;
  }
  const back = restoreGarment(state, good, MEND_POINTS, logs);
  if (back < 1) return false;
  addOwnedAmount(state, "Gold", -MEND_GOLD_PER_POINT);
  state.mendsMade += 1;
  state.mendRound = state.currentRound;
  logs.push(
    line(
      "{ICONS.Rags} The harbor tailor takes {MEND_GOLD_PER_POINT} Gold for {back} point of the {good}.",
      {
        "ICONS.Rags": ICONS.Rags,
        MEND_GOLD_PER_POINT,
        back,
        good: line(good),
      },
    ),
  );
  return true;
}

/** Applies this captain's side of a refit through the shared settlement. */
export function applyRefitSide(
  state: GameState,
  contract: RefitContract,
  meId: string,
  logs: LedgerLine[],
): boolean {
  return settleConsentTrade(state, logs, {
    on: refitsOn,
    status: "agreed",
    row: contract,
    meId,
    counters: {
      bought: "refitsBought",
      feesPaid: "refitFeesPaid",
      sold: "refitsSold",
      feesEarned: "refitFeesEarned",
    },
    copy: {
      buyer: (paid) =>
        line(
          "🤝 Refit: paid {paid} Gold to {seller} for the {good} to be put right.",
          {
            paid,
            seller: contract.sellerName,
            good: line(contract.good),
          },
        ),
      seller: (fee) =>
        line(
          "🤝 Refit: {buyer} paid {fee} Gold for the {good} to be put right.",
          {
            buyer: contract.buyerName ?? line("A captain"),
            fee,
            good: line(contract.good),
          },
        ),
    },
    onBuy: (state, logs) => {
      // The customer's own garment, put right by the customer's own machine.
      const back = restoreGarment(state, contract.good, REFIT_POINTS, logs);
      if (back < 1) {
        // Reachable only if the garment left the wardrobe between the offer
        // and this call. The fee stands as moved: the seller's machine has
        // already banked its side, so the two saves cannot unpay it.
        logs.push(
          line("❌ There is no worn {contract.good} left to work on.", {
            "contract.good": line(contract.good),
          }),
        );
      }
    },
  });
}

/**
 * Heals the tallies at the load site. The two stamps heal to zero, a round
 * no voyage has, so the first round after loading is fresh.
 */
export function normalizeRefitState(state: GameState): void {
  floorTallies(state, [
    "refitsSold",
    "refitsBought",
    "refitFeesEarned",
    "refitFeesPaid",
    "mendsMade",
    "ragsBought",
    "ragsRewoven",
    "ragsTaken",
  ]);
  state.mendRound = wholeStamp(state.mendRound);
  state.ragsRound = wholeStamp(state.ragsRound);
}

// One record, shared by both ends of the wire (see src/types/realtime).
export type RefitContract = ConsentTerms & {
  status: "offered" | "agreed";
  // The garment being worked on. The points are not on the row: a refit is
  // REFIT_POINTS of work, and a field with one possible value would be a
  // second place to write the number.
  good: string;
};
