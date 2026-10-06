// =====================================================================
// PortMasters 2.2 Parallel Release: the Loom's refit.
//
// [D4: Loom: the Refit] The plan hands this path three things and they are
// one trade read from three ends. A Loom captain puts another captain's
// garment right, faster and cheaper than that captain could manage alone.
// The same captain holds the crafting chain, which is the reweave: the
// harbor's pile of rags turns back into clothes in their hands and in
// nobody else's. And the same captain is the only one who may buy that
// pile, which is what makes the first two worth holding.
//
// The refit is the first cross captain mutation in this tree's engine, so
// the authorization question is the one this module is built around, and
// the answer is the plan's own: a mutual acceptance, on the primitive D3's
// escort contract already uses (see ./consent). The Loom offers, the
// customer accepts, and what actually changes the customer's clothes is
// the customer's own client running the same function the mend runs. No
// captain's state is ever written by another captain's machine, which is
// the rule every cross captain movement in this tree follows: the server
// brokers the agreement and the owner applies it.
//
// What is kind specific, and therefore here: the seller is the Loom, the
// term is a good rather than a leg of cover, the effect puts points back
// into a garment, the seller is bounded to one refit a leg because one
// captain can only put one garment right in a leg, and the harbor's own
// pile and its mend are the baseline the refit is priced against.
// =====================================================================
import {
  MEND_GOLD_PER_POINT,
  MEND_POINTS,
  RAGS_AT_PORT_COLD,
  RAG_SCRAP_VALUE,
  REFIT_POINTS,
  REWEAVE_GOOD,
  REWEAVE_RAGS,
} from "../constants/garments";
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
import {
  consentPartyBusy,
  floorTallies,
  markMovement,
  movementApplied,
  type ConsentTerms,
} from "./consent";
import { addOwnedAmount, getOwnedAmount, paidFee } from "./core";

/**
 * The path whose ability is the refit bench, as a reading of the record
 * rather than a second name for it, the same way the escort's seller path
 * is read.
 */
export const REFIT_SELLER_PATH: PathId = "loom";

/**
 * Whether the Loom's bench is open: the refit, the mend and the rag trade.
 *
 * D4's own rollback, and the plan gives the shape of it: "mutual acceptance
 * already exists for contracts, so rollback is removing the Refit action and
 * leaving the consent primitive in place for later use". So the switch takes
 * the bench and leaves the primitive, and with it off no refit can be offered
 * (the server refuses one, see the refit handlers in
 * src/server/realtime/wiring/refits.ts), no board is drawn and none of the
 * three counters does anything: no tailor puts a point back, no rag comes
 * off the pile and nothing is rewoven.
 *
 * It is judged here rather than in ./flags for the reason that module's
 * header gives: it stands on the wardrobe as well as on itself, because a
 * refit is a rule about garments and there is nothing to put right on a table
 * with no clothes layer, and ./garments already reads ./flags. This is the
 * same way ./hold's capacity model stands on the provisions layer.
 *
 * The read is written out in full at this line rather than passed by name,
 * which is the browser's rule and not a taste in signatures: a bundle is
 * handed the values it was built with by a substitution that only matches a
 * read written where it happens (see flagOnFor).
 *
 * The mode joins the chain at the front of it, ahead of this bench's own
 * switch and ahead of the wardrobe it stands on, so a Classic table is
 * answered by the first reading and the other two are never taken.
 */
export function refitsOn(mode: unknown): boolean {
  return (
    flagOnFor(mode, process.env.NEXT_PUBLIC_REFITS) && garmentsLayerOn(mode)
  );
}

/**
 * Whether this captain may sell a refit.
 *
 * The switch is read first and separately from the path, for the reason
 * the escort's own reader gives: the flag is the operator's rollback and
 * the path is the captain's identity, and a build with the feature off must
 * refuse a Loom captain as flatly as it refuses everyone else.
 */
export function canSellRefit(state: Pick<GameState, "path" | "mode">): boolean {
  return refitsOn(state.mode) && state.path === REFIT_SELLER_PATH;
}

/**
 * Whether this Loom captain has already agreed to a refit this leg.
 *
 * The other half of the plan's "one garment a leg", and the side this
 * market bounds is the seller's rather than the buyer's: a customer may buy
 * a refit for every garment they own, and one captain has two hands. The
 * server refuses a second accept on this reading and the board offers the
 * rows that are still workable, which is what keeps a Loom captain from
 * promising more work than a leg holds.
 */
