"use client";

import { useMemo } from "react";
import type { GameContext } from "@/lib/game/types";

// The captain's own deterministic seed identity. Folding userId in is what
// gives every captain their own market, orders, and Broker intel instead of
// a room wide identical economy derived from roomId alone.
export function useVoyageContext(roomId: string, userId: string): GameContext {
  return useMemo(
    () => ({
      seedBase: userId ? `${roomId}:${userId}` : roomId,
      // The same room, without the captain. Only the public objective seeds
      // from this, because it is the one draw the whole harbor has to agree
      // on rather than one each.
      harborId: roomId,
    }),
    [roomId, userId],
  );
}
