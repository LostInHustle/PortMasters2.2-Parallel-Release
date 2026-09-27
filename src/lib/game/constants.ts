// =====================================================================
// PortMasters 2.2 Parallel Release: game constants
// Balance, descriptions, and overall wording are carried over verbatim
// from the original PortMasters build this project branches from; only
// the project's own name has been updated where it appears in this text,
// to match the rebrand (see README.md).
// =====================================================================

import {
  difficultyConfig,
  mandateRounds,
  type Difficulty,
  type DifficultyConfig,
} from "./difficulty";
// The two pieces of copy below state how long the voyage runs, and that is
// the mode's number rather than the tier's alone: a mode whose length is
// pinned sails the same legs on every tier (see voyageLegs in ./mode), so
// the tier's ladder would have the guide quoting a voyage the captain is
// not sailing. Read through the one selector, which returns the tier's own
// ladder for the founding mode and so leaves its copy byte for byte what it
// was.
import { voyageRoundsFor, type GameMode } from "./mode";

// Single source of truth for the project's display name. Every screen,
// log line, and metadata tag that shows the game's name should pull from
// this constant rather than hardcoding the string, so a future rebrand
// only has to happen in one place.
export const APP_NAME = "PortMasters 2.2 Parallel Release";

export const ICONS: Record<string, string> = {
  Gold: "💰",
  Hemp: "🧶",
  Silk: "👘",
  Tea: "🍵",
  "Linen Clothes": "👔",
  "Cotton Clothes": "👕",
  Brocade: "👗",
  Sachet: "🌸",
  "Porcelain Clay": "🧱",
  "Copper Ore": "⛏️",
  "Celadon Ware": "🫖",
  "Bronze Mirror": "🪞",
  Spices: "🌶️",
  Pearls: "🦪",
  "Foreign Balm": "🧴",
  "Pearl String": "📿",
};

export const COLORS: Record<string, string> = {
  Gold: "#D4A017",
  Hemp: "#8B7355",
  Silk: "#DC143C",
  Tea: "#228B22",
  "Linen Clothes": "#D2691E",
  "Cotton Clothes": "#4169E1",
  Brocade: "#8B008B",
  Sachet: "#FF1493",
  "Porcelain Clay": "#8FA5B6",
  "Copper Ore": "#B87333",
  "Celadon Ware": "#6FA292",
  "Bronze Mirror": "#8C7853",
  Spices: "#C1440E",
  Pearls: "#9AA7B1",
  "Foreign Balm": "#C99B6E",
  "Pearl String": "#B9A0E0",
};

// [MANIFEST 16: Colorblind Safe Palette] The set above puts Silk (a
// crimson red) and Tea (a forest green) close enough on the color wheel
// that a red green colorblind captain, the most common form by far, would
// struggle to tell them apart at a glance in the same list. This is a
// second, complete mapping for the same set of goods, built around the
// design technique that actually works for red green colorblindness:
// separate every color by lightness and saturation as well as by hue,
// never by hue alone, and keep any two colors that would clash under
// protanopia or deuteranopia (reds, greens, and browns collapsing toward
// each other) as far apart as possible. Anchored on the Okabe and Ito
// palette, a widely cited set of hues confirmed distinguishable under
// every common form of color vision deficiency. Selecting it changes
// nothing about game rules, balance, or what any other captain sees, only
// how one captain's own client renders a color already being shown to
// them anyway; see useColorPreference in src/lib/use-color-preference.ts
// for where a player turns it on.
export const COLORS_COLORBLIND_SAFE: Record<string, string> = {
  Gold: "#E8A33D",
  Hemp: "#A67C52",
  Silk: "#CC79A7",
  Tea: "#009E73",
  "Linen Clothes": "#0072B2",
  "Cotton Clothes": "#56B4E9",
  Brocade: "#D55E00",
  Sachet: "#F0E442",
  "Porcelain Clay": "#7A93A6",
  "Copper Ore": "#B5651D",
  "Celadon Ware": "#4FA98C",
  "Bronze Mirror": "#7D6852",
  Spices: "#B33F1E",
  Pearls: "#A8B4BD",
  "Foreign Balm": "#C99B6E",
  "Pearl String": "#7B6FA6",
};

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
// Every tradable good across every tier, unlocked or not. This is the
// catalogue the cargo hold is built from, so a key exists for each good from
// the moment a voyage starts and no write can ever land on an absent key.
export const ITEMS = [...RESOURCES, ...PRODUCTS] as const;

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
export const PORTS_TIER0 = [
  "Quanzhou Port",
  "Guangzhou Port",
  "Ningbo Port",
  "Yangzhou Port",
  "Hangzhou Port",
] as const;
export const PORTS_TIER1 = ["Fuzhou Port", "Goryeo Port"] as const;
export const PORTS_TIER2 = ["Srivijaya Port", "Dashi Port"] as const;

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

// The artisan roster. Each type belongs to a content tier and is only
// hirable once that tier's charter has opened. WAGES is derived from this
// rather than repeated, so a wage can never drift between the two.
export type WorkerTypeId =
  | "weaver"
  | "master"
  | "sachet_maker"
  | "coppersmith"
  | "potter"
  | "perfumer"
  | "jeweler";

export type WorkerType = {
  id: WorkerTypeId;
  label: string;
  plural: string;
  icon: string;
  wage: number;
  tier: number;
};

export const WORKER_TYPES: WorkerType[] = [
  {
    id: "weaver",
    label: "Weaver",
    plural: "Weavers",
    icon: "👩‍🔧",
    wage: 8,
    tier: 0,
  },
  {
    id: "master",
    label: "Master Weaver",
    plural: "Masters",
    icon: "👩‍🎨",
    wage: 12,
    tier: 0,
  },
  {
    id: "sachet_maker",
    label: "Sachet Maker",
    plural: "Makers",
    icon: "🌸",
    wage: 20,
    tier: 0,
  },
  {
    id: "coppersmith",
    label: "Coppersmith",
    plural: "Coppersmiths",
    icon: "🪞",
    wage: 12,
    tier: 1,
  },
  {
    id: "potter",
    label: "Potter",
    plural: "Potters",
    icon: "🫖",
    wage: 14,
    tier: 1,
  },
  {
    id: "perfumer",
    label: "Perfumer",
    plural: "Perfumers",
    icon: "🧴",
    wage: 18,
    tier: 2,
  },
  {
    id: "jeweler",
    label: "Jeweler",
    plural: "Jewelers",
    icon: "📿",
    wage: 24,
    tier: 2,
  },
];

export const WORKER_TYPE_IDS: WorkerTypeId[] = WORKER_TYPES.map((w) => w.id);

export function workerType(id: string): WorkerType | undefined {
  return WORKER_TYPES.find((w) => w.id === id);
}

export const WAGES: Record<string, number> = Object.fromEntries(
  WORKER_TYPES.map((w) => [w.id, w.wage]),
);

// Reputation a captain gains for lending Gold to another captain short on
// funds, scaled to the amount so a token loan doesn't pay the same as
// bailing someone out completely. Floored at 1 so even a small loan is
// worth something.
export const AID_REPUTATION_PER_GOLD = 1 / 5;

