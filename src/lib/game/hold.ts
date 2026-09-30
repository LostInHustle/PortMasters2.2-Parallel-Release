// =====================================================================
// PortMasters 2.2 Parallel Release: the split hold.
//
// [C4: three foods, spoilage and the split hold] This module is the
// capacity model the plan asks for and the one C1's own header promised:
// "the capacity model is C4's to build, and the clause lands there, on the
// single capacity read the split hold introduces". It is that read, in
// two halves and one arithmetic, and everything here is a count rather
// than a rule about eating: what a hold holds, what is in it, and what is
// left. The policy above the arithmetic, the switch and the quarter a
// hungry crew costs, is read in ./larder, which is where the shortage it
// depends on already lives.
//
// Three readings shape the module, and each is worth the sentence.
//
// The first is that slots are filled fractionally and counted exactly. A
// slot of produce is three meals and a crew eats one meal at a time, so a
// hold holding two meals of produce is holding two thirds of a slot, and
// this module says so rather than rounding in either direction. Rounding
// down would sell a captain space they do not have; rounding up would
// waste space they do. The one place a fraction is rounded is a screen's
// own display, and it rounds up there, because a slot with anything in it
// is a slot in use.
//
// The second is that the model is off by default in exactly the way the
// base game is off: with the provisions layer switched off there is no
// capacity read anywhere, and with the layer on but the split switched
// off there is one unbounded pool for goods and the Larder's own meal
// ceiling for food, which is the game this tree shipped before this
// module existed (see holdCapacityOn below and splitHoldOn in ./flags).
//
// The third is that nothing here refuses anything. This module answers
// what fits; the market is where a purchase that does not fit is turned
// away and told why (see purchaseCard in ./engine/market). Keeping the
// refusal at the door that sells is what lets every other inflow, a
// craft, a barter, a favor, land in a hold that is already full rather
// than be destroyed to make room for a rule about shopping.
//
// Pure: no clock, no socket, no database, and no flags of its own beyond
// the two it is switched by.
// =====================================================================
import { ITEMS } from "./constants/goods";
import {
  CARGO_SLOTS,
  FOODS,
  type FoodId,
  SHORT_RATIONS_CARGO,
  STORES_SLOTS,
} from "./constants/supplies";
import { splitHoldOn, survivalLayerOn } from "./flags";
import type { GameState } from "./types";

/**
 * Whether the hold has a size at all.
 *
 * Both switches, and the order matters: the capacity model is a rule
 * about provisions, so a table without the provisions layer plays the
 * base game exactly, whatever the split switch says. With both on, the
 * hold is two capacities; with either off, every room this module
 * answers is unbounded and food is capped by the Larder's own ceiling in
 * ./larder, which is what this game has always done.
 */
export function holdCapacityOn(mode: unknown): boolean {
  return survivalLayerOn(mode) && splitHoldOn(mode);
}

/**
 * The cargo capacity, in slots, before anything is taken off it.
 *
 * The quarter is a parameter rather than a read, and that is the whole
 * reason this function takes an argument instead of a state: the shortage
 * that costs the quarter is C1's rule and lives in ./larder, and a copy
 * of it here would be a second answer to a question that already has one.
 * The caller that knows the crew is hungry passes it; the arithmetic of
 * what a quarter off comes to lives here beside the capacity it comes off.
 */
export function cargoSlots(shortRationed: boolean): number {
  return shortRationed
    ? Math.floor(CARGO_SLOTS * SHORT_RATIONS_CARGO)
    : CARGO_SLOTS;
}

/** How many slots the goods in a captain's hold are taking, one a unit. */
export function usedCargoSlots(state: Pick<GameState, "inventory">): number {
  let used = 0;
  for (const item of ITEMS) used += state.inventory?.[item] ?? 0;
  return used;
}

/**
 * How many slots one food's meals are taking. Meals over density.
 *
 * Private to this module, which is where both readers of it live: every
 * screen and every rule that wants a slot count asks for the count it
 * means (see usedStoreSlots and storeRoomMeals below) rather than for the
 * arithmetic underneath it, so the one division this model turns on is
 * written once and cannot be read as a second rule by a module that is
 * not this one.
 */
function slotsForMeals(food: FoodId, meals: number): number {
  return meals / FOODS[food].mealsPerSlot;
}

/** How many slots the pantry is taking, across every lot aboard. */
export function usedStoreSlots(state: Pick<GameState, "larderLots">): number {
  let used = 0;
  for (const lot of state.larderLots ?? []) {
    used += slotsForMeals(lot.food, lot.meals);
  }
  return used;
}

/**
 * The whole hold, for whoever wants to divide by it.
 *
 * One number, because the plan's utilization reading asks one question:
 * how much of the ship is carrying something. The halves are separate
 * capacities and stay separate everywhere a rule decides what fits, which
 * is the split's own point, and they are one number here because a
 * dashboard reading "how full is this captain's ship" is not a rule.
 */
export function usedHoldSlots(
  state: Pick<GameState, "inventory" | "larderLots">,
): number {
  return usedCargoSlots(state) + usedStoreSlots(state);
}

/** The stores' own size, for the same reader's other half. */
export function storesSlots(): number {
  return STORES_SLOTS;
}

/**
 * How many meals of a food still fit in the stores.
 *
 * Exact rather than conservative: a meal of produce costs a third of a
 * slot, so a hold with a third of a slot free takes exactly one more
 * meal of it, and that is the answer a captain deciding whether to buy
 * one more leg should get. Floored, because a hold with room for two and
 * a half meals of salt fish takes two.
 *
 * Deliberately not clamped at zero from above: a hold over its ceiling
 * (see the module header) answers with a negative room, and the reader
 * that cares clamps it. Callers deciding whether something fits ask
 * whether the room is at least what they want, which a negative answers
 * correctly.
 */
export function storeRoomMeals(
  state: Pick<GameState, "larderLots">,
  food: FoodId,
): number {
  const free = STORES_SLOTS - usedStoreSlots(state);
  return Math.floor(free * FOODS[food].mealsPerSlot);
}

/**
 * The most meals the pantry could possibly hold, which is the densest
 * food in every slot it has. Read by the Larder's own normalizer, so a
 * save whose count is legal under the model is not trimmed by a reader
 * that only knew the old ceiling. Nothing in play ever reaches it; it is
 * an end, not a target.
 */
export function storesMealCeiling(): number {
  let densest = 0;
  for (const food of Object.keys(FOODS) as FoodId[]) {
    densest = Math.max(densest, FOODS[food].mealsPerSlot);
  }
  return STORES_SLOTS * densest;
}
