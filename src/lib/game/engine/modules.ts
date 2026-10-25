// The module trade. A module bolted to a hull can change hands at the
// Parley table: one captain lists it, another buys at an agreed price.
//
// The agreement is the consent primitive the escort contract and the refit
// share (see ./consent). The kind specific rules live here:
//
// * Anyone may sell. A module is a thing bolted to a hull, not a path
//   ability, so owning one is the only qualification. The seller's own
//   client takes it off.
// * The terms are a card id, checked through isModuleId, the same reader
//   the server asks before publishing a row.
// * Selling a slotted module unequips it automatically and unwinds the
//   accounting it carried (see unequipModuleAccounting in ./boons).
// * Neither side is bounded to one agreement a round. A module can leave
//   once, via the per module lock, and a buyer's slots bound a purchase
//   on their panel. A purchase onto a full hull bolts on anyway: both
//   machines must agree a trade completed, and a module lost between
//   clients would be a durable thing destroyed by a race.
import { cardById, cardName, cardsOfKind } from "../cards";
import { line, type LedgerLine } from "@/lib/game/ledger";
import { moduleTradesOn } from "../flags";
import type { GameState } from "../types";
import { floorTallies, type ConsentTerms } from "./consent";
import { installModuleAccounting, unequipModuleAccounting } from "./boons";
import { settleConsentTrade } from "./settlement";

/**
 * Whether this hull has anything to sell. No path check: any captain may
 * sell; switch first, so a build with the feature off refuses everyone.
 */
export function canSellModule(
  state: Pick<GameState, "equippedModules" | "mode">,
): boolean {
  return moduleTradesOn(state.mode) && state.equippedModules.length > 0;
}

/**
 * Whether the pool knows this id as a module, the one thing the server can
 * check without a save. Unknown cards are refused at the post.
 */
export function isModuleId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const card = cardById(value);
  return card !== null && card.kind === "module";
}

/**
 * One row per module per seller per round, across every status. A settled
 * sale is the strongest reason the module is not for sale again this round.
 */
export function moduleListedThisRound(
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
 * Applies this captain's side through the shared settlement. The seller's
 * machine unequips and unwinds; the buyer pays and bolts on.
 */
export function applyModuleTradeSide(
  state: GameState,
  trade: ModuleTrade,
  meId: string,
  logs: LedgerLine[],
): boolean {
  return settleConsentTrade(state, logs, {
    on: moduleTradesOn,
    status: "agreed",
    row: trade,
    meId,
    counters: {
      bought: "modulesBought",
      feesPaid: "moduleFeesPaid",
      sold: "modulesSold",
      feesEarned: "moduleFeesEarned",
    },
    copy: {
      buyer: (paid) =>
        line(
          "🤝 Module trade: paid {paid} Gold to {trade.sellerName} for {name}.",
          {
            paid,
            "trade.sellerName": trade.sellerName,
            name: cardName(trade.module),
          },
        ),
      seller: (fee) =>
        line("🤝 Module trade: {buyerName} paid {trade.fee} Gold for {name}.", {
          buyerName: trade.buyerName ?? line("A captain"),
          "trade.fee": fee,
          name: cardName(trade.module),
        }),
    },
    onBuy: (state, logs) => {
      // Ask the pool rather than trust the row: a module this build does not
      // know costs the fee and a sentence, not a crash or a nameless card.
      const name = cardName(trade.module);
      const card = cardById(trade.module);
      // A hull carries a module or it does not. A second copy through a stale
      // board would add slot, power and surcharge without an effect, so it is
      // refused; the fee has already moved, the same asymmetry a short purse
      // has.
      if (
        card !== null &&
        card.kind === "module" &&
        state.equippedModules.some((m) => m.id === card.id)
      ) {
        logs.push(
          line(
            "❌ {name} is already bolted to your hull; the extra copy is discarded.",
            {
              name,
            },
          ),
        );
      } else if (card !== null && card.kind === "module") {
        state.equippedModules.push(card);
        // This door bypasses equipModule, so it calls the same install
        // accounting every other landing site calls. Without it the surcharge
        // is never charged and the first unwind pays the captain every
        // Resolve.
        installModuleAccounting(state, card);
        logs.push(line("🔧 {name} is bolted to the hull.", { name }));
      } else {
        logs.push(line("❌ The yard has no {name} to bolt on.", { name }));
      }
    },
    onSell: (state, logs) => {
      // The automatic unequip, found by position: the first copy goes, so a
      // captain with two of the same module keeps one.
      const at = state.equippedModules.findIndex((m) => m.id === trade.module);
      if (at >= 0) {
        unequipModuleAccounting(state, state.equippedModules[at]);
        state.equippedModules = state.equippedModules.filter(
          (_, i) => i !== at,
        );
        logs.push(
          line("🔧 {name} leaves your hull for {buyerName}.", {
            name: cardName(trade.module),
            buyerName: trade.buyerName ?? line("a captain"),
          }),
        );
      }
    },
    onSold: (state) => {
      state.modulesTraded[trade.module] =
        (state.modulesTraded[trade.module] ?? 0) + 1;
    },
  });
}

/**
 * Heals the tallies and the per module map at load. The four counters go
 * through floorTallies because a NaN tally is read as forged; the map has
 * its own reader with the same rules.
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
 * The per module ledger's heal, shared with the report script (see
 * scripts/moduleTrades.ts). Counts are floored; entries that read as none
 * are dropped.
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

// One record, shared by both ends of the wire (see src/types/realtime).
export type ModuleTrade = ConsentTerms & {
  status: "offered" | "agreed";
  // The module being traded, as a card id. Both ends resolve its name
  // through the same pool.
  module: string;
};

// Compares what each save's hull carries against what it sold, so a module
// that is always equipped shows up as a tax rather than a choice.

/** One save's contribution: what its hull carries and what it sold. */
export type ModuleTrafficSave = {
  equipped: readonly string[];
  traded: Record<string, number>;
};

/**
 * Which modules to read, and whose saves. `modules` is ids and names
 * rather than cards, so a suite need not author a card to build a subject.
 */
interface ModuleTrafficSubject {
  modules: readonly { id: string; name: string }[];
  saves: readonly ModuleTrafficSave[];
}

/** One module's two numbers, which is a row of the report. */
type ModuleTrafficRow = {
  id: string;
  name: string;
  /** How many of these saves carry this module on the hull right now. */
  equipped: number;
  /** How many times these saves sold one away. */
  traded: number;
};

/**
 * Two passes, no decisions. A module nobody equipped and nobody traded
 * still gets a row, because two zeroes is the reading that says the module
 * never reaches a table.
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
 * The same reading against the pool this build shipped, walked from the
 * card pool so a new module appears as soon as it exists.
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
