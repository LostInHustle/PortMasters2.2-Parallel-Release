// =====================================================================
// PortMasters 2.2 Parallel Release: the three foods and the sea's clock.
//
// [C4: three foods, spoilage and the split hold] C1 shipped a Larder that
// was a plain number, and said so in its own header: "The survival
// edition eventually carries three of those, with spoilage and a split
// hold, and all of that is C4's." This module is that promise kept. A
// ration is still a ration and the number on the screen is still how many
// are aboard; what is new is that the number now has an account, and the
// account knows what each meal is and when it came aboard.
//
// One account, one count. The count is the game's number: the HUD, the
// audit's reveal, the shortage rule and the voyage summary all read
// .larder and none of them changed. The lots are where that number comes
// from, and they are the only thing spoilage can read, because only a
// batch knows its own age. The two are written in the same statement by
// every writer in this module and in ./larder, and the one door a foreign
// save can come through reconciles them: on load the account wins, since
// lots are the more specific fact, and the count is set to their sum
// rather than the other way around. Nothing here ever invents food.
//
// Batches rather than a number per food, and the reason is the rot. A
// count per food with a single stamp would refresh the whole stack every
// time a captain bought one more meal of it, and rot a captain can dodge
// by buying a mouthful is not a rule, it is a screen. A lot is what was
// bought, and it ages from the leg it was bought in.
//
// The order is the second decision. The crew eats whatever spoils first,
// which is why FOODS_DRAW_ORDER runs Produce, Salt Fish, Grain, and the
// lots are kept sorted into that order rather than sorted at dinner: the
// head of the list is always the next meal, oldest first within a food,
// and eating is a walk from the head. A captain who keeps grain and buys
// produce is eating the produce, which is both the sensible rule and the
// one that makes the three foods mean something.
//
// Grain absorbs. When a count and an account disagree, or when a save
// arrives with a count and no account, the difference lands on grain:
// the food that never turns is the one whose age nothing can be wrong
// about, so it is the one that can take an unknown age without lying
// about one. This is the same choice ./larder's own reader makes for a
// save that predates the pantry, and it is made twice because it is made
// at two doors, the load and the write.
//
// Pure: no clock, no socket, no database. The age of a lot is a round
// number and the leg is the only clock this module has, which is what the
// plan asks for when it says spoilage "must be part of the deterministic
// resolve step and may not read a clock".
// =====================================================================
import {
  FOODS,
  FOODS_DRAW_ORDER,
  type FoodId,
  LARDER_MAX,
  PRESERVE_MEALS_IN,
  PRESERVE_MEALS_OUT,
} from "./constants/supplies";
import { survivalLayerOn } from "./flags";
import { holdCapacityOn, storeRoomMeals } from "./hold";
import { wholeStamp, type GameState, type LarderLot } from "./types";

// The most lots a voyage can legitimately be carrying. Purchases merge
// into the lot of the same food bought in the same leg, so a twelve leg
// voyage with three foods and a preserve or two comes to a few dozen at
// the very most. A save past this is either damage or a forgery, and it
// is trimmed at the tail: the head of the list is what is about to spoil
// and the tail is grain that was going to keep, so a trimmed save loses
// the food it was never going to eat first.
const LARDER_LOTS_MAX = 64;

/** The meals the account adds up to, which is what the count should be. */
export function larderMeals(state: Pick<GameState, "larderLots">): number {
  let meals = 0;
  for (const lot of state.larderLots ?? []) meals += lot.meals;
  return meals;
}

/** The meals of one food aboard, across its lots. */
export function mealsOf(
  state: Pick<GameState, "larderLots">,
  food: FoodId,
): number {
  let meals = 0;
  for (const lot of state.larderLots ?? []) {
    if (lot.food === food) meals += lot.meals;
  }
  return meals;
}

/**
 * The pantry as a screen wants it: every food aboard, and how many legs
 * are left before the first of its meals turns. Null means grain or an
 * empty row, both of which keep.
 */
