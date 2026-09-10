// =====================================================================
// PortMasters 2.2 Parallel Release: Daily Check-In
// A position based weekly reward cycle tied to a captain's account, not
// any single room. Pure functions only (no React, no Prisma), so both the
// client (the lobby widget) and the server (the /api/check-in route) can
// share the exact same day math and reward table.
//
// The cycle deliberately is NOT a streak. Progress advances by exactly one
// each time a captain actually claims, and never resets on a missed day.
// A captain who skips a week simply resumes on whatever day they were on.
// The only reset is the automatic wrap back to Day 1 after Day 7 is
// claimed. "One claim per day" is enforced by the UTC calendar date, so a
// second claim on the same date is rejected.
// =====================================================================

// Reward for each day of the cycle, in Renown XP. Index 0 is Day 1. These
// feed the same Renown ladder a voyage's Reputation does (see
// src/lib/game/legacy.ts), so a week of check ins is a few early levels and
// a rounding error near the top of the curve.
const CHECK_IN_XP_REWARDS = [20, 30, 40, 50, 60, 80, 150] as const;
const CHECK_IN_CYCLE_LENGTH = CHECK_IN_XP_REWARDS.length; // 7

// Renown XP granted for a given 1-based day of the cycle. Days outside
// 1..7 clamp into range rather than returning undefined, so a corrupt or
// out of range stored count can never hand out an undefined reward.
function checkInRewardForDay(day: number): number {
  const idx = Math.min(CHECK_IN_CYCLE_LENGTH, Math.max(1, Math.floor(day))) - 1;
  return CHECK_IN_XP_REWARDS[idx];
}

// The UTC calendar date as a stable "YYYY MM DD" key. Using UTC (not the
// server's local zone) keeps the day boundary identical for every captain
// regardless of where they or the server sit, and makes the stored key
// trivially comparable as a plain string.
export function utcDayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

// The persisted half of a captain's check-in: how many days of the current
// cycle they have already claimed (0..6, wrapping to 0 the instant Day 7 is
// claimed) and the UTC date key of their most recent claim. Mirrors the two
// columns added to the CaptainLegacy table.
export type CheckInState = {
  checkInCount: number;
  lastCheckInDate: string | null;
};

// Everything the lobby widget needs to render the seven tiles and the claim
// button, derived from the persisted state plus today's date.
export type CheckInStatus = {
  // 1-based day the captain is currently on: the tile to highlight and the
  // reward the next claim will grant.
  currentDay: number;
  // How many tiles at the start of the cycle are already claimed (0..6).
  claimedThisCycle: number;
  // False once today's claim is spent, until the UTC date rolls over.
  canClaimToday: boolean;
  // The full reward table, so the widget never hard codes the values.
  rewards: number[];
  lastCheckInDate: string | null;
};

// A defensive read of the stored count: anything out of the 0..6 range
// (missing column, hand edited row, a future cycle length change) folds
// back into a valid cycle position instead of throwing off every tile.
function normalizeCount(count: number): number {
  if (!Number.isFinite(count)) return 0;
  return (
    ((Math.floor(count) % CHECK_IN_CYCLE_LENGTH) + CHECK_IN_CYCLE_LENGTH) %
    CHECK_IN_CYCLE_LENGTH
  );
}

export function checkInStatus(
  state: CheckInState,
  today: string = utcDayKey(),
): CheckInStatus {
  const claimedThisCycle = normalizeCount(state.checkInCount);
  return {
    currentDay: claimedThisCycle + 1,
    claimedThisCycle,
    canClaimToday: state.lastCheckInDate !== today,
    rewards: [...CHECK_IN_XP_REWARDS],
    lastCheckInDate: state.lastCheckInDate,
  };
}

// The result of a successful claim: the day that was claimed (1..7), the XP
// it granted, and the state to persist. Returns null when the claim is a
// no op because today's date was already claimed, so the caller can report
// "already claimed" without a second guard of its own.
type CheckInResult = { day: number; xp: number; next: CheckInState };

export function applyCheckIn(
  state: CheckInState,
  today: string = utcDayKey(),
): CheckInResult | null {
  if (state.lastCheckInDate === today) return null;
  const day = normalizeCount(state.checkInCount) + 1; // 1..7
  const xp = checkInRewardForDay(day);
  // day % 7 wraps Day 7 back to 0, so the next claim starts a fresh cycle
  // at Day 1. Every other day just advances by one.
  const next: CheckInState = {
    checkInCount: day % CHECK_IN_CYCLE_LENGTH,
    lastCheckInDate: today,
  };
  return { day, xp, next };
}
