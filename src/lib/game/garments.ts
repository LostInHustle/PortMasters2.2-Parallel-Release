// =====================================================================
// PortMasters 2.2 Parallel Release: garments and the cold.
//
// [C3: garments and the cold] One data model for three jobs, which is what
// the plan asks for and what this module is: a garment is a finished good
// with a warmth rating and a durability, the weather is a tag on a leg, and
// the check between them decides who freezes.
//
// The garments are the tree's own clothes rather than three new goods.
// Linen Clothes is the hemp garment, Cotton Clothes the cloth one and
// Brocade the fine silk, which is the mapping the plan's ratings one, two
// and three are written onto (see GARMENTS in ./constants for the table and
// for why the Sachet is not in it). That choice is what makes the plan's
// own evaluation readable in this tree rather than in a new one: the fine
// silks a captain either wears or sells are Brocade, a good that already
// has a recipe, a price and a customer.
//
// Three things about the shape are decisions rather than readings.
//
// A worn garment is one way. Wearing is the decision, and a garment taken
// off and put back on would be a durability bar with extra steps: it would
// be the one way a captain could reset a fraction, and the plan says the
// player never manages a bar. So a garment that goes on stays on until the
// sea has had it, and the panel says so before the button is pressed.
//
// Warmth is a sum, not a bar. What a garment gives is its rating times the
// fraction of itself that is left, and that is the number the check reads
// and the number the panel prints. Nothing anywhere draws a durability
// meter, because the plan's sentence is that a multiplier is a decision.
//
// A garment at zero leaves the wardrobe and pays the plan's four Gold as
// scrap, which is the one way this tree can give a finished good a cash value
// outside an order or a barter (see RAG_SCRAP_VALUE in ./constants). The
// scrap itself used to be a bare number on the state and is now a good like
// any other, named in the catalogue the day the Loom's bench arrived to buy
// it off the quay and reweave it (see RAGS there), which is the one thing on
// this page D4 changed. What a rag is worth and what it turns back into are
// not read here: they belong to the bench's own arithmetic.
//
// The weather is drawn rather than stored. Every input the tag needs is
// already room wide on the state, so one function answers for the whole
// harbor, replays on reload, and needs no field, no stamp and no context to
// thread: see legIsCold below.
//
// The load site heals the wardrobe the way every other saved field is
// healed (see normalizeGarments), and the settlement tick is one line in
// ./engine/lifecycle beside the wage bill it lands with.
//
// Pure: no clock, no socket, no database. The one environment read is
// deliberate and it is documented where it happens.
// =====================================================================
import { workerType } from "./constants/crew";
import {
  COLD_LEG_CHANCE,
  COLD_LEG_WARMTH,
  GARMENTS,
  GARMENT_DECAY_COLD_LEG,
  GARMENT_DECAY_PER_LEG,
  RAG_SCRAP_VALUE,
  type GarmentSpec,
} from "./constants/garments";
import { newestAboard } from "./crew";
import { crewSize } from "./larder";
import { flagOnFor, survivalLayerOn } from "./flags";
import { createRng } from "./rng";
import {
  flatWorkerRoster,
  type GameState,
  type Worker,
  type WornGarment,
} from "./types";

// The most garments a save may claim the crew is wearing. A bound on input
// rather than on play, the same kind of number as ./crew's name and loss
// ceilings: how much a captain can own is the hold's business rather than
// this module's, and the hold's own size is a rule ./hold reads under its own
// switch, so this exists so a save written by hand cannot put a paragraph of
// Brocade in a panel or a log line.
const GARMENTS_WORN_MAX = 12;

/**
 * Whether the garments layer is running.
 *
 * The plan's rollback for this feature is one flag, and this is it, read
 * through the same policy function every other switch in the family uses
 * (see flagOnFor in ./flags, which carries the note about how a read has to
 * be written for a browser bundle to see it). It is a rule of the survival
 * family rather than a layer of its own, so the layer governs it from
 * above: a build with the provisions off has no cold either, whatever this
 * says.
 *
 * With the switch off nothing is read of the wardrobe, nothing decays and
 * nobody freezes, and a save carrying one reads back as the same voyage with
 * its clothes still on it, unread rather than rewritten.
 *
 * It takes the mode as its first reading (see flagOnFor), so the layered
 * shape above becomes a three part answer: the mode, then this layer's own
 * switch, then the provisions layer it stands on. A Classic table stops at
 * the first of them, which is what keeps the whole family off the shipped
 * voyage without a second list of what is and is not in Classic.
 */
export function garmentsLayerOn(mode: unknown): boolean {
  return (
    flagOnFor(mode, process.env.NEXT_PUBLIC_GARMENTS) && survivalLayerOn(mode)
  );
}