export function pantryLines(
  state: Pick<GameState, "larderLots" | "currentRound">,
): {
  food: FoodId;
  meals: number;
  legsLeft: number | null;
}[] {
  const out: { food: FoodId; meals: number; legsLeft: number | null }[] = [];
  for (const food of FOODS_DRAW_ORDER) {
    const meals = mealsOf(state, food);
    if (meals <= 0) continue;
    out.push({ food, meals, legsLeft: legsLeft(state, food) });
  }
  return out;
}

/** How many legs until the oldest lot of a food turns. Null keeps. */
function legsLeft(
  state: Pick<GameState, "larderLots" | "currentRound">,
  food: FoodId,
): number | null {
  const keeps = FOODS[food].keeps;
  if (keeps === null) return null;
  let oldest = Number.POSITIVE_INFINITY;
  for (const lot of state.larderLots ?? []) {
    if (lot.food !== food) continue;
    oldest = Math.min(oldest, lot.boughtRound);
  }
  if (!Number.isFinite(oldest)) return null;
  return Math.max(0, keeps - (state.currentRound - oldest));
}

/**
 * Puts meals of a food aboard as a lot of the leg they arrived in.
 *
 * A second purchase of the same food in the same leg merges into the lot
 * already there rather than starting a second one with the same age, so
 * the list holds one entry per food per leg however many times a captain
 * presses the button. The insertion keeps the list in draw order, which
 * is the whole of what the order costs: one walk from the head.
 */
export function addLot(
  state: Pick<GameState, "larderLots" | "currentRound">,
  food: FoodId,
  meals: number,
  boughtRound: number,
): void {
  const whole = Math.floor(meals);
  if (whole <= 0) return;
  state.larderLots = state.larderLots ?? [];
  const merge = state.larderLots.find(
    (lot) => lot.food === food && lot.boughtRound === boughtRound,
  );
  if (merge) {
    merge.meals += whole;
    return;
  }
  const at = state.larderLots.findIndex((lot) =>
    sortsBefore(food, boughtRound, lot),
  );
  const lot: LarderLot = { food, meals: whole, boughtRound };
  if (at < 0) state.larderLots.push(lot);
  else state.larderLots.splice(at, 0, lot);
}

/** Whether a lot of the given food and leg belongs before this one. */
function sortsBefore(
  food: FoodId,
  boughtRound: number,
  lot: LarderLot,
): boolean {
  const mine = FOODS_DRAW_ORDER.indexOf(food);
  const theirs = FOODS_DRAW_ORDER.indexOf(lot.food);
  if (mine !== theirs) return theirs > mine;
  return lot.boughtRound > boughtRound;
}

/**
 * Takes meals of one food out of its lots, oldest first.
 *
 * Returns what it actually took, which is less than asked for when the
 * food is not aboard in that quantity. Every caller is either eating or
 * converting, and both want to know what really happened rather than what
 * they asked for.
 */
function drawFood(
  state: Pick<GameState, "larderLots">,
  food: FoodId,
  meals: number,
): number {
  let left = Math.floor(meals);
  let taken = 0;
  const kept: LarderLot[] = [];
  for (const lot of state.larderLots ?? []) {
    if (left <= 0 || lot.food !== food) {
      kept.push(lot);
      continue;
    }
    const from = Math.min(left, lot.meals);
    left -= from;
    taken += from;
    if (lot.meals > from) kept.push({ ...lot, meals: lot.meals - from });
  }
  state.larderLots = kept;
  return taken;
}

/**
 * The crew's meal, drawn in the order the sea takes things back.
 *
 * Returns the meals actually drawn, which the caller in ./larder uses to
 * keep its count in step. It reconciles first rather than trusting the
 * list: a caller that has just written a plain number, a test or a
 * scenario writer, leaves the count ahead of the account, and eating from
 * a pantry that does not match the number the game reads would be a meal
 * nobody ate.
 */
export function drawMeals(state: GameState, meals: number): number {
  reconcileLarder(state);
  let left = Math.max(0, Math.floor(meals));
  let taken = 0;
  for (const food of FOODS_DRAW_ORDER) {
    if (left <= 0) break;
    const from = drawFood(state, food, left);
    left -= from;
    taken += from;
  }
  return taken;
}

