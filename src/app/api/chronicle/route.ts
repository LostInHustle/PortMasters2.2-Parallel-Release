// GET /api/chronicle: the current user's voyage chronicles, newest first.
// Each chronicle is the prose recap of a finished voyage, written by the
// realtime layer at voyage conclusion.
//
// Read only, and the realtime layer is the only writer: it auto writes a
// chronicle for every finisher (see maybeConcludeVoyage in
// src/server/realtime/conclusion.ts).
import { VoyageChronicle } from "@/types/realtime/voyage";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser, unauthorizedResponse } from "@/lib/api-auth";
import { normalizeDifficulty, type Difficulty } from "@/lib/game/difficulty";

// The row as the database holds it. Derived from the wire shape rather than
// written out a second time, so a field added to one cannot be forgotten in
// the other: the two the wire formats differently are the two named here.
type ChronicleRow = Omit<VoyageChronicle, "difficulty" | "createdAt"> & {
  difficulty: string;
  createdAt: Date;
};

function toChronicle(row: ChronicleRow): VoyageChronicle {
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
    marooned: row.marooned,
    merchantRating: row.merchantRating,
    headline: row.headline,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  const rows = await db.voyageChronicle.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ chronicles: rows.map(toChronicle) });
}