// The most Reputation one captain can earn in a single voyage from helping
// others, counting lending (AID_REPUTATION_PER_GOLD above) and backing
// (BACKING_REPUTATION_PER_GOLD below) together.
//
// Why there is a ceiling at all: without one this was the only exploit in
// the game that needed no tampering. Two captains agree in chat, one
// requests a large loan, the other grants it and banks a fifth of it as
// Reputation, and the borrower hands the Gold straight back. aid:post
// accepts any whole number, so the pair could repeat that until Reputation
// stopped meaning anything. Capping the total rather than a single loan is
// what closes it: splitting one large loan into ten small ones earns
// exactly the same.
//
// Why it is derived rather than written down: a sixteen round Monsoon
// voyage offers twice the chances to help that an eight round Fair Winds
// one does, and holds far more Gold by its midpoint. One fixed number for
// all three tiers is either mean to the long voyage or generous to the
// short one. Scaling with the tier's own length lets the ceiling breathe,
// and means a tier added later gets a sensible allowance without anyone
// remembering to come back here.
//
// The base covers a captain who is generous early in a short voyage; the
// per round term is what a long voyage adds on top. At the shipped tiers
// that works out to 96, 120 and 144, each worth five times its own number
// in Gold lent, or ten times in Gold pledged and returned whole.
//
// On the longest tier this does pass 100, the Successful Merchant rating.
// That is deliberate and not the loophole it looks like: Reputation earned
// this way requires Gold, and Gold has to be traded for first. A captain
// cannot lend their way up the ladder without having earned the stake to
// lend, so the ladder still measures trading.
const HELPER_REPUTATION_BASE = 48;
const HELPER_REPUTATION_PER_ROUND = 6;

// The cap takes the voyage's own length rather than the room's tier, and
// the caller passes the length the voyage was pinned to (GameState.maxRounds
// through ./engine/aid). Reading the tier here was right while a tier and a
// voyage were the same number of rounds and wrong the moment they were not:
// a Gambit voyage is twelve legs on every tier, so a tier read would hand a
// Fair Winds crew the cap of an eight round voyage and cut them off at
// eighty percent of what they had honestly earned.
export function helperReputationCapFor(voyageRounds: number): number {
  return HELPER_REPUTATION_BASE + HELPER_REPUTATION_PER_ROUND * voyageRounds;
}

export type Boon = {
  id: string;
  name: string;
  icon: string;
  desc: string;
  modifiers: Record<string, number>;
};

export const BOONS_TIER0: Boon[] = [
  {
    id: "silk_wind",
    name: "Silk Winds",
    icon: "🌬️",
    desc: "Transport cost for Silk & Silk products is halved this round.",
    modifiers: { transport_silk_discount: 0.5 },
  },
  {
    id: "favorable_tides",
    name: "Favorable Tides",
    icon: "🌊",
    desc: "Base transport cost reduced by 4 Gold this round.",
    modifiers: { transport_flat_discount: 4 },
  },
  {
    id: "merchant_charm",
    name: "Merchant's Charm",
    icon: "✨",
    desc: "15% discount on all port purchases this round.",
    modifiers: { purchase_discount: 0.15 },
  },
  {
    id: "artisan_inspiration",
    name: "Artisan's Inspiration",
    icon: "🔨",
    desc: "All workers produce +1 extra item this round.",
    modifiers: { worker_bonus_production: 1 },
  },
  {
    id: "emergency_loan",
    name: "Emergency Loan",
    icon: "💰",
    desc: "Gain 40 Gold immediately. No strings attached.",
    modifiers: { instant_gold: 40 },
  },
  {
    id: "tax_shelter",
    name: "Tax Shelter",
    icon: "📜",
    desc: "Income tax rate reduced to 5% this round.",
    modifiers: { income_tax_override: 0.05 },
  },
  {
    id: "hemp_monopoly",
    name: "Hemp Monopoly",
    icon: "🧶",
    desc: "Hemp purchase prices reduced by 2 Gold per unit.",
    modifiers: { hemp_price_reduction: 2 },
  },
  {
    id: "master_apprentice",
    name: "Master's Apprentice",
    icon: "🎓",
    desc: "Hiring workers costs 50% less this round.",
    modifiers: { hire_discount: 0.5 },
  },
];

// Drafted only once the first charter has opened, so they can lean on the
// goods it brings without ever appearing in a voyage that has no use for them.
export const BOONS_TIER1: Boon[] = [
  {
    id: "farsight",
    name: "Farsight",
    icon: "🔮",
    desc: "Reveals one Broker's rumor for free this round.",
    modifiers: { free_intel: 1 },
  },
  {
    id: "kiln_and_forge_guild",
    name: "Kiln and Forge Guild",
    icon: "🏮",
    desc: "Celadon Ware & Bronze Mirror orders pay 15% more this round.",
    modifiers: { charter_order_bonus: 0.15 },
  },
  {
    id: "frontier_tariff_relief",
    name: "Frontier Tariff Relief",
    icon: "🧾",
    desc: "VAT on finished goods is halved this round.",
    modifiers: { vat_discount: 0.5 },
  },
];

export const BOONS_TIER2: Boon[] = [
  {
    id: "exotic_treasures",
    name: "Exotic Treasures",
    icon: "💎",
    desc: "Foreign Balm & Pearl String orders pay 15% more this round.",
    modifiers: { exotic_order_bonus: 0.15 },
  },
  {
    id: "deep_sea_escort_pact",
    name: "Deep Sea Escort Pact",
    icon: "🛡️",
    desc: "Escort cost halved; pirate risk halved this round.",
    modifiers: { escort_discount: 0.5, pirate_risk_discount: 0.5 },
  },
  {
    id: "merchants_converge",
    name: "Merchants Converge",
    icon: "🛍️",
    desc: "One extra trade order appears this round's board.",
    modifiers: { extra_order: 1 },
  },
];

export const BOONS: Boon[] = [...BOONS_TIER0, ...BOONS_TIER1, ...BOONS_TIER2];

// What a boon reroll costs, once per round. The module side has no
// equivalent fee (its scarcity is the equippable slots), so this is the
// boon draft's own dial and lives here rather than beside the shared
// swap policy.
export const BOON_SWAP_COST = 10;

export type Module = { id: string; name: string; icon: string; desc: string };

export const MODULES_TIER0: Module[] = [
  {
    id: "smugglers_hold",
    name: "Smuggler's Hold",
    icon: "🏴‍☠️",
    desc: "Purchase costs down 15%. Income Tax up 20%.",
  },
  {
    id: "bulk_hauler",
    name: "Bulk Hauler Rigging",
    icon: "🏗️",
    desc: "Transport cost down 1 per item. Ship upgrades cost up 15 Gold.",
  },
  {
    id: "artisans_workshop",
    name: "Artisan's Workshop",
    icon: "🛠️",
    desc: "Workers produce +1 item. Wages +20%.",
  },
  {
    id: "tax_evasion",
    name: "Tax Evasion Ledger",
    icon: "📕",
    desc: "Income Tax & VAT halved. 15% chance to lose 20 Gold on order complete (Audit).",
  },
  {
    id: "silk_monopoly",
    name: "Silk Road Monopoly",
    icon: "👘",
    desc: "Silk transport cost is 0. Silk product orders yield +20% reward.",
  },
  {
    id: "brokers_network",
    name: "Broker's Network",
    icon: "🕵️",
    desc: "Intel costs 2 Gold. Reveals 2 rumors per purchase.",
  },
  {
    id: "salvage_crane",
    name: "Salvage Crane",
    icon: "♻️",
    desc: "30% chance to refund transport cost on order complete.",
  },
  {
    id: "overdrive_engine",
    name: "Overdrive Engine",
    icon: "⚙️",
    desc: "Transport cost down 5 Gold. Maintenance up 10 Gold.",
  },
];

