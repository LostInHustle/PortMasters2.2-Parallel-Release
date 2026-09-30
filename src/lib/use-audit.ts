"use client";

// =====================================================================
// The Manifest Audit, client side.
//
// Two pieces of state, both broadcast, both stamped with the room they
// belong to for the same reason the private log and the commission board
// are: a captain who sails straight out of one harbor into another must
// never see the last harbor's business on the new one's screen.
//
//   The tally is the nominations for one leg. It arrives after every vote,
//   including the one that carries, and it is replaced rather than merged,
//   because the server sends the whole map every time and the whole map is
//   the truth: a vote that was refused server side simply never appears.
//
//   The reveal is the finding, and it is the one thing here that outlives
//   the leg it happened in. It arrives either as the vote carrying or as
//   the join hand-out when a captain reloads into a harbor that has
//   already audited someone (see the room:join handler in
//   src/server/realtime/index.ts), and the two paths carry the identical
//   frame so nothing here has to know which one it was.
//
// The local rule for whether this captain may vote is re-derived rather
// than asked for, because every part of it is already on this side of the
// wire: the mode, the phase, the leg and whether the audit is spent. The
// server applies the same rules again, and it is the server's answer that
// counts; this is only so the button is not offered where the vote would
// be thrown away.
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
  reveal: AuditRevealPayload | null;
  vote: (targetUserId: string) => void;
} {
  const [held, setHeld] = useState<{
    roomId: string;
    round: number;
    votes: Record<string, string>;
  } | null>(null);
  // Deliberately not stamped with a leg the way the tally is: one voyage
  // has one reveal, so a reveal with the right room is this voyage's.
  const [reveal, setReveal] = useState<AuditRevealPayload | null>(null);

  useEffect(() => {
    if (!socket || !roomId) return;

    const onTally = (data: AuditTallyPayload) => {
      if (data?.roomId !== roomId) return;
      setHeld({ roomId, round: data.round, votes: data.votes ?? {} });
    };
    const onReveal = (data: AuditRevealPayload) => {
      if (data?.roomId !== roomId) return;
      setReveal(data);
    };
    // A new voyage has no audit and no nominations, which is also the
    // signal a client gets for the room it is already sitting in.
    const onRestarted = (data: { roomId?: string }) => {
      if (data?.roomId !== roomId) return;
      setHeld(null);
      setReveal(null);
    };

    socket.on("audit:tally", onTally);
    socket.on("audit:reveal", onReveal);
    socket.on("room:restarted", onRestarted);
    return () => {
      socket.off("audit:tally", onTally);
      socket.off("audit:reveal", onReveal);
      socket.off("room:restarted", onRestarted);
    };
  }, [socket, roomId]);

  // The nominations of the leg this client is standing in, or an empty
  // board. A tally from an older leg is not shown, for the reason the
  // objective's board is clamped: what is on screen should be what is
  // true now, and a stale tally would name captains the room is no longer
  // voting on.
  const votes =
    held?.roomId === roomId && held.round === game.currentRound
      ? held.votes
      : {};
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
  const opensAt = auditOpensAt(game.mode);
  const canVote =
    !!socket &&
    !!roomId &&
    opensAt !== null &&
    game.phase === "parley" &&
    game.currentRound >= opensAt &&
    !thisReveal &&
    !myVote;

  const vote = useCallback(
    (targetUserId: string) => {
      if (!socket || !roomId) return;
      const payload: AuditVotePayload = {
        roomId,
        round: game.currentRound,
        targetUserId,
      };
      socket.emit("audit:vote", payload);
    },
    [socket, roomId, game.currentRound],
  );

  return { canVote, myVote, votes, reveal: thisReveal, vote };
}
