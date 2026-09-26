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
// evaluation will move, so they live in one place.
// =====================================================================

import { createRng, pick } from "./rng";

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
// largest, which is the order the difficulty rung iteration will filter on.
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

// The seed for the draw. It carries the harbor and the voyage and no
// captain, which is the whole mechanism: every captain in one harbor has to
// arrive at the same commission, and the only way for that to be true
// without the server telling them is for the seed to be built out of values
// they all already hold. The voyage epoch is what makes a restarted voyage
// draw a new commission rather than replaying one the fleet already met.
export function objectiveSeed(harborId: string, voyageEpoch: number): string {
  return `${harborId}:V${voyageEpoch}:objective`;
}

/**
 * Which commission this harbor owes, from a seed the caller owns.
 *
 * The draw chooses the objective and nothing else. Every number inside an
 * entry is fixed data, exactly as the mandate templates are, so the
 * question "what does this ask for" never depends on the rng.
 *
 * A difficulty rung, when the epic gets to one, filters OBJECTIVE_DECK here
 * and nowhere else: no caller passes difficulty in, so no caller has to
 * know that a rung exists.
 */
export function drawObjective(seed: string): Objective {
  return pick(createRng(seed), OBJECTIVE_DECK);
}

// How many items the commission is for, across every good.
export function objectiveTotalItems(objective: Objective): number {
  return objective.resources.reduce((sum, r) => sum + r.required, 0);
}

// What the whole commission pays out if the fleet fills it. Read by the
// Ledger Integrity Pass, which has to know the largest amount of gold this
// mode can conjure out of a hold in a round.
export function widestObjectivePayout(): number {
  return OBJECTIVE_DECK.reduce(
    (widest, o) =>
      Math.max(
        widest,
        o.resources.reduce((sum, r) => sum + r.required * r.price, 0),
      ),
    0,
  );
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