// Drafted only once the first charter has opened, same as BOONS_TIER1.
export const MODULES_TIER1: Module[] = [
  {
    id: "bureau_token",
    name: "Maritime Bureau Token",
    icon: "🎫",
    desc: "Charter goods (Porcelain Clay, Copper Ore and their products) pay +10% on orders.",
  },
  {
    id: "kiln_cellar",
    name: "Kiln Cellar",
    icon: "🔥",
    desc: "Porcelain Clay and Copper Ore cost 2 Gold less per unit.",
  },
  {
    id: "ocean_relay",
    name: "Ocean Interpreter",
    icon: "📡",
    desc: "Broker's Whisper reveals 1 extra rumor at no extra cost.",
  },
];

export const MODULES_TIER2: Module[] = [
  {
    id: "foreign_quarter_pass",
    name: "Foreign Quarter Pass",
    icon: "🪪",
    desc: "Spices and Pearls cost 3 Gold less per unit.",
  },
  {
    id: "persian_dome_compass",
    name: "Persian Dome Compass",
    icon: "🧿",
    desc: "Pirate raid risk reduced by 30%.",
  },
  {
    id: "fleet_of_treasures",
    name: "Fleet of Treasures",
    icon: "⛵",
    desc: "Freight on Foreign Balm & Pearl String orders is 3 Gold cheaper per unit.",
  },
];

// What one ship level takes off every freight bill, and what the
// upgrade screen promises for the next one. Read by both pricing
// functions and by the two panels that quote it.
export const SHIP_DISCOUNT_PER_LEVEL = 5;

// The last ship level there is. upgradeShip refuses past it and the
// shipyard stops offering the button, and the two had the 3 written out
// separately.
export const MAX_SHIP_LEVEL = 3;

// [C1: the Larder and Short Rations] The provisions layer's four numbers,
// kept here rather than in the Larder's own module for the reason every
// other number in this file is kept here: a reader looking for what a
// ration costs finds it beside every other price in the game, and a balance
// pass edits them knowing they are prices rather than rules. The rules that
// read them live in ./larder.
//
// The plan names none of these. It says the crew eats, that the Larder is a
// plain number, and that a shortage costs cargo capacity and slows crafting,
// and it leaves every magnitude to the build. So these are the opening tune,
// which is exactly the shape [B2] left its own clocks in: one place to edit,
// and a comment saying so rather than a number pretending to be derived.
//
// They are set against the ladder the rest of the economy already runs on.
// An easy voyage is eight legs with a fifteen Gold maintenance fee a leg and
// wages from eight Gold a head, so a ration at two Gold is a real line
// without being the line that decides a voyage, and a hold of twelve is
// three artisans fed for the whole of a short voyage or one artisan fed for
// as long as any voyage lasts.
export const RATION_PRICE = 2;
export const LARDER_START = 12;
export const LARDER_MAX = 60;

// What a short rationed crew's work comes to, as a fraction of its own
// output. The plan says the shortage slows crafting and gives no number, so
// this is the tune; what it is not is a second place the plan's quarter
// could be spent, because that quarter belongs to the capacity clause the
// same sentence carries and capacity is C4's (see ./larder for where it
// lands instead).
export const SHORT_RATIONS_YIELD = 0.5;

// [C2: crew loss by name] The two things the loss rule needs, kept here
// beside the provisions above for the reason every number in this file is
// kept here: the run is a rule of the same family as the ration price, and
// the pool is content the way WORKER_TYPES is, so a balance pass or a
// content pass both find theirs where they already look.
//
// The run is the plan's own number, and it is written down rather than
// inlined where it is read: "two consecutive legs on Short Rations costs a
// crew member" is the rule, so a later tune that moved it to three should
// cost one edit with the plan's own sentence as the note beside it.
//
// The pool is the crew's names, and the plan asks for names that read as
// people rather than identifiers. It also says the pool is worth a content
// pass of its own once the mechanic is proven, which is the shape this
// list is written to: short enough for a log line, no repeats, and wide
// enough that a voyage never reaches the end of it. Every name is a single
// word so the sentences that carry one stay sentences.
export const CREW_LOSS_AFTER_HUNGRY_LEGS = 2;
export const CREW_NAMES: string[] = [
  "Ada",
  "Adil",
  "Aiko",
  "Amara",
  "Anil",
  "Anouk",
  "Arjun",
  "Asha",
  "Bram",
  "Cassia",
  "Chen",
  "Corin",
  "Dara",
  "Dev",
  "Dilara",
  "Emeka",
  "Enzo",
  "Farah",
  "Fen",
  "Gita",
  "Hakon",
  "Hana",
  "Idris",
  "Imani",
  "Ines",
  "Isolde",
  "Jaya",
  "Jonas",
  "Kavi",
  "Kiran",
  "Lena",
  "Lian",
  "Mabel",
  "Malik",
  "Maren",
  "Mateo",
  "Mina",
  "Nadia",
  "Nia",
  "Noor",
  "Odile",
  "Oren",
  "Pia",
  "Priya",
  "Rafi",
  "Rhea",
  "Roshan",
  "Runa",
  "Sana",
  "Selma",
  "Shaan",
  "Sora",
  "Sunil",
  "Tam",
  "Tara",
  "Teo",
  "Thandi",
  "Tomas",
  "Uma",
  "Vasco",
  "Vera",
  "Wren",
  "Yara",
  "Yusuf",
  "Zaid",
  "Zara",
  "Zoya",
];

// [C3: garments and the cold] The wardrobe's numbers, kept here beside the
// provisions above for the reason every other number in this file is kept
// here: a balance pass edits them knowing they are prices rather than rules,
// and the rules that read them live in ./garments.
//
// The plan names the ratings and the maxima itself, one, two and three for
// hemp, cloth and fine silks with six, eight and ten, and this is where they
// land. The three grades are the tree's own clothes rather than three new
// goods: Linen Clothes is the hemp garment, Cotton Clothes the cloth one and
// Brocade the fine silk. The Sachet is not here, and its absence is the one
// judgement this table makes: a sachet is worn nowhere, and warmth rating on
// a perfumed pouch would be a garment label on a thing nobody wears.
//
// The cold's numbers are the tune, since the plan names no weather. A cold
// leg asks for two, which a fresh Cotton Clothes exactly meets and a fresh
// Brocade has margin over, while a single fresh Linen Clothes does not; the
// same two make a Cotton plus a Linen a pair that passes a second cold leg
// on the fraction they keep. Three legs in ten are cold, so a twelve leg
// voyage carries three or four of them. The scrap a worn out garment comes
// to is the plan's own four Gold.
export type GarmentSpec = { warmth: number; durability: number };
export const GARMENTS: Record<string, GarmentSpec> = {
  "Linen Clothes": { warmth: 1, durability: 6 },
  "Cotton Clothes": { warmth: 2, durability: 8 },
  Brocade: { warmth: 3, durability: 10 },
};
export const COLD_LEG_WARMTH = 2;
export const COLD_LEG_CHANCE = 0.3;
// The decay is one a leg, doubled on a cold leg. The plan's Implementation
// section lists a third value for the frostbite leg and it is this second
// one written twice, because a leg the check fails on is a cold leg: that is
// where frostbite lands, so that is the number it wears. Two constants where
// three would have had two the same, which is the shape a later reader can
// check against the plan rather than have to redo.
export const GARMENT_DECAY_PER_LEG = 1;
export const GARMENT_DECAY_COLD_LEG = 2;

