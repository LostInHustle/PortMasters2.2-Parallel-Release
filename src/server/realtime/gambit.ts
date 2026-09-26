// =====================================================================
// Realtime layer: the private information spine.
//
// Everything hidden in this game is dealt here and delivered here, and
// nothing outside this module reads the alignment table. Three functions:
// one deals the cards when a Gambit voyage sets sail, one hands a captain
// the card they are already holding, and one clears them when the voyage
// is restarted.
//
// The seed is the part that matters. The engine is seeded from values the
// client already knows, which is what lets both sides simulate the same
// voyage without the server running it; a hidden alignment cannot come
// from that seed, because the captain could read it. So the seed here is
// minted on the server, handed to the draw, and dropped. The draw's
// output is what gets written down, and a row is what a reload replays
// from. Nothing client side can ask for a card that is not its own: the
// read below is by user id, and the delivery below hands the entry to
// that captain's own sockets.
// =====================================================================
import { randomUUID } from "node:crypto";
import type { Server } from "socket.io";
import { db } from "@/lib/db";
import { normalizeMode } from "@/lib/game/mode";
import {
  dealRoles,
  normalizeRole,
  roleCard,
  type GambitRole,
} from "@/lib/game/gambit";
import { roomMemberIds } from "@/lib/rooms";
import { emitPrivate } from "./presence";

// One card, to the one captain it belongs to. The line comes from the
// card record rather than being written here, so the sentence a captain
// reads and the title above it are the same piece of copy.
function sendCard(
  io: Server,
  roomId: string,
  userId: string,
  role: GambitRole,
): void {
  emitPrivate(io, roomId, userId, {
    kind: "card",
    text: roleCard(role).line,
    role,
  });
}

/**
 * Deals every card at the table, on the moment a voyage sets sail.
 *
 * A no-op in any mode but Ocean Gambit, so the caller does not have to
 * ask which game it is holding before calling this. It is idempotent too:
 * a voyage that already holds rows is sent what it holds rather than
 * dealt a second hand, which is what keeps a double start from moving
 * cards a captain has already read.
 */
export async function dealAlignments(
  io: Server,
  roomId: string,
  mode: unknown,
): Promise<void> {
  if (normalizeMode(mode) !== "ocean_gambit") return;

  const held = await db.voyageRole.findMany({
    where: { roomId },
    select: { userId: true, role: true },
  });
  if (held.length > 0) {
    for (const row of held)
      sendCard(io, roomId, row.userId, normalizeRole(row.role));
    return;
  }

  const roster = await roomMemberIds(roomId);
  const roles = dealRoles(roster, randomUUID());
  await db.voyageRole.createMany({
    data: roster.map((userId) => ({ roomId, userId, role: roles[userId] })),
  });
  for (const userId of roster) sendCard(io, roomId, userId, roles[userId]);
}

/**
 * Hands one captain the card they are already holding, which is what a
 * reload mid voyage is asking for. The seat was taken before the draw, so
 * there is nothing to deal: the row is read back and sent again.
 *
 * A captain who walks into a harbor that already set sail is the one
 * case with no row to read. A voyage is locked to new arrivals, so this
 * is only reachable when the whole crew had gone home and the harbor was
 * left standing, and the answer is an Honest card rather than no card at
 * all: a captain with no flag is the only reading of late arrival that
 * hands nobody a secret.
 */
export async function sendAlignment(
  io: Server,
  roomId: string,
  userId: string,
): Promise<void> {
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { mode: true, started: true },
  });
  if (!room || normalizeMode(room.mode) !== "ocean_gambit") return;
  if (!room.started) return;

  const held = await db.voyageRole.findUnique({
    where: { roomId_userId: { roomId, userId } },
    select: { role: true },
  });
  if (held) {
    sendCard(io, roomId, userId, normalizeRole(held.role));
    return;
  }

  await db.voyageRole.upsert({
    where: { roomId_userId: { roomId, userId } },
    create: { roomId, userId, role: "honest" },
    update: {},
  });
  sendCard(io, roomId, userId, "honest");
}

/**
 * The voyage is over, so the cards go with it. A restarted voyage is a
 * new voyage and draws a new hand, and a captain who kept the old one
 * would be holding a card no table agreed to. The client drops its copy
 * on the same signal.
 */
export async function clearAlignments(roomId: string): Promise<void> {
  await db.voyageRole.deleteMany({ where: { roomId } });
}
