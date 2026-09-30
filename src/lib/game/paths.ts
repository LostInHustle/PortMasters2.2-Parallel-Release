// =====================================================================
// PortMasters 2.2 Parallel Release: the paths.
//
// [D1: the path configuration module, and the naming change] One record
// per path, and every fact about a path written down exactly once. This is
// the shape ./difficulty.ts uses for tiers and ./mode.ts for modes, for the
// same reason all three share it: the interface, the engine and the server
// all have to agree about what a path is, and the way they agree is that
// exactly one of them writes it down.
//
// What a path is: a captain's identity at a table, built around one verb
// and one ability that acts on another captain, because nobody forms an
// identity around an inventory category (see Epic D of the plan). The
// record below is the mechanic side of that identity and it is all data:
// the crest a locked order card wears, the sentence a card prints, the
// goods the ability touches, the goods whose manifest orders lock to the
// path, the multiplier its hold carries, and the Renown it banks to.
//
// The id type is derived from the record, and that is the one structural
// decision here worth the paragraph. `PathId` is `keyof typeof PATHS`, so a
// sixth path is one entry in this file and nothing else in the tree has to
// move; there is deliberately no enum, no parallel list of ids and no hand
// written ORDER array, because each of those is a second place to edit and
// the day one of them is missed is the day a path exists that half the tree
// cannot see. The plan's own evaluation asks for exactly this property, and
// the cycle that built this file proved it by adding a sixth path to the
// record and building the tree without touching anything else.
//
// Nothing here reads a clock, a database or a socket, and there is no
// environment value behind it: a path is content, so retuning one is an
// edit to this record rather than a deploy. The slice that lets a captain
// hold one at all is D7's draft, which deals every seat a hand as the
// voyage leaves the dock, so the pathless captain this record keeps
// describing is the one who arrived after the deal rather than the one who
// has not chosen yet (see pathConfig).
//
// The naming change is the other half of D1 and it has two halves of its
// own. The plan's instruction is that faction becomes path everywhere: this
// tree never used the retired word in the product, and the one place it
// survived (a comment in src/app/palette.css, naming the Great Houses'
// colours) was swept in the same pass, so what a reader meets in code is
// path and nothing else. The second half is that Variable stops being a
// name for a hidden card, which is a rule about handles rather than about
// taste: a word a captain can spend naming the thing somebody is hiding
// turns the first question at every table into an accusation, and the word
// belongs to the mode besides. The tell now lives in ./gambit.ts as the
// hidden card, in the code, in the schema comment and in the suite's own
// labels, and no screen has ever printed it.
//
// One collision was recorded here rather than silently resolved, because
// resolving it was not D1's to do: the word Convoy already named a pooled
// contribution on the harbor's venture board (MANIFEST 04, see ./convoy.ts),
// and the path below shares the word. D3 resolved it, and resolved it this
// way: the path keeps the name, because the plan's own content and the
// draft that deals a path to every captain are written in it, and the
// venture's player facing label moved instead, from Convoy Ventures to
// Ventures, so the one word a captain meets on the boards names one thing
// again. The venture's code keeps its historical identifiers, which is a
// note ./convoy.ts carries rather than a second rename: the model is
// persisted and a persisted name is a migration, not a copy change.
// =====================================================================
import { GARMENTS } from "./constants/garments";
import { COMMODITIES } from "./constants/goods";
import {
  CONVOY_CANNON_SLOTS,
  QUARTERMASTER_HOLD_GAIN,
} from "./constants/paths";
import { CARGO_SLOTS, FOODS } from "./constants/supplies";
import { RENOWN_MAX_LEVEL, RENOWN_TITLES } from "./legacy";

interface PathConfig {
  // The name a captain reads on the card and the chip. Written here rather
  // than derived from the id, the way ./mode.ts writes its own badge: the
  // id is a key the code holds and this is what a screen prints.
  name: string;

  // The crest, worn by the locked order card on the board (D2) and by the
  // path chip wherever a captain is told what a locked card waits on. A
  // glyph rather than an image, the way every other piece of iconography
  // in this tree is carried, and unique across the paths so two crests can
  // never be mistaken for one another on a board that shows three.
  crest: string;

  // The one verb, and the ability that acts on another captain, as the
  // sentence a captain reads. This is copy rather than a rule: the rule
  // each sentence describes lands in that path's own slice (D3 through D6,
  // E1), and the sentence is written now because the record is where a
  // path's identity is written and a card with no line on it is not an
  // identity.
  signature: string;

  // The goods the path's own ability touches, out of the catalogue in
  // ./constants. Empty where the plan gives the path none, which is a
  // reading rather than an unfinished field: protection and opportunism
  // are not goods, and a path that invented some would be claiming a trade
  // the design never gave it. Sourced from the tables the features live in
  // (the garment table, the commodity catalogue, the three foods) rather
  // than retyped, so a fourth garment or a wider commodity list reaches
  // this record without an edit here.
  goods: readonly string[];