// What a garment comes to when the sea has had all of it. The plan gives the
// number and gives it a name, Rags, and this tree has nowhere to put Rags as
// a good: no path in the engine sells a finished good outside an order or a
// barter, so a hold item worth four Gold would be one nobody could ever turn
// into Gold, and a warmth zero entry in the hold is cargo a captain carries
// for nothing. The scrap is therefore credited at the moment the garment
// wears out, which is the same four Gold arriving without the detour.
export const RAG_SCRAP_VALUE = 4;

// [C4: three foods, spoilage and the split hold] The pantry and the hold,
// kept here beside the provisions above for the reason every other number
// in this file is kept here: a balance pass edits them knowing they are
// contents and capacities rather than rules, and the rules that read them
// live in ./foods and ./hold.
//
// The plan names the whole tradeoff in one sentence: "Grain keeps
// indefinitely but is least efficient per slot, salt fish keeps six legs,
// produce spoils in two." So the axis it names is space against time, and
// that is the axis these three rows carry, one number each way. Grain
// feeds one mouth per slot and never turns; salt fish feeds two and keeps
// six legs; produce feeds three and dies at the second Dusk.
//
// What the rows deliberately do not carry is a price. A meal costs the
// same whichever food it comes out of (see RATION_PRICE), which is the
// reading that keeps this feature's economy the one C1 already tuned: a
// leg of provisions for the crew costs what it has always cost, and a
// captain deciding between the three foods is deciding how long the food
// has to last and how much of the hold it may take, never how much Gold
// it takes. It is also what keeps the Preserve conversion from being a
// mint: one slot of produce becomes one slot of salt fish, and the meal
// it loses is the price of the fresh clock rather than a profit, since no
// path in this tree sells food back to a port.
//
// Grain's row is the anchor the other two are read against. It is one
// meal to a slot, which is what makes the Stores capacity below exactly
// the Larder's old ceiling with the densities switched on, and it costs
// RATION_PRICE, which is what makes a grain larder indistinguishable from
// the plain number C1 shipped.
//
// The stores size is LARDER_MAX written in slots rather than meals. That
// is the rollback's own arithmetic as the plan states it: reverting to a
// single hold leaves the food's capacity the number it always was, sixty,
// and the cargo's unbounded as it always was, because the hold this game
// has always had caps the Larder and never the trade. What the split adds
// is the other half of the plan's sentence, "so survival supplies can
// never crowd out trading capacity": with one hold the two compete for
// the same room, and with two they do not.
export type FoodId = "Grain" | "Salt Fish" | "Produce";
// The shape of one row of the catalogue, private to this module: every
// reader asks a food for a number by name (see ./foods and ./hold) rather
// than carrying the row around, so nothing outside this file has ever
// needed to name the type its own table is made of.
type FoodSpec = {
  // How many meals one slot of the hold carries of this food. The whole
  // of the space tradeoff: a slot of produce feeds three times the mouths
  // a slot of grain does, for as long as it is food.
  mealsPerSlot: number;
  // How many legs it stays food for, counted from the leg it was bought
  // or preserved in. Null keeps indefinitely, which is grain's row and
  // the reason a captain buys grain at all.
  keeps: number | null;
  icon: string;
};
export const FOODS: Record<FoodId, FoodSpec> = {
  Grain: { mealsPerSlot: 1, keeps: null, icon: "🌾" },
  "Salt Fish": { mealsPerSlot: 2, keeps: 6, icon: "🐟" },
  Produce: { mealsPerSlot: 3, keeps: 2, icon: "🥬" },
};

// The order the crew eats in, and the order the hold is read in wherever
// the pantry is shown: whatever spoils soonest goes first, so a captain's
// produce is eaten before their salt fish and their salt fish before the
// grain that outlasts the voyage. Oldest first within a food, which is
// the order the lots are kept in rather than a sort performed at dinner.
export const FOODS_DRAW_ORDER: readonly FoodId[] = [
  "Produce",
  "Salt Fish",
  "Grain",
];

// The two hold capacities. Cargo is the opening tune, set against what a
// captain actually carries: a fresh hold starts with sixteen units of
// hemp, silk and tea (see STARTING_STOCK), a market lot is two to five
// units and an order asks for one to five, so thirty slots is a hold a
// captain can fill, work out of and be turned away from on a fat leg,
// which is the pressure the plan is asking for. Stores is the Larder's
// old ceiling and is not a tune at all.
export const CARGO_SLOTS = 30;
export const STORES_SLOTS = LARDER_MAX;

// The plan's clause for a hungry crew, and the one C1 left standing: "a
// shortage costs cargo capacity down a quarter". The quarter comes off
// the cargo and never off the stores, because the stores are the food and
// a crew already short of it is not made shorter by a rule. See
// cargoSlots in ./hold for where it lands.
export const SHORT_RATIONS_CARGO = 0.75;

// [D1: the path configuration module] The two path dials that are hold
// arithmetic rather than prose, kept beside the hold's own numbers for the
// reason the shortage's quarter is kept here: a size belongs with the
// sizes. The Convoy's cannons are carried rather than stowed, so they cost
// slots out of the cargo hold, which is the plan's own account of where
// that path's structural poverty comes from; the Quartermaster's seat
// carries "the largest hold" in the design, half again the base. Both are
// read by ./paths and by nothing else, and both are meant to land at the
// hold's one capacity read (see cargoCapacity in ./larder) rather than at a
// counter, so a path's factor and the shortage's quarter are applied in one
// place and in one order.
export const CONVOY_CANNON_SLOTS = 6;
export const QUARTERMASTER_HOLD_GAIN = 0.5;

// Preserve, the plan's own ratio: "converts three produce into two salt
// fish", at a port. Three meals of produce is one slot of the hold, and
// two meals of salt fish is the same one slot, so the conversion is
// space for nothing and a meal for a fresh clock, which is the whole of
// what a captain pays for it.
export const PRESERVE_MEALS_IN = 3;
export const PRESERVE_MEALS_OUT = 2;

export const MODULES: Module[] = [
  ...MODULES_TIER0,
  ...MODULES_TIER1,
  ...MODULES_TIER2,
];

