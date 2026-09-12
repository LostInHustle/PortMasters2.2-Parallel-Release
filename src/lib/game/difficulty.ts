// =====================================================================
// PortMasters 2.2 Parallel Release: difficulty modes
//
// One data record defines every difficulty tier, and a thin layer of pure
// selectors derives each in game dial from it. This mirrors the earlier
// build's own design (a single DIFFICULTIES record plus difficultyRules
// helpers), rebuilt around this release's own systems.
//
// Difficulty is a ROOM property (see Room.difficulty in prisma/schema.prisma):
// the host picks it once, and every captain in the harbor resolves the same
// tier. Because the tier and the round number are the only inputs to every
// selector here, and both are identical for everyone in a room, each
// captain's seeded market and orders keep their own personal draw while the
// structure (how many cards, how likely a raid) stays consistent room wide.
//
// The "fair_winds" tier is calibrated to the game exactly as it played before
// difficulty existed: 8 rounds, a flat 0.2 raid chance, a 0.1 escort fee, 6
// cards on each board, no mandates and no corrupt brokers. Those numbers used
// to be flat constants in ./constants; moving them here changed nothing for
// the existing mode, and it is what lets the two richer tiers vary them.
// See docs/DIFFICULTY_MODES_PROPOSAL.md.
// =====================================================================

export type Difficulty = "fair_winds" | "open_waters" | "monsoon";

export const DEFAULT_DIFFICULTY: Difficulty = "fair_winds";

export interface DifficultyConfig {
  key: Difficulty;
  // Display metadata, read by the lobby switch, the room card chip, and the
  // in game status chip, so copy and numbers never drift from one source.
  name: string;
  badge: string;
  icon: string;
  tagline: string;
  summary: string;

  // Voyage length. Flows into GameState.maxRounds; the endgame check already
  // reads maxRounds, so a longer voyage needs nothing else.
  rounds: number;
  // Starting stake and the flat per round ship maintenance fee.
  startingGold: number;
  maintenance: number;

  // Market breadth. Both boards (port purchase and trade orders) start at the
  // base count and gain the same number of extra cards once the voyage reaches
  // each "charter" round, reproducing the original's widening market without a
  // new content library. An empty schedule (fair_winds) is a flat market.
  purchaseCardsBase: number;
  orderCardsBase: number;
  // Content tier to the round its charter opens (see the tiered pools in
  // ./constants). A tier absent from this map never opens on this difficulty,
  // which is how Fair Winds stays on the founding trade forever.
  tierUnlock: Record<number, number>;
  // Extra cards added to both boards per tier opened, index 0 being the first
  // charter. One schedule drives content and market breadth together, so the
  // banner, the new goods, and the busier harbor are all the same event.
  cardsPerTier: readonly number[];

  // Raid probability. One entry is a flat toll all voyage; two entries step up
  // at the midpoint (round > floor(rounds / 2)). Severity itself is unchanged:
  // a raid still takes every coin, faithful to the Parallel Release identity,
  // so difficulty escalates the chance rather than the loss fraction.
  pirateChance: readonly [number] | readonly [number, number];
  // Escort fee as a fraction of current gold, the guaranteed safe alternative
  // to risking the raid roll.
  escortCostRate: number;

  // On a corrupt broker, this much is added to the round's raid chance, once,
  // when the broker leaks the captain's position. Only ever applied on a tier
  // with brokerCorruption true. Delivered intel stays true and guaranteed.
  brokerCorruption: boolean;
  brokerCorruptionChance: number;
  brokerCorruptionRisk: number;

  // Imperial mandate schedule: round -> index into MANDATE_TEMPLATES (small,
  // medium, large). Empty means no mandates on this tier.
  mandates: Record<number, number>;

  // Reputation banked as Renown XP at voyage end is scaled by this, so a
  // harder voyage advances the permanent Captain's Legacy faster.
  renownXpMultiplier: number;
}

