"use client";

import { useCallback, useEffect } from "react";
import type { Socket } from "socket.io-client";
import { statusFrame } from "./status-frame";
import { HEARTBEAT_MS, STATUS_BROADCAST_MS, trailingReport } from "./pacing";
import type { SessionState } from "./reducer";

// =====================================================================
// The two things that tell the harbor where this captain stands: the
// debounced broadcast that follows every change to their voyage, and the
// heartbeat that keeps the server's cache warm for late joiners.
//
// Both send the frame built by ./status-frame, so the two can never
// disagree about what a captain is doing. The cadence they ride on is
// ./pacing's, shared with the objective and round reports.
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

  // Broadcast live status to the harbor on every game change.
  useEffect(() => {
    if (!enabled || !state.loaded || !socket) return;
    return trailingReport(STATUS_BROADCAST_MS, () => {
      socket.emit("game:status", buildStatus());
    });
  }, [buildStatus, state.loaded, socket, enabled]);

  // Heartbeat: rebroadcast status every 8s so the server side cache stays
  // fresh and late joiners (or reconnects after a realtime restart) hydrate.
  useEffect(() => {
    if (!enabled || !state.loaded || !socket) return;
    const t = setInterval(() => {
      socket.emit("game:status", buildStatus());
    }, HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [buildStatus, state.loaded, socket, enabled]);
}
