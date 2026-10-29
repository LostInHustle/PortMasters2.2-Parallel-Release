"use client";

// =====================================================================
// The board the harbor's two votes are read through.
//
// The Manifest Audit and the maroon vote are the same hook over two
// channels: a captain nominates a captain, the harbor's count comes back
// whole on the tally frame, and a refusal is a sentence for the panel to
// print. Written twice, the two copies were free to disagree about the
// press in flight and about the count a card draws, and the count is the
// part both cards read (see VoteCensus in ./vote-tally).
//
// What is not shared here is the part that is not the same: each channel
// carries frames of its own (the audit's finding, the maroon's result and
// the Harbormaster's call), so each hook keeps its own subscription and
// hands this board the frames it owns.
// =====================================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Socket } from "socket.io-client";
import type { GameState } from "@/lib/game/types";
import { refusedForRoom } from "@/lib/refusals";
import type { VoteCensus } from "@/lib/vote-tally";

/**
 * The tally frame both votes answer with, and the fields of it the two
 * wires agree on. The maroon's frame carries one field more, the captain
 * the vote carried on, which the maroon's own hook reads off the frame it
 * is handed.
 */
type VoteTallyFrame = {
  roomId: string;
  round: number;
  /** Voter id to the captain they nominated. */
  votes: Record<string, string>;
  roster?: number;
  needed?: number;
  awaiting?: string[];
};

/**
 * The press a nomination makes: the three fields both wires carry (see
 * AuditVote in @/types/realtime/audit and MaroonVote in
 * @/types/realtime/maroon, which are the same shape).
 */
type VotePress = {
  roomId: string;
  round: number;
  targetUserId: string;
};

/**
 * The events one channel speaks on, which is the whole of what the two
 * votes differ on at this layer: the same shapes on the wire under
 * different names.
 *
 * The press is built through the channel rather than here so that the
 * payload a client sends is typed by the wire's own shape, the same way
 * the boon's report is (see use-boon-ledger): a claim this side makes and
 * the frame the harbor reads back cannot drift apart.
 */
export type VoteChannel<P extends VotePress = VotePress> = {
  /** The event this client asks for the count on. */
  stateRequest: string;
  /** The event a nomination is sent on. */
  vote: string;
  /** The press this channel sends, built from the wire's own shape. */
  press: (roomId: string, round: number, targetUserId: string) => P;
};

/**
 * One captain's side of a vote at the table: the count as it stands, the
 * press in flight, the refusal, and the two calls the harbor answers.
 *
 * The count is the tally frame the server sent, held whole rather than the
 * map out of it, and replaced rather than merged, because the server sends
 * the whole count every time and the whole count is the truth. It is also
 * the count this side cannot work out for itself: the roster the vote is
 * divided by is the server's active roster, so the names that carry it and
 * the captains still to speak ride the frame.
 *
 * The press in flight is a number rather than a boolean so a press can
 * never wedge the button past the round it belongs to: the round turning
 * clears it, the same way the round turning is what changes the button's
 * other terms.
 */
export function useVoteBoard<T extends VoteTallyFrame, P extends VotePress>(
  socket: Socket | null,
  roomId: string | null,
  game: GameState,
  // The round this vote opens at, or null for a mode that opens no vote.
  rung: number | null,
  channel: VoteChannel<P>,
) {
  const [held, setHeld] = useState<T | null>(null);
  // The round this captain has pressed in and not yet been answered about.
  const [pressed, setPressed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The refusal, read through the one guard (see ./refusals) and held
  // apart from the count: the sentence belongs to the panel, and the count
  // belongs to the card.
  const onRefused = useCallback(
    (data: { roomId?: string; error?: string }) => {
      // A harbor that is not settled is a harbor this client is not sitting
      // in, and the hook is only ever wired to a socket in one.
      if (!roomId) return;
      const err = refusedForRoom(data, roomId);
      if (!err) return;
      setError(err);
      // A refused press is a press that is answered, so the button may
      // be offered again rather than left latched to a round that is done.
      setPressed(null);
    },
    [roomId],
  );

  // A new voyage has no vote and no nominations, which is also the signal
  // a client gets for the harbor it is already sitting in.
  const reset = useCallback(() => {
    setHeld(null);
    setError(null);
    setPressed(null);
  }, []);

  // The count as it stands, asked for when this captain's screen turns to
  // a checkpoint the card is drawn in. A round's book is built by the
  // captains in it and the empty one is never broadcast, so without this a
  // card opened before anyone has voted has nothing to show: no count, no
  // threshold and no list of who the harbor is waiting on. The ask is a
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
    if (rung === null) return;
    const ask = () => {
      if (game.phase !== "parley") return;
      if (game.currentRound < rung) return;
      socket.emit(channel.stateRequest, {
        roomId,
        round: game.currentRound,
      });
    };
    ask();
    socket.on("connect", ask);
    return () => {
      socket.off("connect", ask);
    };
  }, [
    socket,
    roomId,
    rung,
    game.phase,
    game.currentRound,
    channel.stateRequest,
  ]);

  // The press. It carries the captain this captain names and the round the
  // nomination belongs to, and nothing else: the harbor holds the book, so
  // it already knows who is at the table.
  const vote = useCallback(
    (targetUserId: string) => {
      if (!socket || !roomId) return;
      setError(null);
      setPressed(game.currentRound);
      socket.emit(
        channel.vote,
        channel.press(roomId, game.currentRound, targetUserId),
      );
    },
    [socket, roomId, game.currentRound, channel],
  );

  // The nominations of the round this client is standing in, or an empty
  // board. A tally from an older round is not shown, for the reason the
  // objective's board is clamped: what is on screen should be what is
  // true now, and a stale tally would name captains the harbor is no longer
  // voting on.
  const live =
    held && held.roomId === roomId && held.round === game.currentRound
      ? held
      : null;
  // The two readings the panels take, held until the tally they come from
  // changes. Both are objects, and an object rebuilt on every render is a
  // board that looks new to everything that holds it.
  const votes = useMemo(() => live?.votes ?? {}, [live]);
  const census: VoteCensus | null = useMemo(
    () =>
      live
        ? {
            roster: live.roster ?? 0,
            needed: live.needed ?? 0,
            awaiting: live.awaiting ?? [],
          }
        : null,
    [live],
  );

  // Where the harbor is standing, for the press that is offered. The rung is
  // read off the mode record rather than off a constant, for the reason
  // the panels give: a mode whose rung is null opens no vote, so the first
  // term below is the whole of the mode gate and there is no second one to
  // keep in step with it.
  const atTable =
    !!socket &&
    !!roomId &&
    rung !== null &&
    game.phase === "parley" &&
    game.currentRound >= rung;

  const clearError = useCallback(() => setError(null), []);

  // The answer, held to one identity until something inside it changes.
  // The two hooks above read this board and pass their own answers on as
  // props, and an object rebuilt every render is a board that looks new
  // to everything downstream of it.
  return useMemo(
    () => ({
      setHeld,
      pressed,
      setPressed,
      error,
      clearError,
      onRefused,
      reset,
      live,
      votes,
      census,
      atTable,
      vote,
    }),
    [
      pressed,
      error,
      clearError,
      onRefused,
      reset,
      live,
      votes,
      census,
      atTable,
      vote,
    ],
  );
}
