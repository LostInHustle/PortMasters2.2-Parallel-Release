// The three foods and the sea's clock. The count in state.larder is the
// game's number; the lots are where that number comes from and the only
// thing spoilage can read, since only a batch knows its own age. Every
// writer keeps the two in step in the same statement. A foreign save comes
// through normalizeLarderLots, where the lots are the more specific fact
// and the count follows them; reconcileLarder is the other direction, and
// it makes the account agree with a count that has moved without it.
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
import { line, type LedgerLine } from "@/lib/game/ledger";

// Bound on lots read from a save. Purchases merge into one lot per food
// per round, so a twelve round voyage comes to a few dozen at most. Past this
// a save is damage or a forgery, and the tail is trimmed: the head is what
// is about to spoil, while the tail is grain that was going to keep.
const LARDER_LOTS_MAX = 64;

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
 * The pantry as a screen wants it: every food aboard, and how many rounds
 * are left before the first of its meals turns. Null keeps.
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

/** How many rounds until the oldest lot of a food turns. Null keeps. */
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
 * Puts meals aboard as a lot stamped with the round they arrived in. A
 * second purchase of the same food in the same round merges into the
 * existing lot. The list stays sorted in draw order, so the head is always
 * the next meal.
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
 * Takes meals of one food from its lots, oldest first. Returns what was
 * actually taken, which is short when the food is not aboard in that
 * quantity.
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
 * The crew's meal, drawn in FOODS_DRAW_ORDER. Reconciles first: a caller
 * that wrote a plain count leaves the count ahead of the account, and
 * eating from a pantry that does not match the game's number would be a
 * meal nobody ate.
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
 * Makes the account agree with the count. A count ahead of the account is
 * food nobody bought, and it lands on grain, the shape of the plain count
 * the Larder began as. Food the game does not believe in is taken off the
 * tail (grain first, produce last), since what spoils first was going to
 * be lost anyway. Called by every writer that reads before it writes.
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
 * The settlement tick: spoilage since the last Dusk. Stamped by round
 * because a round can be settled through more than one path, and charging
 * spoilage twice is silent. A lot turns on the Dusk its age reaches its
 * food's keeping, counted from the round it was bought in. The count comes
 * down with the account in the same statement.
 */
export function tickSpoilage(state: GameState, logs: LedgerLine[]): void {
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
      line(
        "{foodIcon} {meals} {rationWord} of {food} turned at sea. {larderAfter} left in the larder.",
        {
          foodIcon: FOODS[food].icon,
          meals,
          rationWord: meals === 1 ? "ration" : "rations",
          food: line(food),
          larderAfter: Math.max(0, state.larder - spoiled),
        },
      ),
    );
  }
  state.larderLots = kept;
  state.larder = Math.max(0, state.larder - spoiled);
}

/**
 * Preserve: three meals of produce become two of salt fish, at the same
 * slot and price (see PRESERVE_MEALS_IN in ./constants). The port gate
 * lives in the panel; nothing here checks location. Returns the batches
 * converted.
 */
export function preserveFood(state: GameState, logs: LedgerLine[]): number {
  if (!survivalLayerOn(state.mode)) return 0;
  reconcileLarder(state);
  const produce = mealsOf(state, "Produce");
  const batches = Math.floor(produce / PRESERVE_MEALS_IN);
  if (batches <= 0) {
    logs.push(
      line(
        "❌ Not enough Produce aboard to preserve: a batch is {PRESERVE_MEALS_IN} meals.",
        { PRESERVE_MEALS_IN },
      ),
    );
    return 0;
  }
  const spent = batches * PRESERVE_MEALS_IN;
  const made = batches * PRESERVE_MEALS_OUT;
  const taken = drawFood(state, "Produce", spent);
  addLot(state, "Salt Fish", made, state.currentRound);
  state.larder = Math.max(0, state.larder - (taken - made));
  logs.push(
    line(
      "🐟 Preserved {taken} {rationWord} of Produce into {made} of Salt Fish ({state.larder} in the larder).",
      {
        taken,
        rationWord: taken === 1 ? "ration" : "rations",
        made,
        "state.larder": state.larder,
      },
    ),
  );
  return batches;
}

/**
 * Meals of a food the stores still have room for. With the split hold off
 * the ceiling is LARDER_MAX; with it on, the stores' slots times the
 * food's density (./hold owns that arithmetic). Floored at zero so every
 * caller reads one shape.
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
      // Own property check, not the in operator: `in` is true for every
      // Object.prototype member, and a save carrying { food: "toString" }
      // walked undefined values into NaN and out into the captain's purse.
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
 * The spoilage stamp; a missing stamp reads as 0, a round no voyage has, so
 * the first Dusk after loading reads the pantry.
 */
export function normalizeLarderSpoilRound(raw: unknown): number {
  return wholeStamp(raw);
}
