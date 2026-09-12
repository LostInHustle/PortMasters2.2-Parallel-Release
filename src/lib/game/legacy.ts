// =====================================================================
// PortMasters 2.2 Parallel Release: Captain's Legacy
// Persistent, cross voyage progression tied to a captain's account
// rather than any single room. A voyage's Gold, cargo, and ship level
// always reset (see the restart flow in src/server/realtime.ts), but the
// Reputation banked on the way to Round 8 is now worth something once
// the voyage ends too: it becomes Renown XP, carried across every harbor
// that captain ever sails in. Pure functions only, so both the client
// (the Captain's Legacy card) and the server (src/server/realtime.ts,
// the one place a CaptainLegacy row is ever written) can import this
// without pulling in anything React or Prisma specific.
// =====================================================================

// Triangular growth: level 2 needs 100 XP, level 3 needs 300, level 4
// needs 600, level 5 needs 1000, and so on, each level asking for one
// more 100 XP "step" than the last. One strong voyage (Successful
// Merchant territory and up, see the rank thresholds in constants.ts) is
// enough for an early level; the higher tiers take a long string of
// voyages on purpose, since this is meant to reward captains who keep
// coming back over weeks of play, not one lucky run.
const RENOWN_XP_UNIT = 100;

function xpRequiredForLevel(level: number): number {
  if (level <= 1) return 0;
  const steps = level - 1;
  return (RENOWN_XP_UNIT * steps * (steps + 1)) / 2;
}

export function levelForRenownXP(xp: number): number {
  let level = 1;
  while (xp >= xpRequiredForLevel(level + 1)) level++;
  return level;
}

type RenownProgress = {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
};

export function renownProgress(xp: number): RenownProgress {
  const level = levelForRenownXP(xp);
  const floor = xpRequiredForLevel(level);
  const ceiling = xpRequiredForLevel(level + 1);
  return { level, xpIntoLevel: xp - floor, xpForNextLevel: ceiling - floor };
}

type RenownTitle = { minLevel: number; title: string };

export const RENOWN_TITLES: RenownTitle[] = [
  { minLevel: 1, title: "Deckhand" },
  { minLevel: 3, title: "Able Seaman" },
  { minLevel: 5, title: "Trade Officer" },
  { minLevel: 8, title: "Harbor Captain" },
  { minLevel: 12, title: "Fleet Commodore" },
  { minLevel: 16, title: "Silk Road Legend" },
  { minLevel: 21, title: "Silk Road Sovereign" },
];

// The level at which the final title is earned, which is also the top of the
// Renown bar the Captain Profile draws. Derived from the table rather than
// written out beside it: the profile carried its own literal 21, so adding a
// title above Silk Road Sovereign would have moved the table and left the bar
// still filling to the old ceiling, with nothing to say the two disagreed.
export const RENOWN_MAX_LEVEL =
  RENOWN_TITLES[RENOWN_TITLES.length - 1].minLevel;

export function renownTitleForLevel(level: number): string {
  let title = RENOWN_TITLES[0].title;
  for (const t of RENOWN_TITLES) {
    if (level >= t.minLevel) title = t.title;
  }
  return title;
}

// The one gameplay effect Renown actually buys: a few extra Gold at the
// very start of a fresh voyage, capped well below anything that would
// make an experienced captain's early rounds trivial. +3 Gold per level
// above 1, capped at +60 (reached at level 21), against a starting
// stake of 100. Applied once, in createInitialGameState (see
// src/lib/game/types.ts): it only ever changes a captain's own starting
// Gold, never the deterministic per round market and order seed shared
// across the room, so it can't desync one captain's view of the harbor
// from anyone else's.
const RENOWN_GOLD_PER_LEVEL = 3;
const RENOWN_GOLD_CAP = 60;

export function renownStartingGoldBonus(level: number): number {
  return Math.min(
    RENOWN_GOLD_CAP,
    Math.max(0, level - 1) * RENOWN_GOLD_PER_LEVEL,
  );
}

// ========== Per difficulty breakdown ==========
// Sea Master crowns and best score split by the tier they were earned on (see
// Room.difficulty and src/lib/game/difficulty.ts). The account level
// seaMasterCrowns and bestScore stay the all tier totals; this is the breakdown
// behind them, so a crown won in a storm reads as the rarer thing it is, and a
// future leaderboard can be segmented per tier rather than ranking every tier
// against each other in one list. Keyed by plain string rather than the
// Difficulty union so this module stays free of any difficulty import and
// tolerates a tier that no longer exists in the config.
type DifficultyStats = { crowns: number; bestScore: number };
type StatsByDifficulty = Record<string, DifficultyStats>;

// Deliberately defensive: this parses a free form JSON column that rows written
// before the column existed never populated, so anything missing or malformed
// degrades to "no record yet" instead of throwing inside the voyage conclusion
// write, which runs for every finisher at once.
export function parseStatsByDifficulty(
  raw: string | null | undefined,
): StatsByDifficulty {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    const out: StatsByDifficulty = {};
    for (const [key, value] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (!value || typeof value !== "object") continue;
      const v = value as { crowns?: unknown; bestScore?: unknown };
      out[key] = {
        crowns:
          typeof v.crowns === "number" && Number.isFinite(v.crowns)
            ? v.crowns
            : 0,
        bestScore:
          typeof v.bestScore === "number" && Number.isFinite(v.bestScore)
            ? v.bestScore
            : 0,
      };
    }
    return out;
  } catch {
    return {};
  }
}

// Folds one finished voyage into the breakdown, returning a new map rather than
// mutating, so the caller can hand the result straight to a Prisma write.
export function recordVoyageInStats(
  stats: StatsByDifficulty,
  difficulty: string,
  voyage: { crowned: boolean; reputation: number },
): StatsByDifficulty {
  const prior = stats[difficulty] ?? { crowns: 0, bestScore: 0 };
  return {
    ...stats,
    [difficulty]: {
      crowns: prior.crowns + (voyage.crowned ? 1 : 0),
      bestScore: Math.max(prior.bestScore, voyage.reputation),
    },
  };
}

// Shape returned by GET /api/legacy (and its [userId]/batch siblings) and
// carried on room:voyage_complete standings (see src/server/realtime.ts).
// A brand new captain with no CaptainLegacy row yet is simply level 1
// with nothing banked, rather than a special "no data" case the UI needs
// to branch on. meritIds is every Captain's Merit (see merits.ts) this
// account has ever earned, shown for any captain, not just the viewer,
// the same as every other field here. houseId is the captain's chosen
// Great House (see ./engine/houses.ts), null until they pick one.
export type HouseId = "jade_pavilion" | "vermilion_gate" | "golden_lotus";

export type CaptainLegacySummary = {
  renownLevel: number;
  renownXP: number;
  voyagesCompleted: number;
  seaMasterCrowns: number;
  bestScore: number;
  // How many voyages in a row this captain has finished without going
  // bankrupt. Two screens read it: the profile card prints it, and the
  // Difficulty Advisor suggests moving up a tier once it reaches three.
  consecutiveSolventVoyages: number;
  meritIds: string[];
  statsByDifficulty: StatsByDifficulty;
  houseId: HouseId | null;
};

export const DEFAULT_LEGACY_SUMMARY: CaptainLegacySummary = {
  renownLevel: 1,
  renownXP: 0,
  voyagesCompleted: 0,
  seaMasterCrowns: 0,
  bestScore: 0,
  consecutiveSolventVoyages: 0,
  meritIds: [],
  statsByDifficulty: {},
  houseId: null,
};
