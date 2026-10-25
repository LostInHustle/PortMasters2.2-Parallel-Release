// The Larder and Short Rations. The crew is the artisan roster: ./engine/
// workers pays every artisan a wage, and this module feeds the same crew.
// The count is a plain number, the pantry behind it lives in ./foods, and
// the layer switch is an environment value (see survivalLayerOn in ./flags).
import {
  LARDER_MAX,
  LARDER_START,
  RATION_PRICE,
  SHORT_RATIONS_YIELD,
  type FoodId,
} from "./constants/supplies";
import {
  cargoSlots,
  holdCapacityOn,
  storesMealCeiling,
  usedCargoSlots,
} from "./hold";
import { survivalLayerOn } from "./flags";
import { addLot, drawMeals, foodRoomMeals, reconcileLarder } from "./foods";
import { pathCargoModifier } from "./paths";
import { crewSize, wholeStamp, type GameState } from "./types";
import { line, type LedgerLine } from "@/lib/game/ledger";

/**
 * Both halves are needed: an empty Larder with nobody aboard is a captain
 * who never hired. The switch is read here so every reader agrees.
 */
export function onShortRations(
  state: Pick<GameState, "workers" | "larder" | "mode">,
): boolean {
  if (!survivalLayerOn(state.mode)) return false;
  return state.larder <= 0 && crewSize(state) > 0;
}

/**
 * Floors at one item. The floor is the committed materials: a task spends
 * its recipe when assigned, so a yield rounding to nothing would take the
 * goods and return silence.
 */
export function shortRationsYield(amount: number): number {
  const slowed = Math.floor(amount * SHORT_RATIONS_YIELD);
  return Math.max(1, slowed);
}

/**
 * The crew eats, once a round. One ration a head, floored at zero.
 *
 * The round stamp is what makes "once a round" true: a round can open through
 * two paths (a local Dusk rollover and the harbor's Dawn advance), and
 * feeding on arrival would charge twice. The stamp is written before the
 * early returns, so a round counts as eaten even with nothing to eat.
 *
 * Returns whether this call was the round's meal, which keeps the price of
 * hunger on the same stamp (see settleHunger in ./crew). False when the
 * switch is off.
 */
export function feedCrew(state: GameState, logs: LedgerLine[]): boolean {
  if (!survivalLayerOn(state.mode)) return false;
  if (state.larderFedRound === state.currentRound) return false;
  state.larderFedRound = state.currentRound;
  const crew = crewSize(state);
  if (crew === 0) return true;
  // The meal comes out of ./foods' order, and the count goes down by the
  // mouth it fed rather than by what the pantry held.
  //
  // Steady Watch is the one boon that changes what the meal costs: its flag
  // is the rations saved, floored at one so a crew of one still eats.
  const need = Math.max(1, crew - (state.modifierFlags.steady_rations ?? 0));
  drawMeals(state, need);
  const before = state.larder;
  state.larder = Math.max(0, before - need);
  if (state.larder === 0) {
    // Read off the constant so the sentence moves with the rule;
    // shortRationsYield floors at one item.
    const pace = Math.round(SHORT_RATIONS_YIELD * 100);
    logs.push(
      line(
        "⚠️ Short rations! {crew} aboard and the larder is empty: the crew works this round at {pace}% pace, and every line still brings home at least one item. The fleet can see it.",
        { crew, pace },
      ),
    );
    return true;
  }
  logs.push(
    line(
      "🍲 The crew eats {need} {rationWord}. {state.larder} left in the larder.",
      {
        need,
        rationWord: need === 1 ? "ration" : "rations",
        "state.larder": state.larder,
      },
    ),
  );
  return true;
}

/**
 * The hold's capacity in slots. The shortage's quarter comes off first and
 * the path's factor scales what remains, both decided here. With the split
 * hold off the answer is unbounded.
 */
export function cargoCapacity(state: GameState): number {
  if (!holdCapacityOn(state.mode)) return Number.POSITIVE_INFINITY;
  return Math.floor(
    cargoSlots(onShortRations(state)) * pathCargoModifier(state.path),
  );
}

