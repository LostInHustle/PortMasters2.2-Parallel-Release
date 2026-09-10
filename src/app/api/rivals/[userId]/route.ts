// GET /api/rivals/[userId]: the head to head line between the current
// captain and one named partner. Same shape as a single RivalEntry from
// the list route, scoped to one pair so the Legacy card can render the
// line under a specific captain without filtering the whole list.
import { NextRequest, NextResponse } from "next/server";
import { db, PUBLIC_USER_SELECT } from "@/lib/db";
import { getCurrentUser } from "@/lib/api-auth";
import { rivalSummary, type RivalOutcome } from "@/lib/game/engine";
import type { RivalEntry } from "@/types/realtime";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { userId: partnerId } = await params;

  if (partnerId === user.id) {
    return NextResponse.json(
      { error: "Pick another captain to compare against" },
      { status: 400 },
    );
  }

  const partner = await db.user.findUnique({
    where: { id: partnerId },
    select: PUBLIC_USER_SELECT,
  });
  if (!partner)
    return NextResponse.json({ error: "Captain not found" }, { status: 404 });

  const rows = await db.captainRival.findMany({
    where: {
      OR: [
        { userAId: user.id, userBId: partnerId },
        { userAId: partnerId, userBId: user.id },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  const outcomes: RivalOutcome[] = rows.map((row) =>
    row.userAId === user.id
      ? { aWon: row.aWon, bWon: row.bWon, tie: row.tie }
      : { aWon: row.bWon, bWon: row.aWon, tie: row.tie },
  );
  const summary = rivalSummary(outcomes);

  const rival: RivalEntry = {
    partner,
    meetings: summary.meetings,
    wins: summary.aWins,
    losses: summary.bWins,
    ties: summary.ties,
  };

  return NextResponse.json({ rival });
}
