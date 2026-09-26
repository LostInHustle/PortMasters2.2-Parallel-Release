// =====================================================================
// PortMasters 2.2 Parallel Release: Ocean Gambit alignments.
//
// The one place that decides who is hiding something, and the one place
// that writes down what each card says. It is a data module for the same
// reason ./mode.ts is: the realtime layer draws the cards and the
// interface draws a card back out again, and neither of them should own
// the vocabulary the other has to agree with.
//
// Nothing here reads a clock, a database or a socket, and the draw takes
// its randomness as an argument rather than reaching for one. That last
// part is the whole spine of the mode. The engine is deterministic by
// composition, seeded from values the client already knows, which is what
// lets the server stay out of the simulation; a hidden role cannot be
// drawn from a value the captain can read. So the seed for this draw is
// minted by the server at departure, used once, and thrown away. What is
// kept is the rows it produced, which is what a reload replays from. See
// src/server/realtime/gambit.ts for the half that owns the seed.
// =====================================================================

import { createRng, weightedPick } from "./rng";

export type GambitRole = "honest" | "pirate" | "broker";

// Any value that is not one of the three roles reads as Honest, the same
// defensive shape normalizeMode and normalizeDifficulty use. The fallback
// is Honest rather than a refusal because the two ways this can be wrong
// are not equally bad: an unreadable card that reads as Honest is a
// captain playing the fleet's game, and an unreadable card that guessed
// the other way would hand a captain a secret the table never drew.
export function normalizeRole(value: unknown): GambitRole {
  return value === "pirate" || value === "broker" ? value : "honest";
}

// The smallest table the mode deals a Variable into. A traitor needs a
// fleet to betray: at three captains the whole voyage is over before
// deduction can start, and a captain holding a Pirate card at that size
// is holding a card with nothing to do. Below this every captain draws
// an Honest card and the voyage is an ordinary one.
const MIN_GAMBIT_TABLE = 4;

// How many of a table are hiding something. The counts are the plan's:
// four or five captains yields one Variable, six yields two, and a
// seven captain harbor is capped at two rather than dealt a third,
// because the mode is written for six and a third Variable would make
// the Honest majority the minority.
export function variableCount(captains: number): number {
  if (captains < MIN_GAMBIT_TABLE) return 0;
  return captains >= 6 ? 2 : 1;
}

// The pool the second Variable is drawn from at a six captain table. A
// Broker is never drawn beside another Broker, so this pool is only ever
// asked once, and its two weights are the mix between the shapes a six
// captain table can take.
const SECOND_SEAT: Array<[GambitRole, number]> = [
  ["pirate", 1],
  ["broker", 1],
];

/**
 * One alignment per captain, drawn from a seed the caller owns.
 *
 * A pure function of the roster and the seed: the same table and the same
 * seed always produce the same cards, whatever order the roster came back
 * from the database in, which is what makes the draw testable at all.
 *
 * The fleet never holds two Brokers, because a Broker wins alone and two
 * of them are two captains playing the same solitary game. At a table
 * large enough for two Variables the second seat is drawn between the two
 * roles, so both Pirate and Broker tables are reachable; the mix between
 * them is a balance decision that belongs to the objective deck and the
 * role rewrite, and this is the line it will be changed on.
 */
export function dealRoles(
  captainIds: readonly string[],
  seed: string,
): Record<string, GambitRole> {
  const rng = createRng(seed);
  const order = [...captainIds].sort();
  // Fisher-Yates over the sorted roster, so the seat a card lands in
  // depends on the seed alone.
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const roles: Record<string, GambitRole> = {};
  for (const id of order) roles[id] = "honest";

  const count = variableCount(order.length);
  for (let seat = 0; seat < count; seat++) {
    // The first Variable is a Pirate, so a table large enough for two
    // always has the sabotage half of the mode in it. The second may be
    // the Broker instead, and never another Broker.
    roles[order[seat]] = seat === 0 ? "pirate" : weightedPick(rng, SECOND_SEAT);
  }
  return roles;
}

// What one card says. The wording lives here rather than on a screen
// because two surfaces read it: the server writes the line into the
// private entry it sends, and the interface heads the card the entry
// belongs to with the title. One record, so a card cannot say two
// different things.
interface RoleCard {
  title: string;
  line: string;
}

const CARDS: Record<GambitRole, RoleCard> = {
  honest: {
    title: "Honest Captain",
    // Deliberately not a participation certificate: the Honest card is
    // the one most of the table holds, and it still has to say what this
    // captain is for.
    line: "You sail the public objective with the fleet. Nothing about you is hidden.",
  },
  pirate: {
    title: "Pirate",
    line: "You sail under a false flag. The fleet's objective has to fail, and you have to stay solvent while it does.",
  },
  broker: {
    title: "Broker",
    line: "You sail for yourself, and only for yourself. Profit from deals with other captains, and the fleet's success is no loss to you.",
  },
};

export function roleCard(role: GambitRole): RoleCard {
  return CARDS[role];
}
