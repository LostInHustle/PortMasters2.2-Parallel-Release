"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { GameContext, GameState } from "@/lib/game/types";
import {
  applyHarborPulse,
  autoCommit,
  restartGame,
  startBoonDrafting,
  tallyPurchasesByResource,
} from "@/lib/game/engine";
import { renownStartingGoldBonus, type HouseId } from "@/lib/game/legacy";
import { normalizeDifficulty } from "@/lib/game/difficulty";
import { normalizeMode } from "@/lib/game/mode";
import { checkpointRank } from "@/lib/game/checkpoint";
import { normalizePhase } from "@/lib/game/phases";
import {
  phaseClockLabel,
  secondsRemaining,
  type PhaseClock,
} from "@/lib/phase-clock";
import { api } from "@/lib/api";

export type ReadyState = {
  round: number;
  phase: string;
  // [B2: hard timers, the server as timekeeper] The room's clock as the
  // server publishes it: the epoch millisecond this seat runs out, and the
  // number of seconds the seat was given. Both are null on a seat with no
  // clock of its own, which is the pier, a harbor that has not set sail, and
  // a server running with the clock switched off, so a client never has to
  // tell "no clock" apart from "not reported".
  phaseEndsAt: number | null;
  phaseSeconds: number | null;
  readyUserIds: string[];
  requiredUserIds: string[];
};

// Rank comes from the shared @/lib/game/checkpoint module so the client and
// the realtime layer never drift on phase order, and a phase value that
// arrives off the wire is read through @/lib/game/phases for the same reason.

/**
 * Gates the recurring "everyone advances together" phase transitions
 * (locking in a boon, then leaving each of the leg's other five phases)
 * behind a room wide ready check. Calling `markReady` no longer runs the
 * transition immediately. It tells the server "I'm done here," and the
 * actual engine call only fires once every other room member has done
 * the same, via the `phase:advance` broadcast. Each client runs the exact
 * same deterministic transition locally, so everyone lands on the same
 * next phase without the server needing to know any game rules.
 *
 * Starting the voyage itself is not part of that vote. The harbor is a
 * one time, host only action, handled by `startGame` below and answered
 * with a dedicated `room:started` broadcast rather than `phase:advance`,
 * since nobody but the host called anything and there is no per client
 * pending action to resume. Every client just runs startBoonDrafting()
 * the moment they hear it.
 *
 * [B2: hard timers, the server as timekeeper] The room's clock arrives on the
 * same ready state, and it makes the vote a race rather than a gate: the
 * server announces the advance when the clock runs out whether or not everyone
 * has readied. A captain who was waiting on a choice runs the choice they were
 * holding; a captain who was holding nothing runs the engine's autoCommit,
 * which leaves the seat by its own defaults. Both are the same deterministic
 * transition the room has always run, so every client still lands in the same
 * place, and only one of them had to be there to press the button.
 */
