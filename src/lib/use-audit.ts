"use client";

// =====================================================================
// The Manifest Audit, client side.
//
// Four pieces of state, three of them broadcast and every one of them
// stamped with the harbor it belongs to for the same reason the private log
// and the commission board are: a captain who sails straight out of one
// harbor into another must never see the last harbor's business on the
// new one's screen.
//
//   The tally is the nominations for one round, and it is the whole frame
//   the server sent rather than the map out of it. It arrives after every
//   vote, including the one that carries, it is answered to this captain
//   when their card opens and nobody has voted yet (see the state request
//   below), and it is replaced rather than merged, because the server
//   sends the whole count every time and the whole count is the truth.
//   The tally, the press in flight and the refusal are the shared board's
//   (see ./use-vote-board), which the maroon vote is read through too.
//
//   The reveal is the finding, and it is the one thing here that outlives
//   the round it happened in. It arrives either as the vote carrying or as
//   the join handoff when a captain reloads into a harbor that has
//   already audited someone (see the room:join handler in
//   src/server/realtime/wiring/room-join.ts), and the two paths carry the
//   identical frame so nothing here has to know which one it was.
//
//   The refusal is this captain's own press coming back. It is a plain
//   string for the panel to print, and it is cleared by the panel's own
//   dismiss or by the next press: a sentence about a vote that has since
//   moved is a sentence about nothing.
//
// The local rule for whether this captain may vote is derived rather
// than asked for, because every part of it is already on this side of the
// wire: the mode, the phase, the round and whether the audit is spent. What
// is NOT derived is the count: how many names carry the vote is the
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
import { useEffect, useMemo, useState } from "react";
import type { Socket } from "socket.io-client";
import { auditOpensAt } from "@/lib/game/mode";
import type { GameState } from "@/lib/game/types";
import { useVoteBoard, type VoteChannel } from "@/lib/use-vote-board";
import type { VoteCensus } from "@/lib/voteTally";

// The events this vote speaks on, named in one place for the reason the
// bazaar's and the two consent boards' own channels are. The press is
// built here so that the payload this client sends is typed by the wire's
// own shape.
const CHANNEL: VoteChannel<AuditVotePayload> = {
  tally: "audit:tally",
  error: "audit:error",
  stateRequest: "audit:state:request",
  vote: "audit:vote",
  press: (roomId, round, targetUserId) => ({ roomId, round, targetUserId }),
};

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
  // Deliberately not stamped with a round the way the tally is: one voyage
  // has one reveal, so a reveal with the right harbor is this voyage's.
  const [reveal, setReveal] = useState<AuditRevealPayload | null>(null);

  const opensAt = auditOpensAt(game.mode);
  const {
    setHeld,
    setPressed,
    onRefused,
    reset,
    votes,
    census,
    atTable,
    pressed,
    error,
    clearError,
    vote,
  } = useVoteBoard<AuditTallyPayload, AuditVotePayload>(
    socket,
    roomId,
    game,
    opensAt,
    CHANNEL,
  );

  useEffect(() => {
    if (!socket || !roomId) return;

    const onTally = (data: AuditTallyPayload) => {
      if (data?.roomId !== roomId) return;
      setHeld(data);
      // Answered, but only the press this frame answers: a tally is
      // broadcast for every ballot in the harbor, and one raised by another
      // captain's ballot is not this captain's press coming home. Clearing
      // on it would put the button back while the first press is still in
      // flight, and the press that follows would come back refused for a
      // press the captain does not remember making. The frame that carries
      // this captain's own name is the count their press was answered by,
      // and the refusal frame is the other answer.
      if (data.votes?.[myUserId]) setPressed(null);
    };
    const onReveal = (data: AuditRevealPayload) => {
      if (data?.roomId !== roomId) return;
      setReveal(data);
    };
    // A new voyage has no audit and no nominations, which is also the
    // signal a client gets for the harbor it is already sitting in.
    const onRestarted = (data: { roomId?: string }) => {
      if (data?.roomId !== roomId) return;
      reset();
      setReveal(null);
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
  }, [socket, roomId, myUserId, setHeld, setPressed, onRefused, reset]);

  const thisReveal = reveal?.roomId === roomId ? reveal : null;
  // The captain's own nomination, so the panel can show what they said
  // and stop offering the button.
  const myVote = thisReveal ? null : (votes[myUserId] ?? null);

  // Parley is half of the audit's price and not just its moment: a carried
  // audit spends the rest of that round's trading, so the button is offered
  // only where the harbor is standing at the checkpoint the vote is called
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
    atTable && !thisReveal && !myVote && pressed !== game.currentRound;

  // The answer, held to one identity until something inside it changes.
  // The panel that draws the audit takes this whole object as a prop, so
  // an object rebuilt every render is a panel that draws itself again
  // every time anything above it does.
  return useMemo(
    () => ({
      canVote,
      myVote,
      votes,
      census,
      reveal: thisReveal,
      error,
      clearError,
      vote,
    }),
    [canVote, myVote, votes, census, thisReveal, error, clearError, vote],
  );
}
