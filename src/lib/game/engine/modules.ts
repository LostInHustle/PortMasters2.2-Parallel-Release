// =====================================================================
// PortMasters 2.2 Parallel Release: the module trade.
//
// [F3: modules in the shipyard ladder, and trading them between captains]
// The shipyard has climbed the same ladder since the first voyage: a hull
// takes one more module for every level it gains, up to three at ship
// level three (the top of the climb, see MAX_SHIP_LEVEL in
// ../constants/ships), and a module bolted on is permanent until
// a swap at the yard takes it off (see moduleSlotsOpen in ./core and
// equipModule in ./boons). What the ladder never had is a way for a module
// to leave the hull it was drafted into and join another. That is the whole
// of this feature: one captain lists a module they have bolted on, another
// buys it at a price the two of them agree, and the module changes hands at
// the Parley table, which gives the build layer its own liquidity and gives
// the table a class of deal that is not about commodities.
//
// The agreement is the consent primitive D3's escort contract and D4's
// refit already share (see ./consent), which is why this module is as short
// as it is: what a fee is, which rows a captain sees, when an offer
// expires, the one offer per seller per buyer bound, the accept that sweeps
// the rest and the ledger that keeps a reload from moving the same Gold
// twice are read from there rather than written again. What is kind
// specific, and therefore here:
//
// Who may sell. Anyone, which is this kind's departure from its two
// siblings and not an omission. The escort's seller is a Convoy and the
// bench's is a Loom, because cover and mending are path abilities; a module
// is not an ability, it is a thing bolted to a hull, so a captain's only
// qualification is owning one. The server cannot read a save and does not
// try (the trust boundary every consent board holds, restated in
// src/server/realtime/consent), so a listing is a captain's own claim about
// their own hull, and the seller's own client is what takes the module off.
//
// What the two captains are trading. A module card id, checked against the
// pool through isModuleId below, which is the reader the server's post
// handler asks before it publishes a row, so a row naming a boon or a card
// nobody can bolt on never reaches a board.
//
// What an agreement does to a state, which is the plan's own named rule:
// "Trading a slotted module needs a rule about what happens if it is traded
// while equipped, and the answer should be an automatic unequip rather than
// a block." So the seller's side of a settle takes the module out of
// equippedModules and unwinds the accounting two modules carry for as long
// as they are installed (see unequipModuleAccounting in ./boons), then
// credits the agreed fee; the buyer's side pays what their purse holds and
// bolts the module on.
//
// Which side is bounded to one agreement a leg. Neither, and this is the
// other place the kind parts company with its siblings. The escort bounds
// its buyer because one captain's cover is one field and a second contract
// could not be honoured; the bench bounds its seller because one Loom has
// two hands and one leg. A hull's modules are a shelf rather than a field
// and not a pair of hands: what bounds a sale is that one module can only
// leave once, which is the per module lock below, and what bounds a
// purchase is the buyer's own slot count, read on the buyer's own panel
// rather than counted by the room. Neither is a rule the server can check,
// and the server does not pretend to: it keeps the ordering (one row per
// module per seller per leg, one open offer per seller per buyer) and
// leaves the hulls to their owners.
//
// One corner the buyer's side is written around, worth saying because a
// reader will look for the missing check and should find this instead. A
// purchase settling onto a hull whose slots are all full bolts the module
// on anyway rather than refusing it or dropping it. The panel hides the
// accept where there is no room and the honest path cannot reach the
// corner (both sides settle within a tick of the accept, in the Parley,
// and the yard only opens at Dusk), but the two machines have to reach the
// same answer about whether a trade happened without being able to see each
// other's hulls, and the one answer both can reach is that an agreed trade
// always completes. A module lost between two clients would be a durable
// thing destroyed by a race, which is the outcome the plan's rollback
// clause treats as the thing not to do ("keep the table and disable
// equipping, rather than dropping the table and losing equipped modules");
// a hull reading one over its slots is a captain who swaps at the yard
// before drafting again, which the yard's screens already carry, because
// every slot reader floors at zero and answers "full" (see moduleSlotsOpen
// in ./core).
// =====================================================================
import { cardById, cardName, cardsOfKind } from "../cards";
import { moduleTradesOn } from "../flags";
import type { GameState } from "../types";
import {
  floorTallies,
  markMovement,
  movementApplied,
  type ConsentTerms,
} from "./consent";
import { addOwnedAmount, getOwnedAmount } from "./core";
import { installModuleAccounting, unequipModuleAccounting } from "./boons";

