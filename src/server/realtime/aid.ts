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
import type { AidRequest } from "@/types/realtime";
import { roomCheckpoints } from "./checkpoint";

export const roomAidRequests = new Map<string, AidRequest[]>();

// The one place the map is written. A room with nothing open is held as
// no entry at all rather than an empty list, so every writer has to make
// the same set or delete choice, and none of them should be making it
// on their own.
function replaceAidList(roomId: string, next: AidRequest[]): void {
  if (next.length) roomAidRequests.set(roomId, next);
  else roomAidRequests.delete(roomId);
}

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

// Posts a captain's request, replacing whatever they had open before. One
// captain has one request out at a time, so posting again corrects the
// figure on the old one rather than adding a second.
export function setAidRequest(
  io: Server,
  roomId: string,
  request: AidRequest,
): void {
  replaceAidList(roomId, [
    ...aidList(roomId).filter((r) => r.fromUserId !== request.fromUserId),
    request,
  ]);
  broadcastAid(io, roomId);
}

// The common tail of every removal: drop what the caller doesn't want
// kept, and tell the room only if that actually took something out.
function dropAidRequests(
  io: Server,
  roomId: string,
  keep: (r: AidRequest) => boolean,
): void {
  const list = roomAidRequests.get(roomId);
  if (!list) return;
  const next = list.filter(keep);
  if (next.length === list.length) return;
  replaceAidList(roomId, next);
  broadcastAid(io, roomId);
}

// Drops one request by id, for the captain who just funded it.
export function removeAidRequest(
  io: Server,
  roomId: string,
  requestId: string,
): void {
  dropAidRequests(io, roomId, (r) => r.id !== requestId);
}

// Drops just one departed captain's own open request, so nobody can
// fund a request from someone who isn't in the room (or online) anymore.
export function removeUserAidRequest(
  io: Server,
  roomId: string,
  userId: string,
): void {
  dropAidRequests(io, roomId, (r) => r.fromUserId !== userId);
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
