// =====================================================================
// PortMasters 2.2 Parallel Release: the escort contract.
//
// [D3: Convoy: the Escort Contract] One captain sells another a single leg
// of protection at a price they both agree, and this module is everything
// the agreement means on a captain's own machine. The board itself is room
// state (src/server/realtime/contracts), because an agreement between two
// captains is an object no single client can be the authority over; what
// lives here is the reading of it, in three parts.
//
// The first part is who may sell, which is one line and one reading of the
// path record: a captain holding the Convoy path sells protection, the
// same way D2 reads a locked order off the good it demands rather than off
// a label written on a card. Nothing in this module names the path twice.
//
// The second part is what the contract does to a purse, and it is one
// function, applyEscortSide, because a contract has two sides and both of
// them run the same code: the fee moves when the two captains agree (the
// plan's "contracts pay first"), and the absorbed raid moves when the
// covered captain reports one, and each movement is applied by each
// captain to their own state and to nobody else's. That is the tree's
// standing model for cross captain money, the same one bartering and loans
// run on (see ./barter and ./aid): the server brokers the agreement and
// relays the claim, and a purse is only ever touched by its owner.
//
// The third part is the cover the raid roll consults, which is a mirror of
// the board rather than a copy of it: escortCoverOf answers null the
// moment the contract leaves the board, so a seller who walked out takes
// their guns with them rather than leaving a promise behind.
//
// Everything else an agreement is made of is not this module's any more.
// What a fee may be, which rows a captain sees, when an offer expires, the
// one offer per seller per buyer bound, the accept that sweeps the rest,
// and the ledger that keeps a reload from moving the same Gold twice are
// the consent primitive D4's refit shares (see ./consent), and the server
// reads them from there rather than through a second name here.
//
// Two things are deliberately outside this module's reach and worth saying
// here so the next reader does not go looking for them. The fee does not
// reach peerTradeProfit in ./barter, because that ledger is the barter
// ledger by the plan's own account of the Broker, and an escort premium is
// a different institution; the contract's own tally is where its coin is
// counted. And nothing here is persisted: the plan asks for contracts to
// be transient room state, so the only thing a save carries is the tally
// of what already happened and the ledger of movements already applied,
// both of which are records rather than agreements.
// =====================================================================
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
import { addOwnedAmount, getOwnedAmount, paidFee } from "./core";

/**
 * The path whose ability is the escort market, as a reading of the record
 * rather than a second name for it. The panel reads the crest and the name
 * off this id through pathConfig, the same way the order board reads the
 * crest of a locked card off pathOrderOf, and the ability question below is
 * the only place the id itself is spent.
 */
export const ESCORT_SELLER_PATH: PathId = "convoy";

/**
 * Whether this captain may sell protection.
 *
 * The switch is read first and separately from the path, because the two
 * answer different questions: the flag is the operator's rollback and the
 * path is the captain's identity, and a build with the feature off must
 * refuse a Convoy captain as flatly as it refuses everyone else.
 */
export function canSellEscort(
  state: Pick<GameState, "path" | "mode">,
): boolean {
  return escortContractsOn(state.mode) && state.path === ESCORT_SELLER_PATH;
}

/**
 * The share of a raid the guns beat off: the one number the subtraction
 * below and the two panels that quote the odds both read.
 *
 * Read from ../constants rather than written twice, because it is priced
 * against the cannon slots that sit beside it there.
 */
export function escortCoverage(): number {
  return CONVOY_RAID_COVERAGE;
}

/**
 * What is left for the escort to eat: the plan's "your cannons decide how
 * much you actually eat", spent as one subtraction.
 *
 * The raid's Gold is the covered captain's own hold at the moment the
 * raiders arrived, which is what the raid would have taken, so the share
 * the guns beat off comes out of it and the escort owes the rest. Floored,
 * because a fraction of a Gold coin is not a loss anybody can pay, and
 * floored again at zero so a payload that is not a number here costs the
 * escort nothing rather than a NaN.
 *
 * Private to this module rather than exported like its siblings: its one
 * caller is the seller's side of a claim in applyEscortSide below, and the
 * panels that quote the arithmetic quote escortCoverage above instead, so
 * nothing outside this file reads the name. It is written out rather than
 * folded into that caller because the room's board module names it in prose
 * when it explains where a claim is priced (see src/server/realtime/
 * contracts.ts), and a reader following that sentence should land on a
 * described rule.
 */
function escortEats(raidGold: number): number {
  if (!Number.isFinite(raidGold)) return 0;
  const took = Math.max(0, Math.floor(raidGold));
  return Math.max(0, took - Math.floor(took * escortCoverage()));
}

