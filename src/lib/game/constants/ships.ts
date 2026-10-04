// What one ship level takes off every freight bill, and what the
// upgrade screen promises for the next one. Read by both pricing
// functions and by the two panels that quote it.
export const SHIP_DISCOUNT_PER_LEVEL = 5;

// The last ship level there is. upgradeShip refuses past it and the
// shipyard stops offering the button, and the two had the 3 written out
// separately.
export const MAX_SHIP_LEVEL = 3;

// The upgrade fee ladder: what the yard charges to move the hull from
// level 0 to 1, 1 to 2, and 2 to the top. The initial state seeds
// shipUpgradeCost with a copy of it (see createInitialGameState in
// ../types.ts) and the load heals a damaged ladder against it, so the
// number a captain is quoted, the number the yard charges, and the number
// a healed save falls back to are one ladder rather than three spellings.
export const SHIP_UPGRADE_LADDER: readonly number[] = [15, 25, 40];

// Voyage length, raid odds, the escort fee, and how many cards each board
// rolls all used to be flat constants in this file. They vary by difficulty
// tier now, so they live in ./difficulty instead; the fair_winds tier carries
// the exact values this file used to hold. The starting fixed cost still
// lives directly on the initial GameState (see createInitialGameState in
// ../types.ts), and the upgrade ladder above is seeded onto it from here;
// the intel cost per Broker rumor is
// derived on the fly from whether the Broker's Network module is equipped
// (see getIntelCost in ./engine/pricing.ts).
