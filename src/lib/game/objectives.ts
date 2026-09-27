// =====================================================================
// PortMasters 2.2 Parallel Release: the Ocean Gambit objective deck.
//
// One public commission per voyage, drawn before it starts, owed by the
// whole fleet. It is the Imperial Mandate wearing a new hat (see
// MANDATE_TEMPLATES in ./difficulty.ts for the mechanism it copies): the
// same port and goods and gold shape, except that a mandate is owed by one
// captain in one round and this is owed by everybody across the voyage.
//
// It is a data module, like ./mode.ts and ./gambit.ts, and for the same
// reason: the server draws the objective to clamp what clients report, the
// engine pays delivery against it, and the interface renders it, and none
// of those three should own the vocabulary the other two have to agree
// with. Nothing here reads a clock, a socket or a database.
//
// The writing rule for this deck is the one rule that matters, and it is
// the plan's: an objective a single captain can satisfy alone produces no
// conversation and gives a saboteur nothing to sabotage, so an objective
// that six captains could finish without talking is rejected outright.
// That is enforced as a property of the data rather than as a note here:
// every entry below asks for at least as many items as a captain begins
// the voyage holding (STARTING_STOCK in ./constants.ts comes to 16), and
// every entry asks for at least two different goods. A hold cannot cover
// one, so the fleet has to buy, trade, or both, and it has to do it over
// more than one round.
//
// Prices are the Emperor's, paid per item, and they run a little above the
// going rate on purpose. A commission is a commission; the cost to a
// captain is the goods and the orders they are not filling, not a discount
// on the goods themselves. These numbers are the balance knob the epic's
// evaluation will move, so they live in one place. The other knob, the
// quota rung that scales a commission with the size of the fleet that owes
// it, lives in this module too and is written out below the deck.
// =====================================================================

import { createRng, pick } from "./rng";
import type { ObjectiveTraceEntry } from "./types";

export type Objective = {
  id: string;
  name: string;
  // One sentence, shown to every captain from the first phase. Says what
  // the fleet is being asked for and why it takes a fleet.
  line: string;
  // What the commission asks for, and what the Emperor pays per item. There
  // is no port here and there cannot be: the engine has no captain location
  // to check against, so a destination would be a promise nothing keeps.
  resources: readonly { type: string; required: number; price: number }[];
};

// Six commissions, every good drawn from the founding tier so an objective
// is fillable in the first round of every difficulty. Ordered smallest to
// largest, which is the order a reader wants them in. The rung below does
// not filter on that order: it scales every entry's quotas, because the
// authoring rule above is a property of the entry rather than of its size,
// and an entry deleted for being small would take a commission out of the
// deck rather than make the deck harder.
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

// ========== The quota rung ==========
// The deck's quotas are authored for a founding table, and a voyage with a
// fifth and a sixth captain on it moves half again as much cargo. Left
// alone, one commission gets easier with every extra seat, which is not a
// difficulty setting anybody chose: it is the sabotage window widening as
// the table shrinks, and the Pirate is the captain who pays for it. So the
// quotas scale with the fleet the voyage was dealt to, and only the quotas:
// every price stays put, so a wider commission pays the fleet more for the
// extra cargo rather than paying less per item for it.
//
// Quota per head held constant is what makes the rung flat rather than
// merely harder. Four captains are the deck's authoring table, so four or
// fewer is the anchor and multiplies by nothing, which is what keeps a
// voyage that began before the rung existed on exactly the board it drew.
// Five captains carry a quarter more than four, six carry half again, and
// the rounding is up rather than nearest because the error it can introduce
// (at most one item per good) should fall on the side the Pirate's band
// lives on. A table larger than six sails on the top band: the deal itself
// is authored for six (see ./gambit.ts), and a seventh seat is a size this
// rung has no measurement for.
export type SeatBand = {
  // The fewest captains in this band. 0 is the anchor's own floor, and the
  // reading for a voyage that was never pinned.
  min: number;
  // What every quota in the drawn commission is multiplied by.
  factor: number;
  // What the band is called wherever a human reads it. Authored rather
  // than derived from the floor above, because "4 or fewer" is the sentence
  // a report wants and "0 to 4" is a range.
  label: string;
};

// The bands, smallest first, which is also the order a report reads them
// in. Exported because the two readers outside this module (the win rate
// reader in ../balance and the smoke suite) have to walk the same bands
// this table holds rather than list them again.
export const SEAT_BANDS: readonly SeatBand[] = [
  { min: 0, factor: 1, label: "4 or fewer" },
  { min: 5, factor: 1.25, label: "5" },
  { min: 6, factor: 1.5, label: "6 or more" },
];

// Which band a fleet of this size sails on. A pinned count and 0 both land
// here, which is the backward compatibility: 0 is the anchor, so a room
// that started before the rung existed draws the founding deck.
export function seatBand(seats: number): SeatBand {
  let band = SEAT_BANDS[0];
  for (const candidate of SEAT_BANDS) {
    if (seats >= candidate.min) band = candidate;
  }
  return band;
}

