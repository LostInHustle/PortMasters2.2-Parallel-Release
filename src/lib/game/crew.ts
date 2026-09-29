// =====================================================================
// PortMasters 2.2 Parallel Release: the crew, by name.
//
// [C2: crew loss by name] C1 gave the ship a mouth; this module gives the
// roster a face. Two consecutive legs on short rations cost the newest hand
// aboard, permanently and by name, and the name is the point: a number
// going down says a cost, and a name going off a roster says a person. The
// plan calls this the emotional core of the survival edition, and says the
// shape has to be decided now rather than later because a boon in F4
// triggers on this event and a reveal shows it.
//
// Five things about the shape are decisions rather than readings.
//
// The roster stays keyed by artisan type. A flat crew array was the other
// candidate and it was the wrong one: the type is load bearing for the
// work, since production, wages, hiring and the bench all walk
// WORKER_TYPES, and a flat list would have moved every one of those walks
// to buy nothing this feature needs. What the roster was missing was not
// its shape but its identity, so the member carries a name and a number
// rather than the roster changing shape under every reader.
//
// The victim is the newest aboard, and it is a rule rather than a roll.
// The engine draws its randomness from seeded streams (see ./rng), and a
// loss sharing one would shift every later market card in the voyage; more
// to the point, a captain can plan around a rule and cannot plan around a
// die. The newest is the hand the captain has invested least in, which is
// what keeps the loss survivable rather than a reason to stop playing, and
// it leaves the founding artisan standing last, which is a story the
// voyage's own ledger can tell.
//
// A name is drawn once and stored, rather than derived from the order
// aboard. The plan says the pool is worth a content pass of its own once
// the mechanic is proven, and a derived name would rename the crew the day
// that content moved. The draw skips every name the voyage has already
// spent, the living and the lost both, so a hand lost over the side is not
// quietly replaced by a stranger wearing their name.
//
// The run of hungry legs is counted rather than reconstructed. A purchase
// in the market phase can refill the larder after the meal, so the Larder's
// own number at the next Dawn cannot say what the leg before it ate, and a
// run that guessed would either spare a captain the rule or charge them
// for a leg they provisioned through. It is one number, advanced once a
// leg, beside the meal that causes it.
//
// The rule is its own switch. The plan's rollback is explicit that the
// roster shape stays and the loss rule is what goes behind a flag, and the
// two are separable here for a reason worth naming: an operator may want
// the Larder and its shortage without the permanence while a table learns
// the game. The switch is read through the same policy function C1's own
// switch uses, so the two cannot drift in what they accept, and the layer
// switch governs it from above, since without the layer there is no
// shortage for the loss to follow.
//
// Pure: no clock, no socket, no database. The one environment read is the
// switch, documented where it happens.
// =====================================================================
import {
  CREW_LOSS_AFTER_HUNGRY_LEGS,
  CREW_NAMES,
  workerType,
  WORKER_TYPE_IDS,
  type WorkerTypeId,
} from "./constants";
import { crewSize, onShortRations } from "./larder";
import { flagOn } from "./flags";
import {
  flatWorkerRoster,
  type CrewLoss,
  type GameState,
  type Worker,
} from "./types";

// The longest a name read off a save may be, and the most losses a save may
// claim. Both are bounds on input rather than content: names are drawn from
// the pool above and are far shorter than this, and a voyage twelve legs
// long cannot lose more hands than that, so neither number is reachable by
// play. They exist so a save written by hand cannot put a paragraph in a
// log line or a novel in the voyage's summary.
const CREW_NAME_MAX = 24;
const CREW_LOST_MAX = 24;

/**
 * Whether the loss rule is running.
 *
 * The plan's rollback for this feature is one flag, and this is it, read
 * through the same policy function every other switch in the family uses
 * (see flagOn in ./flags, which also carries the note about how a read has
 * to be written for a browser bundle to see it). With the switch off the
 * roster still exists and is still drawn, because the plan says the roster is the
 * durable part and the rule is what goes: a captain meets named artisans
 * and never loses one.
 *
 * Answering true here does not promise a loss can happen, only that this
 * switch is on: the shortage the rule needs comes from the layer above, so
 * a build with the provisions off loses nobody whatever this says.
 */
export function crewLossRuleOn(): boolean {
  return flagOn(process.env.NEXT_PUBLIC_CREW_LOSS);
}

/**
 * Who the next hand aboard is: a name no one on this voyage carries and a
 * number higher than every number in the roster.
 *
 * Read at the moment of hiring rather than at the moment of birth, so a
 * hire that bails out over an empty purse never spends a name.
 */
export function newCrewIdentity(state: GameState): {
  name: string;
  seq: number;
} {
  const roster = flatWorkerRoster(state);
  let top = 0;
  for (const worker of roster) {
    const seq = Number.isFinite(worker.seq) ? Math.floor(worker.seq) : 0;
    if (seq > top) top = seq;
  }
  const seq = top + 1;
  return { name: drawCrewName(takenNames(state), seq), seq };
}

