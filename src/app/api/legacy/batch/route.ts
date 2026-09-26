// POST /api/legacy/batch: Captain's Legacy summaries for a batch of user
// ids at once. Same "signed in, not room scoped, nothing sensitive"
// policy as GET /api/legacy/[userId] (see that route for the reasoning);
// this just exists so a screen showing many captains at once, like the
// Lobby's "Captains Online" list, doesn't need one request per captain.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/api-auth";
import { legacySummariesFor } from "@/lib/captain-legacy";
import { readJson } from "@/lib/api-json";

const BatchSchema = z.object({ userIds: z.array(z.string()).max(200) });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJson(req, BatchSchema);
  if (!body.ok) return body.response;

  const ids = [...new Set(body.data.userIds)];
  const legacies = await legacySummariesFor(ids);

  return NextResponse.json({ legacies });
}
