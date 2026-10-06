"use client";

import { BarterOffer } from "@/types/realtime/boards";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

// Forwarded so the Parley panel can import the wire shape
// from the same place it imports the hook. The canonical home is
// @/types/realtime so the realtime layer and the client hook share
// one definition.
export type { BarterOffer };

/**
 * What a post carries, and what it takes with it.
 *
 * Both surfaces post through the one call, and both take the offered
 * goods out of the hold before they do (the engine's post escrows on the
 * spot, which is what stops one stock from being promised twice). So the
 * shape a post is sent in is also the shape of the escrow a refused one
 * has to hand back, and that is what this type is read for.
 */
export type PostedOffer = {
  offerItem: string;
  offerAmount: number;
  requestItem: string;
  requestAmount: number;
  targetUserId?: string;
  flexible?: boolean;
};

/**
 * Whether a post and something the room said about one are the same
 * offer. A refusal frame echoes the fields the poster sent and a board
 * row carries the same fields on the offer it made, so the fields are
 * all a match can read: the room mints the offer id after the post is
 * accepted, and a refusal names an offer that never got one.
 *
 * Two offers of one shape are indistinguishable, and they are allowed to
 * exist (posting is free, and a captain may advertise the same intent in
 * several places). That is why only one waiting post is answered by one
 * refusal: whichever of the two it matches, the escrow that goes back is
 * one post's worth and exactly one post's worth.
 */
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

/**
 * The post a refusal is about, taken out of the ones still waiting. The
 * frame names the offer it refused, so what comes back is the escrow
 * that post took. A frame from a server older than this bundle names
 * nothing, and the oldest post still waiting is then the only thing it
 * can be about.
 */
export function takeRefusedPost(
  pending: PostedOffer[],
  refused: Partial<PostedOffer>,
): PostedOffer | null {
  const matched = pending.findIndex((post) => sameShape(post, refused));
  const [post] = pending.splice(matched >= 0 ? matched : 0, 1);
  return post ?? null;
}

/**
 * The other way a post's wait ends: the room listed it. A post the room
 * accepted comes back as an offer of mine on the board, and from that
 * moment its escrow has a home on the board and nothing is owed back, so
 * it leaves the waiting list. Only board rows this client has not seen
 * before are handed here, since an offer that was already up when a post
 * went out answers that post no more than it answered its own.
 */
function dropConfirmedPosts(
  pending: PostedOffer[],
  board: readonly BarterOffer[],
  myUserId: string,
): void {
  for (const offer of board) {
    if (offer.fromUserId !== myUserId) continue;
    const matched = pending.findIndex((post) => sameShape(post, offer));
    if (matched >= 0) pending.splice(matched, 1);
  }
}