/**
 * The Dawn tick: what a second leg without rations costs.
 *
 * Runs once a leg, and its caller decides that rather than this function:
 * feedCrew answers whether the call was the leg's meal, and the meal and
 * its price are one happening at one moment (see startBoonDrafting in
 * ./engine/boons, which is the one function every leg opens through).
 * Asking here instead would ask twice on a leg that arrives through two
 * paths, and the second advance would take a hand a leg early in silence.
 *
 * A fed leg, a layer that is off and a ship with nobody aboard all reset
 * the run rather than pausing it, because each of them is a leg the crew
 * did not go hungry: the rule counts consecutive hungry legs, not hungry
 * legs in a voyage.
 *
 * With the loss rule switched off the run is reset the same way, so a
 * captain provisioned while the rule was off is not met by a loss the
 * moment an operator turns it back on.
 */
export function settleHunger(state: GameState, logs: string[]): void {
  if (!crewLossRuleOn() || !onShortRations(state)) {
    state.hungryLegs = 0;
    return;
  }
  const run = Number.isFinite(state.hungryLegs) ? state.hungryLegs : 0;
  state.hungryLegs = run + 1;
  if (state.hungryLegs < CREW_LOSS_AFTER_HUNGRY_LEGS) return;
  state.hungryLegs = 0;
  loseNewest(state, logs);
}

/**
 * The newest hand is taken, and the voyage writes it down.
 *
 * The record carries the leg as well as the name because the plan's own
 * evaluation reads a spiral from it: a captain losing hands faster than
 * they can provision loses them sooner in the voyage, and the two numbers
 * together are the only way that shows.
 *
 * A member taken with a task in hand is taken with it, exactly as a
 * dismissed artisan is (see fireWorker in ./engine/workers): the recipe was
 * spent when the task was assigned, and the line below says so rather than
 * letting the hold lose goods with no sentence over them.
 */
function loseNewest(state: GameState, logs: string[]): void {
  const newest = newestAboard(state);
  if (newest === null) return;
  const list = state.workers[newest.type];
  if (!list || newest.index < 0 || newest.index >= list.length) return;
  const gone = list.splice(newest.index, 1)[0];
  state.crewLost.push({ name: gone.name, round: state.currentRound });
  const label = workerType(newest.type)?.label ?? newest.type;
  const left = crewSize(state);
  // The run is read from the constant rather than spelled into the
  // sentence, for the reason SHORT_RATIONS_YIELD is read into the Larder's
  // own line: a rule that changed its number must not leave a sentence
  // behind telling the table something the rule no longer does.
  logs.push(
    `⚰️ ${gone.name} the ${label} is lost after ${CREW_LOSS_AFTER_HUNGRY_LEGS} legs on short rations, and nothing brings them back.`,
  );
  if (gone.task) {
    logs.push(`  The ${gone.task} they were working is lost with them.`);
  }
  logs.push(
    left === 0 ? "🌊 There is no one left aboard." : `🌊 ${left} still aboard.`,
  );
}

/**
 * The newest hand aboard: the highest number the voyage has given out, with
 * the type they stand under and where they stand in it.
 *
 * One walk, because two rules ask the same question now, the loss above and
 * the cold in ./garments, and a second copy would be a second opinion about
 * who is newest. Exported for that second reader rather than duplicated,
 * since the tie rule below is exactly the kind of detail two copies drift on.
 *
 * The later walk wins a tie, which is a rule only for a save that carries
 * two members wearing one number: the heal below gives every hand its own,
 * so the branch exists to keep the choice deterministic rather than to be
 * reached.
 */
export function newestAboard(
  state: Pick<GameState, "workers">,
): { type: WorkerTypeId; index: number } | null {
  let type: WorkerTypeId | null = null;
  let index = -1;
  let newest = 0;
  for (const id of WORKER_TYPE_IDS) {
    const list = state.workers[id] ?? [];
    for (let i = 0; i < list.length; i++) {
      const seq = Number.isFinite(list[i].seq) ? Math.floor(list[i].seq) : 0;
      if (seq >= newest) {
        newest = seq;
        type = id;
        index = i;
      }
    }
  }
  return type === null ? null : { type, index };
}

/**
 * Every name this voyage has already spent: the living and the lost.
 *
 * The lost half is what keeps a name off the roster for good once it has
 * gone off it, which is the permanence the plan is after read at the one
 * place a captain could otherwise meet the same name twice.
 */
function takenNames(state: GameState): Set<string> {
  const taken = new Set<string>();
  for (const worker of flatWorkerRoster(state)) {
    if (worker.name) taken.add(worker.name);
  }
  for (const loss of state.crewLost ?? []) taken.add(loss.name);
  return taken;
}

