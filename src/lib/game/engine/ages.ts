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
// cosmetic leaning rather than a power dial: a 50% Renown bonus on
// backing, a flat 1 Reputation per completed barter trade, a raised
// commission cap on Broker's Favor. None of these change the rules,
// only the weight of one already legal action, which is what keeps an
// Age from unbalancing a voyage that began under a different Age.
// =====================================================================

export type AgeId = "lender" | "trader" | "broker";

export type Age = {
  id: AgeId;
  name: string;
  description: string;
  // The numeric weight of the Age's effect. See the per Age notes below
  // for what each one means and where it is read. Pure scalar so the
  // engine can multiply or compare without branching on the id.
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
