"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { AidRequest } from "@/types/realtime";

// Forwarded so the Settlement phase component can import the wire shape
// from the same place it imports the hook. The canonical home is
// @/types/realtime so the realtime layer and the client hook share
// one definition.
export type { AidRequest };

export type GrantedLoan = {
  requestId: string;
  borrowerId: string;
  borrowerName: string;
  helperId: string;
  helperName: string;
  amount: number;
  round: number;
};

export type RepaidLoan = {
  debtId: string;
  amount: number;
  fromUserId: string;
  fromName: string;
};

// Fires only on the original lender's own client, only for a loan they
// redirected before it was repaid: the Gold already went to the redirect
// target via onRepaid on their client instead, this is purely "stop
// tracking a debt that is no longer open."
export type RedirectedLoanClosed = {
  debtId: string;
  redirectedToName: string;
};

/**
 * Phase 3's shared "I'm short, can someone help" board: a thin relay
 * around the aid:* socket events, kept separate from GameState the same
 * way useBarter is, since an open request is real room wide state no
 * single client's deterministic engine can compute on its own. This hook
 * only tracks the board and tells the caller when a loan is granted or
 * repaid; the actual Gold effect (debit the helper, credit the borrower,
 * settle the debt) is the caller's job via the engine functions in
 * src/lib/game/engine.ts.
 *
 * `onGranted` fires once for every loan involving me, on both sides: as
 * the helper (debit my Gold, the request disappears from the board) and
 * as the borrower (credit my Gold, record the debt). The caller tells
 * the two apart from the `role` argument rather than comparing ids itself.
 */
export function useAid(
  socket: Socket | null,
  roomId: string,
  myUserId: string,
  onGranted: (loan: GrantedLoan, role: "borrower" | "helper") => void,
  onRepaid: (loan: RepaidLoan) => void,
  onRedirectedClosed?: (closed: RedirectedLoanClosed) => void,
) {
  const [requests, setRequests] = useState<AidRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onGrantedRef = useRef(onGranted);
  useEffect(() => {
    onGrantedRef.current = onGranted;
  }, [onGranted]);
  const onRepaidRef = useRef(onRepaid);
  useEffect(() => {
    onRepaidRef.current = onRepaid;
  }, [onRepaid]);
  const onRedirectedClosedRef = useRef(onRedirectedClosed);
  useEffect(() => {
    onRedirectedClosedRef.current = onRedirectedClosed;
  }, [onRedirectedClosed]);

  useEffect(() => {
    if (!socket) return;

    const onUpdate = (data: { roomId: string; requests: AidRequest[] }) => {
      if (data.roomId !== roomId) return;
      setRequests(data.requests);
    };
    const onGrantedEvent = (data: GrantedLoan & { roomId: string }) => {
      if (data.roomId !== roomId) return;
      const role =
        data.helperId === myUserId
          ? "helper"
          : data.borrowerId === myUserId
            ? "borrower"
            : null;
      if (role) onGrantedRef.current(data, role);
    };
    const onRepaidEvent = (data: RepaidLoan & { roomId: string }) => {
      if (data.roomId !== roomId) return;
      onRepaidRef.current(data);
    };
    const onRedirectedEvent = (
      data: RedirectedLoanClosed & { roomId: string },
    ) => {
      if (data.roomId !== roomId) return;
      onRedirectedClosedRef.current?.(data);
    };
    const onHelpFail = (data: {
      roomId: string;
      requestId: string;
      reason: string;
    }) => {
      if (data.roomId !== roomId) return;
      setError(data.reason);
    };
    const onPostError = (data: { roomId: string; error: string }) => {
      if (data.roomId !== roomId) return;
      setError(data.error);
    };

    socket.on("aid:update", onUpdate);
    socket.on("aid:granted", onGrantedEvent);
    socket.on("aid:repaid", onRepaidEvent);
    socket.on("aid:redirected", onRedirectedEvent);
    socket.on("aid:help:fail", onHelpFail);
    socket.on("aid:error", onPostError);
    socket.emit("aid:state:request", { roomId });

    return () => {
      socket.off("aid:update", onUpdate);
      socket.off("aid:granted", onGrantedEvent);
      socket.off("aid:repaid", onRepaidEvent);
      socket.off("aid:redirected", onRedirectedEvent);
      socket.off("aid:help:fail", onHelpFail);
      socket.off("aid:error", onPostError);
    };
  }, [socket, roomId, myUserId]);

  const post = useCallback(
    (amount: number) => {
      if (!socket) return;
      socket.emit("aid:post", { roomId, amount });
    },
    [socket, roomId],
  );

  const cancel = useCallback(() => {
    if (!socket) return;
    socket.emit("aid:cancel", { roomId });
  }, [socket, roomId]);

  const help = useCallback(
    (requestId: string) => {
      if (!socket) return;
      setError(null);
      socket.emit("aid:help", { roomId, requestId });
    },
    [socket, roomId],
  );

  const repay = useCallback(
    (lenderId: string, amount: number, debtId: string) => {
      if (!socket) return;
      socket.emit("aid:repay", { roomId, lenderId, amount, debtId });
    },
    [socket, roomId],
  );

  return {
    requests,
    error,
    clearError: () => setError(null),
    post,
    cancel,
    help,
    repay,
  };
}
