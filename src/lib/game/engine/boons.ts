// =====================================================================
// The two things a captain chooses rather than earns: the Boon drafted at
// the head of every round, and the ship Modules bolted on in the shipyard.
//
// Both are drafts with a once per round reroll, but they are deliberately
// priced differently. A Boon reroll costs Gold, because the pool is the
// only scarce thing about it. A Module reroll is free, because the scarce
// thing there is the equippable slot, not the offer.
//
// The module_swap flow is the subtle part. Picking a module with a slot
// free installs it and drops it from the pool immediately, since the pick
// is final. Picking one with every slot full does neither: it parks the
// choice in _newModule and waits, leaving the pool untouched so that
// backing out with "Back to Draft" still shows every original option.
// Only finalizeModuleSwap, once a slot has actually been given up, takes
// it out of the pool. Reversing those two would duplicate a module or
// lose one.
//
// draftBoons weights the offer against the captain's own position, which
// is why it reads inventory and roster before picking.
// =====================================================================
import {
  BOON_SWAP_COST,
  BOONS,
  type Boon,
  type Module,
} from "../constants/drafts";
import { MAX_SHIP_LEVEL, SHIP_DISCOUNT_PER_LEVEL } from "../constants/ships";
import { settleHunger } from "../crew";
import { feedCrew } from "../larder";
import { unlockedBoons, unlockedModules } from "../pools";
import { weightedPick } from "../rng";
import type { GameState } from "../types";
import { resetEscortLeg } from "./contracts";
import { resetConsentLedger } from "./consent";

function draftBoons(state: GameState): Boon[] {
  const gs = {
    money: state.money,
    inventory: state.inventory,
    weavers: state.workers.weaver ?? [],
    master_weavers: state.workers.master ?? [],
    sachet_makers: state.workers.sachet_maker ?? [],
    coppersmiths: state.workers.coppersmith ?? [],
    potters: state.workers.potter ?? [],
    perfumers: state.workers.perfumer ?? [],
    jewelers: state.workers.jeweler ?? [],
  };
  const weightFuncs: Record<string, () => number> = {
    silk_wind: () =>
      (gs.inventory["Silk"] || 0) > 2 || gs.master_weavers.length > 0
        ? 2.5
        : 0.8,
    favorable_tides: () => 1.5,
    merchant_charm: () => (gs.money > 40 ? 2.0 : 0.5),
    artisan_inspiration: () =>
      gs.weavers.length + gs.master_weavers.length + gs.sachet_makers.length > 0
        ? 3.0
        : 0.0,
    emergency_loan: () => (gs.money < 30 ? 4.0 : 0.2),
    tax_shelter: () => 1.5,
    hemp_monopoly: () =>
      (gs.inventory["Hemp"] || 0) < 5 || gs.weavers.length > 0 ? 2.0 : 1.0,
    master_apprentice: () => 1.5,
    // Tier 1 unlocks only once the first charter has opened, so a captain
    // who hasn't reached that round yet simply never sees them. Once
    // unlocked, their weights are tuned to the conditions they reward.
    farsight: () => (gs.money < 40 ? 2.5 : 1.2),
    kiln_and_forge_guild: () =>
      (gs.inventory["Copper Ore"] ?? 0) > 1 ||
      (gs.inventory["Porcelain Clay"] ?? 0) > 1
        ? 2.8
        : 1.0,
    frontier_tariff_relief: () =>
      gs.sachet_makers.length > 0 || gs.master_weavers.length > 0 ? 3.0 : 0.8,
    // Tier 2 preferences, same gating contract as tier 1 above.
    exotic_treasures: () =>
      (gs.inventory["Spices"] ?? 0) > 1 || (gs.inventory["Pearls"] ?? 0) > 1
        ? 3.0
        : 1.0,
    deep_sea_escort_pact: () => (gs.money > 60 ? 1.8 : 3.2),
    merchants_converge: () => 1.6,
  };
  const available = unlockedBoons(state.difficulty, state.currentRound)
    .map((b) => [b, weightFuncs[b.id]()] as [Boon, number])
    .filter(([, w]) => w > 0);
  const picks: Boon[] = [];
  const pool = [...available];
  for (let i = 0; i < 3; i++) {
    if (!pool.length) break;
    const chosen = weightedPick(Math.random, pool);
    picks.push(chosen);
    pool.splice(
      pool.findIndex((x) => x[0].id === chosen.id),
      1,
    );
  }
  return picks;
}

