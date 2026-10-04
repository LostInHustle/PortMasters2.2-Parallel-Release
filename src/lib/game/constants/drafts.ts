// =====================================================================
// [F2: the card record, and the mode weighting field] The pool: every boon
// and every module, written as one card record each (see ./cards for the
// shape and the vocabulary). F1 put the tags here beside the id and the
// prose because a card's tags are part of what the card is; F2 puts the
// rest of the record here for the same reason, and the fields it adds are
// the ones that were previously nowhere or in the wrong place:
//
//   - The prose was a good's name in ten of these cards. Silk Winds named
//     Silk, Hemp Monopoly named Hemp, the Fleet of Treasures named Foreign
//     Balm and Pearl String. Every one of them now names the tag its effect
//     actually reads, which is F1's rule ("effects name tags, never item
//     keys") applied to the copy a captain reads rather than only to the
//     engine. Three cards are renamed to match what they do, and their ids
//     are deliberately not: an id is a handle a standing order and a saved
//     voyage already hold, so a retune moves the caption and leaves the
//     handle where it is (the same reading ./paths.ts takes of a persisted
//     name).
//
//   - The offer weights were a switch statement in the engine, keyed by id
//     and reading inventory and roster by name. They are now a condition on
//     the record, in the three or four shapes the engine actually needs,
//     and the engine holds no card's id at all.
//
//   - The mode list and the power budget are new, and they are the pair
//     that gives the two modes different pools. Classic runs a ceiling of
//     three, so the three cards above it below carry a zero there: the two
//     that bend the whole ledger (Tax Evasion and the Woven Monopoly) and
//     the one that halves two risks at once (the Deep Sea Escort Pact).
//     Ocean Gambit runs the whole pool. Both weightings are authored here
//     from the start, which is the plan's rollback clause: switching a mode
//     between the tight pool and the wide one is a config change.
//
//   - The second language is authored beside the first for every card, so
//     the translation pass J3 describes is a pass over a pool that already
//     carries both, and a card that arrives later cannot arrive with one
//     string and pass review: the content check fails the build.
// =====================================================================
import { BOTH_MODES, GAMBIT_ONLY, NO_LEAN, type CardRecord } from "./cards";