/**
 * A name for a hand who just came aboard.
 *
 * The draw starts from the order aboard rather than from the top of the
 * pool, so a save healed from a roster of three gets three different names
 * without walking the list three times, and then steps forward past
 * whatever is spoken for. The final line is the floor rather than the
 * common case: it is reached only by a voyage that has spent every name in
 * the pool, which costs more hands than the wages of one allow, and it
 * answers with a name rather than refusing to have one.
 */
function drawCrewName(taken: Set<string>, seq: number): string {
  const start = Math.max(0, Math.floor(seq) - 1) % CREW_NAMES.length;
  for (let step = 0; step < CREW_NAMES.length; step++) {
    const candidate = CREW_NAMES[(start + step) % CREW_NAMES.length];
    if (!taken.has(candidate)) return candidate;
  }
  return CREW_NAMES[start];
}

/**
 * Whatever a save holds, read back as a name or as nothing.
 *
 * A name is not a number, so the tolerant reading here is the trim and the
 * length: a name a save padded with spaces is that name, and a string far
 * longer than the pool's longest is damage, which lands in the redraw
 * below rather than in a log line.
 */
function readStoredName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  if (!name || name.length > CREW_NAME_MAX) return null;
  return name;
}

/**
 * A save read back into a roster with faces on it, and a voyage with a run
 * and a record.
 *
 * Runs once, at the load site, directly after normalizeWorkerRoster has
 * given the roster its shape (see src/lib/use-game-session.ts). The split
 * is forced rather than chosen: a drawn name depends on the voyage's own
 * losses, and the draw lives in this module, which reads the type module,
 * so the type module could not reach it without a cycle. Every reader of a
 * name sits after both calls.
 *
 * A save written before this feature existed carries workers with no name
 * and no number, and it heals to a full roster with names in roster order
 * and numbers one apart, which is a crew that reads as people rather than
 * as damage. What a save does carry is honored rather than regenerated:
 * names it holds are kept, numbers it holds are kept, and only what cannot
 * be true is replaced. A name two members both claim is kept for the first
 * and redrawn for the second, since a roster with two hands called Ada is
 * exactly what the draw exists to prevent, even where the duplicate was
 * written by a hand rather than drawn by one.
 */
export function healCrewIdentity(state: GameState): void {
  state.hungryLegs = normalizeHungryLegs(state.hungryLegs);
  state.crewLost = normalizeCrewLost(state.crewLost);
  const roster = flatWorkerRoster(state);
  const claimed = new Set(state.crewLost.map((loss) => loss.name));
  const kept = new Map<Worker, string>();
  let top = 0;
  for (const worker of roster) {
    const seq = Number.isFinite(worker.seq) ? Math.floor(worker.seq) : 0;
    if (seq > top) top = seq;
  }
  for (const worker of roster) {
    const name = readStoredName(worker.name);
    if (name && !claimed.has(name)) {
      claimed.add(name);
      kept.set(worker, name);
    }
  }
  for (const worker of roster) {
    const stored = kept.get(worker);
    if (stored !== undefined) {
      worker.name = stored;
      const seq = Number.isFinite(worker.seq) ? Math.floor(worker.seq) : 0;
      if (seq < 1) {
        top += 1;
        worker.seq = top;
      }
      continue;
    }
    top += 1;
    worker.seq = top;
    worker.name = drawCrewName(claimed, top);
    claimed.add(worker.name);
  }
}

/**
 * The run of hungry legs, read back the same way the Larder's own fields
 * are. A save written before this field existed carries none, and it lands
 * on zero, which is a crew that has not gone hungry yet: the first hungry
 * leg after loading therefore counts as the first, exactly as it would
 * have had the captain been sailing this build all along. A fraction is
 * floored, because legs are counted.
 */
export function normalizeHungryLegs(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}

/**
 * The voyage's losses, read back as a list a reader can trust.
 *
 * Anything that could not be a loss is dropped rather than repaired: a
 * record of who was lost is the one thing on the roster that must never be
 * invented, so an entry with no readable name is not a loss missing a name,
 * it is damage, and it does not count as a hand. The bound and the leg's
 * floor exist for the same reason the run's do, and neither is reachable
 * by play.
 */
export function normalizeCrewLost(raw: unknown): CrewLoss[] {
  if (!Array.isArray(raw)) return [];
  const out: CrewLoss[] = [];
  for (const entry of raw) {
    if (out.length >= CREW_LOST_MAX) break;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const name = readStoredName((entry as { name?: unknown }).name);
    if (!name) continue;
    const round = (entry as { round?: unknown }).round;
    out.push({
      name,
      round:
        typeof round === "number" && Number.isFinite(round)
          ? Math.max(0, Math.floor(round))
          : 0,
    });
  }
  return out;
}
