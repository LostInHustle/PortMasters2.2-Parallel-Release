// =====================================================================
// Maroon, and the Harbormaster's hand: the harbor's heavier vote.
// =====================================================================

import type { Server, Socket } from "socket.io";

import { seated } from "../auth";
import { parleyCheckpoint } from "../checkpoint";
import { maroonTallyFor, recordMaroonVote, recordPortShift } from "../maroon";
import { wireVote } from "./vote";

export function wireMaroon(io: Server, socket: Socket): void {
  // The harbor's heavier vote (see ./maroon), wired the way the audit's
  // is, because the two are the same question asked with different
  // weights: the harbor is the caller's, the checkpoint is the Parley
  // step, and the round is the one the vote names. Everything the vote is
  // actually judged against (the rung, the roster, the marks on the
  // target) is read from the harbor inside recordMaroonVote, so a doctored
  // frame can name a captain; it cannot widen the harbor that has to
  // agree.
  wireVote({
    io,
    socket,
    events: {
      vote: "maroon:vote",
      error: "maroon:error",
      stateRequest: "maroon:state:request",
      tally: "maroon:tally",
    },
    record: recordMaroonVote,
    tallyFor: maroonTallyFor,
  });

  // The marooned captain's one lever. Which captain that is comes from
  // the server's own record of the vote rather than from anything this
  // frame says about itself, and the port has to be one the market it
  // lands on has unlocked (see recordPortShift).
  //
  // A refusal goes back to the captain who sent it and to nobody else,
  // in the same shape the two votes above answer with (see ./vote): the
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
          s.locale,
        );
        if (refused)
          socket.emit("maroon:shift:error", { roomId, error: refused });
      })();
    },
  );
}