export function refitSellerBusy(
  contracts: RefitContract[],
  userId: string,
  round: number,
): boolean {
  return consentPartyBusy(contracts, "seller", userId, round);
}

/**
 * How many points a refit would put back on this captain's garment, which
 * is what the offer is worth to the customer reading it.
 *
 * The reader the board quotes and the accept is guarded by, taken from the
 * garment arithmetic rather than worked out again here so the number on a
 * row and the number the crew's warmth actually moves by are one number.
 */
export function refitRoomFor(
  state: Pick<GameState, "garments" | "mode">,
  good: unknown,
): number {
  if (!refitsOn(state.mode)) return 0;
  return Math.min(REFIT_POINTS, garmentRoom(state, good));
}

/**
 * The harbor's pile of rags, which is the whole of this path's supply.
 *
 * Drawn rather than stored, and drawn from the voyage's own numbers the way
 * the weather is (see legIsCold in ../garments), so every captain sails
 * past the same pile without the server announcing anything and a reload
 * answers the same way twice. There is no pile after a warm leg, which is
 * the plan's tension written as a number: the legs this trade earns on are
 * the legs it can buy on, so a Loom captain is poor in fair weather and
 * busy in cold, and the measure the plan sets is exactly that variance.
 *
 * What the pile is not is stock anybody can corner. It is the fleet's scrap
 * coming ashore, drawn on each captain's own machine from the voyage's own
 * numbers, so it is what one Loom may take from the quay this leg rather
 * than a shelf that empties: two Loom captains at one table each read the
 * same pile and each take their own share of it. The alternative would be a
 * number two clients cannot see each other's spending of, which is a
 * desynchronization dressed as a shared shelf, and this way the number that
 * bounds the trade is the number both captains can already read.
 */
export function ragsAtPort(
  state: Pick<
    GameState,
    "voyageEpoch" | "mode" | "difficulty" | "currentRound"
  >,
): number {
  if (!refitsOn(state.mode)) return 0;
  // The weather is asked rather than drawn a second time. A pile that
  // rolled its own cold leg would be a second answer to which legs are cold,
  // and the two would agree right up until one of them moved.
  if (!legIsCold(state)) return 0;
  const seed = `${state.voyageEpoch}:${state.mode}:${state.difficulty}:rags:${state.currentRound}`;
  return 1 + Math.floor(createRng(seed)() * RAGS_AT_PORT_COLD);
}

/**
 * What is left of this captain's share of the pile, which is what the bench
 * prints and what the buy below is actually bounded by.
 *
 * The share is per leg and it resets with the leg, so the count from an
 * earlier leg is not subtracted from this one's: a stamp that no longer
 * matches means nothing has been taken yet, which is the reading
 * movementApplied gives its own stamp and the reason a mid leg save needs
 * no heal to be read correctly at the next Dawn.
 */
export function ragsLeftAtPort(state: GameState): number {
  const taken = state.ragsRound === state.currentRound ? state.ragsTaken : 0;
  return Math.max(0, ragsAtPort(state) - Math.max(0, taken));
}

/**
 * Buying one rag off the harbor's pile, at the scrap the same rag is worth
 * when a garment wears through.
 *
 * One at a time, because that is how every other counter in this game sells
 * and how a captain reads a pile of three. The path is checked here as well
 * as in the panel, because this is the function the plan's exclusivity is
 * actually made of: "purchasable only by the Loom path" is this line, and a
 * rule that lived only in a button would be a rule a doctored client could
 * press through.
 *
 * Refused in every other direction too, and each refusal is a sentence: a
 * share that is spent, a hold with no room for the rag, and a purse that
 * cannot cover the scrap. The room is read from the one capacity reader
 * rather than worked out here, so a rag takes a slot in exactly the way a
 * bolt of silk does.
 */
