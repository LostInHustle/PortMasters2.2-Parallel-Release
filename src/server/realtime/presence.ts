// =====================================================================
// Realtime layer: online presence and room rosters.
//
// Two maps sit at the centre of this module:
//   sockets     socketId -> SocketState
//   userSockets userId    -> Set<socketId>   (a user may hold several)
//
// onlineUsers() collapses the sockets map down to one row per user for
// the lobby's captains online list. roomMembers(roomId) collapses it
// the same way for a single room's roster, newest socket wins so a
// reconnecting captain's fresh status overrides the stale one their
// dropped socket is still broadcasting.
//
// scheduleDeparture arms the 30s grace timer that reaps a seat after a
// captain's last socket goes away. A reconnect inside the window cancels
// it; a sustained absence lets it fire, which calls leaveRoomForUser
// and tears down every per room structure for a deleted room.
//
// scheduleBootDeparture arms the same timer for the same reason at
// process start, and differs in one respect only: a harbor that loses
// its whole crew that way is kept instead of removed.
//
// Both take their cleanup callbacks as parameters rather than importing
// them, because they sit at the top of a dependency chain that reaches
// into barter, aid, chat, conclusion, and the cross module room
// teardown. Passing them in keeps the dependency graph acyclic.
// =====================================================================
import type { Server } from "socket.io";
import { db } from "@/lib/db";
import { leaveRoomForUser } from "@/lib/rooms";
import type { PublicUser } from "@/types/realtime";
import type { SocketState } from "./types";

export const sockets = new Map<string, SocketState>();
export const userSockets = new Map<string, Set<string>>();

// Abandoned seat cleanup. Keyed by "roomId:userId" since a user can
// only hold one pending departure per room at a time.
const departureTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DEPARTURE_GRACE_MS = 30_000;

// In process locks that guard room:start and room:restart against
// firing twice for the same room if the host double clicks or has two
// tabs open.
export const startingRooms = new Set<string>();
export const restartingRooms = new Set<string>();

export function rememberSocket(socketId: string, state: SocketState): void {
  sockets.set(socketId, state);
}

export function forgetSocket(socketId: string): void {
  sockets.delete(socketId);
}

// One row per user, never per socket. A captain can hold several
// sockets at once (two browser tabs, or a reconnect's brand new socket
// while the dropped one is still inside pingTimeout).
export function onlineUsers(): Array<PublicUser & { roomId: string | null }> {
  const seen = new Map<string, PublicUser & { roomId: string | null }>();
  for (const s of sockets.values()) {
    if (!s.authed) continue;
    if (!seen.has(s.userId))
      seen.set(s.userId, { ...s.user, roomId: s.roomId });
  }
  return Array.from(seen.values());
}

export function broadcastPresence(io: Server): void {
  io.emit("presence:update", { users: onlineUsers() });
}

// Collapses every socket claiming this room down to one row per user.
// Reverse iterated so the newest socket (inserted last) wins the dedup:
// when a hosting edge proxy recycles an idle WebSocket, the stale one
// hangs around in sockets until pingTimeout fires. Walking newest first
// means the freshly reconnected socket always claims the roster slot.
export function roomMembers(
  roomId: string,
): Array<PublicUser & { socketId: string }> {
  const byUser = new Map<string, PublicUser & { socketId: string }>();
  for (const [sid, s] of Array.from(sockets.entries()).reverse()) {
    if (s.roomId === roomId && s.authed && !byUser.has(s.userId)) {
      byUser.set(s.userId, { ...s.user, socketId: sid });
    }
  }
  return Array.from(byUser.values());
}

// The room one captain is currently seated in, or null when they are in
// the lobby or holding no socket at all. A captain with two tabs open
// holds one seat rather than two, so whichever socket claims a room
// speaks for them.
export function seatedRoomOf(userId: string): string | null {
  for (const s of sockets.values()) {
    if (s.userId === userId && s.authed && s.roomId) return s.roomId;
  }
  return null;
}

// The public identity of one captain, taken from whichever socket is
// carrying them, or null when they hold no socket at all. Used where a
// session conversation has to be addressed to someone without going to
// the database for a row that is not being written there anyway.
export function publicUserOf(userId: string): PublicUser | null {
  for (const s of sockets.values()) {
    if (s.userId === userId && s.authed) return s.user;
  }
  return null;
}

// Returns whether a pending departure was actually found and canceled.
// room:join uses this to tell a genuine first join apart from a captain
// whose connection merely blipped and is rejoining moments later.
export function cancelDeparture(roomId: string, userId: string): boolean {
  const key = `${roomId}:${userId}`;
  const t = departureTimers.get(key);
  if (t) {
    clearTimeout(t);
    departureTimers.delete(key);
    return true;
  }
  return false;
}

// The cleanup callbacks scheduleDeparture needs. Passed in rather than
// imported so this module doesn't pull in barter, aid, chat, conclusion,
// or the cross module room teardown, which would create a cycle.
export type DepartureCleanup = {
  removeUserBarterOffers: (io: Server, roomId: string, userId: string) => void;
  removeUserAidRequest: (io: Server, roomId: string, userId: string) => void;
  emitRoomMembers: (io: Server, roomId: string) => Promise<void>;
  maybeConcludeVoyage: (io: Server, roomId: string) => Promise<void>;
  clearRoomAllMaps: (roomId: string) => void;
};

