// GET /api/chronicle/[voyageId]: a single voyage chronicle by id.
// 404 if the chronicle doesn't exist or belongs to another captain, so
// the lookup stays scoped to the viewer's own history.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/api-auth";
import { normalizeDifficulty, type Difficulty } from "@/lib/game/difficulty";
import type { VoyageChronicle } from "@/types/realtime";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ voyageId: string }> },
) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { voyageId } = await params;

  const row = await db.voyageChronicle.findUnique({
    where: { id: voyageId },
  });
  if (!row || row.userId !== user.id)
    return NextResponse.json({ error: "Chronicle not found" }, { status: 404 });

  const chronicle: VoyageChronicle = {
    id: row.id,
    roomId: row.roomId,
    voyageEpoch: row.voyageEpoch,
    difficulty: normalizeDifficulty(row.difficulty) as Difficulty,
    rounds: row.rounds,
    peakReputation: row.peakReputation,
    finalReputation: row.finalReputation,
    finalGold: row.finalGold,
    largestTrade: row.largestTrade,
    lendCount: row.lendCount,
    borrowCount: row.borrowCount,
    crowned: row.crowned,
    bankrupt: row.bankrupt,
    merchantRating: row.merchantRating,
    headline: row.headline,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };

  return NextResponse.json({ chronicle });
}
