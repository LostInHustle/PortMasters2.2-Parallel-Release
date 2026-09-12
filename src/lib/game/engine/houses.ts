// =====================================================================
// Great Houses.
//
// A captain's chosen House is a persistent, account level identity that
// colours a voyage without unbalancing it. Each House grants one small,
// thematic perk at the start of every fresh voyage and nothing else: no
// monthly fee, no gating, no perk that scales with Renown. The point is a
// flavourful leaning rather than a power pick, which is why every perk is
// either a one shot discount or a flat per round nudge rather than a
// multiplier on the things that compound.
//
// The three Houses map onto the three cornerstones of the voyage loop:
// Jade Pavilion rewards craft (the artisan economy), Vermilion Gate
// rewards trade (the market and cargo economy), Golden Lotus rewards risk
// (the wager economy). Captains can switch Houses between voyages from
// the Lobby; applyHousePerkAtStart runs on the next fresh start, never
// mid voyage.
//
// HouseId lives in ./legacy.ts so both the persistence layer (which
// writes the chosen House onto the CaptainLegacy row) and this module
// can read it without one importing the other.
// =====================================================================
import type { HouseId } from "../legacy";
import type { GameState, HousePerks } from "../types";

// The perk flags of a captain who has pledged to no House, which is also
// what a voyage saved before any House existed should read as. Exported so
// the empty set has one definition: a field added here and forgotten in a
// hand written copy elsewhere is a crash waiting on the first captain to
// load a save from before that field, which is exactly the trap the save
// normaliser in use-game-session.ts would otherwise have to dodge by hand.
export function noHousePerks(): HousePerks {
  return {
    jadeFreeHireAvailable: false,
    vermilionExtraCard: false,
    goldenWageDiscount: false,
    goldenPirateBump: false,
  };
}

export type House = {
  id: HouseId;
  name: string;
  icon: string;
  motto: string;
  // One sentence, plain language. Shown on the Lobby's House picker and
  // the Legacy card. No dashes; natural speech only.
  perk: string;
};

export const HOUSES: House[] = [
  {
    id: "jade_pavilion",
    name: "Jade Pavilion",
    icon: "🪷",
    motto: "Patience polishes the stone.",
    perk: "Your first artisan each voyage joins at no cost: the first wage is on the House.",
  },
  {
    id: "vermilion_gate",
    name: "Vermilion Gate",
    icon: "🏮",
    motto: "The gate is open to every cargo.",
    perk: "One more cargo lot joins your Port Purchase board, every round.",
  },
  {
    id: "golden_lotus",
    name: "Golden Lotus",
    icon: "🏵️",
    motto: "Fortune favours the bold wager.",
    perk: "Wages cost 20% less, but pirate raids strike 5% more often.",
  },
];

// Applied once, at the head of createInitialGameState (or restartGame,
// which delegates to it), before the first Boon draft and before the
// first market is rolled. Stamps the chosen House onto the state and
// flips the per voyage perk flags the rest of the engine reads.
//
// The perk flags live on state.housePerks (a dedicated sub object) rather
// than on state.modifierFlags, for two reasons: the ModifierKey union is
// pinned to the Boon and module set, so a House key would have to be
// wedged into that union; and endRound resets modifierFlags wholesale at
// the end of every round, which would sweep a per voyage House perk away
// the first time it fired. housePerks is reset only by a fresh voyage.
//
// Jade Pavilion's free first artisan is consumed by hireWorker the first
// time it runs after this; Vermilion Gate's extra card is read by
// startPhase1; Golden Lotus's wage discount stacks with hire_discount in
// getHireCost, and its pirate bump stacks with the broker corruption leak
// in resolvePirateAttack. None of those modules import this one: they
// read the flags straight off the state.
export function applyHousePerkAtStart(
  state: GameState,
  houseId: HouseId | null,
): void {
  state.houseId = houseId;
  state.housePerks = {
    jadeFreeHireAvailable: houseId === "jade_pavilion",
    vermilionExtraCard: houseId === "vermilion_gate",
    goldenWageDiscount: houseId === "golden_lotus",
    goldenPirateBump: houseId === "golden_lotus",
  };
}
