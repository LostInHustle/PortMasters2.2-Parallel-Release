// =====================================================================
// PortMasters 2.2 Parallel Release: the Larder and Short Rations.
//
// [C1: the Larder and Short Rations] A captain's crew is the artisan
// roster. This tree has called it that since the voyage summary was
// written, and it is already billed once a leg by ./engine/workers, which
// pays a wage for every artisan aboard. This module is the other half of
// that bill: the same crew eats.
//
// Four things about the shape are decisions rather than readings, and each
// of them is worth the sentence it costs here.
//
// The Larder is a plain number and not an inventory of foods. The survival
// edition eventually carries three of those, with spoilage and a split
// hold, and all of that is C4's. Until it lands, a ration is a ration, and
// the number on the screen is how many are aboard.
//
// Rations are bought. The plan never says where they come from, and its own
// evaluation says it from the side: a shortage that "produces no messages
// means the market is not working", which can only be a true reading of a
// shortage the market could have prevented. A Larder that could not be
// refilled would be a countdown rather than a decision, and C2's crew loss,
// which fires after two legs on short rations, would take a head from
// nearly every voyage instead of from the fifth of them the proposal
// expects. That loss has landed since this paragraph was written, and it
// lives in ./crew, which reads this module rather than the other way
// around: the Larder counts the mouths, and the roster is who they are.
//
// The shortage's second effect landed with C4. The plan's sentence is
// "cargo capacity down a quarter", and there was no cargo capacity in
// this tree to take a quarter off: the hold was unbounded, and the
// dashboard, the telemetry reader and the plan's own C4 section each said
// so in writing. The capacity model is built now, in ./hold, and the
// clause lands below on the single capacity read the split hold
// introduces rather than on a hold size invented for it: cargoCapacity
// and cargoRoom are in this module and not in ./hold because the quarter
// is a rule about hunger, and ./hold is arithmetic that reads no rules at
// all. What Short Rations has always cost is the crew's pace, which is
// the other half of the same sentence.
//
// The Larder also stopped being a plain number, which is the rest of
// C4: the three foods, their keeping and their spoiling live in ./foods,
// the hold they sit in lives in ./hold, and the count this module reads
// is the sum of what is aboard. Every reader of the count is unchanged,
// and a captain who buys nothing but grain is playing exactly the game
// C1 shipped.
//
// The layer is one switch, and the switch is an environment value rather
// than a field, so nothing about a voyage is stored differently with it on
// or off. See survivalLayerOn in ./flags for where that value is read and
// for the one cost the browser pays for it.
//
// Pure: no clock, no socket, no database. The one environment read is
// deliberate and it is documented where it happens.
// =====================================================================
import {
  LARDER_MAX,
  LARDER_START,
  RATION_PRICE,
  SHORT_RATIONS_YIELD,
  type FoodId,
} from "./constants";
import {
  cargoSlots,
  holdCapacityOn,
  storesMealCeiling,
  usedCargoSlots,
} from "./hold";
import { survivalLayerOn } from "./flags";
import { addLot, drawMeals, foodRoomMeals, reconcileLarder } from "./foods";
import { flatWorkerRoster, type GameState } from "./types";

/**
 * The crew: the artisan roster, counted through the one helper that
 * flattens it. Taken here rather than written out at each reader so the
 * number the Larder feeds and the number the voyage summary prints cannot
 * come from two different counts of the same roster.
 */
export function crewSize(state: Pick<GameState, "workers">): number {
  return flatWorkerRoster(state).length;
}

/**
 * Whether this captain is on short rations right now.
 *
 * Both halves are needed and either one alone would be wrong. An empty
 * Larder aboard a ship with nobody on it is a captain who never hired
 * rather than a captain who is starving, and a full Larder with a crew is
 * simply a fed one. The switch is read last and it is read here rather than
 * at the call sites, because every reader of this answer has to get the
 * same one: the crew's pace, the badge the fleet sees, and the captain's
 * own ledger line. A version of this that answered yes with the layer
 * switched off would put a shortage on a screen for a rule that is not
 * running.
 */
export function onShortRations(
  state: Pick<GameState, "workers" | "larder">,
): boolean {
  if (!survivalLayerOn()) return false;
  return state.larder <= 0 && crewSize(state) > 0;
}

/**
 * What one artisan's work comes to on a leg the crew went hungry.
 *
 * The reduction floors at a single item, and the floor is not a softening
 * of the rule: it is the committed materials. A task is started by spending
 * its recipe out of the hold (see assignTask in ./engine/workers), so a
 * yield that could round away to nothing would take those goods and return
 * silence, which is a trap rather than a cost. A leg is also the smallest
 * unit of work this engine has, so "slower than one good a leg" is not a
 * slower crew, it is a stopped one, and the plan says the shortage slows
 * crafting. An artisan already working at the floor therefore keeps working
 * at it, and the artisan who was producing two is the one who feels this.
 */
