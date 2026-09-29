// =====================================================================
// PortMasters 2.2 Parallel Release: the Manifest Audit.
//
// [H6: the Manifest Audit] The fleet's one evidence tool. From leg five,
// once per voyage, a simple majority of the table may nominate one captain
// during the Parley checkpoint and open their manifest to the room. What
// the room then sees is two of that captain's last five order
// fulfillments, chosen at random, and nothing else.
//
// The randomness is the design and not a shortcut. Two of five means an
// innocent captain can look terrible by chance and a guilty one can come
// up clean, so the table argues about what it saw rather than accepting a
// verdict, which is the difference between this and the seer role it is
// deliberately modeled on. The captain under audit loses nothing directly
// and is not silenced: their goods were public when they bought them, the
// ports they sailed to are on the ticker, and a fulfillment is a thing
// they actually did.
//
// What the record behind it can hold is an allow list, and reading it that
// way is the point. A fill is a port, the goods in it, the Gold it paid
// and the leg it happened in. It carries no alignment, no hold, no Gold on
// hand, no card: not because those are filtered out at the reveal, but
// because nothing ever wrote them into the record, so there is no version
// of the reveal that could leak one. That property is what the smoke
// suite's adversarial sweep checks on the wire.
//
// It is also the module that owns how long that record is kept, which is
// why normalizeOrderFills lives here rather than beside the other state
// field normalizers in ./types.ts: the list exists for the sample below,
// the sample never reads past AUDIT_WINDOW, and a record that outlived its
// window would be an archive of somebody's whole voyage that no feature
// asked for and a later one could quietly start reading.
//
// The plan's second clause, the audited captain's current Larder, landed
// with C1 and it lands on the server rather than here. It could not be
// written into this file before C1: the plan named a number this tree did
// not have, and a save carried no food, so a reveal that printed one would
// have put a figure on screen that no rule ever moved. The reading itself
// belongs to ./server/realtime/audit, which is the side that holds the
// save the Larder is written into, and this module stays what it was: the
// sample, its seed, and the shape a manifest line may take. Nothing here
// reads a Larder, and it should not start.
//
// Pure: no socket, no database, no clock. The server owns the vote; this
// module owns the arithmetic of one.
// =====================================================================

import { createRng } from "./rng";
import type { OrderFill } from "./types";

// The first leg an audit may be called. Five, because the window below is
// five: an earlier vote would be looking at a manifest too short to sample
// from, which would turn the mode's only evidence tool into a formality.
export const AUDIT_FROM_ROUND = 5;

// How many of a captain's most recent fulfillments the sample is drawn
// from, and equally how many are kept on the save (see the engine's push
// site and normalizeOrderFills below). The plan's tuning knob is the
// *revealed* count below, not this one: widening the window makes the
// sample quieter rather than noisier, so the two are deliberately not
// the same number.
export const AUDIT_WINDOW = 5;

// The plan's tuning knob, named as one because two of five and three of
// five are entirely different games. Raising it moves the audit toward a
// verdict and away from a signal, which is the property the epic's
// evaluation watches.
export const AUDIT_REVEAL_COUNT = 2;

/**
 * The seed one audit's sample is drawn from.
 *
 * Every part of it is a fact the whole table already holds: the harbor,
 * the voyage, the leg and the name of the captain being audited. That is
 * the same reasoning the commission's seed follows, and it is what makes
 * the reveal checkable rather than trusted: the server is the only party
 * that can read the manifest, but given the manifest any client could
 * arrive at the identical two lines, so a reveal that did not match the
 * record would be a lie somebody could catch rather than a claim the room
 * has to take on faith.
 *
 * The target's id is in the seed rather than the round alone so that two
 * votes in one leg (which the once-per-voyage rule forbids, and which this
 * seed would otherwise make interchangeable) cannot sample the same way.
 */
export function auditSeed(
  harborId: string,
  voyageEpoch: number,
  round: number,
  targetUserId: string,
): string {
  return `${harborId}:V${voyageEpoch}:audit:R${round}:${targetUserId}`;
}

/**
 * Which of the manifest's recent lines the room is shown.
 *
 * The window is taken first and the sample second, so a captain with forty
 * fills is judged on their last five rather than on a career. Fewer than
 * the reveal count in the window is not padded and not an error: a captain
 * who filed one order this voyage is revealed as a captain who filed one
 * order, which is exactly the kind of honest reading the audit exists to
 * produce, and a captain who filed none is shown an empty manifest rather
 * than a placeholder.
 */
export function drawAudit(
  seed: string,
  fills: readonly OrderFill[],
): OrderFill[] {
  const window = fills.slice(-AUDIT_WINDOW);
  if (window.length <= AUDIT_REVEAL_COUNT) return window;
  // Without replacement, and in the order drawn rather than sorted back
  // into leg order: the reveal is a sample, not a summary, and a reader
  // who saw it sorted would read a sequence the draw never claimed.
  const rng = createRng(seed);
  const remaining = [...window];
  const drawn: OrderFill[] = [];
  for (let i = 0; i < AUDIT_REVEAL_COUNT; i++) {
    const [taken] = remaining.splice(Math.floor(rng() * remaining.length), 1);
    drawn.push(taken);
  }
  return drawn;
}

