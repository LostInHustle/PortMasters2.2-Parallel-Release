// The escort contract: one captain sells another a round of protection.
//
// The board itself is harbor state (src/server/realtime/contracts); what
// lives here is the reading. applyEscortSide applies each captain's side to
// their own state and nobody else's, the model this codebase follows for
// cross captain money. escortCoverOf is a mirror of the board, not a copy:
// it answers null the moment the contract leaves the board.
//
// Fees, expiry, the offer bounds and the settlement ledger belong to the
// consent primitive (see ./consent). The fee does not feed
// peerTradeProfit in ./barter; an escort premium is a different
// institution, and the contract's own tally counts its coin.
import { line, type LedgerLine } from "@/lib/game/ledger";
import { CONVOY_RAID_COVERAGE } from "../constants/paths";
import { escortContractsOn } from "../flags";
import type { PathId } from "../paths";
import type { EscortClaim, EscortCover, GameState } from "../types";
import {
  consentSettled,
  floorTallies,
  markMovement,
  movementApplied,
  visibleConsent,
  type ConsentTerms,
} from "./consent";
import { addOwnedAmount, getOwnedAmount } from "./core";
import { settleConsentTrade } from "./settlement";

/** The path whose ability is the escort market. */
export const ESCORT_SELLER_PATH: PathId = "convoy";

/**
 * Switch first, then path: the flag is the operator's rollback and the
 * path is the captain's identity.
 */
export function canSellEscort(
  state: Pick<GameState, "path" | "mode">,
): boolean {
  return escortContractsOn(state.mode) && state.path === ESCORT_SELLER_PATH;
}

/**
 * The share of a raid the guns beat off: one number for the engine and the
 * panels.
 */
export function escortCoverage(): number {
  return CONVOY_RAID_COVERAGE;
}

/**
 * What is left for the escort to eat, spent as one subtraction. The raid's
 * Gold is the covered captain's hold at the moment of the raid, so the
 * share the guns beat off comes out of it. Floored, and a non-finite
 * payload reads as zero.
 *
 * Private: the only caller is the seller's side of a claim below, and the
 * panels quote escortCoverage instead.
 */
function escortEats(raidGold: number): number {
  if (!Number.isFinite(raidGold)) return 0;
  const took = Math.max(0, Math.floor(raidGold));
  return Math.max(0, took - Math.floor(took * escortCoverage()));
}

/**
 * The cover a raid roll consults, read through the switch. The mirror is
 * set from the harbor's board by the client layer and cleared with the
 * round, so the engine asks one field and never the network. With the
 * switch off the answer is null whatever the field says.
 */
export function escortCoverOf(
  state: Pick<GameState, "escortCover" | "mode">,
): EscortCover | null {
  return escortContractsOn(state.mode) ? state.escortCover : null;
}

/**
 * The mirror a board answer turns into. The contract must be settled (see
 * consentSettled: an offer nobody took protects nobody), name this captain
 * as buyer, and be for the current round. A captain who reads as buyer of
 * two contracts takes the first; the server makes that unreachable.
 */
export function coverFromBoard(
  contracts: EscortContract[],
  userId: string,
  round: number,
): EscortCover | null {
  for (const contract of contracts) {
    if (!consentSettled(contract.status)) continue;
    if (contract.buyerUserId !== userId || contract.round !== round) continue;
    return { contractId: contract.id, sellerName: contract.sellerName };
  }
  return null;
}

/**
 * The board as one captain should see it. Declined rows stay visible only
 * to the two captains they name, so a refusal is not public. raidGold is
 * the buyer's own report and is redacted for everyone but the seller; the
 * filter is applied here rather than left off the wire, so a direct board
 * read sees the same row.
 */
export function visibleContracts(
  contracts: EscortContract[],
  userId: string,
): EscortContract[] {
  return visibleConsent(contracts, userId)
    .filter(
      (c) =>
        c.status !== "declined" ||
        c.buyerUserId === userId ||
        c.sellerUserId === userId,
    )
    .map((c) =>
      c.raidGold === undefined || c.sellerUserId === userId
        ? c
        : { ...c, raidGold: undefined },
    );
}

/**
 * Clears the round's contract facts: cover belongs to one round, and a pending
 * claim is a raid that already happened. The consent ledger is emptied
 * beside this call by the primitive.
 */