/**
 * Makes the account agree with the count, whatever happened to either.
 *
 * A count ahead of the account is food nobody bought, and it lands on
 * grain: the pantry is short by meals the game already believes the crew
 * has, and grain is the shape C1's plain number always had. An account
 * ahead of the count is food the game does not believe in, and it is
 * taken off the tail, which is grain first and produce last, for the
 * reason the load trims at the tail: what spoils first is what a captain
 * was going to lose anyway.
 *
 * Called by every writer that reads before it writes: the meal, because
 * it eats from the account, and provisioning, because it measures the
 * room left rather than the count. Preserving writes both numbers in one
 * statement and calls it for the same reason the other two do, so a state
 * that arrived parted cannot leave a conversion parted too.
 */
export function reconcileLarder(state: GameState): void {
  const account = larderMeals(state);
  const count = Math.max(0, Math.floor(state.larder));
  if (account < count) {
    addLot(state, "Grain", count - account, 0);
    return;
  }
  if (account > count) {
    drawFood(state, "Grain", account - count);
    const still = larderMeals(state);
    if (still > count) {
      const foods = [...FOODS_DRAW_ORDER].reverse();
      for (const food of foods) {
        if (larderMeals(state) <= count) break;
        drawFood(state, food, larderMeals(state) - count);
      }
    }
  }
}

/**
 * The settlement tick: what the sea has taken back since the last Dusk.
 *
 * Once a leg, stamped the way the Larder's own meal and C3's wear are
 * stamped and for the same reason: a leg can be settled through more than
 * one path, and spoilage charged twice is a silent defect, the same
 * rations lost for a reason no screen shows.
 *
 * A lot turns on the Dusk of the leg its age reaches its food's own
 * keeping, counted from the leg it was bought in. So produce bought at
 * one market is food for that leg and the two after it and is gone at the
 * second Dusk, which is the plan's "produce spoils in two"; salt fish
 * lasts six, and grain is never asked. The count comes down with the
 * account, in the same statement, so the two cannot part over a loss.
 */
export function tickSpoilage(state: GameState, logs: string[]): void {
  if (!survivalLayerOn(state.mode)) return;
  if (state.larderSpoilRound === state.currentRound) return;
  state.larderSpoilRound = state.currentRound;
  state.larderLots = state.larderLots ?? [];
  if (state.larderLots.length === 0) return;
  const kept: LarderLot[] = [];
  const lost: Partial<Record<FoodId, number>> = {};
  for (const lot of state.larderLots) {
    const keeps = FOODS[lot.food].keeps;
    const age = state.currentRound - lot.boughtRound;
    if (keeps !== null && age >= keeps) {
      lost[lot.food] = (lost[lot.food] ?? 0) + lot.meals;
      continue;
    }
    kept.push(lot);
  }
  if (Object.keys(lost).length === 0) return;
  let spoiled = 0;
  for (const food of FOODS_DRAW_ORDER) {
    const meals = lost[food];
    if (!meals) continue;
    spoiled += meals;
    logs.push(
      `${FOODS[food].icon} ${meals} ${meals === 1 ? "ration" : "rations"} of ${food} turned at sea. ${Math.max(0, state.larder - spoiled)} left in the larder.`,
    );
  }
  state.larderLots = kept;
  state.larder = Math.max(0, state.larder - spoiled);
}

/**
 * Preserve: three meals of produce become two of salt fish.
 *
 * The plan's own ratio and the plan's own verb, of the three meals that
 * were about to turn into two that will keep six legs, at the same slot
 * of the hold and the same price (see PRESERVE_MEALS_IN in ./constants).
 * What a captain pays for it is the third meal, which is the price of a
 * fresh clock and not a toll: preserving is what a hold does with produce
 * it cannot eat in time, and doing it early is a worse trade than eating
 * it, which is exactly the shape a decision should have.
 *
 * "At a port" is the panel's own gate rather than this function's, the
 * same way C3's wardrobe is worn from the harbor's bench and nowhere
 * else, and "Quartermaster only" is the half of this sentence this tree
 * cannot keep yet: there is no Quartermaster aboard. The seat and the
 * paths that compete for it are the next epic's, so the conversion ships
 * open to every captain rather than behind an invented office, and the
 * restriction lands with the seat that carries it.
 *
 * Returns the batches converted, so the caller can report what happened.
 */
