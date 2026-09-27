// =====================================================================
// PortMasters 2.2 Parallel Release: Ocean Gambit alignments.
//
// The one place that decides who is hiding something, and the one place
// that writes down what each card says. It is a data module for the same
// reason ./mode.ts is: the realtime layer draws the cards and the
// interface draws a card back out again, and neither of them should own
// the vocabulary the other has to agree with.
//
// A card is a role, plus a flourish for the majority of the table: the
// personal goal an Honest captain carries on top of the fleet's
// commission. The flourish deck is keyed by the objective rather than
// drawn from a pool of its own, because the rule for it is that the
// personal goal and the public one are authored together. A flourish
// that did not name the goods its own fleet is being asked for would be
// a second objective rather than a share in this one.
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

import { createRng, pick, weightedPick, type Rng } from "./rng";

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

/**
 * One captain's card. The role decides which game they are playing; the
 * flourish is the personal goal the majority of the table carries on top
 * of the fleet's commission.
 */
export type GambitCard = {
  role: GambitRole;
  // Which flourish, by id, an Honest captain was dealt. Null on a
  // Variable card, because a Pirate and a Broker each win on a condition
  // of their own and neither is handed a second one.
  flourishId: string | null;
};

/**
 * The whole hand: one card per captain, from a seed the caller owns and a
 * commission the caller has already drawn.
 *
 * The roles come straight out of dealRoles, which is what keeps them drawn
 * from the seed alone. The flourishes come from a second stream off the
 * same seed, so authoring a flourish can never move a card that a seed
 * already dealt, and the counted roles above stay testable against the
 * hand they have always dealt.
 */
export function dealCards(
  captainIds: readonly string[],
  seed: string,
  objectiveId: string,
): Record<string, GambitCard> {
  const roles = dealRoles(captainIds, seed);
  const rng = createRng(`${seed}:flourish`);
  const cards: Record<string, GambitCard> = {};
  // Object.entries walks a record in insertion order and dealRoles
  // inserted in sorted roster order, so the same table and the same seed
  // deal the same hand whatever order the roster arrived in.
  for (const [userId, role] of Object.entries(roles)) {
    const flourish = role === "honest" ? drawFlourish(rng, objectiveId) : null;
    cards[userId] = { role, flourishId: flourish?.id ?? null };
  }
  return cards;
}

/**
 * The other Pirate at a table that dealt exactly two of them, or null.
 *
 * The asymmetry is the design and it is deliberately not smoothed: a
 * Pirate pair gets the comfort and the coordination problems of a team,
 * and the Broker gets the loneliest seat at the table. So this answers
 * for Pirates only, and only at exactly two of them.
 *
 * It is derived from the cards rather than stored beside them, which is
 * what keeps a reload honest: the pairing a reload replays is the pairing
 * the deal produced, with no column to fall out of step with it.
 *
 * A third Pirate is not a case this answers. The mode is authored for six
 * captains and deals at most two Variables, so a table that somehow held
 * three is told nothing rather than told something wrong.
 */
export function allyFor(
  cards: Record<string, GambitCard>,
  userId: string,
): string | null {
  if (cards[userId]?.role !== "pirate") return null;
  const pirates = Object.keys(cards).filter(
    (id) => cards[id].role === "pirate",
  );
  if (pirates.length !== 2) return null;
  return pirates[0] === userId ? pirates[1] : pirates[0];
}

// ========== The flourishes ==========
//
// The personal goal the majority of the table carries. Four shapes and no
// more: each one is a single line of arithmetic against a voyage's end
// state, and the slice that reads these to decide who won needs exactly
// this much and no more. A flourish that named anything outside these
// four would be an effect rather than a goal, and it would need an engine
// behind it.
export type Flourish = {
  id: string;
  kind: "purse" | "reputation" | "stock" | "delivery";
  // The good a stock flourish is about. Absent on the two kinds that are
  // about a number rather than about goods, and on delivery, which is
  // about the commission's goods by definition and names none of them.
  good?: string;
  amount: number;
};

