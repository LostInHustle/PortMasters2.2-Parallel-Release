"use client";

// =====================================================================
// The voyage log, client side.
//
// Holds the lines the room has written for the voyage this captain is
// sitting in, and asks the server for the ones written before they were
// listening. The public half of the pair: the captain's own channel is
// src/lib/use-private-log.ts, and the two are read side by side at Dusk.
//
// The list is stamped with the room it arrived in, the same discipline the
// private channel keeps and for the same reason: a captain who sails from
// one harbor straight into another is never shown a line from the voyage
// they just left. It is emptied on room:restarted, because a restarted
// voyage is a new voyage and the server's own log starts empty with it.
//
// The history is asked for rather than sent on arrival, and that is a
// decision about the socket rather than about the log. A captain carries
// five other subscriptions that ask the server for their state the moment
// the room mounts, and this is not a sixth: the only screen that draws a
// log is Dusk, so the request goes out when a captain stands there, and a
// captain who never does costs the server nothing.
//
// Everything off the wire is read through the normalizer in
// src/lib/game/voyage-log.ts, so a frame that is not a line leaves the log
// as it was rather than drawing a blank row.
// =====================================================================

import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import type { VoyageLogDelivery, VoyageLogHistory } from "@/types/realtime";
import {
  appendVoyageLog,
  normalizeVoyageLog,
  normalizeVoyageLogEntry,
  type VoyageLogEntry,
} from "@/lib/game/voyage-log";

export type VoyageLog = {
  /** The voyage so far, oldest line first. */
  entries: VoyageLogEntry[];
  /**
   * Asks the server for the whole log. Called by the surface that draws it
   * rather than by this hook on mount, which is what keeps the request off
   * a captain's first frame in a room.
   */
  pull: () => void;
};

export function useVoyageLog(
  socket: Socket | null,
  roomId: string | null,
): VoyageLog {
  // One state object rather than two: the lines and the room they belong
  // to are a single fact, and separating them is how the two get out of
  // step while a socket is being replaced.
  const [held, setHeld] = useState<{
    roomId: string;
    entries: VoyageLogEntry[];
  } | null>(null);

  useEffect(() => {
    if (!socket || !roomId) return;

    // The handler is handed the wire shape rather than a shape written out
    // here, the same way the private channel's is, and it still reads every
    // field through the normalizer below: a declared type is what the
    // server means to send, and the normalizer is what a client agrees to
    // draw.
    const onEntry = (data: VoyageLogDelivery) => {
      if (data?.roomId !== roomId) return;
      const entry = normalizeVoyageLogEntry(data.entry);
      if (!entry) return;
      setHeld((prev) =>
        prev?.roomId === roomId
          ? { roomId, entries: appendVoyageLog(prev.entries, entry) }
          : { roomId, entries: [entry] },
      );
    };
    const onHistory = (data: VoyageLogHistory) => {
      if (data?.roomId !== roomId) return;
      setHeld({ roomId, entries: normalizeVoyageLog(data.entries) });
    };
    const onRestarted = (data: { roomId?: string }) => {
      if (data?.roomId !== roomId) return;
      setHeld(null);
    };

    socket.on("voyage:log", onEntry);
    socket.on("voyage:log:history", onHistory);
    socket.on("room:restarted", onRestarted);
    return () => {
      socket.off("voyage:log", onEntry);
      socket.off("voyage:log:history", onHistory);
      socket.off("room:restarted", onRestarted);
    };
  }, [socket, roomId]);

  const pull = useCallback(() => {
    if (!socket || !roomId) return;
    socket.emit("voyage:log:request", { roomId });
  }, [socket, roomId]);

  return { entries: held?.roomId === roomId ? held.entries : [], pull };
}
