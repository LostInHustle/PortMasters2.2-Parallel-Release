// POST /api/quick-start: the signed in check in front of the Quick Start
// queue.
//
// This route deliberately does not enqueue anybody. The queue is a Map in
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
import { getCurrentUser, unauthorizedResponse } from "@/lib/api-auth";
import { readJson } from "@/lib/api-json";

const Schema = z.object({
  difficulty: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();

  // The body is read the way every other write route reads it, so a
  // request that is not JSON is refused here the way it is everywhere
  // else rather than answered as though it had been read. Nothing here
  // needs the body to say more than that, and the schema's fields are
  // all optional because the route does not read the difficulty: the
  // pairing happens over the socket, so the body's only job is to be
  // well formed.
  const body = await readJson(req, Schema);
  if (!body.ok) return body.response;

  // No database work here: the queue lives in the realtime layer's
  // memory so two captains hitting the button at the same time get paired
  // immediately by the same process that will broadcast the match. The
  // frontend subscribes to the `quickstart:matched` socket event and
  // navigates into the new harbor on receipt.
  return NextResponse.json({ queued: true });
}
