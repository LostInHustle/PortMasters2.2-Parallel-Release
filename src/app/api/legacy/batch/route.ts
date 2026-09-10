// POST /api/legacy/batch: Captain's Legacy summaries for a batch of user
// ids at once. Same "signed in, not room scoped, nothing sensitive"
// policy as GET /api/legacy/[userId] (see that route for the reasoning);
// this just exists so a screen showing many captains at once, like the
// Lobby's "Captains Online" list, doesn't need one request per captain.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/api-auth";
import {
  DEFAULT_LEGACY_SUMMARY,
  parseStatsByDifficulty,
  type CaptainLegacySummary,
  type HouseId,
} from "@/lib/game/legacy";

const BatchSchema = z.object({ userIds: z.array(z.string()).max(200) });

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
  const parsed = BatchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );

  const ids = [...new Set(parsed.data.userIds)];
  const rows = await db.captainLegacy.findMany({
    where: { userId: { in: ids } },
  });
  const byUserId = new Map(rows.map((r) => [r.userId, r]));

  const meritRows = await db.captainMerit.findMany({
    where: { userId: { in: ids } },
    select: { userId: true, meritId: true },
  });
  const meritsByUserId = new Map<string, string[]>();
  for (const m of meritRows) {
    const list = meritsByUserId.get(m.userId);
    if (list) list.push(m.meritId);
    else meritsByUserId.set(m.userId, [m.meritId]);
  }

  const legacies: Record<string, CaptainLegacySummary> = {};
  for (const id of ids) {
    const row = byUserId.get(id);
    legacies[id] = row
      ? {
          renownLevel: row.renownLevel,
          renownXP: row.renownXP,
          voyagesCompleted: row.voyagesCompleted,
          seaMasterCrowns: row.seaMasterCrowns,
          bestScore: row.bestScore,
          consecutiveSolventVoyages: row.consecutiveSolventVoyages,
          meritIds: meritsByUserId.get(id) ?? [],
          statsByDifficulty: parseStatsByDifficulty(row.statsByDifficulty),
          houseId: normalizeHouseId(row.houseId),
        }
      : DEFAULT_LEGACY_SUMMARY;
  }

  return NextResponse.json({ legacies });
}
