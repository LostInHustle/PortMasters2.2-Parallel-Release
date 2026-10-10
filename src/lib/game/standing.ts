// =====================================================================
// PortMasters 2.2 Parallel Release: standing orders, as a captain writes
// them.
//
// [B3: standing orders] The room's clock already protects a table from the
// captain who walked away: the server holds the timer, and a seat the room
// has run out is left by its own defaults rather than held open forever. What that leaves is the other half of the problem. The
// defaults are the engine's opinion, not the captain's, so the leg a
// slow player never got to play is played for them by a stranger.
//
// This module is the fix's vocabulary: the record a captain writes once,
// the closed set of instructions it can hold, and the few readings of it
// that the panel and the engine do their work through, which are the
// boon a set names, the price it puts on a good, and whether the set
// would do anything at all. It is deliberately a small set.
// Every instruction here names something the engine can already do in one
// press, and the evaluation in ./engine/standing walks into the same
// functions the buttons do, so the most a mistyped order can do is what
// the captain could have done by hand.
//
// The record lives on the voyage state rather than on the account. Two
// reasons, and the second is the one that decided it: the Ledger
// Integrity Pass judges saves rather than account rows (see
// ./integrity.ts), and the plan's rollback paragraph asks that the
// written set survive the feature being switched off, which is a record
// the feature must be able to leave alone. An account level set, so a
// captain configures once for every harbor they ever sail into, is the
// iteration a later slice would do; this one is the set that plays one
// voyage.
// =====================================================================
import { cardById } from "./cards";
import type { CardRecord } from "./constants/cards";
import { MARKET_GOODS } from "./constants/goods";

/**
 * One line of a captain's shopping list: a good, and the dearest they will
 * pay for it. The ceiling is per unit, which is the price the market
 * board prints on the card, not the card's total (see getCardFinalCost,
 * which is what the purchase actually costs once boons and modules have
 * had their say).
 */
type StandingBuy = { good: string; maxPrice: number };

/**
 * What a captain writes once and the engine reads when the room's clock
 * plays a seat they were not standing at.
 *
 * `enabled` is the captain's own switch and the whole of the rollback the
 * plan asks for: with it off, every seat is left exactly the way the
 * engine's own defaults leave it, and the written set below stays
 * on the record rather than being deleted, because a switch that erased
 * the captain's work would punish them for trying it.
 *
 * Every other field is the absence of an instruction by default, and the
 * absence is spelled as the value the engine already uses: a null boon is
 * the board's first offer, an empty list buys nothing, and the two words
 * that name the seats are the quieter of the pair. A voyage whose captain
 * never opens the panel is therefore byte for byte the voyage the clock
 * alone would sail.
 */
export type StandingOrders = {
  enabled: boolean;
  // The boon to take at Dawn by id, or null for the first offer on the
  // board. Resolved against the board rather than the catalogue at the
  // moment it is used, which is what stops a written order from taking a
  // boon the captain was never dealt (see standingBoonId in
  // ./engine/standing).
  boon: string | null;
  // What to buy on the Market's purchase board. Empty buys nothing.
  buy: StandingBuy[];
  // Whether to fill the trade board at Orders. "all" presses every order
  // the hold can actually cover, in board order, and lets the engine's own
  // guard refuse the rest. There is deliberately no "profitable only"
  // setting: pricing an order means running the settlement, and a second
  // copy of what an order pays is the one thing this tree never writes.
  fill: "none" | "all";
  // The shipyard's one standing choice. Upgrading is a real instruction
  // because the engine checks the purse and the hull's ceiling itself;
  // drafting a module is not, because the module board is rolled fresh
  // every round and there is no honest way to write "which one" ahead of
  // it.
  shipyard: "continue" | "upgrade";
};

/**
 * The longest a shopping list can be and still say anything: one line for
 * every good the port board trades. Derived rather than chosen, the same way
 * ./integrity.ts derives its ceilings, so a charter that adds a good
 * widens this with it instead of quietly leaving lines off the end.
 *
 * The board's list rather than the hold's, which is the one thing D4 changed
 * here. An instruction buys a card, and the merchant's cards are dealt from
 * the goods the merchant trades (see MARKET_GOODS in ./constants): the moment
 * Rags became cargo without becoming a market good, a line for Rags turned
 * into a line that could never fire, and a cap counted over it would be the
 * length of a list a line longer than anything the board can answer.
 */
export const MAX_STANDING_BUYS = MARKET_GOODS.length;

/**
 * A captain who has written nothing: the switch on, every seat at its
 * default. This is what a fresh voyage opens with, what an old save heals
 * to (see normalizeStandingOrders below), and what the seat defaults in
 * ./engine/lifecycle reproduce exactly.
 */
