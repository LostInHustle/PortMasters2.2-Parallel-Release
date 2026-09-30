// =====================================================================
// Maroon, and the Harbormaster's hand: the room's heavier vote.
// =====================================================================

import type { Server, Socket } from "socket.io";

import { seated } from "../auth";
import { parleyCheckpoint } from "../checkpoint";
import { recordMaroonVote, recordPortShift } from "../maroon";

export function wireMaroon(io: Server, socket: Socket): void {
  // The room's heavier vote (see ./maroon). Same guards as the audit's
  // and for the same reason: the leg and the phase come from the
  // checkpoint rather than from the payload, and everything the vote is
  // actually judged against (the rung, the roster, the marks on the
  // target) is read from the room inside recordMaroonVote. A doctored
  // frame can name a captain; it cannot widen the harbor that has to
  // agree.
  socket.on(
    "maroon:vote",
    (payload: { roomId?: string; round?: number; targetUserId?: string }) => {
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
      const targetUserId = payload?.targetUserId;
      if (!targetUserId) return;
      void (async () => {
        const cp = await parleyCheckpoint(roomId, payload?.round);
        if (!cp) return;
        await recordMaroonVote(io, roomId, s.userId, cp.round, targetUserId);
      })();
    },
  );

  // The marooned captain's one lever. Which captain that is comes from
  // the server's own record of the vote rather than from anything this
  // frame says about itself, and the port has to be one the market it
  // lands on has unlocked (see recordPortShift).
  socket.on(
    "maroon:shift",
    (payload: {
      roomId?: string;
      round?: number;
      port?: string;
      direction?: number;
    }) => {
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
      if (typeof payload?.port !== "string" || !payload.port) return;
      void (async () => {
        const cp = await parleyCheckpoint(roomId, payload?.round);
        if (!cp) return;
        await recordPortShift(
          io,
          roomId,
          s.userId,
          cp.round,
          payload.port as string,
          payload.direction,
        );
      })();
    },
  );
}