export const BOONS_TIER0: CardRecord[] = [
  {
    id: "silk_wind",
    kind: "boon",
    power: 3,
    icon: "🌬️",
    tags: ["woven"],
    pathWeight: { loom: 2 },
    trigger: "boon_draft",
    condition: {
      kind: "holds_tag",
      tag: "woven",
      count: 3,
      weight: 2.5,
      otherwise: 0.8,
    },
    effect: { kind: "flags", flags: { transport_silk_discount: 0.5 } },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Weaver's Winds",
        desc: "Freight on woven goods is halved this round.",
      },
      zh: { name: "织风", desc: "本轮织物类货物的运费减半。" },
    },
  },
  {
    id: "favorable_tides",
    kind: "boon",
    power: 2,
    icon: "🌊",
    tags: ["bulk"],
    pathWeight: { convoy: 1.5 },
    trigger: "boon_draft",
    condition: { kind: "always", weight: 1.5 },
    effect: { kind: "flags", flags: { transport_flat_discount: 4 } },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Favorable Tides",
        desc: "Base freight is 4 Gold cheaper this round.",
      },
      zh: { name: "顺流", desc: "本轮基础运费降低 4 金。" },
    },
  },
  {
    id: "merchant_charm",
    kind: "boon",
    power: 3,
    icon: "✨",
    tags: ["public"],
    pathWeight: { aroma: 1.5 },
    trigger: "boon_draft",
    condition: {
      kind: "gold_above",
      amount: 40,
      weight: 2.0,
      otherwise: 0.5,
    },
    effect: { kind: "flags", flags: { purchase_discount: 0.15 } },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Merchant's Charm",
        desc: "Port purchases cost 15% less this round.",
      },
      zh: { name: "商人魅力", desc: "本轮港口采购降价 15%。" },
    },
  },
  {
    id: "artisan_inspiration",
    kind: "boon",
    power: 3,
    icon: "🔨",
    tags: ["crewed"],
    pathWeight: { loom: 2 },
    trigger: "boon_draft",
    condition: {
      kind: "crew_role",
      roles: ["weaver", "master", "sachet_maker"],
      weight: 3.0,
      otherwise: 0.0,
    },
    effect: { kind: "flags", flags: { worker_bonus_production: 1 } },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Artisan's Inspiration",
        desc: "Every worker produces 1 extra item this round.",
      },
      zh: { name: "匠人灵感", desc: "本轮所有工匠多产出 1 件。" },
    },
  },
  {
    id: "emergency_loan",
    kind: "boon",
    power: 2,
    icon: "💰",
    tags: ["debt"],
    pathWeight: NO_LEAN,
    trigger: "boon_draft",
    condition: { kind: "gold_below", amount: 30, weight: 4.0, otherwise: 0.2 },
    effect: { kind: "flags", flags: { instant_gold: 40 } },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Emergency Loan",
        desc: "Gain 40 Gold immediately. No strings attached.",
      },
      zh: { name: "应急借款", desc: "立即获得 40 金，无需偿还。" },
    },
  },
  {
    id: "tax_shelter",
    kind: "boon",
    power: 3,
    icon: "📜",
    tags: ["sealed"],
    pathWeight: { quartermaster: 1.5 },
    trigger: "boon_draft",
    condition: { kind: "always", weight: 1.5 },
    effect: { kind: "flags", flags: { income_tax_override: 0.05 } },
    modes: BOTH_MODES,
    strings: {
      en: { name: "Tax Shelter", desc: "Income tax is 5% this round." },
      zh: { name: "避税账户", desc: "本轮所得税率降至 5%。" },
    },
  },
  {
    id: "hemp_monopoly",
    kind: "boon",
    power: 2,
    icon: "🧶",
    tags: ["bulk"],
    pathWeight: { loom: 1.5 },
    trigger: "boon_draft",
    condition: {
      kind: "crew_role",
      roles: ["weaver", "master", "sachet_maker"],
      weight: 2.0,
      otherwise: 1.0,
    },
    effect: { kind: "flags", flags: { hemp_price_reduction: 2 } },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Bulk Monopoly",
        desc: "Bulk goods cost 2 Gold less per unit this round.",
      },
      zh: { name: "大宗垄断", desc: "本轮大宗货物每单位便宜 2 金。" },
    },
  },
  {
    id: "master_apprentice",
    kind: "boon",
    power: 2,
    icon: "🎓",
    tags: ["crewed"],
    pathWeight: { loom: 1.5 },
    trigger: "boon_draft",
    condition: { kind: "always", weight: 1.5 },
    effect: { kind: "flags", flags: { hire_discount: 0.5 } },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Master's Apprentice",
        desc: "Hiring costs half this round.",
      },
      zh: { name: "师徒相授", desc: "本轮雇佣工匠费用减半。" },
    },
  },
];

