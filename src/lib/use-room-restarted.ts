"use client";

// =====================================================================
// The harbor's restart, read once.
//
// A restart is a new voyage. Everything a captain was holding for the old
// one belongs to a table that no longer exists, so the screens that hold
// something of the voyage's own drop it when the harbor says so: the
// private channel, the voyage log, the boon ledger, the two votes, the
// commission board, the seat pin and the voyage result.
//
// Each of those screens used to carry its own copy of the handler, and
// each copy carried the event's name and the harbor's own id, so a new
// screen would have had to remember both and a change to either would
// have had to be made in every copy.
//
// The room's id is part of the event and the check is here rather than in
// each screen: a captain who sails from one harbor straight into another
// is on a fresh socket, but a captain whose browser held the old socket
// across a move would otherwise be told by the old harbor's restart that
// its new harbor's screens are empty.
// =====================================================================

import { useEffect } from "react";
import type { Socket } from "socket.io-client";
import type { RoomRestartedFrame } from "@/types/realtime/restart";

/**
 * The call a captain's own screen makes when the voyage under them
 * restarts. The frame is handed to the callback for the screens that
 * rebuild a voyage from it (the phase sync reads the epoch, tier and lap);
 * a screen that only drops state ignores it.
 *
 * The callback is held in the effect's own dependency list, so it has to
 * be the same function from one render to the next. A caller that closes
 * over changing values should wrap it in useCallback, or the harbor's
 * restart will be heard by a handler built for a state that has moved on.
 *
 * `enabled` exists for the seat pin, which subscribes to two voyage frames
 * behind one gate and must not hear a restart before that gate opens.
 */
export function useRoomRestarted(
  socket: Socket | null,
  roomId: string | null,
  onRestarted: (frame: RoomRestartedFrame) => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled || !socket || !roomId) return;
    const handler = (data: RoomRestartedFrame) => {
      if (data?.roomId !== roomId) return;
      onRestarted(data);
    };
    socket.on("room:restarted", handler);
    return () => {
      socket.off("room:restarted", handler);
    };
  }, [enabled, socket, roomId, onRestarted]);
}
