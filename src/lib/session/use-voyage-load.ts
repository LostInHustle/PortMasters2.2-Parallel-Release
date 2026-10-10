"use client";

import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { api } from "@/lib/api";
import { renownStartingGoldBonus, type HouseId } from "@/lib/game/legacy";
import type { GameContext, GameState } from "@/lib/game/types";
import type { GameMode } from "@/lib/game/mode";
import { healLoadedVoyage } from "./heal-save";
import type { Action } from "./reducer";
import type { SeatPin } from "./use-seat-pin";

// =====================================================================
// Loading the captain's voyage when they arrive, or when the room they
// are standing in changes.
//
// Three answers are possible and all three have to leave a captain able to
// play: the room had a voyage, the room had none, and the server never
// answered at all. Each one ends in a dispatch, which is why the reading
// itself lives here rather than in the hook that owns the state.
// =====================================================================

// The room's answer to a load, and the account's, as the API types them.
type LoadedVoyage = Awaited<ReturnType<typeof api.getGameState>>;
type LoadedLegacy = Awaited<ReturnType<typeof api.getLegacy>>;

// Everything a step of the load is handed: where the voyage is, what a
// fresh one is seeded with, and the two setters and two memories the
// fallback paths write through.
type LoadEnv = {
  roomId: string;
  ctx: GameContext;
  roomMode?: GameMode;
  dispatch: Dispatch<Action>;
  setSeatPin: Dispatch<SetStateAction<SeatPin | null>>;
  setStartingGoldBonus: Dispatch<SetStateAction<number>>;
  houseIdRef: { current: HouseId | null };
  renownRef: { current: number };
};

// The two values a fallback load reaches for, remembered across loads.
function useFallbackMemory(): {
  houseIdRef: { current: HouseId | null };
  renownRef: { current: number };
} {
  // The captain's pledged Great House, remembered across loads. The
  // fallback path below fires precisely when the captain's own data could
  // not be read, and a voyage seeded Houseless would quietly cost them a
  // perk they had already chosen, so it falls back to this rather than to
  // null. It starts null, which is correct for a captain who has not
  // pledged yet and for a first load that never reached the server.
  const houseIdRef = useRef<HouseId | null>(null);
  // The captain's Renown, remembered across loads for the same reason and
  // on the same path as the House above. A fallback load that seeded
  // Renown at the base level would quietly demote the captain: Renown gates
  // the Broker's Favor, the harbor peek, and the starting Gold a new voyage
  // opens with, so losing it costs unlocks they had already earned rather
  // than merely looking wrong on a screen. It starts at the base level,
  // which is the correct reading for a first load that never reached the
  // server and for a captain who has not earned any Renown yet.
  const renownRef = useRef(1);
  return { houseIdRef, renownRef };
}

// The two reads a load is made of, asked together: the room's own record of
// the voyage, and the captain's account beside it.
function fetchVoyage(
  roomId: string,
): Promise<[LoadedVoyage, LoadedLegacy | null]> {
  return Promise.all([
    api.getGameState(roomId),
    // A brand new captain (no CaptainLegacy row yet) or a fetch
    // that fails outright just means no bonus this load; never
    // block picking up the actual voyage over it.
    api.getLegacy().catch(() => null),
  ]);
}

// A loaded voyage with its healed fields, and the account's own answer,
// applied to the session.
export function useVoyageLoad({
  roomId,
  enabled,
  ctx,
  roomMode,
  dispatch,
  setSeatPin,
  setStartingGoldBonus,
}: {
  roomId: string;
  enabled: boolean;
  ctx: GameContext;
  roomMode?: GameMode;
  dispatch: Dispatch<Action>;
  setSeatPin: Dispatch<SetStateAction<SeatPin | null>>;
  setStartingGoldBonus: Dispatch<SetStateAction<number>>;
}): void {
  const { houseIdRef, renownRef } = useFallbackMemory();
  const env: LoadEnv = {
    roomId,
    ctx,
    roomMode,
    dispatch,
    setSeatPin,
    setStartingGoldBonus,
    houseIdRef,
    renownRef,
  };

  // Load saved state on mount / room change.
  useEffect(() => {
    if (!enabled) return;
    let alive = true;

    // One background retry for the two unreachable paths below, and the
    // reason this hook asks a second time at all: a transport hiccup that
    // costs the first request must not cost the voyage. The retry repeats
    // the same two reads and lands whatever the room really holds, its
    // save first and its checkpoint second, through the loaded path
    // below. A retry that fails too leaves the fresh fallback standing
    // and stops asking.
    const LOAD_RETRY_MS = 6_000;
    let retryId: ReturnType<typeof setTimeout> | null = null;
    const retryUnreachableLoad = () => {
      if (!alive || retryId !== null) return;
      retryId = setTimeout(async () => {
        try {
          const [loaded, legacyResult] = await fetchVoyage(roomId);
          if (!alive) return;
          applyLoadedAnswer(env, loaded, legacyResult);
        } catch {
          // Still unreachable. The fresh fallback already in place stands.
        }
      }, LOAD_RETRY_MS);
    };

    // Safety net: if the API call hangs (network hiccup, server spinning up),
    // fall back to a fresh game after 12 s instead of showing the loading
    // screen forever. This is the root cause fix for the loading freeze
    // reported when joining or hosting a room.
    const LOAD_TIMEOUT_MS = 12_000;
    let loadTimedOut = false;
    const timeoutId = setTimeout(() => {
      if (!alive) return;
      loadTimedOut = true;
      applyUnreachableLoad(env);
      retryUnreachableLoad();
    }, LOAD_TIMEOUT_MS);

    (async () => {
      try {
        const [loaded, legacyResult] = await fetchVoyage(roomId);
        if (!alive || loadTimedOut) return;
        clearTimeout(timeoutId);
        applyLoadedAnswer(env, loaded, legacyResult);
      } catch {
        if (alive && !loadTimedOut) {
          clearTimeout(timeoutId);
          applyUnreachableLoad(env);
          retryUnreachableLoad();
        }
      }
    })();

    return () => {
      alive = false;
      clearTimeout(timeoutId);
      if (retryId !== null) clearTimeout(retryId);
    };
  }, [roomId, enabled, ctx, roomMode]);
}

