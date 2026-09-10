"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { LoanRecord } from "@/types/realtime";

// The wire shape for an outstanding loan lives in @/types/realtime as
// LoanRecord. The hook keeps the original OutstandingLoan alias for
// back compat with the Settlement phase component's imports.
export type OutstandingLoan = LoanRecord;

export type BackingResolved = {
  debtId: string;
  refundAmount: number;
  calledAmount: number;
};

export type BackingCovered = {
  debtId: string;
  amount: number;
  backerName: string;
  borrowerName: string;
};

/**
 * Backing: room wide visibility into every outstanding loan (see aid:help
 * in the realtime layer, the moment a request becomes a real debt),
 * and the one action a third captain can take on one: pledge part of
 * their own Gold as a safety net for the lender. The same thin relay
 * shape as useAid: this hook only tracks the board and tells the caller
 * when its own pledge is accepted or a loan it backed resolves; the
 * actual Gold effect is the caller's job via the engine functions in
 * src/lib/game/engine.ts.
 */
export function useBacking(
  socket: Socket | null,
  roomId: string,
  myUserId: string,
  onAccepted: (loan: OutstandingLoan) => void,
  onResolved: (resolved: BackingResolved) => void,
  onCovered: (covered: BackingCovered) => void,
) {
  const [loans, setLoans] = useState<OutstandingLoan[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onAcceptedRef = useRef(onAccepted);
  useEffect(() => {
    onAcceptedRef.current = onAccepted;
  }, [onAccepted]);
  const onResolvedRef = useRef(onResolved);
  useEffect(() => {
    onResolvedRef.current = onResolved;
  }, [onResolved]);
  const onCoveredRef = useRef(onCovered);
  useEffect(() => {
    onCoveredRef.current = onCovered;
  }, [onCovered]);

  useEffect(() => {
    if (!socket) return;

    const onUpdate = (data: { roomId: string; loans: OutstandingLoan[] }) => {
      if (data.roomId !== roomId) return;
      setLoans(data.loans);
    };
    const onAcceptedEvent = (data: OutstandingLoan & { roomId: string }) => {
      if (data.roomId !== roomId || data.backerId !== myUserId) return;
      onAcceptedRef.current(data);
    };
    const onResolvedEvent = (data: BackingResolved & { roomId: string }) => {
      if (data.roomId !== roomId) return;
      onResolvedRef.current(data);
    };
    const onCoveredEvent = (data: BackingCovered & { roomId: string }) => {
      if (data.roomId !== roomId) return;
      onCoveredRef.current(data);
    };
    const onFail = (data: {
      roomId: string;
      debtId: string;
      reason: string;
    }) => {
      if (data.roomId !== roomId) return;
      setError(data.reason);
    };

    socket.on("loans:update", onUpdate);
    socket.on("backing:accepted", onAcceptedEvent);
    socket.on("backing:resolved", onResolvedEvent);
    socket.on("backing:covered", onCoveredEvent);
    socket.on("backing:fail", onFail);
    socket.emit("loans:state:request", { roomId });

    return () => {
      socket.off("loans:update", onUpdate);
      socket.off("backing:accepted", onAcceptedEvent);
      socket.off("backing:resolved", onResolvedEvent);
      socket.off("backing:covered", onCoveredEvent);
      socket.off("backing:fail", onFail);
    };
  }, [socket, roomId, myUserId]);

  const offer = useCallback(
    (debtId: string, amount: number) => {
      if (!socket) return;
      setError(null);
      socket.emit("backing:offer", { roomId, debtId, amount });
    },
    [socket, roomId],
  );

  // Only the lender of one of these loans can call this meaningfully; the
  // server enforces that regardless. Pass an empty targetUserId to clear an
  // already set redirect.
  const redirect = useCallback(
    (debtId: string, targetUserId: string) => {
      if (!socket) return;
      socket.emit("loan:redirect", { roomId, debtId, targetUserId });
    },
    [socket, roomId],
  );

  return {
    loans,
    error,
    clearError: () => setError(null),
    offer,
    redirect,
  };
}
