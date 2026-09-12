// POST /api/house: pledge to (or switch to) a Great House. The pledge is
// account level and persists across voyages; it only takes effect on the
// next fresh voyage start. Switching costs nothing on purpose, so a
// captain can follow whatever House suits the next voyage they sail.
//
// Write only. The standings a captain reads before choosing live at
// /api/houses/standings, which serves the Lobby's picker; this route used
// to answer a GET as well, duplicating that read for a caller that never
// arrived.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/api-auth";

const PledgeSchema = z.object({
  houseId: z.enum(["jade_pavilion", "vermilion_gate", "golden_lotus"]),
});

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
  const parsed = PledgeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }
  const houseId = parsed.data.houseId;

  // Upsert so a brand new captain can pledge before they have any other
  // legacy row written. Switching an existing pledge just overwrites the
  // field; nothing else on the row moves.
  await db.captainLegacy.upsert({
    where: { userId: user.id },
    create: { userId: user.id, houseId },
    update: { houseId },
  });

  return NextResponse.json({ houseId });
}