// The reading for the two loads that never reached the room, whether the
// request hung past its safety net or answered with an error. Both carry
// the same facts, so both leave the same state: no pin, because a request
// that never landed knows nothing about the fleet's size and this captain
// draws the founding board and keeps a working hand rather than holding a
// commission they are forbidden to touch, and no checkpoint, because the
// room never said where it was standing. The seed still carries the
// room's deterministic economy through ctx, and the House and Renown
// remembered across loads ride along, so an unreachable server never
// turns a pledge into no pledge or a captain into a first voyage
// beginner. What closes the checkpoint gap is the retry the caller
// schedules beside this call: an answer on that second ask lands the
// room's real voyage through the loaded path beside this one.
function applyUnreachableLoad(env: LoadEnv): void {
  env.setSeatPin({ roomId: env.roomId, seats: 0 });
  env.dispatch({
    type: "START_FRESH",
    checkpoint: null,
    ctx: env.ctx,
    houseId: env.houseIdRef.current,
    renownLevel: env.renownRef.current,
    startingGoldBonus: renownStartingGoldBonus(env.renownRef.current),
    mode: env.roomMode,
  });
}

// What the room answered, once it has answered: the pin, the two values
// remembered for the fallback paths above, and the voyage itself, healed
// and handed to the reducer.
function applyLoadedAnswer(
  env: LoadEnv,
  loaded: LoadedVoyage,
  legacyResult: LoadedLegacy | null,
): void {
  const {
    state: raw,
    checkpoint,
    difficulty: roomDifficulty,
    // Named for what it is rather than shadowing the roomMode the
    // caller passed in. Both are in play below and they are allowed
    // to disagree: the response is the room answering live, the
    // argument is what the lobby said a moment before the request.
    mode: apiMode,
    // The seat count this voyage was pinned to, which is the one
    // room fact on this response that nothing else can substitute
    // for. A response without it is a room with no voyage pinned,
    // which is the founding board and the reading every client had
    // before the rung existed.
    seats: roomSeats,
  } = loaded;
  // Both halves of the room's answer land in one render, this batch
  // included, so the commission a captain draws for the voyage they
  // just restored is drawn at the table size that voyage was dealt
  // to rather than one render later.
  env.setSeatPin({
    roomId: env.roomId,
    seats: typeof roomSeats === "number" ? roomSeats : 0,
  });
  const goldBonus = legacyResult
    ? renownStartingGoldBonus(legacyResult.legacy.renownLevel)
    : 0;
  const renownLevel = legacyResult ? legacyResult.legacy.renownLevel : 1;
  // A legacy row we could not read is not evidence of a captain with
  // no House, so it leaves the remembered one standing.
  const houseId = legacyResult
    ? legacyResult.legacy.houseId
    : env.houseIdRef.current;
  if (legacyResult) env.houseIdRef.current = legacyResult.legacy.houseId;
  if (legacyResult) env.renownRef.current = legacyResult.legacy.renownLevel;
  env.setStartingGoldBonus(goldBonus);
  if (raw) {
    const game = JSON.parse(raw) as GameState;
    healLoadedVoyage(game, {
      apiMode,
      roomMode: env.roomMode,
      roomDifficulty,
      legacyRenownLevel: legacyResult ? renownLevel : null,
    });
    env.dispatch({ type: "INIT", game, logs: [] });
  } else {
    env.dispatch({
      type: "START_FRESH",
      checkpoint: checkpoint
        ? {
            round: checkpoint.currentRound,
            phase: checkpoint.currentPhase,
          }
        : null,
      ctx: env.ctx,
      startingGoldBonus: goldBonus,
      renownLevel,
      voyageEpoch: checkpoint?.voyageEpoch ?? 0,
      difficulty: roomDifficulty,
      mode: apiMode ?? env.roomMode,
      houseId,
    });
  }
}