/**
 * Whether this captain has anything to sell, which is the panel's question
 * before it draws a form.
 *
 * The switch is read first and separately from the hull, for the reason the
 * escort's own reader gives: the flag is the operator's rollback and the
 * hull is the captain's own state, and a build with the feature off must
 * answer a captain with five modules bolted on as flatly as it answers an
 * empty one. Deliberately not a path check: any captain may sell (see the
 * header).
 */
export function canSellModule(
  state: Pick<GameState, "equippedModules" | "mode">,
): boolean {
  return moduleTradesOn(state.mode) && state.equippedModules.length > 0;
}

/**
 * Whether the pool knows this id as a module, which is the one thing about
 * a listing the server can check without reading anybody's save.
 *
 * Where the bench's term validates through garmentSpec and the escort's is
 * a number with bounds, this kind's term is a card, so it goes through the
 * same reader every screen names a card through. A row naming a boon, a
 * charter or an id this build has never heard of is a row no buyer could
 * take and would sit on the board for a whole leg, so it is refused at the
 * post rather than drawn and regretted.
 */
export function isModuleId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const card = cardById(value);
  return card !== null && card.kind === "module";
}

/**
 * Whether this seller already has a row standing for this module this leg.
 *
 * The kind's own bound, and the one place it sharpens the primitive's offer
 * rule. `consentOfferStanding` bounds a seller by buyer, which stops two
 * identical rows but would still let one seller list the same module to the
 * table and to a named captain at once, or list it again after the first
 * row was agreed. A module is one thing: once a row names it, that row is
 * what the board knows about it until the leg turns, whatever stage the row
 * has reached. Read over every status rather than over the open offers
 * alone, because a settled sale is the strongest of the three reasons the
 * module is not for sale again this leg.
 */
export function moduleListedThisLeg(
  rows: ModuleTrade[],
  sellerUserId: string,
  moduleId: string,
  round: number,
): boolean {
  return rows.some(
    (t) =>
      t.sellerUserId === sellerUserId &&
      t.module === moduleId &&
      t.round === round,
  );
}

/**
 * Applies this captain's side of a module trade, once.
 *
 * One function for both sides, the shape both sibling markets settle
 * through, and for the same reason: the two cases differ in who they are
 * and in which direction the Gold and the module move, and agree on
 * everything else. The seller is the one whose hull the module leaves, so
 * the seller's machine is what takes it off and what unwinds the
 * accounting the module carried; the buyer is the one who pays, and the
 * price that moves is the price the two captains agreed rather than what
 * the buyer's purse could cover, exactly as a contract's fee is.
 *
 * The ledger is the idempotence (see movementApplied in ./consent): a
 * reload between the agreement and the broadcast that carries it must not
 * charge the same fee twice, and a board that reports the same row again
 * must not move the module again either.
 *
 * Returns whether the state changed, which is what the React layer reads to
 * decide whether it owes the captain a re-render.
 */
