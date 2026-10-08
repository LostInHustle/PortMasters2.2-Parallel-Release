// =====================================================================
// PortMasters 2.2 Parallel Release: the Supply Barge.
//
// [E1: the Supply Barge] The plan's third part of the Quartermaster fix,
// and the one it calls the ugly fallback: "The Supply Barge is an
// anonymous vendor at every port selling rations at one hundred eighty
// percent of market, never more than eight per leg, and it is
// deterministic from port and leg so it can live in the pure engine with
// no new state."
//
// Every clause of that sentence is a decision this module makes, so it is
// worth saying which reading each one took.
//
// At every port. The vendor does not move with the fleet by accident: the
// port it stands at is drawn from the room's own unlocked ports by the
// leg, so the whole table walks past one Barge at one quay and a reload
// answers the same way twice. Drawn rather than announced, which is what
// keeps it out of the server: nothing here needs a room to agree on
// anything, because the room's numbers are the seed.
//
// Deterministic from port and leg. The lot is a draw on the port and the
// leg together, so a table that met the same eight rations at every quay
// would be looking at a rule rather than at a vendor. The draw is the
// harbor's rag pile read from the other end (see ragsAtPort): one
// function, one seed, and both clients reading it land on the same
// number without a frame being sent.
//
// One hundred eighty percent of market. The price is the market's own
// ration price and the plan's multiplier over it, worked out here rather
// than written down as four Gold, so a balance pass on the price of a
// meal moves this one too. It is rounded up rather than down because Gold
// is whole in this game, and a vendor that rounded down would be selling
// below the premium the plan sets.
//
// Never more than eight per leg. The ceiling is the size of the lot, not
// a shelf: what the vendor has for a captain this leg is drawn at most
// that high, and what the captain takes off it is their own record. That
// is the one piece of state this feature adds, and it is a captain's own
// save rather than anything the room holds, which is what the plan's "no
// new state" is actually about. A vendor with a shelf would need the
// server to hold it, and a shelf two clients could not see each other
// spending would be a desynchronization wearing a merchant's coat. The
// harbor's pile answers the same question the same way, and for the same
// reason.
//
// What the vendor sells is grain, and that is the plan's "rations" read
// through this tree's pantry rather than a fourth thing to decide. A
// ration in this game is the food that never turns (see provisionFood),
// which is the shape C1 shipped when the Larder was a plain number, so a
// captain who wants the food nothing can be wrong about names grain at a
// port as well. The Barge is the same purchase at a worse price, which is
// the whole of what the plan wants it to be.
//
// The layer it stands on is the provisions layer, and it has no switch of
// its own, which is the plan's own rollback read as one: "The Barge is
// the fail safe for a lobby with no Quartermaster, so it cannot be
// removed while the mode is on. Reverting this goal means reverting the
// mode." So there is no flag to read that the mode boundary does not
// already carry, and no build of this branch can be sailing the mode
// without the vendor standing at the quay.
// =====================================================================
import {
  BARGE_PRICE_MULTIPLIER,
  BARGE_RATIONS_PER_LEG,
  RATION_PRICE,
  type FoodId,
} from "../constants/supplies";
import { survivalLayerOn } from "../flags";
import { addLot, foodRoomMeals, reconcileLarder } from "../foods";
import { LARDER_FULL_LINE, crewSize } from "../larder";
import { unlockedPorts } from "../pools";
import { createRng } from "../rng";
import type { GameState } from "../types";
import { floorTallies } from "./consent";

/**
 * The one food the vendor sells, and the reason it is grain rather than a
 * choice of three.
 *
 * "Rations" is a word this tree already has an answer for: a ration is a
 * meal of the food that keeps, which is what the Larder was before C4
 * gave it three foods, and what a captain who buys grain at a port is
 * still buying (see provisionFood in ../larder). A vendor offering all
 * three would be a second food merchant competing with the port's own
 * counters rather than the fallback the plan asks for, and it would sell
 * fresh produce at a premium, which is a trade the sea is supposed to
 * decide rather than a quay.
 */
const BARGE_GOOD: FoodId = "Grain";

/**
 * Whether the Barge is standing at the quay.
 *
 * The plan's rollback clause is the whole of this function, and it is
 * worth restating why there is no switch beside it: the Barge cannot be
 * removed while the mode is on, so an operator who wants it gone has the
 * mode's own switch and the provisions layer under it. A second flag
 * would be a second way to take the fail safe away from a table that
 * needs it, which is the one thing the proposal says not to build.
 *
 * The read is the layer's own function rather than a second spelling of
 * its environment value, for the reason every reader in this family takes
 * it from there: the policy and the browser's rule about how a read has
 * to be written both live in one place (see flagOn in ../flags), and a
 * copy of the value here would be a copy that stopped moving when the
 * layer's did.
 */