  // The goods whose manifest orders lock to this path: an order demanding
  // one of these is the locked card D2 greys out, stamped with this crest
  // and labelled with this name. The lock reason is computed from this
  // field rather than written onto the card (see lockingPathFor), so a
  // retuned pool cannot desynchronize from the labels it explains.
  //
  // Three paths carry a pool and two do not, and the two are the paths
  // whose abilities are actions rather than errands: Convoy sells a
  // contract and Free Captain borrows another path's order, so neither
  // brings the board an order of its own. The pools are where D2's locked
  // slots are drawn from, and the plan's phrase for that is one per pool,
  // which is one per pool the manifest can trade rather than one per path:
  // the Quartermaster's pool is C4's provisions, and provisions are pantry
  // goods bought at RATION_PRICE a meal and never sold back to a port. An
  // order for them would price like every other manifest order (five Gold
  // an item and up against a ration that costs two) and would let a
  // captain turn the till into a levy on their own larder, which is the
  // one trade this tree has deliberately never had. So the seat brings the
  // board no order, which is a reading of the plan rather than a gap in
  // it, and it is why the board's three locked slots are drawn from two
  // pools instead of three.
  orderPool: readonly string[];

  // A multiplier on the hold, and the one place a path's structural poverty
  // or plenty lives. Convoy's cannons are carried rather than stowed, so
  // they cost slots out of the cargo hold; the Quartermaster's seat carries
  // the largest hold at the table. One means the plan claims nothing about
  // this path's hold, which is a value rather than an absence.
  //
  // It lands at the hold's single capacity read (cargoCapacity in ./larder,
  // which defers to cargoSlots in ./hold) and never at a counter, which is
  // C4's rule: one subtraction of the shortage's quarter already happens
  // there, and a second site applying a path's factor would be a second
  // answer to what fits.
  cargoModifier: number;

  // The highest Renown level a captain sailing this path banks. The plan
  // gives one relation here and no numbers (the Quartermaster's ceiling is
  // "the highest"), so the numbers below are the minimal reading of that
  // relation against the ladder the tree already has: the top rung for the
  // Quartermaster, the rung beneath it for the four beside it. Read by E1
  // for the Quartermaster's own seat and by each path's slice for its own,
  // and derived from RENOWN_TITLES so a title added above the top moves
  // every ceiling with it.
  renownCeiling: number;
}

// The goods the three order paths' locked orders demand, each read off the
// table the feature itself lives in. A garment is what a Loom captain
// mends, a commodity is what an Aroma rumour moves, and the three foods are
// what a Quartermaster supplies (the plan's own three, from C4's larder).
const GARMENT_GOODS = Object.keys(GARMENTS);
const COMMODITY_GOODS = Object.keys(COMMODITIES);
const FOOD_GOODS = Object.keys(FOODS);

// The ceiling the four paths beside the Quartermaster carry: the rung
// beneath the top of the Renown ladder the tree already has. Read from the
// ladder rather than written as a number, for the reason the profile reads
// RENOWN_MAX_LEVEL rather than its own literal: a title added above Silk
// Road Sovereign would otherwise leave four paths capped at a level the
// tree no longer ends at.
const LADDER_CEILING = RENOWN_TITLES[RENOWN_TITLES.length - 2].minLevel;

// The empty list, typed, and shared by the two fields a path can leave
// empty. Written once rather than as a bare `[]` at each site for a
// mechanical reason worth the line: an untyped empty literal infers as
// `never[]`, and lockingPathFor below reads `.includes(good)` off the
// union of every path's pool, where a single `never[]` arm makes the
// whole union uninhabited and forces a cast to compile. One typed empty
// list keeps the reader cast free, and it reads the same at both sites:
// this path carries no goods of its own, or brings the board no order of
// its own.
const NO_GOODS: readonly string[] = [];