// The seed for the draw. It carries the harbor and the voyage and no
// captain, which is the whole mechanism: every captain in one harbor has to
// arrive at the same commission, and the only way for that to be true
// without the server telling them is for the seed to be built out of values
// they all already hold. The voyage epoch is what makes a restarted voyage
// draw a new commission rather than replaying one the fleet already met.
//
// The fleet's size is folded in on the same reasoning and adds one case of
// its own: the count is a public fact of the room (see Room.voyageSeats),
// so every captain still works the commission out rather than being told
// it, and a harbor restarted at a different size draws a different
// commission for the same reason a restarted epoch does. It is appended
// only above the anchor band, so a founding table's seed is the string it
// always was and its board is the board it always drew.
export function objectiveSeed(
  harborId: string,
  voyageEpoch: number,
  seats = 0,
): string {
  const base = `${harborId}:V${voyageEpoch}:objective`;
  return seatBand(seats).factor === 1 ? base : `${base}:S${seats}`;
}

/**
 * Which commission this harbor owes, from a seed the caller owns.
 *
 * The draw chooses the objective and nothing else. What the fleet's size
 * decides is the rung: the entry the seed names, with every count in it
 * multiplied by the band's factor. That is applied here and nowhere else,
 * so a caller does not have to know the rung exists beyond passing the size
 * it already holds, and the two callers that matter (the server clamping
 * what a captain reports, the client showing the board) cannot scale it
 * twice or forget to scale it at all.
 *
 * An entry at the anchor comes back as it is authored rather than as a copy
 * of it, which is both the board every voyage before the rung drew and the
 * object the smoke suite compares against.
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

// How many items the commission is for, across every good.
export function objectiveTotalItems(objective: Objective): number {
  return objective.resources.reduce((sum, r) => sum + r.required, 0);
}

// What the whole commission pays out if the fleet fills it, at the widest
// band it can be drawn on. Read by the Ledger Integrity Pass, which has to
// know the largest amount of Gold this mode can conjure out of a hold in a
// round, so it is read across every band rather than off the deck as
// authored: a six captain commission pays half again what the founding one
// does, and a ceiling that read the deck alone would call that payout
// impossible the first time a full table filled one.
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
 * What the fleet has handed over, made safe to render and to broadcast.
 *
 * Three things are thrown away here rather than trusted: goods the
 * commission never asked for, counts that are not whole numbers, and counts
 * past what is still owed. The last one is what stops a doctored client
 * moving the public board past the requirement, and it is also what makes
 * the server and the clients demonstrably agree on what the deck says.
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
 * The fleet's commission leg by leg, merged out of every captain's own
 * record of it.
 *
 * What each client writes down is the harbor's total rather than its own
 * contribution (see the trace effect in src/lib/use-objective.ts), so this
 * is one number seen by several captains and not a sum of parts. That is
 * why it merges by max per good per leg, the rule the live board already
 * merges by: a captain whose client missed a leg, reloaded, or joined the
 * voyage late cannot walk the curve backwards, and a leg that two clients
 * both recorded is recorded once. Legs come back in order, because the
 * whole point of the trace is that it reads as a story.
 *
 * [H8: the reveal and the replay ledger] Written here rather than in the
 * one module that calls it, because this is the same arithmetic
 * objectiveProgress and clampObjectiveTally are written with, and a second
 * reading of what the fleet handed over is how the ledger would come to
 * disagree with the board it is drawn beside.
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
 * What one captain would hand over if they delivered right now: the goods
 * and counts the commission would take from them, and what it would pay.
 *
 * This is the single definition of "how much of this is still owed by this
 * captain", and both callers need it. The engine moves the goods, and the
 * interface has to say what its button will do before it is pressed, and a
 * second copy of this arithmetic in the button is exactly how the promise
 * and the payment drift apart.
 *
 * The cap is the captain's own remaining and never the harbor's: what the
 * rest of the fleet has handed over is not knowable here. That does mean
 * two captains can each hand over the whole commission and overshoot it,
 * since neither can see the other's delivery, which is why the board the
 * fleet reads is clamped at its source rather than summed and trusted
 * (see objectiveTotalFor in src/server/realtime/objective.ts). An
 * over-delivery reads as met, and the extra goods are gone either way.
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

// One good's line on the commission. Not exported: it reaches the surfaces
// inside ObjectiveProgress, which is what callers hold.
type ObjectiveRow = {
  type: string;
  delivered: number;
  required: number;
  // What the Emperor pays for this good, carried alongside so a surface
  // showing what is still owed does not have to go back to the deck for it.
  price: number;
  met: boolean;
};

export type ObjectiveProgress = {
  rows: ObjectiveRow[];
  delivered: number;
  required: number;
  // 0 to 1, for a progress bar. 0 for a commission asking for nothing,
  // which no authored entry does and which must not divide by zero if one
  // ever does.
  fraction: number;
  met: boolean;
};

// Delivered against required, per good and in total. Pure: the same tally
// always reads the same, so the panel and the tests agree by construction.
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
    fraction: required === 0 ? 0 : delivered / required,
    met: required > 0 && delivered >= required,
  };
}
