"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Socket } from "socket.io-client";
import { statusFrame } from "./status-frame";
import type { SessionState } from "./reducer";

// =====================================================================
// The two things that tell the room where this captain stands: the
// debounced broadcast that follows every change to their voyage, and the
// heartbeat that keeps the server's cache warm for late joiners.
//
// Both send the frame built by ./status-frame, so the two can never
// disagree about what a captain is doing.
// =====================================================================

export function useStatusBeacon({
  roomId,
  socket,
  enabled,
  state,
}: {
  roomId: string;
  socket: Socket | null;
  enabled: boolean;
  state: SessionState;
}): void {
  const buildStatus = useCallback(
    () => statusFrame(roomId, state.game),
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
}
