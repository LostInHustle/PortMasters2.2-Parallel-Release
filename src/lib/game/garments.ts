// Garments and the cold. A garment is a finished good with a warmth rating
// and a durability, the weather is a tag on a round, and the check between
// them decides who freezes. The garments are existing goods: Linen Clothes,
// Cotton Clothes and Brocade (see GARMENTS in ./constants).
//
// A worn garment is one way: wearing is the decision, so it never comes off.
// Warmth is the rating times the fraction left, summed rather than drawn as
// a bar. A garment worn to zero leaves the wardrobe and pays RAG_SCRAP_VALUE
// as scrap. Weather is drawn from voyage wide fields rather than stored, so
// every captain in a harbor sees the same cold rounds and a reload replays
// them.
//
// Pure: no clock, no socket, no database.
import { workerType } from "./constants/crew";
import {
  COLD_ROUND_CHANCE,
  COLD_ROUND_WARMTH,
  GARMENTS,
  GARMENT_DECAY_COLD_ROUND,
  GARMENT_DECAY_PER_ROUND,
  RAG_SCRAP_VALUE,
  type GarmentSpec,
} from "./constants/garments";
import { newestAboard } from "./crew";
import { flagOnFor, survivalLayerOn } from "./flags";
// Lines are built when pushed, so a language flip applies to the next one.
import { line, type LedgerLine } from "./ledger";
import { frozenFrostbiteLogLine } from "./status-copy";
import { createRng } from "./rng";
import {
  crewSize,
  flatWorkerRoster,
  wholeStamp,
  type GameState,
  type Worker,
  type WornGarment,
} from "./types";

// The most garments a save may claim the crew is wearing. A bound on input
// rather than on play: the hold decides how much a captain can own, and this
// keeps a hand written save from filling a panel with Brocade.
const GARMENTS_WORN_MAX = 12;

/**
 * Whether the garments layer is running. One switch, read through the policy
 * function the whole family uses; the survival layer governs it, so a build
 * with provisions off has no cold either. With it off, nothing is read,
 * nothing decays and nobody freezes, and a save keeps its clothes unread.
 */
export function garmentsLayerOn(mode: unknown): boolean {
  return (
    flagOnFor(mode, process.env.NEXT_PUBLIC_GARMENTS) && survivalLayerOn(mode)
  );
}

/**
 * The catalogue entry for a good, or null when it is not a garment. The own
 * property check keeps strings like "toString" from reaching the prototype,
 * and only entries with the two numbers the arithmetic needs are answered.
 */
export function garmentSpec(good: unknown): GarmentSpec | null {
  if (typeof good !== "string") return null;
  if (!Object.prototype.hasOwnProperty.call(GARMENTS, good)) return null;
  const spec = GARMENTS[good];
  if (!spec) return null;
  return typeof spec.warmth === "number" && typeof spec.durability === "number"
    ? spec
    : null;
}

/**
 * Whether this round is cold. Drawn from fields shared by every captain in the
 * harbor (epoch, mode, difficulty, round), so all tables sail the same
 * weather without the server announcing it, and a restart rerolls it. The
 * same save answers the same way on every read, and no clock is involved.
 */
export function legIsCold(
  state: Pick<
    GameState,
    "voyageEpoch" | "mode" | "difficulty" | "currentRound"
  >,
): boolean {
  const seed = `${state.voyageEpoch}:${state.mode}:${state.difficulty}:cold:${state.currentRound}`;
  return createRng(seed)() < COLD_ROUND_CHANCE;
}

// The wardrobe's own denominator, chosen so every contribution is whole.
// Summing fractions as doubles can land a crew exactly at the cold round's ask
// a hair under it, so contributions are taken in whole scale units and the
// total is divided once. The scale is derived from the table, so a retune
// moves it rather than leaving a constant quietly inexact.
function greatestCommonDivisor(a: number, b: number): number {
  return b === 0 ? a : greatestCommonDivisor(b, a % b);
}
const GARMENT_SCALE = Object.values(GARMENTS).reduce(
  (scale, spec) =>
    (spec.durability * scale) / greatestCommonDivisor(spec.durability, scale),
  1,
);

