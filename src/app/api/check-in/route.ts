// POST /api/check-in: claim today's Daily Check In reward for the current
// user. One claim per UTC day; grants escalating Renown XP and advances the
// 7-day cycle (see src/lib/game/checkin.ts). Together with the voyage
// conclusion write in the realtime layer, this is the only place a
// CaptainLegacy row is ever written.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/api-auth";
import {
  DEFAULT_LEGACY_SUMMARY,
  levelForRenownXP,
  parseStatsByDifficulty,
  type CaptainLegacySummary,
  type HouseId,
} from "@/lib/game/legacy";
import {
  applyCheckIn,
  checkInStatus,
  utcDayKey,
  type CheckInState,
} from "@/lib/game/checkin";

type LegacyRow = {
  renownLevel: number;
  renownXP: number;
  voyagesCompleted: number;
  seaMasterCrowns: number;
  bestScore: number;
  consecutiveSolventVoyages: number;
  statsByDifficulty: string;
  checkInCount: number;
  lastCheckInDate: string | null;
  houseId: string | null;
};

// Coerces a stored houseId string (or null) into the HouseId union, or
// null. Anything stale or hand edited falls back to null rather than
// poisoning the summary with an unknown id.
function normalizeHouseId(raw: string | null): HouseId | null {
  if (
    raw === "jade_pavilion" ||
    raw === "vermilion_gate" ||
    raw === "golden_lotus"
  ) {
    return raw;
  }
  return null;
}

// meritIds is threaded in rather than queried here, since every call in
// this file is for the one signed in user and a check-in claim never
// changes their merits, so one query up front in POST covers all of them.
function toSummary(
  row: LegacyRow | null,
  meritIds: string[],
): CaptainLegacySummary {
  if (!row) return DEFAULT_LEGACY_SUMMARY;
  return {
    renownLevel: row.renownLevel,
    renownXP: row.renownXP,
    voyagesCompleted: row.voyagesCompleted,
    seaMasterCrowns: row.seaMasterCrowns,
    bestScore: row.bestScore,
    consecutiveSolventVoyages: row.consecutiveSolventVoyages,
    meritIds,
    statsByDifficulty: parseStatsByDifficulty(row.statsByDifficulty),
    houseId: normalizeHouseId(row.houseId),
  };
}

function stateOf(row: LegacyRow | null): CheckInState {
  return {
    checkInCount: row?.checkInCount ?? 0,
    lastCheckInDate: row?.lastCheckInDate ?? null,
  };
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = utcDayKey();
  const prior = (await db.captainLegacy.findUnique({
    where: { userId: user.id },
  })) as LegacyRow | null;
  const meritRows = await db.captainMerit.findMany({
    where: { userId: user.id },
    select: { meritId: true },
  });
  const meritIds = meritRows.map((m) => m.meritId);

  const result = applyCheckIn(stateOf(prior), today);
  if (!result) {
    // Already claimed today: report the current state so the client can just
    // render "come back tomorrow" rather than treat it as an error.
    return NextResponse.json({
      claimed: false,
      legacy: toSummary(prior, meritIds),
      checkIn: checkInStatus(stateOf(prior), today),
    });
  }

  const newXP = (prior?.renownXP ?? 0) + result.xp;
  const newLevel = levelForRenownXP(newXP);
  const priorLevel = prior?.renownLevel ?? 1;

  // Guarded write: the update only lands while the row still shows a date
  // other than today (or none yet), so two requests racing on the same day
  // can grant the reward at most once. A row with a null date (never
  // checked in) has to be matched explicitly, since SQL date != today is
  // not true for NULL.
  const guarded = await db.captainLegacy.updateMany({
    where: {
      userId: user.id,
      OR: [{ lastCheckInDate: null }, { NOT: { lastCheckInDate: today } }],
    },
    data: {
      renownXP: newXP,
      renownLevel: newLevel,
      checkInCount: result.next.checkInCount,
      lastCheckInDate: result.next.lastCheckInDate,
    },
  });

  if (guarded.count === 0) {
    if (!prior) {
      // No row existed on read: this is the account's very first write.
      try {
        await db.captainLegacy.create({
          data: {
            userId: user.id,
            renownXP: newXP,
            renownLevel: newLevel,
            checkInCount: result.next.checkInCount,
            lastCheckInDate: result.next.lastCheckInDate,
          },
        });
        return NextResponse.json({
          claimed: true,
          day: result.day,
          xpGained: result.xp,
          leveledUp: newLevel > priorLevel,
          legacy: {
            ...DEFAULT_LEGACY_SUMMARY,
            renownXP: newXP,
            renownLevel: newLevel,
          },
          checkIn: checkInStatus(result.next, today),
        });
      } catch {
        // Another request created the row first. Fall through to report the
        // now current (already claimed) state.
      }
    }
    const fresh = (await db.captainLegacy.findUnique({
      where: { userId: user.id },
    })) as LegacyRow | null;
    return NextResponse.json({
      claimed: false,
      legacy: toSummary(fresh, meritIds),
      checkIn: checkInStatus(stateOf(fresh), today),
    });
  }

  return NextResponse.json({
    claimed: true,
    day: result.day,
    xpGained: result.xp,
    leveledUp: newLevel > priorLevel,
    legacy: {
      ...toSummary(prior, meritIds),
      renownXP: newXP,
      renownLevel: newLevel,
    },
    checkIn: checkInStatus(result.next, today),
  });
}