export function preserveFood(state: GameState, logs: string[]): number {
  if (!survivalLayerOn(state.mode)) return 0;
  reconcileLarder(state);
  const produce = mealsOf(state, "Produce");
  const batches = Math.floor(produce / PRESERVE_MEALS_IN);
  if (batches <= 0) {
    logs.push(
      `❌ Not enough Produce aboard to preserve: a batch is ${PRESERVE_MEALS_IN} meals.`,
    );
    return 0;
  }
  const spent = batches * PRESERVE_MEALS_IN;
  const made = batches * PRESERVE_MEALS_OUT;
  const taken = drawFood(state, "Produce", spent);
  addLot(state, "Salt Fish", made, state.currentRound);
  state.larder = Math.max(0, state.larder - (taken - made));
  logs.push(
    `🐟 Preserved ${taken} ${taken === 1 ? "ration" : "rations"} of Produce into ${made} of Salt Fish (${state.larder} in the larder).`,
  );
  return batches;
}

/**
 * How many meals of a food the stores still have room for.
 *
 * The one room read every food goes through, and it answers the two
 * shapes the model has. With the split switched off there is no stores at
 * all and the ceiling is the Larder's own, whatever the food is, which is
 * the room C1 has always had. With it on the room is the stores' slots
 * times the food's density, so three times as many meals of produce fit
 * as of grain, and the capacity read itself is ./hold's rather than this
 * module's: the quarter a hungry crew costs the cargo has one home and
 * this is not it.
 *
 * Floored at zero, so every caller reads one shape: no room is no room,
 * however far over the ceiling the hold happens to be.
 */
export function foodRoomMeals(state: GameState, food: FoodId): number {
  if (!holdCapacityOn(state.mode))
    return Math.max(0, LARDER_MAX - state.larder);
  return Math.max(0, storeRoomMeals(state, food));
}

/** Whatever a save holds, read back as an account a crew can eat from. */
export function normalizeLarderLots(
  raw: unknown,
  fallbackMeals: number,
): LarderLot[] {
  const lots: LarderLot[] = [];
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      const lot = entry as Partial<LarderLot>;
      const food = lot.food;
      // The table is asked for the key's own presence rather than through
      // the in operator, which answers true for every member of
      // Object.prototype: a damaged save carrying { food: "toString" }
      // survived an in check, and the reads after it walked
      // FOODS["toString"].mealsPerSlot, which is undefined, into NaN and
      // out through the provisioning arithmetic into the captain's purse.
      // The same own-property guard the wardrobe's reader takes (see
      // garmentSpec in ./garments).
      if (
        typeof food !== "string" ||
        !Object.prototype.hasOwnProperty.call(FOODS, food)
      )
        continue;
      const meals = lot.meals;
      if (typeof meals !== "number" || !Number.isFinite(meals)) continue;
      const whole = Math.floor(meals);
      if (whole <= 0) continue;
      const round = lot.boughtRound;
      const boughtRound =
        typeof round === "number" && Number.isFinite(round)
          ? Math.max(0, Math.floor(round))
          : 0;
      lots.push({ food: food as FoodId, meals: whole, boughtRound });
      if (lots.length >= LARDER_LOTS_MAX) break;
    }
  }
  if (lots.length > 0) return lots;
  const fallback = Math.max(0, Math.floor(fallbackMeals));
  return fallback > 0
    ? [{ food: "Grain", meals: fallback, boughtRound: 0 }]
    : [];
}

/**
 * The spoilage stamp, read back the same way the Larder's own stamp is.
 *
 * A save written before this field existed carries no stamp, and it lands
 * on zero, which is a leg no voyage has: the first Dusk after loading
 * therefore reads the pantry, exactly as it would have had the captain
 * been sailing this build all along.
 */
export function normalizeLarderSpoilRound(raw: unknown): number {
  return wholeStamp(raw);
}