/**
 * The warmth a garment gives right now, as whole units of the scale: its
 * rating times the fraction left. Durability is healed here rather than
 * trusted, so a save cannot hand the sum a NaN or an out of range value.
 */
function warmthUnits(garment: WornGarment, spec: GarmentSpec): number {
  const left = durabilityOf(garment.durability, spec);
  return spec.warmth * left * (GARMENT_SCALE / spec.durability);
}

/**
 * Whether the crew's clothes are short of what this round asks. One answer for
 * the settlement tick and the voyage screen badge, so the warning and the
 * check cannot disagree. Layer, weather and score, cheapest first.
 */
export function shortOfWarmth(state: GameState): boolean {
  return (
    garmentsLayerOn(state.mode) &&
    legIsCold(state) &&
    warmthScore(state) < COLD_ROUND_WARMTH
  );
}

/**
 * The warmth score: the sum across worn garments of rating times fraction
 * left, plus the Cold Hardened boon, which counts as one more warmth for the
 * rest of the voyage. Folded into the sum so the warning, the settlement and
 * the panel all read one number, and exported because those readers print it
 * as well as compare it. Taken in whole scale units and divided once,
 * because this number decides whether a hand freezes.
 */
export function warmthScore(
  state: Pick<GameState, "garments" | "modifierFlags">,
): number {
  let units = 0;
  for (const garment of state.garments ?? []) {
    const spec = garmentSpec(garment?.good);
    if (!spec) continue;
    units += warmthUnits(garment, spec);
  }
  units += (state.modifierFlags.cold_hardened ?? 0) * GARMENT_SCALE;
  return units / GARMENT_SCALE;
}

/**
 * One garment's contribution, which the wardrobe panel prints beside it.
 * Exported so the panel does not repeat the multiplication and drift from
 * the sum, and read through the same scale units the sum uses.
 */
export function garmentWarmth(garment: WornGarment | undefined | null): number {
  const spec = garmentSpec(garment?.good);
  if (!spec || !garment) return 0;
  return warmthUnits(garment, spec) / GARMENT_SCALE;
}

// A billionth of a point of warmth, enough to absorb the double's rounding
// of an exactly representable score without reaching the next tenth.
const WARMTH_PRINT_TOLERANCE = 1e-9;

/**
 * The score as a captain reads it: one decimal, read down rather than to
 * nearest. A crew a hair under the ask would otherwise print "2" beside a
 * panel saying the ask was unmet while the sea took a hand. Reading down
 * also keeps a panel's rows from summing above its total.
 */
export function warmthText(score: number): string {
  const tenth = Math.floor(score * 10 + WARMTH_PRINT_TOLERANCE) / 10;
  return Number.isInteger(tenth) ? `${tenth}` : tenth.toFixed(1);
}

/**
 * Whether a hand is out of action this round. The mark is compared to the
 * round, so an older mark is inert rather than wrong.
 */
export function isFrostbitten(
  worker: Pick<Worker, "frostbittenRound">,
  round: number,
): boolean {
  return worker.frostbittenRound === round;
}

/**
 * Putting a garment on: one good leaves the hold and joins the wardrobe.
 * Every refusal is spoken, because a captain who presses a button is owed a
 * sentence. Clothes put on for a round that did not ask for them would wear
 * for nothing, so a mild or already answered round is refused.
 */
