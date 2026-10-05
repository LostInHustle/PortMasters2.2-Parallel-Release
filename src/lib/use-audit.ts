"use client";

// =====================================================================
// The Manifest Audit, client side.
//
// Four pieces of state, three of them broadcast and every one of them
// stamped with the room it belongs to for the same reason the private log
// and the commission board are: a captain who sails straight out of one
// harbor into another must never see the last harbor's business on the
// new one's screen.
//
//   The tally is the nominations for one leg, and it is the whole frame
//   the server sent rather than the map out of it. It arrives after every
//   vote, including the one that carries, it is answered to this captain
//   when their card opens and nobody has voted yet (see the state request
//   below), and it is replaced rather than merged, because the server
//   sends the whole count every time and the whole count is the truth.
//
//   The reveal is the finding, and it is the one thing here that outlives
//   the leg it happened in. It arrives either as the vote carrying or as
//   the join hand-out when a captain reloads into a harbor that has
//   already audited someone (see the room:join handler in
//   src/server/realtime/index.ts), and the two paths carry the identical
//   frame so nothing here has to know which one it was.
//
//   The refusal is this captain's own press coming back. It is a plain
//   string for the panel to print, and it is cleared by the panel's own
//   dismiss or by the next press: a sentence about a vote that has since
//   moved is a sentence about nothing.
//
// The local rule for whether this captain may vote is re-derived rather
// than asked for, because every part of it is already on this side of the
// wire: the mode, the phase, the leg and whether the audit is spent. What
// is NOT re-derived is the count: how many names carry the vote is the
// server's arithmetic over a roster this side cannot see, so it rides the
// tally frame (see AuditTally) and this hook hands it on as it arrived.
//
// The server applies the same rules again, and it is the server's answer
// that counts; this is only so the button is not offered where the vote
// would be thrown away, and so the one press a captain gets cannot be
// spent twice while the first is still in flight.
// =====================================================================

import {
  AuditReveal as AuditRevealPayload,
  AuditTally as AuditTallyPayload,
  AuditVote as AuditVotePayload,
} from "@/types/realtime/audit";
import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { auditOpensAt } from "@/lib/game/mode";
import type { GameState } from "@/lib/game/types";
import type { VoteCensus } from "@/lib/voteTally";

