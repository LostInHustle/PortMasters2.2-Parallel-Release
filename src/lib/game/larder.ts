// =====================================================================
// PortMasters 2.2 Parallel Release: the Larder and Short Rations.
//
// [C1: the Larder and Short Rations] A captain's crew is the artisan
// roster. This tree has called it that since the voyage summary was
// written, and it is already billed once a leg by ./engine/workers, which
// pays a wage for every artisan aboard. This module is the other half of
// that bill: the same crew eats.
//
// Four things about the shape are decisions rather than readings, and each
// of them is worth the sentence it costs here.
//
// The Larder is a plain number and not an inventory of foods. The survival
// edition eventually carries three of those, with spoilage and a split
// hold, and all of that is C4's. Until it lands, a ration is a ration, and
// the number on the screen is how many are aboard.
//
// Rations are bought. The plan never says where they come from, and its own
// evaluation says it from the side: a shortage that "produces no messages
// means the market is not working", which can only be a true reading of a
// shortage the market could have prevented. A Larder that could not be
// refilled would be a countdown rather than a decision, and C2's crew loss,
// which fires after two legs on short rations, would take a head from
// nearly every voyage instead of from the fifth of them the proposal
// expects.
//
// The shortage's second effect is not here. The plan's sentence is "cargo
// capacity down a quarter", and there is no cargo capacity in this tree to
// take a quarter off: the hold is unbounded, and the dashboard, the
// telemetry reader and the plan's own C4 section each say so in writing.
// The capacity model is C4's to build, and the clause lands there, on the
// single capacity read the split hold introduces, rather than being
// satisfied now by a hold size invented for it. What Short Rations costs
// today is the crew's pace, which is the other half of the same sentence
// and the half this tree can measure.
//
// The layer is one switch, and the switch is an environment value rather
// than a field, so nothing about a voyage is stored differently with it on
// or off. See survivalLayerOn below for where that value is read and for
// the one cost the browser pays for it.
//
// Pure: no clock, no socket, no database. The one environment read is
// deliberate and it is documented where it happens.
// =====================================================================
import {
  LARDER_MAX,
  LARDER_START,
  RATION_PRICE,
  SHORT_RATIONS_YIELD,
} from "./constants";
import { flatWorkerRoster, type GameState } from "./types";

/**
 * Whether the provisions layer is running at all.
 *
 * The plan's rollback is one flag, and this is it. With the switch off a
 * captain eats nothing, nothing is slower and nothing is drawn, which is
 * the base game exactly: no rules run, no numbers are read and no field
 * changes, so nothing about a voyage is stored differently either way.
 *
 * It is read here rather than cached, which is the one place it differs
 * from the clock's own scale (see phaseBudgetSeconds in
 * src/server/realtime/checkpoint.ts). That one caches because it sits on a
 * path that runs a zod parse a leg and its value cannot move inside a
 * process; this is read twice a leg, so a cache would buy nothing, and
 * leaving it live is what lets the suite hold both sides of the switch in
 * a single run rather than one process per value.
 *
 * The NEXT_PUBLIC_ prefix is not decoration. The rule this gates runs in
 * the browser, where the engine runs, and a value without that prefix is
 * not present in a client bundle at all. The cost of the prefix is real
 * and it is stated where an operator will meet it, in the rollback note in
 * docs/RELEASE_NOTES.md: the browser's copy is fixed when the bundle is
 * built, so rolling the layer back is a rebuild and a restart rather than
 * a restart alone. Unset, empty and any value that is not the word off or
 * the digit zero all mean the layer is on, so a typo leaves the game
 * playable rather than quietly deleting a system.
 */
export function survivalLayerOn(): boolean {
  const raw = (process.env.NEXT_PUBLIC_SURVIVAL ?? "").trim().toLowerCase();
  return raw !== "off" && raw !== "0";
}

/**
 * The crew: the artisan roster, counted through the one helper that
 * flattens it. Taken here rather than written out at each reader so the
 * number the Larder feeds and the number the voyage summary prints cannot
 * come from two different counts of the same roster.
 */
export function crewSize(state: Pick<GameState, "workers">): number {
  return flatWorkerRoster(state).length;
}

/**
 * Whether this captain is on short rations right now.
 *
 * Both halves are needed and either one alone would be wrong. An empty
 * Larder aboard a ship with nobody on it is a captain who never hired
 * rather than a captain who is starving, and a full Larder with a crew is
 * simply a fed one. The switch is read last and it is read here rather than
 * at the call sites, because every reader of this answer has to get the
 * same one: the crew's pace, the badge the fleet sees, and the captain's
 * own ledger line. A version of this that answered yes with the layer
 * switched off would put a shortage on a screen for a rule that is not
 * running.
 */
export function onShortRations(
  state: Pick<GameState, "workers" | "larder">,
): boolean {
  if (!survivalLayerOn()) return false;
  return state.larder <= 0 && crewSize(state) > 0;
}

/**
 * What one artisan's work comes to on a leg the crew went hungry.
 *
 * The reduction floors at a single item, and the floor is not a softening
 * of the rule: it is the committed materials. A task is started by spending
 * its recipe out of the hold (see assignTask in ./engine/workers), so a
 * yield that could round away to nothing would take those goods and return
 * silence, which is a trap rather than a cost. A leg is also the smallest
 * unit of work this engine has, so "slower than one good a leg" is not a
 * slower crew, it is a stopped one, and the plan says the shortage slows
 * crafting. An artisan already working at the floor therefore keeps working
 * at it, and the artisan who was producing two is the one who feels this.
 */
