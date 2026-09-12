// =====================================================================
// PortMasters 2.2 Parallel Release: unlocked content pools
//
// What a captain can actually see this round, given the room's difficulty
// and how far the voyage has run. ./constants owns the content, ./difficulty
// owns the schedule, and this module is the one place the two meet: keeping
// it separate is what lets constants.ts read difficulty copy without the two
// importing each other in a cycle.
//
// Every pool keys off the same unlockedTierFor, so goods, ports, artisans,
// boons, modules, and market breadth can never disagree about what has
// arrived. On Fair Winds the tier is always 0, so every function here returns
// exactly the founding trade and nothing else.
// =====================================================================
import {
  BOONS_TIER0,
  BOONS_TIER1,
  BOONS_TIER2,
  MODULES_TIER0,
  MODULES_TIER1,
  MODULES_TIER2,
  PORTS_TIER0,
  PORTS_TIER1,
  PORTS_TIER2,
  PRODUCTS_TIER0,
  PRODUCTS_TIER1,
  PRODUCTS_TIER2,
  RESOURCES_TIER0,
  RESOURCES_TIER1,
  RESOURCES_TIER2,
  RESOURCE_WEIGHTS,
  WORKER_TYPES,
  type Boon,
  type Module,
  type WorkerType,
} from "./constants";
import { unlockedPool, unlockedTierFor } from "./difficulty";

export function unlockedResources(
  difficulty: unknown,
  roundNo: number,
): string[] {
  return unlockedPool<string>(
    [RESOURCES_TIER0, RESOURCES_TIER1, RESOURCES_TIER2],
    difficulty,
    roundNo,
  );
}

export function unlockedProducts(
  difficulty: unknown,
  roundNo: number,
): string[] {
  return unlockedPool<string>(
    [PRODUCTS_TIER0, PRODUCTS_TIER1, PRODUCTS_TIER2],
    difficulty,
    roundNo,
  );
}

export function unlockedPorts(difficulty: unknown, roundNo: number): string[] {
  return unlockedPool<string>(
    [PORTS_TIER0, PORTS_TIER1, PORTS_TIER2],
    difficulty,
    roundNo,
  );
}

export function unlockedBoons(difficulty: unknown, roundNo: number): Boon[] {
  return unlockedPool<Boon>(
    [BOONS_TIER0, BOONS_TIER1, BOONS_TIER2],
    difficulty,
    roundNo,
  );
}

export function unlockedModules(
  difficulty: unknown,
  roundNo: number,
): Module[] {
  return unlockedPool<Module>(
    [MODULES_TIER0, MODULES_TIER1, MODULES_TIER2],
    difficulty,
    roundNo,
  );
}

// Artisans carry their tier on the type itself rather than living in three
// parallel arrays, so this is a filter rather than an accumulation.
export function unlockedWorkerTypes(
  difficulty: unknown,
  roundNo: number,
): WorkerType[] {
  const tier = unlockedTierFor(difficulty, roundNo);
  return WORKER_TYPES.filter((w) => w.tier <= tier);
}

// The port market's draw table for this round: the unlocked resources, with
// their relative weights normalized into probabilities. While only tier 0 is
// open this yields exactly 0.40 / 0.35 / 0.25, the table the game has always
// used, so an unchanged tier draws an unchanged market from the same seed.
export function unlockedResourceDraw(
  difficulty: unknown,
  roundNo: number,
): { items: string[]; probs: number[] } {
  const items = unlockedResources(difficulty, roundNo);
  const weights = items.map((i) => RESOURCE_WEIGHTS[i] ?? 0);
  const total = weights.reduce((sum, w) => sum + w, 0) || 1;
  return { items, probs: weights.map((w) => w / total) };
}

// Whether a good arrived with a charter rather than being part of the founding
// trade. Used by the charter scoped boon and module effects, which pay out on
// the new lane's goods only.
export function isCharterGood(item: string): boolean {
  return (
    (RESOURCES_TIER1 as readonly string[]).includes(item) ||
    (PRODUCTS_TIER1 as readonly string[]).includes(item) ||
    (RESOURCES_TIER2 as readonly string[]).includes(item) ||
    (PRODUCTS_TIER2 as readonly string[]).includes(item)
  );
}

// The finished goods of each charter wave, told apart.
//
// The two boons that pay on a wave name its goods exactly: Kiln and Forge
// Guild names Celadon Ware and Bronze Mirror, Exotic Treasures names
// Foreign Balm and Pearl String. isCharterGood above answers whether a good
// arrived with a charter at all, which is the right question for the
// Maritime Bureau Token (its text names no wave) and the wrong one here:
// gating both boons on it made them the same boon, since a captain holds
// only one at a time (applyBoon replaces modifierFlags wholesale) and
// whichever they held paid out on either wave.
export function isTier1CharterProduct(item: string): boolean {
  return (PRODUCTS_TIER1 as readonly string[]).includes(item);
}

export function isTier2CharterProduct(item: string): boolean {
  return (PRODUCTS_TIER2 as readonly string[]).includes(item);
}
