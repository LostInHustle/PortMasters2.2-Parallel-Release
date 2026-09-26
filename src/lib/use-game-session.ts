"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { api } from "@/lib/api";
import type { Socket } from "socket.io-client";
import {
  noHousePerks,
  phaseLabel,
  showWelcome,
  snapToCheckpoint,
} from "@/lib/game/engine";
import {
  createInitialGameState,
  normalizeInventory,
  normalizeWorkerRoster,
  type GameContext,
  type GameState,
} from "@/lib/game/types";
import { renownStartingGoldBonus, type HouseId } from "@/lib/game/legacy";
import { normalizeDifficulty, type Difficulty } from "@/lib/game/difficulty";
import { normalizeMode, type GameMode } from "@/lib/game/mode";

// The most log lines a session keeps around at once (see the APPLY case
// below, the only place this is enforced). Named rather than written out
// where it is used, so the cap and the trim that applies it cannot drift
// apart, and so the toast effect's "what's new" window stays in step with
// the ledger it is reading from.
const LEDGER_LINE_CAP = 500;

// Exported (along with Action and reducer below) so the reducer, a pure
// function with no React dependency, can be unit tested directly without
// mounting a component or a browser.
type SessionState = {
  game: GameState;
  logs: string[];
  // The lines a single APPLY just added, before the LEDGER_LINE_CAP trim
  // (below) drops entries off the front. GameRoom's toast effect used to
  // infer "what's new" by diffing state.logs.length against a remembered
  // count, which silently stopped working the moment a voyage's ledger hit
  // that cap: once logs.length pins at the cap forever, length never grows
  // again, so the diff read as "nothing new" for every action from then on,
  // even though each one was still landing in the ledger. Handing the
  // actual new lines out of the reducer sidesteps length entirely.
  newLines: string[];
  loaded: boolean;
  saving: boolean;
  lastSavedAt: number | null;
};

type Action =
  | { type: "INIT"; game: GameState; logs: string[] }
  | {
      type: "APPLY";
      fn: (g: GameState, logs: string[]) => void;
      postDraft?: boolean;
    }
  | {
      type: "START_FRESH";
      checkpoint?: { round: number; phase: string } | null;
      ctx?: GameContext;
      startingGoldBonus?: number;
      renownLevel?: number;
      voyageEpoch?: number;
      difficulty?: Difficulty;
      // The room's mode, so a brand new voyage in an experimental harbor is
      // stamped with that mode rather than the founding one. Omitted by any
      // caller that does not know it, which lands on the default.
      mode?: GameMode;
      houseId?: HouseId | null;
    }
  | { type: "SET_SAVING"; saving: boolean; at: number };

function reducer(state: SessionState, action: Action): SessionState {
  switch (action.type) {
    case "INIT":
      return {
        ...state,
        game: action.game,
        logs: action.logs,
        newLines: [],
        loaded: true,
      };
    case "START_FRESH": {
      const g = createInitialGameState({
        startingGoldBonus: action.startingGoldBonus ?? 0,
        renownLevel: action.renownLevel ?? 1,
        voyageEpoch: action.voyageEpoch ?? 0,
        difficulty: action.difficulty,
        mode: action.mode,
        houseId: action.houseId ?? null,
      });
      const logs: string[] = [];
      showWelcome(g, logs);
      // A genuinely new captain (no save of their own yet) joins wherever
      // the room's checkpoint already is, instead of always at round 1.
      const cp = action.checkpoint;
      if (cp && action.ctx && (cp.round > 1 || cp.phase !== "0")) {
        snapToCheckpoint(g, action.ctx, cp.round, cp.phase, logs);
      }
      return { ...state, game: g, logs, newLines: [], loaded: true };
    }
    case "APPLY": {
      const game = structuredClone(state.game) as GameState;
      const logs = [...state.logs];
      const before = logs.length;
      action.fn(game, logs);
      const newLines = logs.slice(before);
      if (logs.length > LEDGER_LINE_CAP)
        logs.splice(0, logs.length - LEDGER_LINE_CAP);
      return { ...state, game, logs, newLines };
    }
    case "SET_SAVING":
      return { ...state, saving: action.saving, lastSavedAt: action.at };
    default:
      return state;
  }
}