export function shortRationsYield(amount: number): number {
  const slowed = Math.floor(amount * SHORT_RATIONS_YIELD);
  return Math.max(1, slowed);
}

/**
 * The crew eats, once a leg.
 *
 * One ration a head, floored at zero, because a Larder the crew has emptied
 * is empty rather than in debt to its own ship.
 *
 * The leg stamp is what makes "once a leg" true rather than hopeful. A leg
 * opens through more than one path, and two of them can reach the same
 * client for the same leg: the captain who leaves Dusk rolls the round over
 * locally, and every captain in the room is then carried into the same Dawn
 * by the room's advance, which is the entry that calls the draft's opener.
 * Feeding on arrival instead of on a stamp would charge a captain for a leg
 * twice, and a double charge is a silent defect: nothing throws, no screen
 * looks wrong, and the captain simply runs out of food a leg early for a
 * reason they cannot see. The stamp costs one number on the save and takes
 * the question off the table.
 *
 * It is written before the early returns below, so a leg is marked as eaten
 * whether or not there was anything to eat. The rule is "the crew eats once
 * a leg", not "the crew eats once a leg, if", and the difference shows on a
 * captain who hires their first artisan mid leg: marked or not decides
 * whether that artisan eats on the leg they arrived in.
 *
 * [C2: crew loss by name] It answers whether this call was the leg's meal,
 * and that answer is what keeps the price of hunger on the same stamp. The
 * Dawn tick settles two legs of short rations beside this meal (see
 * settleHunger in ./crew), and a caller that asked the crew's hunger for
 * itself would ask it twice on the leg that arrives through two paths,
 * advancing the run twice and taking a hand a leg early in silence. One
 * stamp, one meal, one price. The answer is false when the switch is off
 * as well, since the rules that would read it are not running.
 */
export function feedCrew(state: GameState, logs: string[]): boolean {
  if (!survivalLayerOn()) return false;
  if (state.larderFedRound === state.currentRound) return false;
  state.larderFedRound = state.currentRound;
  const crew = crewSize(state);
  if (crew === 0) return true;
  // [C4: three foods, spoilage and the split hold] The meal comes out of
  // the pantry in the order the sea takes things back, which is ./foods'
  // order and never this module's (see drawMeals). The count then goes
  // down by the mouth it fed rather than by what the pantry happened to
  // hold, so a count ahead of the account still costs the crew the meal
  // the game says they ate, and a pantry the meal empties draws less than
  // the crew asked for and leaves the shortage below to say so.
  drawMeals(state, crew);
  const before = state.larder;
  state.larder = Math.max(0, before - crew);
  if (state.larder === 0) {
    // The number in the sentence is read off the constant rather than
    // written into the words, the way the unlock line reads its own
    // threshold: a pace that moved would move what the captain is told.
    const pace = Math.round(SHORT_RATIONS_YIELD * 100);
    logs.push(
      `⚠️ Short rations! ${crew} aboard and the larder is empty: the crew works this leg at ${pace}% pace, and the fleet can see it.`,
    );
    return true;
  }
  logs.push(
    `🍲 The crew eats ${crew} ${crew === 1 ? "ration" : "rations"}. ${state.larder} left in the larder.`,
  );
  return true;
}

/**
 * The cargo hold's capacity in slots, after the quarter a hungry crew
 * costs it.
 *
 * [C4] The clause C1 left standing: "cargo capacity down a quarter", and
 * it lands here rather than in ./hold because the shortage it depends on
 * is this module's rule and the hold module reads no rules at all. With
 * the split switched off the answer is unbounded, which is the hold this
 * game has always had: a hold with no size has no quarter to take off it,
 * and a rule that invented one would be a hold size by the back door.
 */
export function cargoCapacity(state: GameState): number {
  if (!holdCapacityOn()) return Number.POSITIVE_INFINITY;
  return cargoSlots(onShortRations(state));
}

/**
 * How much room the cargo hold has left, in slots.
 *
 * The read the market makes before it sells anything, and the single
 * capacity read the plan's own C4 section asks for: one function, one
 * place, and both the hold's size and the shortage's quarter are decided
 * inside it rather than at the counters that ask.
 *
 * Floored at zero. A hold over its capacity, which a craft or a barter can
 * leave behind because only the market refuses (see ./hold), has no room
 * rather than a negative amount of it, so every caller reads one shape.
 */
