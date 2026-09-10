// =====================================================================
// Realtime layer: the per room game:status cache.
//
// Last known game status per (room, user) so late joiners can hydrate
// the roster immediately instead of seeing "loading" until the next
// broadcast. Split out of presence.ts because the status cache is
// read by several modules (presence for the dedupe, checkpoint for
// activeRosterSet, surge for combinedReputation, conclusion for the
// finisher loop) and each of those should import from one place
// rather than reaching into presence's internals.
// =====================================================================
import type { CaptainStatus } from "./types";

// roomId -> (userId -> last reported status)
export const roomStatuses = new Map<string, Map<string, CaptainStatus>>();

export function rememberStatus(roomId: string, payload: CaptainStatus): void {
  let m = roomStatuses.get(roomId);
  if (!m) {
    m = new Map();
    roomStatuses.set(roomId, m);
  }
  m.set(payload.user.id, payload);
}

// Sends every cached status for a room to one socket, so a freshly
// joined captain sees the full roster's last known phase/gold/reputation
// without waiting for each member's next heartbeat.
export function sendStatusBatchTo(
  io: import("./types").Server,
  roomId: string,
  socketId: string,
): void {
  const m = roomStatuses.get(roomId);
  if (!m) return;
  for (const st of m.values()) {
    io.to(socketId).emit("game:status", st);
  }
}

// Drops a user's cached status when they leave a room (or disconnect),
// so a later joiner doesn't get hydrated with stale data for someone
// who isn't actually there anymore. Also reclaims empty room entries.
export function forgetStatus(roomId: string, userId: string): void {
  const m = roomStatuses.get(roomId);
  if (!m) return;
  m.delete(userId);
  if (m.size === 0) roomStatuses.delete(roomId);
}

// Like forgetStatus, but only actually forgets when the user has no
// live sockets left at all. A socket disconnect shouldn't erase the
// one piece of data the roster uses to show live gold/reputation/phase,
// not while another tab or a just reconnected socket is still around
// to keep it current.
export function forgetStatusIfLastSocket(
  roomId: string,
  userId: string,
  userSockets: Map<string, Set<string>>,
): void {
  const set = userSockets.get(userId);
  if (!set || set.size === 0) forgetStatus(roomId, userId);
}

// Wipes the entire status cache for a room. Called on room:restart and
// when a room is deleted after its last member departs.
export function clearRoomStatuses(roomId: string): void {
  roomStatuses.delete(roomId);
}
