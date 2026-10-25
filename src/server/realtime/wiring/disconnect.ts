// =====================================================================
// The disconnect frame: one connection leaving, and what the hull keeps.
// =====================================================================

import type { Server, Socket } from "socket.io";

import { tFor } from "@/lib/game/i18n";
import { emitRoomMembers } from "../chat";
import { noteDraftAway } from "../draft";
import {
  broadcastPresence,
  broadcastRoomSystem,
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
        // The leaving socket was taken out of the map above, so the
        // notice reaches the rest of the crew.
        broadcastRoomSystem(io, s.roomId, (locale) =>
          tFor(locale, "{s.user.displayName} has gone ashore", {
            "s.user.displayName": s.user.displayName,
          }),
        );
        void emitRoomMembers(io, s.roomId);
        if (!set || set.size === 0) {
          // A live draft holds the harbor at the
          // draft's seat, so a seat whose last socket just went is a seat
          // the draft would otherwise wait on forever. The draft's own
          // absence watch gives it a window to come back and then lays
          // its first card, which is the module's business and not this
          // frame's: this call only tells it that the socket is gone (see
          // noteDraftAway in ../draft).
          noteDraftAway(io, s.roomId, s.userId);
          scheduleDeparture(
            io,
            s.roomId,
            s.userId,
            s.user.displayName,
            departureCleanup,
          );
        }
      }
      // A disconnect also pulls the captain out of the Quick Start
      // queue, so a closed tab doesn't leave a phantom entry that
      // matchQueuedCaptains would try to seat into a harbor.
      leaveQueue(s.userId);
      broadcastPresence(io);
    }
  });

  socket.on("error", (err: unknown) => {
    console.error("[realtime] socket error", socket.id, err);
  });
}