/**
 * The room's shared open offer board: a thin relay around the barter:*
 * socket events, kept separate from GameState the same way
 * usePlayerDetail is, since an open offer is real room wide state no
 * single client's deterministic engine can compute on its own. This hook
 * only tracks the board; the actual inventory effect (escrow on post,
 * credit and debit on a completed trade, escrow returned on a departure)
 * is the caller's job via the engine functions in
 * src/lib/game/engine.ts.
 *
 * One hook, both surfaces. The Captain's Exchange at the Parley
 * and the composer on a chat post into the same board through the same
 * call, and differ only in the `flexible` flag they carry: that flag is
 * what the server reads to decide whether the Renown gate and the
 * flexible allowance apply. Nothing in this hook enforces either one, so
 * a screen that draws both surfaces from here cannot invent a rule the
 * server does not have.
 *
 * `onFulfilled` fires once for every trade involving me, on both sides:
 * as the accepter (pay the requested item, receive the offered one) and
 * as the original poster (receive the requested item, the offered side
 * was already escrowed away when the offer was posted). The caller tells
 * the two apart by comparing `accepterId` against its own user id.
 *
 * `onRefund` fires with an offer of mine that is holding escrow which now
 * has to come back, and there is exactly one route by which that ever
 * happens: the board stops listing the offer. A withdrawal I asked for is
 * a departure the board confirms, and a sweep when the voyage moves on is
 * another, and the two are the same event to this hook. So the refund is
 * deliberately not taken at the moment of the press: a sale can win the
 * race to an offer a captain is trying to withdraw, and taking the escrow
 * back then would pay the poster twice for it, once in goods and once in
 * the price. Waiting one round trip is what keeps the refund and the
 * fulfilled payment mutually exclusive, since barter:fulfilled always
 * arrives before the update that drops the offer and marks its id
 * settled.
 *
 * Noticing rather than being told is what makes this safe to run in every
 * phase. An offer can only ever be reported here if this client saw it on
 * the board first, addressed to itself, so the report is bounded by the
 * server's own view and a stale or repeated broadcast cannot invent one.
 * The board also arrives whole on every join, which is what makes a
 * reload mid voyage come back with the right escrow ledger.
 *
 * `onPostRefused` fires with a post of mine the room turned away. That
 * post's offered goods are already out of my hold (the caller escrows
 * before it posts, and the engine's own post is what takes them), so this
 * is the one route by which a refusal gives them back. Without it a press
 * made as the leg turns leaves the goods off the board, out of the hold,
 * and gone for the voyage.
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
  // How many of my own flexible offers others have already taken this
  // voyage, as the server counts them. Held as a count rather than as
  // "offers left" because the allowance depends on my Renown level, which
  // the server deliberately does not repeat back to me here: I already
  // hold the authoritative level on my own voyage state, and
  // engine/barterAccess is what turns the pair into an answer, so both
  // screens read the same policy the server enforces.
  //
  // It says nothing about the Captain's Exchange, which is never
  // rationed, so only the flexible composer on a chat reads this.
  const [flexibleOffersAccepted, setFlexibleOffersAccepted] = useState(0);

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
  const onPostRefusedRef = useRef(onPostRefused);
  useEffect(() => {
    onPostRefusedRef.current = onPostRefused;
  }, [onPostRefused]);

  // The posts this client has sent that the room has not answered yet, in
  // the order they went out, each one holding the shape its escrow was
  // taken in. A refusal answers the oldest of them (or the one its frame
  // names) and a board row answers the one it matches, so the list is
  // only ever as long as the posts in flight.
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
      // The rows this client had not seen a moment ago, which is how a
      // post of mine is answered the other way: the room listing it. Read
      // against the board as it was before this update replaces it.
      const fresh: BarterOffer[] = [];
      for (const o of data.offers) {
        if (o.fromUserId !== myUserId) continue;
        next.set(o.id, o);
        if (!myOpenRef.current.has(o.id) && !settledRef.current.has(o.id))
          fresh.push(o);
      }
      dropConfirmedPosts(pendingPostsRef.current, fresh, myUserId);
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
    // A post the room turned away. The frame names the offer it refused
    // (see the post handler in src/server/realtime/wiring/barter), which
    // is what lets the escrow that has to come back be found rather than
    // guessed at. The message is shown as before, and the post's own
    // amounts go back to the hold through the caller.
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

  // The whole offer rather than a row of positional arguments, because
  // `flexible` has to travel with it. It names which surface the post came
  // from, which is the one thing that decides from here on whether the
  // offer is held to the Renown gate and the flexible allowance or whether
  // it is a plain Captain's Exchange offer with neither.
  //
  // The post is written down as it goes out. The caller has already taken
  // the offered goods out of its hold (that is what posting means), so the
  // wait for an answer is the only thing that can give them back, and an
  // answer can arrive before this call has even returned to the caller.
  const post = useCallback(
    (offer: PostedOffer) => {
      if (!socket) return;
      pendingPostsRef.current.push(offer);
      socket.emit("barter:post", { roomId, ...offer });
    },
    [socket, roomId],
  );

  // Withdrawing only asks. The goods come back the same way a swept
  // offer's do, when the board stops listing it, and never at this
  // moment: a buyer's accept can already be on the wire, and paying the
  // goods back on an offer the room has just sold pays the poster twice.
  // So there is no refund here, and nothing is marked settled either: the
  // refund a departure earns is decided by what the board reported, which
  // is the same rule for every offer that leaves it.
  const cancel = useCallback(
    (offer: BarterOffer) => {
      if (!socket) return;
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
    flexibleOffersAccepted,
    post,
    cancel,
    accept,
  };
}
