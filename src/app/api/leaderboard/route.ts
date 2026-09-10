// GET /api/leaderboard: Returns the top captains by various metrics.
// Reads all CaptainLegacy rows, joins with the User table for display
// names and avatar hues, sorts by the requested metric, and returns
// the top 50. Requires authentication but is not room scoped.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/api-auth";
import { parseStatsByDifficulty, type HouseId } from "@/lib/game/legacy";

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

export async function GET() {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db.captainLegacy.findMany({
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarHue: true,
        },
      },
    },
    orderBy: {
      renownXP: "desc",
    },
    take: 100,
  });

  const entries = rows.map((r) => {
    const stats = parseStatsByDifficulty(r.statsByDifficulty);
    const totalCrowns =
      (stats.fair_winds?.crowns ?? 0) +
      (stats.open_waters?.crowns ?? 0) +
      (stats.monsoon?.crowns ?? 0);
    return {
      userId: r.userId,
      displayName: r.user.displayName,
      username: r.user.username,
      avatarHue: r.user.avatarHue,
      renownLevel: r.renownLevel,
      renownXP: r.renownXP,
      voyagesCompleted: r.voyagesCompleted,
      seaMasterCrowns: r.seaMasterCrowns,
      bestScore: r.bestScore,
      consecutiveSolventVoyages: r.consecutiveSolventVoyages,
      houseId: normalizeHouseId(r.houseId),
    };
  });

  return NextResponse.json({ leaderboard: entries });
}