/**
 * The manifest this captain keeps, made safe to read and bounded.
 *
 * Two jobs, and the bound is the one that matters: the list is written by
 * the engine, but a save is a client's blob and can arrive holding a
 * thousand entries, so the cap here is what keeps the record the size the
 * sample expects no matter what a save claims. The shape checks throw away
 * what cannot be a fulfillment (an order always carried at least one good,
 * for a whole count of a whole leg) rather than rendering it.
 *
 * Numbers are floored rather than dropped for the same reason
 * normalizeInventory scrubs rather than trusts: a fractional count is a
 * damaged save, and a damaged save should read as a slightly wrong line
 * rather than as a broken screen in front of the whole table.
 */
// [J1: the private information review] Two bounds on a fill's shape, for
// the one reason a normalizer needs them: these lines are read by the
// whole table. A fill goes out in an audit reveal and in the ledger at the
// reveal, and until this pass the only bound on its text and its width was
// the client that wrote it, so a doctored save could put a paragraph of
// its choosing in front of six captains, or ten thousand items in one
// line, or both, at a moment the room was watching. Nothing here judges a
// captain's honesty, which the integrity pass does and only four fields
// deep: this bounds what a shared surface will print.
//
// The numbers are read off the game rather than picked: the longest port
// name in the catalogue is fourteen characters, and the widest order any
// charter or mandate asks for is three kinds of good. So a fill is allowed
// twice the longest name and one kind more than the widest order, which
// leaves a growing catalogue and a growing board room while still being a
// bound. A line over either is dropped rather than trimmed, because a
// half printed fill is a line that reads as a smaller trade than it was.
const FILL_TEXT_MAX = 32;
const FILL_ITEMS_MAX = 4;
// The same reading, for the count: the widest single line asks for four
// units of one good, so a line claiming a thousand is not a trade this
// game can produce and does not belong on a shared screen.
const FILL_QTY_MAX = 999;

export function normalizeOrderFills(raw: unknown): OrderFill[] {
  if (!Array.isArray(raw)) return [];
  const clean: OrderFill[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const fill = entry as Record<string, unknown>;
    if (typeof fill.port !== "string" || !fill.port) continue;
    if (fill.port.length > FILL_TEXT_MAX) continue;
    if (typeof fill.round !== "number" || !Number.isFinite(fill.round))
      continue;
    if (typeof fill.reward !== "number" || !Number.isFinite(fill.reward))
      continue;
    const round = Math.floor(fill.round);
    const reward = Math.floor(fill.reward);
    if (round < 1 || reward < 0) continue;
    if (!Array.isArray(fill.items)) continue;
    if (fill.items.length > FILL_ITEMS_MAX) continue;
    const items: OrderFill["items"] = [];
    for (const rawItem of fill.items) {
      if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem))
        continue;
      const item = rawItem as Record<string, unknown>;
      if (typeof item.type !== "string" || !item.type) continue;
      if (item.type.length > FILL_TEXT_MAX) continue;
      if (typeof item.qty !== "number" || !Number.isFinite(item.qty)) continue;
      const qty = Math.floor(item.qty);
      if (qty < 1 || qty > FILL_QTY_MAX) continue;
      items.push({ type: item.type, qty });
    }
    if (items.length === 0) continue;
    clean.push({ round, port: fill.port, items, reward });
  }
  return clean.slice(-AUDIT_WINDOW);
}

/**
 * Whether the nominations carry, and for whom.
 *
 * A simple majority of the active roster: strictly more than half, so a
 * table of four needs three votes and a table of five also needs three,
 * which is the plan's "simple majority" read the only way it can be read
 * without inventing a tie rule for a vote that cannot tie. Two captains
 * cannot both hold a strict majority of one roster, so the walk below
 * cannot be order dependent, and the roster rather than the votes is the
 * denominator: a captain who went bankrupt is not a vote the room is
 * waiting on, the same rule every ready check already follows.
 */
export function auditCarried(
  votes: ReadonlyMap<string, string>,
  roster: number,
): string | null {
  if (roster <= 0) return null;
  const counts = new Map<string, number>();
  for (const target of votes.values()) {
    counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  for (const [target, count] of counts) {
    if (count * 2 > roster) return target;
  }
  return null;
}

/**
 * One manifest line, as the room reads it. The reveal's only rendering,
 * kept here so the prose a captain sees and the record behind it cannot
 * drift, and worded without a verdict: the audit shows what was filed and
 * leaves the conclusion to the table.
 */
export function fulfillmentLine(fill: OrderFill): string {
  const goods = fill.items.map((i) => `${i.qty} ${i.type}`).join(" and ");
  return `Leg ${fill.round}: ${goods} to ${fill.port}, ${fill.reward} Gold`;
}
