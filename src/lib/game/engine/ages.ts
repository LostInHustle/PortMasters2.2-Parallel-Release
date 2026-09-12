// =====================================================================
// The Three Ages.
//
// A fortnight long rotation that leans the harbor one way or another
// without retuning any of the permanent balance. Each Age lasts two
// weeks, the next takes over, and after the third the cycle repeats.
// Every captain in every harbor shares the same Age at the same moment,
// so the only thing that varies is what the harbor rewards, never who is
// in it.
//
// The modifier on each Age is intentionally small and intentionally
// leaning rather than a power dial: a 50% Reputation bonus on a backing
// pledge that was never called on, a flat 1 Reputation per completed
// barter trade, a raised payout cap on the Broker's Favor. None of these
// change the rules, only the weight of one already legal action, which is
// what keeps an Age from unbalancing a voyage that began under a different
// Age.
//
// Each modifier has exactly one reader, and the readers are the three
// accessors at the foot of this file. That is worth stating plainly
// because it is the whole of a bug these three carried: nothing read a
// modifier, so the banner announced an Age in the present tense and no
// part of the voyage acted on it.
// =====================================================================
import { BROKERS_FAVOR_PAYOUT_CAP } from "../constants";

export type AgeId = "lender" | "trader" | "broker";

export type Age = {
  id: AgeId;
  name: string;
  description: string;
  // The numeric weight of the Age's effect, read by exactly one accessor
  // below: ageBackingReputationMultiplier for the Lender's 0.5,
  // ageBarterReputation for the Trader's 1, brokersFavorPayoutCap for the
  // Broker's 250. Pure scalar so an accessor can return it without the
  // engine branching on the id at the point the effect lands.
  modifier: number;
};

// Two weeks in milliseconds. The cycle anchors on the Unix epoch so every
// client in every timezone computes the same Age at the same instant,
// regardless of local clock skew or DST.
const FORTNIGHT_MS = 14 * 24 * 60 * 60 * 1000;

export const AGES: Age[] = [
  {
    id: "lender",
    name: "Age of the Lender",
    description:
      "Backing another captain's loan pays extra Renown while this Age holds the harbor.",
    modifier: 0.5,
  },
  {
    id: "trader",
    name: "Age of the Trader",
    description:
      "Every completed barter trade lands one extra Reputation on top of the goods changing hands.",
    modifier: 1,
  },
  {
    id: "broker",
    name: "Age of the Broker",
    description:
      "The Broker's Favor commission cap is raised to 250 Gold, so a single favor can pay out more than usual.",
    modifier: 250,
  },
];

// Returns the Age that holds the harbor at the given moment. Defaults to
// the current time so a UI render or a server handler can call it with
// no argument and get the live Age; tests and seeded voyages can pass a
// fixed Date to reproduce a specific Age deterministically.
//
// The floor of (timestamp / fortnight) mod 3 picks the index, which
// cycles 0, 1, 2, 0, 1, 2 forever starting from the epoch. AGES[0] is
// the Lender, AGES[1] is the Trader, AGES[2] is the Broker, in the same
// order the README lists them.
export function currentAge(now: Date = new Date()): Age {
  const idx = Math.floor(now.getTime() / FORTNIGHT_MS) % AGES.length;
  // The % above is always non negative for non negative timestamps; the
  // explicit fallback below is purely for the negative timestamp case
  // (a Date before 1970), which keeps the function total rather than
  // returning undefined for a Date no real caller will ever pass.
  return AGES[idx] ?? AGES[0];
}

// The moment the Age in force gives way to the next one. The boundary is
// the same epoch anchored one currentAge rounds down to, so a caller that
// wants to say how long the current Age still holds works it out from the
// same clock the Age itself came from rather than keeping a second idea of
// when the fortnight ends. Pass the same Date to both and the two can
// never disagree across a boundary.
export function nextAgeChange(now: Date = new Date()): Date {
  const nextIdx = Math.floor(now.getTime() / FORTNIGHT_MS) + 1;
  return new Date(nextIdx * FORTNIGHT_MS);
}

// ========== What each Age actually does ==========
// One accessor per Age, each the single reader of that Age's modifier. The
// engine calls these where the effect lands rather than testing an id
// itself, so the map from "which Age is it" to "what it changes" stays in
// this one file. Each takes a Date for the same reason currentAge does: a
// caller holding a fixed clock can reproduce a chosen Age exactly.

// What the Age in force multiplies a backing pledge's Reputation by, 1
// when no Age favours backing. Read by receiveBackingOutcome in
// ./backingState.ts. Applied to the raw figure before the shared per
// voyage helper ceiling, never after it, so no Age can lift a captain past
// the one cap lending and backing both answer to.
export function ageBackingReputationMultiplier(now: Date = new Date()): number {
  const age = currentAge(now);
  return age.id === "lender" ? 1 + age.modifier : 1;
}

// The Reputation a completed barter trade lands under the Age in force, 0
// when none does. Read by both sides of a trade, acceptBarterOffer and
// settleBarterTrade in ./barter.ts, so a trade pays the same whichever
// captain happened to post the offer and whichever accepted it.
export function ageBarterReputation(now: Date = new Date()): number {
  const age = currentAge(now);
  return age.id === "trader" ? age.modifier : 0;
}

// The Broker's Favor payout cap under the Age in force. Read by
// brokersFavorCommission in ./pricing.ts, the one place the commission
// curve is computed, so every quote and the payout itself move together.
export function brokersFavorPayoutCap(now: Date = new Date()): number {
  const age = currentAge(now);
  return age.id === "broker" ? age.modifier : BROKERS_FAVOR_PAYOUT_CAP;
}

// The highest payout cap any Age can put in force. The plausibility bound
// in ../../integrity.ts reads this rather than the live cap, because a
// save is judged whenever it is next loaded rather than when it was
// written: a captain who collected a Broker's Age payout last fortnight
// must not read as impossible today.
export const WIDEST_BROKERS_FAVOR_PAYOUT_CAP = Math.max(
  BROKERS_FAVOR_PAYOUT_CAP,
  AGES.find((a) => a.id === "broker")?.modifier ?? BROKERS_FAVOR_PAYOUT_CAP,
);
