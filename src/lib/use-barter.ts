"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { BarterOffer } from "@/types/realtime";

// Forwarded so the Bartering phase component can import the wire shape
// from the same place it imports the hook. The canonical home is
// @/types/realtime so the realtime layer and the client hook share
// one definition.
export type { BarterOffer };

/**
 * The room's shared open offer board: a thin relay around the barter:*
 * socket events, kept separate from GameState the same way
 * usePlayerDetail is, since an open offer is real room wide state no
 * single client's deterministic engine can compute on its own. This hook
 * only tracks the board; the actual inventory effect (escrow on post,
 * credit and debit on a completed trade, escrow returned on a withdrawal
 * or a sweep) is the caller's job via the engine functions in
 * src/lib/game/engine.ts.
 *
 * `onFulfilled` fires once for every trade involving me, on both sides:
 * as the accepter (pay the requested item, receive the offered one) and
 * as the original poster (receive the requested item, the offered side
 * was already escrowed away when the offer was posted). The caller tells
 * the two apart by comparing `accepterId` against its own user id.
 *
 * `onRefund` fires with an offer of mine that is holding escrow which now
 * has to come back, and it is the only way that ever happens. There are
 * two cases and they arrive by different routes on purpose:
 *
 *   - I withdrew it. The caller wants the goods back at that instant, so
 *     withdrawing reports it here directly.
 *   - The server swept it. The board is cleared whenever the voyage moves
 *     on, from any phase, and again when the voyage concludes. Nothing
 *     tells this hook that happened; it notices, because the board it
 *     just received no longer lists an offer it held a moment ago, and
 *     the server is the single source of truth for what is still open.
 *
 * Noticing rather than being told is what makes this safe to run in every
 * phase. An offer can only ever be reported here if this client saw it on
 * the board first, addressed to itself, so the report is bounded by the
 * server's own view and a stale or repeated broadcast cannot invent one.
 * The board also arrives whole on every join, which is what makes a
 * reload mid voyage come back with the right escrow ledger.
 */
export function useBarter(
  socket: Socket | null,
  roomId: string,
  myUserId: string,
  onFulfilled: (offer: BarterOffer, accepterId: string) => void,
  onRefund: (offer: BarterOffer) => void,
) {
  const [offers, setOffers] = useState<BarterOffer[]>([]);
  const [error, setError] = useState<string | null>(null);

  // My own offers exactly as the board last reported them. Never tracked
  // separately from a broadcast, so the server stays the single source of
  // truth for what is still open and there is no second opinion here that
  // could drift from it. It doubles as the escrow ledger: an offer that
  // was in here and is not any more has left the board, and whatever it
  // was holding has to come back.
  const myOpenRef = useRef<Map<string, BarterOffer>>(new Map());

  // Offer ids that left the board for a reason the caller has already
  // handled, so their disappearance must not be read as a sweep. Without
  // this, a filled offer looks exactly like a swept one, and the poster
  // of a completed trade would be paid for the sale and handed back the
  // collateral as well. Only ids still on the board are worth keeping,
  // and the set is pruned to those on every update, so it can never grow
  // past the number of offers this captain has open at once.
  const settledRef = useRef<Set<string>>(new Set());

  const onFulfilledRef = useRef(onFulfilled);
  useEffect(() => {
    onFulfilledRef.current = onFulfilled;
  }, [onFulfilled]);
  const onRefundRef = useRef(onRefund);
  useEffect(() => {
    onRefundRef.current = onRefund;
  }, [onRefund]);

  useEffect(() => {
    if (!socket) return;

    const onUpdate = (data: { roomId: string; offers: BarterOffer[] }) => {
      if (data.roomId !== roomId) return;
      setOffers(data.offers);
      const next = new Map<string, BarterOffer>();
      for (const o of data.offers) {
        if (o.fromUserId === myUserId) next.set(o.id, o);
      }
      for (const [id, offer] of myOpenRef.current) {
        if (!next.has(id) && !settledRef.current.has(id))
          onRefundRef.current(offer);
      }
      myOpenRef.current = next;
      for (const id of settledRef.current) {
        if (!next.has(id)) settledRef.current.delete(id);
      }
    };
    const onFulfilledEvent = (data: {
      roomId: string;
      offer: BarterOffer;
      accepterId: string;
      accepterName: string;
    }) => {
      if (data.roomId !== roomId) return;
      // The server sends this before the board update that drops the
      // offer, so by the time that update is read the id is already here.
      settledRef.current.add(data.offer.id);
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

  // Withdrawing is the one departure the poster already knows about, so
  // the escrow goes back right here rather than waiting for the board to
  // confirm it. Marking the id settled at the same moment is what keeps
  // the update that follows from returning the same goods twice, and it
  // stays correct if the server never acts on the withdrawal at all: the
  // goods are back either way, exactly once.
  const cancel = useCallback(
    (offer: BarterOffer) => {
      if (!socket) return;
      settledRef.current.add(offer.id);
      onRefundRef.current(offer);
      socket.emit("barter:cancel", { roomId, offerId: offer.id });
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

  return {
    offers,
    error,
    clearError: () => setError(null),
    post,
    cancel,
    accept,
  };
}