function applyBoon(state: GameState, boon: Boon, logs: string[]) {
  state.modifierFlags = boon.modifiers;
  if (boon.modifiers.instant_gold) {
    state.money += boon.modifiers.instant_gold;
    logs.push(`💰 Boon applied: Gained ${boon.modifiers.instant_gold} Gold!`);
  }
}

export function upgradeShip(state: GameState, logs: string[]) {
  if (state.shipLevel >= MAX_SHIP_LEVEL) return;
  const cost =
    state.shipUpgradeCost[state.shipLevel] + state.shipUpgradePenalty;
  if (state.money < cost) {
    logs.push(`❌ Need ${cost} Gold to upgrade the ship`);
    return;
  }
  state.money -= cost;
  state.shipLevel++;
  logs.push(
    `🎉 Ship Upgraded to Level ${state.shipLevel}! +1 Module Slot, ` +
      `+${SHIP_DISCOUNT_PER_LEVEL} Discount`,
  );
}

// The two modules that carry a lasting cost for as long as they are
// installed, and the accounting that undoes it. It is one function rather
// than two lines at each site because there are now two ways a module
// leaves a ship: a swap at the yard, and the harbor taking the whole ship
// off a marooned captain (see ./seats). A second copy of these two lines
// is how a captain whose hull went to the harbor would keep paying the
// surcharge for a module that went with it.
//
// [REFACTOR] brokers_network used to set state.intelCost = 5 here on
// unequip (and = 2 on equip below). With intelCost now derived from
// hasModule(state, "brokers_network") in ./pricing.ts#getIntelCost,
// these writes are dead and the field is gone from GameState; the
// discount is read live off the equipped set, so equip and unequip no
// longer need to keep a parallel field in sync.
export function unequipModuleAccounting(state: GameState, mod: Module): void {
  if (mod.id === "bulk_hauler") state.shipUpgradePenalty -= 15;
  if (mod.id === "overdrive_engine") state.maintenancePenalty -= 10;
}

function equipModule(
  state: GameState,
  mod: Module,
  swapIdx: number | null,
  logs: string[],
) {
  if (swapIdx !== null) {
    const old = state.equippedModules[swapIdx];
    unequipModuleAccounting(state, old);
    // [REFACTOR] brokers_network used to set state.intelCost = 5 here on
    // unequip (and = 2 on equip below). With intelCost now derived from
    // hasModule(state, "brokers_network") in ./pricing.ts#getIntelCost,
    // these writes are dead and the field is gone from GameState; the
    // discount is read live off the equipped set, so equip and unequip no
    // longer need to keep a parallel field in sync.
    state.equippedModules[swapIdx] = mod;
    logs.push(`🔄 Swapped ${old.name} for ${mod.name}!`);
  } else {
    if (state.equippedModules.length < state.shipLevel) {
      state.equippedModules.push(mod);
      logs.push(`✅ Installed ${mod.name}!`);
    } else {
      logs.push("❌ No empty slots! Must swap.");
      return;
    }
  }
  if (mod.id === "bulk_hauler") state.shipUpgradePenalty += 15;
  if (mod.id === "overdrive_engine") state.maintenancePenalty += 10;
  // See note above: brokers_network no longer writes state.intelCost.
}