export function shortRationsYield(amount: number): number {
  const slowed = Math.floor(amount * SHORT_RATIONS_YIELD);
  return Math.max(1, slowed);
}

/**
 * The crew eats, once a leg.
 *
 * One ration a head, floored at zero, because a Larder the crew has emptied
 * is empty rather than in debt to its own ship.
 *
 * The leg stamp is what makes "once a leg" true rather than hopeful. A leg
 * opens through more than one path, and two of them can reach the same
 * client for the same leg: the captain who leaves Dusk rolls the round over
 * locally, and every captain in the room is then carried into the same Dawn
 * by the room's advance, which is the entry that calls the draft's opener.
 * Feeding on arrival instead of on a stamp would charge a captain for a leg
 * twice, and a double charge is a silent defect: nothing throws, no screen
 * looks wrong, and the captain simply runs out of food a leg early for a
 * reason they cannot see. The stamp costs one number on the save and takes
 * the question off the table.
 *
 * It is written before the early returns below, so a leg is marked as eaten
 * whether or not there was anything to eat. The rule is "the crew eats once
 * a leg", not "the crew eats once a leg, if", and the difference shows on a
 * captain who hires their first artisan mid leg: marked or not decides
 * whether that artisan eats on the leg they arrived in.
 */
export function feedCrew(state: GameState, logs: string[]): void {
  if (!survivalLayerOn()) return;
  if (state.larderFedRound === state.currentRound) return;
  state.larderFedRound = state.currentRound;
  const crew = crewSize(state);
  if (crew === 0) return;
  const before = state.larder;
  state.larder = Math.max(0, before - crew);
  if (state.larder === 0) {
    // The number in the sentence is read off the constant rather than
    // written into the words, the way the unlock line reads its own
    // threshold: a pace that moved would move what the captain is told.
    const pace = Math.round(SHORT_RATIONS_YIELD * 100);
    logs.push(
      `⚠️ Short rations! ${crew} aboard and the larder is empty: the crew works this leg at ${pace}% pace, and the fleet can see it.`,
    );
    return;
  }
  logs.push(
    `🍲 The crew eats ${crew} ${crew === 1 ? "ration" : "rations"}. ${state.larder} left in the larder.`,
  );
}

/**
 * How many legs of rations the Larder still has room for, which is the
 * question a captain asks before buying and the only quantity the purchase
 * below takes. Zero aboard a full hold or a ship with no crew, which is the
 * same answer those two cases already give a buyer.
 */
export function larderRoomLegs(state: GameState): number {
  const crew = crewSize(state);
  if (crew === 0) return 0;
  return Math.floor(Math.max(0, LARDER_MAX - state.larder) / crew);
}

/**
 * Buys rations for the crew, as many legs' worth as will fit in the Larder
 * and can be paid for.
 *
 * Measured in legs rather than in rations because a leg is the only
 * quantity a captain can reason about: what they are deciding is how long
 * the food has to last, and that is the same arithmetic the eat above runs.
 *
 * The ceiling and the purse are reached rather than refused. A captain who
 * asked for four legs with room for one buys one, and one who can afford
 * half of what they asked for buys half, because a store that turned custom
 * away over an amount the buyer could not have known would be a worse
 * merchant than the ones this game is about. What it will not do is buy
 * nothing and say nothing: a purchase that comes to zero rations returns
 * zero and says why, so the panel can print the reason rather than a
 * button that appears to do nothing.
 *
 * Returns the legs actually bought, so the caller can report what happened
 * rather than what was asked for.
 */
export function provisionCrew(
  state: GameState,
  legs: number,
  logs: string[],
): number {
  if (!survivalLayerOn()) return 0;
  const crew = crewSize(state);
  if (crew === 0) {
    logs.push("⚓ No crew aboard, so there is nothing to provision.");
    return 0;
  }
  const room = larderRoomLegs(state);
  if (room <= 0) {
    logs.push("🧺 The larder is full.");
    return 0;
  }
  const affordable = Math.floor(state.money / (crew * RATION_PRICE));
  const wanted = Math.min(Math.floor(legs), room, affordable);
  if (wanted <= 0) {
    const cost = crew * RATION_PRICE;
    logs.push(
      `❌ Not enough Gold to provision the crew: a leg of rations is ${cost} Gold.`,
    );
    return 0;
  }
  const rations = wanted * crew;
  const cost = rations * RATION_PRICE;
  state.money -= cost;
  state.larder += rations;
  state.roundCosts += cost;
  state.totalCosts += cost;
  logs.push(
    `🧺 Provisioned ${rations} ${rations === 1 ? "ration" : "rations"} for ${crew} aboard (${cost} Gold). ${state.larder} in the larder.`,
  );
  return wanted;
}

/**
 * Whatever a save holds, read back as a number a crew can eat.
 *
 * A non number is not a Larder, so it heals to the full opening hold rather
 * than to an empty one: a file this tree cannot read is damage, and a
 * captain should not be put on short rations for a leg by a corrupted save.
 * A number outside the hold's ends is clamped rather than dropped, since it
 * was written by a build that had a legitimate value and the ends are the
 * only thing this reader knows about it. A fraction is floored, because
 * rations are counted.
 */
export function normalizeLarder(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return LARDER_START;
  const whole = Math.floor(raw);
  return Math.min(LARDER_MAX, Math.max(0, whole));
}

/**
 * The leg stamp, read back the same way.
 *
 * A save written before this field existed carries no stamp, and it lands
 * on zero, which is a leg no voyage has: the first Dawn after loading
 * therefore feeds the crew, exactly as it would have had the captain been
 * sailing this build all along.
 */
export function normalizeLarderFedRound(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.floor(raw));
}
