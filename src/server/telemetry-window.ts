// =====================================================================
// The operator window: the last three hundred voyages of a mode.
//
// [I4: the launch gates, and the three hundred voyage run] One query, in
// one place, so the two surfaces that read the run cannot read different
// runs. Goal I3 put the window inline in the balance route, where it was
// the only reader; goal I4 adds a command line report that has to answer
// the same question about the same voyages, and two implementations of one
// window is how a page and a report start disagreeing about whether the
// mode passed.
//
// The window's size comes from the launch floor rather than from a number
// written here, which is the property worth keeping: a window smaller than
// the floor is a window no run can ever clear, and taking the size from
// LAUNCH_MINIMUM_VOYAGES makes that a compile time impossibility rather
// than a constant somebody has to remember to move in two files.
//
// It reads and writes nothing. The two tables are the finished facts of
// concluded voyages (the telemetry spine and the chronicle), so a captain
// mid voyage cannot be slowed down by an operator opening a page, and the
// chronicle read is limited to exactly the voyages the window kept: one
// window for every number on the page, and no voyage counted twice.
//
// Server only. Nothing in the game's request path imports this module; it
// exists for the admin route and for scripts/gates.ts.
// =====================================================================

import { db } from "@/lib/db";
import type { DashboardInput, DashboardOutcome } from "@/lib/game/dashboard";
import { LAUNCH_MINIMUM_VOYAGES } from "@/lib/game/gates";
import { readStoredRecord, type TelemetryRecord } from "@/lib/game/telemetry";
import type { GameMode } from "@/lib/game/mode";

// The mode the operator surfaces are about. The plan's gates are Ocean
// Gambit's: a Classic voyage has no cards, no bands and no Barge, and
// averaging one into the loop or market numbers would be reading two games
// as one. Typed as GameMode so a renamed mode fails the build rather than
// quietly emptying the window. Not exported: the window is the module's
// one answer, and a caller naming the mode would be reading the query
// rather than the reading.
const OPERATOR_MODE: GameMode = "ocean_gambit";

/**
 * The window as the dashboard reads one: the records of the last
 * LAUNCH_MINIMUM_VOYAGES voyages, the chronicle rows for exactly those
 * voyages, and the count of records that would not read.
 *
 * Handed straight to readDashboard. The reading is the caller's to take,
 * because the route serializes one and the report prints one, and neither
 * should have to remember which window it came from.
 */
export async function readOperatorWindow(): Promise<DashboardInput> {
  const rows = await db.voyageTelemetry.findMany({
    where: { mode: OPERATOR_MODE },
    orderBy: { endedAt: "desc" },
    take: LAUNCH_MINIMUM_VOYAGES,
    select: { roomId: true, voyageEpoch: true, record: true },
  });

  // The records, with the ones that will not read counted rather than
  // dropped silently: a stored blob that fails to parse is a gap in the
  // window, and the reader is handed the number so it can say so. The
  // voyages kept here are the ones the chronicle rows are matched against,
  // so a record that could not be read takes its voyage out of the window
  // rather than leaving half a voyage in it.
  const records: TelemetryRecord[] = [];
  const voyages = new Set<string>();
  let unreadable = 0;
  for (const row of rows) {
    const record = readStoredRecord(row.record);
    if (record === null) {
      unreadable += 1;
      continue;
    }
    records.push(record);
    voyages.add(`${row.roomId}:${row.voyageEpoch}`);
  }

  // The chronicle rows for exactly the voyages in the window: the win
  // verdicts, which the record deliberately does not carry, since a
  // captain's card must never enter a blob that outlives the room. The
  // rooms are queried in one pass and the voyage each row belongs to is
  // matched here rather than by a query, because a room can host several
  // voyages and the epoch is what tells them apart.
  const outcomes: DashboardOutcome[] = [];
  if (voyages.size > 0) {
    const chronicles = await db.voyageChronicle.findMany({
      where: {
        roomId: { in: [...new Set(rows.map((row) => row.roomId))] },
        // Classic writes an empty alignment and no card was dealt there,
        // so there is no band for its rows to land in.
        alignment: { not: "" },
      },
      select: {
        roomId: true,
        voyageEpoch: true,
        alignment: true,
        won: true,
        seats: true,
        bankrupt: true,
      },
    });
    for (const row of chronicles) {
      if (!voyages.has(`${row.roomId}:${row.voyageEpoch}`)) continue;
      outcomes.push({
        alignment: row.alignment,
        won: row.won,
        seats: row.seats,
        bankrupt: row.bankrupt,
      });
    }
  }

  return { records, outcomes, unreadable };
}
