// GET /api/rivals: the current captain's head to head lines, one per
// partner they have ever sailed against. Each CaptainRival row records
// one meeting; this route groups them by partner and folds them with
// `rivalSummary` from the engine, projecting the outcome so the
// position "a" is always the viewer. The partner's PublicUser is
// included so the Legacy card can render a name alongside the counts.
import { NextResponse } from "next/server";
import { db, PUBLIC_USER_SELECT } from "@/lib/db";
import { getCurrentUser } from "@/lib/api-auth";
import { rivalSummary, type RivalOutcome } from "@/lib/game/engine";
import type { RivalEntry, PublicUser } from "@/types/realtime";

export async function GET() {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.captainRival.findMany({
    where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
    orderBy: { createdAt: "desc" },
  });

  // Group outcomes by partner id, flipping a/b so the viewer is always
  // position "a" before folding. That keeps rivalSummary's aWins as the
  // viewer's wins and bWins as the partner's, regardless of which side
  // of the row the viewer sat on.
  const byPartner = new Map<string, RivalOutcome[]>();
  for (const row of rows) {
    const partnerId = row.userAId === user.id ? row.userBId : row.userAId;
    const outcome: RivalOutcome =
      row.userAId === user.id
        ? { aWon: row.aWon, bWon: row.bWon, tie: row.tie }
        : { aWon: row.bWon, bWon: row.aWon, tie: row.tie };
    const list = byPartner.get(partnerId);
    if (list) list.push(outcome);
    else byPartner.set(partnerId, [outcome]);
  }

  const partnerIds = [...byPartner.keys()];
  const partners = await db.user.findMany({
    where: { id: { in: partnerIds } },
    select: PUBLIC_USER_SELECT,
  });
  const partnerById = new Map<string, PublicUser>(
    partners.map((p) => [p.id, p]),
  );

  const rivals: RivalEntry[] = [];
  for (const [partnerId, outcomes] of byPartner) {
    const partner = partnerById.get(partnerId);
    if (!partner) continue;
    const summary = rivalSummary(outcomes);
    rivals.push({
      partner,
      meetings: summary.meetings,
      wins: summary.aWins,
      losses: summary.bWins,
      ties: summary.ties,
    });
  }

  // Newest meetings first: byPartner preserved insertion order from the
  // createdAt desc query, so the order is already correct.
  return NextResponse.json({ rivals });
}
