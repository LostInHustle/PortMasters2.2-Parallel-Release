// =====================================================================
// The Manifest Audit: the room's lighter vote, over ../audit's own rules.
// =====================================================================

import type { Server, Socket } from "socket.io";

import { auditTallyFor, recordAuditVote } from "../audit";
import { seated } from "../auth";
import { parleyCheckpoint } from "../checkpoint";

export function wireAudit(io: Server, socket: Socket): void {
  // The room's one majority vote (see ./audit). The guards here are the
  // ones that belong to the phase machinery rather than to the vote: the
  // room is on the Gambit lap, the room is the caller's, the checkpoint
  // is the Parley step and the leg is the one the vote names. Everything
  // else the vote is judged against, including the roster it needs a
  // majority of, is read in recordAuditVote from the room rather than
  // from the payload, so a doctored frame cannot widen a majority.
  //
  // A refusal goes back to the captain who sent it and to nobody else,
  // for the reason the draft's refusals do: the room is arguing about a
  // vote, and the one captain whose press did not land is the one who
  // needs to read why. Nothing is broadcast, so a refused frame leaves
  // the table's count exactly as it was.
  socket.on(
    "audit:vote",
    (payload: { roomId?: string; round?: number; targetUserId?: string }) => {
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
      const targetUserId = payload?.targetUserId;
      if (!targetUserId) return;
      void (async () => {
        const cp = await parleyCheckpoint(roomId, payload?.round);
        if (!cp) return;
        const refused = await recordAuditVote(
          io,
          roomId,
          s.userId,
          cp.round,
          targetUserId,
        );
        if (refused) socket.emit("audit:error", { roomId, error: refused });
      })();
    },
  );

  // The count as it stands, for a card that has just opened. A leg's book
  // is built by the captains in it and the empty one is never broadcast,
  // so without this a captain who opens the card before anyone has voted
  // reads an empty board with no count on it and no way to know whether
  // the room is waiting on them. The answer is the tally frame itself
  // rather than a second shape, and it is read only (see auditTallyFor).
  socket.on(
    "audit:state:request",
    (payload: { roomId?: string; round?: number }) => {
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
      void (async () => {
        const cp = await parleyCheckpoint(roomId, payload?.round);
        if (!cp) return;
        const tally = await auditTallyFor(roomId, cp.round);
        if (tally) socket.emit("audit:tally", tally);
      })();
    },
  );
}