export function defaultStandingOrders(): StandingOrders {
  return {
    enabled: true,
    boon: null,
    buy: [],
    fill: "none",
    shipyard: "continue",
  };
}

/**
 * Whatever a save holds, read back as a complete and closed record.
 *
 * The record is written by a client, so it is treated as untrusted input
 * on the same terms as every other saved field: a value the vocabulary
 * does not name is dropped rather than trusted, the list is bounded by
 * the goods the tree can actually price and deduped by good, and a price
 * that is not a finite number is not a price. Nothing here throws and
 * nothing returns null, because a damaged record should cost a captain
 * their instructions rather than their voyage.
 *
 * A save written before this field existed carries none of it, and lands
 * on the default above. That is deliberate and it is exact: the default
 * record behaves identically to the seat defaults the engine carries, so
 * an old save loads into the voyage it was already sailing.
 *
 * A boon id is kept as written rather than resolved here. It names a
 * catalogue entry, and the catalogue is not this module's business at the
 * boundary: standingBoon below resolves it for a reader, and the
 * evaluation resolves it against the dealt board for an actor.
 */
export function normalizeStandingOrders(raw: unknown): StandingOrders {
  const out = defaultStandingOrders();
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  if (typeof src.enabled === "boolean") out.enabled = src.enabled;
  if (typeof src.boon === "string") out.boon = src.boon;
  if (src.fill === "all") out.fill = "all";
  if (src.shipyard === "upgrade") out.shipyard = "upgrade";
  const buys: StandingBuy[] = [];
  const seen = new Set<string>();
  const list = Array.isArray(src.buy) ? src.buy : [];
  for (const entry of list) {
    // Once every good the tree can price has a line, nothing later in the
    // list can add one, so the scan stops there rather than walking the
    // rest of whatever the record held. This is the whole of what the cap
    // does, and it is why the bound is the catalogue's size rather than a
    // number: it fires exactly when the list is complete.
    if (buys.length >= MAX_STANDING_BUYS) break;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const e = entry as Record<string, unknown>;
    const good = typeof e.good === "string" ? e.good : "";
    if (!(MARKET_GOODS as readonly string[]).includes(good)) continue;
    if (seen.has(good)) continue;
    const price =
      typeof e.maxPrice === "number" && Number.isFinite(e.maxPrice)
        ? Math.floor(e.maxPrice)
        : null;
    if (price === null || price < 0) continue;
    seen.add(good);
    buys.push({ good, maxPrice: price });
  }
  out.buy = buys;
  return out;
}

/**
 * The boon a captain wrote, as the catalogue entry it names, or null for
 * one that was not written and for one that names nothing the tree still
 * ships. One resolution, read by the panel and by the evaluation, so a
 * screen can never show a captain a boon the engine would not take.
 *
 * Whether the boon is on the board this round is a different question and
 * a different reader: see standingBoonId in ./engine/standing.
 */
export function standingBoon(orders: StandingOrders): CardRecord | null {
  if (!orders.boon) return null;
  // [F2: the card record, and the mode weighting field] Resolved through the
  // walk rather than through a second find over the boon table, and held to
  // the kind: the id a record names is a boon's or it is nothing, so a
  // standing order that named a module would be read as unwritten rather
  // than as an instruction the engine could never take.
  const card = cardById(orders.boon);
  return card && card.kind === "boon" ? card : null;
}

/**
 * Whether a set would do anything at all if the room's clock played a
 * seat right now.
 *
 * The switch alone does not answer that: a captain who turned it on and
 * wrote nothing below it is sailing exactly the voyage an empty record
 * plays, and a control panel that lit up for them would be claiming the
 * seat is being played by orders that do not exist. So this is the switch
 * and at least one written instruction, kept here rather than at the call
 * site because it is a statement about the shape of the record: a field
 * added to StandingOrders above is a field this function has to be told
 * about, and one place to remember is better than a screen full of them.
 */
export function standingOrdersLive(orders: StandingOrders): boolean {
  return (
    orders.enabled &&
    (orders.boon !== null ||
      orders.buy.length > 0 ||
      orders.fill === "all" ||
      orders.shipyard === "upgrade")
  );
}

/**
 * What a captain said they would pay for one good, or null when they said
 * nothing about it. The engine's own readers go through this rather than
 * scanning the list, so a card is judged by the same line the panel drew.
 */
export function standingBuyFor(
  orders: StandingOrders,
  good: string,
): number | null {
  return orders.buy.find((b) => b.good === good)?.maxPrice ?? null;
}
