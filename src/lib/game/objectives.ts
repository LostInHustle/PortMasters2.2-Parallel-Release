// The Ocean Gambit objective deck: one public commission per voyage, drawn
// before it starts and owed by the whole fleet.
//
// A data module: the server draws the objective to clamp reports, the
// engine pays delivery, and the interface renders it. None of the three
// owns the vocabulary; nothing here reads a clock, a socket or a database.
//
// Authoring rule: an objective a single captain can satisfy alone produces
// no conversation. Every entry asks for at least STARTING_STOCK items (16
// in ./constants/goods.ts) and at least two goods, so a hold cannot cover
// one and the fleet has to buy or trade over more than one round.
//
// Prices are the Emperor's, paid per item, and they run above the going
// rate on purpose: a commission costs a captain the goods and the orders
// they are not filling, not a discount.

import { createRng, pick } from "./rng";
import type { ObjectiveTraceEntry } from "./types";

export type Objective = {
  id: string;
  name: string;
  // One sentence, shown to every captain from the first phase.
  line: string;
  // No port: the engine has no captain location to check against, so a
  // destination would be a promise nothing keeps.
  resources: readonly { type: string; required: number; price: number }[];
};

// Six commissions, every good from the founding tier so an objective is
// fillable in round one at every difficulty, ordered smallest to largest.
// The quota rung below scales every entry rather than filtering by size.
export const OBJECTIVE_DECK: readonly Objective[] = [
  {
    id: "hemp_cordage",
    name: "The Cordage Warrant",
    line: "The yards need rope. Hemp by the bale, and linen to back it.",
    resources: [
      { type: "Hemp", required: 12, price: 8 },
      { type: "Linen Clothes", required: 5, price: 40 },
    ],
  },
  {
    id: "silk_tea_levy",
    name: "The Silk and Tea Levy",
    line: "Two holds of the old trade, silk from the north and tea from the south.",
    resources: [
      { type: "Silk", required: 10, price: 14 },
      { type: "Tea", required: 7, price: 20 },
    ],
  },
  {
    id: "cloth_quota",
    name: "The Cloth Quota",
    line: "The garrison is being re-kitted, and the weaving houses cannot do it alone.",
    resources: [
      { type: "Linen Clothes", required: 9, price: 40 },
      { type: "Cotton Clothes", required: 8, price: 62 },
    ],
  },
  {
    id: "sachet_tithe",
    name: "The Sachet Tithe",
    line: "Sachets for the court, tea for the road, and hemp to wrap the lot.",
    resources: [
      { type: "Sachet", required: 5, price: 110 },
      { type: "Tea", required: 8, price: 20 },
      { type: "Hemp", required: 5, price: 8 },
    ],
  },
  {
    id: "brocade_command",
    name: "The Brocade Command",
    line: "Brocade for the reception, and the raw stuff to keep the looms turning.",
    resources: [
      { type: "Brocade", required: 6, price: 85 },
      { type: "Silk", required: 8, price: 14 },
      { type: "Hemp", required: 6, price: 8 },
    ],
  },
  {
    id: "full_manifest",
    name: "The Full Manifest",
    line: "Nothing finished, nothing fancy. The founding three, and a great deal of them.",
    resources: [
      { type: "Hemp", required: 8, price: 8 },
      { type: "Silk", required: 8, price: 14 },
      { type: "Tea", required: 8, price: 20 },
    ],
  },
];

// A larger fleet moves more cargo, so a fixed quota gets easier with every
// extra seat. Quotas scale with the fleet and prices do not, so a wider
// commission pays more for the extra cargo rather than less per item.
//
// Four captains are the authoring table: four or fewer multiply by
// nothing, which keeps older voyages on the board they drew. Five carry a
// quarter more, six half again. Rounding is up, so the error falls on the
// side the Pirate's band lives on. Above six uses the top band, since the
// deal itself is authored for six (see ./gambit.ts).
type SeatBand = {
  // Fewest captains in this band; 0 is the anchor's floor.
  min: number;
  // Multiplier applied to every quota in the drawn commission.
  factor: number;
  // Label shown wherever a human reads the band.
  label: string;
};

// Smallest first. Exported because ./balance and the smoke suite walk the
// same table.
export const SEAT_BANDS: readonly SeatBand[] = [
  { min: 0, factor: 1, label: "4 or fewer" },
  { min: 5, factor: 1.25, label: "5" },
  { min: 6, factor: 1.5, label: "6 or more" },
];

/**
 * Which band a fleet of this size sails on. 0 and a pinned count both land
 * on the anchor, which keeps older harbors compatible.
 */
export function seatBand(seats: number): SeatBand {
  let band = SEAT_BANDS[0];
  for (const candidate of SEAT_BANDS) {
    if (seats >= candidate.min) band = candidate;
  }
  return band;
}

// Built from values every captain already holds (harbor, voyage epoch, and
// fleet size above the anchor), so all of them derive the same commission
// without the server telling them. The epoch makes a restarted voyage draw
// a new one; the seats suffix leaves an anchor table's seed unchanged.
export function objectiveSeed(
  harborId: string,
  voyageEpoch: number,
  seats = 0,
): string {
  const base = `${harborId}:V${voyageEpoch}:objective`;
  return seatBand(seats).factor === 1 ? base : `${base}:S${seats}`;
}

