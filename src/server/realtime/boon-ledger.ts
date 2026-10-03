// =====================================================================
// Realtime layer: the fleet's ledger of boon picks.
//
// [F5: public offers] The plan's feature is one sentence: every offer is
// public, the whole fleet sees the three cards you were shown and the one
// you kept. This module is the server half of it. One record per captain
// per room, replaced by the next pick, broadcast to the whole room after
// every accepted report.
//
// There is no switch here, and that is the plan's rollback clause read as
// code: "This is the one build layer feature that must not be quietly
// disabled, because the hidden role mode's evidence surface depends on
// it. If it is turned off, the mode's mode flag goes off with it." So the
// gate is the harbor's own mode record and nothing else, the same shape
// the audit's rung follows (see auditOpensAt in @/lib/game/mode), except
// that the ledger has no rung: boons are drafted from the first leg, so
// the mode is the whole of the question. A Classic harbor never records a
// report and never receives a frame, because nothing ever emits one to it.
//
// The map is a room's for the voyage and is cleared the way the audit's
// is: on a restart and when a room is deleted, beside clearAudits (see
// the clear block in ./index). A joiner is handed the ledger directly
// (see the hand-out in ./wiring/room-join), exactly as a joiner is handed
// the audit's reveal, because public state a reload can miss is state the
// table has to re-say.
//
// Nothing here trusts a report's shape: the fields are read and bounded
// in ./wiring/boons before this module is ever reached, and what arrives
// here is already a BoonRecord off the public catalogue. What this module
// still judges is order: a report from an older leg than the record the
// captain already has is refused rather than stored, so a stale tab
// cannot rewind the table's picture of a captain who has since picked.
// =====================================================================

import { BoonLedger } from "@/types/realtime/boons";
import type { Server } from "socket.io";
import { db } from "@/lib/db";
import { gambitSystemsOn } from "@/lib/game/mode";
import type { BoonRecord } from "@/lib/game/types";

// One map per process, one entry per captain, read only through the
// functions below. It stays inside this module because no other caller
// has a question a function here does not answer, which is the same
// reason the audit's map is private.
const roomLedgers = new Map<string, Map<string, BoonRecord>>();

// The ledger as a joiner is handed it, or null for a harbor where no boon
// has been answered yet, which is also what a restarted voyage reads as.
export function boonLedgerFor(roomId: string): BoonLedger | null {
  const ledger = roomLedgers.get(roomId);
  if (!ledger || ledger.size === 0) return null;
  return { roomId, entries: Object.fromEntries(ledger) };
}

// Wipes a room's ledger. Called on room:restart and when a room is
// deleted after its last member departs, beside clearAudits.
export function clearBoonLedger(roomId: string): void {
  roomLedgers.delete(roomId);
}

// The harbor's own answer to whether the ledger runs here, read from the
// room and never from the payload, for the reason the commission reads
// its own: a client cannot keep a ledger in a harbor whose mode runs no
// gambit systems, or in a room it is not in.
async function ledgerRoomOpen(roomId: string): Promise<boolean> {
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { mode: true },
  });
  return gambitSystemsOn(room?.mode);
}

/**
 * One captain's report, all the way to the room.
 *
 * The order is the audit's: the harbor first (a Classic room costs one
 * read and stops), then the record's order against what the captain
 * already has, then the store, then one broadcast of the whole ledger.
 * The whole map goes out rather than the one entry, because the map is
 * what the panels draw and a client patching one entry into a map it may
 * never have received would be a second copy of this module's arithmetic.
 */
export async function recordBoonReport(
  io: Server,
  roomId: string,
  userId: string,
  entry: BoonRecord,
): Promise<void> {
  if (!(await ledgerRoomOpen(roomId))) return;
  let ledger = roomLedgers.get(roomId);
  if (!ledger) {
    ledger = new Map();
    roomLedgers.set(roomId, ledger);
  }
  const held = ledger.get(userId);
  if (held && entry.round < held.round) return;
  ledger.set(userId, entry);
  const frame = boonLedgerFor(roomId);
  if (!frame) return;
  io.to(`room:${roomId}`).emit("boon:ledger", frame);
}
