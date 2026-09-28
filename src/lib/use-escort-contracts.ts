"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { EscortContract } from "@/lib/game/engine";

// Forwarded so the Parley panel can import the row shape from the same
// place it imports the hook. The canonical home is the game layer, which
// is what both ends of the wire import (see the note on EscortBoard in
// @/types/realtime).
export type { EscortContract };

/**
 * The room's escort contract board: a thin relay around the contract:*
 * socket events, kept separate from GameState the same way useBarter and
 * useConvoy are, since a contract is an agreement between two captains
 * that no single client's deterministic engine can compute on its own.
 * This hook only tracks the board; the actual Gold effect (the fee moving
 * when the two captains agree, the absorbed raid moving when the covered
 * captain reports one) is the caller's job via applyEscortSide in
 * src/lib/game/engine.ts.
 *
 * `onSettle` fires for every contract this captain is a party to that has
 * moved past the offer stage, on both sides of it: as the buyer paying the
 * fee, as the seller receiving it, and as the seller absorbing a claim.
 * Each captain applies their own side to their own purse, which is the
 * tree's standing model for cross captain money, so nothing here reads a
 * purse at all.
 *
 * Noticing rather than being told is what makes that report safe to run in
 * every phase. A contract is reported only when the status this captain was
 * last shown for it has changed, and only for a row that names this captain
 * on one of its two sides, so a repeated or a stale broadcast cannot move
 * the same Gold twice. The caller's own ledger is the second guard:
 * applyEscortSide is idempotent per movement, which is what carries a
 * captain through a reload midway between an agreement and the fee that
 * follows it, when this hook has no memory at all and the whole board
 * arrives anew.
 *
 * There is no refund channel here, and that is the difference between this
 * market and the barter board. A posted contract holds no escrow, because
 * there is nothing to hand over until the two captains agree, so an offer
 * that is withdrawn or swept away has nothing to give back: leaving the
 * board is the whole of what happened to it.
 */
export function useEscortContracts(
  socket: Socket | null,
  roomId: string,
  myUserId: string,
  onSettle: (contract: EscortContract) => void,
) {
  const [contracts, setContracts] = useState<EscortContract[]>([]);
  const [error, setError] = useState<string | null>(null);

  // The status this captain was last shown, per contract it is a party to.
  // Replaced wholesale on every board rather than amended, so a contract
  // that has left the board is forgotten along with it: the map can never
  // hold more than the table's own rows, and a contract that somehow came
  // back under the same id would be reported again rather than read as
  // already settled.
  const shownRef = useRef<Map<string, string>>(new Map());

  const onSettleRef = useRef(onSettle);
  useEffect(() => {
    onSettleRef.current = onSettle;
  }, [onSettle]);

  useEffect(() => {
    if (!socket) return;

    const report = (board: EscortContract[]): void => {
      const shown = new Map<string, string>();
      for (const contract of board) {
        if (
          contract.buyerUserId !== myUserId &&
          contract.sellerUserId !== myUserId
        ) {
          continue;
        }
        shown.set(contract.id, contract.status);
        if (contract.status === "offered") continue;
        if (shownRef.current.get(contract.id) === contract.status) continue;
        onSettleRef.current(contract);
      }
      shownRef.current = shown;
    };

    const onUpdate = (data: {
      roomId: string;
      contracts: EscortContract[];
    }) => {
      if (data.roomId !== roomId) return;
      setContracts(data.contracts);
      report(data.contracts);
    };
    const onContractError = (data: { roomId: string; error: string }) => {
      if (data.roomId !== roomId) return;
      setError(data.error);
    };

    socket.on("contract:update", onUpdate);
    socket.on("contract:error", onContractError);
    socket.emit("contract:state:request", { roomId });

    return () => {
      socket.off("contract:update", onUpdate);
      socket.off("contract:error", onContractError);
    };
  }, [socket, roomId, myUserId]);

  // A fee as the board accepts one. `targetUserId` names the captain this
  // offer is addressed to, and omitting it posts to the whole table, which
  // is the one shape of post the server treats as its own buyer when it
  // bounds how many offers a seller may have standing.
  const post = useCallback(
    (fee: number, targetUserId?: string) => {
      if (!socket) return;
      setError(null);
      socket.emit("contract:post", { roomId, fee, targetUserId });
    },
    [socket, roomId],
  );

  const accept = useCallback(
    (contractId: string) => {
      if (!socket) return;
      setError(null);
      socket.emit("contract:accept", { roomId, contractId });
    },
    [socket, roomId],
  );

  const cancel = useCallback(
    (contractId: string) => {
      if (!socket) return;
      socket.emit("contract:cancel", { roomId, contractId });
    },
    [socket, roomId],
  );

  // The covered captain's report that a raid arrived and the guns answered
  // it. It carries the Gold the raid would have taken, which only that
  // captain's own client can know, and the seller's client is what turns it
  // into a bill (see escortClaimFrom and applyEscortSide).
  const claim = useCallback(
    (contractId: string, raidGold: number) => {
      if (!socket) return;
      socket.emit("contract:claim", { roomId, contractId, raidGold });
    },
    [socket, roomId],
  );

  return {
    contracts,
    error,
    clearError: () => setError(null),
    post,
    accept,
    cancel,
    claim,
  };
}
