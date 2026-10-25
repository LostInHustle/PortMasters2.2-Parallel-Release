// Path configuration: one record per path, with every fact written once.
// PathId is derived from the record keys, so adding a path needs no parallel
// id list. No clock, database or socket is read here.
import { GARMENTS } from "./constants/garments";
import { COMMODITIES, MARKET_GOODS } from "./constants/goods";
import {
  CONVOY_CANNON_SLOTS,
  QUARTERMASTER_HOLD_GAIN,
} from "./constants/paths";
import { CARGO_SLOTS, FOODS } from "./constants/supplies";
import { t } from "./i18n";
import { line, type LedgerLine } from "./ledger";
import { RENOWN_MAX_LEVEL, RENOWN_TITLES, renownTitleForLevel } from "./legacy";

interface PathConfig {
  // Printed name; the id is only a code key.
  name: string;

  // Glyph worn by locked order cards. Unique across paths.
  crest: string;

  // Player facing description of the path's ability.
  signature: string;

  // Goods the ability touches. Empty means the ability touches no goods,
  // not an unfinished field.
  goods: readonly string[];

  // Goods whose manifest orders lock to this path. The Quartermaster pool is
  // intentionally absent from the board: pantry goods are never sold back to a
  // port, so such an order would turn rations into a levy. Convoy and Free
  // Captain use actions rather than errands and bring no order either.
  orderPool: readonly string[];

  // Hold multiplier. Read only by cargoCapacity so capacity has one
  // calculation.
  cargoModifier: number;

  // Highest Renown level this path can bank, derived from RENOWN_TITLES.
  renownCeiling: number;
}

// Locked order pools read from the tables that own the goods.
const GARMENT_GOODS = Object.keys(GARMENTS);
const COMMODITY_GOODS = Object.keys(COMMODITIES);
const FOOD_GOODS = Object.keys(FOODS);

// The rung below the top, used by the four paths beside the Quartermaster.
const LADDER_CEILING = RENOWN_TITLES[RENOWN_TITLES.length - 2].minLevel;

// A typed empty list: a bare [] infers never[] and breaks the includes union
// used by lockingPathFor.
const NO_GOODS: readonly string[] = [];

export const PATHS = {
  // Cannons take cargo slots, so this hold is the smallest.
  convoy: {
    name: "Convoy",
    crest: "🛡️",
    signature:
      "Protect another captain's haul: sell one round of protection for a price you both agree, and a raid that would have hit them meets your cannons instead.",
    goods: NO_GOODS,
    orderPool: NO_GOODS,
    cargoModifier: (CARGO_SLOTS - CONVOY_CANNON_SLOTS) / CARGO_SLOTS,
    renownCeiling: LADDER_CEILING,
  },
  // Garments are both goods a refit acts on and goods a garment order demands.
  loom: {
    name: "Loom",
    crest: "🧵",
    signature:
      "Refit another captain's garments at port, faster and cheaper than they could manage alone, and hold the crafting chain that makes them.",
    goods: GARMENT_GOODS,
    orderPool: GARMENT_GOODS,
    cargoModifier: 1,
    renownCeiling: LADDER_CEILING,
  },
  // The commodity catalogue supplies the pool, so wider coverage needs no edit
  // here.
  aroma: {
    name: "Aroma",
    crest: "🕯️",
    signature:
      "Publish a rumor that shifts the next port's price band for one commodity; the fleet sees that you spoke and which good you named, and only you know which way you are leaning.",
    goods: COMMODITY_GOODS,
    orderPool: COMMODITY_GOODS,
    cargoModifier: 1,
    renownCeiling: LADDER_CEILING,
  },
  // Borrows another path's locked order and names no goods of its own.
  free_captain: {
    name: "Free Captain",
    crest: "🎭",
    signature:
      "Fill any one locked order without joining its path, once a voyage, at forty percent off the payout.",
    goods: NO_GOODS,
    orderPool: NO_GOODS,
    cargoModifier: 1,
    renownCeiling: LADDER_CEILING,
  },
  // Largest hold, highest ceiling, and no board orders: see orderPool above.
  quartermaster: {
    name: "Quartermaster",
    crest: "🧮",
    signature:
      "Supply the fleet: the largest hold at the table, the highest Renown ceiling, and the seat that decides how long a hungry crew eats.",
    goods: FOOD_GOODS,
    orderPool: FOOD_GOODS,
    cargoModifier: 1 + QUARTERMASTER_HOLD_GAIN,
    renownCeiling: RENOWN_MAX_LEVEL,
  },
} satisfies Record<string, PathConfig>;

