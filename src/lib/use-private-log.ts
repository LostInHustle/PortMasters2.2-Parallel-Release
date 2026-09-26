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
// The list is stamped with the room it arrived in, so a captain who sails
// from one harbor straight into another is never shown a card from the
// voyage they just left. It is emptied on room:restarted, because a
// restarted voyage is a new voyage and every card in the old hand belongs
// to a table that no longer exists.
// =====================================================================

import { useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import type { PrivateEntry, PrivateEntryDelivery } from "@/types/realtime";

export function usePrivateLog(
  socket: Socket | null,
  roomId: string | null,
): PrivateEntry[] {
  // One state object rather than two: the entries and the room they
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
    const onRestarted = (data: { roomId?: string }) => {
      if (data?.roomId !== roomId) return;
      setHeld(null);
    };

    socket.on("private:entry", onEntry);
    socket.on("room:restarted", onRestarted);
    return () => {
      socket.off("private:entry", onEntry);
      socket.off("room:restarted", onRestarted);
    };
  }, [socket, roomId]);

  return held?.roomId === roomId ? held.entries : [];
}
