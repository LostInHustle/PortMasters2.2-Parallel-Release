// Provisions, food catalogues, hold capacities and Supply Barge prices.
// These are balance values; the rules that read them live in ./larder,
// ./foods, ./hold and ../engine/barge.

import type { TagList } from "./tags";

export const RATION_PRICE = 2;
export const LARDER_START = 12;
export const LARDER_MAX = 60;

/** Yield multiplier while the crew is on short rations. */
export const SHORT_RATIONS_YIELD = 0.5;

export type FoodId = "Grain" | "Salt Fish" | "Produce";

type FoodSpec = {
  /** Meals carried per hold slot. */
  mealsPerSlot: number;
  /** Rounds the food stays edible, or null if it keeps indefinitely. */
  keeps: number | null;
  icon: string;
};

export const FOODS: Record<FoodId, FoodSpec> = {
  Grain: { mealsPerSlot: 1, keeps: null, icon: "🌾" },
  "Salt Fish": { mealsPerSlot: 2, keeps: 6, icon: "🐟" },
  Produce: { mealsPerSlot: 3, keeps: 2, icon: "🥬" },
};

/** Eat what spoils soonest first; lots within a food are oldest first. */
export const FOODS_DRAW_ORDER: readonly FoodId[] = [
  "Produce",
  "Salt Fish",
  "Grain",
];

/** Food is cargo, so it carries the same tag vocabulary as trade goods. */
export const FOOD_TAGS: Record<FoodId, TagList> = {
  Grain: ["preserved"],
  "Salt Fish": ["preserved"],
  Produce: ["perishable"],
};

/** Cargo is the trading hold; stores is the larder's meal ceiling. */
export const CARGO_SLOTS = 30;
export const STORES_SLOTS = LARDER_MAX;

/** A hungry crew loses a quarter of its cargo capacity, never its stores. */
export const SHORT_RATIONS_CARGO = 0.75;

/** Preserve at a port: three meals of produce become two of salt fish. */
export const PRESERVE_MEALS_IN = 3;
export const PRESERVE_MEALS_OUT = 2;

/**
 * The Supply Barge charges a multiple of the ration price and sells at most
 * this many rations per round. The lot is derived from port and round, not
 * stored, so two clients cannot disagree about the shelf.
 */
export const BARGE_PRICE_MULTIPLIER = 1.8;
export const BARGE_RATIONS_PER_ROUND = 8;