// Drafted only once the first charter has opened, so they can lean on the
// goods it brings without ever appearing in a voyage that has no use for them.
export const BOONS_TIER1: CardRecord[] = [
  {
    id: "farsight",
    kind: "boon",
    power: 1,
    icon: "🔮",
    tags: ["public"],
    pathWeight: { aroma: 2 },
    trigger: "boon_draft",
    condition: { kind: "gold_below", amount: 40, weight: 2.5, otherwise: 1.2 },
    effect: { kind: "flags", flags: { free_intel: 1 } },
    modes: BOTH_MODES,
    strings: {
      en: { name: "Farsight", desc: "One Broker's rumor is free this round." },
      zh: { name: "远见", desc: "本轮免费获得一条中间人情报。" },
    },
  },
  {
    id: "kiln_and_forge_guild",
    kind: "boon",
    power: 3,
    icon: "🏮",
    tags: ["sealed"],
    pathWeight: { aroma: 1.5 },
    trigger: "boon_draft",
    // The condition reads the goods the guild works in (ore and clay, both
    // bulk) while the card's own tags describe the wares it sells (sealed
    // porcelain and bronze): the two are different questions and the record
    // keeps them apart. The weight is the one the engine's own table used
    // for this card since the tier opened, read through the trade rather
    // than through the two goods that happened to be its only members.
    condition: {
      kind: "holds_tag",
      tag: "bulk",
      count: 2,
      weight: 2.8,
      otherwise: 1.0,
    },
    effect: { kind: "flags", flags: { charter_order_bonus: 0.15 } },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Kiln and Forge Guild",
        desc: "Orders for the first charter's goods pay 15% more this round.",
      },
      zh: { name: "窑炉行会", desc: "本轮第一批特许货物的订单多付 15%。" },
    },
  },
  {
    id: "frontier_tariff_relief",
    kind: "boon",
    power: 3,
    icon: "🧾",
    tags: ["public"],
    pathWeight: { aroma: 1.5 },
    trigger: "boon_draft",
    condition: {
      kind: "crew_role",
      roles: ["sachet_maker", "master"],
      weight: 3.0,
      otherwise: 0.8,
    },
    effect: { kind: "flags", flags: { vat_discount: 0.5 } },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Frontier Tariff Relief",
        desc: "VAT on finished goods is halved this round.",
      },
      zh: { name: "边境减税", desc: "本轮成品增值税减半。" },
    },
  },
];

export const BOONS_TIER2: CardRecord[] = [
  {
    id: "exotic_treasures",
    kind: "boon",
    power: 3,
    icon: "💎",
    tags: ["luxury"],
    pathWeight: { aroma: 1.5 },
    trigger: "boon_draft",
    condition: {
      kind: "holds_tag",
      tag: "luxury",
      count: 2,
      weight: 3.0,
      otherwise: 1.0,
    },
    effect: { kind: "flags", flags: { exotic_order_bonus: 0.15 } },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Exotic Treasures",
        desc: "Orders for the second charter's goods pay 15% more this round.",
      },
      zh: { name: "异域奇珍", desc: "本轮第二批特许货物的订单多付 15%。" },
    },
  },
  {
    id: "deep_sea_escort_pact",
    kind: "boon",
    power: 4,
    icon: "🛡️",
    tags: ["armed"],
    pathWeight: { convoy: 2.5 },
    trigger: "boon_draft",
    condition: { kind: "gold_above", amount: 60, weight: 1.8, otherwise: 3.2 },
    effect: {
      kind: "flags",
      flags: { escort_discount: 0.5, pirate_risk_discount: 0.5 },
    },
    // Two risks halved at once is the widest swing in the deck, so the
    // competitive mode does not run it and Ocean Gambit does.
    modes: GAMBIT_ONLY,
    strings: {
      en: {
        name: "Deep Sea Escort Pact",
        desc: "Escort costs and pirate risk are both halved this round.",
      },
      zh: { name: "远洋护航契约", desc: "本轮护航费用与海盗风险双双减半。" },
    },
  },
  {
    id: "merchants_converge",
    kind: "boon",
    power: 3,
    icon: "🛍️",
    tags: ["public"],
    pathWeight: NO_LEAN,
    trigger: "boon_draft",
    condition: { kind: "always", weight: 1.6 },
    effect: { kind: "flags", flags: { extra_order: 1 } },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Merchants Converge",
        desc: "One extra trade order appears on this round's board.",
      },
      zh: { name: "商贾云集", desc: "本轮订单板上多出一张贸易订单。" },
    },
  },
];