export const PATHS = {
  // The insurance market run by a player: one leg of protection, sold to
  // another captain at a price the two of them agree, with the seller's own
  // cannons deciding what a raid actually takes. Its hold is the smallest
  // because the guns that make the sale good are the cargo it cannot carry,
  // which is the plan's own account of where the path's poverty comes from.
  convoy: {
    name: "Convoy",
    crest: "🛡️",
    signature:
      "Protect another captain's haul: sell one leg of protection for a price you both agree, and a raid that would have hit them meets your cannons instead.",
    goods: NO_GOODS,
    orderPool: NO_GOODS,
    cargoModifier: (CARGO_SLOTS - CONVOY_CANNON_SLOTS) / CARGO_SLOTS,
    renownCeiling: LADDER_CEILING,
  },
  // The refit: another captain's garments restored at a port, cheaper and
  // faster than they could manage alone, on top of the crafting chain the
  // path holds. Its goods are the garments themselves, which are the goods
  // a refit acts on and the goods a garment order demands, so the two lists
  // are one list and are read from one table. The crafting chain is not
  // named with them, which is the record doing its job rather than an
  // omission: Rags is cargo the bench buys off the quay rather than a good
  // the port board trades (see RAGS in ./constants), so no order of this
  // captain's ever demands one and nothing here would read a rag.
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
  // The bazaar rumour: a published shift in one commodity's next price
  // band, with the publisher known and their own position hidden. The
  // commodities are the catalogue's own list, so D5's iteration (broader
  // coverage) is a change to the catalogue rather than to this record.
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
  // The opportunist: one locked order, filled once a voyage without joining
  // the path that owns it, at a penalty. It names no goods and no pool of
  // its own because its whole ability is a borrowed one, which is the
  // point of the path rather than a gap in it.
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
  // The seat the fleet argues over: provisions, the largest hold, the
  // highest ceiling, and the button that decides whether a crew eats. The
  // goods are C4's three foods, because supplying them is what the seat is
  // for, and the plan's own fail safe for a table that leaves the card on
  // the table is the Supply Barge, which is E1's rather than this record's.
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

// Every path, in the record's own order. Derived rather than listed, which
// is the property the id type was built for: a sixth entry above is a sixth
// entry here, with nothing to remember and nothing to drift.
export type PathId = keyof typeof PATHS;

export const PATH_IDS = Object.keys(PATHS) as PathId[];

/**
 * Whatever a save, a row or a request says about a path, read back as one
 * of the paths this build has, or null.
 *
 * Null is the absence of a path rather than a failure: D7's draft deals one
 * to every seat at the dock, so the captains who read null here are the
 * ones who arrived after the deal, and a save written before paths existed
 * is a captain who never drew. The house shape for an unknown value
 * (normalizeMode, normalizeDifficulty, normalizeRole) falls back to a
 * default; this one deliberately does not, because the fallback would be an
 * identity nobody chose and the draft's whole design is that an identity is
 * a choice somebody makes.
 *
 * The membership test is `Object.hasOwn` rather than an `in` check, which
 * is a defence rather than a style choice: `in` walks the prototype chain,
 * so the string "constructor" would pass it and hand a caller
 * Object.prototype.constructor where a PathConfig was promised.
 */
export function normalizePath(value: unknown): PathId | null {
  if (typeof value !== "string") return null;
  return Object.hasOwn(PATHS, value) ? (value as PathId) : null;
}

/**
 * The record for a path, or null where there is no path. The door every
 * reader goes through, so no module outside this file ever indexes PATHS
 * with a value it has not been handed by this function.
 */
export function pathConfig(value: unknown): PathConfig | null {
  const id = normalizePath(value);
  return id === null ? null : PATHS[id];
}

/**
 * The path whose pool owns a good, or null where a good belongs to none.
 *
 * D2's reader, and the reason the pool is config: the board computes a
 * locked card's reason from the record (this crest, this name) rather than
 * reading a label written onto the card, so a path retuned in this file
 * cannot desynchronize from the words the board explains it with. Answers
 * null for every catalogue good that no path owns, which today is most of
 * them: a Sachet is nobody's order to lock.
 */
export function lockingPathFor(good: string): PathId | null {
  for (const id of PATH_IDS) {
    if (PATHS[id].orderPool.includes(good)) return id;
  }
  return null;
}

/**
 * The hold's factor for a path, or the plain hold where there is no path.
 *
 * D3's reader, and the one that turns D1's recorded number into a rule: the
 * Convoy's cannons are carried rather than stowed, so they cost slots, and
 * the Quartermaster carries half again. It answers 1 rather than null for a
 * pathless captain because the caller is arithmetic rather than a decision:
 * a hold with no path is the base hold, and a multiplication is the shape
 * every caller wants.
 *
 * Read only by cargoCapacity in ./larder, which is the hold's single
 * capacity read, so a path factor and the shortage's quarter are applied in
 * one place and in one order (see the constants' own note). A path added to
 * the record tomorrow brings its factor here without a second edit.
 */
export function pathCargoModifier(value: PathId | null): number {
  return value === null ? 1 : PATHS[value].cargoModifier;
}

/**
 * The sentence a locked order card prints: what the card waits on, in plain
 * language. Read from the record rather than written onto the card, which is
 * the plan's own instruction for this feature ("The lock reason is computed
 * from the path config rather than written into the card, so a retuned path
 * cannot desynchronize from its own labels"): rename a path in this file and
 * every card that waits on it says the new name the same afternoon.
 *
 * One string serves both places a captain meets the lock, the strip on the
 * board and the ledger line a refused fill writes (see completeOrder in
 * ./engine/orders), because two copies of it would be two chances for the
 * card and the ledger to disagree about the same refusal.
 */
export function pathLockLine(id: PathId): string {
  return `Only a captain who holds the ${PATHS[id].name} may fill this order.`;
}