export function useGameSession(
  roomId: string,
  socket: Socket | null,
  enabled: boolean,
  userId: string = "",
  // The room's mode, as its summary already carries it, handed in by the
  // caller that was sitting in the lobby a moment ago. Only the two fallback
  // paths below read it, and they need it for a reason the successful load
  // does not have: they fire precisely when the server could not be reached,
  // which is the one moment this hook has no way to ask the room what lap it
  // is keeping. Seeding those captains Classic would put them on the wrong
  // phase order for the whole voyage, and because both laps list the same
  // number of phases, their checkpoint ranks would still compare cleanly
  // against everyone else's. They would diverge silently, which is the one
  // failure this whole design is built to make impossible.
  //
  // Difficulty is deliberately not threaded the same way. A wrong tier is a
  // captain playing a slightly different game on their own; a wrong mode is a
  // captain playing a different lap than the room they are being synchronized
  // against.
  roomMode?: GameMode,
) {
  // The captain's own deterministic seed identity. Folding userId in is what
  // gives every captain their own market, orders, and Broker intel instead of
  // the room wide identical economy this used to derive from roomId alone.
  const ctx: GameContext = useMemo(
    () => ({
      seedBase: userId ? `${roomId}:${userId}` : roomId,
      // The same room, without the captain. Only the public objective seeds
      // from this, because it is the one draw the whole harbor has to agree
      // on rather than one each.
      harborId: roomId,
    }),
    [roomId, userId],
  );
  const [state, dispatch] = useReducer(reducer, {
    game: createInitialGameState(),
    logs: [],
    newLines: [],
    loaded: false,
    saving: false,
    lastSavedAt: null,
  });
  // The captain's Renown level translates to a small starting Gold bonus
  // (see src/lib/game/legacy.ts) applied both to a brand new voyage below
  // and, later, to a host triggered restart (see usePhaseSync, which
  // takes this as a parameter so its own reset stays consistent with
  // whatever a fresh join would grant).
  const [startingGoldBonus, setStartingGoldBonus] = useState(0);
  // The captain's pledged Great House, remembered across loads. The two
  // fallback paths below fire precisely when the captain's own data could
  // not be read, and a voyage seeded Houseless would quietly cost them a
  // perk they had already chosen, so they fall back to this rather than to
  // null. It starts null, which is correct for a captain who has not
  // pledged yet and for a first load that never reached the server.
  const houseIdRef = useRef<HouseId | null>(null);
  // The captain's Renown, remembered across loads for the same reason and
  // on the same two paths as the House above. A fallback load that seeded
  // Renown at the base level would quietly demote the captain: Renown gates
  // the Broker's Favor, the harbor peek, and the starting Gold a new voyage
  // opens with, so losing it costs unlocks they had already earned rather
  // than merely looking wrong on a screen. It starts at the base level,
  // which is the correct reading for a first load that never reached the
  // server and for a captain who has not earned any Renown yet.
  const renownRef = useRef(1);

  // Load saved state on mount / room change.
  useEffect(() => {
    if (!enabled) return;
    let alive = true;

    // Safety net: if the API call hangs (network hiccup, server spinning up),
    // fall back to a fresh game after 12 s instead of showing the loading
    // screen forever. This is the root cause fix for the loading freeze
    // reported when joining or hosting a room.
    const LOAD_TIMEOUT_MS = 12_000;
    let loadTimedOut = false;
    const timeoutId = setTimeout(() => {
      if (!alive) return;
      loadTimedOut = true;
      dispatch({
        type: "START_FRESH",
        checkpoint: null,
        ctx,
        houseId: houseIdRef.current,
        renownLevel: renownRef.current,
        startingGoldBonus: renownStartingGoldBonus(renownRef.current),
        mode: roomMode,
      });
    }, LOAD_TIMEOUT_MS);

    (async () => {
      try {
        const [
          {
            state: raw,
            checkpoint,
            difficulty: roomDifficulty,
            // Named for what it is rather than shadowing the roomMode the
            // caller passed in. Both are in play below and they are allowed
            // to disagree: the response is the room answering live, the
            // argument is what the lobby said a moment before the request.
            mode: apiMode,
          },
          legacyResult,
        ] = await Promise.all([
          api.getGameState(roomId),
          // A brand new captain (no CaptainLegacy row yet) or a fetch
          // that fails outright just means no bonus this load; never
          // block picking up the actual voyage over it.
          api.getLegacy().catch(() => null),
        ]);
        if (!alive || loadTimedOut) return;
        clearTimeout(timeoutId);
        const goldBonus = legacyResult
          ? renownStartingGoldBonus(legacyResult.legacy.renownLevel)
          : 0;
        const renownLevel = legacyResult ? legacyResult.legacy.renownLevel : 1;
        // A legacy row we could not read is not evidence of a captain with
        // no House, so it leaves the remembered one standing.
        const houseId = legacyResult
          ? legacyResult.legacy.houseId
          : houseIdRef.current;
        if (legacyResult) houseIdRef.current = legacyResult.legacy.houseId;
        if (legacyResult) renownRef.current = legacyResult.legacy.renownLevel;
        setStartingGoldBonus(goldBonus);
        if (raw) {
          const game = JSON.parse(raw) as GameState;
          // Ensure required arrays exist (back compat).
          game.purchasedCards = game.purchasedCards ?? [];
          game.completedOrders = game.completedOrders ?? [];
          game.resourceCards = game.resourceCards ?? [];
          game.customerCards = game.customerCards ?? [];
          game.equippedModules = game.equippedModules ?? [];
          // Rebuild the artisan roster defensively: fills in any type this
          // save predates, and reads a pre charter save that still carried
          // three separate weavers / masterWeavers / sachetMakers arrays.
          game.workers = normalizeWorkerRoster(
            (game as unknown as { workers?: unknown }).workers,
            game as unknown as {
              weavers?: GameState["workers"]["weaver"];
              masterWeavers?: GameState["workers"]["master"];
              sachetMakers?: GameState["workers"]["sachet_maker"];
            },
          );
          game.revealedIntel = game.revealedIntel ?? [];
          game.phase2DemandTags = game.phase2DemandTags ?? [];
          game.modifierFlags = game.modifierFlags ?? {};
          // A voyage saved before Great Houses existed carries no perk set
          // at all, and every wage, market and pirate path now reads one.
          // Healing it here keeps an old save loadable rather than turning
          // a missing field into a crash the first time a wage is paid.
          //
          // houseId is deliberately left as the save recorded it, not
          // refreshed from the legacy row above: a pledge made after this
          // voyage began applies to the next one, never mid voyage.
          game.housePerks = game.housePerks ?? noHousePerks();
          game.houseId = game.houseId ?? null;
          game.priceHistory = game.priceHistory ?? {};
          // A voyage saved before the fleet commission existed carries
          // neither field, and both the panel and the report to the harbor
          // read them, so an unhealed save would turn a missing key into a
          // crash on the first render.
          game.objectiveDelivered = game.objectiveDelivered ?? {};
          game.objectiveTrace = game.objectiveTrace ?? [];
          // Guarantees a key for every catalogued good and scrubs any value a
          // pre catalogue save poisoned with NaN (stored as null by JSON), so
          // a damaged hold heals on load instead of staying broken forever.
          game.inventory = normalizeInventory(game.inventory);
          game.boonChoices = game.boonChoices ?? [];
          game.boonSwapUsed = game.boonSwapUsed ?? false;
          game.moduleSwapUsed = game.moduleSwapUsed ?? false;
          game.pirateAttackResolved = game.pirateAttackResolved ?? false;
          game.escortHired = game.escortHired ?? false;
          game.brokerTippedPirates = game.brokerTippedPirates ?? false;
          game.debts = game.debts ?? [];
          game.loansGiven = game.loansGiven ?? [];
          game.defaultedDebt = game.defaultedDebt ?? false;
          // Refresh Renown from the freshly loaded legacy so a captain who
          // leveled up since this voyage was saved gets the current unlock
          // state; fall back to the saved value (then 1) if legacy is missing.
          game.renownLevel = legacyResult
            ? renownLevel
            : (game.renownLevel ?? 1);
          game.brokersFavorUsed = game.brokersFavorUsed ?? false;
          // A save written before helping other captains had a per voyage
          // ceiling has no tally at all, and the ceiling is arithmetic:
          // cap minus undefined is NaN, which would then be added straight
          // into score the first time that captain lent anyone Gold. A NaN
          // score is not merely wrong, it reads as impossible to the Ledger
          // Integrity Pass and would cost an innocent captain their Renown.
          game.helperReputationEarned = game.helperReputationEarned ?? 0;
          // Old saves predate per voyage seeding; default their epoch to 0.
          // Their already generated cards restore from the blob untouched, so
          // only a future round would reseed, which is fine.
          game.voyageEpoch = game.voyageEpoch ?? 0;
          // Refresh difficulty from the room (the authoritative source), the
          // same reason renownLevel is refreshed above; default an old save
          // that predates difficulty to whatever tier the room is on.
          game.difficulty = normalizeDifficulty(
            roomDifficulty ?? game.difficulty,
          );
          // Refresh mode from the room for the same reason, and with more at
          // stake: mode decides which order this captain's phases run in. A
          // save that predates modes carries no mode at all, and one restored
          // under a lap the room is not keeping would run the right phases in
          // the wrong order and quietly desynchronize from everyone else. The
          // room is authoritative, so it wins; the caller's hint covers a
          // response that does not carry the field.
          game.mode = normalizeMode(apiMode ?? roomMode ?? game.mode);
          dispatch({ type: "INIT", game, logs: [] });
        } else {
          dispatch({
            type: "START_FRESH",
            checkpoint: checkpoint
              ? {
                  round: checkpoint.currentRound,
                  phase: checkpoint.currentPhase,
                }
              : null,
            ctx,
            startingGoldBonus: goldBonus,
            renownLevel,
            voyageEpoch: checkpoint?.voyageEpoch ?? 0,
            difficulty: roomDifficulty,
            mode: apiMode ?? roomMode,
            houseId,
          });
        }
      } catch {
        if (alive && !loadTimedOut) {
          clearTimeout(timeoutId);
          // Include ctx so a fresh game is still seeded with the room's
          // deterministic economy, and include the room's last known
          // checkpoint so a captain who had a network error doesn't land
          // back at round 1 while everyone else is mid voyage. The
          // remembered House and Renown ride along too, so a failed fetch
          // never turns a pledge into no pledge or a captain into a
          // first voyage beginner.
          dispatch({
            type: "START_FRESH",
            checkpoint: null,
            ctx,
            houseId: houseIdRef.current,
            renownLevel: renownRef.current,
            startingGoldBonus: renownStartingGoldBonus(renownRef.current),
            mode: roomMode,
          });
        }
      }
    })();
    return () => {
      alive = false;
      clearTimeout(timeoutId);
    };
  }, [roomId, enabled, ctx, roomMode]);

  // The payload both broadcasts below send, built in one place.
  //
  // It was written out twice before, which is how the two drifted: the
  // debounced broadcast and the heartbeat are supposed to carry identical
  // information about a captain, and copying the object is how one of
  // them quietly stops keeping up with the other.
  //
  // renownLevel rides along because the harbor roster needs it to decide
  // whether the Partial Sight peek is allowed. Without it every other
  // captain reads as Renown level zero, the trust check can never pass,
  // and the peek stays hidden for everyone no matter how established the
  // two captains are.
  const buildStatus = useCallback(
    () => ({
      roomId,
      round: state.game.currentRound,
      phase: state.game.phase,
      phaseLabel: phaseLabel(state.game),
      gold: state.game.money,
      reputation: state.game.score,
      shipLevel: state.game.shipLevel,
      gameOver: state.game.gameOver,
      renownLevel: state.game.renownLevel,
    }),
    [roomId, state.game],
  );

  // Broadcast live status to the room on every game change.
  const broadcastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!enabled || !state.loaded || !socket) return;
    if (broadcastTimer.current) clearTimeout(broadcastTimer.current);
    broadcastTimer.current = setTimeout(() => {
      socket.emit("game:status", buildStatus());
    }, 120);
    return () => {
      if (broadcastTimer.current) clearTimeout(broadcastTimer.current);
    };
  }, [buildStatus, state.loaded, socket, enabled]);

  // Heartbeat: re broadcast status every 8s so the server side cache stays
  // fresh and late joiners (or reconnects after a realtime restart) hydrate.
  useEffect(() => {
    if (!enabled || !state.loaded || !socket) return;
    const t = setInterval(() => {
      socket.emit("game:status", buildStatus());
    }, 8000);
    return () => clearInterval(t);
  }, [buildStatus, state.loaded, socket, enabled]);

  // Autosave (debounced) to the server.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors the latest game state / unsaved changes flag outside React state so
  // the unmount cleanup below can see them without becoming stale.
  const latestGameRef = useRef(state.game);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!enabled || !state.loaded) return;
    latestGameRef.current = state.game;
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    dispatch({ type: "SET_SAVING", saving: true, at: state.lastSavedAt ?? 0 });
    saveTimer.current = setTimeout(async () => {
      try {
        await api.saveGameState(roomId, latestGameRef.current);
        dirtyRef.current = false;
        dispatch({ type: "SET_SAVING", saving: false, at: Date.now() });
      } catch {
        dispatch({
          type: "SET_SAVING",
          saving: false,
          at: state.lastSavedAt ?? 0,
        });
      }
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state.game, state.loaded, roomId, enabled]);

  // Flush any unsaved changes immediately. Call this before deliberately
  // leaving a room so the debounce window above can't silently drop the
  // player's last action.
  const flush = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (!dirtyRef.current) return;
    try {
      await api.saveGameState(roomId, latestGameRef.current);
      dirtyRef.current = false;
      dispatch({ type: "SET_SAVING", saving: false, at: Date.now() });
    } catch {
      // Leave dirtyRef set so the unmount safety net below still tries once more.
    }
  }, [roomId]);

  // Safety net: if the component unmounts (or the room changes) while a save
  // is still pending, flush it instead of silently losing the player's most
  // recent action. Covers any future unmount path that doesn't call flush().
  useEffect(() => {
    return () => {
      if (dirtyRef.current) {
        api.saveGameState(roomId, latestGameRef.current).catch(() => {});
        dirtyRef.current = false;
      }
    };
  }, [roomId]);

  const act = useCallback(
    (fn: (g: GameState, logs: string[]) => void) =>
      dispatch({ type: "APPLY", fn }),
    [],
  );

  return { state, act, ctx, flush, startingGoldBonus };
}