// [F4: boons at milestone moments] The launch pool: one boon per moment,
// five cards, exactly the small set the plan's iteration note asks for
// ("The pool should stay small at launch, and the first widening should
// target the paths with the lowest pick rate"), which is why each card
// carries a path lean from the first wave rather than none.
//
// The list stands outside the three tier ladders on purpose, and that
// placement is the round draft's whole protection: unlockedBoons walks
// the ladders (see ./pools), so a card here can never appear in a
// round's three, and it appears in the milestone draw alone. It rides
// ./cards' CARDS for everything else, the door, the tally, the validator
// and the flag lookup, so a milestone boon is a card like any other the
// moment it is on a table.
//
// Every condition is the always arm, because the moment is the
// conditioning: the crew loss card is worth the same to a rich captain
// and a broke one, and what decides which of these a captain sees is
// which moment arrived and which of the five they already hold.
//
// Each card writes a key of its own. The five keys are new here (see
// MODIFIER_KEYS in ../types), and no round drafted card writes any of
// them, so a held boon and a round boon are never in force on the same
// key: the pool's one owner per key clause (see the validator in
// ../cards) holds the line, and the pricing breakdown's source line
// stays true without a second rule.
export const MILESTONE_BOONS: CardRecord[] = [
  {
    id: "steady_watch",
    kind: "boon",
    power: 2,
    icon: "🍲",
    tags: ["crewed"],
    pathWeight: { quartermaster: 2 },
    trigger: "crew_loss",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "flags", flags: { steady_rations: 1 } },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Steady Watch",
        desc: "The crew eats one fewer than their number each leg, for the voyage.",
      },
      zh: {
        name: "守望",
        desc: "本航程余下期间，船员每段航程少消耗一份口粮。",
      },
    },
  },
  {
    id: "cold_hardened",
    kind: "boon",
    power: 3,
    icon: "🧣",
    tags: ["cold"],
    pathWeight: { convoy: 2 },
    trigger: "cold_leg",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "flags", flags: { cold_hardened: 1 } },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Cold Hardened",
        desc: "The warmth the crew wears counts one higher, for the voyage.",
      },
      zh: {
        name: "耐寒",
        desc: "本航程余下期间，船员所穿御寒值提高 1。",
      },
    },
  },
  {
    id: "route_mastery",
    kind: "boon",
    power: 3,
    icon: "🗺️",
    tags: ["public"],
    pathWeight: { quartermaster: 1.5, aroma: 1.5 },
    trigger: "pathbound_order",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "flags", flags: { route_mastery: 0.25 } },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Route Mastery",
        desc: "Orders that follow your path pay a quarter more, for the voyage.",
      },
      zh: {
        name: "路线精通",
        desc: "本航程余下期间，沿你路径的订单报酬增加四分之一。",
      },
    },
  },
  {
    id: "harbor_credit",
    kind: "boon",
    power: 3,
    icon: "🏅",
    tags: ["debt"],
    pathWeight: { loom: 2 },
    trigger: "renown_rung",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "flags", flags: { harbor_credit: 0.25 } },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Harbor Credit",
        desc: "Product sales dues are a quarter lower, for the voyage.",
      },
      zh: {
        name: "港口信用",
        desc: "本航程余下期间，商品销售税降低四分之一。",
      },
    },
  },
  {
    id: "fleet_colors",
    kind: "boon",
    power: 2,
    icon: "🚩",
    tags: ["armed"],
    pathWeight: { free_captain: 2 },
    trigger: "mandate",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "flags", flags: { fleet_color: 0.25 } },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Fleet Colors",
        desc: "Raiders think twice: pirate risk is a quarter lower, for the voyage.",
      },
      zh: {
        name: "舰队旗帜",
        desc: "本航程余下期间，海盗来袭的风险降低四分之一。",
      },
    },
  },
];

export const BOONS: CardRecord[] = [
  ...BOONS_TIER0,
  ...BOONS_TIER1,
  ...BOONS_TIER2,
  ...MILESTONE_BOONS,
];

