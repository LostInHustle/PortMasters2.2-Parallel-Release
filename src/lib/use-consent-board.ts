"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { consentSettled, type ConsentTerms } from "@/lib/game/engine";

/**
 * The channel one kind of agreement speaks on, which is the whole of what
 * the two markets differ on at this layer.
 *
 * A channel is event names and a field name rather than a callback that
 * parses a board, because both kinds receive the same shape on the wire and
 * only call it different things: `{roomId, contracts}` for the market D3
 * shipped and `{roomId, refits}` for D4's bench, each named once on the
 * server where it is packed (see consentBoard in src/server/realtime). The
 * field name is a contract with every client already connected, so it is
 * read here as the string the server sent rather than inferred from the
 * kind.
 */
type ConsentChannel = {
  /** The event a personalized board arrives on. */
  update: string;
  /** The event a refusal arrives on. */
  error: string;
  /** The event this client asks for the board on. */
  stateRequest: string;
  /** The field the rows arrive in. */
  field: string;
};

/**
 * One captain's view of one kind's board: a thin relay around a consent
 * market's socket events, kept separate from GameState the same way
 * useBarter and useConvoy are, since an agreement between two captains is
 * something no single client's deterministic engine can compute on its own.
 *
 * This hook only tracks the board. The actual Gold and the actual work
 * (the fee moving when the two captains agree, the points going back on a
 * garment, the absorbed raid moving from a seller's purse) are the caller's
 * job, through applyEscortSide or applyRefitSide. Each captain applies
 * their own side to their own state, which is the tree's standing model for
 * cross captain movement, so nothing here reads a purse at all.
 *
 * Noticing rather than being told is what makes that report safe to run in
 * every phase. A row is reported only when it has settled and the status
 * this captain was last shown for it has changed, and only for a row that
 * names this captain on one of its two sides, so a repeated or a stale
 * broadcast cannot move the same Gold twice and a row that came back cannot
 * move anything at all. Which states settle is the primitive's own reading
 * rather than a test taken here (see consentSettled): the escort's decline
 * is a state past the offer stage that commits nobody, so a report that
 * asked only whether a row had stopped being an offer would hand every
 * caller a movement to apply for a price that came back. The caller's own
 * ledger is the second guard: the apply functions are idempotent per
 * movement, which is what carries a captain through a reload midway between
 * an agreement and the Gold that follows it, when this hook has no memory
 * at all and the whole board arrives anew.
 *
 * There is no refund channel here, and that is the difference between a
 * consent market and the barter board. A posted offer holds no escrow,
 * because there is nothing to hand over until the two captains agree, so an
 * offer that is withdrawn or swept away has nothing to give back: leaving
 * the board is the whole of what happened to it.
 *
 * Written once for both kinds rather than twice, on the same reasoning as
 * the server's board factory: the relay is fifty lines of React that has
 * nothing to do with what a contract is for, and the second copy of it
 * would be the one that forgot the stale-broadcast guard.
 */
export function useConsentBoard<T extends ConsentTerms>(
  socket: Socket | null,
  roomId: string,
  myUserId: string,
  channel: ConsentChannel,
  onSettle: (row: T) => void,
) {
  const [rows, setRows] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);

  // The status this captain was last shown, per row it is a party to.
  // Replaced wholesale on every board rather than amended, so a row that
  // has left the board is forgotten along with it: the map can never hold
  // more than the table's own rows, and a row that somehow came back under
  // the same id would be reported again rather than read as already
  // settled.
  const shownRef = useRef<Map<string, string>>(new Map());

  const onSettleRef = useRef(onSettle);
  useEffect(() => {
    onSettleRef.current = onSettle;
  }, [onSettle]);

  useEffect(() => {
    if (!socket) return;

    const report = (board: T[]): void => {
      const shown = new Map<string, string>();
      for (const row of board) {
        if (row.buyerUserId !== myUserId && row.sellerUserId !== myUserId) {
          continue;
        }
        shown.set(row.id, row.status);
        // Only a row that settled is worth reporting, and the state it
        // settled in is the primitive's to name rather than this relay's:
        // a row still on offer settles nothing, and neither does one that
        // came back (see consentSettled, which the board's own busy rule
        // and the escort's cover mirror read for the same reason).
        if (!consentSettled(row.status)) continue;
        if (shownRef.current.get(row.id) === row.status) continue;
        onSettleRef.current(row);
      }
      shownRef.current = shown;
    };

    // A board arrives as three fields of untyped JSON, so it is narrowed
    // here rather than asserted at every read: the cast below is the single
    // place this layer trusts a shape it did not build, which is the same
    // boundary the server's pack function sits on from the other side. A
    // frame that does not carry a room and a list is dropped rather than
    // drawn, since a board that failed to parse is not an empty board.
    const onUpdate = (data: unknown): void => {
      if (!data || typeof data !== "object") return;
      const frame = data as Record<string, unknown>;
      const board = frame[channel.field];
      if (frame.roomId !== roomId || !Array.isArray(board)) return;
      const next = board as T[];
      setRows(next);
      report(next);
    };
    const onBoardError = (data: { roomId?: string; error?: string }) => {
      if (data?.roomId !== roomId || typeof data.error !== "string") return;
      setError(data.error);
    };

    socket.on(channel.update, onUpdate);
    socket.on(channel.error, onBoardError);
    socket.emit(channel.stateRequest, { roomId });

    return () => {
      socket.off(channel.update, onUpdate);
      socket.off(channel.error, onBoardError);
    };
  }, [socket, roomId, myUserId, channel]);

  const clearError = useCallback(() => setError(null), []);

  return { rows, error, clearError };
}
