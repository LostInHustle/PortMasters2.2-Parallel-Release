// =====================================================================
// PortMasters 2.2 Parallel Release: the Ocean Gambit victory rules.
//
// One card decides what winning means for the captain holding it, and the
// three cards mean three different things. An Honest card wins when the
// fleet's commission is met and the personal goal that came with the card
// is met with it. A Broker card wins on coin taken from other captains and
// does not care what the commission does, which is the property the design
// leans on hardest: the Broker is greedy rather than hostile, so a voyage
// the fleet completes and the Broker gets rich in is a voyage two sides
// won. A Pirate card wins when the commission fails, and only if the Pirate
// comes out of it solvent and standing, because a traitor who has to run a
// working business to win is a traitor who can be caught.
//
// One file holds the rule and the read that feeds it, the same way
// ./integrity.ts holds both checkSave and the snapshotFromSave it judges:
// the ending a rule is measured on is read out of a save blob a client
// wrote, so the reading is untrusted work with a discipline of its own, and
// separating it from the rule would only put the two in different files.
// The rules themselves take numbers and give a verdict. No clock, no
// socket, no database, no randomness.
//
// The server evaluates this once at conclusion, with the numbers it
// already holds, and writes the answer onto the captain's own Chronicle
// row. Nothing here is broadcast: the reveal is a later slice, and a win
// condition that announced itself would be an alignment leak with extra
// steps.
//
// The numbers below are the mode's balance knobs, and each one is the
// first thing to move when a band reads wrong rather than the role itself.
// The plan's bands are an honest side between 52 and 58 percent, a Broker
// between 35 and 45, and a Pirate between 20 and 26.
// =====================================================================

import type { Objective } from "./objectives";
import type { Flourish, GambitRole } from "./gambit";
import { normalizeInventory } from "./types";

// What the Broker has to realize in coin from other captains to win. The
// proposal's number, and the whole balance of the role: raise it and the
// Broker has to churn harder, lower it and the seat goes quiet.
export const BROKER_PAYOUT_TARGET = 2200;

// Where a Pirate's standing has to land. Fifty is the line the Endgame
// screen already calls a Qualified Trader (see MERCHANT_RATINGS in
// ./constants/reputation.ts), so the floor reads as "you were at least a working
// merchant this voyage" rather than as a number invented for the mode. A
// Pirate who ends below it spent the voyage hiding, and hiding is the one
// way the rewritten role forbids them to play.
export const PIRATE_STANDING_FLOOR = 50;

// How a captain's voyage ended, as the rules see it. Three of the six
// numbers come from the finish report every other column of the Chronicle
// is built from, and three are read out of the save blob that captain's own
// client has been writing all voyage, which is the same trust level as
// every other client reported number in this game.
export type CaptainEnding = {
  gold: number;
  reputation: number;
  bankrupt: boolean;
  // What is still in the hold at the end, by good.
  held: Record<string, number>;
  // What this captain handed to the commission, by good, cumulative.
  delivered: Record<string, number>;
  // Coin taken from other captains, net of coin paid to them in trade.
  // Never anything the port paid: that is the distinction the role is.
  peerTradeProfit: number;
};

// The three numbers the finish report carries. Named as one type because
// they travel together and are never read apart.
type ReportedFinish = {
  gold: number;
  reputation: number;
  bankrupt: boolean;
};

/**
 * The ending a rule is measured on, read out of a save blob.
 *
 * Every field is treated as untrusted, the discipline snapshotFromSave
 * applies to money and score, and a field that cannot be read is passed
 * over rather than repaired: a save with no peer ledger is a voyage that
 * never struck a deal, and both halves of the hold are read through
 * normalizeInventory, which is this tree's one reader of an untrusted
 * record of amounts. Reusing it is deliberate rather than a slip: the hold
 * and the delivery tally have exactly the same shape, and a second copy of
 * the same loop is how the two would come to disagree about what a
 * readable amount is.
 *
 * `reported` wins over the blob wherever the two overlap, because the
 * report is what every other number on the Chronicle row came from and a
 * goal measured on a different figure than the one printed beside it is
 * the one thing this row must never do.
 */
export function readEnding(
  data: unknown,
  reported: ReportedFinish,
): CaptainEnding {
  const blob =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  return {
    ...reported,
    held: normalizeInventory(blob.inventory),
    delivered: normalizeInventory(blob.objectiveDelivered),
    peerTradeProfit: readPeerTradeProfit(data),
  };
}

