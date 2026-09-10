// POST /api/quick-start: the signed in check in front of the Quick Start
// queue.
//
// This route deliberately does not enqueue anybody. The queue is a Set in
// the realtime layer's memory, and a route handler runs in the Next.js
// bundle, so it would be looking at a different copy of that module with a
// different and permanently empty queue. The browser does the real work
// over the socket, by emitting `quickstart:join`, and waits for
// `quickstart:matched` (or `quickstart:error`) in reply.
//
// What this route is good for is the one thing the socket cannot do well:
// turning an expired session into a plain 401 the caller can react to
// before opening a socket at all.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/api-auth";

const Schema = z.object({
  difficulty: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  // No database work here: the queue lives in the realtime layer's
  // memory so two captains hitting the button at the same time get paired
  // immediately by the same process that will broadcast the match. The
  // frontend subscribes to the `quickstart:matched` socket event and
  // navigates into the new room on receipt.
  return NextResponse.json({ queued: true });
}