// Derived from the record keys so a new path needs no parallel id list.
export type PathId = keyof typeof PATHS;

export const PATH_IDS = Object.keys(PATHS) as PathId[];

// Null means no path, not a failure: a captain arriving after the draft may
// have none. hasOwn blocks prototype keys such as "constructor".
export function normalizePath(value: unknown): PathId | null {
  if (typeof value !== "string") return null;
  return Object.hasOwn(PATHS, value) ? (value as PathId) : null;
}

// The single door to the record, so no caller indexes PATHS directly. A
// PathId was already validated when it was narrowed, so it answers without
// a null test; anything else may be a value from outside the record. The
// three lines are TypeScript overloads rather than redeclarations, which
// the core rule reads them as.
/* eslint-disable no-redeclare */
export function pathConfig(value: PathId): PathConfig;
export function pathConfig(value: unknown): PathConfig | null;
export function pathConfig(value: unknown): PathConfig | null {
  const id = normalizePath(value);
  return id === null ? null : PATHS[id];
}
/* eslint-enable no-redeclare */

// Derived from the pool, so a retuned path cannot desynchronize from the
// labels that explain a locked card.
export function lockingPathFor(good: string): PathId | null {
  for (const id of PATH_IDS) {
    if (PATHS[id].orderPool.includes(good)) return id;
  }
  return null;
}

// A pool of pantry goods cannot reach the board, since provisions are never
// sold back to a port. Cards promising pathbound orders use this check.
export function pathDealsBoardOrders(value: PathId | null): boolean {
  if (value === null) return false;
  return PATHS[value].orderPool.some((good) =>
    (MARKET_GOODS as readonly string[]).includes(good),
  );
}

// A pathless captain gets the base hold, since callers are arithmetic
// rather than decisions.
export function pathCargoModifier(value: PathId | null): number {
  return value === null ? 1 : PATHS[value].cargoModifier;
}

// One sentence shared by the board strip and the ledger line.
const PATH_LOCK_SENTENCE =
  "Only a captain who holds the {path} may fill this order.";
export function pathLockLine(id: PathId): string {
  return t(PATH_LOCK_SENTENCE, {
    path: t(PATHS[id].name),
  });
}

// The ledger carries material, so the path name is read in the reader's
// language.
export function pathLockLedgerLine(id: PathId): LedgerLine {
  return line(
    PATH_LOCK_SENTENCE,
    {
      path: line(PATHS[id].name),
    },
    "❌ ",
  );
}

// Raw readings; surfaces compose the sentence in the reader's language.
type PathFact =
  | { kind: "hold"; percent: number }
  | { kind: "renown"; title: string }
  | { kind: "orders"; count: number };

// Compose at the call, not at module load, so language cannot freeze.
export function pathFactText(fact: PathFact): string {
  switch (fact.kind) {
    case "hold":
      return t("Hold {n}%", { n: fact.percent });
    case "renown":
      return t("Renown to {title}", { title: t(fact.title) });
    case "orders":
      return t("{n} locked orders", { n: fact.count });
  }
}

interface PathGuideEntry {
  id: PathId;
  crest: string;
  name: string;
  signature: string;
  facts: PathFact[];
}

// Single source for all guide surfaces. Print a hold only when modified and
// an order count only when a path brings a pool.
export function pathGuide(): PathGuideEntry[] {
  return PATH_IDS.map((id) => {
    const path = PATHS[id];
    const facts: PathFact[] = [];
    if (path.cargoModifier !== 1) {
      facts.push({
        kind: "hold",
        percent: Math.round(path.cargoModifier * 100),
      });
    }
    facts.push({
      kind: "renown",
      title: renownTitleForLevel(path.renownCeiling),
    });
    if (path.orderPool.length > 0) {
      facts.push({
        kind: "orders",
        count: path.orderPool.length,
      });
    }
    return {
      id,
      crest: path.crest,
      name: path.name,
      signature: path.signature,
      facts,
    };
  });
}