export function usePhaseSync(
  roomId: string,
  socket: Socket | null,
  game: GameState,
  act: (fn: (g: GameState, logs: string[]) => void) => void,
  // The voyage's own seed identity, which autoCommit needs because a departure
  // is where a boon or a market is drawn from it. Handed in rather than
  // derived here: it belongs to the session, and this hook has never known
  // anything about how a voyage seeds.
  ctx: GameContext,
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

  // [B2: hard timers, the server as timekeeper] The reading the countdown is
  // drawn against, and the ticker that keeps it moving.
  //
  // The reading is state rather than a Date.now() taken inside the render,
  // because a render has to happen for a number to change: this is what makes
  // the countdown tick, and a clock whose ticker stopped would leave a stale
  // number standing rather than quietly re-reading itself into correctness on
  // some unrelated render.
  //
  // The ticker runs only while the room has a clock. A lobby, a harbor that
  // has not set sail and a server with the clock switched off all leave this
  // effect doing nothing, which is what keeps a captain sitting in a lobby
  // from waking up once a second for nothing. The arithmetic itself is not
  // here: it comes from @/lib/phase-clock, which reads the two published
  // numbers and nothing else.
  const [clockNow, setClockNow] = useState(() => Date.now());
  const phaseEndsAt = ready?.phaseEndsAt ?? null;
  useEffect(() => {
    if (phaseEndsAt === null) return;
    const id = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phaseEndsAt]);

  useEffect(() => {
    if (!socket) return;

    const onReadyUpdate = (data: ReadyState & { roomId: string }) => {
      if (data.roomId !== roomId) return;
      setReady(data);
      // The clock's reading is stamped in the same batch as the deadline it
      // belongs to, so the countdown's first frame after a seat begins is
      // drawn against the moment that seat's deadline arrived rather than
      // against the reading the last tick happened to leave behind.
      setClockNow(Date.now());
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
      // Both ranks are read in the lap this captain believes the room is
      // keeping, which is the room's own mode as it arrived on load or on the
      // restart broadcast. Comparing them inside one lap is the only way the
      // comparison means anything: ranks are index times lap length, so two
      // modes produce numbers of the same magnitude that stand for different
      // phases. Reading both from the same snapshot is also what keeps a
      // captain who has somehow drifted onto the wrong mode from being told
      // they are perfectly in step.
      const serverRank = checkpointRank(
        g.mode,
        data.round,
        normalizePhase(data.phase),
      );
      const clientRank = checkpointRank(g.mode, g.currentRound, g.phase);
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
        // [B2: hard timers, the server as timekeeper] Nobody here was
        // waiting on anything to happen: this captain was idle when the
        // room's clock ran the seat out, and the advance that carried the
        // transition to everyone else never arrived, which is the same
        // transport blip this catch up exists for. The room is past them and
        // it is not coming back for them, so what catches them up is the
        // departure the clock gives a captain who is not there: the seat's
        // own defaults, run through the engine exactly as the advance
        // broadcast runs them.
        pendingFn.current = null;
        setWaiting(false);
        act((state, logs) => autoCommit(state, ctx, logs));
        return;
      }
      // A captain off the lap is not behind anybody. The module draft and the
      // two terminals have no rank at all, so a comparison against the room
      // cannot place them, and the advance broadcast is what moves a draft
      // forward rather than this.

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
    const onAdvance = (data: {
      roomId: string;
      round: number;
      phase: string;
      // Only ever present when the phase being left is Dawn, meaning every
      // captain just readied up out of the boon draft and is about to run
      // startMarket for this round. Computed server side from last round's
      // room wide purchase tally and delivered on this same broadcast so it
      // lands before genResourceCard runs, never as a separate race prone
      // round trip.
      harborPulse?: Record<string, number>;
    }) => {
      if (data.roomId !== roomId) return;
      const g = gameRef.current;
      const advanceRank = checkpointRank(
        g.mode,
        data.round,
        normalizePhase(data.phase),
      );
      const clientRank = checkpointRank(g.mode, g.currentRound, g.phase);
      if (advanceRank === null) return;
      // Stale advance for a checkpoint we've already passed, ignore. A
      // captain off the lap has no rank to compare, and the two phases that
      // is true of are inside a seat rather than beside one: a captain in
      // the module draft is standing in Dusk, which is the seat this advance
      // is leaving, so the frame is theirs to take (see [B2] below).
      if (clientRank !== null && advanceRank < clientRank) return;
      // We are leaving the market phase for good this round (purchasedCards
      // and resourceCards are about to be cleared by the pending
      // completeMarket below), so this is the one moment this captain's own
      // draw can still be read and handed to the server for next round's
      // pulse. A captain who bought nothing still reports an empty tally,
      // exactly like everyone else who sits this round out.
      if (g.phase === "market") {
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
        return;
      }
      // [B2: hard timers, the server as timekeeper] And when there is no
      // pending transition, this is the room's clock having run the seat out
      // while this captain was idle. Nobody chose anything here, so the seat
      // is left by its own defaults, which the engine works out from the
      // phase it is standing in: the first boon on the board, a canceled
      // module draft, or the settlement's own order of business. It is the
      // same departure every other captain is running, and the same harbor
      // pulse rides it, so the round that opens next is drawn the same way
      // for everybody.
      act((state, logs) => {
        if (data.harborPulse) applyHarborPulse(state, data.harborPulse);
        autoCommit(state, ctx, logs);
      });
    };
    const onStarted = (data: { roomId: string }) => {
      if (data.roomId !== roomId) return;
      const g = gameRef.current;
      // Only the captains still sitting in the lobby need to act on this;
      // anyone who has already moved on (a late reconnect, say) ignores it.
      if (g.currentRound !== 1 || g.phase !== "harbor") return;
      // Setting sail runs the engine's own opener for the phase the room's
      // checkpoint was just set to, which the server reads off the room's lap
      // (see openingPhase in @/lib/game/checkpoint) rather than naming. Both
      // modes open at the boon draft today, and startBoonDrafting is what
      // opens it: a mode whose lap opened anywhere else would need its own
      // opener here, which is the change that would make this call read the
      // lap instead of naming the draft.
      //
      // This is the same direct entry endRound makes at the top of each later
      // round; both are round openers, not handoffs, so there is no phase
      // behind them to hand off from.
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
        // If the fetch fails (network blip, server restart), fall back to
        // the last known bonus rather than blocking the restart entirely.
      }
      // Stamp the room's bumped voyage epoch (from the server) onto the fresh
      // voyage so its market, orders, and intel reroll into a brand new one.
      // If the payload somehow lacks it, advance locally so content still
      // changes. Preserve the captain's current Renown level when the legacy
      // refetch failed, so restartGame never silently relocks a Renown skill.
      act((state, logs) =>
        restartGame(state, logs, {
          startingGoldBonus: bonus,
          renownLevel: level ?? state.renownLevel,
          voyageEpoch: data.voyageEpoch ?? state.voyageEpoch + 1,
          // The room's tier is the source of truth; if the payload lacks it,
          // keep the captain's current tier rather than silently resetting it.
          difficulty: normalizeDifficulty(data.difficulty ?? state.difficulty),
          // Same rule for the mode, and it has to be the same rule rather
          // than falling back to the default: a captain whose state was
          // rebuilt on the founding lap inside an experimental harbor would
          // be running a different phase order than the room for the whole
          // rest of the voyage, and nothing downstream would say so.
          mode: normalizeMode(data.mode ?? state.mode),
          // A refetch that failed leaves this null, and the new voyage keeps
          // the House the captain was already sailing under rather than
          // dropping a pledge because of one bad request.
          houseId: house ?? state.houseId,
        }),
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
    //
    // `authed` is a dependency, so the effect runs again the moment it flips
    // and this line is what answers the deferred case. A second effect used
    // to sit below doing the same emit, which meant every ordinary mount
    // asked twice and the answer was applied twice.
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

  // [B3: standing orders] The second half of a market's report to the room.
  //
  // A captain's tally goes out on the advance frame, read from the state as
  // it stood when the room moved them, which for a captain who was sitting
  // there is everything they bought. A market their standing orders played
  // buys afterwards, inside the same act, so those lots are not in that
  // report and cannot be: the state the report reads is the state before the
  // work. The engine leaves the delta on the state instead and this carries
  // it, against the same round and on the same frame the first half used,
  // because the server accumulates reports rather than replacing them (see
  // addPulseReport in src/server/realtime/pulse.ts). A round nobody's orders
  // bought in sets nothing and this does nothing.
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

  // [B2: hard timers, the server as timekeeper] What a screen draws beside
  // the room's ready count, or null when no clock is running. Derived from
  // the reading above rather than computed where it is drawn, so every panel
  // that shows a countdown shows the same one: the room's own deadline, read
  // once, in one place.
  const secondsLeft =
    phaseEndsAt === null ? null : secondsRemaining(phaseEndsAt, clockNow);
  const phaseClock: PhaseClock | null =
    secondsLeft === null
      ? null
      : {
          secondsLeft,
          label: phaseClockLabel(secondsLeft),
          // How long the seat was given, which is what a progress bar
          // needs and a countdown does not. Null when the server did not
          // publish one, which a screen reads as "no bar to draw" rather
          // than as a full or an empty one.
          total: ready?.phaseSeconds ?? null,
        };

  return {
    waiting,
    ready,
    readyCount,
    requiredCount,
    phaseClock,
    markReady,
    cancelReady,
    startGame,
    restartVoyage,
    startError,
  };
}
