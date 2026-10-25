// =====================================================================
// The two frames a harbor vote answers on: a nomination, and the count.
//
// The Manifest Audit (see ./audit) and the maroon (see ./maroon) are
// the same question asked with different weights, so they are wired the
// same way. A captain names a captain, the count goes out to the whole
// table, and a refusal goes back to the captain who sent it and to
// nobody else.
//
// The two were written as two copies of that shape, and copies drift,
// because a shape written twice is a shape with two answers. The guards
// around a vote are the same rule on both sides: the harbor is the one
// the socket is seated in, the round is the one the checkpoint is standing
// on, and the phase is the one the vote belongs to. A frame names a
// harbor, a round and a captain, and the harbor and the round are read from the
// server's own books rather than taken from the frame, so a doctored
// frame can ask a question but cannot widen the table that has to
// agree.
//
// What is shared here is the plumbing and nothing else. What a vote is
// allowed to do, who it counts, and what it costs a captain belong to
// the module that owns the vote, and the helper is handed that module's
// own record function rather than a copy of its rules. The four frame
// names are handed in as well, for the same reason: the audit's frames
// and the maroon's are different names, and they are the names the
// clients already listen for.
//
// The refusal is the part worth reading. A press that did not land says
// so to the captain who pressed and to nobody else, because the harbor
// is arguing about a vote and the one captain whose press did not land
// is the one who needs to read why. Nothing is broadcast, so a refused
// frame leaves the table's count exactly as it was.
//
// The maroon's third frame, the Harbormaster's call, is not one of
// these two: it is a lever rather than a vote, and it is wired by the
// module that owns it.
// =====================================================================

import type { Server, Socket } from "socket.io";

import type { Locale } from "@/lib/game/i18n";
import { seated } from "../auth";
import { parleyCheckpoint } from "../checkpoint";

// The four frames a vote answers on, named by the caller. Each one is
// the name the client's own hook listens for, and the two votes name
// theirs differently, which is why they are named here rather than
// built from a prefix.
type VoteEvents = {
  // The captain's nomination.
  vote: string;
  // The sentence that refuses a nomination the harbor did not take.
  error: string;
  // The ask for the count as it stands.
  stateRequest: string;
  // The count itself.
  tally: string;
};

// The vote's own record, as the module that owns the vote writes it: the
// harbor, the captain who pressed, the round and the captain they named. It
// hands back the sentence that refuses the press, or nothing at all when
// the nomination was taken.
type VoteRecord = (
  io: Server,
  roomId: string,
  voterId: string,
  round: number,
  targetUserId: string,
  locale: Locale,
) => Promise<string | null>;

// The count as it stands, as the module that owns the vote reads it. The
// tally is the module's own shape, so the frame is handed back as it
// came rather than rebuilt here.
type VoteTally<T> = (roomId: string, round: number) => Promise<T | null>;

// Wires a harbor vote onto a connection: the nomination a captain makes
// and the count a card asks for.
export function wireVote<T>(opts: {
  io: Server;
  socket: Socket;
  events: VoteEvents;
  record: VoteRecord;
  tallyFor: VoteTally<T>;
}): void {
  const { io, socket, events, record, tallyFor } = opts;
  socket.on(
    events.vote,
    (payload: { roomId?: string; round?: number; targetUserId?: string }) => {
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
      const targetUserId = payload?.targetUserId;
      if (!targetUserId) return;
      void (async () => {
        const cp = await parleyCheckpoint(roomId, payload?.round);
        if (!cp) return;
        const refused = await record(
          io,
          roomId,
          s.userId,
          cp.round,
          targetUserId,
          s.locale,
        );
        if (refused) socket.emit(events.error, { roomId, error: refused });
      })();
    },
  );

  socket.on(
    events.stateRequest,
    (payload: { roomId?: string; round?: number }) => {
      const s = seated(socket, payload);
      if (!s) return;
      const { roomId } = s;
      void (async () => {
        const cp = await parleyCheckpoint(roomId, payload?.round);
        if (!cp) return;
        const tally = await tallyFor(roomId, cp.round);
        if (tally) socket.emit(events.tally, tally);
      })();
    },
  );
}
