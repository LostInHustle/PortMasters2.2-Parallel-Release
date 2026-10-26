// =====================================================================
// The pool: every boon
// and every module, written as one card record each (see ./cards for the
// shape and the vocabulary). The tags sit here beside the id and the
// prose because a card's tags are part of what the card is, and the rest
// of the record is here for the same reason; the fields it carries are
// the ones that were previously nowhere or in the wrong place:
//
//   * The prose was a good's name in ten of these cards. Silk Winds named
//     Silk, Hemp Monopoly named Hemp, the Fleet of Treasures named Foreign
//     Balm and Pearl String. Every one of them now names the tag its effect
//     actually reads, which is the rule ("effects name tags, never item
//     keys") applied to the copy a captain reads rather than only to the
//     engine. Three cards are renamed to match what they do, and their ids
//     are deliberately not: an id is a handle a standing order and a saved
//     voyage already hold, so a retune moves the caption and leaves the
//     handle where it is (the same reading ./paths.ts takes of a persisted
//     name).
//
//   * The offer weights were a switch statement in the engine, keyed by id
//     and reading inventory and roster by name. They are now a condition on
//     the record, in the three or four shapes the engine actually needs,
//     and the engine holds no card's id at all.
//
//   * The mode list and the power budget are new, and they are the pair
//     that gives the two modes different pools. Classic runs a ceiling of
//     three, so the three cards above it below carry a zero there: the two
//     that bend the whole ledger (Tax Evasion and the Woven Monopoly) and
//     the one that halves two risks at once (the Deep Sea Escort Pact).
//     Ocean Gambit runs the whole pool. Both weightings are authored here
//     from the start, which is the design's rollback clause: switching a mode
//     between the tight pool and the wide one is a config change.
//
//   * The second language is not written here. The Mandarin for a card
//     lives in the pack (src/lib/game/i18n/zh.json), one row per card and
//     face, and the record reads its own row by id, so a card's Chinese
//     is written in one place rather than twice. A card that arrives
//     later cannot arrive without its rows: the content check holds the
//     record and the pack in step and fails the build.
// =====================================================================
import {
  BOTH_MODES,
  GAMBIT_ONLY,
  NO_LEAN,
  type CardRecord,
  type CardText,
} from "./cards";
import { tIdFor } from "../i18n";

// The Mandarin for a card, read from the pack by the card's id.
//
// The pack is where the Chinese for every card is written, so a record
// does not keep a second copy of it: the record asks the pack for the
// two rows that belong to this card, and the smoke suite holds the
// record and the rows in step. A card the pack does not carry answers
// with its own id, which is the honest line to print and the reason the
// check fails loudly rather than quietly.
function zhCard(id: string): CardText {
  return {
    name: tIdFor("zh", `card.${id}.name`),
    desc: tIdFor("zh", `card.${id}.desc`),
  };
}

// The emergency loan's figure, named because two surfaces print it: the
// card a captain is dealt and the manual's own line about the draft. The
// record's effect and its English read this constant, so the number
// shown and the number the purse receives cannot come apart. The
// Mandarin is the pack's row, which carries the same figure in its own
// hand, and the smoke suite holds the two in step, so a retune of the
// constant that forgets the pack fails the build.
export const EMERGENCY_LOAN_GOLD = 40;

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
        desc: "Freight on woven goods is halved this round, down to the harbor minimum of 5 Gold.",
      },
      zh: zhCard("silk_wind"),
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
        desc: "Base freight is 4 Gold cheaper this round, down to the harbor minimum of 5 Gold.",
      },
      zh: zhCard("favorable_tides"),
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
        desc: "Purchases at the market cost 15% less this round.",
      },
      zh: zhCard("merchant_charm"),
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
        desc: "Every artisan produces 1 extra item this round.",
      },
      zh: zhCard("artisan_inspiration"),
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
    effect: { kind: "flags", flags: { instant_gold: EMERGENCY_LOAN_GOLD } },
    modes: BOTH_MODES,
    strings: {
      en: {
        name: "Emergency Loan",
        desc: `Gain ${EMERGENCY_LOAN_GOLD} Gold immediately. No strings attached.`,
      },
      zh: zhCard("emergency_loan"),
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
      en: { name: "Tax Shelter", desc: "Income tax is halved this round." },
      zh: zhCard("tax_shelter"),
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
        desc: "All raw materials and products cost 2 Gold less per unit this round.",
      },
      zh: zhCard("hemp_monopoly"),
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
        desc: "Wages are halved this round.",
      },
      zh: zhCard("master_apprentice"),
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
      en: {
        name: "Farsight",
        desc: "One Broker's Whisper is free this round.",
      },
      zh: zhCard("farsight"),
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
      zh: zhCard("kiln_and_forge_guild"),
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
      zh: zhCard("frontier_tariff_relief"),
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
      zh: zhCard("exotic_treasures"),
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
      zh: zhCard("deep_sea_escort_pact"),
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
      zh: zhCard("merchants_converge"),
    },
  },
];

