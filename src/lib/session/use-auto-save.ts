"use client";

import { useCallback, useEffect, useRef, type Dispatch } from "react";
import { api } from "@/lib/api";
import type { Action, SessionState } from "./reducer";

// =====================================================================
// Persisting the captain's voyage: the debounced autosave, the flush a
// deliberate exit calls, and the two safety nets that catch the exits
// nobody gets to hand a flush, an unmount and the document itself going
// away.
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

  // The safety net for the exits the unmount above never sees: a hard
  // refresh, a navigation away, or a tab the browser closes tears the
  // document down without React unmounting anything, and an action pressed
  // inside the debounce window goes with it (the state changed, the timer
  // is still counting, and the page is gone). pagehide fires for each of
  // those exits, and visibilitychange to hidden is the one a mobile browser
  // gives before backgrounding the tab, so the two are listened to as one
  // question with one answer. This narrows the same window for every action
  // in the session, not just the one that found it.
  //
  // The request is written out rather than read through api.saveGameState,
  // because keepalive is the whole point of this one and that helper does
  // not thread a RequestInit through. keepalive asks the browser to finish
  // the request after the document is gone, which is the job sendBeacon
  // does for a POST: the save route is a PUT, so a beacon cannot carry this
  // write. The browser caps a keepalive body (around 64 KiB), so an
  // unusually large save is dropped rather than half written, which is why
  // the handler stays best effort throughout: a captain with nothing
  // pending pays one guard read, and an exit the browser cuts off anyway
  // loses no more than it did before.
  useEffect(() => {
    const flushOnHide = () => {
      if (!dirtyRef.current) return;
      fetch("/api/game/state", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, data: latestGameRef.current }),
        keepalive: true,
      }).catch(() => {});
      dirtyRef.current = false;
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushOnHide();
    };
    window.addEventListener("pagehide", flushOnHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flushOnHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [roomId]);

  return flush;
}