/**
 * The cover this captain's raid roll consults, read through the switch.
 *
 * Deliberately a plain read of the mirror rather than a lookup: the mirror
 * is set by the client layer from the room's board (see use-escort-contracts)
 * and cleared with the round, so the engine asks one field and never the
 * network. With the switch off the answer is null whatever the field says,
 * which is what makes the rollback clean at the moment a raid is rolled
 * rather than only at the moment a contract is posted.
 */
export function escortCoverOf(
  state: Pick<GameState, "escortCover" | "mode">,
): EscortCover | null {
  return escortContractsOn(state.mode) ? state.escortCover : null;
}

/**
 * The mirror a captain's own board answer turns into, or null where nothing
 * covers them this leg.
 *
 * The rules read here rather than in the component so there is one place
 * that decides what covering means: the contract must be one the two
 * captains actually shook hands on, it must name this captain as the buyer,
 * and it must be the round the voyage is standing in, because a contract
 * covers one leg and a board that lags a checkpoint must not protect the
 * wrong one. A captain who somehow reads as the buyer of two contracts
 * takes the first, which the server's own rule makes unreachable.
 *
 * The status test asks the primitive whether the row settled rather than
 * ruling the offer out here, which is what it used to read and what a third
 * status silently broke: an offer nobody took protects nobody, and an offer
 * its addressee turned down protects nobody either, while both of those
 * rows name a captain as the buyer and would otherwise have been read as
 * cover by a test that only ruled out the offer (see consentSettled in
 * ./consent).
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
 * The board as one captain should see it: which rows, and then what one of
 * them says.
 *
 * The rows come from the shared primitive, which is where the privacy rule
 * lives (see visibleConsent in ./consent). What this adds is the two things
 * only an escort answers for.
 *
 * The first is the aim a turned down offer still wears. The primitive makes
 * everything past the offer stage public, which is right for an agreement:
 * the price was agreed in the open. A refusal was not, and it is the one
 * row that would hand the table what a private offer is for, since a
 * seller asked one captain a price and that captain said no. The row is
 * kept rather than deleted so the seller reads what came back instead of
 * reading nothing (see the withdrawn note in src/server/realtime/wiring/
 * escort-contracts.ts), and it is kept for the two captains it names,
 * which is the shape the aimed offer had in the first place.
 *
 * The second is the one field the escort carries that is not public:
 * `raidGold` is the covered captain's own report of what a raid would have
 * taken, and it is on the board for one reader, the seller, who is the
 * captain the number turns into a bill. Everyone else, the buyer included,
 * reads the row without it. That is a filtering rule rather than a field
 * the wire leaves out, so a client that asked for the board directly reads
 * the same row the broadcast carried.
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

/* The board's other rules are the primitive's, and the escort no
   longer names them: the expiry, the one offer per seller per buyer bound
   and the accept that sweeps the rest are the same rules for both kinds, so
   they are read from ./consent by the server and by the panels rather than
   forwarded from here. What stays in this file is what only an escort can
   answer: who may sell, what a contract does to a purse, which side of this
   market is bounded to one agreement a leg (the buyer's, because one
   captain's cover is one field), whether a buyer can pay the fee at all,
   and which rows carry a number the rest of the table must not read. A
   wrapper for each of the rest would be a second name for one rule, which
   is the thing this tree deletes rather than writes. */

// =====================================================================
// The settlement rule: what a contract does to a purse, applied by the
// captain whose purse it is.
// =====================================================================

/**
 * The leg's contract facts, cleared where every other per leg fact is
 * cleared (startBoonDrafting, see the call there).
 *
 * Two things go, and each would be a lie if it stayed. The cover belongs to
 * one leg, so a captain carried into the next one still wearing it would be
 * protected by a contract that has expired. A pending claim is a raid that
 * already happened, so relaying it a leg late would ask a seller to absorb a
 * boarding party the board no longer remembers. The ledger this used to
 * clear is not here any more, because it is not the escort's: it belongs to
 * the consent primitive and is emptied beside this call (see
 * resetConsentLedger in ./consent).
 */
export function resetEscortLeg(state: GameState): void {
  state.escortCover = null;
  state.pendingEscortClaim = null;
}

/**
 * Applies this captain's side of a contract, once.
 *
 * One function for both sides and both moments, because the four cases
 * (buyer's fee, seller's fee, seller's absorbed raid, and the immaterial
 * fourth) differ in three numbers and agree on everything else: who they
 * are, whether the movement has already been applied, and the rule that
 * only the holder of a purse writes to it. The fourth case is any row that
 * moved no Gold, which is a row somebody is reading about somebody else and
 * a row that was turned down, and it falls through to false without a
 * branch of its own because there is nothing to apply and nothing to say.
 * The ledger is the idempotence: a reload between the agreement and the
 * claim, or between the claim and the broadcast that carries it, must not
 * move the same Gold twice, so every applied movement is recorded as
 * "id:fee" or "id:claim" and a second call with the same key does nothing.
 *
 * Returns whether the state changed, which is what the React layer uses to
 * decide whether it owes the captain a re-render rather than to read the
 * ledger itself.
 */
