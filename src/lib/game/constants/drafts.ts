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

export const MODULES: Module[] = [
  ...MODULES_TIER0,
  ...MODULES_TIER1,
  ...MODULES_TIER2,
];