/**
 * The catalogue entry for a good, or null when it is not a garment.
 *
 * Own property rather than a plain lookup, because a save names its goods
 * with strings and a string like "toString" would otherwise come back with
 * a function from the object's prototype and be read as a garment. The
 * field check after it is the same thought one step further out: what this
 * returns is arithmetic, so it answers only for entries that carry the two
 * numbers the arithmetic needs.
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
 * The leg's weather tag: whether this leg is a cold one.
 *
 * Drawn rather than stored, and drawn from the voyage's own numbers rather
 * than from a captain's. The epoch, the mode, the difficulty and the round
 * are the same on every captain's state in a harbor (see the field notes in
 * ./types), so every captain sails the same weather without the server
 * announcing anything, and a restart, which bumps the epoch, rerolls it into
 * a new voyage's weather exactly as it rerolls the market.
 *
 * Two properties the plan asks for by name. It is deterministic: the same
 * save answers the same way on every read, so a reload replays the leg it
 * was in the middle of rather than rerolling the sea. And it reads no
 * clock: the input is the round number, never the wall clock, which is what
 * lets the settlement tick live inside the resolve step without being a
 * different rule on a slow table than on a fast one.
 */
export function legIsCold(
  state: Pick<
    GameState,
    "voyageEpoch" | "mode" | "difficulty" | "currentRound"
  >,
): boolean {
  const seed = `${state.voyageEpoch}:${state.mode}:${state.difficulty}:cold:${state.currentRound}`;
  return createRng(seed)() < COLD_LEG_CHANCE;
}

/**
 * The warmth a garment gives right now: its rating times the fraction of
 * itself that is left, which is the plan's multiplier.
 *
 * A damaged durability is read through the same healing the load site uses
 * rather than trusted as arithmetic, so a save cannot hand this sum a NaN or
 * a fraction outside the garment's own maximum. In play it is always a whole
 * number inside the maximum, because every write to it is this module's.
 */
function warmthOf(garment: WornGarment, spec: GarmentSpec): number {
  const left = durabilityOf(garment.durability, spec);
  return spec.warmth * (left / spec.durability);
}

/**
 * Whether the crew's clothes are short of what this leg asks.
 *
 * One answer for the two readers that need it, the settlement tick below and
 * the badge the voyage screen wears, so the warning a captain sees and the
 * check that bites them cannot disagree. Layer, weather and score, in that
 * order, because each is cheaper than the next and the first can answer for
 * the whole build.
 */
export function shortOfWarmth(state: GameState): boolean {
  return (
    garmentsLayerOn(state.mode) &&
    legIsCold(state) &&
    warmthScore(state) < COLD_LEG_WARMTH
  );
}

/**
 * The warmth score: the sum across worn garments of the rating times the
 * fraction left, plus the boon that hardens the crew against the cold.
 * The one number the plan's check reads.
 *
 * [F4: boons at milestone moments] Cold Hardened, the boon a cold leg
 * deals, counts as one more of warmth for the rest of the voyage, and it
 * is folded into the sum rather than into the check so that the number
 * the warning is about, the number the settlement prints and the number
 * the panel wears all stay the one number this function exists to be.
 * The field it reads is the round's flag set, which is where a held
 * boon's effect rides (see heldFlagsOf in ./held-cards).
 *
 * Exported because two readers print it as well as compare it, and a panel
 * that did the arithmetic again would be a second opinion about the number
 * the crew freezes against.
 */
export function warmthScore(
  state: Pick<GameState, "garments" | "modifierFlags">,
): number {
  let total = 0;
  for (const garment of state.garments ?? []) {
    total += garmentWarmth(garment);
  }
  return total + (state.modifierFlags.cold_hardened ?? 0);
}

/**
 * One garment's own contribution, which is what the wardrobe panel prints
 * beside it and what the sum above is made of.
 *
 * Exported rather than kept private to the sum for the reason a sum and its
 * parts are exported together anywhere else in this tree: a panel that did
 * the multiplication again would be a second place the plan's multiplier is
 * written, and the two would agree right up until one of them moved. Takes
 * the garment rather than the state so a reader can ask about one of them.
 */
export function garmentWarmth(garment: WornGarment | undefined | null): number {
  const spec = garmentSpec(garment?.good);
  if (!spec || !garment) return 0;
  return warmthOf(garment, spec);
}

/**
 * The score as a captain reads it: one decimal, and a whole number left
 * whole. Used by the log line and the panel both, so the number the warning
 * was about and the number the settlement reports are the same string.
 */
