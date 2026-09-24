// =====================================================================
// PortMasters 2.2 Parallel Release: Captain's Legacy reads
//
// The two rows a Legacy summary is built from, read together. Three API
// routes served that summary, each reading the same pair of tables by
// hand, and one account answering two ways is exactly the kind of drift
// nothing catches: the response is a plain JSON blob whichever route
// sent it, and no compiler sees the difference.
//
// Plain database logic with no Next specific imports, the same shape
// ./rooms.ts has and for the same reason: the realtime layer can reach
// it too.
// =====================================================================
import { db } from "./db";
import { toLegacySummary, type CaptainLegacySummary } from "./game/legacy";

// One captain's summary, handed back beside the row it came from,
// because the route that serves a captain their own summary also reads
// the check in fields off that same row and would otherwise have to
// fetch it a second time.
export async function legacySummaryFor(userId: string) {
  const [legacy, merits] = await Promise.all([
    db.captainLegacy.findUnique({ where: { userId } }),
    db.captainMerit.findMany({
      where: { userId },
      select: { meritId: true },
    }),
  ]);
  return {
    legacy,
    summary: toLegacySummary(
      legacy,
      merits.map((m) => m.meritId),
    ),
  };
}

// The batch form, for a screen drawing many captains at once (the
// Lobby's online list, the leaderboard). Deliberately two queries for
// the whole list rather than legacySummaryFor in a loop: the point of
// this one is that asking after two hundred captains costs the same as
// asking after one.
//
// Every id asked about comes back, including the ids of captains who
// have never finished a voyage and so have no row: those get the default
// summary, since a list that dropped them would be a list that silently
// omitted most of the harbor.
export async function legacySummariesFor(
  userIds: string[],
): Promise<Record<string, CaptainLegacySummary>> {
  const [rows, meritRows] = await Promise.all([
    db.captainLegacy.findMany({ where: { userId: { in: userIds } } }),
    db.captainMerit.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, meritId: true },
    }),
  ]);

  const byUserId = new Map(rows.map((r) => [r.userId, r]));
  const meritsByUserId = new Map<string, string[]>();
  for (const m of meritRows) {
    const list = meritsByUserId.get(m.userId);
    if (list) list.push(m.meritId);
    else meritsByUserId.set(m.userId, [m.meritId]);
  }

  const legacies: Record<string, CaptainLegacySummary> = {};
  for (const id of userIds) {
    legacies[id] = toLegacySummary(
      byUserId.get(id) ?? null,
      meritsByUserId.get(id) ?? [],
    );
  }
  return legacies;
}