export function startBoonDrafting(state: GameState, logs: string[]) {
  state.phase = "dawn";
  // [C1: the Larder and Short Rations] The crew eats at the top of the leg,
  // and this is the one function every leg opens through: the host's start
  // reaches it from the departure, the round that rolls over reaches it from
  // endRound, and a client catching up to the room reaches it through
  // enterPhase. Putting the meal here rather than at any of those three is
  // what makes it once a leg by construction; the stamp the meal itself
  // keeps is what makes it once a leg anyway, since two of those paths can
  // meet on one client for one Dawn (see feedCrew in ../larder).
  //
  // [C2: crew loss by name] The price of hunger is paid at the same moment
  // and off the same stamp: the meal answers whether this call was the
  // leg's, and only then does the run of hungry legs advance. Settled
  // beside the meal rather than inside it because the Larder counts the
  // mouths and the roster is who they are, so the rule that takes a hand
  // lives in ../crew and reads the Larder rather than the other way around.
  if (feedCrew(state, logs)) settleHunger(state, logs);
  state.boonSwapUsed = false;
  state.moduleSwapUsed = false;
  state._draftChoices = undefined;
  state.boonChoices = draftBoons(state);
  state.pirateAttackResolved = false;
  state.escortHired = false;
  state.brokerTippedPirates = false;
  // [D3: the escort contract] The leg's cover, the leg's pending claim and
  // the leg's settlement ledger go with the rest of the round's facts. A
  // contract covers one leg (see resetEscortLeg in ./contracts), and this is
  // the one function every leg opens through, which is the same reason the
  // meal above is taken here rather than at any of the three entries.
  //
  // [D4: Loom: the Refit] The ledger is the consent primitive's rather than
  // the escort's, so it is emptied by its own function and not inside the
  // call above, and the two stand together here because this is the one place
  // a leg opens. Emptying it is not load bearing for correctness, since the
  // stamp it carries makes a stale list answer for nothing either way (see
  // movementApplied in ./consent), and that is exactly why it has to be
  // written down: what the call buys is that a voyage where nothing more is
  // agreed stops carrying the last leg's keys in every save it writes.
  resetEscortLeg(state);
  resetConsentLedger(state);
  logs.push("\n🧭=== The Navigator's Compass ===");
  logs.push("Choose a Boon to bend the rules of the upcoming voyage...");
}

// Rerolls the current boon pool for BOON_SWAP_COST, once per round. The
// fee (and the cap) exist so a captain can correct for genuinely bad luck
// without being able to free reroll until the pool happens to contain
// whatever they want, see the matching swapModuleChoices below for the no
// cost equivalent on the module side, where the scarcity is the
// equippable slots rather than a gold sink.
export function swapBoonChoices(state: GameState, logs: string[]) {
  if (state.boonSwapUsed) {
    logs.push("❌ You've already swapped your boon choices this round");
    return;
  }
  if (state.money < BOON_SWAP_COST) {
    logs.push(`❌ Need ${BOON_SWAP_COST} Gold to swap boon choices`);
    return;
  }
  state.money -= BOON_SWAP_COST;
  state.boonChoices = draftBoons(state);
  state.boonSwapUsed = true;
  logs.push(`🔄 Swapped Boon Choices for ${BOON_SWAP_COST} Gold`);
}

// Applies a boon. Returns whether one was actually applied, which is the
// answer its caller needs: the boon draft is left by choosing a boon, so a
// call that matched nothing must not be allowed to move the voyage on.
//
// It used to end by starting the market phase by name, which both pinned the
// draft to one voyage's leg and made the choice and the advance impossible
// to separate.
// The advance belongs to lockInBoon in ./lifecycle now, which is the one place
// allowed to name where a phase leads. The GameContext it used to take went
// with that call, since opening a phase is the only thing here that ever
// needed one.
export function selectBoon(
  state: GameState,
  boonId: string,
  logs: string[],
): boolean {
  const boon = BOONS.find((b) => b.id === boonId);
  if (!boon) return false;
  logs.push(`🧭 Boon Locked In: ${boon.icon} ${boon.name}`);
  applyBoon(state, boon, logs);
  state.boonChoices = [];
  return true;
}

function rollModuleChoices(state: GameState): Module[] {
  const MODULES = unlockedModules(state.difficulty, state.currentRound);
  const available = MODULES.filter(
    (m) => !state.equippedModules.some((eq) => eq.id === m.id),
  );
  const pool = available.length >= 3 ? available : MODULES;
  const picks: Module[] = [];
  const copy = [...pool];
  for (let i = 0; i < 3; i++) {
    if (!copy.length) break;
    const idx = Math.floor(Math.random() * copy.length);
    picks.push(copy.splice(idx, 1)[0]);
  }
  return picks;
}

