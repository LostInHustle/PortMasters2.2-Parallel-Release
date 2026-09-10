"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { VentureContributor, VentureSummary } from "@/types/realtime";

// The wire shape for a venture lives in @/types/realtime as VentureSummary.
// The hook keeps the original ConvoyVenture alias and the VentureContributor
// re export for back compat with the Settlement phase component's imports.
export type { VentureContributor };
export type ConvoyVenture = VentureSummary;

export type VentureSettlement = {
  userId: string;
  name: string;
  amount: number;
};

// "filled" pays CONVOY_VENTURE_PAYOUT_MULTIPLIER times a contributor's own
// stake, and is the one outcome that can ever happen once per voyage, room
// wide. "failed" refunds only CONVOY_VENTURE_FAILURE_REFUND_RATE after a
// venture's own deadline round passes short of target. "destroyed" refunds
// every contributor in full: a different venture in the same room's voyage
// reached "filled" first and claimed the one shared chance before this one
// got the chance to.
export type VentureOutcome = "filled" | "failed" | "destroyed";

/**
 * Convoy Ventures: the shared, multi round board of open ventures: a thin
 * relay around the venture:* socket events, kept separate from GameState
 * the same way useBarter and useAid are, since an open venture is real
 * room wide state no single client's deterministic engine can compute on
 * its own. Unlike barter and aid, this one is backed by a real database
 * table server side (a venture can outlive a single phase, even a single
 * round), but the client side shape here is deliberately identical to
 * those two: a list, a post, an action, and a callback for when something
 * involving me resolves. The actual Gold effect (escrow on contribute,
 * credit on settlement) is the caller's job via the engine functions in
 * src/lib/game/engine.ts.
 *
 * `onContributed` fires once, only on the client that just contributed,
 * telling it exactly how much of its requested amount actually landed (a
 * venture can be topped up by someone else microseconds earlier, so less
 * may have been needed than was asked to give). `onSettled` fires on
 * every client in the room whenever any venture resolves, for any of the
 * three outcomes above; the caller filters the settlements list for its
 * own userId to find out whether it was involved at all.
 *
 * `locked` reflects whether this room has already used its one Convoy
 * Venture chance for the current voyage: once true, posting a new venture
 * will always be rejected, and it only ever goes back to false on a fresh
 * voyage.
 */
export function useConvoy(
  socket: Socket | null,
  roomId: string,
  onContributed: (ventureId: string, accepted: number) => void,
  onSettled: (
    ventureId: string,
    outcome: VentureOutcome,
    settlements: VentureSettlement[],
  ) => void,
) {
  const [ventures, setVentures] = useState<ConvoyVenture[]>([]);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onContributedRef = useRef(onContributed);
  useEffect(() => {
    onContributedRef.current = onContributed;
  }, [onContributed]);
  const onSettledRef = useRef(onSettled);
  useEffect(() => {
    onSettledRef.current = onSettled;
  }, [onSettled]);

  useEffect(() => {
    if (!socket) return;

    const onUpdate = (data: {
      roomId: string;
      ventures: ConvoyVenture[];
      locked: boolean;
    }) => {
      if (data.roomId !== roomId) return;
      setVentures(data.ventures);
      setLocked(data.locked);
    };
    const onContributedEvent = (data: {
      roomId: string;
      ventureId: string;
      accepted: number;
    }) => {
      if (data.roomId !== roomId) return;
      onContributedRef.current(data.ventureId, data.accepted);
    };
    const onSettledEvent = (data: {
      roomId: string;
      ventureId: string;
      outcome: VentureOutcome;
      settlements: VentureSettlement[];
    }) => {
      if (data.roomId !== roomId) return;
      onSettledRef.current(data.ventureId, data.outcome, data.settlements);
    };
    const onPostError = (data: { roomId: string; error: string }) => {
      if (data.roomId !== roomId) return;
      setError(data.error);
    };

    socket.on("venture:update", onUpdate);
    socket.on("venture:contributed", onContributedEvent);
    socket.on("venture:settled", onSettledEvent);
    socket.on("venture:error", onPostError);
    socket.emit("venture:state:request", { roomId });

    return () => {
      socket.off("venture:update", onUpdate);
      socket.off("venture:contributed", onContributedEvent);
      socket.off("venture:settled", onSettledEvent);
      socket.off("venture:error", onPostError);
    };
  }, [socket, roomId]);

  const post = useCallback(
    (targetGold: number, deadlineRound: number) => {
      if (!socket) return;
      socket.emit("venture:post", { roomId, targetGold, deadlineRound });
    },
    [socket, roomId],
  );

  const contribute = useCallback(
    (ventureId: string, amount: number) => {
      if (!socket) return;
      setError(null);
      socket.emit("venture:contribute", { roomId, ventureId, amount });
    },
    [socket, roomId],
  );

  return {
    ventures,
    locked,
    error,
    clearError: () => setError(null),
    post,
    contribute,
  };
}