export function useAudit(
  socket: Socket | null,
  roomId: string | null,
  game: GameState,
  // This captain's own id, for reading their own nomination back out of
  // the tally. The voyage state does not carry it: a GameState is one
  // captain's books, and which captain they belong to is the session's
  // business rather than the ledger's.
  myUserId: string,
): {
  canVote: boolean;
  myVote: string | null;
  votes: Record<string, string>;
  census: VoteCensus | null;
  reveal: AuditRevealPayload | null;
  error: string | null;
  clearError: () => void;
  vote: (targetUserId: string) => void;
} {
  const [held, setHeld] = useState<AuditTallyPayload | null>(null);
  // Deliberately not stamped with a leg the way the tally is: one voyage
  // has one reveal, so a reveal with the right room is this voyage's.
  const [reveal, setReveal] = useState<AuditRevealPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The leg this captain has pressed in and not yet been answered about.
  // The guard is a number rather than a boolean so a press can never wedge
  // the button past the leg it belongs to: the leg turning clears it, the
  // same way the leg turning is what changes the button's other terms.
  const [pressed, setPressed] = useState<number | null>(null);

  useEffect(() => {
    if (!socket || !roomId) return;

    const onTally = (data: AuditTallyPayload) => {
      if (data?.roomId !== roomId) return;
      setHeld(data);
      // Answered, but only the press this frame answers: a tally is
      // broadcast for every ballot in the room, and one raised by another
      // captain's ballot is not this captain's press coming home. Clearing
      // on it would put the button back while the first press is still in
      // flight, and the follow-up press would come back refused for a
      // press the captain does not remember making. The frame that carries
      // this captain's own name is the count their press was answered by,
      // and the refusal frame is the other answer.
      if (data.votes?.[myUserId]) setPressed(null);
    };
    const onReveal = (data: AuditRevealPayload) => {
      if (data?.roomId !== roomId) return;
      setReveal(data);
    };
    const onRefused = (data: { roomId?: string; error?: string }) => {
      if (data?.roomId !== roomId) return;
      if (typeof data.error !== "string" || !data.error) return;
      setError(data.error);
      setPressed(null);
    };
    // A new voyage has no audit and no nominations, which is also the
    // signal a client gets for the room it is already sitting in.
    const onRestarted = (data: { roomId?: string }) => {
      if (data?.roomId !== roomId) return;
      setHeld(null);
      setReveal(null);
      setError(null);
      setPressed(null);
    };

    socket.on("audit:tally", onTally);
    socket.on("audit:reveal", onReveal);
    socket.on("audit:error", onRefused);
    socket.on("room:restarted", onRestarted);
    return () => {
      socket.off("audit:tally", onTally);
      socket.off("audit:reveal", onReveal);
      socket.off("audit:error", onRefused);
      socket.off("room:restarted", onRestarted);
    };
  }, [socket, roomId, myUserId]);

  const opensAt = auditOpensAt(game.mode);

  // The count as it stands, asked for when this captain's screen turns to
  // a checkpoint the card is drawn in. A leg's book is built by the
  // captains in it and the empty one is never broadcast, so without this a
  // card opened before anyone has voted has nothing to show: no count, no
  // threshold and no list of who the room is waiting on. The ask is a
  // read, so asking again costs nothing, and the answer arrives as the
  // ordinary tally frame rather than as a shape of its own.
  //
  // Asked again on a reconnect, the way the path draft asks for its hand:
  // a socket that dropped mid Parley and came back was sent no frames
  // while it was gone, so the count it is holding is the count from
  // before, and the checkpoint it is standing at is the one worth asking
  // about.
  useEffect(() => {
    if (!socket || !roomId) return;
    if (opensAt === null) return;
    const ask = () => {
      if (game.phase !== "parley") return;
      if (game.currentRound < opensAt) return;
      socket.emit("audit:state:request", {
        roomId,
        round: game.currentRound,
      });
    };
    ask();
    socket.on("connect", ask);
    return () => {
      socket.off("connect", ask);
    };
  }, [socket, roomId, opensAt, game.phase, game.currentRound]);

  // The nominations of the leg this client is standing in, or an empty
  // board. A tally from an older leg is not shown, for the reason the
  // objective's board is clamped: what is on screen should be what is
  // true now, and a stale tally would name captains the room is no longer
  // voting on.
  const live =
    held && held.roomId === roomId && held.round === game.currentRound
      ? held
      : null;
  const votes = live?.votes ?? {};
  const census: VoteCensus | null = live
    ? {
        roster: live.roster ?? 0,
        needed: live.needed ?? 0,
        awaiting: live.awaiting ?? [],
      }
    : null;
  const thisReveal = reveal?.roomId === roomId ? reveal : null;
  // The captain's own nomination, so the panel can show what they said
  // and stop offering the button.
  const myVote = thisReveal ? null : (votes[myUserId] ?? null);

  // Parley is half of the audit's price and not just its moment: a carried
  // audit spends the rest of that leg's trading, so the button is offered
  // only where the room is standing at the checkpoint the vote is called
  // from.
  //
  // The rung is read off the mode record rather than off a constant, for
  // the reason the panel gives: a mode whose rung is null opens no
  // manifest, so the first term below is the whole of the mode gate and
  // there is no second one to keep in step with it.
  //
  // The last term is the press in flight. The server refuses a second
  // nomination at the root (see recordAuditVote), and this is not a second
  // authority over that rule: it is so the press a captain already made
  // cannot be made again by a bounce on the same button, which is the way
  // a captain would otherwise watch their own count move.
  const canVote =
    !!socket &&
    !!roomId &&
    opensAt !== null &&
    game.phase === "parley" &&
    game.currentRound >= opensAt &&
    !thisReveal &&
    !myVote &&
    pressed !== game.currentRound;

  const vote = useCallback(
    (targetUserId: string) => {
      if (!socket || !roomId) return;
      setError(null);
      setPressed(game.currentRound);
      const payload: AuditVotePayload = {
        roomId,
        round: game.currentRound,
        targetUserId,
      };
      socket.emit("audit:vote", payload);
    },
    [socket, roomId, game.currentRound],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    canVote,
    myVote,
    votes,
    census,
    reveal: thisReveal,
    error,
    clearError,
    vote,
  };
}