// What a boon reroll costs, once per round. The module side has no
// equivalent fee (its scarcity is the equippable slots), so this is the
// boon draft's own dial and lives here rather than beside the shared
// swap policy.
export const BOON_SWAP_COST = 10;

// How many cards a draft puts in front of a captain. One number for both
// drafts and for the plan's own phrase about them ("the three presented
// cards are drawn from a weighted pool rather than a filtered one"), because
// two numbers here would let the boon draft and the shipyard drift into
// presenting different sized hands with nothing to say that was intended.
export const CARDS_PER_OFFER = 3;

export const MODULES_TIER0: CardRecord[] = [
  {
    id: "smugglers_hold",
    kind: "module",
    power: 3,
    icon: "🏴‍☠️",
    tags: ["contraband"],
    pathWeight: { free_captain: 1.5 },
    trigger: "shipyard_draft",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "hull" },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Smuggler's Hold",
        desc: "Purchases cost 15% less. Income tax is 20% higher.",
      },
      zh: { name: "走私货舱", desc: "采购成本降低 15%，所得税增加 20%。" },
    },
  },
  {
    id: "bulk_hauler",
    kind: "module",
    power: 3,
    icon: "🏗️",
    tags: ["bulk"],
    pathWeight: { quartermaster: 1.5 },
    trigger: "shipyard_draft",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "hull" },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Bulk Hauler Rigging",
        desc: "Freight is 1 Gold less per item. Ship upgrades cost 15 Gold more.",
      },
      zh: {
        name: "大宗货索具",
        desc: "每件货物运费减 1 金，船只升级多花 15 金。",
      },
    },
  },
  {
    id: "artisans_workshop",
    kind: "module",
    power: 3,
    icon: "🛠️",
    tags: ["crewed"],
    pathWeight: { loom: 2 },
    trigger: "shipyard_draft",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "hull" },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Artisan's Workshop",
        desc: "Workers produce 1 extra item. Wages are 20% higher.",
      },
      zh: { name: "匠人作坊", desc: "工匠多产出 1 件，工资增加 20%。" },
    },
  },
  {
    id: "tax_evasion",
    kind: "module",
    power: 5,
    icon: "📕",
    tags: ["contraband"],
    pathWeight: { free_captain: 2 },
    trigger: "shipyard_draft",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "hull" },
    // Both taxes halved for as long as the ledger is installed, with an
    // audit riding every fill: the widest swing a hull card carries.
    modes: GAMBIT_ONLY,
    strings: {
      en: {
        name: "Tax Evasion Ledger",
        desc: "Income tax and VAT are halved. A completed order risks a 20 Gold audit.",
      },
      zh: {
        name: "逃税账簿",
        desc: "所得税与增值税减半，订单完成时有 15% 概率损失 20 金。",
      },
    },
  },
  {
    id: "silk_monopoly",
    kind: "module",
    power: 5,
    icon: "👘",
    tags: ["woven", "luxury"],
    pathWeight: { loom: 2.5 },
    trigger: "shipyard_draft",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "hull" },
    // A whole class of freight at zero, for good, on top of an order
    // bonus: the other card the competitive mode leaves to Gambit.
    modes: GAMBIT_ONLY,
    strings: {
      en: {
        name: "Woven Monopoly",
        desc: "Woven freight is free. Woven orders pay 20% more.",
      },
      zh: {
        name: "织物专卖",
        desc: "织物类货物运费为 0，织物类订单多付 20%。",
      },
    },
  },
  {
    id: "brokers_network",
    kind: "module",
    power: 2,
    icon: "🕵️",
    tags: ["public"],
    pathWeight: { aroma: 2 },
    trigger: "shipyard_draft",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "hull" },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Broker's Network",
        desc: "Intel costs 2 Gold and reveals 2 rumors.",
      },
      zh: {
        name: "中间人网络",
        desc: "情报花费 2 金，每次购买揭示 2 条传闻。",
      },
    },
  },
  {
    id: "salvage_crane",
    kind: "module",
    power: 2,
    icon: "♻️",
    tags: ["bulk"],
    pathWeight: { convoy: 1.5 },
    trigger: "shipyard_draft",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "hull" },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Salvage Crane",
        desc: "A completed order has a 30% chance to refund its freight.",
      },
      zh: { name: "打捞吊臂", desc: "订单完成时有 30% 概率返还运费。" },
    },
  },
  {
    id: "overdrive_engine",
    kind: "module",
    power: 3,
    icon: "⚙️",
    tags: ["bulk"],
    pathWeight: { quartermaster: 1.5 },
    trigger: "shipyard_draft",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "hull" },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Overdrive Engine",
        desc: "Freight is 5 Gold less. Maintenance costs 10 Gold more.",
      },
      zh: { name: "超载引擎", desc: "运费减 5 金，维护费增加 10 金。" },
    },
  },
];

