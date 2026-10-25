// The Manifest Audit: from round five, once per voyage, a majority at Parley
// may open one captain's manifest. The harbor sees two random entries
// from their last five fills.
//
// The randomness lets an innocent look bad and a guilty look clean, so the
// table argues rather than accepts a verdict. The record is an allow list
// (port, goods, Gold, round) and cannot leak anything else.
//
// The server owns the vote and the Larder; this module owns the sample
// and the record's lifetime.

import { createRng } from "./rng";
// Built at read time, so the sentence follows the reader's language.
import { t } from "./i18n";
import type { OrderFill } from "./types";

// Earlier, the manifest is too short to sample.
export const AUDIT_FROM_ROUND = 5;

// Fills the sample draws from and the save keeps; widening it quiets the
// sample, so it stays separate from the reveal count.
export const AUDIT_WINDOW = 5;

// Different games from two to three of five; raising it moves toward a
// verdict.
export const AUDIT_REVEAL_COUNT = 2;

// Must move with the count above, or the card promises a pair over three.
export const AUDIT_REVEAL_WORDS = "a random pair";

// Strictly more than half of the roster, stated once for the panel.
export const AUDIT_VOTE_RULE =
  "A majority is more than half of the captains still in the voyage.";

/**
 * The sample's seed, built only from public facts so a reveal can be
 * checked. The target id keeps two votes in one round from sampling alike.
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
 * Window first, sample second, so a captain is judged on recent fills. A
 * short window is not padded.
 */
export function drawAudit(
  seed: string,
  fills: readonly OrderFill[],
): OrderFill[] {
  const window = fills.slice(-AUDIT_WINDOW);
  if (window.length <= AUDIT_REVEAL_COUNT) return window;
  // Without replacement, in draw order: a sample, not a summary.
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
 * The manifest a captain keeps, bounded because a save is a client blob.
 * Shape checks drop impossible fills; numbers floor so a damaged save
 * reads as a wrong line, not a broken screen. maxRound is optional: the
 * round bound needs a known harbor round, and the load path has none.
 */
// These bounds cover what a shared surface prints. Limits come from the
// game's longest name and widest order; over-limit lines are dropped.
const FILL_TEXT_MAX = 32;
const FILL_ITEMS_MAX = 4;
// Widest single line asks for four units.
const FILL_QTY_MAX = 999;

export function normalizeOrderFills(
  raw: unknown,
  maxRound?: number,
): OrderFill[] {
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
    // A line from an unfiled future round is not evidence.
    if (maxRound !== undefined && round > maxRound) continue;
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
 * One nomination count for both votes, each at its own threshold, so
 * counting cannot drift. A roster of nobody carries nothing. Two captains
 * cannot both pass half one roster, so order is irrelevant.
 */
export function carriedTarget(
  votes: ReadonlyMap<string, string>,
  roster: number,
  namesNeeded: number,
): string | null {
  if (roster <= 0) return null;
  const counts = new Map<string, number>();
  for (const target of votes.values()) {
    counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  for (const [target, count] of counts) {
    if (count >= namesNeeded) return target;
  }
  return null;
}

/**
 * Strictly more than half the active roster; auditNamesNeeded is the one
 * count the card and server share.
 */
export function auditCarried(
  votes: ReadonlyMap<string, string>,
  roster: number,
): string | null {
  return carriedTarget(votes, roster, auditNamesNeeded(roster));
}

/**
 * Smallest whole count above half; an empty roster needs nobody.
 */
export function auditNamesNeeded(roster: number): number {
  if (roster <= 0) return 0;
  return Math.floor(roster / 2) + 1;
}

/**
 * Keep a nomination only if voter and target remain on the roster. Shared
 * with the maroon book so one rule governs both.
 */
export function pruneStaleVotes(
  votes: ReadonlyMap<string, string>,
  roster: ReadonlySet<string>,
): Map<string, string> {
  const kept = new Map<string, string>();
  for (const [voter, target] of votes) {
    if (roster.has(voter) && roster.has(target)) kept.set(voter, target);
  }
  return kept;
}

/**
 * The reveal's only rendering, beside the record so prose and data cannot
 * drift; the verdict stays with the table.
 */
export function fulfillmentLine(fill: OrderFill): string {
  const goods = fill.items
    .map((i) => t("{i.qty} {i.type}", { "i.qty": i.qty, "i.type": t(i.type) }))
    .join(t(" and "));
  return t("Round {fill.round}: {goods} to {fill.port}, {fill.reward} Gold", {
    "fill.round": fill.round,
    goods,
    "fill.port": t(fill.port),
    "fill.reward": fill.reward,
  });
}
