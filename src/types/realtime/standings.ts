// =====================================================================
// PortMasters 2.2 Parallel Release: rivals, houses and the leaderboard.
//
// Rivals, houses and the leaderboard.
//
// Three surfaces that count captains against each other rather than inside one
// harbor: the head to head line, a Great House's standing, and the board the
// lobby's ladder is drawn from.
// =====================================================================

import type { HouseId } from "@/lib/game/legacy";
import type { PublicUser } from "./presence";

// A captain vs captain rivalry head to head line, returned by
// /api/rivals. Mirrors the engine's RivalSummary plus the partner's
// public identity so the Legacy card can render a name alongside the
// counts.
export type RivalEntry = {
  partner: PublicUser;
  meetings: number;
  wins: number;
  losses: number;
  ties: number;
};

// A Great House standing row, returned by /api/houses/standings. The
// houseId is the engine union, kept as HouseId here so the Lobby's
// pledge selector can stay typed against it.
export type HouseStanding = {
  houseId: HouseId;
  name: string;
  icon: string;
  motto: string;
  perk: string;
  crowns: number;
  voyages: number;
  bestScore: number;
};

export type LeaderboardEntry = {
  userId: string;
  displayName: string;
  username: string;
  avatarHue: number;
  renownLevel: number;
  renownXP: number;
  voyagesCompleted: number;
  seaMasterCrowns: number;
  bestScore: number;
  consecutiveSolventVoyages: number;
  houseId: HouseId | null;
};
