"use client";

// =====================================================================
// The harbor's restart, read once.
//
// A restart is a new voyage. Everything a captain was holding for the old
// one belongs to a table that no longer exists, so the screens that hold
// something of the voyage's own drop it when the harbor says so: the
// private channel, the voyage log, the boon ledger.
//
// Each of those screens used to carry its own copy of the handler, and
// each copy carried the event's name and the harbor's own id, so a fourth
// screen would have had to remember both and a change to either would
// have had to be made in three places.
//
// The room's id is part of the event and the check is here rather than in
// each screen: a captain who sails from one harbor straight into another
// is on a fresh socket, but a captain whose browser held the old socket
// across a move would otherwise be told by the old harbor's restart that
// its new harbor's screens are empty.
// =====================================================================

import { useEffect } from "react";
import type { Socket } from "socket.io-client";

/**
 * The call a captain's own screen makes when the voyage under them
 * restarts.
 *
 * The callback is held in the effect's own dependency list, so it has to
 * be the same function from one render to the next. A caller that closes
 * over changing values should wrap it in useCallback, or the harbor's
 * restart will be heard by a handler built for a state that has moved on.
 */
export function useRoomRestarted(
  socket: Socket | null,
  roomId: string | null,
  onRestarted: () => void,
): void {
  useEffect(() => {
    if (!socket || !roomId) return;
    const handler = (data: { roomId?: string }) => {
      if (data?.roomId !== roomId) return;
      onRestarted();
    };
    socket.on("room:restarted", handler);
    return () => {
      socket.off("room:restarted", handler);
    };
  }, [socket, roomId, onRestarted]);
}