export function cargoRoom(state: GameState): number {
  const capacity = cargoCapacity(state);
  if (!Number.isFinite(capacity)) return Number.POSITIVE_INFINITY;
  return Math.max(0, capacity - usedCargoSlots(state));
}

/**
 * Buys food for the crew, as many legs' worth as the stores have room for
 * and the purse can cover.
 *
 * Measured in legs rather than in meals because a leg is the only quantity
 * a captain can reason about: what they are deciding is how long the food
 * has to last, and that is the same arithmetic the eat above runs. The
 * price of a meal does not move with the food (see FOODS in ./constants),
 * so a leg costs the same whichever food it is bought as, and the choice
 * between the three is entirely a choice about space and keeping.
 *
 * [C4] A ration is a leg of grain, which is the shape C1 shipped and the
 * reason this function needed nothing to carry the pantry: a captain who
 * wants the food that never turns names Grain, and the panel's ration row
 * is this call rather than a second purchase path with a second name.
 *
 * The ceiling and the purse are reached rather than refused. A captain who
 * asked for four legs with room for one buys one, and one who can afford
 * half of what they asked for buys half, because a store that turned
 * custom away over an amount the buyer could not have known would be a
 * worse merchant than the ones this game is about. What it will not do is
 * buy nothing and say nothing: a purchase that comes to zero rations
 * returns zero and says why, so the panel can print the reason rather than
 * a button that appears to do nothing.
 *
 * The account is reconciled before the room is read, because a count that
 * has run ahead of it, which only a hand that wrote one of the two can
 * leave behind, would otherwise read as a pantry with more free space than
 * it has.
 *
 * Returns the legs actually bought, so the caller can report what happened
 * rather than what was asked for.
 */
export function provisionFood(
  state: GameState,
  food: FoodId,
  legs: number,
  logs: string[],
): number {
  if (!survivalLayerOn()) return 0;
  const crew = crewSize(state);
  if (crew === 0) {
    logs.push("⚓ No crew aboard, so there is nothing to provision.");
    return 0;
  }
  reconcileLarder(state);
  const room = Math.floor(foodRoomMeals(state, food) / crew);
  if (room <= 0) {
    logs.push("🧺 The larder is full.");
    return 0;
  }
  const affordable = Math.floor(state.money / (crew * RATION_PRICE));
  const wanted = Math.min(Math.floor(legs), room, affordable);
  if (wanted <= 0) {
    const cost = crew * RATION_PRICE;
    logs.push(
      `❌ Not enough Gold to provision the crew: a leg of rations is ${cost} Gold.`,
    );
    return 0;
  }
  const rations = wanted * crew;
  const cost = rations * RATION_PRICE;
  state.money -= cost;
  state.larder += rations;
  addLot(state, food, rations, state.currentRound);
  state.roundCosts += cost;
  state.totalCosts += cost;
  logs.push(
    `🧺 Provisioned ${rations} ${rations === 1 ? "ration" : "rations"} of ${food} for ${crew} aboard (${cost} Gold). ${state.larder} in the larder.`,
  );
  return wanted;
}

/**
 * Whatever a save holds, read back as a number a crew can eat.
 *
 * A non number is not a Larder, so it heals to the full opening hold rather
 * than to an empty one: a file this tree cannot read is damage, and a
 * captain should not be put on short rations for a leg by a corrupted save.
 * A number outside the hold's ends is clamped rather than dropped, since it
 * was written by a build that had a legitimate value and the ends are the
 * only thing this reader knows about it. A fraction is floored, because
 * rations are counted.
 *
 * [C4] The upper end is the one number this reader had to learn. With the
 * split switched off it is LARDER_MAX, exactly as it always was. With it
 * on, a legal count is not a number of meals at all: three foods of three
 * densities share sixty slots, so the same hold can legally carry sixty
 * meals of grain or a hundred and eighty of produce, and a reader that
 * trimmed to the old ceiling would empty a captain's pantry of food the
 * game had already sold them. The end is therefore the stores' own, read
 * from ./hold, and it is an end and not a tune: nothing in play reaches
 * it, because the room checks stop a purchase first.
 */
export function normalizeLarder(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return LARDER_START;
  const whole = Math.floor(raw);
  const ceiling = holdCapacityOn() ? storesMealCeiling() : LARDER_MAX;
  return Math.min(ceiling, Math.max(0, whole));
}

/**
 * The leg stamp, read back the same way.
 *
 * A save written before this field existed carries no stamp, and it lands
 * on zero, which is a leg no voyage has: the first Dawn after loading
 * therefore feeds the crew, exactly as it would have had the captain been
 * sailing this build all along.
 */
export function normalizeLarderFedRound(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}
