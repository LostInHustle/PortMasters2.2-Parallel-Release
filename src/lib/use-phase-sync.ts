"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { GameState } from "@/lib/game/types";
import {
  restartGame,
  startBoonDrafting,
  tallyPurchasesByResource,
  applyHarborPulse,
} from "@/lib/game/engine";
import { renownStartingGoldBonus } from "@/lib/game/legacy";
import { normalizeDifficulty } from "@/lib/game/difficulty";
import {
  CHECKPOINT_PHASE_ORDER,
  checkpointRank,
  parsePhase,
} from "@/lib/game/checkpoint";
import { api } from "@/lib/api";

export type ReadyState = {
  round: number;
  phase: string;
  readyUserIds: string[];
  requiredUserIds: string[];
};

// CHECKPOINT_PHASE_ORDER, checkpointRank, and parsePhase are imported from
// the shared @/lib/game/checkpoint module so the client and the realtime
// layer never drift on the synchronized phase order. Re-exported
// here so any caller that used to read them off this hook still can.
export { CHECKPOINT_PHASE_ORDER, checkpointRank, parsePhase };

/**
 * Gates the six recurring "everyone advances together" phase transitions
 * (locking in a boon, finishing buying/trading/maintenance/shipyard)
 * behind a room wide ready check. Calling `markReady` no longer runs the
 * transition immediately. It tells the server "I'm done here," and the
 * actual engine call only fires once every other room member has done
 * the same, via the `phase:advance` broadcast. Each client runs the exact
 * same deterministic transition locally, so everyone lands on the same
 * next phase without the server needing to know any game rules.
 *
 * Starting the voyage itself (phase 0, the lobby) is not part of that
 * vote. It is a one time, host only action gated on the room having at
 * least two members, handled by `startGame` below and answered with a
 * dedicated `room:started` broadcast rather than `phase:advance`, since
 * nobody but the host called anything and there is no per client pending
 * action to resume. Every client just runs startBoonDrafting() the
 * moment they hear it.
 */
