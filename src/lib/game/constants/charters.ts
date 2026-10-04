// =====================================================================
// [F6: charters at leg four] The ten charters, two for each of the five
// paths, and the moment a voyage offers one of them.
//
// This is the vocabulary and nothing else, the same split F1 took with
// the tags and F4 with the moments: the words live here and the walk
// that reads them lives in ../charters, so a module that wants to ask
// what a charter is imports this one, and a module that wants to know
// whether one is due imports that one.
//
//   - A charter is offered once a voyage, at leg four, and the choice
//     carries to the end of it. The plan's shape for the offer is a
//     trio: the captain's two path charters, and one wildcard drawn at
//     even weight from the other eight. The pairing lives here in
//     CHARTER_PATH rather than in each record's own pathWeight, because
//     the trio is composed by the reader rather than by the weighted
//     draw the two older drafts run, and a lean written beside the pair
//     would be the same fact in a second place. The records carry
//     NO_LEAN for that reason, and the validator holds the two per path
//     count against this one map.
//
//   - The wildcard is drawn flat: every record's condition is the always
//     arm at weight one, so nothing about a captain bends the third slot
//     of their trio. That is what keeps the dashboard's cover row an
//     honest number (see COVER_CHARTERS below): a card any captain can
//     be offered is what lets the row read the pool rather than read who
//     happened to be dealt what.
//
//   - Every charter runs Ocean Gambit's pool alone. Power four is the
//     floor that follows rather than a taste: a card absent from Classic
//     must sit above Classic's ceiling of three, which the mode clause
//     in ../cards enforces, and four is that floor. The Factor sits at
//     five, the wide ceiling itself, as the one whose strength is a rule
//     rather than a rate.
//
//   - The trigger is the one value charter_draft, and every record names
//     it in its own field the same way a boon does. A charter's kind
//     needed no new vocabulary: CardKind carried the third word from F2
//     (see ./cards), so what F6 adds to the shape is content rather than
//     a field, which is the widening the pool record was built to take.
//
// Every line is dash free by the house rule, and none of them names an
// item: the same two scans the card pool answers to are run over these
// strings by the suite.
// =====================================================================
import type { PathId } from "../paths";
import { GAMBIT_ONLY, NO_LEAN, type CardRecord } from "./cards";

// The leg the moment lands on: the fourth of the voyage's twelve (see
// VOYAGE_LEGS for the length and ../charters for the due read). A
// constant rather than a literal at the read site, because the plan
// names the number once, in the goal's own title, and the suite holds
// the due check to this line.
export const CHARTER_LEG = 4;

// What a captain meets when the moment arrives: the glyph and the two
// lines the overlay prints, the same three fields a milestone moment
// carries, because the same overlay prints both (see ./milestones).
interface CharterMoment {
  icon: string;
  title: string;
  line: string;
}

export const CHARTER_MOMENT: CharterMoment = {
  icon: "✒️",
  title: "Your Charter",
  line: "One charter carries your ship for the rest of the voyage. Choose the one you will sail under.",
};

// The charters the dashboard's cover row counts: the salvage writer is
// the one charter that answers a raid, so cover is the question of
// whether a voyage's trio held a way to get its taken goods back. A list
// rather than a single id, because the row counts the takes the record
// files, and a second salvage card tomorrow should widen this line
// rather than a condition inside the dashboard.
export const COVER_CHARTERS: readonly string[] = ["letter_of_marque"];

// Which two charters belong to each path, keyed by charter id. The
// single home of the pairing: the trio's first two slots read this map,
// and the validator's two per path clause holds it against the records,
// so a charter added to CHARTERS without a line here fails the build
// rather than being a card no captain can ever be offered.
export const CHARTER_PATH: Record<string, PathId> = {
  bulk_charter: "quartermaster",
  standing_manifest: "quartermaster",
  gun_charter: "convoy",
  standing_escort: "convoy",
  weavers_charter: "loom",
  quality_mark: "loom",
  long_ledger: "aroma",
  quiet_account: "aroma",
  the_factor: "free_captain",
  letter_of_marque: "free_captain",
};

