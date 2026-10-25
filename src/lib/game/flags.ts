// Ocean Gambit rollback switches. Every system added in Ocean Gambit is
// judged by mode first and by its environment value second, so a deployment
// serving both modes can only ever remove a Gambit system. It can never hand
// one to a Classic harbor.

import { modeConfig } from "./mode";

/**
 * The switch policy: on unless the value is exactly "off" or "0", after
 * trimming and lowercasing. A typo therefore leaves the game playable.
 *
 * The value is passed in rather than the variable name because these rules
 * also run in the browser, where the bundler replaces only a full
 * `process.env.NAME` read written at the call site. A name-based lookup
 * would compile to an empty object and read as on in every build.
 */
function flagOn(raw: string | undefined): boolean {
  const value = (raw ?? "").trim().toLowerCase();
  return value !== "off" && value !== "0";
}

/**
 * A switch's full answer: the mode it belongs to, then the operator's
 * rollback inside that mode. The second argument is the call site's own
 * environment read.
 */
export function flagOnFor(mode: unknown, raw: string | undefined): boolean {
  return modeConfig(mode).gambitSystems && flagOn(raw);
}

/** The provisions, spoilage and split hold layer. */
export function survivalLayerOn(mode: unknown): boolean {
  return flagOnFor(mode, process.env.NEXT_PUBLIC_SURVIVAL);
}

/** Split cargo and stores capacities. Requires the survival layer. */
export function splitHoldOn(mode: unknown): boolean {
  return flagOnFor(mode, process.env.NEXT_PUBLIC_SPLIT_HOLD);
}

/** The three pathbound slots on the orders board. */
export function pathOrdersOn(mode: unknown): boolean {
  return flagOnFor(mode, process.env.NEXT_PUBLIC_PATH_ORDERS);
}

/** Escort contracts on the Parley board. */
export function escortContractsOn(mode: unknown): boolean {
  return flagOnFor(mode, process.env.NEXT_PUBLIC_ESCORT_CONTRACTS);
}

/** Bazaar rumors and their settlement price lean. */
export function bazaarRumorsOn(mode: unknown): boolean {
  return flagOnFor(mode, process.env.NEXT_PUBLIC_BAZAAR);
}

/** The fleet's path draft and its one path switch. */
export function pathDraftOn(mode: unknown): boolean {
  return flagOnFor(mode, process.env.NEXT_PUBLIC_PATH_DRAFT);
}

/** Module trading between captains. Equipped modules survive a rollback. */
export function moduleTradesOn(mode: unknown): boolean {
  return flagOnFor(mode, process.env.NEXT_PUBLIC_MODULE_TRADES);
}

/** Milestone boons. Held boons survive a rollback and heal on load. */
export function milestoneBoonsOn(mode: unknown): boolean {
  return flagOnFor(mode, process.env.NEXT_PUBLIC_MILESTONE_BOONS);
}

/** The charter offered at round four. A held charter survives a rollback. */
export function chartersOn(mode: unknown): boolean {
  return flagOnFor(mode, process.env.NEXT_PUBLIC_CHARTERS);
}

// The refit bench reads the garments layer before answering, and garments
// reads this module, so that switch lives in ./engine/refits to avoid a
// cycle.