/** The market's room before it sells, floored at zero. */
export function cargoRoom(state: GameState): number {
  const capacity = cargoCapacity(state);
  if (!Number.isFinite(capacity)) return Number.POSITIVE_INFINITY;
  return Math.max(0, capacity - usedCargoSlots(state));
}

/** What one round of rations costs the whole crew; three surfaces read it. */
export function legRationCost(state: GameState): number {
  return crewSize(state) * RATION_PRICE;
}

/** Rounds of one food the stores have room for; the panel shares this ceiling. */
export function provisionRoom(state: GameState, food: FoodId): number {
  const crew = crewSize(state);
  return crew === 0 ? 0 : Math.floor(foodRoomMeals(state, food) / crew);
}

/** Rounds of rations the purse can cover. Zero for a crew of none. */
export function provisionAffordable(state: GameState): number {
  const round = legRationCost(state);
  return round === 0 ? 0 : Math.floor(state.money / round);
}

// Shared with the Supply Barge; the smoke suites pin the sentence.
export const LARDER_FULL_LINE = "🧺 The larder is full.";
// Shared with the Supply Barge's purchase; the suites pin it too.
const NO_CREW_LINE = "⚓ No crew aboard, so there is nothing to provision.";

/** The guard both provisioning walks open with. */
export function provisioningCrew(
  state: GameState,
  logs: LedgerLine[],
): number | null {
  const crew = crewSize(state);
  if (crew === 0) {
    logs.push(line(NO_CREW_LINE));
    return null;
  }
  return crew;
}

/**
 * Buys as many rounds as the stores have room for and the purse can cover.
 * The price per meal is the same for every food, so the choice is about
 * space and keeping.
 *
 * Ceiling and purse are reached, not refused. A purchase that comes to
 * zero returns zero and says why. Reconciles before reading room, or a
 * count ahead of the account would show too much free space. Returns the
 * rounds bought.
 */
export function provisionFood(
  state: GameState,
  food: FoodId,
  rounds: number,
  logs: LedgerLine[],
): number {
  if (!survivalLayerOn(state.mode)) return 0;
  const crew = provisioningCrew(state, logs);
  if (crew === null) return 0;
  reconcileLarder(state);
  const room = provisionRoom(state, food);
  if (room <= 0) {
    logs.push(line(LARDER_FULL_LINE));
    return 0;
  }
  const affordable = provisionAffordable(state);
  const wanted = Math.min(Math.floor(rounds), room, affordable);
  if (wanted <= 0) {
    const cost = legRationCost(state);
    logs.push(
      line(
        "❌ Not enough Gold to provision the crew: a round of rations is {cost} Gold.",
        {
          cost,
        },
      ),
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
  // Counted where Gold leaves the purse; ./engine/barge writes the other
  // half of the pair.
  state.foodSpend += cost;
  logs.push(
    line(
      "🧺 Provisioned {rations} {rationWord} of {food} for {crew} aboard ({cost} Gold). {state.larder} in the larder.",
      {
        rations,
        rationWord: rations === 1 ? "ration" : "rations",
        food: line(food),
        crew,
        cost,
        "state.larder": state.larder,
      },
    ),
  );
  return wanted;
}

/**
 * Whatever a save holds, read back as a number a crew can eat. A non
 * number heals to the opening hold, not to empty. Out of range values are
 * clamped and fractions floored.
 *
 * The ceiling depends on the split hold: the same slots can legally carry
 * far more meals of produce than of grain, so the end is storesMealCeiling
 * rather than LARDER_MAX. Nothing in play reaches it.
 */
export function normalizeLarder(raw: unknown, mode: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return LARDER_START;
  const whole = Math.floor(raw);
  const ceiling = holdCapacityOn(mode) ? storesMealCeiling() : LARDER_MAX;
  return Math.min(ceiling, Math.max(0, whole));
}

/** Missing reads as 0, so the first Dawn after loading feeds the crew. */
export function normalizeLarderFedRound(raw: unknown): number {
  return wholeStamp(raw);
}
