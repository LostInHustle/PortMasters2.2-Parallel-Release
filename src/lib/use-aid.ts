"use client";

import { AidRequest } from "@/types/realtime/boards";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

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

// The receipt for a repayment I sent: the room found the loan and closed
// it, so this client's own debt can move. It carries the debt rather than
// the Gold because the amount is this captain's own ledger, recorded here
// when the loan was granted, and the debt id says which one this closes.
export type RepaymentSettled = {
  debtId: string;
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
 * Resolve's shared "I'm short, can someone help" board: a thin relay
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
 *
 * `onRepaymentSettled` fires on the client that asked to repay, once the
 * room has closed the loan, and it is the only thing that ever moves a
 * debt on this side: the press asks, and the loan is the room's to close
 * (a voyage that ended or a seat that was written off can have taken it
 * already, in which case the press is refused rather than answered and
 * nothing here moves). A refusal arrives as this hook's `error`, which is
 * the sentence the member screens draw.
 */
export function useAid(
  socket: Socket | null,
  roomId: string,
  myUserId: string,
  onGranted: (loan: GrantedLoan, role: "borrower" | "helper") => void,
  onRepaid: (loan: RepaidLoan) => void,
  onRedirectedClosed?: (closed: RedirectedLoanClosed) => void,
  onRepaymentSettled?: (settled: RepaymentSettled) => void,
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
  const onRepaymentSettledRef = useRef(onRepaymentSettled);
  useEffect(() => {
    onRepaymentSettledRef.current = onRepaymentSettled;
  }, [onRepaymentSettled]);

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
    // The two answers a repayment gets. Both are spoken, because the
    // borrower's client applies nothing on its own: the receipt is what
    // moves the debt, and the refusal is what says the room has none to
    // close rather than leaving the press waiting on an answer that is
    // never coming.
    const onRepaySettled = (data: RepaymentSettled & { roomId: string }) => {
      if (data.roomId !== roomId) return;
      onRepaymentSettledRef.current?.(data);
    };
    // The refusal writes this hook's own error state, and no debt id
    // travels with it: only one refusal is held at a time, so the sentence
    // is the whole of what a screen draws and the press it answers is the
    // only one it can be about.
    const onRepayFail = (data: { roomId: string; reason: string }) => {
      if (data.roomId !== roomId) return;
      setError(data.reason);
    };

    socket.on("aid:update", onUpdate);
    socket.on("aid:granted", onGrantedEvent);
    socket.on("aid:repaid", onRepaidEvent);
    socket.on("aid:redirected", onRedirectedEvent);
    socket.on("aid:help:fail", onHelpFail);
    socket.on("aid:error", onPostError);
    socket.on("aid:repay:ok", onRepaySettled);
    socket.on("aid:repay:fail", onRepayFail);
    socket.emit("aid:state:request", { roomId });

    return () => {
      socket.off("aid:update", onUpdate);
      socket.off("aid:granted", onGrantedEvent);
      socket.off("aid:repaid", onRepaidEvent);
      socket.off("aid:redirected", onRedirectedEvent);
      socket.off("aid:help:fail", onHelpFail);
      socket.off("aid:error", onPostError);
      socket.off("aid:repay:ok", onRepaySettled);
      socket.off("aid:repay:fail", onRepayFail);
    };
  }, [socket, roomId, myUserId]);

  // Every press clears the last refusal before it goes out, so a sentence
  // about a request that is no longer standing cannot outlive the press
  // that replaces it.
  const post = useCallback(
    (amount: number) => {
      if (!socket) return;
      setError(null);
      socket.emit("aid:post", { roomId, amount });
    },
    [socket, roomId],
  );

  const cancel = useCallback(() => {
    if (!socket) return;
    setError(null);
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

  // Repaying only asks, the same way helping does: the room holds the
  // loan, so the room says whether it can be closed, and the caller
  // applies nothing until the receipt arrives. The forced settlement at
  // the end of a voyage asks through this same call, where the local
  // debts were already closed and a receipt finds nothing to move. The
  // debt and the amount are the whole of what the room needs: it holds
  // the loan, so it already knows who lent it.
  const repay = useCallback(
    (amount: number, debtId: string) => {
      if (!socket) return;
      setError(null);
      socket.emit("aid:repay", { roomId, amount, debtId });
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
