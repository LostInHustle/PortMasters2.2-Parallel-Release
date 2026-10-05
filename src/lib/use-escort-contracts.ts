"use client";

import { useCallback } from "react";
import type { Socket } from "socket.io-client";
import type { EscortContract } from "@/lib/game/engine";
import { useConsentBoard } from "./use-consent-board";

// Forwarded so the Parley panel can import the row shape from the same
// place it imports the hook. The canonical home is the game layer, which
// is what both ends of the wire import (see the note on EscortBoard in
// @/types/realtime).
export type { EscortContract };

// The events this market speaks on. The channel is the whole of what this
// hook adds to the shared relay, and it is declared beside the emitters
// below rather than inlined at the call so a reader can see the five names
// together (see useConsentBoard in ./use-consent-board).
const CHANNEL = {
  update: "contract:update",
  error: "contract:error",
  stateRequest: "contract:state:request",
  field: "contracts",
} as const;

/**
 * The room's escort contract board, as one captain sees it.
 *
 * The board itself, the per captain filtering and the report that fires
 * when a contract this captain is party to moves past the offer stage are
 * the shared relay's (see ./use-consent-board, which is where the
 * stale-broadcast guard and the reload story are written). What is left
 * here is what only the escort can say: the five actions a captain takes
 * against this market (post, accept, decline, withdraw, and the claim,
 * which no other kind has because it is about a raid).
 */
export function useEscortContracts(
  socket: Socket | null,
  roomId: string,
  myUserId: string,
  onSettle: (contract: EscortContract) => void,
) {
  const {
    rows: contracts,
    error,
    clearError,
  } = useConsentBoard(socket, roomId, myUserId, CHANNEL, onSettle);

  // A fee as the board accepts one. `targetUserId` names the captain this
  // offer is addressed to, and omitting it posts to the whole table, which
  // is the one shape of post the server treats as its own buyer when it
  // bounds how many offers a seller may have standing.
  const post = useCallback(
    (fee: number, targetUserId?: string) => {
      if (!socket) return;
      clearError();
      socket.emit("contract:post", { roomId, fee, targetUserId });
    },
    [socket, roomId, clearError],
  );

  const accept = useCallback(
    (contractId: string) => {
      if (!socket) return;
      clearError();
      socket.emit("contract:accept", { roomId, contractId });
    },
    [socket, roomId, clearError],
  );

  // The addressed captain's own refusal. It is not the seller's cancel and
  // it is deliberately a frame of its own rather than that one reused: a
  // cancel takes an offer off the board, and a decline leaves the row where
  // its seller can read that the price came back (see the handler in
  // src/server/realtime/wiring/escort-contracts.ts).
  const decline = useCallback(
    (contractId: string) => {
      if (!socket) return;
      clearError();
      socket.emit("contract:decline", { roomId, contractId });
    },
    [socket, roomId, clearError],
  );

  // The seller's own withdrawal, which is the one press on this board that
  // carries no sentence of its own on success: the row leaves the board,
  // which is what a withdrawal is. The refusal it can meet (an offer that
  // has since been agreed) arrives like every other, and the previous
  // refusal is cleared first so a press that lands does not leave the last
  // one standing over it.
  const cancel = useCallback(
    (contractId: string) => {
      if (!socket) return;
      clearError();
      socket.emit("contract:cancel", { roomId, contractId });
    },
    [socket, roomId, clearError],
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
    clearError,
    post,
    accept,
    decline,
    cancel,
    claim,
  };
}
