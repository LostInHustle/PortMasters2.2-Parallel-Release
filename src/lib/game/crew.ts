// The crew, by name. Two consecutive rounds on short rations cost the newest
// hand aboard, permanently and by name.
//
// The roster stays keyed by artisan type, since production, wages, hiring
// and the bench all walk WORKER_TYPES. What it was missing was identity, so
// each member carries a name and a number.
//
// The victim is the newest aboard, a rule rather than a roll: a loss drawn
// from a seeded stream would shift every later market card, and a captain
// can work around a rule. Names are drawn once and stored; the draw skips
// every name the voyage has spent, the living and the lost.
//
// Hungry rounds are counted rather than reconstructed, because a market
// purchase can refill the larder after the meal. The loss rule has its own
// switch, separable from the layer.
import {
  CREW_LOSS_AFTER_HUNGRY_ROUNDS,
  CREW_NAMES,
  workerType,
  WORKER_TYPE_IDS,
  type WorkerTypeId,
} from "./constants/crew";
import { onShortRations } from "./larder";
import { flagOnFor } from "./flags";
import {
  crewSize,
  flatWorkerRoster,
  wholeStamp,
  type CrewLoss,
  type GameState,
  type Worker,
} from "./types";
import { line, type LedgerLine } from "@/lib/game/ledger";

// Bounds on what a save may claim: a name length and a loss count. Both are
// far past what play reaches; they exist so a hand written save cannot put
// a paragraph in a log line or a novel in the voyage summary.
const CREW_NAME_MAX = 24;
const CREW_LOST_MAX = 24;

/**
 * The loss rule's own switch, read through flagOnFor. With it off the
 * roster still exists and is still drawn; only the loss is gone.
 *
 * Mode is read first, so a Classic table loses nobody whatever the
 * environment says. True here does not promise a loss: the shortage it
 * needs comes from the layer above.
 */
export function crewLossRuleOn(mode: unknown): boolean {
  return flagOnFor(mode, process.env.NEXT_PUBLIC_CREW_LOSS);
}

/**
 * Read at hiring, so a hire that bails over an empty purse spends no name.
 */
export function newCrewIdentity(state: GameState): {
  name: string;
  seq: number;
} {
  const roster = flatWorkerRoster(state);
  const seq = topSeq(roster) + 1;
  return { name: drawCrewName(takenNames(state), seq), seq };
}

/**
 * Highest number the roster has handed out. One walk because hiring and
 * healing both ask. Rubbish reads as none, a fraction as a whole.
 */
function topSeq(roster: readonly Worker[]): number {
  let top = 0;
  for (const worker of roster) {
    const seq = workerSeq(worker);
    if (seq > top) top = seq;
  }
  return top;
}

function workerSeq(worker: Worker): number {
  return Number.isFinite(worker.seq) ? Math.floor(worker.seq) : 0;
}

/**
 * The Dawn tick. The caller decides once a round: feedCrew answers whether
 * this was the round's meal, and the meal and its price share one moment.
 * Asking here would advance twice on a round that arrives through two paths.
 *
 * A fed round, a layer that is off and an empty ship all reset the run. With
 * the loss rule off the run resets too, so turning it back on does not
 * greet a provisioned captain with a loss.
 */
export function settleHunger(state: GameState, logs: LedgerLine[]): void {
  if (!crewLossRuleOn(state.mode) || !onShortRations(state)) {
    state.hungryRounds = 0;
    return;
  }
  const run = Number.isFinite(state.hungryRounds) ? state.hungryRounds : 0;
  state.hungryRounds = run + 1;
  if (state.hungryRounds < CREW_LOSS_AFTER_HUNGRY_ROUNDS) return;
  state.hungryRounds = 0;
  loseNewest(state, logs);
}

/**
 * The newest hand is taken and the voyage records the name and the round. A
 * member taken with a task loses it too, as a dismissed artisan does; the
 * recipe was spent at assignment.
 */
