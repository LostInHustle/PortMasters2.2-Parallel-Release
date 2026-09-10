// GET /api/houses/standings: the aggregate Great House standings, plus
// the current captain's own pledge. For each House, the total voyages,
// total Sea Master crowns, and best single voyage Reputation across
// every member who has pledged to that House. Captains without a pledge
// are not folded into any House's totals.
//
// Mirrors the shape of GET /api/house so the frontend's
// `getHouseStandings` wrapper reads both the standings and the viewer's
// own pledge in one request.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/api-auth";
import { HOUSES } from "@/lib/game/engine";
import type { HouseId } from "@/lib/game/legacy";
import type { HouseStanding } from "@/types/realtime";

const HOUSE_IDS: HouseId[] = [
  "jade_pavilion",
  "vermilion_gate",
  "golden_lotus",
];

function normalizeHouseId(raw: string | null): HouseId | null {
  return HOUSE_IDS.includes(raw as HouseId) ? (raw as HouseId) : null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.captainLegacy.findMany({
    where: { houseId: { not: null } },
    select: {
      houseId: true,
      voyagesCompleted: true,
      seaMasterCrowns: true,
      bestScore: true,
    },
  });

  const totals = new Map<
    HouseId,
    { voyages: number; crowns: number; bestScore: number }
  >();
  for (const id of HOUSE_IDS)
    totals.set(id, { voyages: 0, crowns: 0, bestScore: 0 });
  for (const row of rows) {
    const id = normalizeHouseId(row.houseId);
    if (!id) continue;
    const t = totals.get(id)!;
    t.voyages += row.voyagesCompleted;
    t.crowns += row.seaMasterCrowns;
    t.bestScore = Math.max(t.bestScore, row.bestScore);
  }

  const standings: HouseStanding[] = HOUSES.map((h) => {
    const t = totals.get(h.id)!;
    return {
      houseId: h.id,
      name: h.name,
      icon: h.icon,
      motto: h.motto,
      perk: h.perk,
      crowns: t.crowns,
      voyages: t.voyages,
      bestScore: t.bestScore,
    };
  });

  const legacy = await db.captainLegacy.findUnique({
    where: { userId: user.id },
    select: { houseId: true },
  });
  const myHouseId = normalizeHouseId(legacy?.houseId ?? null);

  return NextResponse.json({ standings, myHouseId });
}
