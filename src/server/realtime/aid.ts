// =====================================================================
// Realtime layer: the Financial Aid board.
//
// A captain short on Gold for this round's wages or maintenance can ask
// the rest of the harbor for a loan before being forced into a bankrupt
// payment. Structurally the same problem as a barter offer (real cross
// player state two clients need to agree happened), so this is
// deliberately built the same way: this server only keeps one captain
// from claiming the same request twice, it never sees anyone's actual
// Gold total. Whether the helper can really afford to lend is decided
// on their own client against their own GameState, same as a barter
// offer's affordability.
// =====================================================================
import type { Server } from "socket.io";
import type { AidRequest } from "./types";
import { roomCheckpoints } from "./checkpoint";

export const roomAidRequests = new Map<string, AidRequest[]>();

export function aidList(roomId: string): AidRequest[] {
  return roomAidRequests.get(roomId) ?? [];
}

export function broadcastAid(io: Server, roomId: string): void {
  io.to(`room:${roomId}`).emit("aid:update", {
    roomId,
    requests: aidList(roomId),
  });
}

export function clearAid(io: Server, roomId: string): void {
  if (!roomAidRequests.has(roomId)) return;
  roomAidRequests.delete(roomId);
  broadcastAid(io, roomId);
}

// Drops just one departed captain's own open request, so nobody can
// fund a request from someone who isn't in the room (or online) anymore.
export function removeUserAidRequest(
  io: Server,
  roomId: string,
  userId: string,
): void {
  const list = roomAidRequests.get(roomId);
  if (!list) return;
  const next = list.filter((r) => r.fromUserId !== userId);
  if (next.length === list.length) return;
  if (next.length) roomAidRequests.set(roomId, next);
  else roomAidRequests.delete(roomId);
  broadcastAid(io, roomId);
}

// The round an aid request was posted in, read from the room's current
// checkpoint. Used by the aid:post handler when building an AidRequest.
export function currentCheckpointRound(roomId: string): number {
  return roomCheckpoints.get(roomId)?.round ?? 1;
}

// Wipes the aid board for a room without broadcasting. Called when the
// room itself is being torn down.
export function clearAidSilent(roomId: string): void {
  roomAidRequests.delete(roomId);
}
