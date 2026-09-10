// GET /api/chronicle: the current user's voyage chronicles, newest first.
// Each chronicle is the prose recap of a finished voyage, written by the
// realtime layer at voyage conclusion.
//
// POST /api/chronicle: an opt in save for a voyage chronicle. The realtime
// layer auto writes a chronicle for every finisher at voyage end
// (see maybeConcludeVoyage in src/server/realtime/conclusion.ts), so
// this endpoint is normally a no op: it looks up the already written row
// for this captain and this room and returns it. The opt in exists for the
// case the auto write raced the user's tab close or never fired (a forged
// finisher, a save that landed after the conclusion loop): the captain can
// still pin the voyage to their Legacy by checking the box on the Endgame
// screen, and this endpoint rebuilds the chronicle from their saved game
// state and writes the missing row. Idempotent: a second POST returns the
// same row, never a duplicate.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/api-auth";
import {
  normalizeDifficulty,
  roundsFor,
  type Difficulty,
} from "@/lib/game/difficulty";
import { buildChronicle, merchantRatingForScore } from "@/lib/game/engine";
import type { VoyageChronicle } from "@/types/realtime";
import { roomMemberIds } from "@/lib/rooms";

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

// Mirrors extractChronicleExtras in src/server/realtime/conclusion.ts so
// a chronicle rebuilt here matches what the auto write would have produced.
// peakReputation falls back to the final score (the engine does not store a
// separate peak), largestTrade stays zero (no per trade ledger on the saved
// state), and the lend/borrow counts are the outstanding loan arrays at
// save time, which is the same defensive read the conclusion loop uses.
function extractChronicleExtras(
  rawData: string | null,
  fallbackReputation: number,
): {
  peakReputation: number;
  largestTrade: number;
  lendCount: number;
  borrowCount: number;
} {
  if (!rawData) {
    return {
      peakReputation: fallbackReputation,
      largestTrade: 0,
      lendCount: 0,
      borrowCount: 0,
    };
  }
  try {
    const data = JSON.parse(rawData) as Record<string, unknown>;
    return {
      peakReputation:
        typeof data.score === "number" && Number.isFinite(data.score)
          ? data.score
          : fallbackReputation,
      largestTrade: 0,
      lendCount: Array.isArray(data.loansGiven) ? data.loansGiven.length : 0,
      borrowCount: Array.isArray(data.debts) ? data.debts.length : 0,
    };
  } catch {
    return {
      peakReputation: fallbackReputation,
      largestTrade: 0,
      lendCount: 0,
      borrowCount: 0,
    };
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { roomId?: string } = {};
  try {
    body = (await req.json()) as { roomId?: string };
  } catch {
    body = {};
  }
  const roomId = body.roomId;
  if (!roomId || typeof roomId !== "string") {
    return NextResponse.json(
      { error: "A room id is required." },
      { status: 400 },
    );
  }

  // Membership check: a captain can only chronicle a room they sailed in.
  const memberIds = await roomMemberIds(roomId);
  if (!memberIds.includes(user.id)) {
    return NextResponse.json(
      { error: "You are not a member of that harbor." },
      { status: 403 },
    );
  }

  const room = await db.room.findUnique({
    where: { id: roomId },
    select: {
      voyageEpoch: true,
      difficulty: true,
    },
  });
  if (!room) {
    return NextResponse.json(
      { error: "That harbor no longer exists." },
      { status: 404 },
    );
  }

  const difficulty = normalizeDifficulty(room.difficulty);

  // Idempotent: if the auto write already landed, return that row.
  const existing = await db.voyageChronicle.findFirst({
    where: { userId: user.id, roomId, voyageEpoch: room.voyageEpoch },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return NextResponse.json({ chronicle: toChronicle(existing) });
  }

  // Rebuild from the saved game state. The endgame state carries final
  // score, money, the loan arrays, and the difficulty, which is everything
  // buildChronicle needs.
  const gs = await db.gameState.findUnique({
    where: { userId_roomId: { userId: user.id, roomId } },
    select: { data: true },
  });
  if (!gs) {
    return NextResponse.json(
      { error: "No saved voyage found for this harbor." },
      { status: 404 },
    );
  }

  let parsed: {
    score?: number;
    money?: number;
    defaultedDebt?: boolean;
    loansGiven?: unknown[];
    debts?: unknown[];
  } = {};
  try {
    parsed = JSON.parse(gs.data) as typeof parsed;
  } catch {
    parsed = {};
  }
  const finalReputation =
    typeof parsed.score === "number" && Number.isFinite(parsed.score)
      ? parsed.score
      : 0;
  const finalGold =
    typeof parsed.money === "number" && Number.isFinite(parsed.money)
      ? parsed.money
      : 0;
  const bankrupt = Boolean(parsed.defaultedDebt) || finalReputation <= 0;
  const extras = extractChronicleExtras(gs.data, finalReputation);
  const rating = merchantRatingForScore(finalReputation);
  const built = buildChronicle({
    displayName: user.displayName,
    difficulty,
    rounds: roundsFor(difficulty),
    peakReputation: extras.peakReputation,
    finalReputation,
    largestTrade: extras.largestTrade,
    lendCount: extras.lendCount,
    borrowCount: extras.borrowCount,
    crowned: false,
    bankrupt,
    merchantRating: rating.label,
  });

  // create() rather than upsert() because the (userId, roomId, voyageEpoch)
  // tuple is not unique indexed, and a parallel auto write from the mini
  // service could land first. A rare collision throws P2002 and surfaces as
  // a 500; the next render's listChronicles would still show whichever row
  // landed, so the captain never loses the chronicle.
  const row = await db.voyageChronicle.create({
    data: {
      userId: user.id,
      roomId,
      voyageEpoch: room.voyageEpoch,
      difficulty,
      rounds: roundsFor(difficulty),
      peakReputation: extras.peakReputation,
      finalReputation,
      finalGold,
      largestTrade: extras.largestTrade,
      lendCount: extras.lendCount,
      borrowCount: extras.borrowCount,
      crowned: false,
      bankrupt,
      merchantRating: rating.label,
      headline: built.headline,
      body: built.body,
    },
  });

  return NextResponse.json({ chronicle: toChronicle(row) });
}