function loseNewest(state: GameState, logs: LedgerLine[]): void {
  const newest = newestAboard(state);
  if (newest === null) return;
  const list = state.workers[newest.type];
  if (!list || newest.index < 0 || newest.index >= list.length) return;
  const gone = list.splice(newest.index, 1)[0];
  state.crewLost.push({ name: gone.name, round: state.currentRound });
  const label = workerType(newest.type)?.label ?? newest.type;
  const left = crewSize(state);
  // Read from the constant so the sentence cannot drift from the rule.
  logs.push(
    line(
      "⚰️ {gone.name} the {label} is lost after {CREW_LOSS_AFTER_HUNGRY_ROUNDS} rounds on short rations, and nothing brings them back.",
      {
        "gone.name": gone.name,
        label: line(label),
        CREW_LOSS_AFTER_HUNGRY_ROUNDS,
      },
    ),
  );
  if (gone.task) {
    logs.push(
      line(
        "The {gone.task} they were working is lost with them.",
        { "gone.task": line(gone.task) },
        "  ",
      ),
    );
  }
  logs.push(
    left === 0
      ? line("🌊 There is no one left aboard.")
      : line("🌊 {left} still aboard.", { left }),
  );
}

/**
 * The newest hand aboard, shared with the cold in ./garments. The later
 * walk wins a tie, which keeps the choice deterministic for a save that
 * carries two members with one number.
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

/** Every name the voyage has spent, the living and the lost. */
function takenNames(state: GameState): Set<string> {
  const taken = new Set<string>();
  for (const worker of flatWorkerRoster(state)) {
    if (worker.name) taken.add(worker.name);
  }
  for (const loss of state.crewLost ?? []) taken.add(loss.name);
  return taken;
}

/**
 * A name for a new hand. Starts from the hand's number so a healed roster
 * gets distinct names, then steps past names already taken. The final
 * return is the floor for a voyage that has spent the whole pool.
 */
function drawCrewName(taken: Set<string>, seq: number): string {
  const start = Math.max(0, Math.floor(seq) - 1) % CREW_NAMES.length;
  for (let step = 0; step < CREW_NAMES.length; step++) {
    const candidate = CREW_NAMES[(start + step) % CREW_NAMES.length];
    if (!taken.has(candidate)) return candidate;
  }
  return CREW_NAMES[start];
}

/** Trimmed, and rejected if empty or longer than the pool allows. */
function readStoredName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  if (!name || name.length > CREW_NAME_MAX) return null;
  return name;
}

/**
 * Reads a save back into a roster with faces. Runs once at load, right
 * after normalizeWorkerRoster (see src/lib/use-game-session.ts); the split
 * exists because drawing a name depends on losses, which lives here.
 *
 * Names and numbers the save carries are honored; only what cannot be true
 * is replaced. A name two members claim is kept for the first and redrawn
 * for the second.
 */
export function healCrewIdentity(state: GameState): void {
  // A save from before the round vocabulary keeps its run of hungry rounds
  // under the older key, so the count is read from either spelling.
  const legacy = state as unknown as { hungryLegs?: unknown };
  state.hungryRounds = normalizeHungryRounds(
    state.hungryRounds ?? legacy.hungryLegs,
  );
  state.crewLost = normalizeCrewLost(state.crewLost);
  const roster = flatWorkerRoster(state);
  const claimed = new Set(state.crewLost.map((loss) => loss.name));
  const kept = new Map<Worker, string>();
  let top = topSeq(roster);
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
      const seq = workerSeq(worker);
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
 * Missing reads as 0: the first hungry round after loading counts as the
 * first.
 */
export function normalizeHungryRounds(raw: unknown): number {
  return wholeStamp(raw);
}

/**
 * Losses read back as a list a reader can trust. Unreadable entries are
 * dropped rather than repaired: a lost hand must never be invented.
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
