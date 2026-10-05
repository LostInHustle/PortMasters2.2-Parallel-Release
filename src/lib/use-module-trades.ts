"use client";

import { useCallback } from "react";
import type { Socket } from "socket.io-client";
import type { ModuleTrade } from "@/lib/game/engine";
import { useConsentBoard } from "./use-consent-board";

// Forwarded so the market panel can import the row shape from the same
// place it imports the hook. The canonical home is the game layer, which is
// what both ends of the wire import (see the note on ModuleTradeBoard in
// @/types/realtime).
export type { ModuleTrade };

// The events this market speaks on, named in one place for the reason the
// two markets before it name theirs (see ./use-consent-board).
const CHANNEL = {
  update: "module:update",
  error: "module:error",
  stateRequest: "module:state:request",
  field: "moduleTrades",
} as const;

/**
 * The room's module market, as one captain sees it.
 *
 * The board, the per captain filtering and the report that fires when a
 * trade this captain is party to moves past the offer stage are the shared
 * relay's (see ./use-consent-board). What is left here is what only this
 * market can say: the three actions a captain takes against it.
 *
 * There is no claim, for the reason the bench's own hook gives: both sides
 * of a module trade are known the moment the two captains agree, since
 * what moves is a card and a price rather than a number that only exists
 * after a roll (see applyModuleTradeSide). A trade settles within a tick
 * of the accept, on the two captains' own machines, and this hook is what
 * carries the accept that starts it.
 */
export function useModuleTrades(
  socket: Socket | null,
  roomId: string,
  myUserId: string,
  onSettle: (trade: ModuleTrade) => void,
) {
  const {
    rows: moduleTrades,
    error,
    clearError,
  } = useConsentBoard(socket, roomId, myUserId, CHANNEL, onSettle);

  // A price and the module it buys. `targetUserId` names the captain the
  // offer is addressed to, and omitting it posts to the whole table, which
  // is the one shape of post the server treats as its own buyer when it
  // bounds how many offers a seller may have standing.
  const post = useCallback(
    (fee: number, moduleId: string, targetUserId?: string) => {
      if (!socket) return;
      clearError();
      socket.emit("module:post", {
        roomId,
        fee,
        module: moduleId,
        targetUserId,
      });
    },
    [socket, roomId, clearError],
  );

  const accept = useCallback(
    (tradeId: string) => {
      if (!socket) return;
      clearError();
      socket.emit("module:accept", { roomId, tradeId });
    },
    [socket, roomId, clearError],
  );

  // The seller's own withdrawal. The last refusal is cleared first, the
  // same clear the escort's cancel and the bench's make and for the same
  // reason: the refusal this press can meet is the one saying the row
  // moved past an offer before the press landed, and the previous
  // sentence must not be left standing over the answer to this one (see
  // ./use-escort-contracts and ./use-refit-contracts, whose cancels carry
  // the identical call).
  const cancel = useCallback(
    (tradeId: string) => {
      if (!socket) return;
      clearError();
      socket.emit("module:cancel", { roomId, tradeId });
    },
    [socket, roomId, clearError],
  );

  return {
    moduleTrades,
    error,
    clearError,
    post,
    accept,
    cancel,
  };
}