export function applyModuleTradeSide(
  state: GameState,
  trade: ModuleTrade,
  meId: string,
  logs: string[],
): boolean {
  if (!moduleTradesOn(state.mode)) return false;
  if (trade.status !== "agreed") return false;
  const isSeller = trade.sellerUserId === meId;
  const isBuyer = trade.buyerUserId === meId;
  if (!isSeller && !isBuyer) return false;
  const key = `${trade.id}:fee`;
  if (movementApplied(state, key)) return false;
  const name = cardName(trade.module);

  if (isBuyer) {
    // Paid by a purse that is allowed to be empty, the reading both sibling
    // markets take: the buyer's accept was guarded by their own balance, so
    // a shortfall here is a purse that moved between the two clicks, and
    // the honest answer is the Gold that is actually there rather than a
    // negative hold. The seller credits the agreed price, because the price
    // rather than the payment is what the two captains shook hands on.
    const paid = Math.max(
      0,
      Math.min(trade.fee, getOwnedAmount(state, "Gold")),
    );
    addOwnedAmount(state, "Gold", -paid);
    state.modulesBought += 1;
    state.moduleFeesPaid += paid;
    logs.push(
      `🤝 Module trade: paid ${paid} Gold to ${trade.sellerName} for ${name}.`,
    );
    // The pool is asked rather than the row trusted, so a board written by a
    // build that knew a module this one does not costs the captain their fee
    // and a sentence rather than a crash or a nameless card on the hull. The
    // post refuses such a row and both ends run the same pool, so this is
    // the branch for a save that moved between two builds, which is the
    // same reachability the bench's missing garment branch has.
    const card = cardById(trade.module);
    if (card !== null && card.kind === "module") {
      state.equippedModules.push(card);
      // The bolt-on is the one door onto a hull that does not pass through
      // equipModule (its slot guard must not stand between an agreed trade
      // and its settle), so it calls the same install accounting every
      // other landing site calls. Without it the card landed bare: the
      // surcharge two modules carry was never charged, and the first
      // unwind then subtracted one that was never added, which read as a
      // negative bill that paid the captain every Resolve (see
      // installModuleAccounting in ./boons).
      installModuleAccounting(state, card);
      logs.push(`🔧 ${name} is bolted to the hull.`);
    } else {
      logs.push(`❌ The yard has no ${name} to bolt on.`);
    }
  } else {
    // The automatic unequip the plan names, and it is found by position
    // rather than by identity because the hull holds card records: the
    // first copy is the one that goes, so a captain carrying two of the
    // same module through the draft's fallback pool still has one left.
    const at = state.equippedModules.findIndex((m) => m.id === trade.module);
    if (at >= 0) {
      unequipModuleAccounting(state, state.equippedModules[at]);
      state.equippedModules = state.equippedModules.filter((_, i) => i !== at);
      logs.push(
        `🔧 ${name} leaves your hull for ${trade.buyerName ?? "a captain"}.`,
      );
    }
    addOwnedAmount(state, "Gold", trade.fee);
    state.modulesSold += 1;
    state.moduleFeesEarned += trade.fee;
    state.modulesTraded[trade.module] =
      (state.modulesTraded[trade.module] ?? 0) + 1;
    logs.push(
      `🤝 Module trade: ${trade.buyerName ?? "A captain"} paid ${trade.fee} Gold for ${name}.`,
    );
  }
  markMovement(state, key);
  return true;
}

/**
 * Heals the tally and the ledger at the load site, the way every other
 * field this build added is healed: a save written before this feature
 * reads as a captain who has never moved a module, and one carrying
 * rubbish where a count should be reads as a captain who moved none rather
 * than as one whose next trade throws.
 *
 * The four counters go through the shared flattener for the reason the
 * sibling markets give: a NaN tally is not merely wrong, it is added
 * straight into a captain's score where the Ledger Integrity Pass reads it
 * as a forged one. The per module map cannot use it, because it is a record
 * rather than a set of named fields, so it has its own reader below with
 * the same two rules: a count is floored, and anything that is not a number
 * is none. Entries that read as none are dropped rather than kept as
 * zeroes, so a heal leaves the smallest honest record of the trade behind.
 */
export function normalizeModuleTradeState(state: GameState): void {
  floorTallies(state, [
    "modulesSold",
    "modulesBought",
    "moduleFeesEarned",
    "moduleFeesPaid",
  ]);
  state.modulesTraded = normalizeModulesTraded(state.modulesTraded);
}

