// =====================================================================
// The disconnect frame: one connection leaving, and what the hull keeps.
// =====================================================================

import type { Server, Socket } from "socket.io";

import { emitRoomMembers } from "../chat";
import {
  broadcastPresence,
  forgetSocket,
  scheduleDeparture,
  sockets,
  userSockets,
  type DepartureCleanup,
} from "../presence";
import { leaveQueue } from "../quickstart";
import { forgetStatusIfLastSocket } from "../status";

export function wireDisconnect(
  io: Server,
  socket: Socket,
  departureCleanup: DepartureCleanup,
): void {
  socket.on("disconnect", () => {
    const s = sockets.get(socket.id);
    forgetSocket(socket.id);
    if (s && s.authed && s.userId) {
      const set = userSockets.get(s.userId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) userSockets.delete(s.userId);
      }
      if (s.roomId) {
        forgetStatusIfLastSocket(s.roomId, s.userId, userSockets);
        io.to(`room:${s.roomId}`).emit("room:system", {
          roomId: s.roomId,
          content: `${s.user.displayName} has gone ashore`,
        });
        void emitRoomMembers(io, s.roomId);
        if (!set || set.size === 0)
          scheduleDeparture(
            io,
            s.roomId,
            s.userId,
            s.user.displayName,
            departureCleanup,
          );
      }
      // A disconnect also pulls the captain out of the Quick Start
      // queue, so a closed tab doesn't leave a phantom entry that
      // matchQueuedCaptains would try to seat into a room.
      leaveQueue(s.userId);
      broadcastPresence(io);
    }
  });

  socket.on("error", (err: unknown) => {
    console.error("[realtime] socket error", socket.id, err);
  });
}
