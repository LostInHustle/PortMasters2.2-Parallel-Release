// =====================================================================
// PortMasters 2.2 Parallel Release: Captain's Merits
// One time, account wide achievement badges, a third strand of persistent
// progression alongside Renown (see legacy.ts) and Daily Check In (see
// checkin.ts). Pure functions only (no React, no Prisma), so both the
// client (the trophy row in CaptainLegacyCard) and the server (the voyage
// conclusion check in src/server/realtime.ts, the only place a merit is
// ever granted) share the exact same rules for what counts.
//
// Unlike Renown XP and Check In rewards, a merit carries no gameplay
// power of its own, purely bragging rights, so this list can grow freely
// without ever touching the voyage economy.
// =====================================================================
import { MERCHANT_RATINGS } from "./constants";
import { RENOWN_TITLES } from "./legacy";
import { DIFFICULTIES, type Difficulty } from "./difficulty";

const topRating = MERCHANT_RATINGS[0];
const topTitle = RENOWN_TITLES[RENOWN_TITLES.length - 1];
const openWaters = DIFFICULTIES.open_waters;
const monsoon = DIFFICULTIES.monsoon;

// Reputation bar for the hardest tier's endurance badge. Deliberately below the
// top merchant rating (see MERCHANT_RATINGS), since surviving sixteen rounds of
// Monsoon at all is the achievement being recognised here, not out earning
// every other captain.
const EYE_OF_THE_STORM_REPUTATION = 200;

export type MeritId =
  | "first_voyage"
  | "first_crown"
  | "king_of_silk_road"
  | "renown_legend"
  | "iron_hull"
  | "century_club"
  | "open_water_captain"
  | "storm_sovereign"
  | "eye_of_the_storm";

// No icon field here on purpose: this file stays framework agnostic (see
// the header), so the lucide-react icon for each id lives client side
// instead, in the MeritIcon component in src/components/portmasters/shared.tsx.
type MeritDef = { id: MeritId; name: string; desc: string };

// minLevel/minScore below intentionally read from RENOWN_TITLES and
// MERCHANT_RATINGS rather than repeating the numbers, so a future tier
// added to either ladder can't silently leave this list one step behind.
export const MERITS: MeritDef[] = [
  {
    id: "first_voyage",
    name: "First Landfall",
    desc: "Complete your first voyage.",
  },
  {
    id: "first_crown",
    name: "Sea Master",
    desc: "Get crowned Sea Master for the first time.",
  },
  {
    id: "king_of_silk_road",
    name: topRating.label,
    desc: `End a single voyage with ${topRating.minScore}+ Reputation.`,
  },
  {
    id: "renown_legend",
    name: topTitle.title,
    desc: `Reach Renown Level ${topTitle.minLevel}.`,
  },
  {
    id: "iron_hull",
    name: "Iron Hull",
    desc: "Complete three voyages in a row without going bankrupt.",
  },
  { id: "century_club", name: "Century Club", desc: "Complete ten voyages." },
  // Difficulty scoped. These are the only merits tied to a tier, and they are
  // what make choosing rougher waters worth something permanently, alongside
  // the Renown multiplier (see renownXpMultiplier in ./difficulty).
  {
    id: "open_water_captain",
    name: "Open Water Captain",
    desc: `Finish an ${openWaters.name} voyage without going bankrupt.`,
  },
  {
    id: "storm_sovereign",
    name: "Storm Sovereign",
    desc: `Get crowned Sea Master on a ${monsoon.name} voyage.`,
  },
  {
    id: "eye_of_the_storm",
    name: "Eye of the Storm",
    desc: `Finish a ${monsoon.name} voyage with ${EYE_OF_THE_STORM_REPUTATION}+ Reputation.`,
  },
];

export function meritById(id: string): MeritDef | undefined {
  return MERITS.find((m) => m.id === id);
}

// Everything the voyage conclusion check needs to decide which merits a
// captain qualifies for, gathered into one plain object so the rule set
// itself stays a pure function (see maybeConcludeVoyage in
// src/server/realtime.ts for where each field comes from). All the
// "new" fields already include this voyage's own contribution, since the
// caller has usually just computed them anyway for Renown.
type MeritEvalInput = {
  newVoyagesCompleted: number;
  crowned: boolean;
  priorSeaMasterCrowns: number;
  reputation: number;
  newRenownLevel: number;
  consecutiveSolventVoyages: number;
  // The tier this voyage was sailed on, and whether it ended in bankruptcy,
  // for the difficulty scoped merits below.
  difficulty: Difficulty;
  bankrupt: boolean;
};

const IRON_HULL_STREAK = 3;
const CENTURY_CLUB_VOYAGES = 10;

// Every merit this outcome currently qualifies for, not just the ones
// newly crossed this voyage. The caller diffs the result against
// whatever merit ids the account already has on file to find what's
// actually new, the same shape renownProgress and checkInStatus already
// use elsewhere: derive the full current status from plain state, let
// the caller work out the delta.
export function qualifyingMerits(input: MeritEvalInput): MeritId[] {
  const earned: MeritId[] = [];
  if (input.newVoyagesCompleted >= 1) earned.push("first_voyage");
  if (input.crowned || input.priorSeaMasterCrowns > 0)
    earned.push("first_crown");
  if (input.reputation >= topRating.minScore) earned.push("king_of_silk_road");
  if (input.newRenownLevel >= topTitle.minLevel) earned.push("renown_legend");
  if (input.consecutiveSolventVoyages >= IRON_HULL_STREAK)
    earned.push("iron_hull");
  if (input.newVoyagesCompleted >= CENTURY_CLUB_VOYAGES)
    earned.push("century_club");
  // Difficulty scoped. Judged on the voyage that just ended rather than on
  // history, since the account carries no record of which tier a past crown
  // was won on. That is fine: the caller only ever adds merits it doesn't
  // already have, so one qualifying voyage banks the badge permanently.
  if (input.difficulty === "open_waters" && !input.bankrupt)
    earned.push("open_water_captain");
  if (input.difficulty === "monsoon" && input.crowned)
    earned.push("storm_sovereign");
  if (
    input.difficulty === "monsoon" &&
    input.reputation >= EYE_OF_THE_STORM_REPUTATION
  )
    earned.push("eye_of_the_storm");
  return earned;
}
