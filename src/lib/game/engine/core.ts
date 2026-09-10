// =====================================================================
// The handful of primitives the rest of the engine is built on.
//
// These are split out first, and on their own, because almost every other
// engine module calls at least one of them: pricing and orders ask whether
// a module is equipped, and bartering, purchasing and every other transfer
// of goods reads and writes amounts by item name. Leaving them inside any
// one subsystem would make that subsystem an import target for all the
// others for no reason other than history.
// =====================================================================
import type { GameState } from "../types";

export function hasModule(state: GameState, id: string): boolean {
  return state.equippedModules.some((m) => m.id === id);
}

// "Gold" is folded in as just another tradeable item type for bartering
// (see BARTER_ITEMS in ../constants), so anything that reads or writes an
// amount by item name goes through these two rather than reaching into
// state.money / state.inventory directly.
export function getOwnedAmount(state: GameState, item: string): number {
  return item === "Gold" ? state.money : state.inventory[item] || 0;
}

// Exported here because the modules split out of engine.ts need it, but
// deliberately NOT re-exported from the engine barrel: it was private to
// engine.ts before the split and stays private to the engine from the
// outside, so the public surface is unchanged.
export function addOwnedAmount(state: GameState, item: string, delta: number) {
  if (item === "Gold") state.money += delta;
  else state.inventory[item] = (state.inventory[item] || 0) + delta;
}
