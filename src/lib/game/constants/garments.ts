// Garments and cold rounds. A cold round asks for two warmth: fresh Cotton
// Clothes meets it exactly, Brocade exceeds it and Linen Clothes alone
// falls short. Three rounds in ten are cold.

export type GarmentSpec = { warmth: number; durability: number };
export const GARMENTS: Record<string, GarmentSpec> = {
  "Linen Clothes": { warmth: 1, durability: 6 },
  "Cotton Clothes": { warmth: 2, durability: 8 },
  Brocade: { warmth: 3, durability: 10 },
};
export const COLD_ROUND_WARMTH = 2;
export const COLD_ROUND_CHANCE = 0.3;
// Durability lost per round, doubled on a cold round. Frostbite lands on a cold
// round, so it shares that value rather than carrying a third constant.
export const GARMENT_DECAY_PER_ROUND = 1;
export const GARMENT_DECAY_COLD_ROUND = 2;

// What a worn out garment fetches. The harbor buys rags and the Loom sells
// them at this same price, so a balance pass moves both ends together.
export const RAG_SCRAP_VALUE = 4;

// Loom refit prices. A mend recovers one point for five Gold; a refit
// recovers three in one round, up to the garment's own maximum. A reweave
// turns two rags into Linen Clothes, matching its recipe minus the worker
// and the hemp; the smoke check keeps the two counts in step. The quay's
// rag pile appears only after a cold round and is per captain, not a shared
// shelf, because each client draws it locally.
export const MEND_GOLD_PER_POINT = 5;
export const MEND_POINTS = 1;
export const REFIT_POINTS = 3;
export const REWEAVE_GOOD = "Linen Clothes";
export const REWEAVE_RAGS = 2;
export const RAGS_AT_PORT_COLD = 3;
