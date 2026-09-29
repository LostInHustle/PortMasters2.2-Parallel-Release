"use client";

import { useCallback, useReducer, useState } from "react";
import type { Socket } from "socket.io-client";
import { createInitialGameState, type GameState } from "@/lib/game/types";
import type { GameMode } from "@/lib/game/mode";
import { reducer } from "./session/reducer";
import { useVoyageContext } from "./session/use-voyage-context";
import { useSeatPin, useSeatPinFrames } from "./session/use-seat-pin";
import { useVoyageLoad } from "./session/use-voyage-load";
import { useStatusBeacon } from "./session/use-status-beacon";
import { useAutoSave } from "./session/use-auto-save";

// =====================================================================
// The captain's session: their voyage, the ledger it writes to, and the
// three channels it travels on.
//
// The hook is the wiring. Each concern beside it in ./session is the
// thing itself: the reducer that holds a voyage, the heal applied to one
// loaded off the server, the seat pin the room publishes, the two
// broadcasts that tell the room where this captain stands, and the
// autosave that keeps their work.
// =====================================================================

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
  const ctx = useVoyageContext(roomId, userId);
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
  const { seats: voyageSeats, setSeatPin } = useSeatPin(roomId);

  useVoyageLoad({
    roomId,
    enabled,
    ctx,
    roomMode,
    dispatch,
    setSeatPin,
    setStartingGoldBonus,
  });
  useStatusBeacon({ roomId, socket, enabled, state });
  const flush = useAutoSave({ roomId, enabled, state, dispatch });
  useSeatPinFrames({ roomId, socket, enabled, setSeatPin });

  const act = useCallback(
    (fn: (g: GameState, logs: string[]) => void) =>
      dispatch({ type: "APPLY", fn }),
    [],
  );

  return { state, act, ctx, flush, startingGoldBonus, seats: voyageSeats };
}
