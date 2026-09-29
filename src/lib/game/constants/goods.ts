// =====================================================================
// Content tiers. The founding trade (tier 0) is what every voyage starts
// with; each charter a difficulty schedules opens the next tier of goods,
// ports, and artisans (see tierUnlock in ./difficulty). Fair Winds never
// leaves tier 0, which is what keeps the entry tier exactly the game it
// has always been.
//
// Tier 2 is authored in a following pass, so its arrays are deliberately
// empty: a difficulty that unlocks tier 2 today simply gains nothing yet,
// rather than referencing goods that have no price or recipe.
// =====================================================================
export const RESOURCES_TIER0 = ["Hemp", "Silk", "Tea"] as const;
export const RESOURCES_TIER1 = ["Porcelain Clay", "Copper Ore"] as const;
export const RESOURCES_TIER2 = ["Spices", "Pearls"] as const;
export const RESOURCES = [
  ...RESOURCES_TIER0,
  ...RESOURCES_TIER1,
  ...RESOURCES_TIER2,
] as const;

export const PRODUCTS_TIER0 = [
  "Linen Clothes",
  "Cotton Clothes",
  "Brocade",
  "Sachet",
] as const;
export const PRODUCTS_TIER1 = ["Bronze Mirror", "Celadon Ware"] as const;
export const PRODUCTS_TIER2 = ["Foreign Balm", "Pearl String"] as const;
export const PRODUCTS = [
  ...PRODUCTS_TIER0,
  ...PRODUCTS_TIER1,
  ...PRODUCTS_TIER2,
] as const;
// [D4: Loom: the Refit] The worn out end of a garment, and the one good in
// this catalogue the market board never trades. It is named here with the
// other goods rather than down beside the rest of the Loom's arithmetic,
// because the hold, the icons and the colours are all built from the names
// in this block and the name has to exist before the catalogue below reads
// it. What it is worth, and what it turns back into, live with the numbers
// that do that arithmetic (see the D4 block further down).
export const RAGS = "Rags";

// Every tradable good across every tier, unlocked or not. This is the
// catalogue the cargo hold is built from, so a key exists for each good from
// the moment a voyage starts and no write can ever land on an absent key.
//
// The market's own goods are named one line up from the hold's, because the
// two stopped being the same list the day Rags arrived. Rags is cargo: it
// takes a slot, it is priced, and it is bought and sold in this file. What
// it is not is a market good, since the plan gives one path the exclusive
// right to buy it, so its only seller is the harbor's own pile and its only
// shelf is the Loom's bench. A panel that lists what the market trades reads
// MARKET_GOODS, and a panel that counts what a hold can carry reads ITEMS,
// which is the difference between the price reference and the Ledger.
export const MARKET_GOODS = [...RESOURCES, ...PRODUCTS] as const;
export const ITEMS = [...MARKET_GOODS, RAGS] as const;

// The stock a captain begins a voyage with. Anything not named here starts at
// zero; the hold is filled in from ITEMS rather than listed by hand, so a good
// a charter introduces is always represented.
export const STARTING_STOCK: Record<string, number> = {
  Hemp: 8,
  Silk: 5,
  Tea: 3,
};

// Anything a captain can put up for barter: Gold plus every raw material
// and finished good. Kept separate from RESOURCES/PRODUCTS (rather than
// folding Gold into one of those) so the existing buying/inventory
// listings that iterate those two arrays don't suddenly pick up Gold.
export const BARTER_ITEMS = ["Gold", ...RESOURCES, ...PRODUCTS] as const;

// Flexible bartering is the free form offer board a captain reaches from
// the harbor chat or from a private thread, as opposed to the Captain's
// Exchange on the round interface and any scripted swap the engine
// resolves on its own. It is deliberately the strongest social tool in the
// game: an offer moves goods outside the market entirely, from any phase,
// to any captain in the room. Two limits hold it in check, and both live
// here so that a screen and the server can never disagree about either one.
//
// The first limit is who may take part. Both captains have to be at Renown
// Level 10, the level the flexible composer opens at, before either end of
// a trade is allowed, not merely the captain posting it. Gating the poster
// alone would leave the sharper half of the problem open, because the
// captain doing the harder job in a swap is the one accepting: they are the
// one who has to judge whether what is on the other side is worth what it
// costs them. Requiring both sides also keeps the feature alive in a mixed
// room, since two level 10 captains can still trade with each other while a
// newer captain sits at the same table, and no room is ever vetoed by its
// least established member. None of this reaches the Captain's Exchange,
// which is open to every captain at every level.
//
// The second limit is how often. One completed trade per voyage at level
// 10, two at level 15. The allowance is spent by a completed trade and
// never by posting, so while any of it is left a captain may advertise the
// same intent in several places at once and take whichever answer arrives
// first. Only the poster's own allowance is ever spent, and posting is
// refused only once it is gone: accepting is not rationed on either
// surface, so a captain whose offers have all been taken can still take
// anyone else's.
export const FLEXIBLE_BARTER_UNLOCK_LEVEL = 10;
export const FLEXIBLE_BARTER_SECOND_ATTEMPT_LEVEL = 15;