// Voyage length, raid odds, the escort fee, and how many cards each board
// rolls all used to be flat constants in this file. They vary by difficulty
// tier now, so they live in ./difficulty instead; the fair_winds tier carries
// the exact values this file used to hold. The starting fixed cost and ship
// upgrade cost ladder still live directly on the initial GameState (see
// createInitialGameState in ./types.ts); the intel cost per Broker rumor is
// derived on the fly from whether the Broker's Network module is equipped
// (see getIntelCost in ./engine/pricing.ts).

// How a single voyage's final Reputation reads on the Endgame screen (see
// merchantRatingForScore below). Ordered highest threshold first so the
// lookup is a plain first match scan; the last entry's minScore of 0
// is the catch all floor. The top entry also doubles as the threshold for
// the "king_of_silk_road" merit in src/lib/game/merits.ts, so retuning it
// here moves both places at once instead of drifting apart.
type MerchantRating = { minScore: number; icon: string; label: string };
export const MERCHANT_RATINGS: MerchantRating[] = [
  { minScore: 300, icon: "👑", label: "King of Silk Road" },
  { minScore: 200, icon: "🏆", label: "Maritime Tycoon" },
  { minScore: 100, icon: "⭐", label: "Successful Merchant" },
  { minScore: 50, icon: "👍", label: "Qualified Trader" },
  { minScore: 0, icon: "🌊", label: "Novice Merchant" },
];

// The single lookup behind both the Endgame log line (see endGame in
// ./engine/lifecycle.ts) and the Endgame screen's rating badge (see
// GamePhasePanel.tsx), so the two never drift the way they briefly did
// before this was pulled out: the screen was missing the "defaulted on a
// loan" case entirely, still showing a captain's score tier as if nothing
// had happened.
//
// Lives here in constants rather than in the engine, since it is a pure
// lookup over MERCHANT_RATINGS above with no dependency on any engine
// state, and MERCHANT_RATINGS is the table the top entry also doubles as
// the threshold for the "king_of_silk_road" merit in ./merits.ts, so
// retuning it here moves both places at once instead of drifting apart.
// MERCHANT_RATINGS is ordered highest threshold first, so the first match
// scanning down the list is always the correct tier.
export function merchantRatingForScore(score: number): MerchantRating {
  return (
    MERCHANT_RATINGS.find((r) => score >= r.minScore) ??
    MERCHANT_RATINGS[MERCHANT_RATINGS.length - 1]
  );
}

// Broker's Favor: a Renown gated, once per voyage skill a captain invokes in
// Orders to summon one extra guaranteed trade order for a chosen quantity of
// a good they are already holding, so a hold full of otherwise unsellable
// stock still has a buyer. Unlocks at Renown Level 5 (the Trade Officer
// tier, see src/lib/game/legacy.ts). A captain may ask for any quantity up
// to their full hold; the Broker's commission (see brokersFavorCommission in
// engine.ts) is a saturating curve rather than a flat rate, so net payout
// approaches this cap but can never exceed it, no matter how large the ask.
export const BROKERS_FAVOR_UNLOCK_LEVEL = 5;
export const BROKERS_FAVOR_PAYOUT_CAP = 200;

// [MANIFEST 02: Word on the Docks] A room wide race, layered alongside the
// scheduled Imperial Mandates above rather than replacing them: whichever
// captain is first in the harbor to complete this many trade orders across
// the whole voyage (cumulative, not per round, see GameState.
// totalOrdersCompleted) wins a flat Gold reward, announced to the room the
// moment it happens. Deliberately tier independent, same reward and same
// threshold on every difficulty, since the point is a spontaneous race
// between real captains, not one more dial to retune per tier.
export const WORD_ON_THE_DOCKS_THRESHOLD = 5;
export const WORD_ON_THE_DOCKS_REWARD = 25;

// [MANIFEST 03: Tidewatch Alerts] Deliberately not a difficulty dial: this
// never changes voyage length, card count baseline, or which tier's content
// is visible, all of which stay entirely the host's choice (see
// difficulty.ts). Once every active captain's own reported Reputation
// (GameState.score) sums past this, room wide, the harbor takes notice of a
// bustling crew and every captain's Market board gets one extra card for
// the rest of the voyage. A one time, one direction flip per voyage, purely
// additive on top of whatever the difficulty tier's own charter schedule is
// already doing, and never subtracted back out. See the game:status handler
// in src/server/realtime/index.ts for where the combined total is actually read.
export const TIDEWATCH_SURGE_THRESHOLD = 500;

// [MANIFEST 04: Convoy Ventures] A pooled, multi captain investment: gold
// only (see the ConvoyVenture Prisma model), too large a target for one
// captain to fund comfortably alone, open to contributions from anyone in
// the room until its deadline round. Fills the instant contributions reach
// targetGold, splitting a reward (targetGold times the payout multiplier)
// across every contributor in exact proportion to what they put in. Missing
// the deadline instead pays every contributor back only a fraction of their
// own stake, so joining one is a real wager on the room finishing it, not a
// free favor with no downside. See src/server/realtime/index.ts for where a
// venture is actually posted, contributed to, and resolved.
export const CONVOY_VENTURE_MIN_TARGET = 150;
export const CONVOY_VENTURE_MAX_TARGET = 2000;
export const CONVOY_VENTURE_MIN_ROUNDS_AHEAD = 1;
export const CONVOY_VENTURE_MAX_ROUNDS_AHEAD = 6;
export const CONVOY_VENTURE_PAYOUT_MULTIPLIER = 1.5;
export const CONVOY_VENTURE_FAILURE_REFUND_RATE = 0.5;
// [MANIFEST 04 fix] No single captain may ever fund more than this share of
// a venture's own target, on their own. Without this, a captain could post
// a venture and instantly fill it entirely with their own Gold, alone,
// which is worse than the original repeat fill exploit: it still prints a
// bounded amount of free Gold, and it burns the whole room's one shared
// chance for the voyage in the process, locking every other captain out
// for personal gain instead of the room's. Capping each contributor's own
// share below half is what actually forces at least one other captain to
// genuinely take part before a venture can ever fill.
export const CONVOY_VENTURE_MAX_CONTRIBUTOR_SHARE = 0.5;

// [MANIFEST 05: Backing] A third captain can co sign part of an existing
// loan between two others, pledging their own Gold as a safety net for the
// lender. The pledge is escrowed immediately, the same moment every other
// commitment in this game is (a barter offer, an aid loan, a Convoy
// Venture contribution), and is only ever spent if the loan actually
// defaults, up to whatever the backer pledged. If the loan is repaid in
// full and the backing is never called on, the backer gets their whole
// pledge back, plus a small Reputation bonus for having genuinely put
// Gold at risk that paid off, half of what the lender themselves earns per
// Gold lent (see AID_REPUTATION_PER_GOLD), since backing is a supporting
// role, not the primary loan.
export const BACKING_REPUTATION_PER_GOLD = AID_REPUTATION_PER_GOLD / 2;

// =====================================================================
// Player facing copy. The wording is preserved from the original game; the
// numbers are not baked in any more, because they now depend on the room's
// difficulty tier (see ./difficulty). Every figure a captain could act on
// (voyage length, raid odds, escort fee, mandate rounds) is derived from the
// tier's config, so the guide can never quote a number the engine doesn't use.
// =====================================================================

