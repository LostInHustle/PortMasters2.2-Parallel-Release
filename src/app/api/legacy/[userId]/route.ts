// GET /api/legacy/[userId]: another captain's public Captain's Legacy
// summary (Renown level and XP, lifetime voyages, Sea Master crowns,
// best score, Great House pledge). Deliberately not room scoped, same as
// the DM history route this mirrors: Renown is an account wide, cross
// room stat, and none of these fields are sensitive, so any signed in
// captain can look up any other captain's standing, the same way a
// public game profile works. Still requires being signed in, just not
// shared membership. The check in state stays private to the owner.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/api-auth";
import {
  DEFAULT_LEGACY_SUMMARY,
  parseStatsByDifficulty,
  type CaptainLegacySummary,
  type HouseId,
} from "@/lib/game/legacy";

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId } = await params;

  const other = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!other)
    return NextResponse.json({ error: "Captain not found" }, { status: 404 });

  const legacy = await db.captainLegacy.findUnique({ where: { userId } });
  const merits = await db.captainMerit.findMany({
    where: { userId },
    select: { meritId: true },
  });
  const summary: CaptainLegacySummary = legacy
    ? {
        renownLevel: legacy.renownLevel,
        renownXP: legacy.renownXP,
        voyagesCompleted: legacy.voyagesCompleted,
        seaMasterCrowns: legacy.seaMasterCrowns,
        bestScore: legacy.bestScore,
        consecutiveSolventVoyages: legacy.consecutiveSolventVoyages,
        meritIds: merits.map((m) => m.meritId),
        statsByDifficulty: parseStatsByDifficulty(legacy.statsByDifficulty),
        houseId: normalizeHouseId(legacy.houseId),
      }
    : DEFAULT_LEGACY_SUMMARY;

  return NextResponse.json({ legacy: summary });
}