/**
 * The per module ledger's own heal, exported beside the state heal above
 * because it has a second caller that holds no game state: the report
 * script reads a voyage save's ledger back through this, the same reader
 * the save itself heals through, so the table and the tally cannot
 * disagree about what a save sold (see scripts/moduleTrades.ts). It takes
 * the raw field rather than a state for exactly that reason.
 *
 * The two rules are the flattener's: a count is floored, and anything that
 * is not a number at all reads as none. Entries that read as none are
 * dropped rather than kept as zeroes, so a heal leaves the smallest honest
 * record of the trade behind.
 */
export function normalizeModulesTraded(raw: unknown): Record<string, number> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [id, count] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof count !== "number" || !Number.isFinite(count)) continue;
    const held = Math.max(0, Math.floor(count));
    if (held > 0) out[id] = held;
  }
  return out;
}

// =====================================================================
// The trade as it travels: one record, declared here because the game
// layer is what both ends of the wire import from (see src/types/realtime/
// boards, which imports this shape rather than declaring a second one).
// =====================================================================
export type ModuleTrade = ConsentTerms & {
  status: "offered" | "agreed";
  // The module the trade moves, as a card id. The name is not on the row
  // because both ends of the wire run the same pool and resolve it through
  // the same reader, which is also what the blind trade above leans on.
  module: string;
};

// =====================================================================
// The plan's second reading, worked out on demand.
//
// "Track which modules are equipped against which are traded away, since a
// module that is always equipped is a tax rather than a choice." Both
// halves of that comparison are already on disk and neither needed a new
// field to be readable: what is equipped is the hull itself, which every
// voyage save carries, and what was traded away is modulesTraded, which the
// seller's own client writes as each sale settles (see
// applyModuleTradeSide). This is the reader that puts the two columns side
// by side, and its subject is the shape the card record's own validator
// takes: the modules to read and the saves to read them from, handed in
// rather than reached for, so the report reads the shipped pool and the
// suite can hold the arithmetic without a database.
// =====================================================================

/** One save's contribution: what its hull carries and what it sold. */
export type ModuleTrafficSave = {
  equipped: readonly string[];
  traded: Record<string, number>;
};

/**
 * What the reader is asked about: which modules, and whose saves.
 *
 * `modules` is a list of ids and names rather than card records, because a
 * name is the only thing the report needs from a record and a subject built
 * by hand in a suite should not have to author a whole card to be read.
 */
export interface ModuleTrafficSubject {
  modules: readonly { id: string; name: string }[];
  saves: readonly ModuleTrafficSave[];
}

/** One module's two numbers, which is a row of the report. */
export type ModuleTrafficRow = {
  id: string;
  name: string;
  /** How many of these saves carry this module on the hull right now. */
  equipped: number;
  /** How many times these saves sold one away. */
  traded: number;
};

/**
 * The comparison itself, which is two passes and no decisions: a module's
 * equipped count is the saves whose hull carries it, and its traded count
 * is what every save's ledger says it sold, summed. A module nobody
 * equipped and nobody traded still gets a row, because a row of two zeroes
 * is the reading that says the module is not reaching tables at all, and a
 * module missing from the report would be indistinguishable from one that
 * is.
 */
export function readModuleTraffic(
  subject: ModuleTrafficSubject,
): ModuleTrafficRow[] {
  return subject.modules.map((module) => {
    let equipped = 0;
    let traded = 0;
    for (const save of subject.saves) {
      if (save.equipped.includes(module.id)) equipped += 1;
      traded += save.traded[module.id] ?? 0;
    }
    return { id: module.id, name: module.name, equipped, traded };
  });
}

/**
 * The same reading against the pool this build shipped, which is what the
 * report script asks for and what a suite checking the wiring between the
 * two uses. The module list is walked from the card pool itself rather than
 * typed out, so a module added tomorrow appears in the report the moment it
 * exists.
 */
export function shippedModuleTraffic(
  saves: readonly ModuleTrafficSave[],
): ModuleTrafficRow[] {
  return readModuleTraffic({
    modules: cardsOfKind("module").map((card) => ({
      id: card.id,
      name: cardName(card.id),
    })),
    saves,
  });
}