// "a 20% chance", or "a 22% chance that rises to 30% past the midpoint" on a
// tier whose raid odds step up at the halfway mark.
function raidCopy(cfg: DifficultyConfig): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const [first, second] = cfg.pirateChance;
  return second === undefined || second === first
    ? `There is a ${pct(first)} chance.`
    : `There is a ${pct(first)} chance, rising to ${pct(second)} past the midpoint.`;
}

function escortPct(cfg: DifficultyConfig): string {
  return `${Math.round(cfg.escortCostRate * 100)}%`;
}

export function tutorialSteps(
  mode: GameMode,
  difficulty: Difficulty,
): { title: string; content: string }[] {
  const cfg = difficultyConfig(difficulty);
  const rounds = voyageRoundsFor(mode, difficulty);
  const mandates = mandateRounds(cfg);
  return [
    {
      title: "⚓ Welcome aboard",
      content: `<p>${APP_NAME} puts you on the ancient Silk Road. ${rounds} voyages, limited gold, and a lot of merchants trying to outmaneuver you at every port.</p>
<p>These waters are <strong>${cfg.name}</strong>: ${cfg.tagline}</p>
<p>The rules are easy to pick up, but money is tight early on and a string of bad calls compounds quickly. This covers the four things that catch new players out most.</p>
<p style="color:var(--muted-foreground);font-size:13px">Two minutes to read. Saves a lot of frustrated restarts.</p>`,
    },
    {
      title: "🏆 What you're playing for",
      content: `<p>After ${rounds} voyages, the player with the highest score wins the title of <strong>Sea Master</strong>. Score comes from trade profits and fulfilled orders.</p>
<p>One rule overrides everything else: <strong>do not go bankrupt</strong>. Hit zero gold and the game ends immediately. There is no coming back from it.</p>
<p>Starting gold is <strong>${cfg.startingGold}</strong>. That is enough to get going, but not enough to be careless with.</p>`,
    },
    {
      title: "🔄 How a voyage works",
      // The count is the voyage's, read from the mode, while the cards
      // below are still the founding mode's four phases drawn by hand.
      // Making the cards follow the mode as well means rendering the
      // briefing record here rather than keeping a second copy of the lap,
      // which is a change this feature does not own: the count is the
      // number this feature moved, so the count is what moves here.
      content: `<p>Each of the ${rounds} voyages runs through four core phases in order, with a quick bartering window right after buying:</p>
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0">
  <div style="background:color-mix(in oklch, var(--gain) 14%, transparent);border-radius:6px;padding:10px;border-left:3px solid var(--gain);color:var(--foreground)"><strong>📦 Market</strong><br><span style="font-size:12px;color:var(--muted-foreground)">Stock up at port markets</span></div>
  <div style="background:color-mix(in oklch, var(--w-parley) 14%, transparent);border-radius:6px;padding:10px;border-left:3px solid var(--w-parley);color:var(--foreground)"><strong>🤝 Parley</strong><br><span style="font-size:12px;color:var(--muted-foreground)">Swap goods with other captains</span></div>
  <div style="background:color-mix(in oklch, var(--w-orders) 14%, transparent);border-radius:6px;padding:10px;border-left:3px solid var(--w-orders);color:var(--foreground)"><strong>📜 Orders</strong><br><span style="font-size:12px;color:var(--muted-foreground)">Sell to waiting buyers</span></div>
  <div style="background:color-mix(in oklch, var(--w-resolve) 14%, transparent);border-radius:6px;padding:10px;border-left:3px solid var(--w-resolve);color:var(--foreground)"><strong>💸 Resolve</strong><br><span style="font-size:12px;color:var(--muted-foreground)">Production lands, bills come due</span></div>
  <div style="background:color-mix(in oklch, var(--w-dusk) 14%, transparent);border-radius:6px;padding:10px;border-left:3px solid var(--w-dusk);color:var(--foreground)"><strong>🚢 Dusk</strong><br><span style="font-size:12px;color:var(--muted-foreground)">Improve your ship</span></div>
</div>
<p style="font-size:12px;color:var(--muted-foreground);margin:4px 0 0">A round opens at Dawn, with the Boon you draft for it, and the five phases above follow in the order your voyage runs them. <kbd style="background:var(--muted);border:1px solid var(--border);color:var(--foreground);padding:1px 6px;border-radius:3px">Ctrl+N</kbd> moves you between phases without clicking.</p>`,
    },
    {
      title: "🏪 Market: Buying",
      content: `<p>The port market has Hemp, Silk, and Tea at prices that shift every voyage. Buy now, then barter at Parley and sell at Orders. That is the core loop.</p>
<p>One thing worth knowing about: the <strong>Broker</strong>. Pay a small fee for a demand rumor and a specific trade order is <em>guaranteed</em> to appear when Orders opens. Useful when you have stocked a particular good and want to make sure a buyer shows up.</p>
<div style="background:color-mix(in oklch, var(--warn) 14%, transparent);border:1px solid var(--warn);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5">
  💡 For the first two or three voyages, stick to raw materials. They sell the same voyage you buy them. No waiting and no risk.
</div>`,
    },
    {
      title: "🤝 Parley: Bartering",
      content: `<p>The Parley is a short window where captains trade directly with each other instead of through the market. Post an offer, like Hemp you don't need for Silk you do, and any other captain in the harbor can take it with one click.</p>
<p>Where it falls in the round depends on the voyage: some run it right after Market, some right after Orders, and the rail across the top of the board always shows which. Either way, it is the easiest way to recover from a bad draw. All Tea and no Silk, with a Sachet order already on the board? Someone else in the harbor has probably drawn the opposite problem.</p>
<div style="background:color-mix(in oklch, var(--warn) 14%, transparent);border:1px solid var(--warn);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5">
  A few ground rules: you can't offer an item for itself, both amounts have to be whole numbers of at least one, and you can never offer more than you currently have. The moment you post an offer, that amount is set aside until someone takes it or you cancel it.
</div>
<p style="font-size:13px;color:var(--muted-foreground);margin-top:8px">Nobody has to barter. If nothing on the board interests you, or nobody is offering anything, just move on to the next phase.</p>`,
    },
    {
      title: "📋 Orders: Filling trade orders",
      content: `<p>Trade orders appear and you match your cargo to them. Each one shows the goods needed, the reward, and the shipping fee. Your take is whatever is left after fees and tax.</p>
<p>You can fill as many orders as your cargo allows while Orders is open.</p>
<div style="background:color-mix(in oklch, var(--intel) 14%, transparent);border:1px solid var(--intel);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5">
  📌 <strong>Finished goods</strong> (Linen Clothes, Cotton Clothes, Brocade, Sachet) pay two to three times more than raw materials. The catch is they need artisans, and the artisans deliver at Resolve. That is covered next.
</div>
${mandates.length ? `<p style="font-size:13px;margin-top:10px">📜 On voyage${mandates.length === 1 ? "" : "s"} ${mandates.join(", ")} the Emperor commissions a <strong>mandate</strong>: one large order at a fixed reward, and the only order exempt from VAT. It often asks for more than a single hold carries, so plan to barter or borrow to fill it.</p>` : ""}`,
    },
    {
      title: "⚠️ The artisan trap",
      content: `<p>Artisans turn raw materials into high value finished goods and collect wages at every Resolve. That part is simple. What catches most new players is this:</p>
<div style="background:color-mix(in oklch, var(--alarm) 18%, transparent);border:1px solid var(--alarm);color:var(--foreground);border-radius:6px;padding:12px;margin:12px 0;text-align:center;font-size:14px;font-weight:bold;line-height:1.7">
  Assign a task this voyage.<br>Wages come due at Resolve either way.
</div>
<p style="font-size:13px;color:var(--muted-foreground);line-height:1.6">Weavers (8g), Master Weavers (12g), and Sachet Makers (20g) all charge wages <strong>every round</strong>, even when idle, so the bill comes round whether they worked or not. Only hire once you have enough gold to cover at least two rounds of wages alongside your other bills.</p>`,
    },
    {
      title: "🏴‍☠️ Pirates at Resolve",
      content: `<p>Before the bills below come due each voyage, ${raidCopy(cfg).toLowerCase()} Pirates find your ship and take every coin you're carrying.</p>
<p>You get one choice before that roll happens: hire an escort for ${escortPct(cfg)} of your current Gold and sail through guaranteed safe, or set sail anyway and keep the Gold if the pirates don't show.</p>
${cfg.brokerCorruption ? `<p>In these waters a broker can be corrupt. The rumor you buy is still true and still arrives, always, but a corrupt one also leaks your position to the pirates. The log says so plainly when it happens, and the odds you see already include it.</p>` : ""}
<div style="background:color-mix(in oklch, var(--warn) 14%, transparent);border:1px solid var(--warn);color:var(--foreground);border-radius:6px;padding:9px;font-size:13px;margin-top:10px;line-height:1.5">
  💡 The escort costs a share of whatever you're carrying that round, so it's cheapest exactly when you have the least to protect. Often worth it once your funds are already thin.
</div>`,
    },
    {
      title: "Resolve: Settlement",
      content: `<p>Once the pirates are dealt with, two bills come due:</p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0">
  <div style="background:color-mix(in oklch, var(--w-ship) 14%, transparent);border-radius:6px;padding:10px;text-align:center;color:var(--foreground)">
    <div style="font-size:22px;margin-bottom:4px">🔧</div>
    <strong>Ship Maintenance</strong><br>
    <span style="font-size:12px;color:var(--muted-foreground)">15 to 22 Gold each round, set by the waters you sail</span>
  </div>
  <div style="background:color-mix(in oklch, var(--w-market) 14%, transparent);border-radius:6px;padding:10px;text-align:center;color:var(--foreground)">
    <div style="font-size:22px;margin-bottom:4px">👥</div>
    <strong>Artisan Wages</strong><br>
    <span style="font-size:12px;color:var(--muted-foreground)">8 to 20 Gold per person per voyage</span>
  </div>
</div>
<p style="font-size:13px;color:var(--muted-foreground)">The <strong>Round End Obligations</strong> panel in the sidebar shows exactly what is owed. Check it before spending anything.</p>
<p style="font-size:13px;color:var(--muted-foreground)">Coming up short isn't the end on its own. Right there on the settlement screen, you can ask another captain in the harbor for a loan, and they can send it to you on the spot if they've got the Gold to spare. Just repay it before the voyage's last round ends, or it comes out of your funds automatically and goes straight to them.</p>`,
    },
    {
      title: "🚢 You are ready",
      content: `<p>Keep these points in mind as you play:</p>
<ul style="padding-left:18px;line-height:2.1;font-size:14px">
  <li>Start with raw material orders. Fast money, no complications.</li>
  <li>Always keep at least <strong>30 Gold above</strong> what Resolve will cost you.</li>
  <li>Hire artisans only when you can cover <strong>two full voyages of wages</strong>.</li>
  <li>Dusk ship upgrades compound quickly. Do not skip them.</li>
  <li>Caught short by pirates or a bad round? Ask the harbor for a loan before you assume the voyage is over.</li>
  <li>Every voyage's final Reputation becomes Renown on your account, forever, win or lose. Check your Captain's Legacy any time from the Lobby.</li>
  <li><kbd style="background:var(--muted);border:1px solid var(--border);color:var(--foreground);padding:1px 6px;border-radius:3px">Ctrl+S</kbd> saves your run &nbsp;·&nbsp; <kbd style="background:var(--muted);border:1px solid var(--border);color:var(--foreground);padding:1px 6px;border-radius:3px">F1</kbd> opens the full guide.</li>
</ul>
<div style="background:color-mix(in oklch, var(--gain) 14%, transparent);border:2px solid var(--gain);color:var(--foreground);border-radius:8px;padding:12px;text-align:center;margin-top:14px">
  <strong style="font-size:15px">Good winds and good margins, Captain. ⚓</strong>
</div>`,
    },
  ];
}