// The launch tuning. fair_winds is calibrated to equal the current single
// mode exactly; open_waters and monsoon follow docs/DIFFICULTY_MODES_PROPOSAL.md.
export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  fair_winds: {
    key: "fair_winds",
    name: "Fair Winds",
    badge: "Fair Winds",
    icon: "🌤️",
    tagline: "A gentle passage for new captains.",
    summary:
      "Eight rounds on the founding trade. A short, legible voyage with room to learn the rhythm before the money runs tight.",
    rounds: 8,
    startingGold: 100,
    maintenance: 15,
    purchaseCardsBase: 6,
    orderCardsBase: 6,
    tierUnlock: {},
    cardsPerTier: [],
    pirateChance: [0.2],
    escortCostRate: 0.1,
    brokerCorruption: false,
    brokerCorruptionChance: 0,
    brokerCorruptionRisk: 0,
    mandates: {},
    renownXpMultiplier: 1.0,
  },
  open_waters: {
    key: "open_waters",
    name: "Open Waters",
    badge: "Open Waters",
    icon: "🌊",
    tagline: "The full trade opens as the harbor grows busy.",
    summary:
      "Twelve rounds. The charter opens twice and the market swells from six cards to ten, with pirates that begin to bite past the midpoint.",
    rounds: 12,
    startingGold: 100,
    maintenance: 18,
    purchaseCardsBase: 6,
    orderCardsBase: 6,
    tierUnlock: { 1: 4, 2: 8 },
    cardsPerTier: [2, 2],
    pirateChance: [0.22, 0.3],
    escortCostRate: 0.12,
    brokerCorruption: false,
    brokerCorruptionChance: 0,
    brokerCorruptionRisk: 0,
    mandates: { 4: 0, 8: 1, 12: 2 },
    renownXpMultiplier: 1.25,
  },
  monsoon: {
    key: "monsoon",
    name: "Monsoon Season",
    badge: "Monsoon",
    icon: "⛈️",
    tagline: "A long, adversarial haul for seasoned captains.",
    summary:
      "Sixteen rounds, back loaded and unforgiving. The market swells to eleven cards, the largest imperial mandates fall late, and a corrupt broker may leak your position to the pirates.",
    rounds: 16,
    startingGold: 90,
    maintenance: 22,
    purchaseCardsBase: 6,
    orderCardsBase: 6,
    tierUnlock: { 1: 6, 2: 11 },
    cardsPerTier: [2, 3],
    pirateChance: [0.28, 0.38],
    escortCostRate: 0.15,
    brokerCorruption: true,
    brokerCorruptionChance: 0.3,
    brokerCorruptionRisk: 0.08,
    mandates: { 6: 1, 12: 2, 16: 2 },
    renownXpMultiplier: 1.6,
  },
};

// Ordered for the lobby switch (calm to storm).
export const DIFFICULTY_ORDER: readonly Difficulty[] = [
  "fair_winds",
  "open_waters",
  "monsoon",
];

// Imperial mandate templates, ordered small to large, indexed by the mandates
// schedule above. Consumed once mandate injection is wired (later phase); kept
// here so the whole tier definition lives in one file.
interface MandateTemplate {
  size: "small" | "medium" | "large";
  port: string;
  resources: { type: string; required: number }[];
  reward: number;
}

// A mandate is deliberately fixed data with no randomness, so every captain in
// a room is dealt the identical commission without disturbing their own seeded
// market. Mandates are also exempt from VAT (they are an imperial commission,
// not a taxed sale), which is why the engine flags them isProductOrder: false.
export const MANDATE_TEMPLATES: readonly MandateTemplate[] = [
  {
    size: "small",
    port: "Quanzhou Port",
    resources: [
      { type: "Silk", required: 4 },
      { type: "Tea", required: 3 },
    ],
    reward: 135,
  },
  {
    size: "medium",
    port: "Yangzhou Port",
    resources: [
      { type: "Brocade", required: 2 },
      { type: "Sachet", required: 1 },
    ],
    reward: 260,
  },
  {
    size: "large",
    port: "Hangzhou Port",
    resources: [
      { type: "Cotton Clothes", required: 2 },
      { type: "Brocade", required: 2 },
      { type: "Sachet", required: 2 },
    ],
    reward: 420,
  },
];

// ========== Selectors (pure) ==========

// Any unknown value (a stale save, a malformed request) falls back to the
// default tier rather than throwing, the same defensive shape the original's
// normalize_difficulty used.
export function normalizeDifficulty(value: unknown): Difficulty {
  return value === "fair_winds" ||
    value === "open_waters" ||
    value === "monsoon"
    ? value
    : DEFAULT_DIFFICULTY;
}

