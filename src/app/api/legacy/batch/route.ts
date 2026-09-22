// POST /api/legacy/batch: Captain's Legacy summaries for a batch of user
// ids at once. Same "signed in, not room scoped, nothing sensitive"
// policy as GET /api/legacy/[userId] (see that route for the reasoning);
// this just exists so a screen showing many captains at once, like the
// Lobby's "Captains Online" list, doesn't need one request per captain.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/api-auth";
import { toLegacySummary, type CaptainLegacySummary } from "@/lib/game/legacy";

const BatchSchema = z.object({ userIds: z.array(z.string()).max(200) });

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
    legacies[id] = toLegacySummary(
      byUserId.get(id) ?? null,
      meritsByUserId.get(id) ?? [],
    );
  }

  return NextResponse.json({ legacies });
}