export function warmthText(score: number): string {
  const rounded = Math.round(score * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

/**
 * Whether a hand is out of action this leg.
 *
 * The mark is compared to the round rather than cleared on a schedule, so a
 * mark whose leg has passed is inert rather than wrong: a frostbite a leg
 * ago simply is not this leg's. The tick below clears the spent ones as it
 * walks, so the roster carries only a live sentence.
 */
export function isFrostbitten(
  worker: Pick<Worker, "frostbittenRound">,
  round: number,
): boolean {
  return worker.frostbittenRound === round;
}

/**
 * Putting a garment on: one good leaves the hold and joins the wardrobe.
 *
 * One way, and the refusals are written out rather than silent, for the
 * reason the bench's other refusals are: a captain who presses a button is
 * owed a sentence about what happened. Every branch is reachable by a
 * legitimate voyage. There is nobody aboard on a ship whose crew has not
 * been hired yet or whose last hand has been lost. There is nothing to wear
 * when the hold carries none of that good, which is the ordinary case of a
 * captain who sold the lot. And the ceiling above is the one branch play
 * cannot reach, which is why its sentence reads as the bound it is.
 *
 * The last refusal is the rule of the panel rather than of the hold, and it
 * was added after the field reported warehouses being walked onto backs: a
 * garment worn is one way and wears from the day it goes on, so clothes put
 * on for a leg that did not ask for them cost their whole life and bought
 * nothing. A crew the leg is not asking anything of is left alone, and the
 * sentence that turns the press away says which of the two nothings this
 * is: a mild leg, or a crew the cold has already been answered for.
 */
export function wearGarment(
  state: GameState,
  good: unknown,
  logs: string[],
): boolean {
  if (!garmentsLayerOn(state.mode)) return false;
  const spec = garmentSpec(good);
  if (!spec || typeof good !== "string") {
    logs.push("❌ That is not something the crew can wear.");
    return false;
  }
  if (crewSize(state) === 0) {
    logs.push("❌ There is nobody aboard to wear it.");
    return false;
  }
  if ((state.garments?.length ?? 0) >= GARMENTS_WORN_MAX) {
    logs.push("❌ The crew can wear no more than they already have on.");
    return false;
  }
  if ((state.inventory[good] || 0) < 1) {
    logs.push(`❌ No ${good} in the hold to wear.`);
    return false;
  }
  if (!shortOfWarmth(state)) {
    logs.push(
      legIsCold(state)
        ? "❌ The crew already meets this cold leg. Clothes put on for nothing still wear, so the rest stay in the hold until a leg asks for them."
        : "❌ The sea is mild this leg and asks for no warmth. Clothes put on now would wear from today, so the hold keeps them for a cold leg.",
    );
    return false;
  }
  state.inventory[good] -= 1;
  state.garments.push({ good, durability: spec.durability });
  // The multiplier is said at the moment of the decision, because it is the
  // thing that makes the decision: what went onto the crew's backs is worth
  // its rating today and a fraction of it later.
  logs.push(
    `🧥 The crew puts on the ${good}. Warmth ${spec.warmth} while it lasts.`,
  );
  return true;
}

/**
 * Which of the crew's garments of this good a repair would work on, and how
 * much of it is missing.
 *
 * The most worn one, because that is the one a captain means: a crew with
 * two of the same garment wants the thin one put right, and answering with
 * anything else would spend a mend on the wrong coat. The answer is zero
 * for a good the crew is not wearing at all and for one already at its own
 * maximum, which is the same reading the two callers need: the bench greys
 * a button out on it, and the repair below does nothing on it.
 *
 * Exported because the panels that offer a repair quote it as well as
 * compare it, and a panel that worked the shortfall out again would be a
 * second opinion about the number the button turns on.
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
 * Putting points back into a garment the crew is wearing, and the one writer
 * of a durability that goes up.
 *
 * [D4: Loom: the Refit] The port mend and the Loom's refit are the same
 * arithmetic at two prices, so they are one function: both name a good,
 * both hand it a number of points, and both are refused in the same place.
 * It returns how much of the garment actually came back rather than a
 * boolean, because both callers charge for the work and neither may charge
 * for work it did not do: a mend on a garment already whole is not a mend,
 * and a fee is not owed for one.
 *
 * It reads the same healing every other reader here reads (durabilityOf)
 * rather than trusting the field, and it writes a new row rather than
 * mutating one, which is the shape the settlement tick already uses for the
 * garments it keeps.
 */
export function restoreGarment(
  state: GameState,
  good: unknown,
  points: number,
  logs: string[],
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
    `🧵 The ${good} comes back to ${after} of ${spec.durability}, worth ${warmthText(garmentWarmth({ good, durability: after }))} of warmth.`,
  );
  return after - before;
}

/**
 * The settlement tick: the tag, the check, the frostbite and the wear.
 *
 * Called once from the resolve step (see finishSettlement in
 * ./engine/lifecycle, which is the settlement step the plan names), stamped
 * by the round so a leg that arrives through two paths is read once. The
 * stamp is written before anything else happens, which is what makes the
 * second call a no op rather than a second decay.
 *
 * Order matters and it is the plan's: the check is read against the clothes
 * the crew actually wore through the leg, so the wear below is applied after
 * the check rather than before it, and the frostbite mark is written for the
 * next leg, because that is the leg the hand cannot work.
 *
 * The marks a leg ends with are cleared here as the walk goes, so a hand
 * frostbitten two legs ago is not carrying a sentence whose leg is over.
 */
export function tickGarments(state: GameState, logs: string[]): void {
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
  // Nothing worn on a fair leg is a leg with nothing to say: no clothes to
  // wear out and no check to fail.
  if (worn.length === 0 && !cold) return;

  const score = warmthScore(state);
  logs.push(`\n🧥=== Round ${state.currentRound} · The Cold and the Cloth ===`);
  if (cold) {
    logs.push(
      score >= COLD_LEG_WARMTH
        ? `❄️ A cold leg, and the crew's ${warmthText(score)} of warmth is enough for the ${COLD_LEG_WARMTH} it asks.`
        : `❄️ A cold leg, and the crew's ${warmthText(score)} of warmth falls short of the ${COLD_LEG_WARMTH} it asks.`,
    );
    if (score < COLD_LEG_WARMTH) frostbiteNewest(state, logs);
  }

  const step = cold ? GARMENT_DECAY_COLD_LEG : GARMENT_DECAY_PER_LEG;
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
        `🌊 The ${garment.good} wears through to rags and is scrapped for ${RAG_SCRAP_VALUE} Gold.`,
      );
      continue;
    }
    kept.push({ good: garment.good, durability: remaining });
  }
  state.garments = kept;
  if (worn.length > 0 && rags === 0) {
    // The number is durability points rather than warmth, which are two
    // units rather than one: warmth is the garment's rating scaled by the
    // durability it has left (see warmthScore), so two points off a coat
    // costs a fraction of its warmth. The line used to call the points
    // warmth, and a captain watching the wardrobe could never reconcile
    // the sentence with the numbers.
    logs.push(`🧵 Worn clothes lose ${step} point of wear to the sea.`);
  }
}

