// =====================================================================
// PortMasters 2.2 Parallel Release: taking the run down again.
//
// The accounts this run signed up, the harbors it opened and the sockets
// it holds are removed here, whether the run passed or threw. The server
// under test keeps its own state, so this talks to the database directly,
// through the same connection the run proved it shared before it created
// anything (see the interlock in ./index.ts).
//
// The captains and the harbor ids arrive as arguments because they are
// nullable until the article that made them has run, and this has to be
// able to read them either way.
// =====================================================================
import { db } from "@/lib/db";
import { failures } from "./harness";
import type { Captain } from "./wire";
import type { SmokeRun } from "./run";

export async function cleanupSuite(
  run: SmokeRun,
  accounts: {
    host: Captain | null;
    guest: Captain | null;
    third: Captain | null;
    roomId: string | null;
    quickStartRoomId: string | null;
  },
): Promise<void> {
  const { host, guest, third, roomId, quickStartRoomId } = accounts;

  for (const socket of run.sockets) {
    socket.removeAllListeners();
    socket.close();
  }

  const ids = [
    host?.id,
    guest?.id,
    third?.id,
    ...run.extraAccounts.map((c) => c.id),
  ].filter((id): id is string => Boolean(id));
  const usernames = [
    host?.username,
    guest?.username,
    third?.username,
    ...run.extraAccounts.map((c) => c.username),
  ].filter((name): name is string => Boolean(name));

  if (run.cleanupIsSafe) {
    try {
      // Order matters: the harbors go first so their memberships are
      // gone before the accounts those memberships point at.
      //
      // Only harbors this run created are deleted. A Quick Start can
      // legitimately seat the two test captains into a harbor that was
      // already open, and that harbor belongs to whoever opened it.
      for (const id of [roomId, quickStartRoomId, ...run.lapRoomIds]) {
        if (id && !run.preExistingRoomIds.has(id)) {
          await db.room.deleteMany({ where: { id } });
        }
      }
      if (ids.length) {
        await db.session.deleteMany({ where: { userId: { in: ids } } });
        await db.user.deleteMany({ where: { id: { in: ids } } });
      }
      // The telemetry rows and the report rows are the two things a
      // deleted harbor does not take with it, and deliberately so: both
      // models carry a bare roomId rather than a foreign key, because
      // both have to outlive the room they describe. The two deletes
      // above have just removed every harbor this run created, so the
      // rows left pointing at a harbor that no longer exists are this
      // run's, and the database is put back the way it was found.
      const roomsLeft = await db.room.findMany({ select: { id: true } });
      const orphaned = roomsLeft.length
        ? {
            where: {
              roomId: { notIn: roomsLeft.map((room) => room.id) },
            },
          }
        : undefined;
      await db.voyageTelemetry.deleteMany(orphaned);
      await db.report.deleteMany(orphaned);
    } catch (err) {
      // Reported, never swallowed: an unnoticed leftover account is
      // exactly what this block exists to prevent.
      console.error("Could not clean up the accounts this run created.", err);
      failures.push("the run's own accounts were left behind");
    }
  } else if (usernames.length) {
    console.error(
      `Left behind on the server: ${usernames.join(", ")}. ` +
        `Delete them from the database the server is using.`,
    );
  }

  await db.$disconnect();
}
