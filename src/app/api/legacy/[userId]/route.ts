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
import { toLegacySummary } from "@/lib/game/legacy";

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
  const summary = toLegacySummary(
    legacy,
    merits.map((m) => m.meritId),
  );

  return NextResponse.json({ legacy: summary });
}
