"use client";

import { useCallback, useEffect, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  normalizeBazaarRumor,
  type PublicRumor,
  type RumorDirection,
} from "@/lib/game/engine";
import { refusedForRoom } from "@/lib/refusals";

// The events this desk speaks on, named in one place for the reason the
// escort's and the bench's own channels are (see ./use-consent-board).
const CHANNEL = {
  update: "bazaar:update",
  error: "bazaar:error",
  stateRequest: "bazaar:state:request",
  publish: "bazaar:publish",
} as const;

/**
 * The room's bazaar board, as one captain sees it.
 *
 * A thin relay around the desk's socket events, kept separate from
 * GameState the same way useBarter and useConsentBoard are, since a rumor
 * is something no single client's deterministic engine can compute on its
 * own: only the room knows who spoke.
 *
 * It is shorter than the two consent relays and the reason is the shape of
 * the feature rather than a corner cut. There is no settle report here,
 * because nothing about a rumor moves Gold or goods: the publisher is paid
 * in the market moving, and what the lean does to a price is worked out on
 * every client's own deterministic draw from the number the server sends
 * on the advance (see applyBazaarLean). There is no per captain filtering
 * here either, and that one is the point: the filtering is the feature's
 * secret and it is done on the server, once, in the one function that
 * knows the room's leg (see publicRumors). A client that filtered would be
 * a client holding the directions it is not owed.
 *
 * What is left is what a relay is: subscribe, heal, ask, publish, and keep
 * the server's refusal where the panel can read it.
 */
export function useBazaarRumors(socket: Socket | null, roomId: string) {
  const [rumors, setRumors] = useState<PublicRumor[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    // A board arrives as untyped JSON, so every row is narrowed rather than
    // asserted: the normalizer is the single place this layer trusts a
    // shape it did not build, which is the same boundary the server's
    // payload builder sits on from the other side. A frame that does not
    // carry a room and a list is dropped rather than drawn, since a board
    // that failed to parse is not an empty board, and a row that is not a
    // row is dropped rather than rendered as a blank line under a
    // captain's name.
    const onUpdate = (data: unknown): void => {
      if (!data || typeof data !== "object") return;
      const frame = data as Record<string, unknown>;
      if (frame.roomId !== roomId || !Array.isArray(frame.rumors)) return;
      const next: PublicRumor[] = [];
      for (const raw of frame.rumors) {
        const row = normalizeBazaarRumor(raw);
        if (row) next.push(row);
      }
      setRumors(next);
    };
    const onBoardError = (data: { roomId?: string; error?: string }) => {
      const err = refusedForRoom(data, roomId);
      if (err === null) return;
      setError(err);
    };

    socket.on(CHANNEL.update, onUpdate);
    socket.on(CHANNEL.error, onBoardError);
    socket.emit(CHANNEL.stateRequest, { roomId });

    return () => {
      socket.off(CHANNEL.update, onUpdate);
      socket.off(CHANNEL.error, onBoardError);
    };
  }, [socket, roomId]);

  // The one action. It carries a good and a direction and nothing else,
  // and the server decides everything that follows: whether this captain
  // may speak at all, whether the good is one the coming market trades, and
  // whether the cooldown has run out. The desk draws the same answers
  // before the click, but it is the server's row that the room reads.
  const publish = useCallback(
    (good: string, direction: RumorDirection) => {
      if (!socket) return;
      setError(null);
      socket.emit(CHANNEL.publish, { roomId, good, direction });
    },
    [socket, roomId],
  );

  const clearError = useCallback(() => setError(null), []);

  return { rumors, error, clearError, publish };
}
