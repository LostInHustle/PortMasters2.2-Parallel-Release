// GET /api/house: the current captain's Great House pledge, plus the
// harbor wide standings for every House so the Lobby's picker can show
// crowns, voyages and best score alongside the captain's own choice.
// POST /api/house: pledge to (or switch to) a Great House. The pledge is
// account level and persists across voyages; it only takes effect on the
// next fresh voyage start. Switching costs nothing on purpose, so a
// captain can follow whatever House suits the next voyage they sail.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

// Aggregates the per House totals from every CaptainLegacy row that has
// pledged to that House. Captains without a pledge (houseId null) are
// deliberately not folded into any House's totals.
async function buildStandings(): Promise<HouseStanding[]> {
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

  return HOUSES.map((h) => {
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
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const legacy = await db.captainLegacy.findUnique({
    where: { userId: user.id },
    select: { houseId: true },
  });
  const myHouseId = normalizeHouseId(legacy?.houseId ?? null);

  const standings = await buildStandings();
  return NextResponse.json({ myHouseId, standings });
}

const PledgeSchema = z.object({
  houseId: z.enum(["jade_pavilion", "vermilion_gate", "golden_lotus"]),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = PledgeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const houseId = parsed.data.houseId;

  // Upsert so a brand new captain can pledge before they have any other
  // legacy row written. Switching an existing pledge just overwrites the
  // field; nothing else on the row moves.
  await db.captainLegacy.upsert({
    where: { userId: user.id },
    create: { userId: user.id, houseId },
    update: { houseId },
  });

  return NextResponse.json({ houseId });
}
