// GET /api/leaderboard: the captains ranked by Renown.
//
// Reads the CaptainLegacy rows, joins the User table for the display names
// and avatar hues, and returns them highest Renown XP first. Requires
// authentication but is not harbor scoped.
import { NextResponse } from "next/server";
import { PUBLIC_USER_SELECT, db } from "@/lib/db";
import { getCurrentUser, unauthorizedResponse } from "@/lib/api-auth";
import { normalizeHouseId } from "@/lib/game/legacy";

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return unauthorizedResponse();

  const rows = await db.captainLegacy.findMany({
    include: {
      user: {
        select: PUBLIC_USER_SELECT,
      },
    },
    orderBy: {
      renownXP: "desc",
    },
    take: 100,
  });

  // Every column the board prints, and nothing else.
  const entries = rows.map((r) => ({
    userId: r.userId,
    displayName: r.user.displayName,
    username: r.user.username,
    avatarHue: r.user.avatarHue,
    renownLevel: r.renownLevel,
    renownXP: r.renownXP,
    voyagesCompleted: r.voyagesCompleted,
    seaMasterCrowns: r.seaMasterCrowns,
    bestReputation: r.bestReputation,
    consecutiveSolventVoyages: r.consecutiveSolventVoyages,
    houseId: normalizeHouseId(r.houseId),
  }));

  return NextResponse.json({ leaderboard: entries });
}
