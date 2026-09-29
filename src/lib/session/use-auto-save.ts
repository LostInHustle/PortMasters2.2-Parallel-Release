"use client";

import { useCallback, useEffect, useRef, type Dispatch } from "react";
import { api } from "@/lib/api";
import type { Action, SessionState } from "./reducer";

// =====================================================================
// Persisting the captain's voyage: the debounced autosave, the flush a
// deliberate exit calls, and the safety net that catches an unmount the
// caller did not get to hand a flush.
//
// The flush is handed back so the session can pass it on, and every timer
// and flag below lives here: the three of them are one concern, which is
// when this voyage is written to the server.
// =====================================================================

export function useAutoSave({
  roomId,
  enabled,
  state,
  dispatch,
}: {
  roomId: string;
  enabled: boolean;
  state: SessionState;
  dispatch: Dispatch<Action>;
}): () => Promise<void> {
  const { game, loaded, lastSavedAt } = state;

  // Autosave (debounced) to the server.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors the latest game state / unsaved changes flag outside React state so
  // the unmount cleanup below can see them without becoming stale.
  const latestGameRef = useRef(game);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!enabled || !loaded) return;
    latestGameRef.current = game;
    dirtyRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    dispatch({ type: "SET_SAVING", saving: true, at: lastSavedAt ?? 0 });
    saveTimer.current = setTimeout(async () => {
      try {
        await api.saveGameState(roomId, latestGameRef.current);
        dirtyRef.current = false;
        dispatch({ type: "SET_SAVING", saving: false, at: Date.now() });
      } catch {
        dispatch({
          type: "SET_SAVING",
          saving: false,
          at: lastSavedAt ?? 0,
        });
      }
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [game, loaded, roomId, enabled]);

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

  return flush;
}
