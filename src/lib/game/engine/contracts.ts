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
import {
  CONVOY_RAID_COVERAGE,
  ESCORT_CONTRACT_FEE_MAX,
  ESCORT_CONTRACT_FEE_MIN,
} from "../constants";
import { escortContractsOn } from "../flags";
import type { PathId } from "../paths";
import type { EscortClaim, EscortCover, GameState, Phase } from "../types";
import { addOwnedAmount, getOwnedAmount } from "./core";

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
export function canSellEscort(state: Pick<GameState, "path">): boolean {
  return escortContractsOn() && state.path === ESCORT_SELLER_PATH;
}

/**
 * A fee as the board will accept it, or null where the value cannot be one.
 *
 * One reader for the two places a fee arrives from outside this module, the
 * form a seller types into and the payload a socket delivers, so the board
 * and the server cannot disagree about what a fee is. A value that is not a
 * number at all, or that lands outside the bounds in ../constants, answers
 * null rather than being clamped: a fee somebody typed wrong is not the fee
 * they meant, and quietly charging a different one is the one behaviour a
 * market cannot have. A fraction is floored instead, because Gold is
 * counted in whole coins and a form that hands back a value a hair over the
 * number somebody typed is a form, not a cheat.
 */
export function escortFeeFor(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const fee = Math.floor(value);
  if (fee < ESCORT_CONTRACT_FEE_MIN || fee > ESCORT_CONTRACT_FEE_MAX) {
    return null;
  }
  return fee;
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
  state: Pick<GameState, "escortCover">,
): EscortCover | null {
  return escortContractsOn() ? state.escortCover : null;
}

/**
 * The mirror a captain's own board answer turns into, or null where nothing
 * covers them this leg.
 *
 * The rules read here rather than in the component so there is one place
 * that decides what covering means: the contract must be past the offer
 * stage (an offer nobody took protects nobody), it must name this captain as
 * the buyer, and it must be the round the voyage is standing in, because a
 * contract covers one leg and a board that lags a checkpoint must not
 * protect the wrong one. A captain who somehow reads as the buyer of two
 * contracts takes the first, which the server's own rule makes unreachable.
 */
export function coverFromBoard(
  contracts: EscortContract[],
  userId: string,
  round: number,
): EscortCover | null {
  for (const contract of contracts) {
    if (contract.status === "offered") continue;
    if (contract.buyerUserId !== userId || contract.round !== round) continue;
    return { contractId: contract.id, sellerName: contract.sellerName };
  }
  return null;
}

/**
 * Whether this captain is already the buyer of a contract for the round.
 *
 * One buyer's cover is one field, so a captain takes one escort a leg: the
 * server refuses a second accept on this reading, and the board hides the
 * accept on an offer when it is true. Nothing caps the selling side, which
 * is the plan's own shape ("contracts sold per leg per Convoy captain" is a
 * number it expects to move), and a seller who writes three contracts wears
 * three claims, which is the risk the path is priced on.
 */
export function escortBuyerBusy(
  contracts: EscortContract[],
  userId: string,
  round: number,
): boolean {
  return contracts.some(
    (c) =>
      c.status !== "offered" && c.buyerUserId === userId && c.round === round,
  );
}

// =====================================================================
// The board's own rules, kept pure and here rather than in the server
// module, for the reason ./convoy.ts split the venture's arithmetic out of
// the socket closures: a rule that only exists inside a live server cannot
// be tested, and these three decide who sees what, what an expiry takes
// away, and what an accept consumes.
// =====================================================================

/**
 * The board as one captain should see it, both which rows and what they say.
 *
 * An open offer is the market and everyone sees it. A direct offer is
 * addressed to one captain and is visible only to its two parties, the same
 * privacy the barter board gives a targeted offer. An agreed or claimed
 * contract is public: the price was agreed in the open and the claim is the
 * record the plan wants the table to be able to read, so both are shown to
 * everyone rather than to the pair alone.
 *
 * What is public about a claimed contract is that it was claimed, not what
 * it cost. `raidGold` is the covered captain's own report of what a raid
 * would have taken, and it is carried on the board for one reader: the
 * seller, who is the captain the number turns into a bill. Everyone else
 * reads the row without it, which is a filtering rule rather than a field
 * the wire leaves out, so a client that asked for the board directly reads
 * the same row the broadcast carried.
 */
