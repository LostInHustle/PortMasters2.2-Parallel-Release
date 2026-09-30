"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { Socket } from "socket.io-client";

// =====================================================================
// The voyage's own seat count: how many captains the voyage under way was
// dealt to, as the room pinned it at departure.
//
// Two hooks in one file because they are one fact, and the session has to
// call them at two different points: the reading is state the loader
// writes as it loads, and the two frames that move it are subscribed where
// the session has always subscribed them, so the effects still run in the
// order they have always run in.
// =====================================================================

export type SeatPin = { roomId: string; seats: number };

// [H5: the quota rung] How many captains the voyage now under way was
// dealt to, as the room pinned it at departure, stamped with the room it
// belongs to exactly as the private log and the commission board are. It
// is the second input to the public commission (see ./game/objectives.ts)
// and the only fact this hook holds that a captain cannot work out for
// themselves: membership can change mid voyage, so the size the quotas
// were scaled to has to be read from the room rather than counted off a
// roster.
//
// Null is a real state and not a synonym for zero: zero means the room has
// no voyage pinned, and nothing may be handed over against a board while
// the number that decides its quotas is unknown. A stamp from another
// harbor reads as null rather than as a value, which is also what makes a
// room change safe without an effect having to clear it.
export function useSeatPin(roomId: string): {
  seats: number | null;
  setSeatPin: Dispatch<SetStateAction<SeatPin | null>>;
} {
  const [seatPin, setSeatPin] = useState<SeatPin | null>(null);
  const seats = seatPin?.roomId === roomId ? seatPin.seats : null;
  return { seats, setSeatPin };
}

// The voyage's own seat count, over the wire.
//
// The start frame is what moves a lobby into a voyage, so the size the
// voyage was dealt to has to arrive on the same frame: the commission's
// quotas are a function of it, and a captain drawing the board from a
// count that is one departure out of date would be working a different
// commission than the one the server clamps their report against. The
// restart is the other half of the same fact, because a restarted voyage
// has no pin until the next departure writes one.
//
// A frame without a usable number reads as no pin rather than as unknown,
// which is the one direction that cannot wedge a hand shut: a client that
// hears "we have set sail" and cannot scale the commission is better off
// working the founding board than refusing to work at all.
export function useSeatPinFrames({
  roomId,
  socket,
  enabled,
  setSeatPin,
}: {
  roomId: string;
  socket: Socket | null;
  enabled: boolean;
  setSeatPin: Dispatch<SetStateAction<SeatPin | null>>;
}): void {
  useEffect(() => {
    if (!enabled || !socket) return;
    const onStarted = (data: { roomId?: string; seats?: unknown }) => {
      if (data?.roomId !== roomId) return;
      setSeatPin({
        roomId,
        seats: typeof data.seats === "number" ? data.seats : 0,
      });
    };
    const onRestarted = (data: { roomId?: string }) => {
      if (data?.roomId !== roomId) return;
      setSeatPin({ roomId, seats: 0 });
    };
    socket.on("room:started", onStarted);
    socket.on("room:restarted", onRestarted);
    return () => {
      socket.off("room:started", onStarted);
      socket.off("room:restarted", onRestarted);
    };
  }, [enabled, socket, roomId]);
}
