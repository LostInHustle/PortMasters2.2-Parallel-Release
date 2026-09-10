// =====================================================================
// Realtime layer: Quick Start queue.
//
// [MANIFEST 16] A captain who just wants to play, without rounding up
// a room code or waiting for a friend, joins the Quick Start queue.
// matchQueuedCaptains pairs them into an existing open public room that
// hasn't set sail yet (the first one with a free seat), or creates a
// fresh one if no such room exists. The matched captains receive
// quickstart:matched with the roomId and roomCode, and their client
// joins the room exactly as if they'd typed the code in by hand.
//
// The queue is a plain in process Set: no horizontal scaling, so that's
// all the durability it needs. A captain who disconnects while queued
// is removed on disconnect (see the handler in index.ts).
// =====================================================================
import type { Server } from "socket.io";
import { db } from "@/lib/db";
import { normalizeDifficulty, type Difficulty } from "@/lib/game/difficulty";
import { generateRoomCode, normalizeRoomName } from "@/lib/rooms";
import { userSockets } from "./presence";

// The seat a captain is waiting in, and the tier they asked for.
//
// The tier only matters for the captain who ends up opening the room. Any
// captain seated into a harbor that already exists sails at that harbor's
// tier, which is the same rule that applies to joining by room code: the
// tier belongs to the room, not to the person walking into it.
const quickStartQueue = new Map<string, Difficulty>();

export function joinQueue(userId: string, difficulty?: unknown): void {
  quickStartQueue.set(userId, normalizeDifficulty(difficulty));
}

export function leaveQueue(userId: string): void {
  quickStartQueue.delete(userId);
}

// A Quick Start room holds the same four captains an ordinary room does.
const QUICK_START_MAX_MEMBERS = 4;

// Matches run one at a time, chained through this promise.
//
// This is not belt and braces, it is the fix for the exact case the
// button exists for. Two captains pressing Quick Start in the same tick
// produce two join events, and both handlers reach their database lookup
// before either has created anything. Each would find no open harbor, each
// would open its own room, and the two captains would be seated in
// different harbors, which is the opposite of being paired. Chaining makes
// the second match wait for the first to finish, so by the time it looks
// for a room, the room the first one opened exists and has a free seat.
let matchChain: Promise<void> = Promise.resolve();

export function matchQueuedCaptains(io: Server): Promise<void> {
  const run = matchChain.then(() => matchQueuedCaptainsNow(io));
  // The chain has to survive a failure. Assigning the caught promise
  // rather than the raw one means a match that throws does not reject
  // every match queued behind it.
  matchChain = run.catch(() => {});
  return run;
}

// Tries to pair every queued captain into a room. Walks the queue in
// insertion order (Set iteration is insertion ordered in JS). For each
// captain, finds an existing open public room that hasn't started and
// has fewer than 4 members, or creates a fresh one. The captain is
// added as a member and told to join via quickstart:matched.
//
// Never call this directly; go through matchQueuedCaptains above so the
// serialization cannot be bypassed by accident.
async function matchQueuedCaptainsNow(io: Server): Promise<void> {
  if (quickStartQueue.size === 0) return;

  // Snapshot the queue so we can iterate without worrying about mutations.
  const queued = Array.from(quickStartQueue.entries());

  for (const [userId, difficulty] of queued) {
    // Skip if the captain went offline between joining the queue and
    // this match attempt.
    if (!userSockets.get(userId)?.size) {
      quickStartQueue.delete(userId);
      continue;
    }

    // Find an existing open public room that hasn't started and has a
    // free seat. Walk newest first so a room that was just created by
    // a previous queued captain in this same loop is preferred, which
    // tends to fill rooms before spilling into new ones.
    //
    // The member ids come back with the room so the liveness check below
    // can be made without a second query.
    const candidate = await db.room.findFirst({
      where: {
        isPublic: true,
        started: false,
        members: { some: {} },
      },
      include: {
        _count: { select: { members: true } },
        members: { select: { userId: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    let roomId: string;
    let roomCode: string;

    // A harbor is only open if somebody in it is actually here. A room
    // whose remaining members have all closed their tabs is not open, it
    // is simply not cleaned up yet: their departure timers are still
    // counting down. Seating a captain in one of those hands them a room
    // nobody can set sail from until those timers fire, and the captain
    // who does press the button first is left reading "waiting for host"
    // with no way to tell whether anything is wrong.
    const hasLiveMember = Boolean(
      candidate?.members.some((m) => userSockets.get(m.userId)?.size),
    );

    if (
      candidate &&
      hasLiveMember &&
      candidate._count.members < QUICK_START_MAX_MEMBERS
    ) {
      roomId = candidate.id;
      roomCode = candidate.code;
    } else {
      // No suitable room: create a fresh one with this captain as host,
      // in the tier they picked in the lobby before pressing the button.
      // The tier used to be hardcoded to fair_winds here, which quietly
      // threw away the captain's choice.
      roomCode = generateRoomCode();
      const created = await db.room.create({
        data: {
          code: roomCode,
          name: normalizeRoomName("Quick Start Harbor"),
          hostId: userId,
          isPublic: true,
          difficulty,
        },
      });
      roomId = created.id;
    }

    // Add the captain as a member (idempotent: if they're already in
    // this room, the upsert is a no op).
    await db.roomMember.upsert({
      where: { userId_roomId: { userId, roomId } },
      create: { userId, roomId },
      update: {},
    });

    // Tell every socket the captain holds that they've been matched.
    for (const sid of userSockets.get(userId) ?? []) {
      io.to(sid).emit("quickstart:matched", { roomId, roomCode });
    }

    quickStartQueue.delete(userId);
  }
}