export function wearGarment(
  state: GameState,
  good: unknown,
  logs: LedgerLine[],
): boolean {
  if (!garmentsLayerOn(state.mode)) return false;
  const spec = garmentSpec(good);
  if (!spec || typeof good !== "string") {
    logs.push(line("❌ That is not something the crew can wear."));
    return false;
  }
  if (crewSize(state) === 0) {
    logs.push(line("❌ There is nobody aboard to wear it."));
    return false;
  }
  if ((state.garments?.length ?? 0) >= GARMENTS_WORN_MAX) {
    logs.push(line("❌ The crew can wear no more than they already have on."));
    return false;
  }
  if ((state.inventory[good] || 0) < 1) {
    logs.push(line("❌ No {good} in the hold to wear.", { good: line(good) }));
    return false;
  }
  if (!shortOfWarmth(state)) {
    logs.push(
      legIsCold(state)
        ? line(
            "❌ The crew already meets this cold round. Clothes put on for nothing still wear, so the rest stay in the hold until a round asks for them.",
          )
        : line(
            "❌ The sea is mild this round and asks for no warmth. Clothes put on now would wear from today, so the hold keeps them for a cold round.",
          ),
    );
    return false;
  }
  state.inventory[good] -= 1;
  state.garments.push({ good, durability: spec.durability });
  // The multiplier is said at the moment of the decision, because it is the
  // thing that makes the decision: what went onto the crew's backs is worth
  // its rating today and a fraction of it later.
  logs.push(
    line(
      "🧥 The crew puts on the {good}. Warmth {spec.warmth} while it lasts.",
      {
        good: line(good),
        "spec.warmth": spec.warmth,
      },
    ),
  );
  return true;
}

/**
 * How much of the most worn garment of a good is missing. The most worn one
 * is the one a captain means, and zero means nothing to repair. Exported
 * because the repair panels quote the number the button turns on.
 */
export function garmentRoom(
  state: Pick<GameState, "garments">,
  good: unknown,
): number {
  const spec = garmentSpec(good);
  if (!spec || typeof good !== "string") return 0;
  let most = 0;
  for (const garment of state.garments ?? []) {
    if (garment?.good !== good) continue;
    const missing = spec.durability - durabilityOf(garment.durability, spec);
    if (missing > most) most = missing;
  }
  return most;
}

/**
 * Putting points back into a worn garment, and the one writer of a
 * durability that goes up. The port mend and the Loom's refit are the same
 * arithmetic at two prices. Returns how much actually came back, so callers
 * charge only for work done, and writes a new row rather than mutating one.
 */
export function restoreGarment(
  state: GameState,
  good: unknown,
  points: number,
  logs: LedgerLine[],
): number {
  if (!garmentsLayerOn(state.mode)) return 0;
  const spec = garmentSpec(good);
  if (!spec || typeof good !== "string") return 0;
  const worn = state.garments ?? [];
  let target = -1;
  for (let i = 0; i < worn.length; i++) {
    if (worn[i]?.good !== good) continue;
    if (
      target === -1 ||
      durabilityOf(worn[i].durability, spec) <
        durabilityOf(worn[target].durability, spec)
    ) {
      target = i;
    }
  }
  if (target === -1) return 0;
  const before = durabilityOf(worn[target].durability, spec);
  const wanted = Math.max(0, Math.floor(points));
  const after = Math.min(spec.durability, before + wanted);
  if (after <= before) return 0;
  state.garments = worn.map((garment, i) =>
    i === target ? { ...garment, durability: after } : garment,
  );
  logs.push(
    line(
      "🧵 The {good} comes back to {after} of {spec.durability}, worth {warmthGrade} of warmth.",
      {
        good: line(good),
        after,
        "spec.durability": spec.durability,
        warmthGrade: warmthText(garmentWarmth({ good, durability: after })),
      },
    ),
  );
  return after - before;
}

/**
 * The settlement tick: the tag, the check, the frostbite and the wear. Called
 * once from finishSettlement, stamped by the round so a second call is a no
 * op. The check reads the clothes worn through the round, so wear comes after
 * it, and the frostbite mark is written for the next round.
 */
