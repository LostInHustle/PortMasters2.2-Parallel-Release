"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { GameContext, GameState } from "@/lib/game/types";
import {
  applyMarketLeans,
  autoCommit,
  canLeavePhase,
  restartGame,
  snapToCheckpoint,
  tallyPurchasesByResource,
} from "@/lib/game/engine";
import { renownStartingGoldBonus, type HouseId } from "@/lib/game/legacy";
import { normalizeDifficulty } from "@/lib/game/difficulty";
import { normalizeMode } from "@/lib/game/mode";
import {
  checkpointRank,
  isGatedPhase,
  openingPhase,
} from "@/lib/game/checkpoint";
import { normalizePhase, seatOf } from "@/lib/game/phases";
import { api } from "@/lib/api";
import type { PhaseDeadline } from "@/lib/phase-clock";
import type { LedgerAct, LedgerWrite } from "@/lib/game/ledger";
import { t } from "@/lib/game/i18n";
import type {
  PhaseAdvanceFrame,
  PhaseReadyFrame,
} from "@/types/realtime/phase";

// The frame shape lives in @/types/realtime/phase so the server and this
// hook cannot drift. The alias keeps the historical name.
export type ReadyState = PhaseReadyFrame;

// The frame plus the moment this client saw it. The server armed the
// deadline before the frame arrived, so the countdown is measured from our
// receipt (see @/lib/use-phase-clock), not from a render.
type ObservedReady = ReadyState & { observedAt: number };

// One sentence for the ready count, so the rail and the control bar cannot
// word it two ways.
export function readyLine(readyCount: number, requiredCount: number): string {
  return t("{readyCount} of {requiredCount} captains {haveWord} readied.", {
    readyCount,
    requiredCount,
    haveWord: readyCount === 1 ? "has" : "have",
  });
}

// Phase order and wire values are read through the shared checkpoint and
// phases modules so client and realtime never drift.

// Options as one object, so callers name values instead of relying on
// positional strings.
type PhaseSyncOptions = {
  roomId: string;
  socket: Socket | null;
  game: GameState;
  act: LedgerAct;
  // Session seed identity. autoCommit needs it because a departure draws a
  // boon or a market from it; this hook does not derive it.
  ctx: GameContext;
  authed: boolean;
  myUserId: string;
  startingGoldBonus?: number;
};

/**
 * Gates shared phase transitions behind a harbor wide ready check.
 * `markReady` only tells the server this captain is done; the engine call
 * fires when the `phase:advance` broadcast arrives and every client runs
 * the same deterministic transition locally.
 *
 * Starting the voyage is not part of the vote: the host emits `room:start`
 * and everyone runs the opener on `room:started`.
 *
 * The server is the timekeeper. When the clock runs out it announces the
 * advance whether or not everyone readied; a captain holding a choice runs
 * it, and an idle captain runs autoCommit's defaults. Both are the same
 * deterministic transition, so all clients still land together.
 */