// One deck per commission, keyed by the objective's own id, so a flourish
// is always about the goods its fleet is being asked for. Two of the three
// shapes under each commission pull against the public goal on purpose:
// handing the commission over is what empties the hold a "still holding"
// flourish is measured on, and buying the goods for it is what spends the
// purse a "holding gold" flourish is measured on. That tension is the
// point of an Honest card, and it is the reason these are authored beside
// the objective rather than drawn from one general pool.
//
// These numbers are the balance knob the epic's evaluation will move, so
// they live in one place, exactly as the commission's prices do.
const FLOURISHES: Record<string, readonly Flourish[]> = {
  hemp_cordage: [
    { id: "hemp_cordage_hold", kind: "stock", good: "Hemp", amount: 4 },
    { id: "hemp_cordage_hand", kind: "delivery", amount: 8 },
    { id: "hemp_cordage_purse", kind: "purse", amount: 350 },
  ],
  silk_tea_levy: [
    { id: "silk_tea_levy_hold", kind: "stock", good: "Silk", amount: 3 },
    { id: "silk_tea_levy_hand", kind: "delivery", amount: 7 },
    { id: "silk_tea_levy_rep", kind: "reputation", amount: 120 },
  ],
  cloth_quota: [
    {
      id: "cloth_quota_hold",
      kind: "stock",
      good: "Cotton Clothes",
      amount: 3,
    },
    { id: "cloth_quota_hand", kind: "delivery", amount: 6 },
    { id: "cloth_quota_purse", kind: "purse", amount: 400 },
  ],
  sachet_tithe: [
    { id: "sachet_tithe_hold", kind: "stock", good: "Sachet", amount: 2 },
    { id: "sachet_tithe_hand", kind: "delivery", amount: 6 },
    { id: "sachet_tithe_rep", kind: "reputation", amount: 140 },
  ],
  brocade_command: [
    { id: "brocade_command_hold", kind: "stock", good: "Brocade", amount: 2 },
    { id: "brocade_command_hand", kind: "delivery", amount: 6 },
    { id: "brocade_command_purse", kind: "purse", amount: 450 },
  ],
  full_manifest: [
    { id: "full_manifest_hold", kind: "stock", good: "Tea", amount: 4 },
    { id: "full_manifest_hand", kind: "delivery", amount: 8 },
    { id: "full_manifest_rep", kind: "reputation", amount: 150 },
  ],
};

// Every flourish in the deck, in one list, for the lookup that goes by id.
const ALL_FLOURISHES: readonly Flourish[] = Object.values(FLOURISHES).flat();

// The flourishes authored for one commission. A commission with no deck
// yields no flourish rather than a throw: a captain holding a card without
// a personal goal is holding a worse card, not a broken voyage.
export function flourishDeck(objectiveId: string): readonly Flourish[] {
  return FLOURISHES[objectiveId] ?? [];
}

// One flourish by id. Two readers, the same pair roleCard has: the server,
// which drops an id it cannot resolve rather than sending a captain a goal
// that nothing can print, and the card, which prints the sentence.
export function flourishById(id: string): Flourish | undefined {
  return ALL_FLOURISHES.find((flourish) => flourish.id === id);
}

// One flourish out of a commission's deck, from a stream the caller owns.
// Dealing is the only caller: a goal is drawn with the card it belongs to,
// never on its own.
function drawFlourish(rng: Rng, objectiveId: string): Flourish | null {
  const deck = flourishDeck(objectiveId);
  return deck.length > 0 ? pick(rng, deck) : null;
}

// The sentence a flourish prints. Written from the record rather than
// stored on it, so the number a captain reads and the number the goal is
// measured on are the same number: a flourish whose prose says four and
// whose amount says six is the drift this function exists to prevent.
export function flourishLine(flourish: Flourish): string {
  switch (flourish.kind) {
    case "purse":
      return `Finish the voyage holding at least ${flourish.amount} Gold of your own.`;
    case "reputation":
      return `Finish the voyage at ${flourish.amount} Reputation or better.`;
    case "stock":
      return `Finish the voyage still holding ${flourish.amount} ${flourish.good} of your own.`;
    case "delivery":
      return `Hand over at least ${flourish.amount} items of the commission yourself.`;
  }
}

// The second line on a Pirate's card at a table that dealt two of them.
// Takes the partner's name rather than an id because the sentence is the
// whole delivery: the card prints it and does nothing else with it.
export function allyLine(name: string): string {
  return `${name} sails the same flag you do, and the two of you know it.`;
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