export function resetEscortRound(state: GameState): void {
  state.escortCover = null;
  state.pendingEscortClaim = null;
}

/**
 * Applies this captain's side of a contract, once. The fee settles through
 * the shared skeleton; the claim is the escort's own. The consent ledger
 * is the idempotence for both: every applied movement is keyed "id:fee"
 * or "id:claim", so a reload cannot move the same Gold twice. Returns
 * whether state changed.
 */
export function applyEscortSide(
  state: GameState,
  contract: EscortContract,
  meId: string,
  logs: LedgerLine[],
): boolean {
  // Read here as well as inside the settlement, because the claim below is
  // this function's own.
  if (!escortContractsOn(state.mode)) return false;
  const isSeller = contract.sellerUserId === meId;
  const isBuyer = contract.buyerUserId === meId;
  if (!isSeller && !isBuyer) return false;

  if (contract.status === "agreed") {
    return settleConsentTrade(state, logs, {
      on: escortContractsOn,
      status: "agreed",
      row: contract,
      meId,
      counters: {
        bought: "escortBought",
        feesPaid: "escortFeesPaid",
        sold: "escortSold",
        feesEarned: "escortFeesEarned",
      },
      copy: {
        buyer: (paid) =>
          line(
            "🤝 Escort contract: paid {paid} Gold to {contract.sellerName} for one round of protection.",
            { paid, "contract.sellerName": contract.sellerName },
          ),
        seller: (fee) =>
          line(
            "🤝 Escort contract: {buyerName} paid {contract.fee} Gold for one round of protection.",
            {
              buyerName: contract.buyerName ?? line("A captain"),
              "contract.fee": fee,
            },
          ),
      },
    });
  }

  if (contract.status === "claimed" && isSeller) {
    const key = `${contract.id}:claim`;
    if (movementApplied(state, key)) return false;
    const ate = Math.max(
      0,
      Math.min(
        escortEats(contract.raidGold ?? 0),
        getOwnedAmount(state, "Gold"),
      ),
    );
    addOwnedAmount(state, "Gold", -ate);
    state.escortClaims += 1;
    state.escortAbsorbed += ate;
    // The fallback phrase is held as material like every other name, so it
    // reads in the language of whoever opens the ledger.
    const who = contract.buyerName ?? line("a captain");
    logs.push(
      ate > 0
        ? line(
            "🛡️ Raiders meant for {who} met your guns: your hold lost {ate} Gold.",
            {
              who,
              ate,
            },
          )
        : line(
            "🛡️ Raiders meant for {who} met your guns and found your hold already bare.",
            { who },
          ),
    );
    markMovement(state, key);
    return true;
  }

  return false;
}

/**
 * Heals the tallies and the mirror at load. Tallies go through
 * floorTallies because a NaN tally is read as forged by the Ledger
 * Integrity Pass. The mirror and pending claim are kept only in a shape a
 * reader can trust.
 */
export function normalizeEscortState(state: GameState): void {
  floorTallies(state, [
    "escortSold",
    "escortBought",
    "escortFeesEarned",
    "escortFeesPaid",
    "escortClaims",
    "escortAbsorbed",
  ]);
  state.escortCover =
    state.escortCover &&
    typeof state.escortCover.contractId === "string" &&
    typeof state.escortCover.sellerName === "string"
      ? state.escortCover
      : null;
  state.pendingEscortClaim =
    state.pendingEscortClaim &&
    typeof state.pendingEscortClaim.contractId === "string" &&
    Number.isFinite(state.pendingEscortClaim.raidGold)
      ? state.pendingEscortClaim
      : null;
}

// One record, shared by both ends of the wire (see src/types/realtime).
export type EscortContract = ConsentTerms & {
  // Four states. A decline is kept rather than deleted so the seller can
  // tell a refusal from a row the board lost; it settles nothing.
  status: "offered" | "agreed" | "claimed" | "declined";
  // What a raid would have taken from the covered captain, carried on the
  // claim so the seller can price what it eats.
  raidGold?: number;
};

/**
 * The claim a covered raid leaves for the React layer to relay. A raid
 * that would have taken nothing raises no claim. Whole coins, floored.
 */
export function escortClaimFrom(
  cover: EscortCover,
  raidGold: number,
): EscortClaim | null {
  return raidGold > 0
    ? { contractId: cover.contractId, raidGold: Math.floor(raidGold) }
    : null;
}