// The launch pool: one boon per moment,
// five cards, exactly the small set the design's iteration note asks for
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
// Every card is Gambit only, and the mode weights say so rather than the
// granting code alone. The five moments are systems of the Gambit release:
// the switch that arms them reads gambitSystems, which Classic carries
// false, so a card declaring a Classic weight could never be dealt there.
// The weight was BOTH_MODES once, and the declaration was the only place
// the unreachability was not written down. The validator now refuses a
// milestone boon with a Classic weight for the same reason.

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
    modes: GAMBIT_ONLY,
    strings: {
      en: {
        name: "Steady Watch",
        desc: "The crew eats one fewer than their number each round (never fewer than one), for the voyage.",
      },
      zh: zhCard("steady_watch"),
    },
  },
  {
    id: "cold_hardened",
    kind: "boon",
    power: 3,
    icon: "🧣",
    tags: ["cold"],
    pathWeight: { convoy: 2 },
    trigger: "cold_round",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "flags", flags: { cold_hardened: 1 } },
    modes: GAMBIT_ONLY,
    strings: {
      en: {
        name: "Cold Hardened",
        desc: "The warmth the crew wears counts one higher, for the voyage.",
      },
      zh: zhCard("cold_hardened"),
    },
  },
  {
    id: "route_mastery",
    kind: "boon",
    power: 3,
    icon: "🗺️",
    tags: ["public"],
    // The two paths whose order pools reach the manifest: the Loom's
    // garments and the Aroma's commodities. The Quartermaster's provisions
    // are pantry goods and never become board orders, so a lean there
    // would favor a seat the card can never pay (see pathDealsBoardOrders
    // and milestoneChoices).
    pathWeight: { loom: 1.5, aroma: 1.5 },
    trigger: "pathbound_order",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "flags", flags: { route_mastery: 0.25 } },
    modes: GAMBIT_ONLY,
    strings: {
      en: {
        name: "Route Mastery",
        desc: "Orders that follow your path pay a quarter more, for the voyage.",
      },
      zh: zhCard("route_mastery"),
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
    modes: GAMBIT_ONLY,
    strings: {
      en: {
        name: "Harbor Credit",
        desc: "Product sales VAT is a quarter lower, for the voyage.",
      },
      zh: zhCard("harbor_credit"),
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
    modes: GAMBIT_ONLY,
    strings: {
      en: {
        name: "Fleet Colors",
        desc: "Raiders think twice: pirate risk is a quarter lower, for the voyage.",
      },
      zh: zhCard("fleet_colors"),
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
// drafts and for the design's own phrase about them ("the three presented
// cards are drawn from a weighted pool rather than a filtered one"), because
// two numbers here would let the boon draft and the shipyard drift into
// presenting different sized hands with nothing to say that was intended.
export const CARDS_PER_OFFER = 3;

// The starter pool is the floor under a batch change. A captain at the top
// of the ladder carries three modules, the table being replaced holds three,
// and a whole new batch needs three more that are on neither, so a mode needs
// at least nine starter modules before the yard can promise a change that
// leaves every face new. The card check holds the floor.
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
        desc: "Purchases at the market cost 15% less. Income tax is 20% higher.",
      },
      zh: zhCard("smugglers_hold"),
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
        desc: "Freight is 1 Gold less per item. Hull upgrades cost 15 Gold more.",
      },
      zh: zhCard("bulk_hauler"),
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
        desc: "Artisans produce 1 extra item. Wages are 20% higher.",
      },
      zh: zhCard("artisans_workshop"),
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
        desc: "Income tax and VAT are halved. A completed order has a 15% chance of a 20 Gold audit.",
      },
      zh: zhCard("tax_evasion"),
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
      zh: zhCard("silk_monopoly"),
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
        desc: "A Whisper costs 2 Gold and reveals 2.",
      },
      zh: zhCard("brokers_network"),
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
      zh: zhCard("salvage_crane"),
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
      zh: zhCard("overdrive_engine"),
    },
  },
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
      zh: zhCard("bureau_token"),
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
      zh: zhCard("kiln_cellar"),
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
        desc: "Each Broker's Whisper reveals 1 extra at no extra cost.",
      },
      zh: zhCard("ocean_relay"),
    },
  },
];

// The second wave, drafted only once the first charter has opened, same as
// BOONS_TIER1.
export const MODULES_TIER1: CardRecord[] = [
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
      zh: zhCard("foreign_quarter_pass"),
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
      zh: zhCard("persian_dome_compass"),
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
        desc: "Luxury freight is free.",
      },
      zh: zhCard("fleet_of_treasures"),
    },
  },
];

export const MODULES: CardRecord[] = [...MODULES_TIER0, ...MODULES_TIER1];
