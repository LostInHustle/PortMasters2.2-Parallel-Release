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

// How many module slots this hull has open, which is the one place the
// slot ladder is worked out: a hull takes one more module for every level
// it climbs, and the climb ends at ship level three (see MAX_SHIP_LEVEL
// in ../constants/ships), so the top of the ladder is three slots.
//
// It was three copies of the same comparison before F3 needed a fourth
// (the shipyard's own slot line, the draft's install-or-swap label and the
// nudge that points a captain at an empty slot), and the reason it is a
// reader rather than a fourth copy is what the copies already disagreed
// about: a hull can read as over its slots, because a module trade settles
// on two machines that cannot see each other's hulls and the buyer's side
// bolts the module on rather than losing it (see applyModuleTradeSide in
// ./modules). A subtraction floors at zero and says "full" for an
// overfilled hull, which is the answer every one of those readers wants;
// a comparison would need each of them to remember which way a negative
// count reads.
export function moduleSlotsOpen(
  state: Pick<GameState, "shipLevel" | "equippedModules">,
): number {
  return Math.max(0, state.shipLevel - state.equippedModules.length);
}

// "Gold" is folded in as just another tradeable item type for bartering
// (see BARTER_ITEMS in ../constants), so anything that reads or writes an
// amount by item name goes through these two rather than reaching into
// state.money / state.inventory directly.
//
// The Gold branch carries the same fallback its sibling always had: the
// inventory's values are scrubbed to numbers by the load
// (normalizeInventory), while the purse itself arrives as whatever the
// save holds, and one damaged blob with a null purse turned every
// affordability read into a comparison against NaN, which reads as
// unaffordable everywhere, and let a trade settle its fee at zero while
// the seller was still credited the agreed price. An unreadable purse now
// reads as empty.
export function getOwnedAmount(state: GameState, item: string): number {
  return item === "Gold" ? state.money || 0 : state.inventory[item] || 0;
}

// Exported here because the modules split out of engine.ts need it, but
// deliberately NOT forwarded from the engine barrel: it was private to
// engine.ts before the split and stays private to the engine from the
// outside, so the public surface is unchanged.
export function addOwnedAmount(state: GameState, item: string, delta: number) {
  if (item === "Gold") state.money += delta;
  else state.inventory[item] = (state.inventory[item] || 0) + delta;
}
