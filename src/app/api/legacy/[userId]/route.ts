// GET /api/legacy/[userId]: another captain's public Captain's Legacy
// summary (Renown level and XP, lifetime voyages, Sea Master crowns,
// best Reputation, Great House pledge). Deliberately not harbor scoped,
// same as the DM history route this mirrors: Renown is an account wide, cross
// harbor stat, and none of these fields are sensitive, so any signed in
// captain can look up any other captain's standing, the same way a
// public game profile works. Still requires being signed in, just not
// shared membership. The check in state stays private to the owner.
import { NextRequest, NextResponse } from "next/server";
import { CAPTAIN_NOT_FOUND } from "@/lib/api";
import { db } from "@/lib/db";
import {
  getCurrentUser,
  requestLocale,
  unauthorizedResponse,
} from "@/lib/api-auth";
import { legacySummaryFor } from "@/lib/captain-legacy";
import { tFor } from "@/lib/game/i18n";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const { userId } = await params;

  const other = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!other) {
    const locale = await requestLocale();
    return NextResponse.json(
      { error: tFor(locale, CAPTAIN_NOT_FOUND) },
      { status: 404 },
    );
  }

  const { summary } = await legacySummaryFor(userId);

  return NextResponse.json({ legacy: summary });
}
