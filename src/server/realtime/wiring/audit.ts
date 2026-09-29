// =====================================================================
// The Manifest Audit: the room's lighter vote, over ../audit's own rules.
// =====================================================================

import type { Server, Socket } from "socket.io";

import { recordAuditVote } from "../audit";
import { seated } from "../auth";
import { getCheckpoint } from "../checkpoint";

export function wireAudit(io: Server, socket: Socket): void {
  // The room's one majority vote (see ./audit). The guards here are the
  // ones that belong to the phase machinery rather than to the vote: the
  // room is on the Gambit lap, the room is the caller's, the checkpoint
  // is the Parley step and the leg is the one the vote names. Everything
  // else the vote is judged against, including the roster it needs a
  // majority of, is read in recordAuditVote from the room rather than
  // from the payload, so a doctored frame cannot widen a majority.
  socket.on(
    "audit:vote",
    (payload: { roomId?: string; round?: number; targetUserId?: string }) => {
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
      const targetUserId = payload?.targetUserId;
      if (!targetUserId) return;
      void (async () => {
        const cp = await getCheckpoint(roomId);
        if (cp.phase !== "parley" || cp.round !== payload?.round) return;
        await recordAuditVote(io, roomId, s.userId, cp.round, targetUserId);
      })();
    },
  );
}