// Drafted only once the first charter has opened, same as BOONS_TIER1.
export const MODULES_TIER1: CardRecord[] = [
  {
    id: "bureau_token",
    kind: "module",
    power: 2,
    icon: "🎫",
    tags: ["public"],
    pathWeight: { aroma: 1.5 },
    trigger: "shipyard_draft",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "hull" },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Maritime Bureau Token",
        desc: "Charter goods pay 10% more on orders.",
      },
      zh: { name: "市舶司信物", desc: "特许货物的订单多付 10%。" },
    },
  },
  {
    id: "kiln_cellar",
    kind: "module",
    power: 2,
    icon: "🔥",
    tags: ["bulk"],
    pathWeight: { quartermaster: 1.5 },
    trigger: "shipyard_draft",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "hull" },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Kiln Cellar",
        desc: "Bulk goods cost 2 Gold less per unit.",
      },
      zh: { name: "窑窖", desc: "大宗货物每单位便宜 2 金。" },
    },
  },
  {
    id: "ocean_relay",
    kind: "module",
    power: 2,
    icon: "📡",
    tags: ["public"],
    pathWeight: { aroma: 2 },
    trigger: "shipyard_draft",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "hull" },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Ocean Interpreter",
        desc: "Broker's Whisper reveals 1 extra rumor at no extra cost.",
      },
      zh: { name: "通译", desc: "情报多揭示 1 条传闻，不额外收费。" },
    },
  },
];

export const MODULES_TIER2: CardRecord[] = [
  {
    id: "foreign_quarter_pass",
    kind: "module",
    power: 3,
    icon: "🪪",
    tags: ["luxury"],
    pathWeight: { aroma: 2 },
    trigger: "shipyard_draft",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "hull" },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Foreign Quarter Pass",
        desc: "Luxury goods cost 3 Gold less per unit.",
      },
      zh: { name: "蕃坊通行证", desc: "奢侈品每单位便宜 3 金。" },
    },
  },
  {
    id: "persian_dome_compass",
    kind: "module",
    power: 3,
    icon: "🧿",
    tags: ["armed"],
    pathWeight: { convoy: 2 },
    trigger: "shipyard_draft",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "hull" },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Persian Dome Compass",
        desc: "Pirate raids are 30% less likely.",
      },
      zh: { name: "波斯穹顶罗盘", desc: "海盗袭击风险降低 30%。" },
    },
  },
  {
    id: "fleet_of_treasures",
    kind: "module",
    power: 2,
    icon: "⛵",
    tags: ["luxury"],
    pathWeight: { aroma: 1.5 },
    trigger: "shipyard_draft",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "hull" },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Fleet of Treasures",
        desc: "Freight on luxury orders is 3 Gold less per unit.",
      },
      zh: { name: "珍宝船队", desc: "奢侈品订单每单位运费便宜 3 金。" },
    },
  },
];

export const MODULES: CardRecord[] = [
  ...MODULES_TIER0,
  ...MODULES_TIER1,
  ...MODULES_TIER2,
];
