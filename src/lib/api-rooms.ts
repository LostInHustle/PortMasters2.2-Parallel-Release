// =====================================================================
// PortMasters 2.2 Parallel Release: the shared harbor join answer.
//
// Two routes admit a captain to a harbor: one by the harbor's own code
// and one by its id. They differ in how the harbor is named and in the
// sentence each gives when the name names nothing, and they agree on
// everything else: the row that is read, who may come aboard, and the
// shape the answer takes.
//
// The agreement is the point of the module. A harbor a captain could
// reach by link but not by its own code was a bug this tree had once,
// and the fix was a shared rule rather than a shared intention. Two
// copies of a rule about who may come aboard is one rule too many, and
// the rule itself already lives in one place (see admitToRoom in
// ./rooms). What was left over was the answer, and the answer is what
// this module holds.
//
// The split is the one the other shared route helpers make: the rule
// half is plain database logic that the realtime layer can call too
// (see ./rooms), and the answer half is a NextResponse, which only a
// route can hand back (see ./api-json and ./api-auth).
// =====================================================================
import { NextResponse } from "next/server";
import { db, PUBLIC_USER_SELECT } from "./db";
import { tFor, type Locale } from "./game/i18n";
import { admitToRoom } from "./rooms";

/**
 * The answer a join route gives, for a harbor named one way or another.
 *
 * The two sentences that can differ between the routes are handed in
 * rather than written twice, because they are the two that are genuinely
 * about the naming: a code that names no harbor says so in the code's
 * own terms, and an id that names no harbor says so in the id's. The
 * refusals that follow are the shared rule's own words and are not
 * handed in, because a route that could word them differently is a
 * route that will.
 */
export async function joinHarborResponse(
  where: { id: string } | { code: string },
  userId: string,
  locale: Locale,
  notFound: string,
): Promise<NextResponse> {
  const room = await db.room.findUnique({
    where,
    include: {
      members: true,
      host: {
        select: PUBLIC_USER_SELECT,
      },
    },
  });
  if (!room) {
    return NextResponse.json(
      { error: tFor(locale, notFound) },
      { status: 404 },
    );
  }

  const admitted = await admitToRoom(room, userId);
  if ("error" in admitted) {
    return NextResponse.json(
      { error: tFor(locale, admitted.error) },
      { status: 403 },
    );
  }

  return NextResponse.json({ room: admitted.room });
}
