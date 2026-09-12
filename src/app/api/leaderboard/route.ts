// GET /api/leaderboard: the captains ranked by Renown.
//
// Reads the CaptainLegacy rows, joins the User table for the display names
// and avatar hues, and returns them highest Renown XP first. Requires
// authentication but is not room scoped.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/api-auth";
import type { HouseId } from "@/lib/game/legacy";

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

  // Every column the board prints, and nothing else. A `totalCrowns` used
  // to be summed here from parseStatsByDifficulty and then left out of the
  // entry, so the route paid for a parse whose result nothing ever sent.
  const entries = rows.map((r) => ({
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
  }));

  return NextResponse.json({ leaderboard: entries });
}