export function bargeOn(mode: unknown): boolean {
  return survivalLayerOn(mode);
}

/**
 * The port the Barge is standing at this leg, or null when there is no
 * quay to stand at.
 *
 * Drawn from the room's own unlocked ports rather than from the whole
 * chart, so the vendor arrives with the charters the table is already
 * trading on and never names a quay nobody can reach yet. The pool is
 * read at the voyage's current leg, which is the same read the goods and
 * the market breadth take, so the Barge cannot be standing somewhere the
 * rest of the room cannot see.
 *
 * Null is an answer rather than an error: a table with no quay open has
 * no vendor, and every reader below treats that as an empty lot rather
 * than as a number to invent. In play the founding tier always has five
 * ports open, so what this guards is a difficulty row that ever opens
 * none.
 */
export function bargePortAtLeg(
  state: Pick<
    GameState,
    "voyageEpoch" | "mode" | "difficulty" | "currentRound"
  >,
): string | null {
  if (!bargeOn(state.mode)) return null;
  const ports = unlockedPorts(state.difficulty, state.currentRound);
  if (ports.length === 0) return null;
  const seed = `${state.voyageEpoch}:${state.mode}:${state.difficulty}:barge:${state.currentRound}`;
  const index = Math.floor(createRng(seed)() * ports.length);
  return ports[index] ?? null;
}

/**
 * How many rations the vendor has for a captain this leg, which is the
 * plan's ceiling read as a lot rather than as a shelf.
 *
 * Drawn from the port and the leg together, which is the plan's own
 * sentence about how this vendor is built, and it never exceeds
 * BARGE_RATIONS_PER_LEG because the draw is bounded by it. The seed
 * carries the port as well as the leg so two quays on one leg do not
 * answer alike, and the port is itself a draw on the leg, so the whole
 * thing is a function of the voyage's own numbers and nothing else.
 */
export function bargeLotAtPort(
  state: Pick<
    GameState,
    "voyageEpoch" | "mode" | "difficulty" | "currentRound"
  >,
): number {
  const port = bargePortAtLeg(state);
  if (port === null) return 0;
  const seed = `${state.voyageEpoch}:${state.mode}:${state.difficulty}:barge:${port}:${state.currentRound}`;
  return 1 + Math.floor(createRng(seed)() * BARGE_RATIONS_PER_LEG);
}

/**
 * What the vendor charges for a ration: the market's price and the plan's
 * one hundred eighty percent over it.
 *
 * Both numbers come from the constants, so the premium is a multiplier
 * and never a price of its own. Rounded up, because Gold is whole and a
 * vendor that rounded down would be selling below the premium the plan
 * sets: at a market price of two the vendor's ration is four, not three.
 */
export function bargeRationPrice(): number {
  return Math.ceil(RATION_PRICE * BARGE_PRICE_MULTIPLIER);
}

/**
 * What is left of this captain's lot this leg, which is what the panel
 * prints and what the buy below is bounded by.
 *
 * Per leg and reset with the leg, exactly as the harbor's pile is (see
 * ragsLeftAtPort): a stamp that no longer matches means nothing has been
 * taken yet, which is the reading every per leg counter in this tree
 * takes and the reason a save written mid leg needs no heal to be read
 * correctly at the next Dawn.
 */
export function bargeLeftAtPort(state: GameState): number {
  const taken = state.bargeRound === state.currentRound ? state.bargeTaken : 0;
  return Math.max(0, bargeLotAtPort(state) - Math.max(0, taken));
}

/**
 * How many rations the stores still have room for.
 *
 * One of the two ceilings buyFromBarge is held to along with the lot,
 * exported so that the panel drawing the row is held to the same one. The
 * room is measured in meals and answered as rations without a second
 * conversion, because the Barge sells one food (see BARGE_GOOD above) and
 * a meal of grain is a slot of grain is a ration (see FOODS in the
 * constants): there is no arithmetic here for a second copy to get wrong.
 */
export function bargeRoomMeals(state: GameState): number {
  return foodRoomMeals(state, BARGE_GOOD);
}

/**
 * How many rations the purse can cover, the other ceiling buyFromBarge is
 * held to. The vendor's price is a whole number of Gold by construction
 * (see bargeRationPrice above), so the division is safe on every voyage
 * the feature is on.
 */
