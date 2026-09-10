// =====================================================================
// Realtime layer: room chat muting and the roster broadcast.
//
// emitRoomMembers reads the room's current host fresh from the database
// every time rather than cached, since host changes are rare and this
// only fires on join/leave/disconnect, never on the hot game action
// path. mutedUserIds rides along on the same broadcast every client
// already listens to for the roster itself, so muting someone needs no
// separate client subscription.
//
// [MANIFEST 14: Harbor Watch] Who the host has muted from room chat
// this voyage, in memory only. Cleared on room:restart and on room
// deletion, alongside every other per voyage structure.
// =====================================================================
import type { Server } from "socket.io";
import { db } from "@/lib/db";
import { roomMembers } from "./presence";

const roomMutedUsers = new Map<string, Set<string>>();

// Includes the room's current host so a reassigned host (the original
// one left before anyone else did) sees the Start Game control without
// needing to refresh.
export async function emitRoomMembers(
  io: Server,
  roomId: string,
): Promise<void> {
  const members = roomMembers(roomId).map(({ socketId: _sid, ...u }) => u);
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: { hostId: true },
  });
  io.to(`room:${roomId}`).emit("room:members", {
    roomId,
    members,
    hostId: room?.hostId ?? null,
    mutedUserIds: Array.from(roomMutedUsers.get(roomId) ?? []),
  });
}

export function muteUser(roomId: string, userId: string): void {
  let set = roomMutedUsers.get(roomId);
  if (!set) {
    set = new Set();
    roomMutedUsers.set(roomId, set);
  }
  set.add(userId);
}

export function unmuteUser(roomId: string, userId: string): boolean {
  const set = roomMutedUsers.get(roomId);
  if (!set || !set.delete(userId)) return false;
  if (set.size === 0) roomMutedUsers.delete(roomId);
  return true;
}

export function isMuted(roomId: string, userId: string): boolean {
  return roomMutedUsers.get(roomId)?.has(userId) ?? false;
}

export function clearMutedUsers(roomId: string): boolean {
  return roomMutedUsers.delete(roomId);
}