export function usePhaseSync(
  roomId: string,
  socket: Socket | null,
  game: GameState,
  act: (fn: (g: GameState, logs: string[]) => void) => void,
  authed: boolean,
  myUserId: string,
  startingGoldBonus: number = 0,
) {
  const [waiting, setWaiting] = useState(false);
  const [ready, setReady] = useState<ReadyState | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const pendingFn = useRef<((g: GameState, logs: string[]) => void) | null>(
    null,
  );

  // Keep the latest game snapshot available to the listeners below
  // without re subscribing them on every change.
  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  // Same pattern as gameRef: this only settles once the captain's
  // CaptainLegacy row has loaded (see useGameSession), a moment after
  // this hook first mounts, so onRestarted below needs the current value
  // without the whole effect resubscribing every time it changes.
  const goldBonusRef = useRef(startingGoldBonus);
  useEffect(() => {
    goldBonusRef.current = startingGoldBonus;
  }, [startingGoldBonus]);

  useEffect(() => {
    if (!socket) return;

    const onReadyUpdate = (data: ReadyState & { roomId: string }) => {
      if (data.roomId !== roomId) return;
      setReady(data);
      const g = gameRef.current;

      // Desync catch up. When the room's synchronized checkpoint has
      // moved ahead of us (we missed a phase:advance broadcast because of
      // a transport blip, common on tunnelled connections), execute the
      // pending transition right now instead of staying stuck waiting
      // forever. The pending function was stored by markReady, and since
      // every client runs the same deterministic transition, executing
      // it locally catches us up by exactly one phase, the one the room
      // just left. If the room somehow advanced multiple phases (extremely
      // rare), the next phase:ready_update heartbeat will trigger another
      // catch up step.
      const serverRank = checkpointRank(data.round, data.phase);
      const clientRank = checkpointRank(g.currentRound, parsePhase(g.phase));
      if (
        serverRank !== null &&
        clientRank !== null &&
        serverRank > clientRank &&
        pendingFn.current
      ) {
        const fn = pendingFn.current;
        pendingFn.current = null;
        setWaiting(false);
        act(fn);
        return;
      }

      // Self heal a dropped ready vote. A vote emitted the instant a flaky
      // transport blips (common on tunnelled or long polling connections)
      // can reach the server stamped against the pre reconnect socket, fail
      // that handler's `roomId === s.roomId` check, and be silently
      // dropped, leaving the room stuck at "n minus 1 of n ready" forever
      // with no error and the local button still showing "Waiting". So
      // whenever the server hands us the authoritative roster: if we still
      // intend to be ready for the checkpoint the room is actually on, but
      // we aren't in it, assert it again. phase:ready is idempotent (a Set
      // add), so re sending when we're already counted is harmless.
      if (
        pendingFn.current &&
        myUserId &&
        data.round === g.currentRound &&
        data.phase === parsePhase(g.phase) &&
        !data.readyUserIds.includes(myUserId)
      ) {
        socket.emit("phase:ready", {
          roomId,
          round: g.currentRound,
          phase: g.phase,
        });
      }
    };
    const onAdvance = (data: {
      roomId: string;
      round: number;
      phase: string;
      // Only ever present when phase is "5", meaning every captain just
      // readied up out of boon drafting and is about to run startPhase1
      // for this round. Computed server side from last round's room wide
      // purchase tally and delivered on this same broadcast so it lands
      // before genResourceCard runs, never as a separate race prone round
      // trip.
      harborPulse?: Record<string, number>;
    }) => {
      if (data.roomId !== roomId) return;
      const g = gameRef.current;
      const advanceRank = checkpointRank(data.round, data.phase);
      const clientRank = checkpointRank(g.currentRound, parsePhase(g.phase));
      if (advanceRank === null || clientRank === null) return;
      // Stale advance for a checkpoint we've already passed, ignore.
      if (advanceRank < clientRank) return;
      // We are leaving Phase 1 for good this round (purchasedCards and
      // resourceCards are about to be cleared by the pending completePhase1
      // below), so this is the one moment this captain's own draw can still
      // be read and handed to the server for next round's pulse. A captain
      // who bought nothing still reports an empty tally, exactly like
      // everyone else who sits this round out.
      if (parsePhase(g.phase) === "1") {
        socket.emit("harbor:pulse:report", {
          roomId,
          round: g.currentRound,
          tally: tallyPurchasesByResource(g),
        });
      }
      // Exact match (normal case) or advance is ahead (we missed an
      // earlier advance, ngrok drop, etc.). Either way, execute the
      // pending transition if one is waiting.
      const fn = pendingFn.current;
      pendingFn.current = null;
      setWaiting(false);
      if (fn) {
        act((state, logs) => {
          if (data.harborPulse) applyHarborPulse(state, data.harborPulse);
          fn(state, logs);
        });
      }
    };
    const onStarted = (data: { roomId: string }) => {
      if (data.roomId !== roomId) return;
      const g = gameRef.current;
      // Only the captains still sitting in the lobby need to act on this;
      // anyone who has already moved on (a late reconnect, say) ignores it.
      if (g.currentRound !== 1 || parsePhase(g.phase) !== "0") return;
      act((state, logs) => startBoonDrafting(state, logs));
    };
    const onError = (data: { roomId: string; error: string }) => {
      if (data.roomId === roomId) setStartError(data.error);
    };
    // The host's "restart the voyage" went through. Every captain still in
    // the room, not just whoever clicked it, drops back to a fresh run, and
    // any ready vote in flight no longer means anything.
    //
    // Re fetch the captain's legacy before restarting so the starting gold
    // bonus reflects any Renown gained from the voyage that just concluded.
    // Without this, goldBonusRef (set once on mount from useGameSession)
    // carries the pre voyage Renown level and the bonus never updates until
    // the captain leaves and rejoins the room.
    const onRestarted = async (data: {
      roomId: string;
      voyageEpoch?: number;
      difficulty?: string;
    }) => {
      if (data.roomId !== roomId) return;
      pendingFn.current = null;
      setWaiting(false);
      setStartError(null);
      let bonus = goldBonusRef.current;
      let level: number | null = null;
      try {
        const { legacy } = await api.getLegacy();
        bonus = renownStartingGoldBonus(legacy.renownLevel);
        level = legacy.renownLevel;
        goldBonusRef.current = bonus;
      } catch {
        // If the fetch fails (network blip, server restart), fall back to
        // the last known bonus rather than blocking the restart entirely.
      }
      // Stamp the room's bumped voyage epoch (from the server) onto the fresh
      // voyage so its market, orders, and intel reroll into a brand new one.
      // If the payload somehow lacks it, advance locally so content still
      // changes. Preserve the captain's current Renown level when the legacy
      // refetch failed, so restartGame never silently relocks a Renown skill.
      act((state, logs) =>
        restartGame(
          state,
          logs,
          bonus,
          level ?? state.renownLevel,
          data.voyageEpoch ?? state.voyageEpoch + 1,
          // The room's tier is the source of truth; if the payload lacks it,
          // keep the captain's current tier rather than silently resetting it.
          normalizeDifficulty(data.difficulty ?? state.difficulty),
        ),
      );
    };

    socket.on("phase:ready_update", onReadyUpdate);
    socket.on("phase:advance", onAdvance);
    socket.on("room:started", onStarted);
    socket.on("room:restarted", onRestarted);
    socket.on("room:error", onError);

    // Only request phase state once the socket is authenticated, otherwise
    // the server silently drops the request (requireAuth returns null) and
    // the ready state never initialises. Same race fix as GameRoom's
    // room:join effect: without this, a fast mount and slow auth path means
    // the client never hears who's readied up.
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
  }, [socket, roomId, act, authed, myUserId]);

  // Once authed flips to true, fire the deferred phase:state:request so the
  // client gets the room's current checkpoint and ready set. This covers the
  // case where the effect above mounted before authentication completed.
  useEffect(() => {
    if (!socket || !authed) return;
    socket.emit("phase:state:request", { roomId });
  }, [socket, authed, roomId]);

  const markReady = useCallback(
    (fn: (g: GameState, logs: string[]) => void) => {
      if (!socket) return;
      pendingFn.current = fn;
      setWaiting(true);
      socket.emit("phase:ready", {
        roomId,
        round: game.currentRound,
        phase: game.phase,
      });
    },
    [socket, roomId, game.currentRound, game.phase],
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

  // Host only: reopens the room (so new captains can join again) and
  // resets every member's voyage, not just the caller's. The server is
  // the source of truth for the "started" flag; this only asks it to flip
  // it back.
  const restartVoyage = useCallback(() => {
    if (!socket) return;
    socket.emit("room:restart", { roomId });
  }, [socket, roomId]);

  const readyCount = ready?.readyUserIds.length ?? 0;
  const requiredCount = ready?.requiredUserIds.length ?? 0;

  return {
    waiting,
    ready,
    readyCount,
    requiredCount,
    markReady,
    cancelReady,
    startGame,
    restartVoyage,
    startError,
  };
}