export function usePhaseSync({
  roomId,
  socket,
  game,
  act,
  ctx,
  authed,
  myUserId,
  startingGoldBonus = 0,
}: PhaseSyncOptions) {
  const [waiting, setWaiting] = useState(false);
  const [ready, setReady] = useState<ObservedReady | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const pendingFn = useRef<LedgerWrite | null>(null);

  // Latest snapshot for the listeners, without resubscribing them.
  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  // Same pattern: the legacy row loads after mount, so onRestarted reads
  // the current value without resubscribing the effect.
  const goldBonusRef = useRef(startingGoldBonus);
  useEffect(() => {
    goldBonusRef.current = startingGoldBonus;
  }, [startingGoldBonus]);

  // Deadline, seat budget, and the moment this client saw them. Carried as
  // numbers; the ticker lives in use-phase-clock so the shared harbor hook
  // does not redraw every screen once a second.
  const phaseDeadline = useMemo<PhaseDeadline | null>(
    () =>
      ready
        ? {
            endsAt: ready.phaseEndsAt,
            total: ready.phaseSeconds,
            observedAt: ready.observedAt,
          }
        : null,
    [ready],
  );

  useEffect(() => {
    if (!socket) return;

    const onReadyUpdate = (data: PhaseReadyFrame) => {
      if (data.roomId !== roomId) return;
      // Stamp the deadline and its observation together, at the frame's
      // arrival, so the countdown starts from when this seat learned of it.
      setReady({ ...data, observedAt: Date.now() });
      const g = gameRef.current;

      // Read both ranks in the harbor's lap. A captain whose mode disagrees
      // would compare different phase orders and livelock (the two laps
      // differ by one adjacent swap), so the harbor's mode wins. A harbor's
      // mode is fixed at creation, so in a healthy harbor this never fires.
      const roomMode =
        data.mode === undefined ? g.mode : normalizeMode(data.mode);
      if (roomMode !== g.mode) {
        act((state) => {
          state.mode = roomMode;
        });
      }

      // Desync catch-up: the harbor's checkpoint is ahead, so a broadcast
      // was missed. Run the pending transition locally, which advances
      // exactly one phase; a later ready_update repeats the step if needed.
      const serverRank = checkpointRank(
        roomMode,
        data.round,
        normalizePhase(data.phase),
      );
      const clientRank = checkpointRank(roomMode, g.currentRound, g.phase);
      if (
        serverRank !== null &&
        clientRank !== null &&
        serverRank > clientRank
      ) {
        if (pendingFn.current) {
          const fn = pendingFn.current;
          pendingFn.current = null;
          setWaiting(false);
          act(fn);
          return;
        }
        // Only a gated seat can have been run out. The pier is excluded:
        // room:started lays out the opening deal, and committing here would
        // consume those cards before they render.
        if (!isGatedPhase(roomMode, seatOf(g.phase))) return;
        // Idle captain at a seat the clock ran out: leave by the engine's
        // defaults, exactly as the advance broadcast does.
        pendingFn.current = null;
        setWaiting(false);
        act((state, logs) => autoCommit(state, ctx, logs));
        return;
      }
      // Terminals have no rank; personal screens fold into Dusk, so a move
      // to the next round still reads as a move past them.

      // Re-send a ready vote dropped by a transport blip; otherwise the
      // harbor can sit at n minus 1 of n with no error. phase:ready is
      // idempotent, so repeating it is harmless.
      if (
        pendingFn.current &&
        myUserId &&
        data.round === g.currentRound &&
        normalizePhase(data.phase) === g.phase &&
        !data.readyUserIds.includes(myUserId)
      ) {
        socket.emit("phase:ready", {
          roomId,
          round: g.currentRound,
          phase: g.phase,
        });
      }
    };
    // Apply the advance's market leans before the market draws, so
    // genResourceCard prices the server's numbers.
    const onAdvance = (data: PhaseAdvanceFrame) => {
      if (data.roomId !== roomId) return;
      const g = gameRef.current;
      const advanceRank = checkpointRank(
        g.mode,
        data.round,
        normalizePhase(data.phase),
      );
      const clientRank = checkpointRank(g.mode, g.currentRound, g.phase);
      if (advanceRank === null) return;
      // Ignore an advance already passed. Personal screens sit in Dusk and
      // still take the frame; a terminal has no rank and was refused above.
      if (clientRank !== null && advanceRank < clientRank) return;
      // Last moment this captain's market draw is readable before
      // completeMarket clears it. Report the tally, including zero.
      if (g.phase === "market") {
        socket.emit("harbor:pulse:report", {
          roomId,
          round: g.currentRound,
          tally: tallyPurchasesByResource(g),
        });
      }
      // Exact match, or ahead because an earlier advance was missed. Run
      // the held transition if there is one.
      const fn = pendingFn.current;
      pendingFn.current = null;
      setWaiting(false);
      if (fn) {
        act((state, logs) => {
          applyMarketLeans(state, data);
          fn(state, logs);
        });
        return;
      }
      // Same gate before the timeout fallback can run.
      if (!isGatedPhase(g.mode, seatOf(g.phase))) return;
      // No held transition: the clock ran the seat out. Apply the leans
      // and let the engine commit the seat's own defaults.
      act((state, logs) => {
        applyMarketLeans(state, data);
        autoCommit(state, ctx, logs);
      });
    };
    const onStarted = (data: { roomId: string }) => {
      if (data.roomId !== roomId) return;
      const g = gameRef.current;
      // Late reconnects have already left the lobby.
      if (g.currentRound !== 1 || g.phase !== "harbor") return;
      // Run the opener for the phase the server pinned (openingPhase),
      // same direct entry endRound uses; there is no phase to hand off.
      act((state, logs) =>
        snapToCheckpoint(state, ctx, 1, openingPhase(state.mode), logs),
      );
    };
    const onError = (data: { roomId: string; error: string }) => {
      if (data.roomId === roomId) setStartError(data.error);
    };
    // Restart drops every captain to a fresh run. Refetch legacy first so
    // the starting gold bonus reflects Renown just earned, not the value
    // captured at mount.
    const onRestarted = async (data: {
      roomId: string;
      voyageEpoch?: number;
      difficulty?: string;
      mode?: string;
    }) => {
      if (data.roomId !== roomId) return;
      pendingFn.current = null;
      setWaiting(false);
      setStartError(null);
      let bonus = goldBonusRef.current;
      let level: number | null = null;
      let house: HouseId | null = null;
      try {
        const { legacy } = await api.getLegacy();
        bonus = renownStartingGoldBonus(legacy.renownLevel);
        level = legacy.renownLevel;
        house = legacy.houseId;
        goldBonusRef.current = bonus;
      } catch {
        // Network blip: keep the last known bonus rather than block.
      }
      // Stamp the server's voyage epoch so market, orders, and intel
      // reroll; bump locally if it is missing. Keep the current Renown when
      // the refetch failed, so no skill is silently relocked.
      act((state, logs) =>
        restartGame(state, logs, {
          startingGoldBonus: bonus,
          renownLevel: level ?? state.renownLevel,
          voyageEpoch: data.voyageEpoch ?? state.voyageEpoch + 1,
          // Harbor's tier is authoritative; otherwise keep the captain's.
          difficulty: normalizeDifficulty(data.difficulty ?? state.difficulty),
          // Same for mode. Falling back to the default here would leave a
          // rebuilt captain on a different phase order all voyage.
          mode: normalizeMode(data.mode ?? state.mode),
          // A failed refetch keeps the current House rather than dropping
          // a pledge over one bad request.
          houseId: house ?? state.houseId,
        }),
      );
    };

    socket.on("phase:ready_update", onReadyUpdate);
    socket.on("phase:advance", onAdvance);
    socket.on("room:started", onStarted);
    socket.on("room:restarted", onRestarted);
    socket.on("room:error", onError);

    // Request state only after auth; an unauthenticated request is dropped
    // silently. `authed` is a dependency, so this line answers the
    // deferred case when it flips.
    if (authed) {
      socket.emit("phase:state:request", { roomId });
    }

    return () => {
      socket.off("phase:ready_update", onReadyUpdate);
      socket.off("phase:advance", onAdvance);
      socket.off("room:started", onStarted);
      socket.off("room:restarted", onRestarted);
      socket.off("room:error", onError);
    };
  }, [socket, roomId, act, authed, myUserId, ctx]);

  // Standing orders buy after the advance tally is read, so their delta
  // rides _pendingPulseTally. The server accumulates reports rather than
  // replacing them; a round with no order purchases sets nothing.
  useEffect(() => {
    const tally = game._pendingPulseTally;
    if (!tally || !socket) return;
    socket.emit("harbor:pulse:report", {
      roomId,
      round: game.currentRound,
      tally,
    });
    act((g) => {
      g._pendingPulseTally = undefined;
    });
  }, [game._pendingPulseTally, game.currentRound, socket, roomId, act]);

  // One vote path; the two presses differ only in what they check first.
  const sendReady = useCallback(
    (fn: LedgerWrite) => {
      if (!socket) return false;
      pendingFn.current = fn;
      setWaiting(true);
      socket.emit("phase:ready", {
        roomId,
        round: game.currentRound,
        phase: game.phase,
      });
      return true;
    },
    [socket, roomId, game.currentRound, game.phase],
  );

  // Committing a choice needs no extra check; the choice is the departure.
  const markChoiceReady = useCallback(
    (fn: LedgerWrite) => sendReady(fn),
    [sendReady],
  );

  const markReady = useCallback(
    (fn: LedgerWrite) => {
      // A seat must have a departure for a vote to mean anything; otherwise
      // the harbor fills a ready set nothing can carry out. canLeavePhase
      // names the seats that qualify.
      if (!canLeavePhase(gameRef.current)) return false;
      return sendReady(fn);
    },
    [sendReady],
  );

  const cancelReady = useCallback(() => {
    if (!socket) return;
    pendingFn.current = null;
    setWaiting(false);
    socket.emit("phase:unready", { roomId });
  }, [socket, roomId]);

  const startGame = useCallback(() => {
    if (!socket) return;
    setStartError(null);
    socket.emit("room:start", { roomId });
  }, [socket, roomId]);

  // Host only: reopens the harbor and resets every member's voyage. The
  // server owns the started flag.
  const restartVoyage = useCallback(() => {
    if (!socket) return;
    socket.emit("room:restart", { roomId });
  }, [socket, roomId]);

  const readyCount = ready?.readyUserIds.length ?? 0;
  const requiredCount = ready?.requiredUserIds.length ?? 0;

  // One identity until something inside changes; consumers keep this in
  // dependency lists, and a fresh literal would re-run their effects every
  // render.
  return useMemo(
    () => ({
      waiting,
      ready,
      readyCount,
      requiredCount,
      phaseDeadline,
      markReady,
      markChoiceReady,
      cancelReady,
      startGame,
      restartVoyage,
      startError,
    }),
    [
      waiting,
      ready,
      readyCount,
      requiredCount,
      phaseDeadline,
      markReady,
      markChoiceReady,
      cancelReady,
      startGame,
      restartVoyage,
      startError,
    ],
  );
}