/**
 * One hand pays for a leg spent short of warmth, and it is the newest aboard.
 *
 * The same rule ./crew's loss takes, through the same walk, because a voyage
 * should have one answer to which hand pays and the plan does not give a
 * second one for the cold. The mark is one leg of work and nothing else:
 * the hand is still aboard, still eats and is still paid. The line names
 * the why and the way back, because "out of action" alone read as the sea
 * having taken a hand for good, when warm clothes before the cold are all
 * it ever asked for.
 */
function frostbiteNewest(state: GameState, logs: string[]): void {
  const newest = newestAboard(state);
  if (newest === null) {
    logs.push("🥶 There is nobody aboard to take the cold.");
    return;
  }
  const hand = state.workers[newest.type]?.[newest.index];
  if (!hand) return;
  hand.frostbittenRound = state.currentRound + 1;
  const label = workerType(newest.type)?.label ?? newest.type;
  logs.push(
    `🥶 Frostbite: ${hand.name} the ${label} went into the cold short of warm clothes, and is out of action next leg. A warmer layer before a cold leg keeps every hand working.`,
  );
}

/**
 * How much of a garment is left, read so that no caller can be handed a
 * number outside the garment's own ends.
 *
 * A durability that is not a number heals to the garment's full value rather
 * than to nothing, which is the direction ./larder's own reader heals in and
 * for the same reason: a save damaged by a bad write should put a captain on
 * a whole garment, not on a ruined one they never wore out. A fraction is
 * floored, because the sea takes whole points of durability.
 */
function durabilityOf(raw: unknown, spec: GarmentSpec): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return spec.durability;
  return Math.min(spec.durability, Math.max(0, Math.floor(raw)));
}

/**
 * The wardrobe a save was carrying, healed the way every other saved field
 * is.
 *
 * A voyage saved before this layer existed holds no wardrobe at all and
 * lands on an empty one, which is a crew with nothing on: the first cold leg
 * after loading is one they meet the way a fresh voyage meets it, rather
 * than one they meet in clothes a save invented for them.
 *
 * An entry is kept only when it is a garment the catalogue knows, so a save
 * claiming a hold full of sails for the crew to wear is read as a wardrobe
 * missing those entries rather than as warmth nobody can account for. A
 * durability at or below zero is a garment already in rags, which is a state
 * the wardrobe does not carry, so it is dropped rather than worn. The list
 * is capped, and the cap is the only branch here play cannot reach (see
 * GARMENTS_WORN_MAX).
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
 * The tick's stamp, read back the same way the Larder's is.
 *
 * A save written before this field existed carries no stamp and lands on
 * zero, which is a leg no voyage has: the first settlement after loading
 * therefore reads the wardrobe, exactly as it would have had the captain
 * been sailing this build all along.
 */
export function normalizeGarmentsTickRound(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}
