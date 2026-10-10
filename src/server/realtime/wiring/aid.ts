// =====================================================================
// Financial aid: the request board's frames, over ../aid's own book.
// =====================================================================

import type { Server, Socket } from "socket.io";

import {
  aidList,
  currentCheckpointRound,
  removeAidRequest,
  removeUserAidRequest,
  setAidRequest,
} from "../aid";
import { requireAuth, seated } from "../auth";
import { rowId } from "../ids";
import {
  broadcastLoans,
  loanList,
  rememberLoan,
  removeLoan,
  resolveBackingFor,
  updateLoan,
} from "../loans";
import { emitToUser, roomMembers } from "../presence";

// Both books answer with this when the loan a press named is already gone:
// the repayment handler below and the backing handler under it look the
// same list up for two different presses, so the sentence is said once
// here rather than spelled twice and drifting.
const LOAN_GONE = "That loan is no longer outstanding.";

export function wireAid(io: Server, socket: Socket): void {
  socket.on("aid:state:request", (payload: { roomId?: string }) => {
    const s = seated(socket, payload);
    if (!s) return;
    const { roomId } = s;
    socket.emit("aid:update", { roomId, requests: aidList(roomId) });
  });

  socket.on("aid:post", (payload: { roomId?: string; amount?: number }) => {
    const s = seated(socket, payload);
    if (!s) return;
    const { roomId } = s;
    const amount = payload?.amount;
    if (!Number.isInteger(amount) || (amount as number) < 1) {
      socket.emit("aid:error", { roomId, error: "Invalid aid request" });
      return;
    }
    const request = {
      id: rowId(roomId, s.userId),
      fromUserId: s.userId,
      fromName: s.user.displayName,
      amount: amount as number,
      round: currentCheckpointRound(roomId),
    };
    setAidRequest(io, roomId, request);
  });

  socket.on("aid:cancel", (payload: { roomId?: string }) => {
    const s = seated(socket, payload);
    if (!s) return;
    const { roomId } = s;
    removeUserAidRequest(io, roomId, s.userId);
  });

  socket.on("aid:help", (payload: { roomId?: string; requestId?: string }) => {
    const s = requireAuth(socket);
    if (!s) return;
    const roomId = payload?.roomId ?? s.roomId;
    if (!roomId || roomId !== s.roomId || !payload?.requestId) return;
    const list = aidList(roomId);
    const request = list.find((r) => r.id === payload.requestId);
    if (!request) {
      socket.emit("aid:help:fail", {
        roomId,
        requestId: payload.requestId,
        reason: "That request is no longer open.",
      });
      return;
    }
    if (request.fromUserId === s.userId) {
      socket.emit("aid:help:fail", {
        roomId,
        requestId: payload.requestId,
        reason: "You can't fund your own request.",
      });
      return;
    }
    removeAidRequest(io, roomId, request.id);
    const granted = {
      roomId,
      requestId: request.id,
      borrowerId: request.fromUserId,
      borrowerName: request.fromName,
      helperId: s.userId,
      helperName: s.user.displayName,
      amount: request.amount,
      round: request.round,
    };
    rememberLoan(roomId, {
      debtId: request.id,
      borrowerId: request.fromUserId,
      borrowerName: request.fromName,
      lenderId: s.userId,
      lenderName: s.user.displayName,
      amount: request.amount,
      round: request.round,
    });
    broadcastLoans(io, roomId);
    socket.emit("aid:granted", granted);
    emitToUser(io, request.fromUserId, "aid:granted", granted);
  });

  socket.on(
    "aid:repay",
    (payload: { roomId?: string; amount?: number; debtId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      if (!roomId || roomId !== s.roomId) return;
      const amount = payload?.amount;
      const debtId = payload?.debtId;
      // Both answers are spoken. The borrower's client applies nothing on
      // its own, since the debt is the room's to close and the loan can be
      // gone by the time the press lands, so a silent return would leave
      // the press unanswered and the two books disagreeing about a debt
      // nobody could then settle. The receipt names the debt it closed,
      // and the refusal carries the sentence the member screen draws.
      const refuse = (reason: string): void => {
        socket.emit("aid:repay:fail", { roomId, reason });
      };
      if (!debtId || !Number.isInteger(amount) || (amount as number) < 0) {
        refuse("Invalid repayment");
        return;
      }
      const loan = loanList(roomId).find((l) => l.debtId === debtId);
      if (!loan) {
        refuse(LOAN_GONE);
        return;
      }
      if (loan.borrowerId !== s.userId) {
        refuse("That loan is not yours to repay.");
        return;
      }
      removeLoan(roomId, debtId);
      const payeeId = loan.redirectToUserId ?? loan.lenderId;
      if ((amount as number) > 0) {
        const repaid = {
          roomId,
          debtId,
          amount,
          fromUserId: s.userId,
          fromName: s.user.displayName,
        };
        emitToUser(io, payeeId, "aid:repaid", repaid);
      }
      if (loan.redirectToUserId) {
        emitToUser(io, loan.lenderId, "aid:redirected", {
          roomId,
          debtId,
          redirectedToName: loan.redirectToName ?? "another captain",
        });
      }
      resolveBackingFor(io, roomId, loan, amount as number);
      broadcastLoans(io, roomId);
      // The receipt, to the captain who paid. Emitted from this same
      // synchronous block as the bookkeeping above, so the client that
      // sent the press can never read the receipt before the loan is
      // actually closed.
      socket.emit("aid:repay:ok", { roomId, debtId });
    },
  );

  socket.on(
    "loan:redirect",
    (payload: { roomId?: string; debtId?: string; targetUserId?: string }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      const debtId = payload?.debtId;
      const targetUserId = payload?.targetUserId ?? "";
      if (!roomId || roomId !== s.roomId || !debtId) return;
      const loan = loanList(roomId).find((l) => l.debtId === debtId);
      if (!loan || loan.lenderId !== s.userId) return;
      if (!targetUserId) {
        delete loan.redirectToUserId;
        delete loan.redirectToName;
        updateLoan(roomId, loan);
        broadcastLoans(io, roomId);
        return;
      }
      if (targetUserId === loan.lenderId || targetUserId === loan.borrowerId)
        return;
      const target = roomMembers(roomId).find((m) => m.id === targetUserId);
      if (!target) return;
      loan.redirectToUserId = target.id;
      loan.redirectToName = target.displayName;
      updateLoan(roomId, loan);
      broadcastLoans(io, roomId);
    },
  );

  socket.on("loans:state:request", (payload: { roomId?: string }) => {
    const s = seated(socket, payload);
    if (!s) return;
    const { roomId } = s;
    socket.emit("loans:update", { roomId, loans: loanList(roomId) });
  });

  socket.on(
    "backing:offer",
    (payload: { roomId?: string; debtId?: string; amount?: number }) => {
      const s = requireAuth(socket);
      if (!s) return;
      const roomId = payload?.roomId ?? s.roomId;
      const debtId = payload?.debtId;
      const amount = payload?.amount;
      if (
        !roomId ||
        roomId !== s.roomId ||
        !debtId ||
        !Number.isInteger(amount) ||
        (amount as number) < 1
      )
        return;
      const loan = loanList(roomId).find((l) => l.debtId === debtId);
      if (!loan) {
        socket.emit("backing:fail", {
          roomId,
          debtId,
          reason: LOAN_GONE,
        });
        return;
      }
      if (loan.borrowerId === s.userId || loan.lenderId === s.userId) {
        socket.emit("backing:fail", {
          roomId,
          debtId,
          reason: "You can't back a loan you're already part of.",
        });
        return;
      }
      if (loan.backerId) {
        socket.emit("backing:fail", {
          roomId,
          debtId,
          reason: "That loan already has a backer.",
        });
        return;
      }
      const accepted = Math.min(amount as number, loan.amount);
      loan.backerId = s.userId;
      loan.backerName = s.user.displayName;
      loan.backedAmount = accepted;
      updateLoan(roomId, loan);
      broadcastLoans(io, roomId);
      const acceptedEvent = { ...loan, roomId };
      emitToUser(io, s.userId, "backing:accepted", acceptedEvent);
    },
  );
}
