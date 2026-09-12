// =====================================================================
// The one risk the settlement phase turns on: whether raiders find the
// hold this round, and the escort a captain can buy to rule that out.
//
// Both are resolved by the same one shot latch, state.pirateAttackResolved,
// which is why they belong together. Whichever runs first closes the
// round's waters, so hiring an escort after the roll is refused and rolling
// again after an escort cannot happen.
// =====================================================================
import {
  difficultyConfig,
  escortRateFor,
  pirateChanceFor,
} from "../difficulty";
import type { GameState } from "../types";
import { hasModule } from "./core";

// Resolved once per round, right after production and before wages or
// maintenance come due, so a hit here can be exactly what tips a captain
// into needing a financial aid request. Personal luck, the same as the
// Salvage Crane refund or the Tax Evasion audit elsewhere in the engine:
// rolled client side, never a room wide checkpoint.
// The chance this round's raid is actually rolled against, with every
// modifier folded in: the room's tier, a corrupt broker's leak, Golden
// Lotus's extra raids, the Deep Sea Escort Pact's reduction, and the Persian
// Dome Compass.
//
// Exported so the Settlement panel can print the number the roll uses rather
// than rebuilding it. It used to rebuild it by hand from the tier and the
// leak alone, which quietly left out both reductions, so a captain holding
// the Escort Pact was shown the unhalved odds and then advised to buy an
// escort on the strength of a figure twice what they actually faced.
export function pirateChance(state: GameState): number {
  // [DIFFICULTY] Raid chance comes from the room's tier, stepping up past the
  // midpoint on the harder tiers (see pirateChanceFor). A raid still takes
  // every coin, so severity is unchanged; only the odds move.
  const base = pirateChanceFor(
    state.difficulty,
    state.currentRound,
    state.maxRounds,
  );
  // A corrupt broker's leak (see purchaseIntel) adds a one time bump on top.
  const leak = state.brokerTippedPirates
    ? difficultyConfig(state.difficulty).brokerCorruptionRisk
    : 0;
  let chance = Math.min(1, base + leak);
  // Golden Lotus's bargain draws raiders: five percent more often than the
  // tier alone would, on top of whatever a tipped broker already added. It
  // is applied before the reductions below so it stays a relative increase
  // in risk whatever else the captain has done to soften the odds.
  if (state.housePerks.goldenPirateBump) chance = Math.min(1, chance * 1.05);
  if (state.modifierFlags.pirate_risk_discount)
    chance *= 1 - state.modifierFlags.pirate_risk_discount;
  if (hasModule(state, "persian_dome_compass")) chance *= 0.7;
  return chance;
}

// The Gold an escort actually costs, with its one modifier applied. Exported
// on the same reasoning as pirateChance above: the panel quoted the plain
// tier rate while the charge applied the Escort Pact, so the button offered
// one price and took another.
export function escortCost(state: GameState): number {
  let rate = escortRateFor(state.difficulty);
  if (state.modifierFlags.escort_discount)
    rate *= 1 - state.modifierFlags.escort_discount;
  return Math.floor(state.money * rate);
}

export function resolvePirateAttack(state: GameState, logs: string[]) {
  if (state.pirateAttackResolved) return;
  state.pirateAttackResolved = true;
  if (Math.random() < pirateChance(state)) {
    const lost = state.money;
    state.money = 0;
    logs.push(`🏴‍☠️ Pirates raided your hold! Lost all ${lost} Gold.`);
  } else {
    logs.push("🌊 Clear seas. No pirates sighted this round.");
  }
}

// Guarantees safety from the roll above for a share of current Gold,
// instead of risking it. Only available before the attack resolves;
// resolving it the other way (the function above) is what closes this
// off for the round, same as resolving it here closes off that one.
export function hireEscort(state: GameState, logs: string[]) {
  if (state.pirateAttackResolved) {
    logs.push("❌ Too late, this round's waters are already resolved");
    return;
  }
  const cost = escortCost(state);
  state.money -= cost;
  state.escortHired = true;
  state.pirateAttackResolved = true;
  logs.push(
    `🛡️ Hired an escort for ${cost} Gold. Safe passage guaranteed this round.`,
  );
}