// Everything one armed departure needs. Bundled into a single object
// rather than five positional arguments, and because the boot variant
// below differs from the live one by exactly one field.
type DeparturePlan = {
  roomId: string;
  userId: string;
  displayName: string;
  cleanup: DepartureCleanup;
  // Boot reconciliation sets this. A live departure leaves it false, so
  // the last captain out removes the room and the public lobby stays
  // free of rooms nobody is sitting in. A restart is a different case:
  // the harbor and the voyage saved inside it belong to the captain, so
  // boot drops the seats and keeps the room for them to walk back into.
  keepEmptyRoom: boolean;
};

// Arms the 30s grace timer. When it fires, if the captain hasn't
// reconnected to any socket at all, their seat is reaped: barter and
// aid offers pulled, membership deleted, host reassigned, and, unless
// the plan says to keep it, the room removed once it empties out.
function armDeparture(io: Server, plan: DeparturePlan): void {
  const { roomId, userId, displayName, cleanup, keepEmptyRoom } = plan;
  const key = `${roomId}:${userId}`;
  cancelDeparture(roomId, userId);
  const t = setTimeout(async () => {
    departureTimers.delete(key);
    // They may have reconnected to a different room, or signed back in,
    // in the time it took the timer to fire, so only act if they're
    // still gone from this one.
    if (userSockets.get(userId)?.size) return;

    cleanup.removeUserBarterOffers(io, roomId, userId);
    cleanup.removeUserAidRequest(io, roomId, userId);

    const result = await leaveRoomForUser(userId, roomId, {
      keepEmptyRoom,
    }).catch(() => null);
    if (!result) return;

    if (result.roomDeleted) {
      // The room was deleted because this was its last member. Tear
      // down every in memory structure for it so a future room (with a
      // different id) doesn't inherit stale data from a room that no
      // longer exists.
      cleanup.clearRoomAllMaps(roomId);
    } else {
      io.to(`room:${roomId}`).emit("room:system", {
        roomId,
        content: `${displayName}'s voyage has ended`,
      });
      await cleanup.emitRoomMembers(io, roomId);
      // The captain who just left might have been the only one still
      // out at sea; everyone else could already be sitting at their
      // endgame screen waiting on exactly this.
      await cleanup.maybeConcludeVoyage(io, roomId);
    }
  }, DEPARTURE_GRACE_MS);
  departureTimers.set(key, t);
}

// A live departure: the captain's last socket has gone away. If they
// were the last one in the room, the room goes with them.
export function scheduleDeparture(
  io: Server,
  roomId: string,
  userId: string,
  displayName: string,
  cleanup: DepartureCleanup,
): void {
  armDeparture(io, {
    roomId,
    userId,
    displayName,
    cleanup,
    keepEmptyRoom: false,
  });
}

// The boot variant. Same grace window and the same reaping, but a harbor
// that loses its whole crew is kept rather than removed, so a captain
// who comes back after a restart finds the room and the voyage saved
// inside it still waiting.
function scheduleBootDeparture(
  io: Server,
  roomId: string,
  userId: string,
  displayName: string,
  cleanup: DepartureCleanup,
): void {
  armDeparture(io, {
    roomId,
    userId,
    displayName,
    cleanup,
    keepEmptyRoom: true,
  });
}

// ========== Boot time membership reconciliation ==========
// Every map above starts empty on every process boot, but Room/RoomMember
// in the database persist across it. Without this, a captain who was
// seated in a room the moment the process went down keeps that seat
// forever: there is no live socket left to ever fire the disconnect
// event that would normally arm their departure grace timer, so
// activeRosterSet requires a ready signal from them that can now never
// arrive, and the whole room is stuck on whatever checkpoint it was at,
// permanently.
//
// The fix mirrors the disconnect grace period: arm the same departure
// timer for every current member of every room as soon as the process
// comes up. A captain whose browser tab is still genuinely open
// reconnects within a couple of seconds (the client re auths and re
// emits room:join automatically), which cancels this. Anyone who
// doesn't reconnect within the window is reaped the same way.
//
// It arms the boot variant of that timer, so a harbor whose whole crew
// fails to come back is left standing rather than swept away. A restart
// is not the same event as everyone walking out: the room and the
// voyage saved inside it are the captain's, and losing them to a server
// restart is a surprise, not a cleanup. An empty room cannot hold the
// ready check hostage either, since activeRosterSet reads the seats and
// there are none left to wait on.
export async function reconcileMembershipAfterBoot(
  io: Server,
  cleanup: DepartureCleanup,
): Promise<void> {
  const members = await db.roomMember.findMany({
    select: {
      roomId: true,
      userId: true,
      user: { select: { displayName: true } },
    },
  });
  for (const m of members) {
    scheduleBootDeparture(io, m.roomId, m.userId, m.user.displayName, cleanup);
  }
}