export function difficultyConfig(value: unknown): DifficultyConfig {
  return DIFFICULTIES[normalizeDifficulty(value)];
}

// Voyage length is read often enough, and by the test suite in particular, to
// justify its own accessor. There are deliberately no startingGoldFor /
// maintenanceFor / brokerCorruptionFor twins: those existed and nothing ever
// called them, since every consumer reads difficultyConfig(x).field directly,
// which is just as clear and one fewer indirection to keep in step. The
// selectors below earn their place because they compute something (a
// midpoint, an accumulation, a normalization) rather than forwarding a field.
export function roundsFor(value: unknown): number {
  return difficultyConfig(value).rounds;
}
export function escortRateFor(value: unknown): number {
  return difficultyConfig(value).escortCostRate;
}

export function renownMultiplierFor(value: unknown): number {
  return difficultyConfig(value).renownXpMultiplier;
}

// Card counts for both boards on a given round: the base plus every charter
// bump the voyage has reached by now. Mirrors the accumulation of the
// original's tier unlocks / phaseOptionCount, expressed as card density.
// The highest content tier whose charter has opened by this round. Everything
// tier gated (goods, ports, artisans, boons, modules, market breadth) keys off
// this one number, so they can never disagree about what is available.
export function unlockedTierFor(value: unknown, roundNo: number): number {
  const cfg = difficultyConfig(value);
  let highest = 0;
  for (const [tierStr, openRound] of Object.entries(cfg.tierUnlock)) {
    if (roundNo >= openRound) highest = Math.max(highest, Number(tierStr));
  }
  return highest;
}

// Everything from tier 0 up to whatever has opened, in tier order. The generic
// keeps this usable for every pool (resources, products, ports, boons, modules)
// without each one restating the accumulation.
export function unlockedPool<T>(
  tiers: readonly (readonly T[])[],
  value: unknown,
  roundNo: number,
): T[] {
  const tier = unlockedTierFor(value, roundNo);
  const out: T[] = [];
  for (let i = 0; i <= tier; i++) out.push(...(tiers[i] ?? []));
  return out;
}

export function marketCountsFor(
  value: unknown,
  roundNo: number,
): { purchase: number; order: number } {
  const cfg = difficultyConfig(value);
  const tier = unlockedTierFor(value, roundNo);
  let extra = 0;
  for (let i = 0; i < tier; i++) extra += cfg.cardsPerTier[i] ?? 0;
  return {
    purchase: cfg.purchaseCardsBase + extra,
    order: cfg.orderCardsBase + extra,
  };
}

// Which content tier's charter opens on exactly this round, if any, so the
// caller can announce what actually arrived rather than a generic banner.
function charterTierOpeningOn(
  value: unknown,
  roundNo: number,
): number | undefined {
  for (const [tierStr, openRound] of Object.entries(
    difficultyConfig(value).tierUnlock,
  )) {
    if (roundNo === openRound) return Number(tierStr);
  }
  return undefined;
}

export function charterOpensOn(value: unknown, roundNo: number): boolean {
  return charterTierOpeningOn(value, roundNo) !== undefined;
}

// Raid probability for this round: the flat toll, or the second half tier once
// the voyage passes its midpoint. Same midpoint rule the original used for its
// pirate loss curve (floor(maxRounds / 2)).
export function pirateChanceFor(
  value: unknown,
  roundNo: number,
  maxRounds: number,
): number {
  const curve = difficultyConfig(value).pirateChance;
  const secondHalf = curve.length === 2 ? curve[1] : curve[0];
  return roundNo <= Math.floor(maxRounds / 2) ? curve[0] : secondHalf;
}

// The scheduled mandate template index for this round, or undefined if none
// fires. undefined (not a number) keeps "round 1 has no mandate" distinct from
// "round with template 0".
export function mandateIndexFor(
  value: unknown,
  roundNo: number,
): number | undefined {
  return difficultyConfig(value).mandates[roundNo];
}

// Every round this tier schedules a mandate on, in ascending order. Read off
// the tier's own config wherever a sentence needs to name them, so adding a
// mandate to a tier can never leave the copy describing the old schedule.
export function mandateRounds(cfg: DifficultyConfig): number[] {
  return Object.keys(cfg.mandates)
    .map(Number)
    .sort((a, b) => a - b);
}
