// GET /api/chronicle: the current user's voyage chronicles, newest first.
// Each chronicle is the prose recap of a finished voyage, written by the
// realtime layer at voyage conclusion.
//
// Read only. This route used to carry a POST as well, a manual opt in save
// for a checkbox on the Endgame screen that rebuilt a missing chronicle
// from the saved game state. Nothing ever called it, and it had been
// redundant since the realtime layer started auto writing a chronicle for
// every finisher (see maybeConcludeVoyage in src/server/realtime/conclusion.ts),
// so the write path is gone and that auto write is the only one there is.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/api-auth";
import { normalizeDifficulty, type Difficulty } from "@/lib/game/difficulty";
import type { VoyageChronicle } from "@/types/realtime";

function toChronicle(row: {
  id: string;
  roomId: string;
  voyageEpoch: number;
  difficulty: string;
  rounds: number;
  peakReputation: number;
  finalReputation: number;
  finalGold: number;
  largestTrade: number;
  lendCount: number;
  borrowCount: number;
  crowned: boolean;
  bankrupt: boolean;
  merchantRating: string;
  headline: string;
  body: string;
  createdAt: Date;
}): VoyageChronicle {
  return {
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
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.voyageChronicle.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ chronicles: rows.map(toChronicle) });
}
