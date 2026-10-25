"use client";

import { BarterOffer } from "@/types/realtime/boards";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { refusalHandler } from "@/lib/refusals";

// Re-exported so the Parley panel imports the wire shape from the same
// place as the hook.
export type { BarterOffer };

// A post and the escrow it holds. Both surfaces escrow before sending,
// so a refused post is handed back in this same shape.
export type PostedOffer = {
  offerItem: string;
  offerAmount: number;
  requestItem: string;
  requestAmount: number;
  targetUserId?: string;
  flexible?: boolean;
};

// A refusal echoes the fields that were sent, and the id is minted only
// after acceptance, so these fields are all a match can read. Duplicate
// shapes are allowed; one refusal still returns exactly one post's escrow.
function sameShape(post: PostedOffer, other: Partial<PostedOffer>): boolean {
  return (
    post.offerItem === other.offerItem &&
    post.offerAmount === other.offerAmount &&
    post.requestItem === other.requestItem &&
    post.requestAmount === other.requestAmount &&
    (post.targetUserId ?? "") === (other.targetUserId ?? "") &&
    Boolean(post.flexible) === Boolean(other.flexible)
  );
}

// Take the refused post out of the waiting list. A frame that names
// nothing falls back to the oldest waiting post.
function takeRefusedPost(
  pending: PostedOffer[],
  refused: Partial<PostedOffer>,
): PostedOffer | null {
  const matched = pending.findIndex((post) => sameShape(post, refused));
  const [post] = pending.splice(matched >= 0 ? matched : 0, 1);
  return post ?? null;
}

// The other end of a post's wait: the harbor listed it. Only fresh rows
// count; an offer already on the board answers no post.
function dropConfirmedPosts(
  pending: PostedOffer[],
  board: readonly BarterOffer[],
): void {
  for (const offer of board) {
    const matched = pending.findIndex((post) => sameShape(post, offer));
    if (matched >= 0) pending.splice(matched, 1);
  }
}

/**
 * The shared open offer board: a thin relay around barter:* events,
 * separate from GameState because no single client can compute harbor
 * wide state. This hook tracks the board only; the caller applies the
 * inventory effects through the engine.
 *
 * Both surfaces post here and differ only in `flexible`, which the server
 * reads to apply the Renown gate and allowance. Nothing here enforces
 * either rule.
 *
 * `onFulfilled` fires on both sides of a trade; compare `accepterId` to
 * tell them apart.
 *
 * `onRefund` fires when a held offer leaves the board, whether withdrawn
 * or swept. Refunds deliberately wait for that update: a sale can win the
 * race to a withdrawal, and refunding at the press would pay the poster
 * twice. barter:fulfilled always arrives before the update that drops the
 * offer and marks it settled.
 *
 * `onPostRefused` returns the escrow of a post the harbor rejected.
 */
export function useBarter(
  socket: Socket | null,
  roomId: string,
  myUserId: string,
  onFulfilled: (offer: BarterOffer, accepterId: string) => void,
  onRefund: (offer: BarterOffer) => void,
  onPostRefused: (post: PostedOffer) => void,
) {
  const [offers, setOffers] = useState<BarterOffer[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Accepted flexible offers, as the server counts them. The allowance
  // also needs the Renown level from voyage state, which engine/barterAccess
  // combines, so both screens read the server's policy. Only the flexible
  // composer reads this.
  const [flexibleOffersAccepted, setFlexibleOffersAccepted] = useState(0);

  // This captain's offers exactly as the board last reported them, which
  // doubles as the escrow ledger. No separate tracking means no second
  // source that can drift.
  const myOpenRef = useRef<Map<string, BarterOffer>>(new Map());

  // Ids already handled after leaving the board, so a filled offer is not
  // mistaken for a sweep and paid back as well as sold. Pruned on every
  // update to offers still listed.
  const settledRef = useRef<Set<string>>(new Set());

  const onFulfilledRef = useRef(onFulfilled);
  useEffect(() => {
    onFulfilledRef.current = onFulfilled;
  }, [onFulfilled]);
  const onRefundRef = useRef(onRefund);
  useEffect(() => {
    onRefundRef.current = onRefund;
  }, [onRefund]);
  const onPostRefusedRef = useRef(onPostRefused);
  useEffect(() => {
    onPostRefusedRef.current = onPostRefused;
  }, [onPostRefused]);

  // Unanswered posts in send order, each holding the shape its escrow was
  // taken in. One answer removes one.
  const pendingPostsRef = useRef<PostedOffer[]>([]);

  useEffect(() => {
    if (!socket) return;

    const onUpdate = (data: {
      roomId: string;
      offers: BarterOffer[];
      flexibleOffersAccepted?: number;
    }) => {
      if (data.roomId !== roomId) return;
      setOffers(data.offers);
      setFlexibleOffersAccepted(data.flexibleOffersAccepted ?? 0);
      const next = new Map<string, BarterOffer>();
      // Rows not seen before this update: how a post is confirmed listed.
      const fresh: BarterOffer[] = [];
      for (const o of data.offers) {
        if (o.fromUserId !== myUserId) continue;
        next.set(o.id, o);
        if (!myOpenRef.current.has(o.id) && !settledRef.current.has(o.id))
          fresh.push(o);
      }
      dropConfirmedPosts(pendingPostsRef.current, fresh);
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
      // Sent before the board update drops the offer, so the id is known
      // before the sweep is read.
      settledRef.current.add(data.offer.id);
      onFulfilledRef.current(data.offer, data.accepterId);
    };
    const onAcceptFail = refusalHandler(
      roomId,
      setError,
      (data: { roomId: string; offerId: string; reason: string }) =>
        data.reason,
    );
    // A refused post. The frame names the offer, so its escrow can be
    // found rather than guessed; the error sentence lands as sent.
    const onPostError = (data: {
      roomId: string;
      error: string;
      offerItem?: string;
      offerAmount?: number;
      requestItem?: string;
      requestAmount?: number;
      targetUserId?: string;
      flexible?: boolean;
    }) => {
      if (data.roomId !== roomId) return;
      setError(data.error);
      const refused = takeRefusedPost(pendingPostsRef.current, data);
      if (refused) onPostRefusedRef.current(refused);
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

  // The whole offer object, because `flexible` must travel with it. Clear
  // the previous refusal, then record the post before sending; the caller
  // has already escrowed, so an answer can arrive before this returns.
  const post = useCallback(
    (offer: PostedOffer) => {
      if (!socket) return;
      setError(null);
      pendingPostsRef.current.push(offer);
      socket.emit("barter:post", { roomId, ...offer });
    },
    [socket, roomId],
  );

  // Withdraw only asks. The refund comes when the board drops the offer,
  // never here: a buyer's accept may already be on the wire, and refunding
  // now would pay the poster twice.
  const cancel = useCallback(
    (offer: BarterOffer) => {
      if (!socket) return;
      setError(null);
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

  // Stable across renders so the returned object can keep one identity.
  const clearError = useCallback(() => setError(null), []);

  // One identity until something inside changes; the board takes this
  // whole object as a prop.
  return useMemo(
    () => ({
      offers,
      error,
      clearError,
      flexibleOffersAccepted,
      post,
      cancel,
      accept,
    }),
    [offers, error, clearError, flexibleOffersAccepted, post, cancel, accept],
  );
}