export function tickGarments(state: GameState, logs: LedgerLine[]): void {
  if (!garmentsLayerOn(state.mode)) return;
  if (state.garmentsTickRound === state.currentRound) return;
  state.garmentsTickRound = state.currentRound;

  for (const hand of flatWorkerRoster(state)) {
    const mark = hand.frostbittenRound;
    if (typeof mark === "number" && mark < state.currentRound) {
      delete hand.frostbittenRound;
    }
  }

  const worn = state.garments ?? [];
  const cold = legIsCold(state);
  // Nothing worn on a fair round: no clothes to wear out and no check to fail.
  if (worn.length === 0 && !cold) return;

  const score = warmthScore(state);
  logs.push(
    line("\n🧥=== Round {state.currentRound} · The Cold and the Cloth ===", {
      "state.currentRound": state.currentRound,
    }),
  );
  if (cold) {
    logs.push(
      score >= COLD_ROUND_WARMTH
        ? line(
            "❄️ A cold round, and the crew's {warmthGrade} of warmth is enough for the {COLD_ROUND_WARMTH} it asks.",
            { warmthGrade: warmthText(score), COLD_ROUND_WARMTH },
          )
        : line(
            "❄️ A cold round, and the crew's {warmthGrade} of warmth falls short of the {COLD_ROUND_WARMTH} it asks.",
            { warmthGrade: warmthText(score), COLD_ROUND_WARMTH },
          ),
    );
    if (score < COLD_ROUND_WARMTH) frostbiteNewest(state, logs);
  }

  const step = cold ? GARMENT_DECAY_COLD_ROUND : GARMENT_DECAY_PER_ROUND;
  const kept: WornGarment[] = [];
  let rags = 0;
  for (const garment of worn) {
    const spec = garmentSpec(garment?.good);
    if (!spec) continue;
    const remaining = durabilityOf(garment.durability, spec) - step;
    if (remaining <= 0) {
      rags++;
      state.money += RAG_SCRAP_VALUE;
      logs.push(
        line(
          "🌊 The {garment.good} wears through to rags and is scrapped for {RAG_SCRAP_VALUE} Gold.",
          { "garment.good": line(garment.good), RAG_SCRAP_VALUE },
        ),
      );
      continue;
    }
    kept.push({ good: garment.good, durability: remaining });
  }
  state.garments = kept;
  if (worn.length > 0 && rags === 0) {
    // The step is durability points, not warmth. Warmth is the rating scaled
    // by what is left, so two points off a coat costs a fraction of its
    // warmth; the line used to say warmth and did not reconcile.
    logs.push(
      line("🧵 Worn clothes lose {step} point of wear to the sea.", { step }),
    );
  }
}

/**
 * One hand pays for a round spent short of warmth, and it is the newest
 * aboard, the same rule crew loss takes. The mark costs one round of work and
 * nothing else; the sentence comes from ./status-copy so the log and the
 * bench phrase it alike.
 */
function frostbiteNewest(state: GameState, logs: LedgerLine[]): void {
  const newest = newestAboard(state);
  if (newest === null) {
    logs.push(line("🥶 There is nobody aboard to take the cold."));
    return;
  }
  const hand = state.workers[newest.type]?.[newest.index];
  if (!hand) return;
  hand.frostbittenRound = state.currentRound + 1;
  const label = workerType(newest.type)?.label ?? newest.type;
  logs.push(frozenFrostbiteLogLine(hand.name, label));
}

/**
 * How much of a garment is left, clamped to its own ends. A non-number heals
 * to full rather than to nothing, so damage does not ruin a garment the
 * captain never wore out. Fractions floor, because wear is whole points.
 */
function durabilityOf(raw: unknown, spec: GarmentSpec): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return spec.durability;
  return Math.min(spec.durability, Math.max(0, Math.floor(raw)));
}

/**
 * The wardrobe a save was carrying. An old save with no wardrobe lands on an
 * empty one. An entry is kept only when the catalogue knows it and its
 * durability is above zero; the cap is the only branch play cannot reach.
 */
export function normalizeGarments(raw: unknown): WornGarment[] {
  if (!Array.isArray(raw)) return [];
  const out: WornGarment[] = [];
  for (const entry of raw) {
    if (out.length >= GARMENTS_WORN_MAX) break;
    if (!entry || typeof entry !== "object") continue;
    const { good, durability } = entry as {
      good?: unknown;
      durability?: unknown;
    };
    const spec = garmentSpec(good);
    if (!spec || typeof good !== "string") continue;
    const left = durabilityOf(durability, spec);
    if (left <= 0) continue;
    out.push({ good, durability: left });
  }
  return out;
}

/**
 * The tick's stamp. An old save lands on zero, a round no voyage has, so the
 * first settlement after loading reads the wardrobe.
 */
export function normalizeGarmentsTickRound(raw: unknown): number {
  return wholeStamp(raw);
}
