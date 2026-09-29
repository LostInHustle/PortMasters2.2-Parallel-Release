// =====================================================================
// The phase and round ready check: who has said they are done, and the
// advance that follows when the room has.
// =====================================================================

import type { Server, Socket } from "socket.io";

import { normalizePhase } from "@/lib/game/phases";
import { type Phase } from "@/lib/game/types";
import { seated } from "../auth";
import {
  broadcastReadyState,
  getCheckpoint,
  maybeAdvance,
  readyStatePayload,
} from "../checkpoint";

export function wirePhaseReady(io: Server, socket: Socket): void {
  socket.on(
    "phase:ready",
    async (payload: { roomId?: string; round?: number; phase?: Phase }) => {
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
      const cp = await getCheckpoint(roomId);
      // The pier is the pre game lobby. It only ever moves forward
      // through the host's room:start, never through a per player
      // ready vote.
      if (cp.phase === "harbor") return;
      if (
        payload?.round !== cp.round ||
        normalizePhase(payload?.phase) !== cp.phase
      ) {
        io.to(socket.id).emit(
          "phase:ready_update",
          await readyStatePayload(roomId, cp),
        );
        return;
      }
      cp.readyUserIds.add(s.userId);
      await broadcastReadyState(io, roomId, cp);
      await maybeAdvance(io, roomId);
    },
  );

  socket.on("phase:unready", async (payload: { roomId?: string }) => {
    const s = seated(socket, payload);
    if (!s) return;
    const { roomId } = s;
    const cp = await getCheckpoint(roomId);
    cp.readyUserIds.delete(s.userId);
    await broadcastReadyState(io, roomId, cp);
  });

  socket.on("phase:state:request", async (payload: { roomId?: string }) => {
    const s = seated(socket, payload);
    if (!s) return;
    const { roomId } = s;
    const cp = await getCheckpoint(roomId);
    socket.emit("phase:ready_update", await readyStatePayload(roomId, cp));
  });
}