export function visibleContracts(
  contracts: EscortContract[],
  userId: string,
): EscortContract[] {
  return contracts
    .filter(
      (c) =>
        c.status !== "offered" ||
        c.buyerUserId === null ||
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
 * The board after the voyage moves, which is what makes an offer an offer
 * rather than a standing promise.
 *
 * Two expiries and one rule each. An offer lives in the Parley it was
 * posted in, because the plan's own sentence is that everything offered in
 * Parley is binding once both parties accept, and an offer nobody accepted
 * before the phase closed is not binding on anyone. An agreed contract
 * lives exactly one leg, which is the round it was made in, so the round it
 * no longer matches is what takes it off the board. Read as a pure function
 * of the list and the checkpoint so the suite can hold both boundaries
 * without a server.
 */
export function expireContracts(
  contracts: EscortContract[],
  standing: { phase: Phase; round: number },
): EscortContract[] {
  return contracts.filter(
    (c) =>
      c.round === standing.round &&
      !(c.status === "offered" && standing.phase !== "parley"),
  );
}

/**
 * Whether this seller already has an offer standing for this buyer.
 *
 * One open offer per seller per buyer, where an open offer counts as its
 * own buyer: a seller who is selling to anyone has already said that, and a
 * second identical row would only be a second way to take the same cover.
 * The rule is the board's bound as well as its tidiness. Nothing else caps
 * how many contracts a board can hold, and a post costs no escrow the way a
 * barter offer does, so without this a single client could paper the room.
 * With it, a seller's rows are bounded by the table: one open offer and one
 * named offer per other captain, which is the most a market of N captains
 * can mean anything by.
 */
export function escortOfferStanding(
  contracts: EscortContract[],
  sellerUserId: string,
  buyerUserId: string | null,
): boolean {
  return contracts.some(
    (c) =>
      c.status === "offered" &&
      c.sellerUserId === sellerUserId &&
      c.buyerUserId === buyerUserId,
  );
}

/**
 * The board after a captain accepts an offer.
 *
 * Accepting writes the buyer onto the contract and moves it to agreed, and
 * takes every other open offer that named this captain as its buyer off the
 * board in the same pass. That sweep is the one buyer rule above seen from
 * the other side: a captain whose cover is one field cannot take two, and an
 * offer they can no longer take would otherwise sit on the board inviting a
 * second accept the server would have to refuse.
 */
export function agreeContract(
  contracts: EscortContract[],
  contractId: string,
  buyer: { userId: string; name: string },
): EscortContract[] {
  return contracts
    .filter(
      (c) =>
        c.id === contractId ||
        !(c.status === "offered" && c.buyerUserId === buyer.userId),
    )
    .map((c) =>
      c.id === contractId
        ? {
            ...c,
            status: "agreed" as const,
            buyerUserId: buyer.userId,
            buyerName: buyer.name,
          }
        : c,
    );
}

// =====================================================================
// The settlement rule: what a contract does to a purse, applied by the
// captain whose purse it is.
// =====================================================================

/**
 * Whether this movement has already been applied, read through the leg
 * stamp.
 *
 * A ledger left over from an earlier leg answers for nothing: the keys are
 * contract ids, a leg's contracts are off the board by the next Dawn, and a
 * list that only ever grows is weight in every save the voyage writes. The
 * stamp is what lets the list be emptied at each roll without ever losing a
 * movement that has not settled yet, since both of a contract's movements
 * land in the leg it was agreed in.
 */
function alreadySettled(state: GameState, key: string): boolean {
  return (
    state.escortSettledRound === state.currentRound &&
    state.escortSettled.includes(key)
  );
}

/** Records a movement as applied, on this leg's ledger. */
function markSettled(state: GameState, key: string): void {
  if (state.escortSettledRound !== state.currentRound) {
    state.escortSettled = [];
    state.escortSettledRound = state.currentRound;
  }
  state.escortSettled = [...state.escortSettled, key];
}

/**
 * The leg's contract facts, cleared where every other per leg fact is
 * cleared (startBoonDrafting, see the call there).
 *
 * Three things go, and each would be a lie if it stayed. The cover belongs
 * to one leg, so a captain carried into the next one still wearing it would
 * be protected by a contract that has expired. A pending claim is a raid
 * that already happened, so relaying it a leg late would ask a seller to
 * absorb a boarding party the board no longer remembers. And the ledger,
 * once the stamp says it is a leg old, is only weight. The stamp itself is
 * written rather than left alone, so the list is emptied here rather than at
 * the next settle, which is what keeps the saving small on a voyage where
 * nothing more is sold.
 */
export function resetEscortLeg(state: GameState): void {
  state.escortCover = null;
  state.pendingEscortClaim = null;
  state.escortSettled = [];
  state.escortSettledRound = state.currentRound;
}

/**
 * Applies this captain's side of a contract, once.
 *
 * One function for both sides and both moments, because the four cases
 * (buyer's fee, seller's fee, seller's absorbed raid, and the immaterial
 * fourth) differ in three numbers and agree on everything else: who they
 * are, whether the movement has already been applied, and the rule that
 * only the holder of a purse writes to it. The ledger is the idempotence:
 * a reload between the agreement and the claim, or between the claim and
 * the broadcast that carries it, must not move the same Gold twice, so
 * every applied movement is recorded as "id:fee" or "id:claim" and a
 * second call with the same key does nothing.
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
  if (!escortContractsOn()) return false;
  const isSeller = contract.sellerUserId === meId;
  const isBuyer = contract.buyerUserId === meId;
  if (!isSeller && !isBuyer) return false;

  if (contract.status === "agreed") {
    const key = `${contract.id}:fee`;
    if (alreadySettled(state, key)) return false;
    if (isBuyer) {
      // The hire that was agreed in the market, paid at once, and paid by a
      // purse that is allowed to be empty: the buyer's accept was guarded by
      // their own balance, so a shortfall here is a purse that moved between
      // the two, and the honest answer is the Gold that is actually there
      // rather than a negative hold. The seller credits the price that was
      // agreed, because the price, not the payment, is what the two captains
      // shook hands on.
      const paid = Math.max(
        0,
        Math.min(contract.fee, getOwnedAmount(state, "Gold")),
      );
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
    markSettled(state, key);
    return true;
  }

  if (contract.status === "claimed" && isSeller) {
    const key = `${contract.id}:claim`;
    if (alreadySettled(state, key)) return false;
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
    markSettled(state, key);
    return true;
  }

  return false;
}

/**
 * Heals the mirror and the ledger at the load site, the way every other
 * field this build added is healed: a save written before this feature, or
 * by a build that spelled one of these shapes differently, reads as a
 * captain with nothing bought, nothing sold and nothing owed rather than as
 * one whose next raid roll throws.
 *
 * The tallies are floored and rounded because they are counts and sums of
 * Gold, and the ledger is filtered to strings because it is compared by
 * value: a number in that list would simply never match and would silently
 * re-apply a movement.
 */
export function normalizeEscortState(state: GameState): void {
  const counts = [
    "escortSold",
    "escortBought",
    "escortFeesEarned",
    "escortFeesPaid",
    "escortClaims",
    "escortAbsorbed",
  ] as const;
  for (const field of counts) {
    const value = state[field];
    state[field] =
      typeof value === "number" && Number.isFinite(value)
        ? Math.max(0, Math.floor(value))
        : 0;
  }
  state.escortSettled = Array.isArray(state.escortSettled)
    ? state.escortSettled.filter((key) => typeof key === "string")
    : [];
  state.escortSettledRound =
    typeof state.escortSettledRound === "number" &&
    Number.isFinite(state.escortSettledRound)
      ? Math.max(0, Math.floor(state.escortSettledRound))
      : 0;
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
export type EscortContract = {
  id: string;
  sellerUserId: string;
  sellerName: string;
  // Null on an open offer, which any captain but the seller may take.
  buyerUserId: string | null;
  buyerName: string | null;
  fee: number;
  // The leg the contract was made for. An agreed contract protects the
  // round it was agreed in and is off the board the moment the voyage
  // stands in a later one.
  round: number;
  status: "offered" | "agreed" | "claimed";
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
