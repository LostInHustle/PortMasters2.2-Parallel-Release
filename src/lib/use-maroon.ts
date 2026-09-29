"use client";

// =====================================================================
// Maroon and the Harbormaster, client side.
//
// Three pieces of state, all broadcast and all stamped with the room they
// belong to for the reason the audit's are: a captain who sails out of
// one harbor and into another must never see the last one's business on
// the new one's screen.
//
//   The tally is the nominations for one leg, replaced rather than
//   merged, because the server sends the whole map every time and the
//   whole map is the truth.
//
//   The result is the vote that carried. It outlives the leg it happened
//   in, and it is the one broadcast in the game that changes the captain
//   it names: the hook applies it to their own books, once, which is why
//   this hook takes `act` where the audit's does not.
//
//   The shift is the Harbormaster's last call, stamped with the leg it was
//   called in, which is what lets a screen say whether it has landed yet.
//   The market itself has already been priced by the time a screen could
//   read this: the durable copy arrives on the phase advance (see
//   applyPortShift), and this notice is what the room reads.
//
// The local rules for whether this captain may vote or lean are re-derived
// rather than asked for, the same way the audit's are, because every part
// of them is already on this side of the wire. The server applies the same
// rules again and it is the server's answer that counts.
// =====================================================================

import {
  MaroonResult as MaroonResultPayload,
  MaroonTally as MaroonTallyPayload,
  MaroonVote as MaroonVotePayload,
  PortShiftCall,
  PortShiftNotice,
} from "@/types/realtime/maroon";
import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { maroonSeat } from "@/lib/game/engine";
import { modeConfig } from "@/lib/game/mode";
import { unlockedPorts } from "@/lib/game/pools";
import type { GameState } from "@/lib/game/types";

export function useMaroon(
  socket: Socket | null,
  roomId: string | null,
  game: GameState,
  // This captain's own id, for reading their own nomination back out of
  // the tally and for knowing whether the result is about them. The voyage
  // state does not carry it: a GameState is one captain's books, and which
  // captain they belong to is the session's business rather than the
  // ledger's.
  myUserId: string,
  act: (fn: (g: GameState, logs: string[]) => void) => void,
): {
  canVote: boolean;
  myVote: string | null;
  votes: Record<string, string>;
  result: MaroonResultPayload | null;
  vote: (targetUserId: string) => void;
  canShift: boolean;
  ports: string[];
  shift: PortShiftNotice | null;
  callShift: (port: string, direction: 1 | -1) => void;
} {
  const [held, setHeld] = useState<{
    roomId: string;
    round: number;
    votes: Record<string, string>;
  } | null>(null);
  const [result, setResult] = useState<MaroonResultPayload | null>(null);
  const [shift, setShift] = useState<PortShiftNotice | null>(null);

  useEffect(() => {
    if (!socket || !roomId) return;

    const onTally = (data: MaroonTallyPayload) => {
      if (data?.roomId !== roomId) return;
      setHeld({ roomId, round: data.round, votes: data.votes ?? {} });
    };
    const onResult = (data: MaroonResultPayload) => {
      if (data?.roomId !== roomId) return;
      setResult(data);
    };
    const onShift = (data: PortShiftNotice) => {
      if (data?.roomId !== roomId) return;
      setShift(data);
    };
    // A new voyage has no vote, no result and no leaning port, which is
    // also the signal a client gets for the room it is already sitting in.
    const onRestarted = (data: { roomId?: string }) => {
      if (data?.roomId !== roomId) return;
      setHeld(null);
      setResult(null);
      setShift(null);
    };

    socket.on("maroon:tally", onTally);
    socket.on("maroon:result", onResult);
    socket.on("maroon:shift", onShift);
    socket.on("room:restarted", onRestarted);
    return () => {
      socket.off("maroon:tally", onTally);
      socket.off("maroon:result", onResult);
      socket.off("maroon:shift", onShift);
      socket.off("room:restarted", onRestarted);
    };
  }, [socket, roomId]);

  // The vote that carried, applied to the books it took.
  //
  // This is the one place a captain's client runs a rule on somebody
  // else's say-so, so it is written to be safe to run twice: the engine
  // function returns immediately if the mark is already on the state (see
  // maroonSeat), which is what a development build's doubled effect and a
  // reconnect's replayed hand-out both need, and which matters because
  // there is half a captain's Gold in the arithmetic.
  const applied = result?.roomId === roomId ? result : null;
  useEffect(() => {
    if (!applied) return;
    if (applied.target.userId !== myUserId) return;
    if (game.marooned) return;
    act((g, l) => maroonSeat(g, l));
  }, [applied, myUserId, game.marooned, act]);

  const config = modeConfig(game.mode);
  const rung = config.maroonFrom;

  const votes =
    held?.roomId === roomId && held.round === game.currentRound
      ? held.votes
      : {};
  const myVote = applied ? null : (votes[myUserId] ?? null);

  const atTable =
    !!socket &&
    !!roomId &&
    rung !== null &&
    game.phase === "parley" &&
    game.currentRound >= rung;

  const canVote = atTable && !applied && !myVote;

  const vote = useCallback(
    (targetUserId: string) => {
      if (!socket || !roomId) return;
      const payload: MaroonVotePayload = {
        roomId,
        round: game.currentRound,
        targetUserId,
      };
      socket.emit("maroon:vote", payload);
    },
    [socket, roomId, game.currentRound],
  );

  // The Harbormaster's console is offered for the rest of the voyage, and
  // the leg before the last one is where it stops: a call lands on the
  // market that opens after it, so a call made in the closing leg would
  // lean a market that never opens. The ports are the ones the coming leg
  // has unlocked, which is the same list the server checks the call
  // against (see unlockedPorts and recordPortShift).
  const canShift =
    !!socket &&
    !!roomId &&
    game.marooned &&
    rung !== null &&
    game.currentRound >= rung &&
    game.currentRound < game.maxRounds &&
    game.phase === "parley";
  const ports = canShift
    ? unlockedPorts(game.difficulty, game.currentRound + 1)
    : [];
  // The notice is handed on as it arrived, stamped with the room and
  // carrying the leg it was called in, because two surfaces read it in
  // two tenses: a call made this leg has not opened a market yet, and a
  // call made last leg is the one every price on screen is being read
  // against. Which of the two a screen is looking at is a question about
  // the leg, so it is answered where the leg is in hand.
  const liveShift = shift?.roomId === roomId ? shift : null;

  const callShift = useCallback(
    (port: string, direction: 1 | -1) => {
      if (!socket || !roomId) return;
      const payload: PortShiftCall = {
        roomId,
        round: game.currentRound,
        port,
        direction,
      };
      socket.emit("maroon:shift", payload);
    },
    [socket, roomId, game.currentRound],
  );

  return {
    canVote,
    myVote,
    votes,
    result: applied,
    vote,
    canShift,
    ports,
    shift: liveShift,
    callShift,
  };
}