export function buyRag(state: GameState, logs: string[]): boolean {
  if (!refitsOn(state.mode)) return false;
  if (state.path !== REFIT_SELLER_PATH) {
    logs.push("❌ Only a Loom captain buys rags off the harbor pile.");
    return false;
  }
  const left = ragsLeftAtPort(state);
  if (left < 1) {
    logs.push("❌ The harbor has no rags left for you this leg.");
    return false;
  }
  if (getOwnedAmount(state, "Gold") < RAG_SCRAP_VALUE) {
    logs.push(`❌ ${RAG_SCRAP_VALUE} Gold buys a rag, and the purse is short.`);
    return false;
  }
  if (cargoRoom(state) < 1) {
    logs.push("❌ There is no room in the hold for another rag.");
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
    `🪡 Bought a rag off the harbor pile for ${RAG_SCRAP_VALUE} Gold. ${left - 1} left for you this leg.`,
  );
  return true;
}

/**
 * The crafting chain: rags back into cloth, in the Loom's own hands.
 *
 * This is the weaver's recipe read from the other end. Linen Clothes takes
 * two of its material at the artisan bench, through a hired worker and a
 * leg of waiting; the Loom takes two rags here and needs neither. What the
 * path is paid for is the shortcut rather than a cheaper coat, and the
 * harbor's pile is what bounds it: three rags a cold leg is one coat and a
 * spare, which is a wage rather than an industry.
 *
 * The hold's room is deliberately not checked. The rags are already aboard
 * and the coat takes less space than they did, so a reweave that was
 * refused for room would be refusing to make room.
 */
export function reweaveRags(state: GameState, logs: string[]): boolean {
  if (!refitsOn(state.mode)) return false;
  if (state.path !== REFIT_SELLER_PATH) {
    logs.push("❌ Only a Loom captain knows how to work rags back into cloth.");
    return false;
  }
  if ((state.inventory[RAGS] ?? 0) < REWEAVE_RAGS) {
    logs.push(
      `❌ A reweave takes ${REWEAVE_RAGS} rags and the hold has fewer.`,
    );
    return false;
  }
  state.inventory[RAGS] -= REWEAVE_RAGS;
  state.inventory[REWEAVE_GOOD] = (state.inventory[REWEAVE_GOOD] ?? 0) + 1;
  state.ragsRewoven += 1;
  logs.push(
    `🧵 ${REWEAVE_RAGS} rags go back on the loom and come off as one ${REWEAVE_GOOD}.`,
  );
  return true;
}

/**
 * The port mend: what a captain can do for themselves, and the price the
 * refit is measured against.
 *
 * One point of durability for five Gold, once a leg, at the harbor. It is
 * open to every path rather than to the Loom, and that is the point of it:
 * the plan's "faster and cheaper than they could manage alone" needs a
 * thing they can manage alone, and without one a refit would have no price
 * to be cheaper than. Slower is the arithmetic and not a rule: whole Linen
 * Clothes is six points and thirty Gold over six legs, so one Loom leg is
 * worth three mend legs to a customer and the two captains are haggling
 * over the difference.
 *
 * Charged only for the work that happened. A mend on a garment already
 * whole is refused rather than sold, which is the one refusal here that is
 * about the goods rather than the purse.
 */
export function mendGarment(
  state: GameState,
  good: unknown,
  logs: string[],
): boolean {
  if (!refitsOn(state.mode)) return false;
  const spec = garmentSpec(good);
  if (!spec || typeof good !== "string") {
    logs.push("❌ That is not something the harbor can put right.");
    return false;
  }
  if (state.mendRound === state.currentRound) {
    logs.push(
      "❌ The harbor tailors have already worked on the crew this leg.",
    );
    return false;
  }
  if (garmentRoom(state, good) < 1) {
    logs.push(`❌ The crew is wearing no worn ${good} for the harbor to mend.`);
    return false;
  }
  if (getOwnedAmount(state, "Gold") < MEND_GOLD_PER_POINT) {
    logs.push(
      `❌ A mend costs ${MEND_GOLD_PER_POINT} Gold and the purse is short.`,
    );
    return false;
  }
  const back = restoreGarment(state, good, MEND_POINTS, logs);
  if (back < 1) return false;
  addOwnedAmount(state, "Gold", -MEND_GOLD_PER_POINT);
  state.mendsMade += 1;
  state.mendRound = state.currentRound;
  logs.push(
    `🪡 The harbor tailor takes ${MEND_GOLD_PER_POINT} Gold for ${back} point of the ${good}.`,
  );
  return true;
}