// Only rolls a fresh pool the first time this is called for the round
// (state._draftChoices reset to undefined by startBoonDrafting above).
// Reopening the draft screen afterwards, including via the
// Back to Shipyard then Draft again loop this whole system exists to
// close off, just reshows whatever the round already has on offer.
export function startModuleDrafting(state: GameState) {
  if (state._draftChoices === undefined) {
    state._draftChoices = rollModuleChoices(state);
  }
  state.phase = "module_draft";
}

// Rerolls the current module pool, once per round, at no cost (unlike the
// boon swap, the scarce resource here is the equippable slots themselves,
// not gold). Available whether or not the pool's already been picked from.
export function swapModuleChoices(state: GameState, logs: string[]) {
  if (state.moduleSwapUsed) {
    logs.push("❌ You've already swapped your module choices this round");
    return;
  }
  if (!state._draftChoices?.length) {
    logs.push("❌ Nothing to swap, draft your modules first");
    return;
  }
  state._draftChoices = rollModuleChoices(state);
  state.moduleSwapUsed = true;
  logs.push("🔄 Swapped Module Choices for a fresh batch");
}

export function handleModuleSelect(
  state: GameState,
  idx: number,
  logs: string[],
) {
  const mod = state._draftChoices?.[idx];
  if (!mod) return;
  if (state.equippedModules.length < state.shipLevel) {
    equipModule(state, mod, null, logs);
    // Direct installs resolve immediately, so the pick is final: drop it
    // from the pool now. A pick that instead needs a slot freed up (the
    // module_swap branch below) isn't final until finalizeModuleSwap
    // actually confirms a slot, so it leaves the pool untouched, backing
    // out via "Back to Draft" should still show every original choice.
    state._draftChoices = state._draftChoices!.filter((m) => m.id !== mod.id);
    state.phase = "dusk";
  } else {
    state._newModule = mod;
    state.phase = "module_swap";
  }
}

// The confirmed half of the module_swap flow: a captain picked a drafted
// module while every slot was full and has now chosen which equipped one
// to give up for it. Only here, not at the initial pick above, does the
// chosen draft option actually leave the pool, since backing out with
// "Back to Draft" up to this point should still offer it.
export function finalizeModuleSwap(
  state: GameState,
  slotIdx: number,
  logs: string[],
) {
  const mod = state._newModule;
  if (!mod) return;
  equipModule(state, mod, slotIdx, logs);
  state._draftChoices = (state._draftChoices ?? []).filter(
    (m) => m.id !== mod.id,
  );
  state._newModule = undefined;
  state.phase = "dusk";
}

// The Shipyard's "Back" button, used to bail out of the module draft
// (phase "module_draft") or the swap picker (phase "module_swap") without
// committing to anything. Resets the captain to the Shipyard phase, which the
// leg calls Dusk, and clears the two transients the draft might have parked:
// the drafted pool itself (`_draftChoices`) and the half chosen swap target
// (`_newModule`). Reopening the draft afterwards rolls a fresh pool, since
// `startModuleDrafting` only skips the roll while `_draftChoices` is
// non undefined.
//
// Note: canceling here does NOT refund a `swapModuleChoices` reroll, on
// purpose. The reroll was already spent the moment the new pool was rolled
// (see `swapModuleChoices`), and the captain got to see that pool before
// choosing to back out. Refunding it would turn the Back button into a
// free "peek at a different pool and keep the one I prefer" toggle, which
// is exactly the free reroll exploit the swap cap exists to close.
export function cancelModuleDraft(state: GameState) {
  state.phase = "dusk";
  state._draftChoices = undefined;
  state._newModule = undefined;
}

// A captain joining a room for the first time should drop into the voyage
// wherever the room currently is rather than back at round 1, otherwise
// they'd never be able to ready up for the same checkpoint as everyone
// else (see the ready check protocol in src/server/realtime/index.ts). This runs
// the same setup calls a normal transition would, just once, up front, so
// a fresh captain lands on a fully formed phase (cards generated, etc.)
// instead of an empty one.