export function guideText(mode: GameMode, difficulty: Difficulty): string {
  const cfg = difficultyConfig(difficulty);
  const rounds = voyageRoundsFor(mode, difficulty);
  const mandates = mandateRounds(cfg);
  return `⚓ ${APP_NAME}: Rules

🌊 These Waters: ${cfg.icon} ${cfg.name}
${cfg.summary}

🚢 Objective:
Travel ${rounds} voyages, accumulate wealth and reputation!

📦 Goods System:
Raw Materials: Hemp(3 to 6💰), Silk(6 to 10💰), Tea(10 to 14💰)
Finished Goods: Linen Clothes(30 to 42💰), Cotton Clothes(50 to 65💰), Brocade(70 to 90💰), Sachet(95 to 120💰)

👥 Worker System:
• Weaver (8 Gold/Round): Makes Linen or Cotton Clothes
• Master (12 Gold/Round): Makes Linen, Cotton or Brocade
• Sachet Maker (20 Gold/Round): Makes Sachets

🧾 Tax System:
• VAT: 5% on finished product profit margin
• Income Tax: 10% on voyage net profit

🔮 Broker's Whisper:
• Market: Click "Broker's Rumor Board" to open the window
• Spend 5 Gold to buy a "rumor" about Orders demand
• Revealed intel guarantees matching orders will appear
• A rumor is always true and always delivered, on every tier${cfg.brokerCorruption ? `\n• Here a broker may still be corrupt: you get the true rumor, but your position leaks and this round's raid risk rises, and the log tells you when` : ""}

🤝 Parley (Bartering):
• Trade directly with the other captains in your harbor while the Parley is open, whether it falls before or after Orders on your voyage
• Post what you have and what you want for it; anyone can accept it with one click
• An offer can't be an item for itself, and both amounts must be whole numbers of at least 1
• You can never offer more than you currently own, it's set aside the moment you post, and returned to you if you cancel or nobody takes it
• Want to make sure a specific captain gets your offer, not whoever clicks fastest? Pick their name under "With" when you post: only the two of you will ever see it

🔧 Ship Modules (NEW!):
• Dusk: Upgrade your ship to unlock Module Slots
• Draft powerful modules to create unique synergies
• Swap modules to adapt to your current run!

🏴‍☠️ Pirates and Escorts:
• Resolve: ${raidCopy(cfg)} Pirates take every Gold coin you carry.
• Hire an escort for ${escortPct(cfg)} of current Gold to sail safe
• Decide before the pirate roll happens that round${mandates.length ? `\n\n📜 Imperial Mandates:\n• On voyage${mandates.length === 1 ? "" : "s"} ${mandates.join(", ")} the Emperor commissions one large order at a fixed reward\n• A mandate is the only order exempt from VAT\n• Every captain in the harbor is dealt the same mandate, so it is a race` : ""}

📣 Word on the Docks:
• Whichever captain is first in the harbor to complete ${WORD_ON_THE_DOCKS_THRESHOLD} trade orders total this voyage wins ${WORD_ON_THE_DOCKS_REWARD} Gold on the spot
• It's a race against the rest of the room, not a scheduled event: it can land on any round, for any captain
• Announced to the whole harbor the moment it's won, same as any other harbor wide milestone

🌊 Tidewatch Alerts:
• Once everyone in the harbor's own Reputation adds up past ${TIDEWATCH_SURGE_THRESHOLD}, the harbor takes notice of a bustling crew
• From the next Port Purchase onward, every captain's board gets one extra cargo lot, for the rest of the voyage
• This never changes your voyage length or which tier's goods you see, only how busy the market gets

⚓ Convoy Ventures:
• Found on the Dues tab of your captain's rail: any captain can post a venture, a Gold target and a deadline round
• Anyone in the harbor, including the poster, can chip in Gold toward that target at any time before the deadline
• Reach the target in time and it fills: every contributor is paid back ${Math.round((CONVOY_VENTURE_PAYOUT_MULTIPLIER - 1) * 100)}% more Gold than they put in, split in exact proportion to their share
• Miss the deadline and it fails: every contributor only gets back ${Math.round(CONVOY_VENTURE_FAILURE_REFUND_RATE * 100)}% of their own stake, the rest is lost
• Contributing is a real wager on the rest of the harbor coming through, not a free favor
• Your whole harbor only ever gets one filled venture per voyage: the moment any venture fills, every other open venture is cancelled and fully refunded, and posting a new one is disabled until the next voyage
• A deadline can never land on your voyage's final round: it always leaves at least one full round afterward to actually spend whatever you're paid
• No single captain can ever fund more than ${Math.round(CONVOY_VENTURE_MAX_CONTRIBUTOR_SHARE * 100)}% of a venture's target alone: it always needs at least one other captain to fund the rest before it can fill

🆘 Financial Aid:
• Can't cover this round's wages or maintenance? Ask the harbor for a loan, right on the settlement screen
• Any captain with enough Gold can lend it to you on the spot; it's in your hands immediately
• Repay it any time before the voyage's last round ends, or it's taken from your funds automatically and handed to your lender
• Still short when the voyage finishes? That unpaid loan is what bankrupts you, not the round it was borrowed in
• Lending Gold raises your own reputation, scaled to how much you lent

🛡️ Backing:
• Every outstanding loan in your harbor is visible on the settlement screen, to everyone, not just the lender and borrower
• A third captain can back one: pledge some of their own Gold as a safety net for the lender, escrowed the instant they pledge it
• Only spent if the loan actually defaults, and only up to whatever was pledged; the lender still eats any shortfall past that
• Never called on when the loan is repaid in full? The whole pledge comes back, plus a small Reputation bonus for the risk paying off
• One backer per loan; you can't back a loan you're the lender or borrower on yourself

Captain's Legacy:
• Every voyage's final Reputation becomes Renown XP on your account the moment the voyage ends, win or lose
• Renown is permanent: it survives a restart and carries into every future voyage, in any harbor, unlike Gold, cargo, and ship level
• Each Renown level grants a small Gold bonus at the start of your next fresh voyage
• Whoever ends a voyage with the highest Reputation among everyone who reached the endgame screen is crowned Sea Master
• Check your current Renown level, title, and Sea Master crowns any time from the Lobby

🌊 Voyage Phases:
• Dawn: draft a Boon for the coming round
• Market: buy resources at ports (plus Broker rumors), and set your artisans to work
• Orders: complete trade orders
• Parley: barter with the other captains, which your voyage runs right after Market or right after Orders
• Resolve: pirates may strike first, then wages and maintenance come due (ask for a loan if you're short)
• Dusk: improve ships and install modules

⌨️ Shortcuts:
• Ctrl+S: Save Game
• Ctrl+N: Next Phase
• Ctrl+H: Manage Workers
• Ctrl+R: Restart
• F1: Instructions

⚓ Bon Voyage and Good Luck!`;
}

// The advice below is difficulty blind except for the one line about a
// loan running out: it names the round the harbor settles a debt on its
// own, and that round is the voyage's last one, which is the voyage's
// length rather than the tier's on a mode that pins one.
export function tipsText(mode: GameMode, difficulty: Difficulty): string {
  const rounds = voyageRoundsFor(mode, difficulty);
  return `⚓ Avoiding Bankruptcy Strategies:

💰 Financial Management:
1. Always maintain reserve funds for expenses
2. Maintenance + Wages are fixed rounds costs
3. Calculate total expenditure before buying

👥 Worker Management:
1. Weaver Wage: ${WAGES.weaver} Gold / Round
2. Master Wage: ${WAGES.master} Gold / Round
3. Maker Wage: ${WAGES.sachet_maker} Gold / Round
4. Hire only as needed

🔮 Broker's Whisper Strategy:
1. Buy rumors early if you have spare gold
2. Hoard revealed items to guarantee Orders profits
3. Balance intel purchases with other investments

🛒 Buying Strategy:
1. Reserve funds for maintenance+wages first
2. Select high value for money goods
3. Prioritize port specialties + revealed intel

🔄 Bartering Strategy:
1. Trade away surplus raw materials for the one you're actually short on
2. A modest Gold offer can secure a needed item faster than waiting on next voyage's market
3. Cancel an offer that's sitting unclaimed if you'd rather keep the material yourself

🤝 Trading Strategy:
1. Prioritize highest profit orders
2. Consider freight impact on margins
3. Finished orders yield high profit but incur VAT

⚠️ Risk Control:
1. Calculate fixed round costs: Maintenance + Wages
2. Keep funds consistently > fixed costs
3. Avoid overexpansion cash flow issues

🏴‍☠️ Pirates and Escorts:
1. The escort fee scales with your own Gold, so it's relatively cheap exactly when you're poor and the stakes are also low
2. Hire one when you're carrying enough Gold that losing it would actually hurt
3. Sailing without one is a fair bet when you have little to lose anyway

🆘 Borrowing and Lending:
1. Repay a loan as soon as you can afford it, instead of waiting for it to be deducted automatically at Round ${rounds}
2. Lending Gold raises your own reputation, so helping a captain who can clearly repay you is rarely a bad trade
3. Watch how much you've lent out across the voyage; it's still your Gold until it's actually repaid

🛡️ Backing Strategy:
1. Back a loan you'd have happily lent Gold on yourself; you're taking on the same risk without earning the lender's own full reputation rate
2. Only pledge what you can afford to lose outright, the same rule as lending directly
3. A loan to a captain who's clearly about to turn a profit is a safer backing bet than one taken late in the voyage with little runway left to repay it

💾 Save game progress frequently with Ctrl+S!`;
}