export function applyEscortSide(
  state: GameState,
  contract: EscortContract,
  meId: string,
  logs: string[],
): boolean {
  if (!escortContractsOn(state.mode)) return false;
  const isSeller = contract.sellerUserId === meId;
  const isBuyer = contract.buyerUserId === meId;
  if (!isSeller && !isBuyer) return false;

  if (contract.status === "agreed") {
    const key = `${contract.id}:fee`;
    if (movementApplied(state, key)) return false;
    if (isBuyer) {
      // The hire that was agreed in the market, paid at once, and paid by a
      // purse that is allowed to be empty: the buyer's accept is guarded by
      // their own balance before they press (see canPayFee in ./core, which
      // the panel asks), so a shortfall here is a purse that moved between the
      // press and this line, and the honest answer is the Gold that is
      // actually there rather than a negative hold. The seller credits the
      // price that was agreed, because the price, not the payment, is what
      // the two captains shook hands on.
      const paid = paidFee(state, contract.fee);
      addOwnedAmount(state, "Gold", -paid);
      state.escortBought += 1;
      state.escortFeesPaid += paid;
      logs.push(
        `🤝 Escort contract: paid ${paid} Gold to ${contract.sellerName} for one leg of protection.`,
      );
    } else {
      addOwnedAmount(state, "Gold", contract.fee);
      state.escortSold += 1;
      state.escortFeesEarned += contract.fee;
      logs.push(
        `🤝 Escort contract: ${contract.buyerName ?? "A captain"} paid ${contract.fee} Gold for one leg of protection.`,
      );
    }
    markMovement(state, key);
    return true;
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
    const who = contract.buyerName ?? "a captain";
    logs.push(
      ate > 0
        ? `🛡️ Raiders meant for ${who} met your guns: your hold lost ${ate} Gold.`
        : `🛡️ Raiders meant for ${who} met your guns and found your hold already bare.`,
    );
    markMovement(state, key);
    return true;
  }

  return false;
}

/**
 * Heals the tally and the mirror at the load site, the way every other field
 * this build added is healed: a save written before this feature reads as a
 * captain with nothing bought, nothing sold and nothing owed rather than as
 * one whose next raid roll throws.
 *
 * The tallies are floored and rounded because they are counts and sums of
 * Gold. What is healed beside them but not here is the ledger of movements
 * already applied, which belongs to the consent primitive rather than to
 * this kind and has its own reader (see normalizeConsentLedger in
 * ./consent).
 */
export function normalizeEscortState(state: GameState): void {
  // Through the shared reader rather than a loop of its own, which is what
  // the second copy of this arithmetic always costs: the first one floors a
  // count and the second one forgets the finite check, and a NaN tally is
  // added straight into a captain's score where the Ledger Integrity Pass
  // reads it as forged (see floorTallies).
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

// =====================================================================
// The contract as it travels: one record, declared here because the game
// layer is what both ends of the wire import from (see src/types/realtime,
// which imports this shape rather than declaring a second one).
// =====================================================================
export type EscortContract = ConsentTerms & {
  // Four states, and each one is a different thing for a reader to do: an
  // offer is a price waiting on a press, an agreement is the leg's cover, a
  // claim is that cover spent, and a decline is the offer that came back.
  //
  // The decline is a state rather than a deletion because of what a
  // deletion would say. The seller posted a price and no longer reads it:
  // with the row gone the seller cannot tell a captain who said no from a
  // board that lost their row, and this tree already settled that question
  // one desk over, where a spent mend keeps its row on screen rather than
  // vanishing (see RefitBench). The row stays for the leg it was made in,
  // carries no action for either captain, and settles nothing (see
  // applyEscortSide), which is what makes a turned down offer unable to
  // settle at all rather than merely unlikely to.
  status: "offered" | "agreed" | "claimed" | "declined";
  // The Gold a raid would have taken from the covered captain, carried on
  // the claim so the seller's client can price what it eats.
  raidGold?: number;
};

/**
 * The claim a covered raid leaves on the state for the React layer to
 * relay, or null when there is nothing to relay. A raid that would have
 * taken nothing (an empty hold, a captain who spent out) raises no claim,
 * because a claim of zero Gold is not a loss and would only put a line on
 * the table's board that says an escort saved nothing.
 */
export function escortClaimFrom(
  cover: EscortCover,
  raidGold: number,
): EscortClaim | null {
  return raidGold > 0
    ? { contractId: cover.contractId, raidGold: Math.floor(raidGold) }
    : null;
}
