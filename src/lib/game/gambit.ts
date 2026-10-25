// Ocean Gambit alignments: who is hiding something, and what each card
// says. No clock, socket, or database. The draw takes a server minted seed
// that is used once and discarded; only the resulting rows are kept, which
// is what a reload replays. The seed owner is src/server/realtime/gambit.ts.

import { createRng, pick, weightedPick, type Rng } from "./rng";
import { t } from "@/lib/game/i18n";

export type GambitRole = "honest" | "pirate" | "broker";

// Unreadable values fall back to Honest. Guessing the other way would hand
// a captain a secret the table never drew.
export function normalizeRole(value: unknown): GambitRole {
  return value === "pirate" || value === "broker" ? value : "honest";
}

// Below four captains, a hidden card has no game to play and everyone is
// Honest.
const MIN_GAMBIT_TABLE = 4;

// Four or five captains yield one hidden card; six or more yield two. A
// third would make the Honest majority the minority.
export function hiddenCardCount(captains: number): number {
  if (captains < MIN_GAMBIT_TABLE) return 0;
  return captains >= 6 ? 2 : 1;
}

// The second hidden seat's pool. A Broker never sits beside another
// Broker, so this is only asked once.
const SECOND_SEAT: Array<[GambitRole, number]> = [
  ["pirate", 1],
  ["broker", 1],
];

/**
 * One alignment per captain, pure in the roster and the seed. The roster is
 * sorted first, so database order cannot change the deal. The first hidden
 * seat is always a Pirate; the second may be a Broker instead.
 */
export function dealRoles(
  captainIds: readonly string[],
  seed: string,
): Record<string, GambitRole> {
  const rng = createRng(seed);
  const order = [...captainIds].sort();
  // Fisher-Yates over the sorted roster: seats depend on the seed alone.
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const roles: Record<string, GambitRole> = {};
  for (const id of order) roles[id] = "honest";

  const count = hiddenCardCount(order.length);
  for (let seat = 0; seat < count; seat++) {
    // First hidden card is always a Pirate; the second may be a Broker.
    roles[order[seat]] = seat === 0 ? "pirate" : weightedPick(rng, SECOND_SEAT);
  }
  return roles;
}

// One captain's card: the role, plus the personal goal an Honest captain
// carries on top of the fleet's commission.
export type GambitCard = {
  role: GambitRole;
  // Null on a hidden card; a Pirate and a Broker each win on their own
  // condition and get no second goal.
  flourishId: string | null;
};

/**
 * The whole hand. Roles come from dealRoles. Flourishes use a second
 * stream off the same seed, so authoring one cannot move a dealt card.
 */
export function dealCards(
  captainIds: readonly string[],
  seed: string,
  objectiveId: string,
): Record<string, GambitCard> {
  const roles = dealRoles(captainIds, seed);
  const rng = createRng(`${seed}:flourish`);
  const cards: Record<string, GambitCard> = {};
  // Insertion follows the sorted roster, so the hand is order independent.
  for (const [userId, role] of Object.entries(roles)) {
    const flourish = role === "honest" ? drawFlourish(rng, objectiveId) : null;
    cards[userId] = { role, flourishId: flourish?.id ?? null };
  }
  return cards;
}

/**
 * The other Pirate when exactly two were dealt, otherwise null. Pirates
 * pair; a Broker does not. Derived from the cards so a reload replays the
 * same pairing, and three Pirates is not a supported case.
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

// The flourishes: four shapes, each one line of arithmetic against the
// voyage's end state.
export type Flourish = {
  id: string;
  kind: "purse" | "reputation" | "stock" | "delivery";
  // Set for stock only; delivery is about the commission's goods.
  good?: string;
  amount: number;
};

// One deck per commission, keyed by the objective id. Two shapes under
// each commission pull against the public goal on purpose (delivering
// empties the hold, buying spends the purse). These numbers are the
// balance knob and live in one place.
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

// One list for the lookup by id.
const ALL_FLOURISHES: readonly Flourish[] = Object.values(FLOURISHES).flat();

// A commission with no deck yields no flourish rather than a throw.
export function flourishDeck(objectiveId: string): readonly Flourish[] {
  return FLOURISHES[objectiveId] ?? [];
}

// One flourish by id; the server drops an unresolvable id rather than
// sending a goal nothing can print.
export function flourishById(id: string): Flourish | undefined {
  return ALL_FLOURISHES.find((flourish) => flourish.id === id);
}

// Drawn only with the card it belongs to.
function drawFlourish(rng: Rng, objectiveId: string): Flourish | null {
  const deck = flourishDeck(objectiveId);
  return deck.length > 0 ? pick(rng, deck) : null;
}

// Built from the record, so the prose and the measured amount cannot
// drift apart.
export function flourishLine(flourish: Flourish): string {
  switch (flourish.kind) {
    case "purse":
      return t(
        "Finish the voyage holding at least {flourish.amount} Gold of your own.",
        { "flourish.amount": flourish.amount },
      );
    case "reputation":
      return t("Finish the voyage at {flourish.amount} Reputation or better.", {
        "flourish.amount": flourish.amount,
      });
    case "stock":
      return t(
        "Finish the voyage still holding {flourish.amount} {flourish.good} of your own.",
        {
          "flourish.amount": flourish.amount,
          // The good has its own translation row.
          "flourish.good": flourish.good ? t(flourish.good) : "",
        },
      );
    case "delivery":
      return t(
        "Hand over at least {flourish.amount} items of the commission yourself.",
        { "flourish.amount": flourish.amount },
      );
  }
}

// The second line on a Pirate's card when two were dealt.
export function allyLine(name: string): string {
  return t("{name} sails the same flag you do, and the two of you know it.", {
    name,
  });
}

// Card wording lives here because both the server's private entry and the
// card interface read it. One record, one wording.
interface RoleCard {
  title: string;
  line: string;
}

const CARDS: Record<GambitRole, RoleCard> = {
  honest: {
    title: "Honest Captain",
    // Still says what this captain is for; it is not a certificate.
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

// The dealt card's line in the reader's language. The server writes it at
// the send and both printing surfaces read it again here, so a language
// switch mid voyage is reflected rather than stale.
export function dealtCardLine(role: GambitRole): string {
  return t(roleCard(role).line);
}
