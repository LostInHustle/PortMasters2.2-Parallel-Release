"use client";

import { useCallback } from "react";
import type { Socket } from "socket.io-client";
import type { RefitContract } from "@/lib/game/engine";
import { useConsentBoard } from "./use-consent-board";

// Forwarded so the port panel can import the row shape from the same place
// it imports the hook. The canonical home is the game layer, which is what
// both ends of the wire import (see the note on RefitBoard in
// @/types/realtime).
export type { RefitContract };

// The events this bench speaks on, named in one place for the reason the
// escort's own channel is (see ./use-consent-board).
const CHANNEL = {
  update: "refit:update",
  error: "refit:error",
  stateRequest: "refit:state:request",
  field: "refits",
} as const;

/**
 * The room's refit board, as one captain sees it.
 *
 * The board, the per captain filtering and the report that fires when a
 * refit this captain is party to moves past the offer stage are the shared
 * relay's (see ./use-consent-board). What is left here is what only the
 * bench can say: the three actions a captain takes against it.
 *
 * There is no claim. A refit settles the moment it is agreed, because both
 * sides of it are known at that moment: the customer pays the price the two
 * captains named and the points go back on their own garment, on their own
 * machine (see applyRefitSide). The escort's claim exists because one half
 * of that trade, what a raid would have taken, is a number that does not
 * exist until Resolve, which is a fact about cover rather than about
 * agreements.
 */
export function useRefitContracts(
  socket: Socket | null,
  roomId: string,
  myUserId: string,
  onSettle: (refit: RefitContract) => void,
) {
  const {
    rows: refits,
    error,
    clearError,
  } = useConsentBoard(socket, roomId, myUserId, CHANNEL, onSettle);

  // A price and the garment it buys work on. `targetUserId` names the
  // captain the offer is addressed to, and omitting it posts to the whole
  // table, which is the one shape of post the server treats as its own
  // buyer when it bounds how many offers a seller may have standing.
  const post = useCallback(
    (fee: number, good: string, targetUserId?: string) => {
      if (!socket) return;
      clearError();
      socket.emit("refit:post", { roomId, fee, good, targetUserId });
    },
    [socket, roomId, clearError],
  );

  const accept = useCallback(
    (contractId: string) => {
      if (!socket) return;
      clearError();
      socket.emit("refit:accept", { roomId, contractId });
    },
    [socket, roomId, clearError],
  );

  // The seller's own withdrawal. The last refusal is cleared first, the
  // same clear the escort's cancel makes and for the same reason: the
  // refusal this press can meet is the one saying the row moved past an
  // offer before the press landed, and the previous sentence must not be
  // left standing over the answer to this one (see ./use-escort-contracts,
  // whose cancel carries the identical call).
  const cancel = useCallback(
    (contractId: string) => {
      if (!socket) return;
      clearError();
      socket.emit("refit:cancel", { roomId, contractId });
    },
    [socket, roomId, clearError],
  );

  return {
    refits,
    error,
    clearError,
    post,
    accept,
    cancel,
  };
}