/**
 * The seed picks the entry; the band scales every count. Applied here and
 * nowhere else, so the server and the client cannot scale twice or forget.
 * An anchor entry comes back as authored, which is also the object the
 * smoke suite compares against.
 */
export function drawObjective(seed: string, seats = 0): Objective {
  const objective = pick(createRng(seed), OBJECTIVE_DECK);
  const { factor } = seatBand(seats);
  if (factor === 1) return objective;
  return {
    ...objective,
    resources: objective.resources.map((r) => ({
      ...r,
      required: Math.ceil(r.required * factor),
    })),
  };
}

/** Items across every good. The smoke suites are the readers. */
export function objectiveTotalItems(objective: Objective): number {
  return objective.resources.reduce((sum, r) => sum + r.required, 0);
}

/**
 * What the commission pays at the widest band it can be drawn on. The
 * Ledger Integrity Pass needs the largest payout this mode can produce, so
 * a ceiling read off the authored deck alone would call a full table's
 * payout impossible.
 */
export function widestObjectivePayout(): number {
  let widest = 0;
  for (const band of SEAT_BANDS) {
    for (const objective of OBJECTIVE_DECK) {
      const payout = objective.resources.reduce(
        (sum, r) => sum + Math.ceil(r.required * band.factor) * r.price,
        0,
      );
      widest = Math.max(widest, payout);
    }
  }
  return widest;
}

/**
 * Delivered counts made safe to render and broadcast. Drops goods the
 * commission never asked for, non-whole counts, and anything past what is
 * still owed, so a doctored client cannot move the board past the
 * requirement.
 */
export function clampObjectiveTally(
  objective: Objective,
  tally: Record<string, number> | undefined,
): Record<string, number> {
  const clean: Record<string, number> = {};
  for (const r of objective.resources) {
    const raw = tally?.[r.type];
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue;
    const whole = Math.floor(raw);
    if (whole <= 0) continue;
    clean[r.type] = Math.min(whole, r.required);
  }
  return clean;
}

/**
 * Two readings merged good by good into the higher. Max rather than sum
 * because the broadcast board already includes the hearing captain's
 * handover; a max also cannot be walked backwards by a late frame. This is
 * the one definition both the screen and the engine use.
 */
export function higherObjectiveTally(
  board: Record<string, number>,
  own: Record<string, number>,
): Record<string, number> {
  const merged: Record<string, number> = { ...board };
  for (const [good, count] of Object.entries(own)) {
    merged[good] = Math.max(merged[good] ?? 0, count);
  }
  return merged;
}

/**
 * The fleet's commission round by round. Each client writes the harbor's total
 * rather than its own contribution (see the trace effect in
 * src/lib/use-objective.ts), so this merges by max per good per round. A
 * client that missed a round cannot walk the curve backwards, and rounds come
 * back in round order.
 */
export function fleetTrace(
  traces: readonly (readonly ObjectiveTraceEntry[])[],
): ObjectiveTraceEntry[] {
  const byRound = new Map<number, ObjectiveTraceEntry>();
  for (const trace of traces) {
    for (const entry of trace) {
      const round = Math.floor(entry.round);
      if (!Number.isFinite(round)) continue;
      const standing = byRound.get(round);
      const delivered = standing?.delivered ?? {};
      for (const [good, count] of Object.entries(entry.delivered)) {
        delivered[good] = Math.max(delivered[good] ?? 0, count);
      }
      byRound.set(round, {
        round,
        at: Math.max(standing?.at ?? 0, entry.at),
        delivered,
      });
    }
  }
  return [...byRound.values()].sort((a, b) => a.round - b.round);
}

/**
 * What one captain would hand over right now. The one definition of
 * "still owed": the engine moves the goods and the button says what it
 * will do. `delivered` is the merged board (see higherObjectiveTally), and
 * rows are capped at what the commission still asks for.
 */
export function objectiveTaking(
  objective: Objective,
  holds: Record<string, number>,
  delivered: Record<string, number>,
): { type: string; take: number; price: number }[] {
  const rows: { type: string; take: number; price: number }[] = [];
  for (const r of objective.resources) {
    const already = delivered[r.type] ?? 0;
    const take = Math.min(holds[r.type] ?? 0, r.required - already);
    if (take > 0) rows.push({ type: r.type, take, price: r.price });
  }
  return rows;
}

// One good's line on the commission. Not exported: callers hold
// ObjectiveProgress.
type ObjectiveRow = {
  type: string;
  delivered: number;
  required: number;
  price: number;
  met: boolean;
};

export type ObjectiveProgress = {
  rows: ObjectiveRow[];
  delivered: number;
  required: number;
  met: boolean;
};

/** Delivered against required, per good and in total. Pure. */
export function objectiveProgress(
  objective: Objective,
  tally: Record<string, number>,
): ObjectiveProgress {
  const clean = clampObjectiveTally(objective, tally);
  const rows = objective.resources.map((r) => {
    const delivered = clean[r.type] ?? 0;
    return {
      type: r.type,
      delivered,
      required: r.required,
      price: r.price,
      met: delivered >= r.required,
    };
  });
  const delivered = rows.reduce((sum, row) => sum + row.delivered, 0);
  const required = rows.reduce((sum, row) => sum + row.required, 0);
  return {
    rows,
    delivered,
    required,
    met: required > 0 && delivered >= required,
  };
}
