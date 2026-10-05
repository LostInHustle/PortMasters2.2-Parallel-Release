// =====================================================================
// Maroon, and the Harbormaster's hand: the room's heavier vote.
// =====================================================================

import type { Server, Socket } from "socket.io";

import { seated } from "../auth";
import { parleyCheckpoint } from "../checkpoint";
import { maroonTallyFor, recordMaroonVote, recordPortShift } from "../maroon";

export function wireMaroon(io: Server, socket: Socket): void {
  // The room's heavier vote (see ./maroon). Same guards as the audit's
  // and for the same reason: the leg and the phase come from the
  // checkpoint rather than from the payload, and everything the vote is
  // actually judged against (the rung, the roster, the marks on the
  // target) is read from the room inside recordMaroonVote. A doctored
  // frame can name a captain; it cannot widen the harbor that has to
  // agree.
  //
  // A refusal goes back to the captain who sent it and to nobody else,
  // exactly as the audit's does: the count the room is reading must not
  // move for a press that did not land, and the captain whose press it
  // was is the one who needs the sentence.
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
        const refused = await recordMaroonVote(
          io,
          roomId,
          s.userId,
          cp.round,
          targetUserId,
        );
        if (refused) socket.emit("maroon:error", { roomId, error: refused });
      })();
    },
  );

  // The count as it stands, for a card that has just opened: the same ask
  // the audit answers, for the same reason (see ../wiring/audit), since
  // the maroon's tally is a leg's book too and the empty one is never
  // broadcast. Read only (see maroonTallyFor).
  socket.on(
    "maroon:state:request",
    (payload: { roomId?: string; round?: number }) => {
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
      void (async () => {
        const cp = await parleyCheckpoint(roomId, payload?.round);
        if (!cp) return;
        const tally = await maroonTallyFor(roomId, cp.round);
        if (tally) socket.emit("maroon:tally", tally);
      })();
    },
  );

  // The marooned captain's one lever. Which captain that is comes from
  // the server's own record of the vote rather than from anything this
  // frame says about itself, and the port has to be one the market it
  // lands on has unlocked (see recordPortShift).
  //
  // A refusal goes back to the captain who sent it and to nobody else, the
  // third frame of the family the two votes above already answer with: the
  // port and the direction are checked by the module that owns the rule
  // rather than here, so a frame that names neither still comes back with
  // the sentence that says so instead of a press that quietly did nothing.
  socket.on(
    "maroon:shift",
    (payload: {
      roomId?: string;
      round?: number;
      port?: unknown;
      direction?: unknown;
    }) => {
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
      void (async () => {
        const cp = await parleyCheckpoint(roomId, payload?.round);
        if (!cp) return;
        const refused = await recordPortShift(
          io,
          roomId,
          s.userId,
          cp.round,
          payload?.port,
          payload?.direction,
        );
        if (refused)
          socket.emit("maroon:shift:error", { roomId, error: refused });
      })();
    },
  );
}
