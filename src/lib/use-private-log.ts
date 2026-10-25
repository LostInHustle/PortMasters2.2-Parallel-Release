"use client";

// =====================================================================
// The private channel, client side.
//
// Holds the entries the server has addressed to this captain and to
// nobody else, for the voyage they are sitting in. It answers with a list
// rather than with one named secret, because the channel carries whatever
// the table is hiding from the rest of it and the screen that prints them
// should not have to know what those things are.
//
// The list is stamped with the harbor it arrived in, so a captain who sails
// from one harbor straight into another is never shown a card from the
// voyage they just left. It is emptied on room:restarted, because a
// restarted voyage is a new voyage and every card in the old hand belongs
// to a table that no longer exists.
// =====================================================================

import {
  PrivateEntry,
  PrivateEntryDelivery,
} from "@/types/realtime/private-entry";
import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import { useRoomRestarted } from "@/lib/use-room-restarted";

export function usePrivateLog(
  socket: Socket | null,
  roomId: string | null,
): PrivateEntry[] {
  // One state object rather than two: the entries and the harbor they
  // belong to are a single fact, and separating them is how the two get
  // out of step.
  const [held, setHeld] = useState<{
    roomId: string;
    entries: PrivateEntry[];
  } | null>(null);

  useEffect(() => {
    if (!socket || !roomId) return;

    const onEntry = (data: PrivateEntryDelivery) => {
      if (data?.roomId !== roomId || !data.entry) return;
      setHeld((prev) =>
        prev?.roomId === roomId
          ? { roomId, entries: [...prev.entries, data.entry] }
          : { roomId, entries: [data.entry] },
      );
    };

    socket.on("private:entry", onEntry);
    return () => {
      socket.off("private:entry", onEntry);
    };
  }, [socket, roomId]);

  // A restarted voyage is a new voyage, and every card in the old hand
  // belongs to a table that no longer exists. The reading of the harbor's
  // restart is the shared one (see useRoomRestarted), which is where the
  // event's name lives.
  const onRestarted = useCallback(() => {
    setHeld(null);
  }, []);
  useRoomRestarted(socket, roomId, onRestarted);

  return held?.roomId === roomId ? held.entries : [];
}