/**
 * Applies this captain's side of a refit, once.
 *
 * One function for both sides, the shape the escort's own settlement takes,
 * and for the same reason: the two cases differ in who they are and in
 * which direction the Gold moves, and agree on everything else. The buyer
 * is the one who can put the points back, because the garment is theirs;
 * the seller is the one who is paid, and the payment is the price they
 * agreed rather than what the customer's purse could cover, exactly as a
 * contract's fee is.
 *
 * The ledger is the idempotence (see movementApplied in ./consent): a
 * reload between the agreement and the broadcast that carries it must not
 * charge the same fee twice.
 *
 * Returns whether the state changed, which is what the React layer reads to
 * decide whether it owes the captain a re-render.
 */
export function applyRefitSide(
  state: GameState,
  contract: RefitContract,
  meId: string,
  logs: string[],
): boolean {
  if (!refitsOn(state.mode)) return false;
  if (contract.status !== "agreed") return false;
  const isSeller = contract.sellerUserId === meId;
  const isBuyer = contract.buyerUserId === meId;
  if (!isSeller && !isBuyer) return false;
  const key = `${contract.id}:fee`;
  if (movementApplied(state, key)) return false;

  if (isBuyer) {
    // The customer's own garment, put right by the customer's own machine.
    // The fee moves first so the log reads in the order the captain lived
    // it, and a purse that moved between the accept and this call pays what
    // it has rather than a negative hold, which is the reading paidFee takes
    // for all three of the priced settles (see ./core).
    const paid = paidFee(state, contract.fee);
    addOwnedAmount(state, "Gold", -paid);
    state.refitsBought += 1;
    state.refitFeesPaid += paid;
    logs.push(
      `🤝 Refit: paid ${paid} Gold to ${contract.sellerName} for the ${contract.good} to be put right.`,
    );
    const back = restoreGarment(state, contract.good, REFIT_POINTS, logs);
    if (back < 1) {
      // Reachable only if the garment left the wardrobe between the offer
      // being accepted and this call. The board hides the accept when there
      // is no work to do, so this is the sentence for a state that moved
      // underneath the agreement rather than for an ordinary one. The fee
      // stands as it was moved above, and deliberately: the seller's own
      // machine credits the agreed price on its own side of this same
      // function, so the two saves cannot unpay what one of them already
      // banked, which is the same reading the module trade takes when its
      // card fails to resolve (see the buyer branch in ./modules). The
      // sentence is what the captain gets for the price, rather than
      // silence.
      logs.push(`❌ There is no worn ${contract.good} left to work on.`);
    }
  } else {
    addOwnedAmount(state, "Gold", contract.fee);
    state.refitsSold += 1;
    state.refitFeesEarned += contract.fee;
    logs.push(
      `🤝 Refit: ${contract.buyerName ?? "A captain"} paid ${contract.fee} Gold for the ${contract.good} to be put right.`,
    );
  }
  markMovement(state, key);
  return true;
}

/**
 * Heals the tally at the load site, the way every other field this build
 * added is healed, and no voyage saved before this feature carries any of
 * it: a save from before D4 reads as a captain who has never mended
 * anything, bought a rag or sold a refit.
 *
 * The two stamps are healed with them and heal to zero, which is a leg no
 * voyage has, so the first leg after loading is one the harbor will mend in
 * and one the pile is full for, rather than one the captain reads as
 * already spent.
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
  state.mendRound = legStamp(state.mendRound);
  state.ragsRound = legStamp(state.ragsRound);
}

/**
 * A leg stamp as the readers above expect one: a whole leg, or zero for a
 * voyage that never stamped this one.
 *
 * Zero is a leg no voyage has, which is the direction both stamps heal in:
 * a save that predates this feature lands on "the harbor has not worked on
 * the crew yet" rather than on a leg that reads as already spent. Written
 * once for the two stamps, on the one arithmetic every stamp in the game
 * shares (see wholeStamp in ../types).
 */
function legStamp(raw: unknown): number {
  return wholeStamp(raw);
}

// =====================================================================
// The refit as it travels: one record, declared here because the game
// layer is what both ends of the wire import from (see src/types/realtime,
// which imports this shape rather than declaring a second one).
// =====================================================================
export type RefitContract = ConsentTerms & {
  status: "offered" | "agreed";
  // The garment the customer is buying work on. The points are not on the
  // row because they are not a choice: a refit is REFIT_POINTS of work, and
  // a field that could only ever hold one value would be a second place
  // that number is written.
  good: string;
};