/**
 * The peer ledger on its own, out of a save blob.
 *
 * Split out of the ending above because a reader can want this one number
 * without wanting the rest of the ending around it: the voyage record's
 * captain lines carry it (goal I2), and they are written by the spine,
 * which has no business inventing the reported finish the ending takes.
 * One implementation rather than two, so the number on a captain's line
 * and the number the Broker's verdict was decided on cannot be two
 * readings of one save. A value that is not a finite number is the absence
 * of a ledger rather than a ledger of nothing, and both read as zero.
 */
export function readPeerTradeProfit(data: unknown): number {
  const blob =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  const profit = blob.peerTradeProfit;
  return typeof profit === "number" && Number.isFinite(profit) ? profit : 0;
}

// Whether one flourish was met, read off the ending above.
//
// The delivery goal is clamped to the commission before it is counted, for
// the same reason the public board is clamped at its source: a captain can
// only hand over what the commission still owes, so a save claiming more
// than that is claiming a delivery the voyage could not have recorded, and
// the clamp is what makes the goal mean the same thing as the board.
//
// The stock goal is deliberately not clamped. What is in the hold is the
// hold, whether or not the commission wanted it.
export function flourishMet(
  flourish: Flourish,
  ending: CaptainEnding,
  objective: Objective,
): boolean {
  switch (flourish.kind) {
    case "purse":
      return ending.gold >= flourish.amount;
    case "reputation":
      return ending.reputation >= flourish.amount;
    case "stock":
      return (ending.held[flourish.good ?? ""] ?? 0) >= flourish.amount;
    case "delivery": {
      const handed = objective.resources.reduce(
        (sum, r) => sum + Math.min(ending.delivered[r.type] ?? 0, r.required),
        0,
      );
      return handed >= flourish.amount;
    }
  }
}

/**
 * Whether this captain won, from their own card and the voyage's outcome.
 *
 * An Honest card with no flourish wins on the commission alone. That card
 * is what a captain who joined a voyage already under way is handed, and
 * its promise was the fleet's objective and nothing else, so judging it on
 * a personal goal it was never dealt would make a late arrival unable to
 * win at all.
 *
 * `objectiveMet` is the fleet's commission rather than this captain's own
 * contribution to it, because the card promises the fleet's goal. The
 * caller computes it once and writes the same answer to the Chronicle row,
 * so the record and the verdict cannot disagree.
 */
export function evaluateVictory(args: {
  role: GambitRole;
  objective: Objective;
  objectiveMet: boolean;
  flourish: Flourish | null;
  ending: CaptainEnding;
}): boolean {
  const { role, objective, objectiveMet, flourish, ending } = args;
  switch (role) {
    case "honest":
      return (
        objectiveMet &&
        (flourish === null || flourishMet(flourish, ending, objective))
      );
    case "broker":
      return ending.peerTradeProfit >= BROKER_PAYOUT_TARGET;
    case "pirate":
      return (
        !objectiveMet &&
        !ending.bankrupt &&
        ending.reputation >= PIRATE_STANDING_FLOOR
      );
  }
}

/**
 * What the card tells its holder they are playing for.
 *
 * Written here rather than beside the card's prose in ./gambit.ts because
 * it is the same rule evaluateVictory enforces, and a promise that lived
 * anywhere else would be a second copy of it free to drift. It reads the
 * knobs rather than hard coding them, so retuning a target changes what
 * the card says in the same release that changes what the card means.
 *
 * The flourish is passed in rather than looked up, because both callers
 * have already resolved it to print the goal above this line, and a
 * sentence promising a personal goal on a card that carries none would be
 * the drift this function exists to prevent.
 */
export function victoryLine(
  role: GambitRole,
  flourish: Flourish | null,
): string {
  switch (role) {
    case "honest":
      return flourish
        ? "You win if the fleet fills its commission and your own goal above is met with it."
        : "You win if the fleet fills its commission.";
    case "broker":
      return `You win if you take at least ${BROKER_PAYOUT_TARGET} Gold from other captains in trade. The commission is their business rather than yours, so a voyage they finish well is no loss to you.`;
    case "pirate":
      return "You win if the fleet falls short of its commission, and you still end the voyage solvent and rated at least a Qualified Trader.";
  }
}
