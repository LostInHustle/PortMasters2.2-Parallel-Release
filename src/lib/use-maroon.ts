"use client";

// =====================================================================
// Maroon and the Harbormaster, client side.
//
// Three pieces of state, all broadcast and all stamped with the room they
// belong to for the reason the audit's are: a captain who sails out of
// one harbor and into another must never see the last one's business on
// the new one's screen.
//
//   The tally is the nominations for one leg, held as the whole frame the
//   server sent rather than the map out of it, and replaced rather than
//   merged, because the server sends the whole count every time and the
//   whole count is the truth. It is also the count this side cannot work
//   out for itself: the roster the vote is divided by is the server's
//   active roster, so the names that carry it and the captains still to
//   speak ride the frame (see MaroonTally in @/types/realtime/maroon). It
//   is answered to this captain when their card opens and nobody has
//   voted yet, the same ask the audit's hook makes.
//
//   The refusal is this captain's own press coming back: a plain string
//   for the panel to print, cleared by the panel's dismiss or by the next
//   press. The lever gets one of its own rather than sharing this one,
//   because the two presses are drawn on two surfaces that never stand
//   together: the card is gone by the time the result exists, and only the
//   captain the result named ever sees the console, so a refusal that
//   landed in the card's block would reach nobody on the one surface it
//   belongs to.
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
// The local rules for whether this captain may vote or lean are derived
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
import { refusedForRoom } from "@/lib/refusals";
import type { VoteCensus } from "@/lib/voteTally";

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
  census: VoteCensus | null;
  result: MaroonResultPayload | null;
  /** The captain the vote carried on, once one has, else null. */
  carried: { userId: string; name: string } | null;
  error: string | null;
  clearError: () => void;
  vote: (targetUserId: string) => void;
  canShift: boolean;
  ports: string[];
  shift: PortShiftNotice | null;
  shiftError: string | null;
  clearShiftError: () => void;
  callShift: (port: string, direction: 1 | -1) => void;
} {
  const [held, setHeld] = useState<MaroonTallyPayload | null>(null);
  const [result, setResult] = useState<MaroonResultPayload | null>(null);
  const [shift, setShift] = useState<PortShiftNotice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shiftError, setShiftError] = useState<string | null>(null);
  // The leg this captain has pressed in and not yet been answered about,
  // exactly as the audit's hook holds its own: a number rather than a
  // boolean, so the leg turning is what lifts it and no press can wedge
  // the button past the leg it belongs to.
  const [pressed, setPressed] = useState<number | null>(null);

  useEffect(() => {
    if (!socket || !roomId) return;

    const onTally = (data: MaroonTallyPayload) => {
      if (data?.roomId !== roomId) return;
      setHeld(data);
      // Answered, but only the press this frame answers, the same rule
      // the audit's hook carries: a tally is broadcast for every ballot in
      // the room, so clearing on another captain's ballot would put the
      // button back while this captain's press is still in flight. The
      // frame that carries this captain's own name is the count their
      // press was answered by, and the refusal frame is the other answer.
      if (data.votes?.[myUserId]) setPressed(null);
    };
    const onResult = (data: MaroonResultPayload) => {
      if (data?.roomId !== roomId) return;
      setResult(data);
    };
    const onShift = (data: PortShiftNotice) => {
      if (data?.roomId !== roomId) return;
      setShift(data);
    };
    const onRefused = (data: { roomId?: string; error?: string }) => {
      const err = refusedForRoom(data, roomId);
      if (!err) return;
      setError(err);
      setPressed(null);
    };
    // The lever's own refusal, read the same way and held apart from the
    // vote's: the console is the only surface that prints it.
    const onShiftRefused = (data: { roomId?: string; error?: string }) => {
      const err = refusedForRoom(data, roomId);
      if (!err) return;
      setShiftError(err);
    };
    // A new voyage has no vote, no result and no leaning port, which is
    // also the signal a client gets for the room it is already sitting in.
    const onRestarted = (data: { roomId?: string }) => {
      if (data?.roomId !== roomId) return;
      setHeld(null);
      setResult(null);
      setShift(null);
      setError(null);
      setShiftError(null);
      setPressed(null);
    };

    socket.on("maroon:tally", onTally);
    socket.on("maroon:result", onResult);
    socket.on("maroon:shift", onShift);
    socket.on("maroon:error", onRefused);
    socket.on("maroon:shift:error", onShiftRefused);
    socket.on("room:restarted", onRestarted);
    return () => {
      socket.off("maroon:tally", onTally);
      socket.off("maroon:result", onResult);
      socket.off("maroon:shift", onShift);
      socket.off("maroon:error", onRefused);
      socket.off("maroon:shift:error", onShiftRefused);
      socket.off("room:restarted", onRestarted);
    };
  }, [socket, roomId, myUserId]);

  // The vote that carried, applied to the books it took.
  //
  // This is the one place a captain's client runs a rule on somebody
  // else's word, so it is written to be safe to run twice: the engine
  // function returns immediately if the mark is already on the state (see
  // maroonSeat), which is what a development build's doubled effect and a
  // reconnect's replayed handoff both need, and which matters because
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

  // The count as it stands, asked for when this captain's screen turns to
  // a checkpoint the card is drawn in, which is the same ask the audit's
  // hook makes at the same moment and for the same reason: a leg's book is
  // built by the captains in it and the empty one is never broadcast, so a
  // card opened before anyone has voted has nothing to show without it.
  //
  // Asked again on a reconnect, the twin of the audit's ask: a socket that
  // dropped mid Parley and came back was sent no frames while it was gone,
  // so the count it is holding is the count from before, and the
  // checkpoint it is standing at is the one worth asking about.
  useEffect(() => {
    if (!socket || !roomId) return;
    if (rung === null) return;
    const ask = () => {
      if (game.phase !== "parley") return;
      if (game.currentRound < rung) return;
      socket.emit("maroon:state:request", {
        roomId,
        round: game.currentRound,
      });
    };
    ask();
    socket.on("connect", ask);
    return () => {
      socket.off("connect", ask);
    };
  }, [socket, roomId, rung, game.phase, game.currentRound]);

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
  const myVote = applied ? null : (votes[myUserId] ?? null);
  // The vote this voyage already had, when the frame says one carried.
  // The nominations die with the vote that carried, so without this a
  // state request answered after the carry would read exactly like a
  // fresh leg: an empty book, a full waiting list and a button offering
  // a press the server would refuse. Held off the frame rather than
  // derived, because the server's record is what the ask is about.
  const carried = live?.carried ?? null;

  const atTable =
    !!socket &&
    !!roomId &&
    rung !== null &&
    game.phase === "parley" &&
    game.currentRound >= rung;

  // The press in flight is the last term, the same guard the audit's vote
  // carries and for the same reason: the server refuses a second
  // nomination at the root, and this only makes sure the one press a
  // captain gets cannot be spent twice by a bounce on the button.
  const canVote =
    atTable && !applied && !carried && !myVote && pressed !== game.currentRound;

  const vote = useCallback(
    (targetUserId: string) => {
      if (!socket || !roomId) return;
      setError(null);
      setPressed(game.currentRound);
      const payload: MaroonVotePayload = {
        roomId,
        round: game.currentRound,
        targetUserId,
      };
      socket.emit("maroon:vote", payload);
    },
    [socket, roomId, game.currentRound],
  );

  const clearError = useCallback(() => setError(null), []);
  const clearShiftError = useCallback(() => setShiftError(null), []);

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
      // The last refusal belongs to the press that earned it, exactly as
      // the vote's does: a second press clears it before the answer to the
      // first could be misread as the answer to this one.
      setShiftError(null);
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
    census,
    result: applied,
    carried,
    error,
    clearError,
    vote,
    canShift,
    ports,
    shift: liveShift,
    shiftError,
    clearShiftError,
    callShift,
  };
}
