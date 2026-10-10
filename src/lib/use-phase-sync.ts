"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  phaseClockLabel,
  secondsRemaining,
  type PhaseClock,
} from "@/lib/phase-clock";
import { api } from "@/lib/api";
import type {
  PhaseAdvanceFrame,
  PhaseReadyFrame,
} from "@/types/realtime/phase";

// The ready frame's shape lives with the protocol rather than here (see
// PhaseReadyFrame in @/types/realtime/phase): the server builds this frame
// and this hook reads it, and a frame written out at both ends is a frame
// that can drift. The alias keeps this module's consumers on the same name
// they have always read.
export type ReadyState = PhaseReadyFrame;

/**
 * The room's ready count as a sentence, so the rail and the control bar
 * cannot word the same number two ways.
 */
export function readyLine(readyCount: number, requiredCount: number): string {
  return `${readyCount} of ${requiredCount} captains ${readyCount === 1 ? "has" : "have"} readied.`;
}

// Rank comes from the shared @/lib/game/checkpoint module so the client and
// the realtime layer never drift on phase order, and a phase value that
// arrives off the wire is read through @/lib/game/phases for the same reason.

// Everything this hook is handed, as one object rather than as eight
// positions. The call site names each value it passes, and the two that
// used to sit beside each other in the list as bare strings (authed and
// the caller's own captain id) can no longer be handed over the wrong way
// round by a reader who did not count the commas.
type PhaseSyncOptions = {
  roomId: string;
  socket: Socket | null;
  game: GameState;
  act: (fn: (g: GameState, logs: string[]) => void) => void;
  // The voyage's own seed identity, which autoCommit needs because a departure
  // is where a boon or a market is drawn from it. Handed in rather than
  // derived here: it belongs to the session, and this hook has never known
  // anything about how a voyage seeds.
  ctx: GameContext;
  authed: boolean;
  myUserId: string;
  startingGoldBonus?: number;
};

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
  const [ready, setReady] = useState<ReadyState | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const pendingFn = useRef<((g: GameState, logs: string[]) => void) | null>(
    null,
  );

  // Keep the latest game snapshot available to the listeners below
  // without subscribing them again on every change.
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
  // number standing rather than quietly reading its way to correctness on
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

    const onReadyUpdate = (data: PhaseReadyFrame) => {
      if (data.roomId !== roomId) return;
      setReady(data);
      // The clock's reading is stamped in the same batch as the deadline it
      // belongs to, so the countdown's first frame after a seat begins is
      // drawn against the moment that seat's deadline arrived rather than
      // against the reading the last tick happened to leave behind.
      setClockNow(Date.now());
      const g = gameRef.current;

      // The room's lap, taken rather than assumed. A rank is an index inside
      // one mode's phase order, so a comparison between a captain's seat and
      // the room's seat only means anything while both are read the same way;
      // a client whose own mode disagrees with the room's is not behind or
      // ahead of the table, it is playing a different leg, and every guard
      // below answers null or nonsense for it. That is a livelock rather than
      // a stumble, because the two laps of this release differ by one
      // adjacent swap (Orders and Parley, see ./game/mode): a step forward in
      // one lap is backward in the other, so each captain's report of the
      // seat they moved to is discarded as stale, the checkpoint never moves,
      // and the room's own cure hands the same dead announcement back to the
      // table.
      //
      // The room is the authority here for the reason it is at load: the mode
      // decides the order this captain's phases run in, and the room is what
      // everyone is synchronizing to (see refreshVoyageFacts, where the
      // room's mode beats the save's). A room's mode is fixed at its creation
      // and no event changes it, so in a healthy room this line never fires;
      // it is here because the alternative is an assumption that four guards
      // silently rest on.
      const roomMode =
        data.mode === undefined ? g.mode : normalizeMode(data.mode);
      if (roomMode !== g.mode) {
        act((state) => {
          state.mode = roomMode;
        });
      }

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
      // Both ranks are read in the room's own lap, which is what the frame
      // above just settled: comparing them inside one lap is the only way the
      // comparison means anything, and the lap it is done in is the one the
      // room is keeping rather than the one this client happened to be
      // holding.
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
        // Only a seat the room waits at is a seat the room can have run
        // out, and the pier is the one seat on the lap nobody readies out
        // of (see isGatedPhase). The frame that carries a captain off the
        // pier is room:started, which lays the opening seat out itself,
        // and that deal lands by an act rather than by this render: a room
        // that departs while this snapshot still reads the pier would
        // otherwise read as a room that moved past this captain, and the
        // fallback below would commit the cards the deal just laid out
        // before they ever render. One room move, applied once.
        if (!isGatedPhase(roomMode, seatOf(g.phase))) return;
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
      // A terminal is not behind anybody: bankruptcy and the endgame screen
      // are the two phases with no rank at all, and a captain sitting at one
      // has left the voyage rather than fallen behind it. The personal
      // screens do have a rank, and the fold that gives them one is what
      // makes this catch up work for a captain who was reading a module card
      // when the room moved on: they are standing in Dusk, so the room's move
      // to the next round is a move past them and is healed here exactly like
      // any other missed broadcast.

      // Self heal a dropped ready vote. A vote emitted the instant a flaky
      // transport blips (common on tunnelled or long polling connections)
      // can reach the server stamped against the pre reconnect socket, fail
      // that handler's `roomId === s.roomId` check, and be silently
      // dropped, leaving the room stuck at "n minus 1 of n ready" forever
      // with no error and the local button still showing "Waiting". So
      // whenever the server hands us the authoritative roster: if we still
      // intend to be ready for the checkpoint the room is actually on, but
      // we aren't in it, assert it again. phase:ready is idempotent (a Set
      // add), so sending it again when we're already counted is harmless.
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
    // The advance frame lives with the protocol beside the ready frame
    // (see PhaseAdvanceFrame in @/types/realtime/phase), and its three
    // market hands are applied below before the market is drawn, so
    // genResourceCard prices the cards the server's numbers say.
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
      // Stale advance for a checkpoint we've already passed, ignore. The one
      // case that reads oddly here is the personal screens, and it reads
      // correctly once the fold is in mind: a captain in the module draft or
      // the swap picker is standing in Dusk, so their rank is Dusk's rank,
      // which is the seat this advance is leaving, and the frame is theirs to
      // take rather than one to refuse as stale (see [B2] below). A terminal
      // is the only thing with no rank, and the line above is what refuses a
      // frame naming one.
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
          applyMarketLeans(state, data);
          fn(state, logs);
        });
        return;
      }
      // The same reading the catch up above makes, for the same reason: the
      // seat has to be one the room waits at before its fallback can be
      // this captain's to run. The held transition above is untouched: a
      // captain only holds one by having pressed at the seat they stand in.
      if (!isGatedPhase(g.mode, seatOf(g.phase))) return;
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
        applyMarketLeans(state, data);
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
      // checkpoint was just set to, read off the room's own lap (see
      // openingPhase in @/lib/game/checkpoint) rather than named here, the
      // same way the server pinned it: the seat a dealing Gambit build
      // opens at is the path draft, and every other build opens at the boon
      // draft, and snapToCheckpoint is the one entry that opens either.
      //
      // This is the same direct entry endRound makes at the top of each later
      // round; both are round openers, not handoffs, so there is no phase
      // behind them to hand off from.
      act((state, logs) =>
        snapToCheckpoint(state, ctx, 1, openingPhase(state.mode), logs),
      );
    };
    const onError = (data: { roomId: string; error: string }) => {
      if (data.roomId === roomId) setStartError(data.error);
    };
    // The host's "restart the voyage" went through. Every captain still in
    // the room, not just whoever clicked it, drops back to a fresh run, and
    // any ready vote in flight no longer means anything.
    //
    // Refetch the captain's legacy before restarting so the starting gold
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

  // The vote itself, in one place: the two presses below differ only in what
  // they ask before sending it. Both return whether the vote went out.
  const sendReady = useCallback(
    (fn: (g: GameState, logs: string[]) => void) => {
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

  // The press that commits a choice: locking in a boon, where the choice is
  // the departure itself, so there is nothing to check and nothing to
  // refuse. See markReady below for the press that has no choice in it.
  const markChoiceReady = useCallback(
    (fn: (g: GameState, logs: string[]) => void) => sendReady(fn),
    [sendReady],
  );

  const markReady = useCallback(
    (fn: (g: GameState, logs: string[]) => void) => {
      // The seat has to have a departure before a press can be a promise the
      // table can keep. The room announces the advance once every captain has
      // readied, and each client then runs the transition it was holding, so
      // a captain who readies in a seat no departure can leave (the pier,
      // Dawn, a personal or terminal screen) leaves the room holding a full
      // ready set that nothing carries out. The press is refused here, before
      // anything is sent, and the caller says why. See canLeavePhase in the
      // engine's lifecycle for which seats those are and why each one is.
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
    markChoiceReady,
    cancelReady,
    startGame,
    restartVoyage,
    startError,
  };
}