export const RECIPES: Record<
  string,
  { materials: Record<string, number>; value: number; worker_type: string }
> = {
  "Linen Clothes": { materials: { Hemp: 2 }, value: 15, worker_type: "weaver" },
  "Cotton Clothes": {
    materials: { Hemp: 2, Silk: 1 },
    value: 35,
    worker_type: "weaver",
  },
  Brocade: { materials: { Silk: 3 }, value: 60, worker_type: "master" },
  Sachet: {
    materials: { Silk: 1, Tea: 2 },
    value: 80,
    worker_type: "sachet_maker",
  },
  "Bronze Mirror": {
    materials: { "Copper Ore": 3 },
    value: 45,
    worker_type: "coppersmith",
  },
  "Celadon Ware": {
    materials: { "Porcelain Clay": 3 },
    value: 65,
    worker_type: "potter",
  },
  "Foreign Balm": {
    materials: { Spices: 2, Silk: 1 },
    value: 85,
    worker_type: "perfumer",
  },
  "Pearl String": {
    materials: { Pearls: 2, Silk: 1 },
    value: 105,
    worker_type: "jeweler",
  },
};

// Silk itself, and every finished good a captain makes from it. Derived
// from RECIPES rather than listed by hand: the hand written list this
// replaces named one good at a given Silk ratio and missed two others at
// the identical ratio, so the Silk Winds boon and the Silk Road Monopoly
// module quietly did nothing for the two most valuable goods in the game.
// A good added tomorrow is covered the moment its recipe is written.
export const SILK_GOODS: readonly string[] = [
  "Silk",
  ...Object.entries(RECIPES)
    .filter(([, recipe]) => (recipe.materials.Silk ?? 0) > 0)
    .map(([good]) => good),
];

export const COMMODITIES: Record<
  string,
  { ports: string[]; basePrice: [number, number] }
> = {
  Hemp: { ports: ["Quanzhou Port", "Ningbo Port"], basePrice: [3, 6] },
  Silk: { ports: ["Hangzhou Port", "Yangzhou Port"], basePrice: [6, 10] },
  Tea: { ports: ["Guangzhou Port", "Quanzhou Port"], basePrice: [10, 14] },
  "Porcelain Clay": {
    ports: ["Quanzhou Port", "Fuzhou Port"],
    basePrice: [8, 12],
  },
  "Copper Ore": {
    ports: ["Guangzhou Port", "Goryeo Port"],
    basePrice: [10, 15],
  },
  Spices: { ports: ["Srivijaya Port", "Dashi Port"], basePrice: [14, 20] },
  Pearls: {
    ports: ["Guangzhou Port", "Srivijaya Port"],
    basePrice: [16, 24],
  },
};

export const PRODUCT_PRICES: Record<string, [number, number]> = {
  "Linen Clothes": [30, 42],
  "Cotton Clothes": [50, 65],
  Brocade: [70, 90],
  Sachet: [95, 120],
  "Bronze Mirror": [55, 72],
  "Celadon Ware": [78, 100],
  "Foreign Balm": [100, 130],
  "Pearl String": [125, 160],
};

// Relative draw weights for the port market, not probabilities: the engine
// normalizes them across whichever resources are currently unlocked (see
// genResourceCard). Weights rather than fixed probabilities is what keeps the
// founding trio at exactly 0.40 / 0.35 / 0.25 while tier 0 is all that is
// open, so Fair Winds draws precisely the market it always did, while the
// newer goods stay rarer than the staples once a charter opens.
export const RESOURCE_WEIGHTS: Record<string, number> = {
  Hemp: 40,
  Silk: 35,
  Tea: 25,
  "Porcelain Clay": 14,
  "Copper Ore": 12,
  Spices: 8,
  Pearls: 6,
};
