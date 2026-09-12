"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { BarterOffer } from "@/types/realtime";

// Forwarded so the Bartering phase component can import the wire shape
// from the same place it imports the hook. The canonical home is
// @/types/realtime so the realtime layer and the client hook share
// one definition.
export type { BarterOffer };

type BarterRefund = { item: string; amount: number };

/**
 * The Bartering phase's shared open offer board: a thin relay around the
 * barter:* socket events, kept separate from GameState the same way
 * usePlayerDetail is, since an open offer is real room wide state no
 * single client's deterministic engine can compute on its own. This hook
 * only tracks the board and tells the caller when a trade closes; the
 * actual inventory effect (escrow on post, credit/debit on a completed
 * trade, refund on cancel) is the caller's job via the engine functions
 * in src/lib/game/engine.ts.
 *
 * `onFulfilled` fires once for every trade involving me, on both sides:
 * as the accepter (pay the requested item, receive the offered one) and
 * as the original poster (receive the requested item, the offered side
 * was already escrowed away when the offer was posted). The caller tells
 * the two apart by comparing `accepterId` against its own user id.
 */
export function useBarter(
  socket: Socket | null,
  roomId: string,
  myUserId: string,
  onFulfilled: (offer: BarterOffer, accepterId: string) => void,
) {
  const [offers, setOffers] = useState<BarterOffer[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Always rebuilt from the latest "barter:update" broadcast below, never
  // tracked separately, the server's board is the single source of truth
  // for what's still open, so deriving from it here means there's no extra
  // bookkeeping that could drift out of sync with it.
  const myOpenRef = useRef<Map<string, BarterRefund>>(new Map());

  const onFulfilledRef = useRef(onFulfilled);
  useEffect(() => {
    onFulfilledRef.current = onFulfilled;
  }, [onFulfilled]);

  useEffect(() => {
    if (!socket) return;

    const onUpdate = (data: { roomId: string; offers: BarterOffer[] }) => {
      if (data.roomId !== roomId) return;
      setOffers(data.offers);
      const mine = new Map<string, BarterRefund>();
      for (const o of data.offers) {
        if (o.fromUserId === myUserId)
          mine.set(o.id, { item: o.offerItem, amount: o.offerAmount });
      }
      myOpenRef.current = mine;
    };
    const onFulfilledEvent = (data: {
      roomId: string;
      offer: BarterOffer;
      accepterId: string;
      accepterName: string;
    }) => {
      if (data.roomId !== roomId) return;
      onFulfilledRef.current(data.offer, data.accepterId);
    };
    const onAcceptFail = (data: {
      roomId: string;
      offerId: string;
      reason: string;
    }) => {
      if (data.roomId !== roomId) return;
      setError(data.reason);
    };
    const onPostError = (data: { roomId: string; error: string }) => {
      if (data.roomId !== roomId) return;
      setError(data.error);
    };

    socket.on("barter:update", onUpdate);
    socket.on("barter:fulfilled", onFulfilledEvent);
    socket.on("barter:accept:fail", onAcceptFail);
    socket.on("barter:error", onPostError);
    socket.emit("barter:state:request", { roomId });

    return () => {
      socket.off("barter:update", onUpdate);
      socket.off("barter:fulfilled", onFulfilledEvent);
      socket.off("barter:accept:fail", onAcceptFail);
      socket.off("barter:error", onPostError);
    };
  }, [socket, roomId, myUserId]);

  const post = useCallback(
    (
      offerItem: string,
      offerAmount: number,
      requestItem: string,
      requestAmount: number,
      targetUserId?: string,
    ) => {
      if (!socket) return;
      socket.emit("barter:post", {
        roomId,
        offerItem,
        offerAmount,
        requestItem,
        requestAmount,
        ...(targetUserId ? { targetUserId } : {}),
      });
    },
    [socket, roomId],
  );

  const cancel = useCallback(
    (offerId: string) => {
      if (!socket) return;
      socket.emit("barter:cancel", { roomId, offerId });
    },
    [socket, roomId],
  );

  const accept = useCallback(
    (offerId: string) => {
      if (!socket) return;
      setError(null);
      socket.emit("barter:accept", { roomId, offerId });
    },
    [socket, roomId],
  );

  // Called once, by the Bartering phase's "Done" button, the instant it's
  // ready to move on. Reads myOpenRef live rather than a value captured at
  // click time, since markReady's transition doesn't actually run until
  // every other captain has also readied up, by then, more of my offers
  // may have been accepted (see the race safety note in engine.ts's
  // completeBarterPhase).
  const takeMyOpenRefunds = useCallback(
    (): BarterRefund[] => Array.from(myOpenRef.current.values()),
    [],
  );

  return {
    offers,
    error,
    clearError: () => setError(null),
    post,
    cancel,
    accept,
    takeMyOpenRefunds,
  };
}