// The ten, authored together rather than in waves: the trio's shape
// makes an unpaired path a hole a captain's moment would fall through,
// so the two per path count is the minimum a single voyage's offer can
// be right about, and the plan's own count is ten.
export const CHARTERS: readonly CardRecord[] = [
  {
    id: "bulk_charter",
    kind: "charter",
    power: 4,
    icon: "📦",
    tags: ["bulk"],
    pathWeight: NO_LEAN,
    trigger: "charter_draft",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "flags", flags: { transport_per_lot_discount: 1 } },
    modes: GAMBIT_ONLY,
    strings: {
      en: {
        name: "The Bulk Charter",
        desc: "Freight is 1 Gold cheaper per lot for the rest of the voyage.",
      },
      zh: {
        name: "大宗契",
        desc: "大批装运，本航程每批运费降低 1 金。",
      },
    },
  },
  {
    id: "standing_manifest",
    kind: "charter",
    power: 4,
    icon: "📜",
    tags: ["public", "bulk"],
    pathWeight: NO_LEAN,
    trigger: "charter_draft",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "flags", flags: { manifest_order_bonus: 0.15 } },
    modes: GAMBIT_ONLY,
    strings: {
      en: {
        name: "The Standing Manifest",
        desc: "Completed orders pay 15% more, for the rest of the voyage.",
      },
      zh: {
        name: "常备舱单",
        desc: "本航程每笔完成订单多付 15%。",
      },
    },
  },
  {
    id: "gun_charter",
    kind: "charter",
    power: 4,
    icon: "⚔️",
    tags: ["crewed"],
    pathWeight: NO_LEAN,
    trigger: "charter_draft",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "flags", flags: { guns_risk_discount: 0.3 } },
    modes: GAMBIT_ONLY,
    strings: {
      en: {
        name: "The Gun Charter",
        desc: "You sail armed. Raids against you are 30% less likely, for the rest of the voyage.",
      },
      zh: {
        name: "火炮特许",
        desc: "全船武装，本航程遭遇袭击的概率降低 30%。",
      },
    },
  },
  {
    id: "standing_escort",
    kind: "charter",
    power: 4,
    icon: "🛡️",
    tags: ["public", "crewed"],
    pathWeight: NO_LEAN,
    trigger: "charter_draft",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "flags", flags: { standing_escort_discount: 0.5 } },
    modes: GAMBIT_ONLY,
    strings: {
      en: {
        name: "The Standing Escort",
        desc: "A cutter keeps station. Escort contracts cost half, for the rest of the voyage.",
      },
      zh: {
        name: "常驻护航",
        desc: "快船随行，本航程护航合同费用减半。",
      },
    },
  },
  {
    id: "weavers_charter",
    kind: "charter",
    power: 4,
    icon: "🧵",
    tags: ["woven"],
    pathWeight: NO_LEAN,
    trigger: "charter_draft",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "flags", flags: { loom_extra_produce: 1 } },
    modes: GAMBIT_ONLY,
    strings: {
      en: {
        name: "The Weavers' Charter",
        desc: "The looms never stop. Each weaver produces 1 extra item every round, for the rest of the voyage.",
      },
      zh: {
        name: "织工特许",
        desc: "织机不停，本航程每位织工每轮多产出 1 件货物。",
      },
    },
  },
  {
    id: "quality_mark",
    kind: "charter",
    power: 4,
    icon: "🏷️",
    tags: ["woven", "luxury"],
    pathWeight: NO_LEAN,
    trigger: "charter_draft",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "flags", flags: { loom_sale_bonus: 0.1 } },
    modes: GAMBIT_ONLY,
    strings: {
      en: {
        name: "The Quality Mark",
        desc: "Your cloth carries the mark. Woven goods sell for 10% more, for the rest of the voyage.",
      },
      zh: {
        name: "品质印记",
        desc: "织物皆盖印记，本航程织物售价提高 10%。",
      },
    },
  },
  {
    id: "long_ledger",
    kind: "charter",
    power: 4,
    icon: "🧾",
    tags: ["debt"],
    pathWeight: NO_LEAN,
    trigger: "charter_draft",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "flags", flags: { voyage_purchase_discount: 0.1 } },
    modes: GAMBIT_ONLY,
    strings: {
      en: {
        name: "The Long Ledger",
        desc: "The harbors keep your account. Port purchases cost 10% less, for the rest of the voyage.",
      },
      zh: {
        name: "长账簿",
        desc: "港口记账，本航程港口采购降价 10%。",
      },
    },
  },
  {
    id: "quiet_account",
    kind: "charter",
    power: 4,
    icon: "💼",
    tags: ["sealed"],
    pathWeight: NO_LEAN,
    trigger: "charter_draft",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "flags", flags: { voyage_dues_discount: 0.5 } },
    modes: GAMBIT_ONLY,
    strings: {
      en: {
        name: "The Quiet Account",
        desc: "Settled in advance: harbor dues are halved, for the rest of the voyage.",
      },
      zh: {
        name: "静默账户",
        desc: "费用预先结清，本航程港口费用减半。",
      },
    },
  },
  // The one at the wide ceiling, and the one that writes two keys: the
  // count of borrows this voyage opens and the penalty each one carries.
  {
    id: "the_factor",
    kind: "charter",
    power: 5,
    icon: "🧮",
    tags: ["debt", "luxury"],
    pathWeight: NO_LEAN,
    trigger: "charter_draft",
    condition: { kind: "always", weight: 1 },
    effect: {
      kind: "flags",
      flags: { factor_borrows: 3, factor_penalty: 0.6 },
    },
    modes: GAMBIT_ONLY,
    strings: {
      en: {
        name: "The Factor",
        desc: "A factor keeps your books. Borrowing is open three times a voyage, and each borrow carries a 60% penalty.",
      },
      zh: {
        name: "代理人",
        desc: "账房有人打理，本航程可借款三次，每次扣除 60%。",
      },
    },
  },
  {
    id: "letter_of_marque",
    kind: "charter",
    power: 4,
    icon: "🖋️",
    tags: ["sealed", "public"],
    pathWeight: NO_LEAN,
    trigger: "charter_draft",
    condition: { kind: "always", weight: 1 },
    effect: { kind: "flags", flags: { marque_salvage: 0.25 } },
    modes: GAMBIT_ONLY,
    strings: {
      en: {
        name: "The Letter of Marque",
        desc: "A royal warrant. You recover a quarter of anything raiders take from you, for the rest of the voyage.",
      },
      zh: {
        name: "私掠许可证",
        desc: "皇家授权，本航程被劫掠的财物可追回四分之一。",
      },
    },
  },
];