export function bargePurseRations(state: GameState): number {
  return Math.floor(state.money / bargeRationPrice());
}

/**
 * Buying rations off the Barge, at the premium and out of the lot the
 * vendor has this leg.
 *
 * The ask is a number of rations rather than a number of legs, and that is
 * the one place this counter differs from every other counter in the food
 * trade. A port sells a voyage's provisions a leg at a time, because a
 * captain provisioning is deciding how long the food has to last (see
 * provisionFood); the Barge is what a captain reaches for once that
 * decision has already gone wrong, so what it sells is what they ask for.
 *
 * The lot, the stores' room and the purse are each reached rather than
 * refused, which is the same merchant the ports are: a captain who asked
 * for four with three left buys three, and one whose purse covers two buys
 * two. What it will not do is take the captain's Gold and give them
 * nothing, so the three ways an ask comes to nothing are each answered
 * with their own sentence rather than with silence.
 *
 * The sale is stamped and tallied here, and both counters of food spending
 * move with it: the voyage's food spend is what the share on the dashboard
 * is read against, and the Barge's own spend is the numerator. They are
 * written where the Gold actually leaves the purse rather than summed
 * later from the logs, because a reader that added up log lines would be
 * reading a rendering of the sale instead of the sale.
 *
 * Returns the rations actually sold, so the panel can report what happened
 * rather than what was asked for, and zero is an answer the log line
 * carries rather than an error.
 */
export function buyFromBarge(
  state: GameState,
  rations: number,
  logs: string[],
): number {
  if (!bargeOn(state.mode)) return 0;
  const crew = crewSize(state);
  if (crew === 0) {
    logs.push("⚓ No crew aboard, so there is nothing to provision.");
    return 0;
  }
  const left = bargeLeftAtPort(state);
  if (left < 1) {
    logs.push("⛵ The barge has nothing left for you this leg.");
    return 0;
  }
  reconcileLarder(state);
  const price = bargeRationPrice();
  const room = bargeRoomMeals(state);
  const affordable = bargePurseRations(state);
  const wanted = Math.min(Math.floor(rations), left, room, affordable);
  if (wanted < 1) {
    if (Math.floor(rations) < 1) {
      logs.push("❌ Name how many rations to buy from the barge.");
    } else if (room < 1) {
      logs.push(LARDER_FULL_LINE);
    } else {
      logs.push(
        `❌ The barge charges ${price} Gold a ration, and the purse cannot cover one.`,
      );
    }
    return 0;
  }
  const cost = wanted * price;
  state.money -= cost;
  state.larder += wanted;
  addLot(state, BARGE_GOOD, wanted, state.currentRound);
  state.roundCosts += cost;
  state.totalCosts += cost;
  state.foodSpend += cost;
  state.bargeSpend += cost;
  if (state.bargeRound !== state.currentRound) {
    state.bargeRound = state.currentRound;
    state.bargeTaken = 0;
  }
  state.bargeTaken += wanted;
  logs.push(
    `⛵ The barge takes ${cost} Gold for ${wanted} ${wanted === 1 ? "ration" : "rations"} of grain. ${left - wanted} left for you this leg.`,
  );
  return wanted;
}

/**
 * Heals the tally at the load site, the way every other field this build
 * added is healed, and no voyage saved before this feature carries any of
 * it: a save from before E1 reads as a captain who has never bought from
 * the vendor, which is every captain the feature did not exist for.
 *
 * The stamp heals to zero, which is a leg no voyage has, so the first leg
 * after loading is one the vendor is full for rather than one the captain
 * reads as already spent. The three counts are floored at nothing and a
 * damaged one reads as zero rather than as a fraction or a negative: the
 * two spend counters are the two halves of a share the dashboard divides,
 * and a negative numerator would print a share of food spending below
 * nothing.
 *
 * A voyage saved mid flight under the build before this one heals its two
 * counters to nothing, so it counts the food it buys from the reload
 * onward and none of what it bought before it. That is the shape every
 * counter this tree has added heals in, and it is why the dashboard reads
 * its share over the voyages whose record carries the counters rather
 * than over every voyage in the window: a leg report with no food
 * spending in it is a voyage this reading was not measuring.
 */
export function normalizeBargeState(state: GameState): void {
  floorTallies(state, ["bargeTaken", "foodSpend", "bargeSpend"]);
  state.bargeRound =
    typeof state.bargeRound === "number" && Number.isFinite(state.bargeRound)
      ? Math.max(0, Math.floor(state.bargeRound))
      : 0;
}
